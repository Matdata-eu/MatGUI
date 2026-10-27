import * as path from "path";
import * as http from "http";
import * as chai from "chai";
import * as puppeteer from "puppeteer";
import { it, describe, before, beforeEach, after, afterEach } from "mocha";
import { setup, destroy, closePage, getPage } from "./utils.js";

const expect = chai.expect;

const ENDPOINT = "http://anything.test/sparql.anything";
const FX = "http://sparql.xyz/facade-x/ns/";
const XYZ = "http://sparql.xyz/facade-x/data/";
const SLOT = "urn:matgui:sparql-anything:slot";
const QUERY = `PREFIX fx: <http://sparql.xyz/facade-x/ns/>
PREFIX xyz: <http://sparql.xyz/facade-x/data/>
SELECT * WHERE {
  SERVICE <x-sparql-anything:location=http://files/people.csv,csv.headers=true> {
    ?row xyz:name ?name .
  }
}`;

const uri = (value: string) => ({ type: "uri", value });
const lit = (value: string | number) => ({ type: "literal", value: String(value) });

// What SPARQL Anything answers to the structure query for a CSV with the columns name, email and city
const STRUCTURE = {
  head: { vars: ["gstep", "ptype", "pstep", "type", "step", "kind", "n", "subjects", "example"] },
  results: {
    bindings: [
      { type: uri(FX + "root"), step: uri(SLOT), kind: lit("node"), n: lit(3), subjects: lit(1) },
      ...[
        ["name", "Laura Grey"],
        ["email", "laura@example.org"],
        ["city", "Ghent"],
      ].map(([column, example]) => ({
        ptype: uri(FX + "root"),
        pstep: uri(SLOT),
        step: uri(XYZ + column),
        kind: lit("literal"),
        n: lit(3),
        subjects: lit(3),
        example: lit(example),
      })),
    ],
  },
};

const TURTLE = `@prefix fx: <${FX}> .
@prefix xyz: <${XYZ}> .
[ a fx:root ; <http://www.w3.org/1999/02/22-rdf-syntax-ns#_1> [ xyz:name "Laura Grey" ; xyz:email "laura@example.org" ] ] .
`;

async function mockEndpoint(page: puppeteer.Page, queries: string[]) {
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.host !== "anything.test") {
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
    if (query.includes("CONSTRUCT")) {
      void request.respond({ status: 200, headers, contentType: "text/turtle", body: TURTLE });
      return;
    }
    const body = query.includes("GROUP BY ?gstep") ? STRUCTURE : { head: { vars: ["s"] }, results: { bindings: [] } };
    void request.respond({
      status: 200,
      headers,
      contentType: "application/sparql-results+json",
      body: JSON.stringify(body),
    });
  });
}

