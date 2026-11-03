import * as chai from "chai";
import { describe, it, beforeEach, afterEach } from "mocha";

import HttpWorkspaceBackend, {
  clearHttpWorkspaceCache,
} from "../../packages/yasgui/src/queryManagement/backends/HttpWorkspaceBackend.js";
import {
  folderDefaultEndpoint,
  nameFromFileUrl,
  parseHttpWorkspaceManifest,
  parseQueryFile,
} from "../../packages/yasgui/src/queryManagement/backends/httpWorkspaceManifest.js";
import { getWorkspaceBackend } from "../../packages/yasgui/src/queryManagement/backends/getWorkspaceBackend.js";
import { isWorkspaceReadOnly } from "../../packages/yasgui/src/queryManagement/readOnlyWorkspace.js";
import { validateWorkspaceConfig } from "../../packages/yasgui/src/queryManagement/validateWorkspaceConfig.js";
import { getEndpointToAutoSwitch } from "../../packages/yasgui/src/queryManagement/openManagedQuery.js";
import {
  queryIdFromMetadata,
  queryRefFromId,
  versionRefFromTag,
  versionTagFromRef,
} from "../../packages/yasgui/src/queryManagement/queryRefs.js";
import {
  createWorkspaceLink,
  findWebWorkspace,
  getWorkspaceUrlFromLink,
  removeWorkspaceParamFromLink,
} from "../../packages/yasgui/src/queryManagement/workspaceLink.js";
import type { HttpWorkspaceConfig, WorkspaceConfig } from "../../packages/yasgui/src/queryManagement/types.js";

const expect = chai.expect;

const MANIFEST_URL = "https://example.org/queries/workspace.json";

function webWorkspace(manifestUrl = MANIFEST_URL): HttpWorkspaceConfig {
  return { id: "web", label: "Web", type: "http", manifestUrl };
}

