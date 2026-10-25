#!/usr/bin/env node

/**
 * Builds the bundled Linked Open Vocabularies (LOV) term list that YASQE uses for class and property
 * autocompletion, so that autocompletion doesn't depend on the LOV API at runtime.
 *
 * Downloads the LOV N-Quads dump (the catalogue plus the latest version of every vocabulary), keeps the
 * classes and properties per namespace, ranks the namespaces by how many vocabularies use them, and keeps
 * the most used ones until the file reaches MAX_BYTES. The namespaces of ALWAYS_INCLUDED come first, whatever
 * their rank or size; their terms can also be read from the vocabulary itself, for vocabularies that are
 * missing from the dump. The result is written to packages/yasqe/src/lov-terms.json, which is committed and bundled.
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
import { StreamParser } from "n3";

const DUMP_URL = "https://lov.linkeddata.es/lov.nq.gz";
const OUTPUT_FILE = path.join("packages", "yasqe", "src", "lov-terms.json");
/** Size budget of the bundled file */
const MAX_BYTES = 600_000;

/**
 * Namespaces that are always bundled, first, regardless of their popularity and of the size budget.
 * `prefix` overrides the prefix from LOV; fetchPrefixData.js also adds it to the bundled prefixes, so it is always
 * suggested and declared when used. `sources` are RDF files (Turtle, N-Triples...) of the vocabulary whose
 * classes and properties in the namespace are added to those of the dump, e.g. when LOV lacks the vocabulary.
 * `terms` lists local names of classes, properties and functions, for vocabularies without RDF files.
 * A namespace without any terms is left out of the bundle, but its prefix is still bundled.
 */
export const ALWAYS_INCLUDED = [
  {
    // ERA ontology: LOV lists it, but the dump has no graph for it
    namespace: "http://data.europa.eu/949/",
    prefix: "era",
    sources: [
      "https://gitlab.com/era-europa-eu/public/interoperable-data-programme/era-ontology/era-ontology/-/raw/main/ontology.ttl",
    ],
  },
  {
    // railML 3 ontology (not in LOV)
    namespace: "http://ontology.railml.org/railml3#",
    prefix: "railml",
    sources: ["https://ontology.railml.org/ontology.ttl"],
  },
  {
    // RailTopoModel, as published in the railML ontology
    namespace: "http://ontology.railml.org/railtopomodel#",
    prefix: "rtm",
    sources: ["https://ontology.railml.org/ontology.ttl"],
  },
  // SPARQL Anything (https://sparql-anything.cc), which publishes no RDF files for its vocabularies, so the terms are
  // listed here, from https://github.com/SPARQL-Anything/sparql.anything/tree/HEAD/docs and the Façade-X specs.
  {
    // Façade-X: the terms of the generated data, the magic properties and the functions
    namespace: "http://sparql.xyz/facade-x/ns/",
    prefix: "fx",
    terms: {
      classes: ["Root"],
      properties: ["anySlot", "slot-key", "cachedGraph", "cachedGraphCreation", "sparqlAlgebra"],
      functions: [
        "cardinal",
        "isContainerMembershipProperty",
        "before",
        "after",
        "previous",
        "next",
        "forward",
        "backward",
        "String.startsWith",
        "String.endsWith",
        "String.indexOf",
        "String.lastIndexOf",
        "String.substring",
        "String.toLowerCase",
        "String.toUpperCase",
        "String.trim",
        "String.replace",
        "String.stripLeading",
        "String.stripTrailing",
        "String.removeTags",
        "WordUtils.capitalize",
        "WordUtils.capitalizeFully",
        "WordUtils.initials",
        "WordUtils.swapCase",
        "WordUtils.uncapitalize",
        "LevenshteinDistance",
        "CosineDistance",
        "JaccardDistance",
        "JaroWinklerDistance",
        "LongestCommonSubsequenceDistance",
        "HammingDistance",
        "QGramDistance",
        "DigestUtils.md2Hex",
        "DigestUtils.md5Hex",
        "DigestUtils.sha1Hex",
        "DigestUtils.sha256Hex",
        "DigestUtils.sha384Hex",
        "DigestUtils.sha512Hex",
        "URLEncoder.encode",
        "URLDecoder.decode",
        "serial",
        "entity",
        "literal",
        "bnode",
      ],
    },
  },
  {
    // Façade-X Engine: the options of a SPARQL Anything SERVICE clause (fxe:properties fxe:location "...")
    namespace: "http://sparql.xyz/facade-x/engine/",
    prefix: "fxe",
    terms: {
      classes: ["Configuration", "Option"],
      properties: [
        "properties",
        "location",
        "content",
        "command",
        "read-from-std-in",
        "query",
        "from-archive",
        "archive-format",
        "archive.matches",
        "root",
        "media-type",
        "namespace",
        "blank-nodes",
        "trim-strings",
        "null-string",
        "triplifier",
        "charset",
        "metadata",
        "audit",
        "ondisk",
        "ondisk.reuse",
        "strategy",
        "slice",
        "slice.size",
        "use-rdfs-member",
        "annotate-triples-with-slot-keys",
        "generate-predicate-labels",
        "http.client.useSystemProperties",
        "http.method",
        "http.payload",
        "http.protocol",
        "http.auth.user",
        "http.auth.password",
        "http.redirect",
        "http.sleep",
        "s3.endpoint",
        "s3.bucket-name",
        "s3.key",
        "s3.access-key",
        "s3.secret-key",
        "s3.region",
        "bin.encoding",
        "csv.delimiter",
        "csv.format",
        "csv.headers",
        "csv.headers-row",
        "csv.headers.sanitize",
        "csv.ignore-columns-with-no-header",
        "csv.null-string",
        "csv.quote-char",
        "html.browser",
        "html.browser.screenshot",
        "html.browser.timeout",
        "html.browser.wait",
        "html.metadata",
        "html.parser",
        "html.selector",
        "json.include-null-values",
        "json.literalize",
        "json.path",
        "slides.extract-sections",
        "spreadsheet.composite-values",
        "spreadsheet.evaluate-formulas",
        "spreadsheet.headers",
        "spreadsheet.headers-row",
        "spreadsheet.ignore-columns-with-no-header",
        "txt.group",
        "txt.regex",
        "txt.split",
        "xml.lang-tags",
        "xml.path",
        "yaml.allow-duplicate-keys",
      ],
    },
  },
  {
    // Façade-X data: the default namespace of the generated data, whose terms come from the source (xyz:name...)
    namespace: "http://sparql.xyz/facade-x/data/",
    prefix: "xyz",
  },
];

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
 * Adds the terms of the always included namespaces to the namespaces of the dump: the configured prefix, the
 * configured terms, and the classes and properties of extraTerms (namespaces collected from their sources).
 */
