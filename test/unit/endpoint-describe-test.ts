import * as chai from "chai";
import { describe, it } from "mocha";

import {
  buildQuery,
  defaultCategories,
  defaultDescribeQueries,
  DescribeBinding,
  DescribeQueryContext,
  wktExtent,
} from "../../packages/yasgui/src/endpointDescribe/describeQueries.js";
import {
  cutAtLastStatement,
  MAX_METADATA_BYTES,
  readLimited,
  extractServiceDescription,
  extractVoidDatasets,
  fetchEndpointMetadata,
  getWellKnownVoidUrl,
  parseRdf,
  EndpointMetadata,
} from "../../packages/yasgui/src/endpointDescribe/metadataSources.js";
import {
  describeQueryError,
  htmlToText,
  isPartialResponse,
} from "../../packages/yasgui/src/endpointDescribe/responseUtils.js";
import DescribeStore, {
  DescribeResult,
  MAX_ENDPOINTS,
  MAX_PERSISTED_ROWS,
  StoredDescribeState,
} from "../../packages/yasgui/src/endpointDescribe/DescribeStore.js";
import {
  AUTOCOMPLETE_RETRY_MS,
  collectTerms,
  mergeTerms,
} from "../../packages/yasgui/src/endpointDescribe/endpointTerms.js";

const expect = chai.expect;

function context(overrides: Partial<DescribeQueryContext> = {}): DescribeQueryContext {
  return { limit: 25, offset: 0, getResult: () => undefined, ...overrides };
}

function stripStrings(query: string) {
  return query.replace(/"(?:[^"\\]|\\.)*"/g, '""');
}

describe("Endpoint describe queries", () => {
  it("has unique ids and only uses known categories", () => {
    const ids = defaultDescribeQueries.map((q) => q.id);
    expect(new Set(ids).size).to.equal(ids.length);
    const categories = defaultCategories.map((c) => c.id);
    for (const query of defaultDescribeQueries) {
      expect(categories, query.id).to.include(query.category);
    }
    // Every category from the issue has at least one query
    for (const category of categories) {
      expect(
        defaultDescribeQueries.some((q) => q.category === category),
        String(category),
      ).to.equal(true);
    }
  });

  it("builds well-formed, bounded queries", () => {
    for (const query of defaultDescribeQueries) {
      const text = buildQuery(query, context());
      const withoutStrings = stripStrings(text);
      expect(withoutStrings.split("{").length, `${query.id}: braces`).to.equal(withoutStrings.split("}").length);
      expect(withoutStrings.split("(").length, `${query.id}: parentheses`).to.equal(withoutStrings.split(")").length);
      expect(text, query.id).to.match(/^(PREFIX [\w-]+: <[^>]+>\n)*SELECT /);
      const isSingleAggregate = !/GROUP BY/.test(text) && /SELECT \(/.test(text);
      if (!isSingleAggregate) expect(text, `${query.id}: needs a LIMIT`).to.match(/LIMIT \d+/);
      // Every prefixed name that is used is declared
      const declared = Array.from(text.matchAll(/PREFIX ([\w-]+):/g)).map((m) => m[1]);
      const body = withoutStrings.replace(/PREFIX [\w-]+: <[^>]+>/g, "").replace(/<[^>]*>/g, "");
      for (const match of body.matchAll(/\b([a-z][\w-]*):[A-Za-z_]/g)) {
        expect(declared, `${query.id}: prefix ${match[1]}`).to.include(match[1]);
      }
    }
  });

  it("does not use REPLACE patterns that match the empty string (rejected by Virtuoso)", () => {
    for (const query of defaultDescribeQueries) {
      const text = buildQuery(query, context());
      for (const match of text.matchAll(/REPLACE\([^,]+,\s*"((?:[^"\\]|\\.)*)"/g)) {
        expect(new RegExp(match[1]).test(""), `${query.id}: ${match[1]}`).to.equal(false);
      }
    }
  });

  it("paginates with LIMIT and OFFSET", () => {
    for (const query of defaultDescribeQueries.filter((q) => q.paginated)) {
      const firstPage = buildQuery(query, context({ limit: 10, offset: 0 }));
      const secondPage = buildQuery(query, context({ limit: 10, offset: 20 }));
      expect(firstPage, query.id).to.match(/LIMIT 10$/);
      expect(secondPage, query.id).to.match(/LIMIT 10 OFFSET 20$/);
    }
  });

  it("builds per-class samples from the classes result", () => {
    const query = defaultDescribeQueries.find((q) => q.id === "class-samples")!;
    expect(query.dependsOn).to.equal("classes");
    const text = buildQuery(
      query,
      context({
        getResult: (id) =>
          id === "classes"
            ? {
                vars: ["class", "instances"],
                bindings: [
                  { class: { type: "uri", value: "http://example.org/A" } },
                  { class: { type: "uri", value: "http://example.org/B>" } },
                ],
              }
            : undefined,
      }),
    );
    expect(text).to.contain("?instance a <http://example.org/A>");
    // IRIs are sanitized before being inlined
    expect(text).to.contain("<http://example.org/B>");
    expect(text).not.to.contain("B>>");
    expect(text.match(/UNION/g)?.length).to.equal(1);
  });

  it("computes a bounding box from WKT literals", () => {
    const table = wktExtent({
      vars: ["wkt"],
      bindings: [
        { wkt: { type: "literal", value: "POINT(4.35 50.85)" } },
        {
          wkt: {
            type: "literal",
            value: "<http://www.opengis.net/def/crs/EPSG/0/4326> LINESTRING(1 2, 3 4 100)",
          },
        },
      ],
    });
    const row = table.bindings[0];
    expect(row.minX.value).to.equal("1");
    expect(row.minY.value).to.equal("2");
    expect(row.maxX.value).to.equal("4.35");
    expect(row.maxY.value).to.equal("50.85");
    expect(row.sampledGeometries.value).to.equal("2");
    expect(row.crs.value).to.contain("EPSG/0/4326");
  });
});

