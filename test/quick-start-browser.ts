import * as path from "path";
import * as http from "http";
import * as chai from "chai";
import * as puppeteer from "puppeteer";
import { it, describe, before, beforeEach, after, afterEach } from "mocha";
import { setup, destroy, closePage, getPage, wait } from "./utils.js";

const expect = chai.expect;

describe("Quick start tour", function () {
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
    page = await getPage(browser, "yasgui.html", { quickStart: true });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "networkidle2" });
    await page.waitForFunction(() => "yasgui" in window);
  });

  afterEach(async () => {
    await closePage(this, page);
  });

  after(async function () {
    return destroy(browser, server);
  });

  const visibleTour = () =>
    page.evaluate(() => {
      const overlay = document.querySelector<HTMLElement>(".yasgui-quickStart");
      return !!overlay && !overlay.hidden;
    });
  const currentPage = () =>
    page.evaluate(() => ({
      title: document.querySelector(".yasgui-quickStart__title")?.textContent,
      eyebrow: document.querySelector(".yasgui-quickStart__eyebrow")?.textContent,
      items: document.querySelectorAll(".yasgui-quickStart__item").length,
      illustrations: document.querySelectorAll(".yasgui-quickStart__illustration svg").length,
    }));

  it("opens on the first visit and walks through five pages of three items", async function () {
    await page.waitForSelector(".yasgui-quickStart:not([hidden])", { visible: true });
    const titles: string[] = [];
    for (let i = 0; i < 5; i++) {
      const state = await currentPage();
      expect(state.eyebrow).to.equal(`How MatGUI works · ${i + 1} of 5`);
      expect(state.items).to.equal(3);
      expect(state.illustrations).to.equal(3);
      titles.push(state.title as string);
      await page.click(".yasgui-quickStart__next");
    }
    expect(titles[0]).to.equal("Write and run a query");
    expect(new Set(titles).size).to.equal(5);
    // "Start querying" on the last page closes the tour
    expect(await visibleTour()).to.equal(false);
  });

  it("goes back, jumps with the dots and the arrow keys, and closes with Escape", async function () {
    await page.waitForSelector(".yasgui-quickStart:not([hidden])", { visible: true });
    await page.click(".yasgui-quickStart__next");
    await page.click(".yasgui-quickStart__back");
    expect((await currentPage()).eyebrow).to.contain("1 of 5");
    await page.click(".yasgui-quickStart__dot:nth-child(4)");
    expect((await currentPage()).eyebrow).to.contain("4 of 5");
    await page.keyboard.press("ArrowRight");
    expect((await currentPage()).eyebrow).to.contain("5 of 5");
    await page.keyboard.press("ArrowLeft");
    expect((await currentPage()).eyebrow).to.contain("4 of 5");
    await page.keyboard.press("Escape");
    expect(await visibleTour()).to.equal(false);
  });

  it("links to the user guide", async function () {
    await page.waitForSelector(".yasgui-quickStart:not([hidden])", { visible: true });
    const link = await page.evaluate(() => {
      const a = document.querySelector<HTMLAnchorElement>(".yasgui-quickStart__guide");
      return { href: a?.href, target: a?.target, helpUrl: (window as any).yasgui.config.helpUrl };
    });
    expect(link.href).to.equal(link.helpUrl);
    expect(link.target).to.equal("_blank");
  });

  it("does not open again once seen, but stays in the help menu", async function () {
    await page.waitForSelector(".yasgui-quickStart:not([hidden])", { visible: true });
    await page.click(".yasgui-quickStart__close");
    await page.reload({ waitUntil: "networkidle2" });
    await wait(500);
    expect(await visibleTour()).to.equal(false);

    await page.click(".yasgui-helpButton");
    const labels = await page.$$eval(".yasgui-helpMenu__item", (items) => items.map((i) => i.textContent?.trim()));
    expect(labels[0]).to.equal("How MatGUI works");
    expect(labels[labels.length - 1]).to.equal("Documentation");
    await page.click(".yasgui-helpMenu__item");
    await page.waitForSelector(".yasgui-quickStart:not([hidden])", { visible: true });
    expect((await currentPage()).eyebrow).to.contain("1 of 5");
  });

  it("can be left out with showQuickStart: false", async function () {
    await page.evaluate(() => {
      localStorage.clear();
      const Yasgui = (window as any).Yasgui;
      const div = document.createElement("div");
      document.body.appendChild(div);
      (window as any).other = new Yasgui(div, { showQuickStart: false, persistenceId: "noQuickStart" });
    });
    await wait(600);
    const result = await page.evaluate(() => {
      const other = (window as any).other;
      return {
        tour: !!other.rootEl.querySelector(".yasgui-quickStart"),
        quickStart: other.quickStart,
        items: other.helpMenu.getItems().map((item: any) => item.id),
      };
    });
    expect(result.tour).to.equal(false);
    expect(result.quickStart).to.equal(undefined);
    expect(result.items).to.not.include("quickStart");
  });

  it("can stay in the help menu without opening on the first visit", async function () {
    await page.evaluate(() => {
      localStorage.clear();
      const Yasgui = (window as any).Yasgui;
      const div = document.createElement("div");
      document.body.appendChild(div);
      (window as any).other = new Yasgui(div, { quickStartOnFirstVisit: false, persistenceId: "manualQuickStart" });
    });
    await wait(600);
    const result = await page.evaluate(() => {
      const other = (window as any).other;
      const overlay = other.rootEl.querySelector(".yasgui-quickStart");
      return {
        open: !!overlay && !overlay.hidden,
        items: other.helpMenu.getItems().map((item: any) => item.id),
      };
    });
    expect(result.open).to.equal(false);
    expect(result.items[0]).to.equal("quickStart");
  });
});
