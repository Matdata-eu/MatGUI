/**
 * Queries sent to the endpoint to learn what a SPARQL Anything source looks like once triplified. They use the
 * service IRI and option triples of the user's SERVICE block unchanged, so they read the source exactly as the
 * user's query will (the endpoint may be the only one that can reach the file).
 */
import type { SparqlAnythingSource } from "@matdata/yasqe";

export const FX = "http://sparql.xyz/facade-x/ns/";
export const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const RDFS_MEMBER = "http://www.w3.org/2000/01/rdf-schema#member";
/** Stands for a container slot (`rdf:_1`, `rdf:_2`, ... or `rdfs:member`) in the results of the structure query */
export const SLOT = "urn:matgui:sparql-anything:slot";
/** Rows returned by the structure query at most */
export const STRUCTURE_LIMIT = 5000;
export const PREVIEW_LIMIT = 100;

function prologue(prefixes: { [prefix: string]: string }, extra: { [prefix: string]: string }): string {
  const all = { ...prefixes, ...extra };
  return Object.keys(all)
    .map((prefix) => `PREFIX ${prefix}: <${all[prefix]}>`)
    .join("\n");
}

/** The SERVICE clause with the option triples of the source, wrapped around the given patterns */
export function serviceBlock(source: SparqlAnythingSource, patterns: string[], indent = "  "): string {
  const inner = indent + "  ";
  const lines = [`${indent}SERVICE ${source.silent ? "SILENT " : ""}<${source.serviceIri}> {`];
  if (source.optionTriples.length) {
    lines.push(
      `${inner}<${FX}properties> ` +
        source.optionTriples.map((t) => `<${FX}${t.name}> ${t.raw}`).join(` ;\n${inner}    `) +
        " .",
    );
  }
  for (const pattern of patterns) lines.push(inner + pattern);
  lines.push(`${indent}}`);
  return lines.join("\n");
}

/**
 * One row per kind of edge in the data: a subject of type `?type`, reached from a `?ptype` node by `?pstep`
 * (itself reached by `?gstep`), has `?step` to a literal or a node, `?n` times on `?subjects` subjects.
 * Slot properties are folded into one step, so a CSV of a million rows still gives a handful of rows.
 *
 * `prefixes` are the prefixes of the user's query, needed when an option value is a prefixed name.
 */
export function structureQuery(source: SparqlAnythingSource, prefixes: { [prefix: string]: string } = {}): string {
  const slot = (v: string) => `IF(STRSTARTS(STR(?${v}), "${RDF}_") || ?${v} = <${RDFS_MEMBER}>, <${SLOT}>, ?${v})`;
  return [
    prologue(prefixes, {}),
    "SELECT ?gstep ?ptype ?pstep ?type ?step ?kind (COUNT(*) AS ?n) (COUNT(DISTINCT ?s) AS ?subjects) (SAMPLE(?o) AS ?example)",
    "WHERE {",
    serviceBlock(source, [
      "?s ?p ?o .",
      `OPTIONAL { ?s <${RDF}type> ?t }`,
      `OPTIONAL { ?parent ?pp ?s . OPTIONAL { ?parent <${RDF}type> ?pt } OPTIONAL { ?grand ?gp ?parent } }`,
    ]),
    `  FILTER(?p != <${RDF}type>)`,
    `  BIND(${slot("p")} AS ?step)`,
    `  BIND(${slot("pp")} AS ?pstep)`,
    `  BIND(${slot("gp")} AS ?gstep)`,
    "  BIND(?t AS ?type)",
    "  BIND(?pt AS ?ptype)",
    `  BIND(IF(isLiteral(?o), "literal", "node") AS ?kind)`,
    "}",
    "GROUP BY ?gstep ?ptype ?pstep ?type ?step ?kind",
    `LIMIT ${STRUCTURE_LIMIT}`,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

/**
 * The first triples of the triplified source, as Turtle. The prefixes end up in the Turtle the endpoint returns.
 */
export function previewQuery(source: SparqlAnythingSource, prefixes: { [prefix: string]: string } = {}): string {
  const namespacePrefix = Object.keys(prefixes).find((p) => prefixes[p] === source.namespace) ?? "xyz";
  return [
    prologue(prefixes, { fx: FX, [namespacePrefix]: source.namespace, rdf: RDF }),
    "CONSTRUCT { ?s ?p ?o }",
    "WHERE {",
    serviceBlock(source, ["?s ?p ?o ."]),
    "}",
    `LIMIT ${PREVIEW_LIMIT}`,
  ].join("\n");
}
