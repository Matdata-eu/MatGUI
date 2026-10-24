/**
 * Endpoint context for the model: prefixes and the classes and properties used in the endpoint, from what the
 * Endpoint overview and the autocompletion already know. Only vocabulary terms are sent, never data.
 */

export interface SchemaTerm {
  iri: string;
  count?: number;
  prefix?: string;
  namespace?: string;
}

export interface SchemaContextInput {
  endpoint: string;
  /** prefix → namespace */
  prefixes: { [prefix: string]: string };
  classes: SchemaTerm[];
  properties: SchemaTerm[];
  maxTerms: number;
}

/** Prefixed name of a term when a prefix is known for its namespace, otherwise the IRI in angle brackets */
export function compactIri(iri: string, prefixes: { [prefix: string]: string }, term?: SchemaTerm): string {
  if (term?.prefix && term.namespace && iri.startsWith(term.namespace)) {
    const local = iri.slice(term.namespace.length);
    if (/^[\w.-]*$/.test(local)) return `${term.prefix}:${local}`;
  }
  let best: [string, string] | undefined;
  for (const prefix in prefixes) {
    const ns = prefixes[prefix];
    if (ns && iri.startsWith(ns) && (!best || ns.length > best[1].length)) best = [prefix, ns];
  }
  if (best) {
    const local = iri.slice(best[1].length);
    if (/^[\w.-]*$/.test(local) && !local.endsWith(".")) return `${best[0]}:${local}`;
  }
  return `<${iri}>`;
}

function termLines(terms: SchemaTerm[], prefixes: { [prefix: string]: string }, max: number): string[] {
  return terms.slice(0, max).map((term) => {
    const name = compactIri(term.iri, prefixes, term);
    return term.count !== undefined ? `${name} ${term.count}` : name;
  });
}

/** All known prefixes: the configured ones plus the prefixes the terms carry */
function knownPrefixes(input: SchemaContextInput): { [prefix: string]: string } {
  const all = { ...input.prefixes };
  for (const term of [...input.classes, ...input.properties]) {
    if (term.prefix && term.namespace && !all[term.prefix]) all[term.prefix] = term.namespace;
  }
  return all;
}

/** Prefixes used by the listed terms or the query, so the context stays small */
function usedPrefixes(
  input: SchemaContextInput,
  all: { [prefix: string]: string },
  queryText: string,
): Array<[string, string]> {
  const used = new Map<string, string>();
  for (const term of [...input.classes.slice(0, input.maxTerms), ...input.properties.slice(0, input.maxTerms)]) {
    const match = compactIri(term.iri, all, term).match(/^([\w.-]*):/);
    if (match && all[match[1]] !== undefined) used.set(match[1], all[match[1]]);
  }
  for (const prefix in all) {
    if (new RegExp(`(^|[\\s(,/^!])${prefix.replace(/[.-]/g, "\\$&")}:`).test(queryText)) used.set(prefix, all[prefix]);
  }
  return Array.from(used.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

/**
 * The context block sent with "Ask" and "Fix" requests. Counts are the number of instances (classes) or
 * triples (properties), when known.
 */
export function buildSchemaContext(input: SchemaContextInput, queryText = ""): string {
  const parts: string[] = [`SPARQL endpoint: ${input.endpoint}`];
  const all = knownPrefixes(input);
  const prefixes = usedPrefixes(input, all, queryText);
  if (prefixes.length) {
    parts.push("Prefixes:\n" + prefixes.map(([p, ns]) => `PREFIX ${p}: <${ns}>`).join("\n"));
  }
  if (input.classes.length) {
    parts.push(
      `Classes used in the endpoint, most used first (name, number of instances):\n` +
        termLines(input.classes, all, input.maxTerms).join("\n"),
    );
  }
  if (input.properties.length) {
    parts.push(
      `Properties used in the endpoint, most used first (name, number of triples):\n` +
        termLines(input.properties, all, input.maxTerms).join("\n"),
    );
  }
  if (!input.classes.length && !input.properties.length) {
    parts.push("The classes and properties of this endpoint are not known yet.");
  }
  return parts.join("\n\n");
}