describe("Query management - web workspaces", () => {
  describe("manifest", () => {
    it("resolves query URLs relative to the manifest and derives folders from their paths", () => {
      const parsed = parseHttpWorkspaceManifest(
        {
          label: "Example queries",
          endpoints: { era: "https://era.example/sparql" },
          folders: { "era/maps": { label: "Maps" }, era: { label: "ERA", endpoint: "era" } },
          queries: [
            "./era/op.rq",
            "era/maps/lines.rq",
            { url: "top.rq", name: "Top", endpoint: "https://other.example/sparql" },
            { url: "https://elsewhere.example/q.rq" },
            { url: "./misc/x.rq", folder: "/era/" },
            "./era/op.rq",
          ],
          workspaceIri: "ignored",
        },
        `${MANIFEST_URL}?v=2`,
      );

      expect(parsed.label).to.equal("Example queries");
      expect(parsed.queries.map((q) => [q.id, q.url, q.folder])).to.deep.equal([
        ["era/op.rq", "https://example.org/queries/era/op.rq", "era"],
        ["era/maps/lines.rq", "https://example.org/queries/era/maps/lines.rq", "era/maps"],
        ["top.rq", "https://example.org/queries/top.rq", ""],
        ["https://elsewhere.example/q.rq", "https://elsewhere.example/q.rq", ""],
        ["misc/x.rq", "https://example.org/queries/misc/x.rq", "era"],
      ]);
      expect(parsed.queries[2]).to.include({ name: "Top", endpoint: "https://other.example/sparql" });
      expect(folderDefaultEndpoint("era/maps", parsed.folders)).to.equal("era");
      expect(folderDefaultEndpoint("other", parsed.folders)).to.equal(undefined);
    });

    it("rejects a manifest without a queries list or with an unusable entry", () => {
      expect(() => parseHttpWorkspaceManifest([], MANIFEST_URL)).to.throw("JSON object");
      expect(() => parseHttpWorkspaceManifest({ label: "x" }, MANIFEST_URL)).to.throw('"queries"');
      expect(() => parseHttpWorkspaceManifest({ queries: [{ name: "x" }] }, MANIFEST_URL)).to.throw('no "url"');
      expect(() => parseHttpWorkspaceManifest({ queries: ["javascript:alert(1)"] }, MANIFEST_URL)).to.throw("http(s)");
    });

    it("splits the #+ header from the query text", () => {
      const parsed = parseQueryFile(
        "#+ name: Operational points\r\n#+ Description: Per country\n#+ endpoint: era\n\nSELECT * WHERE { ?s ?p ?o }\n# not a header\n",
      );
      expect(parsed.meta).to.deep.equal({ name: "Operational points", description: "Per country", endpoint: "era" });
      expect(parsed.queryText).to.equal("SELECT * WHERE { ?s ?p ?o }\n# not a header\n");

      const plain = "# A comment\nSELECT 1 WHERE {}";
      expect(parseQueryFile(plain)).to.deep.equal({ meta: {}, queryText: plain });
    });

    it("makes a readable name from a file name", () => {
      expect(nameFromFileUrl("https://x/y/operational-points_per%20country.rq")).to.equal(
        "operational points per country",
      );
      expect(nameFromFileUrl("https://x/y/q.sparql?raw=1")).to.equal("q");
    });
  });

  describe("backend", () => {
    const files: Record<string, string> = {};
    const requested: string[] = [];
    let originalFetch: typeof fetch;

    beforeEach(() => {
      clearHttpWorkspaceCache();
      requested.length = 0;
      for (const key of Object.keys(files)) delete files[key];
      originalFetch = globalThis.fetch;
      globalThis.fetch = (async (url: string, init?: RequestInit) => {
        requested.push(url);
        expect(init?.credentials).to.equal("omit");
        if (!(url in files)) return new Response("not found", { status: 404 });
        return new Response(files[url], { status: 200 });
      }) as typeof fetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
      clearHttpWorkspaceCache();
    });

    function publish() {
      files[MANIFEST_URL] = JSON.stringify({
        label: "Example queries",
        description: "Published as files",
        endpoints: { era: "https://era.example/sparql" },
        folders: { era: { label: "ERA", endpoint: "era" }, empty: { label: "Nothing here" } },
        queries: [
          "era/op.rq",
          "era/maps/lines.rq",
          { url: "hello.rq", name: "Hello from the manifest", description: "Manifest description" },
          "missing.rq",
        ],
      });
      files["https://example.org/queries/era/op.rq"] =
        "#+ name: Operational points\n#+ description: Per country\nSELECT * WHERE { ?op a ?type }\n";
      files["https://example.org/queries/era/maps/lines.rq"] =
        "#+ name: Lines\n#+ endpoint: https://maps.example/sparql\nSELECT ?line WHERE { ?line ?p ?o }\n";
      files["https://example.org/queries/hello.rq"] = "#+ name: Hello\n#+ endpoint: era\nSELECT ('hello' AS ?x) {}\n";
    }

    it("lists folders and queries with names from the manifest, the file header or the file name", async () => {
      publish();
      const backend = new HttpWorkspaceBackend(webWorkspace());

      const root = await backend.listFolder();
      expect(root.map((e) => [e.kind, e.id, e.label])).to.deep.equal([
        ["folder", "era", "ERA"],
        ["query", "hello.rq", "Hello from the manifest"],
        ["query", "missing.rq", "missing"],
      ]);

      const era = await backend.listFolder("era");
      expect(era.map((e) => [e.kind, e.id, e.label, e.parentId])).to.deep.equal([
        ["folder", "era/maps", "maps", "era"],
        ["query", "era/op.rq", "Operational points", "era"],
      ]);

      const found = await backend.searchByName("LINE");
      expect(found.map((e) => e.id)).to.deep.equal(["era/maps/lines.rq"]);
    });

    it("reads a query without its header, with the endpoint from the entry, the header or the folder", async () => {
      publish();
      const backend = new HttpWorkspaceBackend(webWorkspace());

      const op = await backend.readQuery("era/op.rq");
      expect(op).to.deep.equal({
        queryText: "SELECT * WHERE { ?op a ?type }\n",
        description: "Per country",
        associatedEndpoint: "https://era.example/sparql",
      });
      expect((await backend.readQuery("era/maps/lines.rq")).associatedEndpoint).to.equal("https://maps.example/sparql");
      const hello = await backend.readQuery("hello.rq");
      expect(hello).to.include({
        description: "Manifest description",
        associatedEndpoint: "https://era.example/sparql",
      });

      expect(getEndpointToAutoSwitch("http", op)).to.equal("https://era.example/sparql");
      expect(backend.getQueryUri("era/op.rq")).to.equal("https://example.org/queries/era/op.rq");
      expect(await backend.listVersions("era/op.rq")).to.deep.equal([]);
    });

    it("fetches the manifest and the files once, and reports what is missing", async () => {
      publish();
      const backend = new HttpWorkspaceBackend(webWorkspace());
      await backend.listFolder();
      await new HttpWorkspaceBackend(webWorkspace()).listFolder();
      expect(requested.filter((u) => u === MANIFEST_URL)).to.have.length(1);

      const missing = await backend.readQuery("missing.rq").catch((e) => e);
      expect(missing).to.include({ name: "WorkspaceBackendError", code: "NOT_FOUND" });
      const unknown = await backend.readQuery("nope.rq").catch((e) => e);
      expect(unknown).to.include({ code: "NOT_FOUND" });

      const noManifest = await new HttpWorkspaceBackend(webWorkspace("https://example.org/none/workspace.json"))
        .validateAccess()
        .catch((e) => e);
      expect(noManifest).to.include({ code: "NOT_FOUND" });

      files["https://example.org/bad/workspace.json"] = "{ not json";
      const bad = await new HttpWorkspaceBackend(webWorkspace("https://example.org/bad/workspace.json"))
        .validateAccess()
        .catch((e) => e);
      expect(bad.message).to.contain("not valid JSON");
    });

    it("is always read-only", async () => {
      publish();
      const config = webWorkspace();
      expect(isWorkspaceReadOnly(config)).to.equal(true);
      const backend = getWorkspaceBackend(config);
      expect(backend.type).to.equal("http");
      expect(backend.renameQuery).to.equal(undefined);
      expect(backend.deleteQuery).to.equal(undefined);
      const err = await backend.writeQuery("era/op.rq", "SELECT 1 {}").catch((e) => e);
      expect(err).to.include({ code: "FORBIDDEN" });
      expect((await backend.readQuery("era/op.rq")).queryText).to.contain("?op a ?type");
    });
  });

  it("validates the workspace.json URL", () => {
    expect(validateWorkspaceConfig(webWorkspace()).valid).to.equal(true);
    expect(validateWorkspaceConfig(webWorkspace("")).errors).to.deep.equal([
      "Web workspace URL (workspace.json) is required",
    ]);
    expect(validateWorkspaceConfig(webWorkspace("ftp://x/workspace.json")).valid).to.equal(false);
    expect(validateWorkspaceConfig(webWorkspace("not a url")).valid).to.equal(false);
  });

  it("stores a path reference without versions for web workspace queries", () => {
    const ref = queryRefFromId("http", "era/op.rq");
    expect(ref).to.deep.equal({ path: "era/op.rq" });
    expect(queryIdFromMetadata({ workspaceId: "web", backendType: "http", queryRef: ref })).to.equal("era/op.rq");
    expect(versionRefFromTag("http", "abc")).to.equal(undefined);
    expect(queryRefFromId("sparql", "urn:q")).to.deep.equal({ managedQueryIri: "urn:q" });
    expect(versionRefFromTag("git", "sha")).to.deep.equal({ commitSha: "sha" });
    expect(versionTagFromRef("sparql", { managedQueryVersionIri: "urn:v" })).to.equal("urn:v");
  });

  describe("workspace links", () => {
    it("reads the workspace parameter from the query string or the hash", () => {
      expect(getWorkspaceUrlFromLink(`https://matgui.example/?workspace=${encodeURIComponent(MANIFEST_URL)}`)).to.equal(
        MANIFEST_URL,
      );
      expect(
        getWorkspaceUrlFromLink(`https://matgui.example/#query=x&workspace=${encodeURIComponent(MANIFEST_URL)}`),
      ).to.equal(MANIFEST_URL);
      expect(getWorkspaceUrlFromLink("https://matgui.example/?workspace=javascript:alert(1)")).to.equal(undefined);
      expect(getWorkspaceUrlFromLink("https://matgui.example/?workspace=relative/workspace.json")).to.equal(undefined);
      expect(getWorkspaceUrlFromLink("https://matgui.example/")).to.equal(undefined);
    });

    it("removes the parameter and builds links", () => {
      const link = createWorkspaceLink("https://matgui.example/app/?lang=en#query=x", MANIFEST_URL);
      expect(link).to.equal(`https://matgui.example/app/?lang=en&workspace=${encodeURIComponent(MANIFEST_URL)}`);
      expect(getWorkspaceUrlFromLink(link)).to.equal(MANIFEST_URL);
      expect(removeWorkspaceParamFromLink(link)).to.equal("https://matgui.example/app/?lang=en");
      expect(removeWorkspaceParamFromLink("https://m.example/#workspace=x&query=y")).to.equal(
        "https://m.example/#query=y",
      );
    });

    it("finds a configured web workspace by its URL", () => {
      const workspaces: WorkspaceConfig[] = [
        { id: "s", label: "S", type: "sparql", endpoint: "https://e/sparql", workspaceIri: "urn:s" },
        webWorkspace(),
      ];
      expect(findWebWorkspace(workspaces, MANIFEST_URL)?.id).to.equal("web");
      expect(findWebWorkspace(workspaces, "https://example.org/other/workspace.json")).to.equal(undefined);
    });
  });
});
