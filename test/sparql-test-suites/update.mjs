/**
 * Downloads the SPARQL test queries used by test/unit/yasqe-sparql-test-suites-test.ts and stores them
 * as JSON fixtures next to this script, so the tests run offline and against pinned versions:
 *
 * - w3c.json: the W3C SPARQL 1.0, 1.1 and 1.2 test suites (https://github.com/w3c/rdf-tests).
 *   Contains the syntax tests, plus the queries of the evaluation tests (which are syntactically valid).
 * - traqula.json: the curated queries of Traqula (https://github.com/comunica/traqula), published in the
 *   @traqula/test-utils npm package.
 *
 * Usage: node test/sparql-test-suites/update.mjs [--rdf-tests-commit <sha>] [--traqula-version <version>]
 */
import fs from "fs/promises";
import path from "path";
import zlib from "zlib";
import { fileURLToPath } from "url";
import { Parser, Store } from "n3";

const args = process.argv.slice(2);
function arg(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
}
const RDF_TESTS_COMMIT = arg("--rdf-tests-commit", "369a90d1a60c021b746df2e411da0ff36258a758");
const TRAQULA_VERSION = arg("--traqula-version", "1.4.0");

const outDir = path.dirname(fileURLToPath(import.meta.url));

const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const MF = "http://www.w3.org/2001/sw/DataAccess/tests/test-manifest#";
const QT = "http://www.w3.org/2001/sw/DataAccess/tests/test-query#";
const UT = "http://www.w3.org/2009/sparql/tests/test-update#";
const DAWGT = "http://www.w3.org/2001/sw/DataAccess/tests/test-dawg#";

const positiveSyntaxTypes = ["PositiveSyntaxTest", "PositiveSyntaxTest11", "PositiveUpdateSyntaxTest11"];
const negativeSyntaxTypes = ["NegativeSyntaxTest", "NegativeSyntaxTest11", "NegativeUpdateSyntaxTest11"];
const evaluationTypes = ["QueryEvaluationTest", "UpdateEvaluationTest", "CSVResultFormatTest"];

async function fetchOk(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  return response;
}

/** Runs `fn` over `items` with limited concurrency */
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
      }
    }),
  );
  return results;
}

// ---------------------------------------------------------------------------------------------------------
// W3C rdf-tests
// ---------------------------------------------------------------------------------------------------------

function readList(store, head) {
  const items = [];
  while (head && head.value !== RDF + "nil") {
    items.push(store.getObjects(head, RDF + "first", null)[0]);
    head = store.getObjects(head, RDF + "rest", null)[0];
  }
  return items;
}

/** Collects the test entries of a manifest and all manifests it includes */
async function readManifest(url, seen = new Set()) {
  if (seen.has(url)) return [];
  seen.add(url);
  const turtle = await (await fetchOk(url)).text();
  const store = new Store(new Parser({ baseIRI: url }).parse(turtle));
  const tests = [];
  for (const list of store.getObjects(url, MF + "include", null)) {
    for (const included of readList(store, list)) tests.push(...(await readManifest(included.value, seen)));
  }
  for (const list of store.getObjects(url, MF + "entries", null)) {
    for (const test of readList(store, list)) {
      const types = store.getObjects(test, RDF + "type", null).map((t) => t.value.replace(MF, ""));
      const approval = store.getObjects(test, DAWGT + "approval", null)[0]?.value.replace(DAWGT, "");
      if (approval === "Withdrawn") continue;
      let expect;
      let kind;
      if (types.some((t) => positiveSyntaxTypes.includes(t))) [expect, kind] = ["valid", "syntax"];
      else if (types.some((t) => negativeSyntaxTypes.includes(t))) [expect, kind] = ["invalid", "syntax"];
      else if (types.some((t) => evaluationTypes.includes(t))) [expect, kind] = ["valid", "evaluation"];
      else continue; // e.g. protocol or service description tests, which have no query
      const action = store.getObjects(test, MF + "action", null)[0];
      if (!action) continue;
      const queryFile =
        action.termType === "NamedNode"
          ? action
          : store.getObjects(action, QT + "query", null)[0] || store.getObjects(action, UT + "request", null)[0];
      if (!queryFile) continue;
      tests.push({
        name: store.getObjects(test, MF + "name", null)[0]?.value || test.value,
        expect,
        kind,
        url: queryFile.value,
      });
    }
  }
  return tests;
}

