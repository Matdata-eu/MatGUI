import * as chai from "chai";
import { describe, it } from "mocha";

import { deduplicatePrefixes } from "../../packages/yasgui/src/prefixUtils.js";

const expect = chai.expect;

describe("Matgui prefix utilities", () => {
  it("deduplicates the default prefix used for base IRIs", () => {
    const prefixes = [
      "PREFIX : <http://example.org/>",
      "PREFIX ex: <http://example.com/ns#>",
      "PREFIX : <http://example.org/>",
      "PREFIX ex: <http://example.com/ns#>",
    ].join("\n");

    expect(deduplicatePrefixes(prefixes)).to.equal(
      ["PREFIX : <http://example.org/>", "PREFIX ex: <http://example.com/ns#>"].join("\n"),
    );
  });
});
