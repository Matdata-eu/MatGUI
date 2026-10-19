/**
 * Classes and properties used in an endpoint, for the class and property autocompleters of Yasqe.
 *
 * The terms come from what the Endpoint overview already knows about the endpoint: the VoID class and
 * property partitions, and the cached results of its "Classes" and "Properties" queries. When none of these
 * is available, a bounded background query fetches the most used terms (see `autocompleteQueries`).
 */
import type { DescribeQuery } from "./describeQueries";
import type { DescribeResult } from "./DescribeStore";
import type { EndpointMetadata } from "./metadataSources";

export type TermType = "class" | "property";

export interface EndpointTermCount {
  iri: string;
  count?: number;
}

/** Number of terms fetched by the background query (the cache persists at most this many rows) */
export const AUTOCOMPLETE_LIMIT = 200;
/** A failed background query is not retried for this long */
export const AUTOCOMPLETE_RETRY_MS = 60 * 60 * 1000;

export const autocompleteQueries: { [type in TermType]: DescribeQuery } = {
  class: {
    id: "autocomplete-classes",
    category: "autocomplete",
    label: "Classes for autocompletion",
    query: `SELECT ?class (COUNT(?instance) AS ?instances) WHERE {\n  ?instance a ?class\n}\nGROUP BY ?class\nORDER BY DESC(?instances)\nLIMIT ${AUTOCOMPLETE_LIMIT}`,
  },
  property: {
    id: "autocomplete-properties",
    category: "autocomplete",
    label: "Properties for autocompletion",
    query: `SELECT ?property (COUNT(*) AS ?uses) WHERE {\n  ?s ?property ?o\n}\nGROUP BY ?property\nORDER BY DESC(?uses)\nLIMIT ${AUTOCOMPLETE_LIMIT}`,
  },
};

/** The Endpoint overview queries whose results are reused, with their IRI and count variables */
const overviewQueries: { [type in TermType]: { id: string; iriVar: string; countVar: string } } = {
  class: { id: "classes", iriVar: "class", countVar: "instances" },
  property: { id: "properties", iriVar: "property", countVar: "uses" },
};

function termsFromResult(
  result: DescribeResult | undefined,
  iriVar: string,
  countVar: string,
): EndpointTermCount[] | undefined {
  if (!result || result.status !== "done") return undefined;
  const terms: EndpointTermCount[] = [];
  for (const binding of result.bindings) {
    const term = binding[iriVar];
    if (!term || term.type !== "uri") continue;
    const count = Number(binding[countVar]?.value);
    terms.push({ iri: term.value, count: isFinite(count) ? count : undefined });
  }
  return terms;
}

function termsFromVoid(metadata: EndpointMetadata | undefined, type: TermType): EndpointTermCount[] {
  const terms: EndpointTermCount[] = [];
  for (const dataset of metadata?.datasets || []) {
    const partitions = type === "class" ? dataset.classPartitions : dataset.propertyPartitions;
    for (const partition of partitions || []) {
      terms.push({ iri: partition.iri, count: type === "class" ? partition.entities : partition.triples });
    }
  }
  return terms;
}

/**
 * Merges terms from several sources: an IRI is listed once, with its highest count, most used first.
 */
export function mergeTerms(...sources: EndpointTermCount[][]): EndpointTermCount[] {
  const merged = new Map<string, EndpointTermCount>();
  for (const terms of sources) {
    for (const term of terms) {
      const existing = merged.get(term.iri);
      if (!existing) merged.set(term.iri, { ...term });
      else if (term.count !== undefined && (existing.count === undefined || term.count > existing.count))
        existing.count = term.count;
    }
  }
  return Array.from(merged.values()).sort((a, b) => (b.count ?? -1) - (a.count ?? -1));
}

export interface CollectedTerms {
  terms: EndpointTermCount[];
  /** Whether the background query is still useful: no complete list of terms is known yet */
  needsQuery: boolean;
}

/**
 * The terms known for an endpoint.
 * The overview results are complete when they hold every row (no further page): then no query is needed.
 */
export function collectTerms(
  type: TermType,
  getResult: (queryId: string) => DescribeResult | undefined,
  metadata: EndpointMetadata | undefined,
): CollectedTerms {
  const overview = overviewQueries[type];
  const overviewResult = getResult(overview.id);
  const fromOverview = termsFromResult(overviewResult, overview.iriVar, overview.countVar);
  const autocompleteResult = getResult(autocompleteQueries[type].id);
  const fromQuery = termsFromResult(autocompleteResult, overview.iriVar, overview.countVar);
  const fromVoid = termsFromVoid(metadata, type);
  const terms = mergeTerms(fromVoid, fromOverview || [], fromQuery || []);
  const overviewComplete = !!fromOverview && !overviewResult?.hasMore;
  const recentFailure =
    autocompleteResult?.status === "error" && Date.now() - autocompleteResult.fetchedAt < AUTOCOMPLETE_RETRY_MS;
  return {
    terms,
    needsQuery: !fromQuery && fromVoid.length === 0 && !overviewComplete && !recentFailure,
  };
}
