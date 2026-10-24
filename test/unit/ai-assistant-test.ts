import * as chai from "chai";
import { describe, it } from "mocha";

import { prepareCheckQuery, formatBindings, formatTerm } from "../../packages/yasgui/src/ai/checkQuery.js";
import { buildSchemaContext, compactIri } from "../../packages/yasgui/src/ai/schemaContext.js";
import { buildCopyPrompt, buildPrompt, extractQueries } from "../../packages/yasgui/src/ai/prompts.js";
import { normalizeBaseUrl, resolveConnection } from "../../packages/yasgui/src/ai/aiSettings.js";
import { describeErrorBody, joinUrl, listModels } from "../../packages/yasgui/src/ai/openaiClient.js";
import { defaultAiConfig } from "../../packages/yasgui/src/ai/types.js";

const expect = chai.expect;

describe("AI assistant", () => {
  describe("check queries", () => {
    it("adds a LIMIT to a SELECT query without one", () => {
      const result = prepareCheckQuery("SELECT ?s WHERE { ?s a ?c }");
      expect(result).to.deep.equal({ ok: true, query: "SELECT ?s WHERE { ?s a ?c }\nLIMIT 20" });
    });

    it("lowers a LIMIT that is too large and keeps a small one", () => {
      const lowered = prepareCheckQuery("SELECT * WHERE { ?s ?p ?o } LIMIT 1000");
      expect(lowered.ok && lowered.query).to.equal("SELECT * WHERE { ?s ?p ?o } LIMIT 20");
      const kept = prepareCheckQuery("SELECT * WHERE { ?s ?p ?o } LIMIT 5 OFFSET 10");
      expect(kept.ok && kept.query).to.equal("SELECT * WHERE { ?s ?p ?o } LIMIT 5 OFFSET 10");
    });

    it("only lowers the LIMIT of the outer query", () => {
      const result = prepareCheckQuery("SELECT * WHERE { { SELECT ?s WHERE { ?s ?p ?o } LIMIT 500 } } LIMIT 100");
      expect(result.ok && result.query).to.equal(
        "SELECT * WHERE { { SELECT ?s WHERE { ?s ?p ?o } LIMIT 500 } } LIMIT 20",
      );
    });

    it("accepts ASK and refuses updates, CONSTRUCT and empty queries", () => {
      expect(prepareCheckQuery("ASK { ?s a <http://example.org/C> }").ok).to.equal(true);
      expect(prepareCheckQuery("INSERT DATA { <a> <b> <c> }").ok).to.equal(false);
      expect(prepareCheckQuery("DELETE WHERE { ?s ?p ?o }").ok).to.equal(false);
      expect(prepareCheckQuery("CONSTRUCT WHERE { ?s ?p ?o }").ok).to.equal(false);
      expect(prepareCheckQuery("  ").ok).to.equal(false);
    });

    it("doesn't take variables, prefixed names, IRIs or literals for update keywords", () => {
      const query = `PREFIX ex: <http://example.org/insert#>
SELECT ?copy ?add WHERE { ?copy ex:Create ?add ; ex:label "DELETE me" }`;
      expect(prepareCheckQuery(query).ok).to.equal(true);
    });

    it("formats result rows compactly and says how many rows were left out", () => {
      const table = formatBindings(
        ["s", "label"],
        [
          { s: { type: "uri", value: "http://ex.org/a" }, label: { type: "literal", value: "A", "xml:lang": "en" } },
          { s: { type: "uri", value: "http://ex.org/b" } },
        ],
        1,
      );
      expect(table).to.equal('?s\t?label\n<http://ex.org/a>\t"A"@en\n(1 more rows not shown)');
      expect(
        formatTerm({ type: "literal", value: "5", datatype: "http://www.w3.org/2001/XMLSchema#integer" }),
      ).to.equal('"5"^^<http://www.w3.org/2001/XMLSchema#integer>');
      expect(formatBindings(["s"], [], 10)).to.equal("?s\n(no rows)");
    });
  });

  describe("schema context", () => {
    const input = {
      endpoint: "http://example.org/sparql",
      prefixes: { rdfs: "http://www.w3.org/2000/01/rdf-schema#", unused: "http://unused.org/" },
      classes: [
        {
          iri: "http://data.europa.eu/949/Tunnel",
          count: 9812,
          prefix: "era",
          namespace: "http://data.europa.eu/949/",
        },
        { iri: "http://other.org/x/Thing" },
      ],
      properties: [{ iri: "http://www.w3.org/2000/01/rdf-schema#label", count: 50 }],
      maxTerms: 10,
    };

    it("lists prefixes in use, classes and properties with their counts", () => {
      const context = buildSchemaContext(input);
      expect(context).to.contain("SPARQL endpoint: http://example.org/sparql");
      expect(context).to.contain("PREFIX era: <http://data.europa.eu/949/>");
      expect(context).to.contain("PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>");
      expect(context).not.to.contain("unused");
      expect(context).to.contain("era:Tunnel 9812");
      expect(context).to.contain("<http://other.org/x/Thing>");
      expect(context).to.contain("rdfs:label 50");
    });

    it("keeps prefixes used by the query and limits the number of terms", () => {
      const context = buildSchemaContext({ ...input, maxTerms: 1 }, "SELECT * { ?s unused:p ?o }");
      expect(context).to.contain("PREFIX unused: <http://unused.org/>");
      expect(context).not.to.contain("Thing");
    });

    it("says when nothing is known about the endpoint", () => {
      const context = buildSchemaContext({ ...input, classes: [], properties: [] });
      expect(context).to.contain("not known yet");
    });

    it("only compacts IRIs whose local name is valid", () => {
      expect(compactIri("http://ex.org/a b", { ex: "http://ex.org/" })).to.equal("<http://ex.org/a b>");
      expect(compactIri("http://ex.org/ab", { ex: "http://ex.org/" })).to.equal("ex:ab");
    });
  });

  describe("prompts", () => {
    const query = "SELECT * WHERE { ?s ?p ?o }";

    it("sends the schema with a question and lists what is included", () => {
      const built = buildPrompt(
        { kind: "ask", title: "Question", question: "Which tunnels are long?", query, endpoint: "http://e/sparql" },
        {
          schemaContext: "CONTEXT",
          schemaSummary: "the names of 1 classes",
          checkQueries: { maxCalls: 3, rowLimit: 20 },
        },
      );
      expect(built.messages[0].role).to.equal("system");
      expect(built.messages[0].content).to.contain("CONTEXT");
      expect(built.messages[0].content).to.contain("run_sparql");
      const user = built.messages[built.messages.length - 1].content as string;
      expect(user).to.contain("Which tunnels are long?");
      expect(user).to.contain(query);
      expect(built.includes).to.include("your question");
      expect(built.includes).to.include("the names of 1 classes");
      expect(built.includes).to.include("the endpoint URL (http://e/sparql)");
    });

    it("includes the error for a fix, and the rows for explaining results", () => {
      const fix = buildPrompt({
        kind: "fix",
        title: "Fix",
        query,
        error: { source: "endpoint", status: 400, message: "Unknown prefix" },
      });
      expect(fix.messages[1].content).to.contain("HTTP 400");
      expect(fix.messages[1].content).to.contain("Unknown prefix");
      expect(fix.includes).to.include("the error message");

      const noResults = buildPrompt({ kind: "fix", title: "Why", query, error: { source: "noResults" } });
      expect(noResults.messages[1].content).to.contain("returns no results");

      const results = buildPrompt({
        kind: "explainResults",
        title: "Explain results",
        query,
        results: { table: "?s\n<a>", shownRows: 50, totalRows: 120 },
      });
      expect(results.messages[1].content).to.contain("first 50 of 120 rows");
      expect(results.includes).to.include("the first 50 of 120 result rows");
    });

    it("never mentions tools in a copied prompt", () => {
      const text = buildCopyPrompt({ kind: "explainQuery", title: "Explain", query }, {});
      expect(text).to.contain(query);
      expect(text).not.to.contain("run_sparql");
    });

    it("finds SPARQL code blocks in an answer", () => {
      const answer =
        "Try this:\n```sparql\nSELECT ?s { ?s ?p ?o }\n```\nor\n```\nASK { ?s ?p ?o }\n```\n```json\n{}\n```";
      expect(extractQueries(answer)).to.deep.equal(["SELECT ?s { ?s ?p ?o }", "ASK { ?s ?p ?o }"]);
    });
  });

  describe("connection", () => {
    const proxy = { url: "https://site.example/ai/v1", label: "Site AI" };

    it("is undefined without a service, which leaves Copy for AI", () => {
      expect(resolveConnection(defaultAiConfig, {})).to.equal(undefined);
      expect(resolveConnection(defaultAiConfig, { service: "own" })).to.equal(undefined);
    });

    it("uses the user's own key and the default base URL", () => {
      const connection = resolveConnection(defaultAiConfig, { service: "own", apiKey: "sk-1", model: "m" });
      expect(connection).to.include({ kind: "own", baseUrl: "https://api.openai.com/v1", apiKey: "sk-1", model: "m" });
      expect(connection?.host).to.equal("api.openai.com");
    });

    it("needs no key for a local service", () => {
      const connection = resolveConnection(defaultAiConfig, { service: "own", baseUrl: "http://localhost:11434/v1" });
      expect(connection?.kind).to.equal("own");
    });

    it("uses the proxy of the site by default, and the user's choice otherwise", () => {
      const config = { ...defaultAiConfig, proxy };
      expect(resolveConnection(config, {})).to.include({ kind: "proxy", label: "Site AI", host: "site.example" });
      expect(resolveConnection(config, { service: "own", apiKey: "k" })?.kind).to.equal("own");
      expect(resolveConnection(config, { service: "off" })).to.equal(undefined);
    });

    it("ignores the user's key when the site doesn't allow own keys", () => {
      const config = { ...defaultAiConfig, allowOwnKey: false, proxy };
      expect(resolveConnection(config, { service: "own", apiKey: "k" })).to.equal(undefined);
      expect(resolveConnection({ ...config, enabled: false }, {})).to.equal(undefined);
    });

    it("drops an endpoint path pasted with the base URL", () => {
      expect(normalizeBaseUrl(" https://api.anthropic.com/v1/messages ")).to.equal("https://api.anthropic.com/v1");
      expect(normalizeBaseUrl("https://api.openai.com/v1/chat/completions/")).to.equal("https://api.openai.com/v1");
      expect(normalizeBaseUrl("https://openrouter.ai/api/v1")).to.equal("https://openrouter.ai/api/v1");
      const connection = resolveConnection(defaultAiConfig, {
        service: "own",
        apiKey: "k",
        baseUrl: "https://api.anthropic.com/v1/messages",
      });
      expect(connection?.baseUrl).to.equal("https://api.anthropic.com/v1");
    });

    it("adds the headers Anthropic and Azure need for requests from a browser", async () => {
      const originalFetch = globalThis.fetch;
      const calls: Array<{ url: string; headers: { [name: string]: string } }> = [];
      globalThis.fetch = (async (url: string, init: RequestInit) => {
        calls.push({ url, headers: init.headers as { [name: string]: string } });
        return new Response(JSON.stringify({ data: [{ id: "claude-b" }, { id: "claude-a" }] }), { status: 200 });
      }) as typeof fetch;
      try {
        const base = { kind: "own" as const, apiKey: "sk-ant", label: "" };
        const models = await listModels({
          ...base,
          baseUrl: "https://api.anthropic.com/v1",
          host: "api.anthropic.com",
        });
        expect(models).to.deep.equal(["claude-a", "claude-b"]);
        expect(calls[0].url).to.equal("https://api.anthropic.com/v1/models");
        expect(calls[0].headers).to.include({
          "anthropic-dangerous-direct-browser-access": "true",
          "x-api-key": "sk-ant",
          Authorization: "Bearer sk-ant",
        });
        await listModels({ ...base, baseUrl: "https://api.openai.com/v1", host: "api.openai.com" });
        expect(calls[1].headers).to.not.have.property("anthropic-dangerous-direct-browser-access");
        expect(calls[1].headers).to.not.have.property("x-api-key");
        await listModels({ ...base, baseUrl: "https://r.openai.azure.com/openai/v1", host: "r.openai.azure.com" });
        expect(calls[2].headers).to.include({ "api-key": "sk-ant" });
        expect(calls[2].headers).to.not.have.property("Authorization");
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it("explains error answers of the service", () => {
      expect(describeErrorBody(401, '{"error":{"message":"Incorrect API key"}}')).to.contain("Incorrect API key");
      expect(describeErrorBody(401, "{}")).to.contain("API key was refused");
      expect(joinUrl("https://a.b/v1/", "/chat/completions")).to.equal("https://a.b/v1/chat/completions");
    });
  });
});
