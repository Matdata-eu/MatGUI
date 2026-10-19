#!/usr/bin/env node

/**
 * Builds the bundled Linked Open Vocabularies (LOV) term list that YASQE uses for class and property
 * autocompletion, so that autocompletion doesn't depend on the LOV API at runtime.
 *
 * Downloads the LOV N-Quads dump (the catalogue plus the latest version of every vocabulary), keeps the
 * classes and properties per namespace, ranks the namespaces by how many vocabularies use them, and keeps
 * the most used ones until the file reaches MAX_BYTES. The result is written to
 * packages/yasqe/src/lov-terms.json, which is committed and bundled.
 *
 * Usage: node fetchLovData.js [path-or-url of lov.nq or lov.nq.gz]
 */

import fs from "fs";
import https from "https";
import http from "http";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";
import readline from "readline";

const DUMP_URL = "https://lov.linkeddata.es/lov.nq.gz";
const OUTPUT_FILE = path.join("packages", "yasqe", "src", "lov-terms.json");
/** Size budget of the bundled file */
const MAX_BYTES = 600_000;

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const VANN = "http://purl.org/vocab/vann/";
const CLASS_TYPES = new Set(["http://www.w3.org/2000/01/rdf-schema#Class", "http://www.w3.org/2002/07/owl#Class"]);
const PROPERTY_TYPES = new Set([
  "http://www.w3.org/1999/02/22-rdf-syntax-ns#Property",
  "http://www.w3.org/2002/07/owl#ObjectProperty",
  "http://www.w3.org/2002/07/owl#DatatypeProperty",
  "http://www.w3.org/2002/07/owl#AnnotationProperty",
]);

function openUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https://") ? https : http;
    const req = client.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        openUrl(new URL(res.headers.location, url).toString()).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      resolve(res);
    });
    req.on("error", reject);
    req.setTimeout(120000, () => req.destroy(new Error("Request timed out")));
  });
}

async function openDump(source) {
  const stream = /^https?:\/\//.test(source) ? await openUrl(source) : fs.createReadStream(source);
  return source.endsWith(".gz") ? stream.pipe(zlib.createGunzip()) : stream;
}

/** Namespace of an IRI: everything up to and including the last '#' or '/' */
export function splitIri(iri) {
  const index = Math.max(iri.lastIndexOf("#"), iri.lastIndexOf("/"));
  if (index < 0 || index === iri.length - 1) return undefined;
  const local = iri.substring(index + 1);
  // Only keep local names that can be written as a prefixed name
  if (!/^[A-Za-z_][\w.-]*$/.test(local) || local.endsWith(".")) return undefined;
  return { namespace: iri.substring(0, index + 1), local };
}

/**
 * Collects the terms of a stream of quads.
 * Returns the namespaces, most used first, as { namespace, prefix?, classes, properties, usedBy }.
 */
export async function collectTerms(quads) {
  const namespaces = new Map();
  const getNamespace = (namespace) => {
    let ns = namespaces.get(namespace);
    if (!ns) {
      ns = { classes: new Set(), properties: new Set() };
      namespaces.set(namespace, ns);
    }
    return ns;
  };
  const prefixes = new Map();
  // Graphs (vocabularies) in which an IRI of a namespace is used
  const usedIn = new Map();
  const noteUse = (term, graph) => {
    if (term.termType !== "NamedNode" || !graph) return;
    const split = splitIri(term.value);
    if (!split) return;
    let graphs = usedIn.get(split.namespace);
    if (!graphs) usedIn.set(split.namespace, (graphs = new Set()));
    graphs.add(graph);
  };

  for await (const quad of quads) {
    const graph = quad.graph.value;
    if (quad.predicate.value === VANN + "preferredNamespaceUri" && quad.object.termType === "Literal") {
      const prefix = prefixes.get(quad.subject.value) || {};
      prefixes.set(quad.subject.value, { ...prefix, namespace: quad.object.value });
    } else if (quad.predicate.value === VANN + "preferredNamespacePrefix" && quad.object.termType === "Literal") {
      const prefix = prefixes.get(quad.subject.value) || {};
      prefixes.set(quad.subject.value, { ...prefix, prefix: quad.object.value });
    }
    if (quad.predicate.value === RDF_TYPE && quad.subject.termType === "NamedNode") {
      const isClass = CLASS_TYPES.has(quad.object.value);
      const isProperty = PROPERTY_TYPES.has(quad.object.value);
      const split = (isClass || isProperty) && splitIri(quad.subject.value);
      if (split) {
        const ns = getNamespace(split.namespace);
        (isClass ? ns.classes : ns.properties).add(split.local);
        continue;
      }
    }
    noteUse(quad.predicate, graph);
    noteUse(quad.object, graph);
  }

  const prefixByNamespace = new Map();
  for (const { namespace, prefix } of prefixes.values()) {
    if (namespace && prefix && !prefixByNamespace.has(namespace)) prefixByNamespace.set(namespace, prefix);
  }
  return Array.from(namespaces.entries())
    .map(([namespace, ns]) => ({
      namespace,
      prefix: prefixByNamespace.get(namespace),
      classes: Array.from(ns.classes).sort(),
      properties: Array.from(ns.properties).sort(),
      usedBy: usedIn.get(namespace)?.size || 0,
    }))
    .filter((ns) => ns.classes.length || ns.properties.length)
    .sort((a, b) => b.usedBy - a.usedBy || a.namespace.localeCompare(b.namespace));
}

