import * as chai from "chai";
import { describe, it } from "mocha";

import {
  buildDescribeQuery,
  localName,
  normalizeDirection,
  sanitizePrefixes,
  toPrefixedName,
  INCOMING_TRIPLE_LIMIT,
} from "../../packages/yasr/src/describe/resourceQuery.js";
import { parseDescribeResponse, pickLabel, pickTypes } from "../../packages/yasr/src/describe/describeParser.js";
import { DescribeHistory } from "../../packages/yasr/src/describe/describeHistory.js";
import {
  clampDockedWidth,
  clampFloatingRect,
  defaultFloatingRect,
  loadLayout,
  saveLayout,
  MIN_PANEL_WIDTH,
} from "../../packages/yasr/src/describe/describeLayout.js";

const expect = chai.expect;
const EX = "http://example.org/";

describe("Yasr describe panel", () => {
  describe("resource queries", () => {
    it("builds an outgoing CONSTRUCT query with a prefixed name", () => {
      const query = buildDescribeQuery(EX + "a", "outgoing", { ex: EX });
      expect(query).to.contain("PREFIX ex: <http://example.org/>");
      expect(query).to.contain("ex:a ?p ?o .");
      expect(query).not.to.contain("LIMIT");
    });

    it("builds a limited incoming query and falls back to a full IRI", () => {
      const query = buildDescribeQuery("http://other.org/x", "incoming", { ex: EX });
      expect(query).to.contain("?s ?p <http://other.org/x> .");
      expect(query).to.contain(`LIMIT ${INCOMING_TRIPLE_LIMIT}`);
    });

    it("escapes unsafe IRI characters and drops invalid prefixes", () => {
      expect(sanitizePrefixes({ ok: EX, "bad prefix": EX, evil: "http://x.org/>" })).to.deep.equal({ ok: EX });
      expect(buildDescribeQuery("http://x.org/a b", "outgoing")).to.contain("<http://x.org/a%20b>");
    });

    it("compacts with the longest namespace and refuses unsafe local names", () => {
      const prefixes = { ex: EX, exs: EX + "sub/" };
      expect(toPrefixedName(EX + "sub/thing", prefixes)).to.equal("exs:thing");
      expect(toPrefixedName(EX + "a(b)", prefixes)).to.equal(null);
    });

    it("normalises directions, accepting the table plugin's names", () => {
      expect(normalizeDirection(undefined)).to.equal("outgoing");
      expect(normalizeDirection("object")).to.equal("incoming");
      expect(normalizeDirection("incoming")).to.equal("incoming");
      expect(normalizeDirection("subject")).to.equal("outgoing");
    });

    it("derives a local name", () => {
      expect(localName("http://example.org/ns#Thing")).to.equal("Thing");
      expect(localName("http://example.org/a/b/")).to.equal("b");
    });
  });

  describe("response parsing", () => {
    const turtle = `@prefix ex: <${EX}> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
ex:a a ex:Type ;
  rdfs:label "Ah"@nl, "A"@en ;
  ex:count 3 ;
  ex:knows [ ex:p "q" ] .`;

    it("parses Turtle into triples with typed terms", async () => {
      const { triples, raw } = await parseDescribeResponse(turtle);
      expect(raw).to.equal(turtle);
      expect(triples).to.have.length(6);
      const count = triples.find((t) => t.predicate === EX + "count");
      expect(count?.object).to.deep.include({ type: "literal", value: "3" });
      const knows = triples.find((t) => t.predicate === EX + "knows");
      expect(knows?.object.type).to.equal("bnode");
      expect(knows?.object.value.startsWith("_:")).to.equal(true);
    });

    it("picks a label by language preference and the types", async () => {
      const { triples } = await parseDescribeResponse(turtle);
      expect(pickLabel(EX + "a", triples, ["en-GB"])).to.equal("A");
      expect(pickLabel(EX + "a", triples, ["nl"])).to.equal("Ah");
      expect(pickTypes(EX + "a", triples)).to.deep.equal([EX + "Type"]);
    });

    it("reads text from fetch-like and superagent-like responses", async () => {
      const fromFetch = await parseDescribeResponse({ text: async () => `<${EX}a> <${EX}p> "x" .` });
      expect(fromFetch.triples).to.have.length(1);
      const fromAgent = await parseDescribeResponse({ text: `<${EX}a> <${EX}p> "x" .` });
      expect(fromAgent.triples).to.have.length(1);
    });

    it("parses SPARQL JSON subject/predicate/object bindings", async () => {
      const json = JSON.stringify({
        results: {
          bindings: [
            {
              subject: { type: "uri", value: EX + "a" },
              predicate: { type: "uri", value: EX + "p" },
              object: { type: "literal", value: "v", "xml:lang": "en" },
            },
          ],
        },
      });
      const { triples } = await parseDescribeResponse(json);
      expect(triples[0].object).to.deep.include({ value: "v", lang: "en", type: "literal" });
    });

    it("keeps the raw text when nothing can be parsed", async () => {
      const result = await parseDescribeResponse("<html>oops</html>");
      expect(result.triples).to.have.length(0);
      expect(result.raw).to.equal("<html>oops</html>");
    });
  });

  describe("navigation history", () => {
    it("walks back and forward and drops forward entries on a new hop", () => {
      const history = new DescribeHistory();
      history.reset({ iri: "a", direction: "outgoing", source: "Table" });
      history.push({ iri: "b", direction: "outgoing" });
      history.push({ iri: "c", direction: "incoming" });
      expect(history.canGoForward()).to.equal(false);
      expect(history.go(-1)?.iri).to.equal("b");
      expect(history.canGoForward()).to.equal(true);
      history.push({ iri: "d", direction: "outgoing" });
      expect(history.getEntries().map((e) => e.iri)).to.deep.equal(["a", "b", "d"]);
      expect(history.goTo(0)?.source).to.equal("Table");
      expect(history.canGoBack()).to.equal(false);
      expect(history.go(-1)).to.equal(undefined);
    });

    it("does not push a duplicate of the current entry", () => {
      const history = new DescribeHistory();
      history.reset({ iri: "a", direction: "outgoing" });
      history.push({ iri: "a", direction: "outgoing" });
      expect(history.length).to.equal(1);
      history.push({ iri: "a", direction: "incoming" });
      expect(history.length).to.equal(2);
    });
  });

  describe("panel layout", () => {
    it("keeps the docked width between the minimum and what leaves the results visible", () => {
      expect(clampDockedWidth(100, 1200)).to.equal(MIN_PANEL_WIDTH);
      expect(clampDockedWidth(600, 1200)).to.equal(600);
      expect(clampDockedWidth(1100, 1200)).to.equal(960);
      expect(clampDockedWidth(500, 400)).to.equal(MIN_PANEL_WIDTH);
    });

    it("keeps a floating panel inside the window and grabbable", () => {
      const viewport = { width: 1000, height: 800 };
      expect(clampFloatingRect({ x: 5000, y: -50, width: 3000, height: 100 }, viewport)).to.deep.equal({
        x: 920,
        y: 0,
        width: 984,
        height: 240,
      });
      const first = defaultFloatingRect(viewport);
      expect(first.x + first.width).to.equal(976);
      expect(first.height).to.equal(560);
    });

    it("remembers the docked width and floating window, but not maximized", () => {
      const store: Record<string, string> = {};
      const storage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => (store[k] = v) };
      expect(loadLayout(storage)).to.deep.equal({ mode: "docked", width: 400 });
      saveLayout({ mode: "floating", width: 520, floating: { x: 10, y: 20, width: 500, height: 400 } }, storage);
      expect(loadLayout(storage)).to.deep.equal({
        mode: "floating",
        width: 520,
        floating: { x: 10, y: 20, width: 500, height: 400 },
      });
      store["yasr_describeLayout"] = '{"mode":"maximized","width":"wide","floating":{"x":1}}';
      expect(loadLayout(storage)).to.deep.equal({ mode: "docked", width: 400 });
      store["yasr_describeLayout"] = "not json";
      expect(loadLayout(storage)).to.deep.equal({ mode: "docked", width: 400 });
    });
  });
});
