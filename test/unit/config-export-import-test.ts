import * as chai from "chai";
import { describe, it } from "mocha";

import { parseFromTurtle, serializeToTurtle } from "../../packages/yasgui/src/ConfigExportImport.js";

const expect = chai.expect;

function tab(id: string, name: string, value: string, endpoint?: string, extra: any = {}) {
  return {
    id,
    name,
    yasqe: { value },
    requestConfig: { endpoint, method: "GET", acceptHeaderSelect: "application/sparql-results+xml" },
    yasr: { settings: { selectedPlugin: "Graph" }, response: undefined },
    ...extra,
  };
}

describe("Configuration export and import", () => {
  const config: any = {
    endpointHistory: ["https://a.example/sparql", 'https://b.example/sparql?x="1"'],
    tabs: ["t1", "t2", "t3"],
    active: "t2",
    tabConfig: {
      t1: tab(
        "t1",
        'Say "hi"',
        'SELECT * WHERE { ?s ?p "a \\"quoted\\" value" }\n# second line',
        "https://a.example/sparql",
        {
          orientation: "horizontal",
        },
      ),
      // No endpoint: must not shift the endpoints of the other tabs
      t2: tab("t2", "No endpoint", "ASK {}"),
      t3: tab("t3", "Third", 'SELECT """long""" {}', "https://c.example/sparql"),
    },
    prefixes: "PREFIX ex: <http://example.org/>\n",
    autoCaptureEnabled: true,
    theme: "dark",
    customEndpointButtons: [{ label: "A", endpoint: "https://a.example/sparql" }],
  };

  it("round-trips tabs with quotes, newlines and a missing endpoint", () => {
    const parsed = parseFromTurtle(serializeToTurtle(config));
    expect(parsed.tabs).to.deep.equal(["t1", "t2", "t3"]);
    expect(parsed.active).to.equal("t2");
    expect(parsed.tabConfig!.t1.name).to.equal('Say "hi"');
    expect(parsed.tabConfig!.t1.yasqe.value).to.equal(config.tabConfig.t1.yasqe.value);
    expect(parsed.tabConfig!.t1.requestConfig.endpoint).to.equal("https://a.example/sparql");
    expect(parsed.tabConfig!.t1.requestConfig.method).to.equal("GET");
    expect(parsed.tabConfig!.t1.requestConfig.acceptHeaderSelect).to.equal("application/sparql-results+xml");
    expect(parsed.tabConfig!.t1.orientation).to.equal("horizontal");
    expect(parsed.tabConfig!.t1.yasr.settings.selectedPlugin).to.equal("Graph");
    expect(parsed.tabConfig!.t2.requestConfig.endpoint).to.equal("");
    expect(parsed.tabConfig!.t3.requestConfig.endpoint).to.equal("https://c.example/sparql");
    expect(parsed.tabConfig!.t3.yasqe.value).to.equal('SELECT """long""" {}');
  });

  it("keeps the configuration-level settings apart from the tab settings", () => {
    const parsed = parseFromTurtle(serializeToTurtle(config));
    expect(parsed.endpointHistory).to.deep.equal(config.endpointHistory);
    expect(parsed.prefixes).to.equal(config.prefixes);
    expect(parsed.autoCaptureEnabled).to.equal(true);
    expect(parsed.theme).to.equal("dark");
    // Only a tab has an orientation here, so the configuration has none
    expect(parsed.orientation).to.equal(undefined);
    expect(parsed.customEndpointButtons).to.deep.equal(config.customEndpointButtons);
  });

  it("never imports credentials", () => {
    const parsed = parseFromTurtle(serializeToTurtle(config));
    const req: any = parsed.tabConfig!.t1.requestConfig;
    expect(req.basicAuth).to.equal(undefined);
    expect(req.bearerAuth).to.equal(undefined);
  });

  it("reports malformed Turtle", () => {
    expect(() => parseFromTurtle("this is not turtle {")).to.throw(/Failed to parse configuration/);
  });

  it("reports Turtle that is not a configuration", () => {
    expect(() => parseFromTurtle("<http://a> <http://b> <http://c> .")).to.throw(/no yasgui:Configuration/);
  });
});
