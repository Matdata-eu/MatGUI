import * as path from "path";
import * as http from "http";
import * as chai from "chai";
import * as puppeteer from "puppeteer";
import { it, describe, before, beforeEach, after, afterEach } from "mocha";
import { setup, destroy, closePage, getPage } from "./utils.js";

const expect = chai.expect;

const ENDPOINT = "http://hover.test/sparql";
const QUERY = `PREFIX ex: <http://example.org/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT * WHERE {
  ?s ex:knows <http://example.org/Unknown> .
}`;

function binding(p: string, o: { type: string; value: string; "xml:lang"?: string }) {
  return { p: { type: "uri", value: p }, o };
}

const KNOWS_INFO = {
  head: { vars: ["p", "o"] },
  results: {
    bindings: [
      binding("http://www.w3.org/2000/01/rdf-schema#label", { type: "literal", value: "knows", "xml:lang": "en" }),
      binding("http://www.w3.org/2000/01/rdf-schema#label", { type: "literal", value: "kent", "xml:lang": "nl" }),
      binding("http://www.w3.org/2000/01/rdf-schema#comment", {
        type: "literal",
        value: "A person known by this person.",
        "xml:lang": "en",
      }),
      binding("http://www.w3.org/1999/02/22-rdf-syntax-ns#type", {
        type: "uri",
        value: "http://www.w3.org/1999/02/22-rdf-syntax-ns#Property",
      }),
      binding("http://www.w3.org/2000/01/rdf-schema#range", { type: "uri", value: "http://example.org/Person" }),
    ],
  },
};

async function mockEndpoint(page: puppeteer.Page, queries: string[]) {
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.host === "lov.linkeddata.es") {
      queries.push(`LOV ${url.searchParams.get("query")}`);
      void request.respond({
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
        contentType: "application/sparql-results+json",
        body: JSON.stringify({ head: { vars: ["p", "o"] }, results: { bindings: [] } }),
      });
      return;
    }
    if (url.host !== "hover.test") {
      void request.continue();
      return;
    }
    const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
    if (request.method() === "OPTIONS") {
      void request.respond({ status: 204, headers });
      return;
    }
    const params = new URLSearchParams(request.method() === "POST" ? request.postData() || "" : url.search);
    const query = params.get("query") || "";
    queries.push(query);
    const body = query.includes("<http://example.org/knows>")
      ? KNOWS_INFO
      : { head: { vars: ["p", "o"] }, results: { bindings: [] } };
    void request.respond({
      status: 200,
      headers,
      contentType: "application/sparql-results+json",
      body: JSON.stringify(body),
    });
  });
}

