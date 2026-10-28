import * as path from "path";
import * as http from "http";
import * as chai from "chai";
import * as puppeteer from "puppeteer";
import { it, describe, before, beforeEach, after, afterEach } from "mocha";
import { setup, destroy, closePage, getPage } from "./utils.js";

const expect = chai.expect;

describe("Help menu and What's new", function () {
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
    await page.reload({ waitUntil: "networkidle2" });
    await page.waitForSelector(".yasgui-helpButton");
  });

  afterEach(async () => {
    await closePage(this, page);
  });

  after(async function () {
    return destroy(browser, server);
  });

  it("doesn't badge the help button on a first visit", async function () {
    expect(await page.$(".yasgui-helpButton__badge")).to.equal(null);
    const seen = await page.evaluate(() => (window as any).yasgui.persistentConfig.getWhatsNewSeen());
    const latest = await page.evaluate(() => (window as any).yasgui.whatsNew.getLatestVersion());
    expect(seen).to.equal(latest);
  });

  it("badges the help button after an update, until What's new is opened", async function () {
    await page.evaluate(() => (window as any).yasgui.persistentConfig.setWhatsNewSeen("6.0.0"));
    await page.reload({ waitUntil: "networkidle2" });
    await page.waitForSelector(".yasgui-helpButton__badge");

    await page.click(".yasgui-helpButton");
    await page.waitForSelector(".yasgui-helpMenu:not([hidden])");
    const labels = await page.$$eval(".yasgui-helpMenu__item", (items) => items.map((el) => el.textContent?.trim()));
    expect(labels).to.include("What's new");
    expect(labels).to.include("Documentation");
    expect(labels.indexOf("What's new")).to.be.lessThan(labels.indexOf("Documentation"));

    const items = await page.$$(".yasgui-helpMenu__item");
    await items[labels.indexOf("What's new")].click();
    await page.waitForSelector(".yasgui-whatsNew:not([hidden])");
    expect(await page.$(".yasgui-helpButton__badge")).to.equal(null);

    const versions = await page.$$eval(".yasgui-whatsNew__release h3", (els) => els.map((el) => el.textContent));
    expect(versions).to.include("v6.0.0");
    expect(versions).to.include("v5.0.0");
    // Releases after the last seen one are marked
    const unseen = await page.$$eval(".yasgui-whatsNew__release", (sections) =>
      sections
        .filter((s) => s.querySelector(".yasgui-whatsNew__unseen"))
        .map((s) => s.querySelector("h3")?.textContent),
    );
    expect(unseen).to.not.include("v6.0.0");
    expect(unseen).to.include("v6.1.0");
  });

  it("filters the changes on New, Improved and Fixed", async function () {
    await page.evaluate(() => (window as any).yasgui.whatsNew.open());
    await page.waitForSelector(".yasgui-whatsNew:not([hidden])");
    await page.click('.yasgui-whatsNew__filters [data-filter="fixed"]');
    const kinds = await page.$$eval(".yasgui-whatsNew__kind", (els) => els.map((el) => el.textContent));
    expect(kinds.length).to.be.greaterThan(0);
    expect(kinds.every((kind) => kind === "Fixed")).to.equal(true);

    await page.keyboard.press("Escape");
    expect(await page.$eval(".yasgui-whatsNew", (el) => (el as HTMLElement).hidden)).to.equal(true);
  });
});