async function updateW3c() {
  const root = `https://raw.githubusercontent.com/w3c/rdf-tests/${RDF_TESTS_COMMIT}/sparql/`;
  const entries = [];
  for (const manifest of ["sparql10/manifest.ttl", "sparql11/manifest-all.ttl", "sparql12/manifest.ttl"]) {
    entries.push(...(await readManifest(root + manifest)));
  }
  // A query file can be used by several tests (e.g. evaluation tests with different data): keep one
  const byId = new Map();
  for (const entry of entries) {
    const id = entry.url.replace(root, "");
    const existing = byId.get(id);
    if (existing && existing.expect !== entry.expect) {
      throw new Error(`Query ${id} is expected to be both valid and invalid`);
    }
    if (!existing || (existing.kind === "evaluation" && entry.kind === "syntax")) byId.set(id, { id, ...entry });
  }
  const tests = await mapLimit([...byId.values()], 16, async ({ id, name, expect, kind, url }) => ({
    id,
    name,
    expect,
    kind,
    query: await (await fetchOk(url)).text(),
  }));
  tests.sort((a, b) => a.id.localeCompare(b.id));
  await writeFixture("w3c.json", {
    source: "https://github.com/w3c/rdf-tests/tree/" + RDF_TESTS_COMMIT + "/sparql",
    license:
      "W3C test suites are dual-licensed under the W3C Test Suite License and the W3C 3-clause BSD License: https://www.w3.org/Consortium/Legal/2008/04-testsuite-copyright.html",
    tests,
  });
}

// ---------------------------------------------------------------------------------------------------------
// Traqula (@traqula/test-utils)
// ---------------------------------------------------------------------------------------------------------

/** Minimal reader for (pax) tar archives, as used by npm */
function* readTar(buffer) {
  const str = (b, start, length) => b.toString("utf8", start, start + length).replace(/\0.*$/s, "");
  let offset = 0;
  let paxPath;
  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) break;
    const size = parseInt(str(header, 124, 12).trim() || "0", 8);
    const type = String.fromCharCode(header[156]);
    const prefix = str(header, 345, 155);
    const data = buffer.subarray(offset + 512, offset + 512 + size);
    offset += 512 + Math.ceil(size / 512) * 512;
    if (type === "x") {
      paxPath = /(?:^|\n)\d+ path=([^\n]*)\n/.exec(data.toString("utf8"))?.[1];
    } else if (type === "0" || type === "\0") {
      const name = paxPath || (prefix ? prefix + "/" : "") + str(header, 0, 100);
      paxPath = undefined;
      yield { name, data };
    }
  }
}

async function updateTraqula() {
  const tarball = `https://registry.npmjs.org/@traqula/test-utils/-/test-utils-${TRAQULA_VERSION}.tgz`;
  const archive = zlib.gunzipSync(Buffer.from(await (await fetchOk(tarball)).arrayBuffer()));
  const suites = {
    "sparql-1-1": "valid",
    "sparql-1-1-invalid": "invalid",
    "sparql-1-2": "valid",
    "sparql-1-2-invalid": "invalid",
  };
  const tests = [];
  let license;
  for (const { name, data } of readTar(archive)) {
    if (name === "package/LICENSE.txt") license = data.toString("utf8");
    const match = /^package\/statics\/ast\/sparql\/([^/]+)\/([^/]+)\.sparql$/.exec(name);
    if (!match || !(match[1] in suites)) continue;
    tests.push({ id: `${match[1]}/${match[2]}`, expect: suites[match[1]], query: data.toString("utf8") });
  }
  if (!license) throw new Error("No LICENSE.txt found in " + tarball);
  tests.sort((a, b) => a.id.localeCompare(b.id));
  await writeFixture("traqula.json", {
    source: `https://www.npmjs.com/package/@traqula/test-utils/v/${TRAQULA_VERSION}`,
    license,
    tests,
  });
}

async function writeFixture(fileName, content) {
  await fs.writeFile(path.join(outDir, fileName), JSON.stringify(content, null, 2) + "\n", "utf8");
  console.log(`Wrote ${content.tests.length} tests to ${fileName}`);
}

await Promise.all([updateW3c(), updateTraqula()]);