describe("IRI hover info", function () {
  let browser: puppeteer.Browser;
  let page: puppeteer.Page;
  let server: http.Server | undefined;
  let queries: string[];

  before(async function () {
    const refs = await setup(this, path.resolve("./build"));
    browser = refs.browser;
    server = refs.server;
  });

  beforeEach(async function () {
    this.timeout(30000);
    queries = [];
    page = await getPage(browser, "yasgui.html");
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "networkidle2" });
    await mockEndpoint(page, queries);
    await page.evaluate(
      (endpoint, query) => {
        const tab = (window as any).yasgui.getTab();
        tab.setEndpoint(endpoint);
        tab.getYasqe().setValue(query);
      },
      ENDPOINT,
      QUERY,
    );
  });

  afterEach(async () => {
    await closePage(this, page);
  });

  after(async function () {
    return destroy(browser, server);
  });

  /** Move the mouse onto the given text in the editor */
  async function hover(text: string) {
    const point = await page.evaluate((needle) => {
      const yasqe = (window as any).yasgui.getTab().getYasqe();
      const lines: string[] = yasqe.getValue().split("\n");
      const line = lines.findIndex((l) => l.includes(needle));
      const ch = lines[line].indexOf(needle) + Math.floor(needle.length / 2);
      const coords = yasqe.cursorCoords({ line, ch });
      return { x: coords.left + 2, y: (coords.top + coords.bottom) / 2 };
    }, text);
    await page.mouse.move(0, 0);
    await page.mouse.move(point.x, point.y);
  }

  it("shows the label, description and type of a prefixed name", async function () {
    await hover("ex:knows");
    await page.waitForSelector(".yasqe_iriHover .yasgui-iriHover__label", { visible: true, timeout: 5000 });
    const tooltip = await page.$eval(".yasqe_iriHover", (el) => el.textContent || "");
    expect(tooltip).to.contain("knows");
    expect(tooltip).to.contain("http://example.org/knows");
    expect(tooltip).to.contain("A person known by this person.");
    expect(tooltip).to.match(/rdf:Property|22-rdf-syntax-ns#Property/);
    expect(tooltip).to.contain("ex:Person");
    expect(tooltip).to.contain("Ctrl+click");
  });

  it("caches the information per endpoint and IRI", async function () {
    await hover("ex:knows");
    await page.waitForSelector(".yasqe_iriHover .yasgui-iriHover__label", { visible: true });
    await hover("?s");
    await page.waitForSelector(".yasqe_iriHover", { hidden: true });
    await hover("ex:knows");
    await page.waitForSelector(".yasqe_iriHover .yasgui-iriHover__label", { visible: true });
    expect(queries.filter((q) => q.includes("<http://example.org/knows>"))).to.have.length(1);
  });

  it("says when nothing is known and tries LOV", async function () {
    await hover("Unknown");
    await page.waitForFunction(
      () => document.querySelector(".yasqe_iriHover")?.textContent?.includes("No label, description or type"),
      { timeout: 5000 },
    );
    expect(queries.some((q) => q.startsWith("LOV") && q.includes("GRAPH ?g"))).to.equal(true);
  });

  it("shows nothing for variables", async function () {
    await hover("?s");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(await page.$(".yasqe_iriHover")).to.equal(null);
    expect(queries).to.have.length(0);
  });

  it("can be switched off in the settings", async function () {
    await page.evaluate(() => (window as any).yasgui.persistentConfig.setIriHoverEnabled(false));
    await hover("ex:knows");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(await page.$(".yasqe_iriHover")).to.equal(null);
    expect(queries).to.have.length(0);
  });
  it("finds IRIs, prefixed names and nothing else in the query", async function () {
    const found = await page.evaluate(() => {
      const yasqe = (window as any).yasgui.getTab().getYasqe();
      yasqe.setValue('PREFIX : <http://default.org/>\nSELECT * WHERE { _:b :p "ex:x", <http://a.org/b>, und:x }');
      const line = yasqe.getDoc().getLine(1);
      const at = (needle: string) => yasqe.getIriAt({ line: 1, ch: line.indexOf(needle) + 1 })?.iri ?? null;
      return {
        blank: at("_:b"),
        emptyPrefix: at(":p"),
        literal: at('"ex:x"'),
        full: at("<http://a.org/b>"),
        undeclared: yasqe.getIriAt({ line: 1, ch: line.indexOf("und:x") + 5 }),
        keyword: at("WHERE"),
      };
    });
    expect(found.blank).to.equal(null);
    expect(found.emptyPrefix).to.equal("http://default.org/p");
    expect(found.literal).to.equal(null);
    expect(found.full).to.equal("http://a.org/b");
    expect(found.undeclared).to.include({ iri: "und:x", expanded: false });
    expect(found.keyword).to.equal(null);
  });

  it("still runs the subject query on Ctrl+click", async function () {
    await hover("ex:knows");
    await page.keyboard.down("Control");
    await page.mouse.down();
    await page.mouse.up();
    await page.keyboard.up("Control");
    const start = Date.now();
    while (!queries.some((q) => q.includes("CONSTRUCT")) && Date.now() - start < 5000) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(queries.find((q) => q.includes("CONSTRUCT"))).to.contain("<http://example.org/knows>");
  });
});
