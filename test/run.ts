import "source-map-support/register.js";
import * as puppeteer from "puppeteer";

import * as path from "path";
import * as http from "http";
import * as chai from "chai";
import { it, describe, before, beforeEach, after, afterEach } from "mocha";
const expect = chai.expect;
import Yasqe from "@matdata/yasqe";
//@ts-ignore ignore unused warning
import { setup, destroy, closePage, getPage, makeScreenshot, inspectLive, wait } from "./utils.js";

declare var window: Window & {
  Yasqe: typeof Yasqe;
  yasqe: Yasqe;
};

describe("Yasqe", function () {
  // Define global variables
  let browser: puppeteer.Browser;
  let page: puppeteer.Page;
  let server: http.Server | undefined;

  /**
   * When issuing page.keyboard.type commands, codemirror might not have processed the command
   * fully when that promise is resolved.
   * So, use our own function where we wait for codemirror to have processed all key-downs
   */
  async function type(text: string) {
    await page.keyboard.type(text);
    await page.waitForFunction(`window.yasqe.getValue().indexOf("${text}") >= 0`, { timeout: 600 });
  }
  before(async function () {
    const refs = await setup(this, path.resolve("./build"));
    browser = refs.browser;
    server = refs.server;
  });

  beforeEach(async function () {
    this.timeout(30000);
    page = await getPage(browser, "yasqe.html");
    await page.evaluate(() => localStorage.clear());
  });

  afterEach(async () => {
    await closePage(this, page);
  });

  after(async function () {
    return destroy(browser, server);
  });

  it("get a value", async function () {
    const value = await page.evaluate(() => {
      return window.yasqe.getValue();
    });
    expect(value).to.contain("SELECT");
  });

  async function waitForAutocompletionPopup(shouldNotHaveLength?: number): Promise<number | undefined> {
    if (shouldNotHaveLength) {
      // CodeMirror 6 renders completions as `.cm-tooltip.CodeMirror-hints > ul > li`
      await page.waitForFunction(
        `document.querySelectorAll('.CodeMirror-hints li').length !== ${shouldNotHaveLength}`,
        { timeout: 600 },
      );
    } else {
      await page.waitForSelector(`.CodeMirror-hints`, { timeout: 600 });
      await wait(20);
    }
    return page.evaluate(() => {
      const items = document.querySelectorAll(".CodeMirror-hints li");
      return items.length || undefined;
    });
  }

  async function issueAutocompletionKeyCombination() {
    await page.keyboard.down("Control");
    await page.keyboard.press("Space");
    await page.keyboard.up("Control");
  }

  describe("Autoformatting", function () {
    it("With literal", async function () {
      const value = await page.evaluate(() => {
        window.yasqe.setValue(
          `PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> select * {   ?a rdf:b ?c ;     rdf:d "e" ;     rdf:f rdf:g .}`,
        );
        window.yasqe.autoformat();
        return window.yasqe.getValue();
      });
      expect(value).to.equal(`PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
select * {
  ?a rdf:b ?c ;
     rdf:d "e" ;
     rdf:f rdf:g .
}`);
    });
  });

  describe("SPARQL Formatter", function () {
    it("Should format with sparql-formatter", async function () {
      const value = await page.evaluate(() => {
        window.yasqe.setValue(
          `PREFIX rdf:<http://www.w3.org/1999/02/22-rdf-syntax-ns#> SELECT * WHERE {?sub ?pred ?obj .} LIMIT 10`,
        );
        window.yasqe.formatQuery();
        return window.yasqe.getValue();
      });
      // sparql-formatter produces formatted output with proper line breaks
      expect(value).to.contain("PREFIX rdf:");
      expect(value).to.contain("SELECT *");
      expect(value).to.contain("WHERE {");
      expect(value).to.contain("LIMIT 10");
      // Verify it's multi-line (not on one line)
      expect(value.split("\n").length).to.be.greaterThan(3);
    });

    it("Should format with legacy formatter when selected", async function () {
      const value = await page.evaluate(() => {
        // Set formatter type to legacy
        if (!window.yasqe.persistentConfig) {
          window.yasqe.persistentConfig = { query: "", editorHeight: "300px" };
        }
        window.yasqe.persistentConfig.formatterType = "legacy";

        window.yasqe.setValue(`PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> select * {   ?a rdf:b ?c .}`);
        window.yasqe.format();
        return window.yasqe.getValue();
      });
      // Legacy formatter produces specific formatting
      expect(value).to.contain("PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>");
      expect(value).to.contain("select * {");
      expect(value.split("\n").length).to.be.greaterThan(1);
    });

    it("Should auto-format on query execution when enabled", async function () {
      const executed = await page.evaluate(() => {
        // Set up auto-format on query
        if (!window.yasqe.persistentConfig) {
          window.yasqe.persistentConfig = { query: "", editorHeight: "300px" };
        }
        window.yasqe.persistentConfig.autoformatOnQuery = true;
        window.yasqe.persistentConfig.formatterType = "sparql-formatter";

        // Set unformatted query
        window.yasqe.setValue(
          `PREFIX rdf:<http://www.w3.org/1999/02/22-rdf-syntax-ns#> SELECT * WHERE {?sub ?pred ?obj} LIMIT 10`,
        );

        // Trigger query (it will fail but that's ok, we're testing formatting)
        window.yasqe.query().catch(() => {});

        // Wait a moment for format to apply
        return new Promise((resolve) => {
          setTimeout(() => {
            const formatted = window.yasqe.getValue();
            resolve({
              isFormatted: formatted.split("\n").length > 3,
              value: formatted,
            });
          }, 100);
        });
      });

      expect((executed as any).isFormatted).to.be.true;
      expect((executed as any).value).to.contain("SELECT *");
      expect((executed as any).value).to.contain("WHERE {");
    });

    it("Should not auto-format on query execution when disabled", async function () {
      const result = await page.evaluate(() => {
        // Disable auto-format on query
        if (!window.yasqe.persistentConfig) {
          window.yasqe.persistentConfig = { query: "", editorHeight: "300px" };
        }
        window.yasqe.persistentConfig.autoformatOnQuery = false;

        // Set unformatted query
        const originalQuery = `PREFIX rdf:<http://www.w3.org/1999/02/22-rdf-syntax-ns#> SELECT * WHERE {?sub ?pred ?obj} LIMIT 10`;
        window.yasqe.setValue(originalQuery);

        // Trigger query (it will fail but that's ok)
        window.yasqe.query().catch(() => {});

        // Check immediately - should not be formatted
        const afterQuery = window.yasqe.getValue();
        return {
          unchanged: originalQuery === afterQuery,
          value: afterQuery,
        };
      });

      expect((result as any).unchanged).to.be.true;
    });
  });
  describe("Autoadd prefixes", function () {
    //note: this test also covers the infinite loop issue described here:
    //https://github.com/TriplyDB/YASGUI.YASQE/issues/135
    it("Should autoadd foaf prefix", async function () {
      await page.evaluate(() => {
        const query = `# prefix #
PREFIX geo: <http://www.opengis.net/ont/geosparql#> select
* where { `;
        window.yasqe.setValue(query);
        window.yasqe.focus();
        window.yasqe.getDoc().setCursor({ line: window.yasqe.getDoc().lineCount(), ch: 0 });
        return window.yasqe.getDoc().getCursor();
      });
      await type("foaf:");
      await page.waitForFunction(
        () => {
          return window.yasqe.getValue().indexOf("PREFIX foaf: <http://xmlns.com/foaf/0.1/>") >= 0;
        },
        {
          polling: 10,
        },
      );
    });
    it("should show prefix completions after adding new prefix", async () => {
      await page.evaluate(() => {
        const query = `# prefix #
PREFIX geo: <http://www.opengis.net/ont/geosparql#> select
* where { ?sub `;
        window.yasqe.setValue(query);
        window.yasqe.focus();
        window.yasqe.getDoc().setCursor({ line: window.yasqe.getDoc().lineCount(), ch: 0 });
        return window.yasqe.getDoc().getCursor();
      });
      await type("testa:");
      await page.waitForFunction(
        () => {
          return window.yasqe.getValue().indexOf("PREFIX testa: <https://test.a.com/>") >= 0;
        },
        {
          polling: 10,
        },
      );
      //Note from Laurens: This is an invalid test. We should not expect a popup here (this is the property-autocompleter).
      //Reason: we didn't configure yasgui to auto-show the lov property completions
      //Leaving it here as it doesn't warrant a new issue yet.
      await waitForAutocompletionPopup();
    });
    it("path traversal should change the correct segment", async () => {
      await page.evaluate(() => {
        const query =
          "PREFIX testa: <https://test.a.com/> select * where { ?s testa:someprop/testa:/testa:someotherprop";
        window.yasqe.setValue(query);
        window.yasqe.focus();
        window.yasqe.getDoc().setCursor({ line: 0, ch: query.indexOf(":/testa:someotherprop") });
        return window.yasqe.getDoc().getCursor();
      });
      await issueAutocompletionKeyCombination();
      await waitForAutocompletionPopup();
      await page.keyboard.press("Enter");
      const newValue = await page.evaluate(() => window.yasqe.getValue());
      expect(newValue).to.equal(
        "PREFIX testa: <https://test.a.com/> select * where { ?s testa:someprop/testa:0/testa:someotherprop",
      );
    });
    it("path traversal should search with the correct path segment", async () => {
      await page.evaluate(() => {
        const query =
          "PREFIX testa: <https://test.a.com/> select * where { ?s testa:someprop/testa:someotherprop/testa;";
        window.yasqe.setValue(query);
        window.yasqe.focus();
        window.yasqe.getDoc().setCursor({ line: 0, ch: query.indexOf(";") });
        return window.yasqe.getDoc().getCursor();
      });
      await issueAutocompletionKeyCombination();
      try {
        const hasAutocomplete = await waitForAutocompletionPopup();
        expect(hasAutocomplete).to.be.undefined("", "Expected codemirror hint to not be there");
      } catch (e) {
        // We expect the timeout to trigger here
        if ((e as any).name !== "TimeoutError") {
          throw e;
        }
      }
    });
  });
  describe("Autocompleting", function () {
    const getCompleteToken = () => {
      return page.evaluate(() => window.yasqe.getCompleteToken());
    };
    const getCompleteTokenAt = (character: number, line?: number) => {
      return page.evaluate(
        (at: { character: number; line?: number }) => {
          window.yasqe.getDoc().setCursor({ line: at.line || window.yasqe.getCursor().line, ch: at.character });
          return window.yasqe.getCompleteToken();
        },
        { character: character, line: line },
      );
    };
    it("Should only trigger get request when needed", async () => {
      // Setting up
      await page.evaluate(() => {
        const query = `PREFIX testa: <https://test.a.com/> select * where {?x a <htt`;
        (window as any).showCount = 0;
        (window as any).hideCount = 0;
        window.yasqe.setValue(query);
        window.yasqe.on("autocompletionShown", () => (window as any).showCount++);
        window.yasqe.on("autocompletionClose", () => (window as any).hideCount++);
        window.yasqe.focus();
        window.yasqe.getDoc().setCursor({ line: 0, ch: query.length });
        return window.yasqe.getDoc().getCursor();
      });
      const getHideCount = () =>
        page.evaluate(() => {
          return <number>(window as any).hideCount;
        });
      const getShowCount = () =>
        page.evaluate(() => {
          return <number>(window as any).showCount;
        });
      await issueAutocompletionKeyCombination();
      await waitForAutocompletionPopup();
      expect(await getShowCount()).to.equal(1);
      expect(await getHideCount()).to.equal(0);
      await type("ps://");
      await wait(200);
      expect(await getShowCount()).to.be.lessThan(7);
      expect(await getHideCount()).to.equal(0);
    }).timeout(5000);
    it("Should show the same results irregardless of where the cursor is", async () => {
      await page.evaluate(() => {
        const query = `select * where { ?s <https://test.a.com/55`;
        window.yasqe.setValue(query);
        window.yasqe.focus();
        window.yasqe.getDoc().setCursor({ line: 0, ch: query.length });
        return window.yasqe.getDoc().getCursor();
      });
      await issueAutocompletionKeyCombination();
      expect(await waitForAutocompletionPopup()).to.equal(11);
      await page.keyboard.press("Escape");
      await page.evaluate(() => {
        const query = `select * where { ?s <https://test.a.com/55`;
        window.yasqe.getDoc().setCursor({ line: 0, ch: query.indexOf("/test.a") });
      });
      await issueAutocompletionKeyCombination();
      expect(await waitForAutocompletionPopup()).to.equal(11);
      await page.keyboard.press("Escape");
      await page.evaluate(() => {
        const query = `select * where { ?s <https://test.a.com/55`;
        window.yasqe.getDoc().setCursor({ line: 0, ch: query.indexOf("/55") });
      });
      await issueAutocompletionKeyCombination();
      expect(await waitForAutocompletionPopup()).to.equal(11);

      await page.keyboard.press("Escape");
      await page.evaluate(() => {
        const query = `select * where { ?s <https://test.a.com/55`;
        window.yasqe.getDoc().setCursor({ line: 0, ch: query.indexOf("http") });
      });
      await issueAutocompletionKeyCombination();
      expect(await waitForAutocompletionPopup()).to.equal(11);
    });
    it("Should work without trailing whitespace", async () => {
      await page.evaluate(() => {
        const query = "select * where { ?subject ?predicate ?s}";
        window.yasqe.setValue(query);
        window.yasqe.focus();
        window.yasqe.getDoc().setCursor({ line: 0, ch: query.length - 2 });
        return window.yasqe.getDoc().getCursor();
      });
      await issueAutocompletionKeyCombination();
      await waitForAutocompletionPopup();

      await page.keyboard.press("Enter");
      const newValue = await page.evaluate(() => window.yasqe.getValue());
      expect(newValue).to.equal("select * where { ?subject ?predicate ?subject}");
    });

    it("Should deal with infinished full iri", async () => {
      await page.evaluate(() => {
        const oneLineQuery = "select * where { ?subject <http://www.opengis.net/ont/geosparql# ?s";
        window.yasqe.setValue(oneLineQuery);
        window.yasqe.focus();
        window.yasqe.getDoc().setCursor({ line: 0, ch: oneLineQuery.length - 5 });
      });

      await issueAutocompletionKeyCombination();
      await waitForAutocompletionPopup();

      await page.keyboard.press("Enter");
      const newValue = await page.evaluate(() => window.yasqe.getValue());
      expect(newValue).to.equal("select * where { ?subject <http://www.opengis.net/ont/geosparql#defaultGeometry> ?s");
    });

    it("Should autocomplete from middle of unfinished iri", async () => {
      await page.evaluate(() => {
        const oneLineQuery = "select * where { ?subject <http://www.opengis.net/ont/geosparql#";
        window.yasqe.setValue(oneLineQuery);
        window.yasqe.focus();
        window.yasqe.getDoc().setCursor({ line: 0, ch: oneLineQuery.indexOf("opengis") });
      });

      await issueAutocompletionKeyCombination();
      await waitForAutocompletionPopup();

      await page.keyboard.press("Enter");
      const newValue = await page.evaluate(() => window.yasqe.getValue());
      expect(newValue).to.equal("select * where { ?subject <http://www.opengis.net/ont/geosparql#defaultGeometry>");

      await page.evaluate(() => {
        const oneLineQuery = "select * where { ?subject <http://www.opengis.net/ont/geosparql#";
        window.yasqe.setValue(oneLineQuery);
        window.yasqe.focus();
        window.yasqe.getDoc().setCursor({ line: 0, ch: oneLineQuery.indexOf("opengis") });
      });
      const token = await getCompleteToken();
      expect(token.string).to.equal("<http://www.opengis.net/ont/geosparql#");
    });

    describe("getCompleteToken", () => {
      it("Should expand to the end", async () => {
        await page.evaluate(() => {
          const oneLineQuery = "select * where { ?subject <http://www.opengis.net/ont/geosparql#";
          window.yasqe.setValue(oneLineQuery);
          window.yasqe.focus();
          window.yasqe.getDoc().setCursor({ line: 0, ch: oneLineQuery.indexOf("opengis") });
        });
        const token = await getCompleteToken();
        expect(token.string).to.equal("<http://www.opengis.net/ont/geosparql#");
      });

      it("Autocompleter should show literal suggestion directly after function #156", async () => {
        await page.evaluate(() => {
          const oneLineQuery = 'select * where { bind("';
          window.yasqe.setValue(oneLineQuery);
          window.yasqe.focus();
          window.yasqe.getDoc().setCursor({ line: 0, ch: oneLineQuery.indexOf('"') + 1 });
        });
        const token = await getCompleteToken();
        expect(token.state.possibleCurrent).contains(
          "IRI_REF",
          `IRI_REF not found in list: "${token.state.possibleCurrent.join('", "')}"`,
        );
      });
    });
    /**
     * This test is tricky, as it uses the LOV API in our test. I.e, if this test fails, first check whether LOV is actually up
     */
    describe("Async property autocompletion", function () {
      function focusOnAutocompletionPos() {
        return page.evaluate(() => {
          const query = `PREFIX geo: <http://www.opengis.net/ont/geosparql#> select * where {?x geo: ?y}`;
          window.yasqe.setValue(query);
          window.yasqe.focus();
          window.yasqe.getDoc().setCursor({ line: 0, ch: query.indexOf(": ?y") + 1 });
          return window.yasqe.getDoc().getCursor();
        });
      }
      it("Async autocompletions trickle down when typing", async () => {
        // Set the new query, and focus on location where we want to autocomplete
        await page.evaluate(() => {
          const query = `select * where {?x <http://www.opengis.net/ont/geosparql#> ?y}`;
          window.yasqe.setValue(query);
          window.yasqe.focus();
          window.yasqe.getDoc().setCursor({ line: 0, ch: query.indexOf("#> ?y") + 1 });
          return window.yasqe.getDoc().getCursor();
        });

        // Issue autocompletion shortcut
        await issueAutocompletionKeyCombination();
        // Wait for hint div to appear
        const allInitialResults = await waitForAutocompletionPopup();

        // Widdle the list down
        await type("asWK");
        const newResults = await waitForAutocompletionPopup(allInitialResults);
        expect(newResults).is.lessThan(allInitialResults || 0);
      });

      it("Should not append the string we just typed (#1479)", async function () {
        /**
         * Set the new query, and focus on location where we want to autocomplete
         */
        await focusOnAutocompletionPos();

        /**
         * Issue autocompletion shortcut
         */
        await issueAutocompletionKeyCombination();

        /**
         * Wait for hint div to appear
         */
        const allInitialResults = await waitForAutocompletionPopup();

        /**
         * Type a string to reduce autocompletion list
         */
        await type("asW");

        /**
         * Wait for the hint div to be updated to only match suggestions starting with `rcc`
         */
        const numResults = await waitForAutocompletionPopup(allInitialResults);
        expect(numResults).to.be.lessThan(10);
        /**
         * Select the first suggestion
         */
        await page.keyboard.press("Enter");

        /**
         * Check whether that suggestion is now correctly included in yasqe
         */
        await wait(20);
        const newValue = await page.evaluate(() => window.yasqe.getValue());
        expect(newValue.trim()).to.equal(
          `PREFIX geo: <http://www.opengis.net/ont/geosparql#> select * where {?x geo:asWKT ?y}`,
        );
      });
      it("Should only include matching strings", async function () {
        /**
         * Set the new query, and focus on location where we want to autocomplete
         */
        await focusOnAutocompletionPos();

        /**
         * Issue autocompletion shortcut
         */
        await issueAutocompletionKeyCombination();

        /**
         * Wait for hint div to appear
         */
        const allResults = await waitForAutocompletionPopup();

        /**
         * Type a string to reduce autocompletion list
         */
        await type("defau");
        /**
         * Wait for the hint div to be updated to only match suggestions starting with `rcc`
         */
        const numResults = await waitForAutocompletionPopup(allResults);
        await wait(20);
        expect(numResults).to.equal(1);
        /**
         * Select the first suggestion
         */
        await page.keyboard.press("Enter");

        /**
         * Check whether that suggestion is now correctly included in yasqe
         */
        const newValue = await page.evaluate(() => window.yasqe.getValue());
        expect(newValue).to.equal(
          "PREFIX geo: <http://www.opengis.net/ont/geosparql#> select * where {?x geo:defaultGeometry ?y}",
        );
      });
    });
    describe("Async class autocompletion", function () {
      function focusOnAutocompletionPos() {
        return page.evaluate(() => {
          const query = `PREFIX testb: <https://test.b.com/> select * where {?x a <htt`;
          window.yasqe.setValue(query);
          window.yasqe.focus();
          window.yasqe.getDoc().setCursor({ line: 0, ch: query.length - 2 });
          return window.yasqe.getDoc().getCursor();
        });
      }
      it("Should use correct token for autocompleting classes (#1852)", async function () {
        /**
         * Set the new query, and focus on location where we want to autocomplete
         */
        await focusOnAutocompletionPos();

        /**
         * Issue autocompletion shortcut
         */
        await issueAutocompletionKeyCombination();

        /**
         * Wait for hint div to appear
         */
        const allResults = await waitForAutocompletionPopup();
        expect(allResults).to.equal(1000);
      });
      it("Should not open on its own", async () => {
        await focusOnAutocompletionPos();

        try {
          const hasAutocomplete = await page.waitForSelector(`.CodeMirror-hints`, { timeout: 200 });
          expect(hasAutocomplete).to.be.undefined("", "Expected codemirror hint to not be there");
        } catch (e) {
          // We expect the timeout to trigger here
          if ((e as any).name !== "TimeoutError") {
            throw e;
          }
        }
      });
      it("Should auto open when autocompleter is Async and ontype is enabled", async () => {
        await page.evaluate(() => {
          (window.yasqe.autocompleters["class-local"] as any).config.autoShow = true;
        });
        await focusOnAutocompletionPos();
        await page.waitForSelector(`.CodeMirror-hints`);
      });
    });
    describe("Async prefix autocompletion", function () {
      function focusOnAutocompletionPos() {
        return page.evaluate(() => {
          window.yasqe.setValue("");
          window.yasqe.focus();
          window.yasqe.getDoc().setCursor({ line: 0, ch: 0 });
          return window.yasqe.getDoc().getCursor();
        });
      }

      it("Should autocomplete", async function () {
        // await inspectLive(this);
        /**
         * Set the new query, and focus on location where we want to autocomplete
         */
        await focusOnAutocompletionPos();
        /**
         * Issue autocompletion shortcut
         */
        await type("prefix t");
        /**
         * Wait for hint div to appear
         */
        const results = await waitForAutocompletionPopup();
        expect(results).to.equal(3);

        /**
         * Type a string to reduce autocompletion list
         */
        await type("esta");

        const filteredResults = await waitForAutocompletionPopup(3);
        expect(filteredResults).to.equal(1);
        /**
         * Select the first suggestion
         */
        await page.keyboard.press("Enter");

        /**
         * Check whether that suggestion is now correctly included in yasqe
         */
        const newValue = await page.evaluate(() => window.yasqe.getValue());
        expect(newValue).to.equal("prefix testa: <https://test.a.com/>");
      });
    });

    describe("Single line autocompletion", function () {
      async function executeFirstLineAutocompletion(query: string) {
        await page.evaluate((query) => {
          window.yasqe.setValue(query);
          window.yasqe.focus();
          window.yasqe.getDoc().setCursor(1, 0);
          return window.yasqe.getDoc().getCursor();
        }, query);
        await page.keyboard.press("End");

        await issueAutocompletionKeyCombination();
        await waitForAutocompletionPopup();
        await page.keyboard.press("Enter");
        return page.evaluate(() => window.yasqe.getValue());
      }

      it("Should autocomplete with multiple statements on one line", async function () {
        const query = `SELECT * WHERE {
          ?a <somwething.something.without.bbc.url> ?b. ?a <http
        }`;
        const autocompletedQuery = await executeFirstLineAutocompletion(query);
        expect(autocompletedQuery).to.contain("<http://www.opengis.net/ont/geosparql#defaultGeometry>");
      });

      it("Should autocomplete with single-line Predicate-Object lists", async function () {
        const query = `SELECT * WHERE {
          ?a <somwething.something.without.bbc.url> ?b ; <http
        }`;
        const autocompletedQuery = await executeFirstLineAutocompletion(query);
        expect(autocompletedQuery).to.contain("<http://www.opengis.net/ont/geosparql#defaultGeometry>");
      });

      it("Should autocomplete with single-line Object lists", async function () {
        const query = `SELECT * WHERE {
          ?a a ?b, <http
        }`;
        const autocompletedQuery = await executeFirstLineAutocompletion(query);
        expect(autocompletedQuery).to.contain("<https://test.b.com/0>");
      });
    });
  });

  describe("CONSTRUCT Variable Validation", function () {
    it("Should show warning for undefined variables in CONSTRUCT", async function () {
      await page.evaluate(() => {
        const constructQuery = `PREFIX ex: <http://example.org/>
CONSTRUCT {
  ?s ex:hasName ?name .
  ?s ex:hasAge ?age .
}
WHERE {
  ?s ex:name ?name .
}`;
        window.yasqe.setValue(constructQuery);
      });

      const result = await page.evaluate(() => {
        const lastLine = window.yasqe.getDoc().lastLine();
        const token = window.yasqe.getTokenAt(
          { line: lastLine, ch: window.yasqe.getDoc().getLine(lastLine).length },
          true,
        );
        const warnings = document.querySelectorAll(".constructVariableWarning");
        return {
          queryType: token.state.queryType,
          constructVars: Object.keys(token.state.constructVariables || {}),
          whereVars: Object.keys(token.state.whereVariables || {}),
          warningCount: warnings.length,
        };
      });

      expect(result.queryType).to.equal("CONSTRUCT");
      expect(result.constructVars).to.include("?age");
      expect(result.whereVars).to.not.include("?age");
      expect(result.warningCount).to.be.greaterThan(0);
    });

    it("Should not show warnings for valid CONSTRUCT queries", async function () {
      await page.evaluate(() => {
        const validConstructQuery = `PREFIX ex: <http://example.org/>
CONSTRUCT {
  ?s ex:hasName ?name .
}
WHERE {
  ?s ex:name ?name .
}`;
        window.yasqe.setValue(validConstructQuery);
      });

      const warningCount = await page.evaluate(() => {
        return document.querySelectorAll(".constructVariableWarning").length;
      });

      expect(warningCount).to.equal(0);
    });

    it("Should allow disabling CONSTRUCT variable checking", async function () {
      await page.evaluate(() => {
        const constructQuery = `PREFIX ex: <http://example.org/>
CONSTRUCT {
  ?s ex:hasAge ?age .
}
WHERE {
  ?s ex:name ?name .
}`;
        window.yasqe.setValue(constructQuery);
        window.yasqe.setCheckConstructVariables(false);
      });

      const result = await page.evaluate(() => {
        return {
          warningCount: document.querySelectorAll(".constructVariableWarning").length,
          checkEnabled: window.yasqe.config.checkConstructVariables,
        };
      });

      expect(result.checkEnabled).to.be.false;
      expect(result.warningCount).to.equal(0);
    });
  });

  describe("Code Snippets", function () {
    it("Should show snippets bar with default snippets", async function () {
      const result = await page.evaluate(() => {
        return {
          barExists: !!document.querySelector(".yasqe_snippetsBar"),
          dropdownCount: document.querySelectorAll(".yasqe_snippetDropdown").length,
          snippets: window.yasqe.config.snippets.map((s: any) => s.label),
        };
      });

      expect(result.barExists).to.be.true;
      // With grouped snippets, we should have 2 dropdown buttons (Query Types and Patterns)
      expect(result.dropdownCount).to.be.at.least(2);
      expect(result.snippets).to.include("SELECT");
      expect(result.snippets).to.include("CONSTRUCT");
      expect(result.snippets).to.include("ASK");
      expect(result.snippets).to.include("FILTER");
      expect(result.snippets).to.include("OPTIONAL");
    });

    it("Should insert snippet at cursor position", async function () {
      await page.evaluate(() => {
        window.yasqe.setValue("SELECT * WHERE {\n  \n}");
        window.yasqe.focus();
        window.yasqe.getDoc().setCursor({ line: 1, ch: 2 });
      });

      // Click the "Patterns" dropdown button to open it
      await page.click('button[aria-label="Patterns snippets"]');

      // Wait for dropdown to open
      await page.waitForSelector('.yasqe_snippetDropdownContent[style*="display: block"]');

      // Click the FILTER snippet item
      await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll(".yasqe_snippetDropdownItem"));
        const filterItem = items.find((item) => item.textContent === "FILTER") as HTMLElement;
        if (filterItem) filterItem.click();
      });

      const value = await page.evaluate(() => window.yasqe.getValue());
      expect(value).to.include("FILTER (?var > 100)");
    });

    it("Should not show snippets bar when disabled", async function () {
      await page.evaluate(() => {
        window.yasqe.setSnippetsBarVisible(false);
      });

      const barExists = await page.evaluate(() => {
        return !!document.querySelector(".yasqe_snippetsBar");
      });

      expect(barExists).to.be.false;
    });

    it("Should show snippets bar when re-enabled", async function () {
      await page.evaluate(() => {
        window.yasqe.setSnippetsBarVisible(true);
      });

      const barExists = await page.evaluate(() => {
        return !!document.querySelector(".yasqe_snippetsBar");
      });

      expect(barExists).to.be.true;
    });

    it("Should hide snippets bar when no snippets configured", async function () {
      const result = await page.evaluate(() => {
        const container = document.createElement("div");
        container.id = "test-yasqe-no-snippets";
        document.body.appendChild(container);

        const testYasqe = new window.Yasqe(container, {
          snippets: [],
        });

        return {
          barExists: !!testYasqe.rootEl.querySelector(".yasqe_snippetsBar"),
        };
      });

      expect(result.barExists).to.be.false;
    });
  });
});

