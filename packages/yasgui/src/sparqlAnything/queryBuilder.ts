/**
 * Writes SPARQL Anything patterns for the values picked in the structure tree: the path from the root to each
 * value, with `fx:anySlot` for rows and array items, a type for XML elements, and OPTIONAL for optional values.
 */
import type { SparqlAnythingSource } from "@matdata/yasqe";
import { FX, SLOT } from "./probeQueries";
import { pathTo, StructureNode } from "./structure";

export interface PickedValue {
  node: StructureNode;
  optional: boolean;
}

export interface BuiltPatterns {
  /** Variables of the picked values, in the order they were picked */
  variables: string[];
  /** Lines of the group graph pattern, indented with two spaces per level */
  lines: string[];
  /** Prefixes used by the patterns */
  prefixes: { [prefix: string]: string };
}

const LOCAL_NAME = /^[A-Za-z_À-￿0-9]([A-Za-z_À-￿0-9.-]*[A-Za-z_À-￿0-9-])?$/;

export function localName(iri: string): string {
  return iri.substring(Math.max(iri.lastIndexOf("#"), iri.lastIndexOf("/")) + 1);
}

/** Shortens an IRI with the prefixes when the rest is a valid local name, else writes it in full */
export function writeIri(iri: string, prefixes: { [prefix: string]: string }, used?: { [prefix: string]: string }) {
  for (const prefix of Object.keys(prefixes)) {
    const namespace = prefixes[prefix];
    if (!namespace || !iri.startsWith(namespace)) continue;
    const rest = iri.substring(namespace.length);
    if (rest && LOCAL_NAME.test(rest)) {
      if (used) used[prefix] = namespace;
      return `${prefix}:${rest}`;
    }
  }
  return `<${iri.replace(/[\s<>"{}|^`\\]/g, (c) => encodeURIComponent(c))}>`;
}

/**
 * The prefixes to write the patterns with: those of the query, plus `fx:` and a prefix for the data namespace of
 * the source (`xyz:` unless the query already has one for it).
 */
export function builderPrefixes(
  source: SparqlAnythingSource,
  queryPrefixes: { [prefix: string]: string },
): { [prefix: string]: string } {
  const prefixes = { ...queryPrefixes };
  const free = (name: string) => {
    let candidate = name;
    for (let i = 2; prefixes[candidate] !== undefined; i++) candidate = `${name}${i}`;
    return candidate;
  };
  if (!Object.values(prefixes).includes(FX)) prefixes[free("fx")] = FX;
  if (!Object.values(prefixes).includes(source.namespace)) prefixes[free("xyz")] = source.namespace;
  return prefixes;
}

function variableBase(node: StructureNode, parentVariable: string | undefined): string {
  let name: string;
  if (!node.parent) name = "root";
  else if (node.kind === "node" && node.type) name = localName(node.type);
  else if (node.step && node.step !== SLOT) name = localName(node.step);
  else if (node.kind === "literal") name = `${parentVariable || "value"}_value`;
  else if (!node.parent.parent) name = "row";
  else if (parentVariable && /[^s]s$/.test(parentVariable) && parentVariable.length > 3)
    name = parentVariable.slice(0, -1);
  else name = `${parentVariable || "item"}_item`;
  name = name.replace(/[^A-Za-z0-9_]/g, "_");
  if (!/^[A-Za-z_]/.test(name)) name = "v_" + name;
  return name;
}

/**
 * Patterns for the picked values. Required values and the nodes leading to them come first; each optional value
 * gets an OPTIONAL block with the part of its path that is not required.
 */
export function buildPatterns(
  picked: PickedValue[],
  source: SparqlAnythingSource,
  queryPrefixes: { [prefix: string]: string },
): BuiltPatterns {
  const prefixes = builderPrefixes(source, queryPrefixes);
  const used: { [prefix: string]: string } = {};
  const iri = (value: string) => writeIri(value, prefixes, used);
  const variables = new Map<StructureNode, string>();
  const taken = new Set<string>();
  const variableOf = (node: StructureNode): string => {
    let variable = variables.get(node);
    if (variable) return variable;
    const base = variableBase(node, node.parent ? variables.get(node.parent)?.substring(1) : undefined);
    let name = base;
    for (let i = 2; taken.has(name); i++) name = `${base}_${i}`;
    taken.add(name);
    variable = `?${name}`;
    variables.set(node, variable);
    return variable;
  };

  // Variables are given out from the root down, so a child is named after its parent
  const paths = picked.map((p) => pathTo(p.node));
  for (const path of paths) path.forEach(variableOf);

  /** Triples that reach a node from its parent (and give the node its type) */
  const reach = (node: StructureNode): string[] => {
    const v = variableOf(node);
    if (!node.parent) return node.type ? [`${v} a ${iri(node.type)} .`] : [];
    const step = node.step === SLOT ? iri(FX + "anySlot") : iri(node.step!);
    const lines = [`${variableOf(node.parent)} ${step} ${v} .`];
    if (node.kind === "node" && node.type) lines.push(`${v} a ${iri(node.type)} .`);
    if (node.kind === "literal" && node.step === SLOT) lines.push(`FILTER(isLiteral(${v}))`);
    return lines;
  };

  const lines: string[] = [];
  const emitted = new Set<StructureNode>();
  picked.forEach((p, index) => {
    if (p.optional) return;
    for (const node of paths[index]) {
      if (emitted.has(node)) continue;
      emitted.add(node);
      lines.push(...reach(node));
    }
  });
  picked.forEach((p, index) => {
    if (!p.optional) return;
    const missing = paths[index].filter((node) => !emitted.has(node));
    // A root that is not reached by a required value is still needed outside the OPTIONAL
    if (missing.length && !missing[0].parent) {
      emitted.add(missing[0]);
      lines.push(...reach(missing.shift()!));
    }
    const inner = missing.flatMap(reach);
    if (!inner.length) return;
    lines.push("OPTIONAL {", ...inner.map((line) => "  " + line), "}");
  });
  return {
    variables: picked.map((p) => variableOf(p.node)),
    lines,
    prefixes: used,
  };
}

/** A complete SELECT query for the picked values */
export function buildQuery(
  picked: PickedValue[],
  source: SparqlAnythingSource,
  queryPrefixes: { [prefix: string]: string },
): string {
  const built = buildPatterns(picked, source, queryPrefixes);
  const prefixes = { ...built.prefixes };
  const options = source.optionTriples.map((t) => ({ ...t }));
  const allPrefixes = builderPrefixes(source, queryPrefixes);
  const fxPrefix = Object.keys(allPrefixes).find((p) => allPrefixes[p] === FX)!;
  if (options.length) prefixes[fxPrefix] = FX;
  const head = Object.keys(prefixes).map((p) => `PREFIX ${p}: <${prefixes[p]}>`);
  const body = [
    ...(options.length
      ? [
          `${fxPrefix}:properties ` +
            options.map((t) => `${fxPrefix}:${t.name} ${t.raw}`).join(` ;\n    ${" ".repeat(fxPrefix.length + 12)}`) +
            " .",
        ]
      : []),
    ...built.lines,
  ];
  return [
    ...head,
    `SELECT ${built.variables.join(" ") || "*"} WHERE {`,
    `  SERVICE ${source.silent ? "SILENT " : ""}<${source.serviceIri}> {`,
    ...body.map((line) => "    " + line),
    "  }",
    "}",
  ].join("\n");
}
