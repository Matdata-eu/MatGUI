/**
 * Turns the rows of the structure query (see `probeQueries.ts`) into a tree of the source: the root, the
 * containers (rows, arrays, elements) and their properties, with counts and an example value.
 */
import { FX, SLOT } from "./probeQueries";

export interface StructureRow {
  gstep?: string;
  ptype?: string;
  pstep?: string;
  type?: string;
  step: string;
  kind: "literal" | "node";
  /** Number of triples */
  n: number;
  /** Number of distinct subjects */
  subjects: number;
  example?: string;
}

export interface StructureNode {
  id: string;
  /** Step from the parent: a property IRI or `SLOT`; undefined for the root */
  step?: string;
  /** Type of the node (XML element, `fx:root`) */
  type?: string;
  kind: "literal" | "node";
  /** Number of values (leaves) or of nodes */
  count: number;
  example?: string;
  children: StructureNode[];
  parent?: StructureNode;
}

interface Binding {
  [variable: string]: { type: string; value: string } | undefined;
}

/** Reads the structure query result (SPARQL JSON bindings) */
export function rowsFromBindings(bindings: Binding[]): StructureRow[] {
  const rows: StructureRow[] = [];
  for (const b of bindings) {
    const step = b.step?.value;
    if (!step) continue;
    rows.push({
      gstep: b.gstep?.value,
      ptype: b.ptype?.value,
      pstep: b.pstep?.value,
      type: b.type?.value,
      step,
      kind: b.kind?.value === "literal" ? "literal" : "node",
      n: Number(b.n?.value) || 0,
      subjects: Number(b.subjects?.value) || 0,
      example: b.example?.value,
    });
  }
  return rows;
}

const signature = (gstep?: string, ptype?: string, pstep?: string, type?: string) =>
  [gstep ?? "", ptype ?? "", pstep ?? "", type ?? ""].join("\u0001");

/**
 * Builds the tree. A node is identified by its type and how it is reached (the step from its parent, the type of
 * the parent and the step to the parent), so all rows of a CSV, or all items of one JSON array, are one node.
 */
export function buildStructure(rows: StructureRow[]): StructureNode[] {
  // Outgoing edges per kind of subject
  const subjects = new Map<
    string,
    { gstep?: string; ptype?: string; pstep?: string; type?: string; rows: StructureRow[] }
  >();
  for (const row of rows) {
    const key = signature(row.gstep, row.ptype, row.pstep, row.type);
    let entry = subjects.get(key);
    if (!entry) {
      entry = { gstep: row.gstep, ptype: row.ptype, pstep: row.pstep, type: row.type, rows: [] };
      subjects.set(key, entry);
    }
    entry.rows.push(row);
  }
  let nextId = 0;
  const visiting = new Set<string>();

  const makeNode = (key: string, step: string | undefined, parent: StructureNode | undefined): StructureNode => {
    const entry = subjects.get(key)!;
    const node: StructureNode = {
      id: `n${nextId++}`,
      step,
      type: entry.type,
      kind: "node",
      count: Math.max(0, ...entry.rows.map((r) => r.subjects)),
      children: [],
      parent,
    };
    if (visiting.has(key)) return node;
    visiting.add(key);
    // Edges of the same step and kind are merged (they differ only in which parent they came from)
    const edges = new Map<string, { step: string; kind: "literal" | "node"; n: number; example?: string }>();
    for (const row of entry.rows) {
      const edgeKey = `${row.kind}\u0001${row.step}`;
      const edge = edges.get(edgeKey);
      if (edge) edge.n += row.n;
      else edges.set(edgeKey, { step: row.step, kind: row.kind, n: row.n, example: row.example });
    }
    const sorted = Array.from(edges.values()).sort((a, b) => {
      // Slots after named properties; otherwise keep the order of the data
      if ((a.step === SLOT) !== (b.step === SLOT)) return a.step === SLOT ? 1 : -1;
      return 0;
    });
    for (const edge of sorted) {
      if (edge.kind === "literal") {
        node.children.push({
          id: `n${nextId++}`,
          step: edge.step,
          kind: "literal",
          count: edge.n,
          example: edge.example,
          children: [],
          parent: node,
        });
        continue;
      }
      const childKeys = Array.from(subjects.keys()).filter((childKey) => {
        const child = subjects.get(childKey)!;
        return child.pstep === edge.step && child.ptype === entry.type && child.gstep === entry.pstep;
      });
      if (!childKeys.length) {
        // A node without properties of its own (e.g. an empty object): keep the edge visible
        node.children.push({
          id: `n${nextId++}`,
          step: edge.step,
          kind: "node",
          count: edge.n,
          children: [],
          parent: node,
        });
      }
      for (const childKey of childKeys) node.children.push(makeNode(childKey, edge.step, node));
    }
    visiting.delete(key);
    return node;
  };

  const roots: StructureNode[] = [];
  for (const [key, entry] of subjects) {
    if (entry.pstep === undefined) roots.push(makeNode(key, undefined, undefined));
  }
  // Root documents first
  roots.sort((a, b) => Number(b.type === FX + "root") - Number(a.type === FX + "root"));
  return roots;
}

export interface SourceTerm {
  iri: string;
  count: number;
}

/** The properties (named steps) and the classes (types other than `fx:root`) of the source, most used first */
export function termsFromRows(rows: StructureRow[]): { properties: SourceTerm[]; classes: SourceTerm[] } {
  const properties = new Map<string, number>();
  const classes = new Map<string, number>();
  for (const row of rows) {
    if (row.step !== SLOT) properties.set(row.step, (properties.get(row.step) || 0) + row.n);
    if (row.type && row.type !== FX + "root") classes.set(row.type, Math.max(classes.get(row.type) || 0, row.subjects));
  }
  const sorted = (map: Map<string, number>) =>
    Array.from(map.entries())
      .map(([iri, count]) => ({ iri, count }))
      .sort((a, b) => b.count - a.count);
  return { properties: sorted(properties), classes: sorted(classes) };
}

/** All nodes of the tree, depth first */
export function walk(nodes: StructureNode[], visit: (node: StructureNode, depth: number) => void, depth = 0) {
  for (const node of nodes) {
    visit(node, depth);
    walk(node.children, visit, depth + 1);
  }
}

/** The nodes from the root down to the node */
export function pathTo(node: StructureNode): StructureNode[] {
  const path: StructureNode[] = [];
  for (let n: StructureNode | undefined = node; n; n = n.parent) path.unshift(n);
  return path;
}