const SD_TURTLE = `
@prefix sd: <http://www.w3.org/ns/sparql-service-description#> .
@prefix void: <http://rdfs.org/ns/void#> .
@prefix dcterms: <http://purl.org/dc/terms/> .
<https://example.org/sparql#service> a sd:Service ;
  sd:endpoint <https://example.org/sparql> ;
  sd:supportedLanguage sd:SPARQL11Query ;
  sd:feature sd:UnionDefaultGraph ;
  sd:extensionFunction <http://jena.apache.org/text#query> ;
  sd:resultFormat <http://www.w3.org/ns/formats/SPARQL_Results_JSON> ;
  sd:defaultDataset [
    sd:namedGraph [ sd:name <https://example.org/graph/1> ] , [ sd:name <https://example.org/graph/2> ]
  ] .
<https://example.org/dataset> a void:Dataset ;
  dcterms:title "Example" ;
  void:triples 1234 ;
  void:classes 2 ;
  void:vocabulary <http://xmlns.com/foaf/0.1/> ;
  void:classPartition [ void:class <http://xmlns.com/foaf/0.1/Person> ; void:entities 10 ] ,
    [ void:class <http://xmlns.com/foaf/0.1/Organization> ; void:entities 50 ] ;
  void:propertyPartition [ void:property <http://xmlns.com/foaf/0.1/name> ; void:triples 60 ] .
`;

