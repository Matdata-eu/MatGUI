import * as chai from "chai";
import { describe, it } from "mocha";

import { getRecentlyUsedTabId, moveTabIdToFront, removeTabId } from "../../packages/yasgui/src/tabNavigationHistory.js";

const expect = chai.expect;

describe("Matgui tab navigation history", () => {
  it("moves selected tab to the front of recent history", () => {
    expect(moveTabIdToFront(["tab-1", "tab-2", "tab-3"], "tab-2")).to.deep.equal(["tab-2", "tab-1", "tab-3"]);
  });

  it("returns previously used tab when navigating backward", () => {
    const recentTabIds = ["tab-1", "tab-2", "tab-3"];
    expect(getRecentlyUsedTabId(recentTabIds, "tab-1", "backward")).to.equal("tab-2");
  });

  it("returns oldest tab when navigating forward through recent history", () => {
    const recentTabIds = ["tab-1", "tab-2", "tab-3"];
    expect(getRecentlyUsedTabId(recentTabIds, "tab-1", "forward")).to.equal("tab-3");
  });

  it("returns undefined when there is no other tab in history", () => {
    expect(getRecentlyUsedTabId(["tab-1"], "tab-1", "backward")).to.equal(undefined);
  });

  it("removes closed tabs from history", () => {
    expect(removeTabId(["tab-1", "tab-2", "tab-3"], "tab-2")).to.deep.equal(["tab-1", "tab-3"]);
  });
});