/**
 * The bundled format: namespaces most used first, as [namespace, prefix, classes, properties].
 * Namespaces are added until the serialized file would exceed maxBytes.
 */
export function toBundle(namespaces, maxBytes = MAX_BYTES, source = DUMP_URL) {
  const bundle = { source, generated: new Date().toISOString().substring(0, 10), namespaces: [] };
  let size = JSON.stringify(bundle).length;
  for (const ns of namespaces) {
    const entry = [ns.namespace, ns.prefix || "", ns.classes.join(" "), ns.properties.join(" ")];
    const entrySize = JSON.stringify(entry).length + 1;
    if (size + entrySize > maxBytes) continue;
    bundle.namespaces.push(entry);
    size += entrySize;
  }
  return bundle;
}

const TERM = String.raw`(<[^>]*>|_:\S+|"(?:[^"\\]|\\.)*"(?:@[A-Za-z0-9-]+|\^\^<[^>]*>)?)`;
const QUAD = new RegExp(String.raw`^\s*${TERM}\s+${TERM}\s+${TERM}(?:\s+${TERM})?\s*\.\s*$`);

function toTerm(token) {
  if (token === undefined) return { termType: "DefaultGraph", value: "" };
  if (token.startsWith("<")) return { termType: "NamedNode", value: token.slice(1, -1) };
  if (token.startsWith("_:")) return { termType: "BlankNode", value: token.slice(2) };
  const value = token.substring(1, token.lastIndexOf('"'));
  try {
    return { termType: "Literal", value: JSON.parse(`"${value}"`) };
  } catch {
    return { termType: "Literal", value };
  }
}

/**
 * Reads N-Quads line by line. The LOV dump contains some invalid lines (e.g. IRIs with spaces), which are
 * skipped instead of aborting the whole dump.
 */
export async function* readQuads(input, stats = { skipped: 0 }) {
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const match = QUAD.exec(line);
    if (!match) {
      stats.skipped++;
      continue;
    }
    yield { subject: toTerm(match[1]), predicate: toTerm(match[2]), object: toTerm(match[3]), graph: toTerm(match[4]) };
  }
}

async function main() {
  const source = process.argv[2] || DUMP_URL;
  console.log(`Reading LOV dump from ${source}...`);
  const input = await openDump(source);
  const stats = { skipped: 0 };
  const namespaces = await collectTerms(readQuads(input, stats));
  if (stats.skipped) console.log(`Skipped ${stats.skipped} invalid lines`);
  const bundle = toBundle(namespaces);
  const terms = bundle.namespaces.reduce(
    (count, [, , classes, properties]) =>
      count + (classes ? classes.split(" ").length : 0) + (properties ? properties.split(" ").length : 0),
    0,
  );
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(bundle) + "\n");
  console.log(
    `Wrote ${bundle.namespaces.length} of ${namespaces.length} namespaces (${terms} terms, ` +
      `${fs.statSync(OUTPUT_FILE).size} bytes) to ${OUTPUT_FILE}`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch((e) => {
    console.error("Could not build the LOV term list:", e.message);
    process.exit(1);
  });
}
