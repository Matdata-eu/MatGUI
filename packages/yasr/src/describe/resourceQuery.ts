/**
 * Queries used by the shared describe panel.
 *
 * Ported from yasgui-table-plugin (src/parsers/resource-query.ts). Kept free of
 * DOM and runtime relative imports so it can be unit-tested in isolation.
 *
 * - `outgoing`: the triples in which the resource is the subject (<iri> ?p ?o)
 * - `incoming`: the triples in which the resource is the object  (?s ?p <iri>)
 */

export type DescribeDirection = "outgoing" | "incoming";

export type PrefixMap = { [prefixLabel: string]: string };

/** Maximum number of incoming triples requested; popular resources can have millions. */
export const INCOMING_TRIPLE_LIMIT = 1000;

/**
 * Characters allowed in the local part of a prefixed name that we are willing
 * to emit. This is deliberately a conservative subset of SPARQL's PN_LOCAL so
 * the generated query is always valid; anything else falls back to <iri>.
 */
const SAFE_LOCAL_NAME = /^[A-Za-z0-9_](?:[A-Za-z0-9_\-.]*[A-Za-z0-9_-])?$/;
const SAFE_PREFIX = /^(?:[A-Za-z][A-Za-z0-9_\-.]*[A-Za-z0-9_-]|[A-Za-z])?$/;
const UNSAFE_IRI_CHARS = /[<>"{}|\\^`\s]/;

/** Normalise the direction names, also accepting the table plugin's `subject` / `object`. */
export function normalizeDirection(direction: unknown): DescribeDirection {
  if (direction === "incoming" || direction === "object") return "incoming";
  return "outgoing";
}

/** Keep only well-formed prefix declarations. */
export function sanitizePrefixes(prefixes: unknown): PrefixMap {
  const result: PrefixMap = {};
  if (!prefixes || typeof prefixes !== "object") return result;
  for (const [prefix, namespace] of Object.entries(prefixes as Record<string, unknown>)) {
    if (typeof namespace !== "string" || !namespace || UNSAFE_IRI_CHARS.test(namespace)) continue;
    if (!SAFE_PREFIX.test(prefix)) continue;
    result[prefix] = namespace;
  }
  return result;
}

/**
 * Abbreviate an IRI to a prefixed name using the given prefixes.
 * Picks the longest matching namespace. Returns `null` when no prefix matches
 * or the resulting local name would not be a valid prefixed name.
 */
export function toPrefixedName(iri: string, prefixes: PrefixMap): string | null {
  let best: { prefix: string; namespace: string } | null = null;
  for (const [prefix, namespace] of Object.entries(prefixes)) {
    if (iri.startsWith(namespace) && (!best || namespace.length > best.namespace.length)) {
      best = { prefix, namespace };
    }
  }
  if (!best) return null;
  const local = iri.substring(best.namespace.length);
  if (local !== "" && !SAFE_LOCAL_NAME.test(local)) return null;
  return `${best.prefix}:${local}`;
}

/** Render an IRI as a SPARQL term: a prefixed name when possible, else <iri>. */
export function toSparqlTerm(iri: string, prefixes: PrefixMap): string {
  return toPrefixedName(iri, prefixes) ?? `<${iri.replace(/[<>"{}|\\^`\s]/g, encodeURIComponent)}>`;
}

/**
 * Build the CONSTRUCT query that fetches the triples in which `iri` is the
 * subject (outgoing) or the object (incoming). All (valid) prefixes are
 * declared so the query stays readable and servers can use them in their Turtle output.
 */
export function buildDescribeQuery(iri: string, direction: DescribeDirection, prefixes: PrefixMap = {}): string {
  const safePrefixes = sanitizePrefixes(prefixes);
  const term = toSparqlTerm(iri, safePrefixes);
  const pattern = direction === "incoming" ? `?s ?p ${term}` : `${term} ?p ?o`;
  const prefixLines = Object.entries(safePrefixes)
    .map(([prefix, namespace]) => `PREFIX ${prefix}: <${namespace}>`)
    .join("\n");
  const limit = direction === "incoming" ? `\nLIMIT ${INCOMING_TRIPLE_LIMIT}` : "";
  const body = `CONSTRUCT {\n  ${pattern} .\n}\nWHERE {\n  ${pattern} .\n}${limit}`;
  return prefixLines ? `${prefixLines}\n\n${body}` : body;
}

/** The last path segment or fragment of an IRI, used as a fallback title. */
export function localName(iri: string): string {
  const match = /[^/#:]+[/#]?$/.exec(iri);
  const name = match ? match[0].replace(/[/#]$/, "") : "";
  try {
    return decodeURIComponent(name) || iri;
  } catch {
    return name || iri;
  }
}
