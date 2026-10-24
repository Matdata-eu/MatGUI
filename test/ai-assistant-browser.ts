import * as path from "path";
import * as http from "http";
import * as chai from "chai";
import * as puppeteer from "puppeteer";
import { it, describe, before, beforeEach, after, afterEach } from "mocha";
import { setup, destroy, closePage, getPage, clickWhenVisible } from "./utils.js";

const expect = chai.expect;

const ENDPOINT = "http://ai-data.test/sparql";
const AI_BASE = "http://ai-service.test/v1";
const QUERY = "SELECT * WHERE {\n  ?s ?p ?o\n}\nLIMIT 10";
const ANSWER = "Long tunnels:\n\n```sparql\nPREFIX ex: <http://example.org/>\nSELECT ?t WHERE { ?t a ex:Tunnel }\n```";

interface Recorded {
  aiRequests: any[];
  queries: string[];
}

async function mockServices(page: puppeteer.Page, recorded: Recorded) {
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const url = new URL(request.url());
    const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
    if (url.host !== "ai-data.test" && url.host !== "ai-service.test") {
      void request.continue();
      return;
    }
    if (request.method() === "OPTIONS") {
      void request.respond({ status: 204, headers });
      return;
    }
    if (url.host === "ai-service.test") {
      const body = JSON.parse(request.postData() || "{}");
      recorded.aiRequests.push(body);
      const askedCheck = body.messages.some((m: any) => m.role === "tool");
      const message =
        body.tools && !askedCheck
          ? {
              content: null,
              tool_calls: [
                {
                  id: "call1",
                  type: "function",
                  function: {
                    name: "run_sparql",
                    arguments: JSON.stringify({
                      query: "SELECT ?t WHERE { ?t a <http://example.org/Tunnel> }",
                      purpose: "tunnels",
                    }),
                  },
                },
              ],
            }
          : { content: ANSWER };
      void request.respond({
        status: 200,
        headers,
        contentType: "application/json",
        body: JSON.stringify({ model: "test-model", choices: [{ message }], usage: { total_tokens: 42 } }),
      });
      return;
    }
    const params = new URLSearchParams(request.method() === "POST" ? request.postData() || "" : url.search);
    const query = params.get("query") || "";
    recorded.queries.push(query);
    if (query.includes("broken")) {
      void request.respond({ status: 400, headers, body: "Parse error: unknown prefix" });
      return;
    }
    void request.respond({
      status: 200,
      headers,
      contentType: "application/sparql-results+json",
      body: JSON.stringify({
        head: { vars: ["t"] },
        results: { bindings: [{ t: { type: "uri", value: "http://example.org/tunnel1" } }] },
      }),
    });
  });
}

describe("AI assistant", function () {
  let browser: puppeteer.Browser;
  let page: puppeteer.Page;
  let server: http.Server | undefined;
  let recorded: Recorded;

  before(async function () {
    const refs = await setup(this, path.resolve("./build"));
    browser = refs.browser;
    server = refs.server;
  });

  beforeEach(async function () {
    this.timeout(30000);
    recorded = { aiRequests: [], queries: [] };
    page = await getPage(browser, "yasgui.html");
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "networkidle2" });
    await mockServices(page, recorded);
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

  async function useOwnService() {
    await page.evaluate((baseUrl) => {
      (window as any).yasgui.aiAssistant.settings.update({
        services: [{ id: "test", baseUrl, apiKey: "sk-secret-test-key", model: "test-model" }],
        defaultService: "test",
      });
    }, AI_BASE);
  }

  it("copies a prompt when no AI service is set up, and sends nothing", async function () {
    await page.click(".yasgui-aiButton");
    await page.waitForSelector(".yasgui-sidePanel__view[data-view='assistant']:not([hidden])");
    await clickWhenVisible(page, ".yasgui-ai__actions .yasgui-ai__action");
    await page.waitForSelector(".yasgui-ai__copied");
    const prompt = await page.$eval(".yasgui-ai__copied .yasgui-ai__sentText", (el) => el.textContent || "");
    expect(prompt).to.contain("?s ?p ?o");
    expect(prompt).to.contain("Explain what this query does");
    expect(recorded.aiRequests).to.have.length(0);
  });

  it("asks for consent, runs a check query and puts the answer in the editor", async function () {
    await useOwnService();
    await page.click(".yasgui-aiButton");
    await page.type(".yasgui-ai__input", "Which tunnels are there?");
    await page.keyboard.press("Enter");
    await page.waitForSelector(".yasgui-ai__consent .yasgui-ai__primary");
    const consent = await page.$eval(".yasgui-ai__consent", (el) => el.textContent || "");
    expect(consent).to.contain("ai-service.test");
    expect(consent).to.contain("your question");
    expect(recorded.aiRequests).to.have.length(0);

    await page.click(".yasgui-ai__consent .yasgui-ai__primary");
    await page.waitForSelector(".yasgui-ai__answer:not(.loading) .yasgui-ai__codeBlock");
    expect(recorded.aiRequests).to.have.length(2);
    expect(recorded.aiRequests[0].model).to.equal("test-model");
    expect(recorded.aiRequests[0].tools[0].function.name).to.equal("run_sparql");
    const check = recorded.queries.find((q) => q.includes("example.org/Tunnel"));
    expect(check).to.contain("LIMIT 20");
    expect(await page.$$(".yasgui-ai__check")).to.have.length(1);

    const buttons = await page.$$(".yasgui-ai__codeActions .yasgui-ai__primary");
    await buttons[0].click();
    const value = await page.evaluate(() => (window as any).yasgui.getTab().getYasqe().getValue());
    expect(value).to.contain("ex:Tunnel");
  });

  it("never stores the API key in the persisted configuration", async function () {
    await useOwnService();
    const stored = await page.evaluate(() => {
      const yasgui = (window as any).yasgui;
      return JSON.stringify(yasgui.persistentConfig.getPersistedConfig());
    });
    expect(stored).not.to.contain("sk-secret-test-key");
  });

  it("offers Fix with AI in the error view and sends the error", async function () {
    await useOwnService();
    await page.evaluate(() => {
      const yasgui = (window as any).yasgui;
      yasgui.aiAssistant.settings.addConsent("ai-service.test");
      const tab = yasgui.getTab();
      tab.getYasqe().setValue("SELECT * WHERE { ?s a <http://example.org/broken> }");
      tab.query().catch(() => {});
    });
    await page.waitForSelector(".yasr_errorAiFix");
    await page.click(".yasr_errorAiFix");
    await page.waitForSelector(".yasgui-ai__answer:not(.loading) .yasgui-ai__codeBlock");
    const last = recorded.aiRequests[recorded.aiRequests.length - 1];
    const user = last.messages.find((m: any) => m.role === "user").content;
    expect(user).to.contain("Parse error: unknown prefix");
    expect(user).to.contain("HTTP 400");
  });

  it("can be switched off by the embedding page", async function () {
    const result = await page.evaluate(() => {
      const div = document.createElement("div");
      div.id = "noAi";
      document.body.appendChild(div);
      const Yasgui = (window as any).Yasgui;
      const other = new Yasgui(div, { ai: { enabled: false }, persistenceId: "noAi" });
      const out = {
        assistant: !!other.aiAssistant,
        tab: !!div.querySelector(".yasgui-sidePanel__tab[data-view='assistant']"),
        button: !!div.querySelector(".yasgui-aiButton"),
      };
      other.destroy();
      return out;
    });
    expect(result).to.deep.equal({ assistant: false, tab: false, button: false });
  });
});