describe("SPARQL Anything", function () {
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

  const sourceQueries = () => queries.filter((q) => q.includes("x-sparql-anything"));

  async function loadStructure() {
    await page.waitForSelector(".yasgui-saChip .yasgui-saChip__action", { visible: true });
    await page.click(".yasgui-saChip .yasgui-saChip__action");
    await page.waitForSelector(".yasgui-saChip.loaded", { visible: true, timeout: 5000 });
  }

  it("shows a chip on the block and sends nothing until asked", async function () {
    await page.waitForSelector(".yasgui-saChip", { visible: true });
    const chip = await page.$eval(".yasgui-saChip", (el) => el.textContent || "");
    expect(chip).to.contain("people.csv");
    expect(chip).to.contain("Load structure");
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(sourceQueries()).to.have.length(0);
    // The Source view is listed while the query has a SPARQL Anything block
    expect(await page.$eval(".yasgui-sidePanel__tab[data-view='source']", (el) => (el as HTMLElement).hidden)).to.equal(
      false,
    );
  });

  it("loads the structure with the user's SERVICE IRI", async function () {
    await loadStructure();
    const chip = await page.$eval(".yasgui-saChip", (el) => el.textContent || "");
    expect(chip).to.contain("3 properties");
    expect(chip).to.contain("Inspect");
    expect(sourceQueries()).to.have.length(1);
    expect(sourceQueries()[0]).to.contain(
      "SERVICE <x-sparql-anything:location=http://files/people.csv,csv.headers=true>",
    );
  });

  it("opens the Source view when loading the structure", async function () {
    await page.evaluate(() => (window as any).yasgui.sidePanel.close());
    await loadStructure();
    const panel = await page.evaluate(() => {
      const sidePanel = (window as any).yasgui.sidePanel;
      return { open: sidePanel.isOpen(), view: sidePanel.getView() };
    });
    expect(panel).to.deep.equal({ open: true, view: "source" });
  });

  it("selects all values in the query builder", async function () {
    await loadStructure();
    await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>(".yasgui-sa__tab"))
        .find((b) => b.textContent === "Build query")
        ?.click(),
    );
    await page.waitForSelector(".yasgui-sa__all input", { visible: true });
    // The actions are above the tree and wait for a selection
    expect(
      await page.$eval(".yasgui-sa__section", (section) => {
        const actions = section.querySelector(".yasgui-sa__buildbar")!;
        const tree = section.querySelector(".yasgui-sa__tree")!;
        return !!(actions.compareDocumentPosition(tree) & Node.DOCUMENT_POSITION_FOLLOWING);
      }),
    ).to.equal(true);
    expect(await page.$eval(".yasgui-sa__buildbar .primary", (b) => (b as HTMLButtonElement).disabled)).to.equal(true);

    // The view redraws often, so click the current checkbox rather than a handle to it
    await page.evaluate(() => document.querySelector<HTMLInputElement>(".yasgui-sa__all input")?.click());
    const checked = await page.$$eval(".yasgui-sa__node .yasgui-sa__check", (boxes) =>
      boxes.map((b) => (b as HTMLInputElement).checked),
    );
    expect(checked.length).to.be.greaterThan(1);
    expect(checked.every(Boolean)).to.equal(true);
    expect(await page.$eval(".yasgui-sa__allCount", (el) => el.textContent)).to.equal(
      `${checked.length}/${checked.length}`,
    );
    const code = await page.$eval(".yasgui-sa__code", (el) => el.textContent || "");
    expect(code).to.contain("xyz:email");
    expect(code).to.contain("xyz:name");

    // Unticking clears the selection
    // The view redraws often, so click the current checkbox rather than a handle to it
    await page.evaluate(() => document.querySelector<HTMLInputElement>(".yasgui-sa__all input")?.click());
    expect(await page.$$eval(".yasgui-sa__node .yasgui-sa__check:checked", (boxes) => boxes.length)).to.equal(0);
  });

  it("suggests the columns in autocompletion", async function () {
    await loadStructure();
    await page.evaluate(() => {
      const yasqe = (window as any).yasgui.getTab().getYasqe();
      const line = yasqe
        .getValue()
        .split("\n")
        .findIndex((l: string) => l.includes("?row xyz:name"));
      yasqe.getDoc().replaceRange("    ?row xyz:em", { line, ch: 0 }, { line, ch: 999 });
      yasqe.focus();
      yasqe.getDoc().setCursor({ line, ch: 15 });
      yasqe.autocomplete();
    });
    await page.waitForSelector(".CodeMirror-hints", { visible: true, timeout: 5000 });
    const hints = await page.$eval(".CodeMirror-hints", (el) => el.textContent || "");
    expect(hints).to.contain("From people.csv");
    expect(hints).to.contain("xyz:email");
  });

  it("shows the structure, the preview, and builds a query", async function () {
    await loadStructure();
    await page.click(".yasgui-saChip .yasgui-saChip__action");
    await page.waitForSelector(".yasgui-sa__tree", { visible: true });
    const tree = await page.$eval(".yasgui-sa__tree", (el) => el.textContent || "");
    expect(tree).to.contain("fx:root");
    expect(tree).to.contain("rows");
    expect(tree).to.contain("xyz:email");

    // Preview
    await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>(".yasgui-sa__tab"))
        .find((b) => b.textContent === "Preview")
        ?.click(),
    );
    await page.waitForSelector(".yasgui-sa__code", { visible: true, timeout: 5000 });
    expect(await page.$eval(".yasgui-sa__code", (el) => el.textContent || "")).to.contain("laura@example.org");
    expect(queries.some((q) => q.includes("CONSTRUCT") && q.includes("LIMIT 100"))).to.equal(true);

    // Build query: tick email and replace the block
    await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>(".yasgui-sa__tab"))
        .find((b) => b.textContent === "Build query")
        ?.click(),
    );
    await page.waitForSelector(".yasgui-sa__check", { visible: true });
    await page.evaluate(() => {
      const row = Array.from(document.querySelectorAll<HTMLElement>(".yasgui-sa__node")).find((r) =>
        r.textContent?.includes("xyz:email"),
      );
      row?.querySelector<HTMLInputElement>(".yasgui-sa__check")?.click();
    });
    await page.waitForSelector(".yasgui-sa__buildbar .primary", { visible: true });
    await page.click(".yasgui-sa__buildbar .primary");
    const value = await page.evaluate(() => (window as any).yasgui.getTab().getYasqe().getValue());
    expect(value).to.contain("?root fx:anySlot ?row .");
    expect(value).to.contain("?row xyz:email ?email .");
    expect(value).to.not.contain("?row xyz:name ?name");
  });

  it("hides the Source view for other queries", async function () {
    await page.evaluate(() => (window as any).yasgui.getTab().getYasqe().setValue("SELECT * WHERE { ?s ?p ?o }"));
    await page.waitForFunction(
      () => (document.querySelector(".yasgui-sidePanel__tab[data-view='source']") as HTMLElement | null)?.hidden,
      { timeout: 5000 },
    );
    expect(await page.$(".yasgui-saChip")).to.equal(null);
  });
});
