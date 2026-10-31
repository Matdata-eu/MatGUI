import * as path from "path";
import * as http from "http";
import * as chai from "chai";
import * as puppeteer from "puppeteer";
import { it, describe, before, beforeEach, after, afterEach } from "mocha";
import { setup, destroy, closePage, getPage, TEST_ORIGIN } from "./utils.js";

const expect = chai.expect;

// Requests to this endpoint get a 404 from the test server; we only count them
const ENDPOINT = `${TEST_ORIGIN}/share-link-endpoint`;

function linkHash(params: { [key: string]: string }) {
  return "#" + new URLSearchParams(params).toString();
}

describe("Share links", function () {
  let browser: puppeteer.Browser;
  let page: puppeteer.Page;
  let server: http.Server | undefined;
  let endpointRequests: number;

  before(async function () {
    const refs = await setup(this, path.resolve("./build"));
    browser = refs.browser;
    server = refs.server;
  });

  beforeEach(async function () {
    this.timeout(30000);
    page = await getPage(browser, "yasgui.html");
    await page.evaluate(() => localStorage.clear());
    endpointRequests = 0;
    page.on("request", (request) => {
      if (request.url().startsWith(ENDPOINT)) endpointRequests++;
    });
  });

  afterEach(async () => {
    await closePage(this, page);
  });

  after(async function () {
    return destroy(browser, server);
  });

  async function open(params: { [key: string]: string }) {
    // Through a blank page, so the link loads as a new document rather than as a hash change
    await page.goto("about:blank");
    await page.goto(`${TEST_ORIGIN}/yasgui.html?noExternalServices=true${linkHash(params)}`, {
      waitUntil: "networkidle2",
    });
    await page.waitForFunction(() => "yasgui" in window);
    // Give a query that would run on load the time to start
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  it("runs a read query without credentials", async function () {
    await open({ query: "SELECT * WHERE { ?s ?p ?o } LIMIT 1", endpoint: ENDPOINT });
    expect(endpointRequests).to.be.greaterThan(0);
    expect(await page.$(".yasgui-toast")).to.equal(null);
  });

  it("never runs an update query", async function () {
    await open({ query: "INSERT DATA { <http://a> <http://b> <http://c> }", endpoint: ENDPOINT });
    expect(endpointRequests).to.equal(0);
    const toast = await page.$eval(".yasgui-toast", (el) => el.textContent || "");
    expect(toast).to.contain("update query");
    // The query is loaded for review
    const value = await page.evaluate(() => (window as any).yasgui.getTab().getQuery());
    expect(value).to.contain("INSERT DATA");
  });

  it("asks before running a query that would send saved credentials", async function () {
    await page.evaluate((endpoint) => {
      (window as any).yasgui.persistentConfig.addOrUpdateEndpoint(endpoint, {
        authentication: { type: "basic", username: "u", password: "p" },
      });
    }, ENDPOINT);
    await open({ query: "SELECT * WHERE { ?s ?p ?o } LIMIT 1", endpoint: ENDPOINT });
    expect(endpointRequests).to.equal(0);
    const toast = await page.$eval(".yasgui-toast", (el) => el.textContent || "");
    expect(toast).to.contain("saved credentials");
    await page.click(".yasgui-toast__action");
    await page.waitForFunction(() => !document.querySelector(".yasgui-toast"));
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(endpointRequests).to.be.greaterThan(0);
  });

  it("loads a link with malformed JSON parameters", async function () {
    await open({ query: "SELECT * WHERE { ?s ?p ?o } LIMIT 1", endpoint: ENDPOINT, headers: '{"X-Broken":' });
    const value = await page.evaluate(() => (window as any).yasgui.getTab().getQuery());
    expect(value).to.contain("SELECT");
  });
});

describe("In-app dialogs", function () {
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
  });

  afterEach(async () => {
    await closePage(this, page);
  });

  after(async function () {
    return destroy(browser, server);
  });

  it("resolves a confirm with the button that was clicked, and false on Escape", async function () {
    await page.evaluate(() => {
      (window as any).confirmResult = (window as any).Yasgui.dialogs.showConfirm("Delete it?", {
        title: "Delete",
        confirmLabel: "Delete",
        danger: true,
      });
    });
    await page.waitForSelector(".yasgui-dialog [role=alertdialog]");
    // The confirm button has focus
    const focused = await page.evaluate(() => document.activeElement?.textContent);
    expect(focused).to.equal("Delete");
    await page.click(".yasgui-dialog__button--danger");
    expect(await page.evaluate(() => (window as any).confirmResult)).to.equal(true);
    expect(await page.$(".yasgui-dialog")).to.equal(null);

    await page.evaluate(() => {
      (window as any).confirmResult = (window as any).Yasgui.dialogs.showConfirm("Delete it?");
    });
    await page.waitForSelector(".yasgui-dialog");
    await page.keyboard.press("Escape");
    expect(await page.evaluate(() => (window as any).confirmResult)).to.equal(false);
  });

  it("closes a tab holding unsaved saved-query changes only after the choice", async function () {
    const tabCount = () => page.evaluate(() => (window as any).yasgui.persistentConfig.getTabs().length);
    const before = await tabCount();
    await page.evaluate(() => {
      const tab = (window as any).yasgui.getTab();
      tab.isManagedQueryTab = () => true;
      tab.hasUnsavedManagedChanges = () => true;
      tab.close();
    });
    await page.waitForSelector(".yasgui-dialog");
    expect(await tabCount()).to.equal(before);
    await page.keyboard.press("Escape");
    expect(await tabCount()).to.equal(before);
  });
});
