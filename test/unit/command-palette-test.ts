import * as chai from "chai";
import { describe, it } from "mocha";

import InMemoryWorkspaceBackend from "../../packages/yasgui/src/queryManagement/backends/InMemoryWorkspaceBackend.js";
import { listManagedQueries } from "../../packages/yasgui/src/queryManagement/listManagedQueries.js";
import { scorePaletteItem } from "../../packages/yasgui/src/paletteSearch.js";

const expect = chai.expect;

describe("Command palette search", () => {
  it("matches every word of the query in the label, the detail or the keywords", () => {
    const item = { label: "Long tunnels", detail: "ERA / rinf / tunnels", keywords: "" };
    expect(scorePaletteItem(item, "tun")).to.be.greaterThan(0);
    expect(scorePaletteItem(item, "rinf long")).to.be.greaterThan(0);
    expect(scorePaletteItem(item, "bridges")).to.equal(-1);
    expect(
      scorePaletteItem({ label: "Settings: Prefixes", keywords: "preferences namespaces" }, "namespaces"),
    ).to.equal(0);
  });

  it("ranks a label that starts with the query above a match in the detail", () => {
    const byLabel = scorePaletteItem({ label: "Format query" }, "format");
    const inDetail = scorePaletteItem({ label: "Long tunnels", detail: "format checks" }, "format");
    expect(byLabel).to.be.greaterThan(inDetail);
  });

  it("lists the queries of a workspace with their folders", async () => {
    const backend = new InMemoryWorkspaceBackend();
    await backend.writeQuery("root.sparql", "SELECT * WHERE { ?s ?p ?o }", { message: "init" });
    await backend.writeQuery("rinf/tunnels/long.sparql", "SELECT 1 WHERE {}", { message: "init" });

    const queries = await listManagedQueries(backend);
    const long = queries.find((q) => q.id === "rinf/tunnels/long.sparql");
    expect(queries).to.have.length(2);
    expect(long?.folders).to.deep.equal(["rinf", "tunnels"]);
    expect(queries.find((q) => q.id === "root.sparql")?.folders).to.deep.equal([]);
  });
});