describe("Endpoint describe metadata (SD / VoID)", () => {
  it("extracts the service description", () => {
    const quads = parseRdf(SD_TURTLE, "text/turtle", "https://example.org/sparql");
    const sd = extractServiceDescription(quads)!;
    expect(sd.languages).to.deep.equal(["http://www.w3.org/ns/sparql-service-description#SPARQL11Query"]);
    expect(sd.features).to.deep.equal(["http://www.w3.org/ns/sparql-service-description#UnionDefaultGraph"]);
    expect(sd.extensionFunctions).to.deep.equal(["http://jena.apache.org/text#query"]);
    expect(sd.namedGraphs).to.have.members(["https://example.org/graph/1", "https://example.org/graph/2"]);
  });

  it("extracts VoID datasets and sorts partitions", () => {
    const quads = parseRdf(SD_TURTLE, "text/turtle", "https://example.org/sparql");
    const datasets = extractVoidDatasets(quads);
    expect(datasets).to.have.length(1);
    const dataset = datasets[0];
    expect(dataset.title).to.equal("Example");
    expect(dataset.triples).to.equal(1234);
    expect(dataset.classes).to.equal(2);
    expect(dataset.vocabularies).to.deep.equal(["http://xmlns.com/foaf/0.1/"]);
    expect(dataset.classPartitions.map((p) => p.iri)).to.deep.equal([
      "http://xmlns.com/foaf/0.1/Organization",
      "http://xmlns.com/foaf/0.1/Person",
    ]);
    expect(dataset.propertyPartitions[0]).to.deep.include({ iri: "http://xmlns.com/foaf/0.1/name", triples: 60 });
  });

  it("does not duplicate partitions described in both the SD and VoID", () => {
    const quads = [
      ...parseRdf(SD_TURTLE, "text/turtle", "https://example.org/sparql"),
      ...parseRdf(SD_TURTLE, "text/turtle", "https://example.org/.well-known/void"),
    ];
    const datasets = extractVoidDatasets(quads);
    expect(datasets).to.have.length(1);
    expect(datasets[0].classPartitions).to.have.length(2);
  });

  it("flags blank-node datasets and drops datasets without information", () => {
    const quads = parseRdf(
      `@prefix void: <http://rdfs.org/ns/void#> .
       _:graph a void:Dataset ; void:triples 42 .
       _:empty a void:Dataset .`,
      "text/turtle",
      "https://example.org/sparql",
    );
    const datasets = extractVoidDatasets(quads);
    expect(datasets).to.have.length(1);
    expect(datasets[0].blank).to.equal(true);
    expect(datasets[0].triples).to.equal(42);
  });

  it("cuts a truncated document after its last complete statement", () => {
    const doc = '<http://a> <http://b> "1" .\n<http://c> <http://d> [ <http://e> "2" ] .\n<http://f> <http://g> "unfin';
    const cut = cutAtLastStatement(doc);
    expect(parseRdf(cut, "text/turtle", "https://example.org/")).to.have.length(3);
    expect(cutAtLastStatement("no statement")).to.equal("");
  });

  it("stops reading large descriptions", async () => {
    const chunk = new TextEncoder().encode("x".repeat(1_000_000));
    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled++;
        controller.enqueue(chunk);
      },
    });
    const { text, truncated } = await readLimited(new Response(stream), MAX_METADATA_BYTES);
    expect(truncated).to.equal(true);
    expect(text.length).to.be.at.least(MAX_METADATA_BYTES);
    expect(pulled).to.be.below(10);
    const small = await readLimited(new Response("<a> <b> <c> ."), MAX_METADATA_BYTES);
    expect(small).to.deep.equal({ text: "<a> <b> <c> .", truncated: false });
  });

  it("rejects HTML responses", () => {
    expect(() => parseRdf("<html></html>", "text/html; charset=utf-8", "https://example.org/")).to.throw();
  });

  it("builds the well-known VoID URL", () => {
    expect(getWellKnownVoidUrl("https://example.org/repositories/test/sparql")).to.equal(
      "https://example.org/.well-known/void",
    );
    expect(getWellKnownVoidUrl("not a url")).to.equal(undefined);
  });

  it("reports unavailable sources without throwing (e.g. GraphDB without SD)", async () => {
    const originalFetch = globalThis.fetch;
    const requested: string[] = [];
    try {
      globalThis.fetch = async (input: any) => {
        requested.push(String(input));
        if (String(input).endsWith("/.well-known/void")) return new Response("Not found", { status: 404 });
        return new Response("<html><body>SPARQL form</body></html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      };
      const metadata = await fetchEndpointMetadata("https://example.org/repositories/test");
      expect(requested).to.have.members([
        "https://example.org/repositories/test",
        "https://example.org/.well-known/void",
      ]);
      expect(metadata.sdStatus).to.equal("unavailable");
      expect(metadata.voidStatus).to.equal("unavailable");
      expect(metadata.voidError).to.contain("404");
      expect(metadata.datasets).to.deep.equal([]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("combines the service description and VoID", async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async (input: any, init: any) => {
        expect(init.headers.Accept).to.contain("text/turtle");
        expect(init.headers.Authorization).to.equal("Bearer token");
        if (String(input).endsWith("/.well-known/void")) return new Response("Not found", { status: 404 });
        return new Response(SD_TURTLE, { status: 200, headers: { "Content-Type": "text/turtle" } });
      };
      const metadata = await fetchEndpointMetadata("https://example.org/sparql", {
        headers: { Authorization: "Bearer token" },
      });
      expect(metadata.sdStatus).to.equal("ok");
      // VoID embedded in the service description is used as well
      expect(metadata.voidStatus).to.equal("ok");
      expect(metadata.datasets[0].triples).to.equal(1234);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("Endpoint terms for autocompletion", () => {
  const uri = (value: string) => ({ type: "uri", value });
  const literal = (value: string) => ({ type: "literal", value });
  const done = (bindings: DescribeBinding[], hasMore = false): DescribeResult => ({
    status: "done",
    vars: [],
    bindings,
    fetchedAt: Date.now(),
    hasMore,
  });
  const voidMetadata = (classPartitions: Array<{ iri: string; entities?: number }>): EndpointMetadata => ({
    fetchedAt: Date.now(),
    sdStatus: "unavailable",
    voidStatus: "ok",
    datasets: [
      { iri: "_:d", sparqlEndpoints: [], vocabularies: [], classPartitions, propertyPartitions: [], linksets: [] },
    ],
  });

  it("merges sources, keeping the highest count, most used first", () => {
    expect(
      mergeTerms(
        [{ iri: "a", count: 1 }, { iri: "b" }],
        [
          { iri: "a", count: 5 },
          { iri: "c", count: 3 },
        ],
      ),
    ).to.deep.equal([{ iri: "a", count: 5 }, { iri: "c", count: 3 }, { iri: "b" }]);
  });

  it("reuses a complete overview result without querying", () => {
    const results: { [id: string]: DescribeResult } = {
      classes: done([
        { class: uri("http://example.org/A"), instances: literal("10") },
        { class: { type: "bnode", value: "b0" }, instances: literal("2") },
      ]),
    };
    const collected = collectTerms("class", (id) => results[id], undefined);
    expect(collected.terms).to.deep.equal([{ iri: "http://example.org/A", count: 10 }]);
    expect(collected.needsQuery).to.equal(false);
  });

  it("queries when the overview only holds the first page", () => {
    const results = { classes: done([{ class: uri("http://example.org/A"), instances: literal("10") }], true) };
    expect(collectTerms("class", (id) => (results as any)[id], undefined).needsQuery).to.equal(true);
  });

  it("uses VoID class partitions instead of a query", () => {
    const collected = collectTerms(
      "class",
      () => undefined,
      voidMetadata([{ iri: "http://example.org/B", entities: 7 }]),
    );
    expect(collected.terms).to.deep.equal([{ iri: "http://example.org/B", count: 7 }]);
    expect(collected.needsQuery).to.equal(false);
  });

  it("reads the background query result and doesn't retry a recent failure", () => {
    const fromQuery = {
      "autocomplete-properties": done([{ property: uri("http://example.org/p"), uses: literal("4") }]),
    };
    const collected = collectTerms("property", (id) => (fromQuery as any)[id], undefined);
    expect(collected.terms).to.deep.equal([{ iri: "http://example.org/p", count: 4 }]);
    expect(collected.needsQuery).to.equal(false);

    const failed = (fetchedAt: number): DescribeResult => ({ status: "error", vars: [], bindings: [], fetchedAt });
    expect(collectTerms("property", () => failed(Date.now()), undefined).needsQuery).to.equal(false);
    expect(
      collectTerms("property", () => failed(Date.now() - AUTOCOMPLETE_RETRY_MS - 1), undefined).needsQuery,
    ).to.equal(true);
  });
});

describe("Endpoint describe store", () => {
  it("remembers the endpoints for which autocompletion is switched off", () => {
    let stored: StoredDescribeState | undefined;
    const storage = { get: () => stored, set: (state: StoredDescribeState) => (stored = state) };
    const store = new DescribeStore(storage);
    expect(store.isAutocompleteEnabled("https://example.org/sparql")).to.equal(true);
    store.setAutocompleteEnabled("https://example.org/sparql", false);
    expect(new DescribeStore(storage).isAutocompleteEnabled("https://example.org/sparql")).to.equal(false);
    store.setAutocompleteEnabled("https://example.org/sparql", true);
    expect(new DescribeStore(storage).isAutocompleteEnabled("https://example.org/sparql")).to.equal(true);
  });

  function memoryStorage() {
    let stored: StoredDescribeState | undefined;
    return {
      get: () => (stored ? JSON.parse(JSON.stringify(stored)) : undefined),
      set: (state: StoredDescribeState) => {
        stored = JSON.parse(JSON.stringify(state));
      },
      raw: () => stored,
    };
  }

  it("persists results and UI state", () => {
    const storage = memoryStorage();
    const store = new DescribeStore(storage);
    store.setUiState({ open: true, pinned: true, width: 500 });
    store.setResult("https://example.org/sparql", "classes", {
      status: "done",
      vars: ["class"],
      bindings: [{ class: { type: "uri", value: "http://example.org/A" } }],
      fetchedAt: 1,
    });
    const restored = new DescribeStore(storage);
    expect(restored.getUiState()).to.include({ open: true, pinned: true, width: 500 });
    expect(restored.getResult("https://example.org/sparql", "classes")?.bindings).to.have.length(1);
  });

  it("truncates large results when persisting", () => {
    const storage = memoryStorage();
    const store = new DescribeStore(storage);
    const bindings = Array.from({ length: MAX_PERSISTED_ROWS + 50 }, (_, i) => ({
      s: { type: "literal", value: String(i) },
    }));
    store.setResult("https://example.org/sparql", "big", { status: "done", vars: ["s"], bindings, fetchedAt: 1 });
    // In memory, all rows are kept
    expect(store.getResult("https://example.org/sparql", "big")?.bindings).to.have.length(MAX_PERSISTED_ROWS + 50);
    const persisted = storage.raw()!.endpoints["https://example.org/sparql"].results.big;
    expect(persisted.bindings).to.have.length(MAX_PERSISTED_ROWS);
    expect(persisted.truncated).to.equal(true);
  });

  it("evicts the least recently used endpoints", async () => {
    const storage = memoryStorage();
    const store = new DescribeStore(storage);
    for (let i = 0; i < MAX_ENDPOINTS + 3; i++) {
      store.setResult(`https://example.org/${i}`, "q", { status: "done", vars: [], bindings: [], fetchedAt: i });
      // Make sure lastUsed differs
      await new Promise((resolve) => setTimeout(resolve, 2));
    }
    const endpoints = Object.keys(storage.raw()!.endpoints);
    expect(endpoints).to.have.length(MAX_ENDPOINTS);
    expect(endpoints).not.to.include("https://example.org/0");
    expect(endpoints).to.include(`https://example.org/${MAX_ENDPOINTS + 2}`);
  });

  it("keeps working when storage fails", () => {
    const store = new DescribeStore({
      get: () => {
        throw new Error("broken");
      },
      set: () => {
        throw new Error("quota");
      },
    });
    store.setResult("https://example.org/sparql", "q", { status: "done", vars: [], bindings: [], fetchedAt: 1 });
    expect(store.getResult("https://example.org/sparql", "q")).to.not.equal(undefined);
  });
});

describe("Endpoint describe response handling", () => {
  it("detects partial results of Virtuoso anytime queries", () => {
    expect(isPartialResponse({ status: 206, headers: new Headers({ "X-SQL-State": "S1TAT" }) })).to.equal(true);
    expect(isPartialResponse({ status: 200, headers: new Headers({ "X-SQL-State": "S1TAT" }) })).to.equal(true);
    expect(isPartialResponse({ status: 200, headers: new Headers() })).to.equal(false);
    expect(isPartialResponse(undefined)).to.equal(false);
  });

  it("summarizes HTML error pages", () => {
    const wikimedia =
      '<!DOCTYPE html>\n<html lang="en">\n<meta charset="utf-8">\n<title>Wikimedia Error</title>\n<style>* { margin: 0; }</style>\n<body>Too many requests</body></html>';
    expect(htmlToText(wikimedia)).to.equal("Wikimedia Error");
    expect(htmlToText("<html><body><h1>504 Gateway Time-out</h1></body></html>")).to.equal("504 Gateway Time-out");
    expect(htmlToText("<div>a &amp; <b>b</b></div>")).to.equal("a & b");
  });

  it("explains rate limiting, gateway timeouts and client timeouts", () => {
    const rateLimited: any = new Error("<!DOCTYPE html><html><title>Wikimedia Error</title></html>");
    rateLimited.status = 429;
    rateLimited.statusText = "Too Many Requests";
    rateLimited.response = { headers: new Headers({ "Retry-After": "30" }) };
    expect(describeQueryError(rateLimited)).to.equal(
      "HTTP 429 Too Many Requests: The endpoint is rate limiting requests. Wait a moment before running more queries (retry after 30 s).",
    );

    const gateway: any = new Error(
      '<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN"><HTML><TITLE>Gateway Timeout</TITLE></HTML>',
    );
    gateway.status = 504;
    expect(describeQueryError(gateway)).to.equal(
      "HTTP 504: The endpoint (or a gateway in front of it) did not answer in time. Gateway Timeout",
    );

    const virtuoso: any = new Error(
      "Virtuoso 42000 Error The estimated execution time 6910 (sec) exceeds the limit of 60 (sec).",
    );
    virtuoso.status = 500;
    expect(describeQueryError(virtuoso)).to.equal(
      "HTTP 500: Virtuoso 42000 Error The estimated execution time 6910 (sec) exceeds the limit of 60 (sec).",
    );

    const blazegraph: any = new Error(
      "SPARQL-QUERY: queryStr=SELECT DISTINCT ?graph WHERE { GRAPH ?graph { ?s ?p ?o } }\njava.util.concurrent.ExecutionException: java.util.concurrent.ExecutionException: com.bigdata.rdf.sparql.ast.QuadsOperationInTriplesModeException: Use of WITH and GRAPH constructs in query body is not supported in triples mode.\nCaused by: com.bigdata.rdf.sparql.ast.QuadsOperationInTriplesModeException: Use of WITH and GRAPH constructs in query body is not supported in triples mode.\n\tat com.bigdata.Foo.bar(Foo.java:1)",
    );
    blazegraph.status = 400;
    blazegraph.statusText = "Bad Request";
    expect(describeQueryError(blazegraph)).to.equal(
      "HTTP 400 Bad Request: Use of WITH and GRAPH constructs in query body is not supported in triples mode.",
    );

    expect(describeQueryError(new Error("aborted"), { timedOut: true, timeoutMs: 60000 })).to.equal(
      "Timed out after 60 s",
    );
    expect(describeQueryError(new Error("x".repeat(600)))).to.have.length(501);
  });
});
