/**
 * Describe response parser
 *
 * Normalizes the raw response of a describe query (run through
 * yasr.executeQuery()) into a simple triple representation. Falls back to the
 * raw response text when the response cannot be parsed as SPARQL JSON triples
 * or Turtle / N-Triples.
 *
 * Ported from yasgui-table-plugin (src/parsers/describe-parser.ts).
 */
import { Parser as N3Parser } from "n3";

export interface DescribeTerm {
  value: string;
  type: "uri" | "literal" | "bnode";
  datatype?: string;
  lang?: string;
}

export interface DescribeTriple {
  subject: DescribeTerm;
  predicate: string;
  object: DescribeTerm;
}

export interface DescribeParseResult {
  triples: DescribeTriple[];
  raw: string;
}

/**
 * Extract raw text from a background query response.
 * Handles Fetch Response, superagent / Yasqe-style `{ text }` or `{ data }`, and plain strings.
 */
export async function extractRawText(response: unknown): Promise<string> {
  if (!response) return "";
  if (typeof response === "string") return response;
  const res = response as any;
  if (typeof res.text === "function") return res.text();
  if (typeof res.text === "string") return res.text;
  if (typeof res.data === "string") return res.data;
  if (typeof res.body === "string") return res.body;
  return "";
}

/**
 * Parse the raw response of a describe query.
 *
 * Order of parsing:
 * 1. SPARQL JSON results with subject/predicate/object bindings.
 * 2. Turtle/N-Triples via N3.
 * 3. Fall back to returning the raw text with no parsed triples.
 */
export async function parseDescribeResponse(response: unknown): Promise<DescribeParseResult> {
  const raw = await extractRawText(response);
  if (!raw.trim()) return { triples: [], raw: "" };
  const jsonTriples = tryParseSparqlJson(raw);
  if (jsonTriples.length > 0) return { triples: jsonTriples, raw };
  const n3Triples = parseWithN3(raw);
  if (n3Triples.length > 0) return { triples: n3Triples, raw };
  return { triples: [], raw };
}

function toTermType(type: unknown): DescribeTerm["type"] {
  if (type === "literal" || type === "typed-literal") return "literal";
  if (type === "bnode") return "bnode";
  return "uri";
}

function tryParseSparqlJson(raw: string): DescribeTriple[] {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return [];
  try {
    const parsed = JSON.parse(trimmed);
    const bindings = parsed?.results?.bindings || parsed?.bindings || (Array.isArray(parsed) ? parsed : []);
    if (!Array.isArray(bindings)) return [];
    const triples: DescribeTriple[] = [];
    for (const binding of bindings) {
      if (!binding?.subject?.value || !binding.predicate?.value || binding.object?.value === undefined) continue;
      triples.push({
        subject: { value: binding.subject.value, type: toTermType(binding.subject.type) },
        predicate: binding.predicate.value,
        object: {
          value: binding.object.value,
          type: toTermType(binding.object.type),
          datatype: binding.object.datatype,
          lang: binding.object["xml:lang"],
        },
      });
    }
    return triples;
  } catch {
    return [];
  }
}

function parseWithN3(raw: string): DescribeTriple[] {
  try {
    const quads = new N3Parser().parse(raw);
    return quads.map((quad) => {
      const subject: DescribeTerm =
        quad.subject.termType === "BlankNode"
          ? { value: "_:" + quad.subject.value, type: "bnode" }
          : { value: quad.subject.value, type: "uri" };
      let object: DescribeTerm;
      if (quad.object.termType === "Literal") {
        object = {
          value: quad.object.value,
          type: "literal",
          datatype: (quad.object as any).datatype?.value,
          lang: (quad.object as any).language || undefined,
        };
      } else if (quad.object.termType === "BlankNode") {
        object = { value: "_:" + quad.object.value, type: "bnode" };
      } else {
        object = { value: quad.object.value, type: "uri" };
      }
      return { subject, predicate: quad.predicate.value, object };
    });
  } catch (error) {
    console.warn("yasr: failed to parse describe response as Turtle:", (error as Error)?.message);
    return [];
  }
}

/** Format a term the way it would appear in N-Triples. */
export function formatDescribeTerm(term: DescribeTerm): string {
  if (term.type === "uri") return `<${term.value}>`;
  if (term.type === "bnode") return term.value;
  let formatted = `"${term.value}"`;
  if (term.lang) formatted += `@${term.lang}`;
  else if (term.datatype) formatted += `^^<${term.datatype}>`;
  return formatted;
}

const LABEL_PREDICATES = [
  "http://www.w3.org/2004/02/skos/core#prefLabel",
  "http://www.w3.org/2000/01/rdf-schema#label",
  "http://schema.org/name",
  "https://schema.org/name",
  "http://purl.org/dc/terms/title",
  "http://xmlns.com/foaf/0.1/name",
];
export const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";

/**
 * Pick a human readable label for `iri` from its outgoing triples, preferring
 * the given languages, then untagged literals, then any language.
 */
export function pickLabel(
  iri: string,
  triples: DescribeTriple[],
  languages: readonly string[] = [],
): string | undefined {
  const prefs = languages.map((l) => l.toLowerCase().split("-")[0]);
  for (const predicate of LABEL_PREDICATES) {
    const candidates = triples.filter(
      (t) => t.subject.value === iri && t.predicate === predicate && t.object.type === "literal" && t.object.value,
    );
    if (!candidates.length) continue;
    for (const lang of prefs) {
      const hit = candidates.find((t) => (t.object.lang || "").toLowerCase().split("-")[0] === lang);
      if (hit) return hit.object.value;
    }
    return (candidates.find((t) => !t.object.lang) || candidates[0]).object.value;
  }
  return undefined;
}

/** The rdf:type IRIs of `iri` in the given triples. */
export function pickTypes(iri: string, triples: DescribeTriple[]): string[] {
  const types: string[] = [];
  for (const t of triples) {
    if (
      t.subject.value === iri &&
      t.predicate === RDF_TYPE &&
      t.object.type === "uri" &&
      !types.includes(t.object.value)
    )
      types.push(t.object.value);
  }
  return types;
}
