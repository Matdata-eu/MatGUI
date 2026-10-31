import * as chai from "chai";
import { describe, it } from "mocha";

import {
  getSharedQueryRunBlocker,
  parseJsonParam,
  sharedQueryBlockedMessage,
} from "../../packages/yasgui/src/shareLinkSafety.js";

const expect = chai.expect;

const select = { queryMode: "query" as const, queryValid: true, sendsCredentials: false };

describe("Share link auto-run", () => {
  it("runs a valid read query without credentials", () => {
    expect(getSharedQueryRunBlocker(select)).to.equal(undefined);
  });

  it("never runs an update, in any mode", () => {
    const update = { ...select, queryMode: "update" as const };
    expect(getSharedQueryRunBlocker(update)).to.equal("update");
    expect(getSharedQueryRunBlocker(update, "always")).to.equal("update");
    expect(getSharedQueryRunBlocker(update, "never")).to.equal("disabled");
  });

  it("asks before sending saved credentials", () => {
    expect(getSharedQueryRunBlocker({ ...select, sendsCredentials: true })).to.equal("credentials");
    expect(getSharedQueryRunBlocker({ ...select, sendsCredentials: true }, "always")).to.equal(undefined);
  });

  it("does not run an invalid query, which may be an unrecognised update", () => {
    expect(getSharedQueryRunBlocker({ ...select, queryValid: false })).to.equal("invalid");
  });

  it("runs nothing when disabled", () => {
    expect(getSharedQueryRunBlocker(select, "never")).to.equal("disabled");
  });

  it("names the endpoint when credentials are involved", () => {
    expect(sharedQueryBlockedMessage("credentials", "https://example.org/sparql")).to.contain(
      "https://example.org/sparql",
    );
  });
});

describe("Share link JSON parameters", () => {
  it("parses valid JSON", () => {
    expect(parseJsonParam("headers", '{"X-Test":"1"}')).to.deep.equal({ "X-Test": "1" });
  });

  it("ignores a truncated value instead of throwing", () => {
    const warn = console.warn;
    console.warn = () => {};
    try {
      expect(parseJsonParam("outputSettings", '{"pageSize":')).to.equal(undefined);
    } finally {
      console.warn = warn;
    }
  });
});
