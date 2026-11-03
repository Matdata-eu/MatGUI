import * as path from "path";
import * as http from "http";
import * as chai from "chai";
import * as puppeteer from "puppeteer";
import { it, describe, before, beforeEach, after, afterEach } from "mocha";
import { setup, destroy, closePage, getPage, TEST_ORIGIN } from "./utils.js";

const expect = chai.expect;

// Served by request interception below, as a static web server on another origin would
const PUBLISHED = "https://queries.test/demo";
const MANIFEST_URL = `${PUBLISHED}/workspace.json`;
const FILES: { [url: string]: string } = {
  [MANIFEST_URL]: JSON.stringify({
    label: "Published queries",
    description: "Example queries served as plain files",
    endpoints: { demo: `${TEST_ORIGIN}/web-workspace-endpoint` },
    folders: { basics: { label: "Basics", endpoint: "demo" } },
    queries: ["basics/hello.rq", { url: "count.rq", name: "Count everything" }],
  }),
  [`${PUBLISHED}/basics/hello.rq`]: "#+ name: Hello world\n#+ description: Says hello\nSELECT ('hello' AS ?x) {}\n",
  [`${PUBLISHED}/count.rq`]: "SELECT (COUNT(*) AS ?n) WHERE { ?s ?p ?o }\n",
};

describe("Web workspaces", function () {
  let browser: puppeteer.Browser;
  let page: puppeteer.Page;
  let server: http.Server | undefined;

  before(async function () {
    const refs = await setup(this, path.resolve("./build"));
    browser = refs.browser;
    server = refs.server;
  });

  beforeEach(async function () {
    this.timeout(30000);
    page = await getPage(browser, "yasgui.html");
    await page.evaluate(() => localStorage.clear());
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const url = request.url();
      if (!url.startsWith(PUBLISHED)) {
        void request.continue();
        return;
      }
      const body = FILES[url];
      void request.respond({
        status: body === undefined ? 404 : 200,
        headers: { "Access-Control-Allow-Origin": "*" },
        contentType: url.endsWith(".json") ? "application/json" : "application/sparql-query",
        body: body ?? "not found",
      });
    });
  });

  afterEach(async () => {
    await closePage(this, page);
  });

  after(async function () {
    return destroy(browser, server);
  });

  async function openWithLink() {
    await page.goto("about:blank");
    await page.goto(
      `${TEST_ORIGIN}/yasgui.html?noExternalServices=true&workspace=${encodeURIComponent(MANIFEST_URL)}`,
      { waitUntil: "networkidle2" },
    );
    await page.waitForFunction(() => "yasgui" in window);
  }

  function workspaces() {
    return page.evaluate(() => (window as any).yasgui.persistentConfig.getWorkspaces());
  }

  it("adds a workspace from a link after the user confirms, and opens its queries", async function () {
    await openWithLink();
    await page.waitForSelector(".yasgui-dialog__message");
    const message = await page.$eval(".yasgui-dialog__message", (el) => el.textContent);
    expect(message).to.contain('"Published queries" (2 queries)');
    expect(message).to.contain(MANIFEST_URL);
    // The parameter is gone, so a reload doesn't ask again
    expect(page.url()).to.not.contain("workspace=");

    await page.click(".yasgui-dialog__button--primary");
    await page.waitForFunction(() => (window as any).yasgui.persistentConfig.getWorkspaces().length === 1);
    const [workspace] = await workspaces();
    expect(workspace).to.include({
      type: "http",
      label: "Published queries",
      manifestUrl: MANIFEST_URL,
      readOnly: true,
    });

    // The query browser shows it
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll(".yasgui-query-browser__tree-label")).some(
        (el) => el.textContent === "Count everything",
      ),
    );
    const labels = await page.$$eval(".yasgui-query-browser__tree-label", (els) => els.map((el) => el.textContent));
    expect(labels).to.include.members(["Basics", "Count everything"]);

    // Opening a query: header stripped, folder endpoint applied, read-only
    // No async functions inside evaluate: the test build would transpile them into helpers the page lacks
    const opened = await page.evaluate((id) => {
      const yasgui = (window as any).yasgui;
      return yasgui.queryBrowser.openQuery(id, "basics/hello.rq", "Hello world").then(() => {
        const tab = yasgui.getTab();
        return {
          query: tab.getQuery(),
          endpoint: tab.getEndpoint(),
          name: tab.getName(),
          meta: tab.getManagedQueryMetadata(),
          crumbs: tab.getBreadcrumbs(),
        };
      });
    }, workspace.id);
    expect(opened.query).to.equal("SELECT ('hello' AS ?x) {}\n");
    expect(opened.endpoint).to.equal(`${TEST_ORIGIN}/web-workspace-endpoint`);
    expect(opened.name).to.equal("Hello world");
    expect(opened.meta).to.deep.include({ backendType: "http", queryRef: { path: "basics/hello.rq" } });
    expect(opened.crumbs).to.deep.equal(["Published queries", "basics"]);

    // Opening the same link again shows the workspace without asking
    await openWithLink();
    await new Promise((resolve) => setTimeout(resolve, 800));
    expect(await page.$(".yasgui-dialog__message")).to.equal(null);
    expect(await workspaces()).to.have.length(1);
  });

  it("adds nothing when the user declines or the workspace cannot be loaded", async function () {
    await openWithLink();
    await page.waitForSelector(".yasgui-dialog__message");
    await page.click(".yasgui-dialog__button--secondary");
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(await workspaces()).to.have.length(0);

    await page.evaluate((url) => {
      (window as any).addResult = (window as any).yasgui.addWebWorkspace(url);
    }, `${PUBLISHED}/missing/workspace.json`);
    await page.waitForSelector(".yasgui-dialog__message");
    const message = await page.$eval(".yasgui-dialog__message", (el) => el.textContent);
    await page.click(".yasgui-dialog__button--primary");
    const result = { message, id: await page.evaluate(() => (window as any).addResult) };
    expect(result.message).to.contain("could not be loaded");
    expect(result.id).to.equal(undefined);
    expect(await workspaces()).to.have.length(0);
  });
});
