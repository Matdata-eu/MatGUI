import * as chai from "chai";
import { describe, it, beforeEach, afterEach } from "mocha";
import store from "store";

import Storage, { isQuotaExceeded } from "../../packages/utils/src/Storage.js";

const expect = chai.expect;

describe("Storage", () => {
  let original: typeof store.set;
  beforeEach(() => {
    original = store.set;
  });
  afterEach(() => {
    store.set = original;
  });

  it("recognises quota errors from current and older browsers", () => {
    expect(isQuotaExceeded({ name: "QuotaExceededError", code: 22 })).to.equal(true);
    expect(isQuotaExceeded({ name: "NS_ERROR_DOM_QUOTA_REACHED", code: 1014 })).to.equal(true);
    expect(isQuotaExceeded({ name: "TypeError" })).to.equal(false);
    expect(isQuotaExceeded(undefined)).to.equal(false);
  });

  it("lets the quota callback handle a full storage without throwing", function () {
    if (!store.enabled) this.skip();
    (store as any).set = () => {
      const error = new Error("full");
      error.name = "QuotaExceededError";
      throw error;
    };
    let handled = 0;
    const storage = new Storage("test");
    expect(() => storage.set("key", { a: 1 }, 60, () => handled++)).to.not.throw();
    expect(handled).to.equal(1);
  });

  it("still throws errors that are not about the quota", function () {
    if (!store.enabled) this.skip();
    (store as any).set = () => {
      throw new TypeError("circular");
    };
    const storage = new Storage("test");
    expect(() => storage.set("key", { a: 1 }, 60, () => {})).to.throw(TypeError);
  });
});
