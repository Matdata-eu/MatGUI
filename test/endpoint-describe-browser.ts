import * as path from "path";
import * as http from "http";
import * as chai from "chai";
import * as puppeteer from "puppeteer";
import { it, describe, before, beforeEach, after, afterEach } from "mocha";
import { setup, destroy, closePage, getPage } from "./utils.js";

const expect = chai.expect;

const ENDPOINT = "http://describe.test/sparql";
const OTHER_ENDPOINT = "http://other.test/sparql";

const SD_TURTLE = `
@prefix sd: <http://www.w3.org/ns/sparql-service-description#> .
@prefix void: <http://rdfs.org/ns/void#> .
<${ENDPOINT}#service> a sd:Service ;
  sd:endpoint <${ENDPOINT}> ;
  sd:supportedLanguage sd:SPARQL11Query ;
  sd:defaultDataset <${ENDPOINT}#dataset> .
<${ENDPOINT}#dataset> a void:Dataset ; void:triples 4242 .
`;

function sparqlJson(vars: string[], rows: string[][]) {
  return JSON.stringify({
    head: { vars },
    results: {
      bindings: rows.map((row) =>
        Object.fromEntries(
          row.map((value, i) => [
            vars[i],
            value.startsWith("http") ? { type: "uri", value } : { type: "literal", value },
          ]),
        ),
      ),
    },
  });
}

/**
 * Serve a fake SPARQL endpoint through request interception
 */
async function mockEndpoints(page: puppeteer.Page, queries: string[]) {
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.host !== "describe.test" && url.host !== "other.test") {
      void request.continue();
      return;
    }
    const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
    if (request.method() === "OPTIONS") {
      void request.respond({ status: 204, headers });
      return;
    }
    const params = new URLSearchParams(request.method() === "POST" ? request.postData() || "" : url.search);
    const query = params.get("query");
    if (!query) {
      if (url.pathname === "/sparql" && url.host === "describe.test") {
        void request.respond({ status: 200, headers, contentType: "text/turtle", body: SD_TURTLE });
      } else {
        void request.respond({ status: 404, headers, contentType: "text/plain", body: "Not found" });
      }
      return;
    }
    queries.push(query);
    let body = sparqlJson(["s"], [["http://example.org/main-result"]]);
    if (/\?instance a \?class/.test(query)) {
      body = sparqlJson(
        ["class", "instances"],
        [
          ["http://xmlns.com/foaf/0.1/Person", "12345"],
          ["http://example.org/Thing", "3"],
        ],
      );
    }
    void request.respond({ status: 200, headers, contentType: "application/sparql-results+json", body });
  });
}

async function waitUntil(condition: () => boolean, timeout = 5000) {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > timeout) throw new Error("Timed out waiting for condition");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

describe("Endpoint describe panel", function () {
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
    await mockEndpoints(page, queries);
    await page.evaluate((endpoint) => (window as any).yasgui.getTab().setEndpoint(endpoint), ENDPOINT);
  });

  afterEach(async () => {
    await closePage(this, page);
  });

  after(async function () {
    return destroy(browser, server);
  });

  async function openPanel() {
    await page.click(".tabPanel.active .describeEndpointButton");
    await page.waitForSelector(".yasgui-describe.open .yasgui-describe__drawer", { visible: true });
  }

  async function runClasses() {
    await page.click('.yasgui-describe__query[data-query-id="classes"] .yasgui-describe__icon-button');
    await page.waitForSelector('.yasgui-describe__query[data-query-id="classes"] table');
  }

  it("shows the service description and VoID statistics", async function () {
    await openPanel();
    await page.waitForFunction(
      () =>
        document.querySelector(".yasgui-describe__metadata")?.textContent?.includes("Service description: available"),
      { timeout: 10000 },
    );
    const text = await page.$eval(".yasgui-describe__metadata", (el) => el.textContent || "");
    expect(text).to.contain("4,242");
    expect(await page.$eval(".yasgui-describe__endpoint", (el) => el.textContent)).to.equal(ENDPOINT);
  });

  it("keeps results when a regular query is executed", async function () {
    await openPanel();
    await runClasses();
    const table = await page.$eval('.yasgui-describe__query[data-query-id="classes"] table', (el) => el.textContent);
    expect(table).to.contain("foaf:Person");
    expect(table).to.contain("12,345");
    // The editor isn't touched by describe queries
    const editorValue = await page.evaluate(() => (window as any).yasgui.getTab().getQuery());
    expect(editorValue).not.to.contain("?instance a ?class");

    await page.evaluate(() => (window as any).yasgui.getTab().query());
    await waitUntil(() => queries.length >= 2);
    expect(await page.$('.yasgui-describe__query[data-query-id="classes"] table')).to.not.equal(null);
  });

  it("inserts a prefixed IRI into the query when clicked", async function () {
    await openPanel();
    await runClasses();
    await page.evaluate(() => (window as any).yasgui.getTab().setQuery("SELECT * WHERE { ?s a  }"));
    await page.click('.yasgui-describe__query[data-query-id="classes"] .yasgui-describe__iri');
    const value = await page.evaluate(() => (window as any).yasgui.getTab().getQuery());
    expect(value).to.contain("PREFIX foaf: <http://xmlns.com/foaf/0.1/>");
    expect(value).to.contain("foaf:Person");
  });

  it("follows the endpoint of the active tab", async function () {
    await openPanel();
    await runClasses();
    await page.evaluate((endpoint) => (window as any).yasgui.getTab().setEndpoint(endpoint), OTHER_ENDPOINT);
    await page.waitForFunction(
      (endpoint) => document.querySelector(".yasgui-describe__endpoint")?.textContent === endpoint,
      {},
      OTHER_ENDPOINT,
    );
    // No results cached for the other endpoint
    expect(await page.$('.yasgui-describe__query[data-query-id="classes"] table')).to.equal(null);
    // Switching back shows the cached results again
    await page.evaluate((endpoint) => (window as any).yasgui.getTab().setEndpoint(endpoint), ENDPOINT);
    await page.waitForSelector('.yasgui-describe__query[data-query-id="classes"] table');
  });

  it("restores a pinned panel and its results after a reload", async function () {
    await openPanel();
    await runClasses();
    await page.click(".yasgui-describe__pin");
    await page.reload({ waitUntil: "networkidle2" });
    await page.waitForSelector(".yasgui-describe.open.pinned .yasgui-describe__drawer", { visible: true });
    await page.waitForSelector('.yasgui-describe__query[data-query-id="classes"] table');
  });

  it("collapses an unpinned panel when the editor gets focus", async function () {
    await openPanel();
    await page.click(".tabPanel.active .yasqe .cm-content");
    await page.waitForSelector(".yasgui-describe.collapsed .yasgui-describe__rail", { visible: true });
    await page.click(".yasgui-describe__rail");
    await page.waitForSelector(".yasgui-describe:not(.collapsed) .yasgui-describe__drawer", { visible: true });
  });
});
