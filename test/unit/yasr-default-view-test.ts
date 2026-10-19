import * as chai from "chai";
import { describe, it } from "mocha";

import { getDefaultViewFromQuery, resolveViewToPlugin } from "../../packages/yasr/src/defaultView.js";

const expect = chai.expect;

const PLUGINS = {
  Table: { label: "Table" },
  Geo: { label: "Geo" },
  Graph: { label: "Graph" },
  Chart: { label: "Chart" },
  response: { label: "Response" },
};

describe("Yasr default view from a query comment", () => {
  describe("getDefaultViewFromQuery", () => {
    it("reads the view from a leading comment", () => {
      expect(getDefaultViewFromQuery("#defaultView:Map\nSELECT * WHERE { ?s ?p ?o }")).to.equal("Map");
    });

    it("allows whitespace and any keyword casing", () => {
      expect(getDefaultViewFromQuery("  # defaultview : Graph\nCONSTRUCT WHERE { ?s ?p ?o }")).to.equal("Graph");
    });

    it("finds the comment on a later line", () => {
      const query = "PREFIX ex: <http://example.org/>\n# a title\n#defaultView:Chart\nSELECT * WHERE { ?s ?p ?o }";
      expect(getDefaultViewFromQuery(query)).to.equal("Chart");
    });

    it("ignores the keyword outside a comment line", () => {
      const query = 'SELECT * WHERE { ?s ?p "#defaultView:Map" }';
      expect(getDefaultViewFromQuery(query)).to.equal(undefined);
    });

    it("returns undefined without a comment or query", () => {
      expect(getDefaultViewFromQuery("SELECT * WHERE { ?s ?p ?o }")).to.equal(undefined);
      expect(getDefaultViewFromQuery(undefined)).to.equal(undefined);
    });
  });

  describe("resolveViewToPlugin", () => {
    it("matches a plugin name case-insensitively", () => {
      expect(resolveViewToPlugin("geo", PLUGINS)).to.equal("Geo");
      expect(resolveViewToPlugin("RESPONSE", PLUGINS)).to.equal("response");
    });

    it("matches a plugin label", () => {
      expect(resolveViewToPlugin("Kaart", { Geo: { label: "Kaart" } })).to.equal("Geo");
    });

    it("maps Wikidata Query Service view names", () => {
      expect(resolveViewToPlugin("Map", PLUGINS)).to.equal("Geo");
      expect(resolveViewToPlugin("BarChart", PLUGINS)).to.equal("Chart");
      expect(resolveViewToPlugin("LineChart", PLUGINS)).to.equal("Chart");
    });

    it("returns undefined for an unknown view or a plugin that isn't available", () => {
      expect(resolveViewToPlugin("Timeline", PLUGINS)).to.equal(undefined);
      expect(resolveViewToPlugin("Map", { Table: { label: "Table" } })).to.equal(undefined);
    });
  });
});