describe("Yasr", function () {
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
    page = await getPage(browser, "yasr.html");
    await page.evaluate(() => localStorage.clear());
  });

  afterEach(async () => {
    await closePage(this, page);
  });

  after(async function () {
    return destroy(browser, server);
  });

  it("does not restore previous response when response persistence is disabled", async function () {
    const result = await page.evaluate(() => {
      localStorage.clear();
      const YasrCtor = (window as any).Yasr;
      const storageKey = "yasr_cache_disable_response";

      const firstParent = document.createElement("div");
      firstParent.id = "yasr-cache-first";
      document.body.appendChild(firstParent);
      const first = new YasrCtor(firstParent, {
        persistenceId: "yasr_cache_disable",
        persistencyExpire: 3600,
        maxPersistentResponseSize: 100000,
      });
      first.setResponse({
        head: { vars: ["s"] },
        results: {
          bindings: [
            {
              s: {
                type: "uri",
                value: "urn:first",
              },
            },
          ],
        },
      });

      const storedBeforeDisable = !!localStorage.getItem(storageKey);

      const secondParent = document.createElement("div");
      secondParent.id = "yasr-cache-second";
      document.body.appendChild(secondParent);
      const second = new YasrCtor(secondParent, {
        persistenceId: "yasr_cache_disable",
        persistencyExpire: 0,
        maxPersistentResponseSize: 0,
      });

      return {
        storedBeforeDisable,
        restoredResults: !!second.results,
        stillStoredAfterDisable: !!localStorage.getItem(storageKey),
      };
    });

    expect(result.storedBeforeDisable).to.equal(true);
    expect(result.restoredResults).to.equal(false);
    expect(result.stillStoredAfterDisable).to.equal(false);
  });
});