export function addAlwaysIncluded(namespaces, alwaysIncluded = ALWAYS_INCLUDED, extraTerms = []) {
  const result = namespaces.map((ns) => ({ ...ns }));
  const merge = (current = [], added = []) => Array.from(new Set([...current, ...added])).sort();
  for (const { namespace, prefix, terms } of alwaysIncluded) {
    let ns = result.find((ns) => ns.namespace === namespace);
    if (!ns) result.push((ns = { namespace, classes: [], properties: [], usedBy: 0 }));
    if (prefix) ns.prefix = prefix;
    for (const extra of [...(terms ? [terms] : []), ...extraTerms.filter((extra) => extra.namespace === namespace)]) {
      ns.classes = merge(ns.classes, extra.classes);
      ns.properties = merge(ns.properties, extra.properties);
      if (extra.functions?.length) ns.functions = merge(ns.functions, extra.functions);
    }
  }
  return result.filter((ns) => ns.classes.length || ns.properties.length || ns.functions?.length);
}

/**
 * The bundled format: the always included namespaces, then the others most used first, as
 * [namespace, prefix, classes, properties] or, for namespaces with functions, [namespace, prefix, classes,
 * properties, functions]. Namespaces are added until the serialized file would exceed maxBytes,
 * except the always included ones, which are added regardless.
 */
export function toBundle(namespaces, maxBytes = MAX_BYTES, source = DUMP_URL, alwaysIncluded = ALWAYS_INCLUDED) {
  const bundle = { source, generated: new Date().toISOString().substring(0, 10), namespaces: [] };
  let size = JSON.stringify(bundle).length;
  const always = alwaysIncluded.map(({ namespace }) => namespace);
  const ordered = [
    ...always.map((namespace) => namespaces.find((ns) => ns.namespace === namespace)).filter(Boolean),
    ...namespaces.filter((ns) => always.indexOf(ns.namespace) < 0),
  ];
  for (const ns of ordered) {
    const entry = [ns.namespace, ns.prefix || "", ns.classes.join(" "), ns.properties.join(" ")];
    if (ns.functions?.length) entry.push(ns.functions.join(" "));
    const entrySize = JSON.stringify(entry).length + 1;
    if (size + entrySize > maxBytes && always.indexOf(ns.namespace) < 0) continue;
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

/** The terms of the always included namespaces, read from their sources */
async function collectExtraTerms(alwaysIncluded = ALWAYS_INCLUDED) {
  const extraTerms = [];
  for (const { namespace, sources } of alwaysIncluded) {
    for (const source of sources || []) {
      try {
        const input = /^https?:\/\//.test(source) ? await openUrl(source) : fs.createReadStream(source);
        const parser = new StreamParser({ baseIRI: source });
        const terms = (await collectTerms(input.pipe(parser))).filter((ns) => ns.namespace === namespace);
        const count = terms.reduce((count, ns) => count + ns.classes.length + ns.properties.length, 0);
        console.log(`Read ${count} terms of ${namespace} from ${source}`);
        extraTerms.push(...terms);
      } catch (e) {
        console.warn(`Could not read ${source}: ${e.message}`);
      }
    }
  }
  return extraTerms;
}

async function main() {
  const source = process.argv[2] || DUMP_URL;
  console.log(`Reading LOV dump from ${source}...`);
  const input = await openDump(source);
  const stats = { skipped: 0 };
  const namespaces = await collectTerms(readQuads(input, stats));
  if (stats.skipped) console.log(`Skipped ${stats.skipped} invalid lines`);
  const bundle = toBundle(addAlwaysIncluded(namespaces, ALWAYS_INCLUDED, await collectExtraTerms()));
  const terms = bundle.namespaces.reduce(
    (count, [, , ...lists]) => count + lists.reduce((sum, list) => sum + (list ? list.split(" ").length : 0), 0),
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
