import * as chai from "chai";
import { describe, it } from "mocha";

import InMemoryWorkspaceBackend from "../../packages/yasgui/src/queryManagement/backends/InMemoryWorkspaceBackend.js";
import ReadOnlyWorkspaceBackend from "../../packages/yasgui/src/queryManagement/backends/ReadOnlyWorkspaceBackend.js";
import {
  getWorkspaceBackend,
  registerWorkspaceBackend,
  unregisterWorkspaceBackend,
} from "../../packages/yasgui/src/queryManagement/backends/getWorkspaceBackend.js";
import {
  getWritableWorkspaces,
  isWorkspaceReadOnly,
} from "../../packages/yasgui/src/queryManagement/readOnlyWorkspace.js";
import type { WorkspaceBackend } from "../../packages/yasgui/src/queryManagement/backends/WorkspaceBackend.js";
import type { SparqlWorkspaceConfig } from "../../packages/yasgui/src/queryManagement/types.js";

const expect = chai.expect;

function sparqlWorkspace(id: string, readOnly?: boolean): SparqlWorkspaceConfig {
  return { id, label: id, type: "sparql", endpoint: "https://example.org/sparql", workspaceIri: `urn:${id}`, readOnly };
}

describe("Query management - read-only workspaces", () => {
  it("excludes read-only workspaces from save targets", () => {
    const workspaces = [sparqlWorkspace("a"), sparqlWorkspace("demo", true), sparqlWorkspace("b", false)];

    expect(isWorkspaceReadOnly(workspaces[1])).to.equal(true);
    expect(isWorkspaceReadOnly(workspaces[2])).to.equal(false);
    expect(getWritableWorkspaces(workspaces).map((w) => w.id)).to.deep.equal(["a", "b"]);
  });

  it("allows reading but rejects writes", async () => {
    const inner = new InMemoryWorkspaceBackend();
    await inner.writeQuery("folder/q.sparql", "SELECT 1 WHERE {}", { message: "v1" });
    const backend = new ReadOnlyWorkspaceBackend(inner);

    const entries = await backend.listFolder();
    expect(entries.some((e) => e.kind === "folder" && e.id === "folder")).to.equal(true);
    expect((await backend.readQuery("folder/q.sparql")).queryText).to.equal("SELECT 1 WHERE {}");

    let error: any;
    try {
      await backend.writeQuery("folder/q.sparql", "SELECT 2 WHERE {}");
    } catch (e) {
      error = e;
    }
    expect(error?.code).to.equal("FORBIDDEN");
    expect((await inner.readQuery("folder/q.sparql")).queryText).to.equal("SELECT 1 WHERE {}");
  });

  it("does not expose rename, move or delete", () => {
    const backend: WorkspaceBackend = new ReadOnlyWorkspaceBackend(new InMemoryWorkspaceBackend());

    expect(backend.renameQuery).to.equal(undefined);
    expect(backend.moveQuery).to.equal(undefined);
    expect(backend.deleteQuery).to.equal(undefined);
    expect(backend.renameFolder).to.equal(undefined);
    expect(backend.deleteFolder).to.equal(undefined);
  });

  it("wraps the backend of a read-only workspace", () => {
    const inner = new InMemoryWorkspaceBackend();
    registerWorkspaceBackend("ro", inner);
    registerWorkspaceBackend("rw", inner);
    try {
      expect(getWorkspaceBackend(sparqlWorkspace("ro", true))).to.be.instanceOf(ReadOnlyWorkspaceBackend);
      expect(getWorkspaceBackend(sparqlWorkspace("rw"))).to.equal(inner);
    } finally {
      unregisterWorkspaceBackend("ro");
      unregisterWorkspaceBackend("rw");
    }
  });
});
