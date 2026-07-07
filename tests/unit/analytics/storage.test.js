import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The defensive Web Storage wrappers every other analytics module builds on.
// Contract: reads return the value or null, writes round-trip, and nothing
// ever throws — even where localStorage itself does (private-mode Safari,
// blocked storage), since analytics must never break the page.

describe("analytics/storage", () => {
  let mod;

  beforeEach(async () => {
    vi.resetModules();
    localStorage.clear();
    sessionStorage.clear();
    mod = await import("../../../js/analytics/storage.js");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("namespaces every key under the analytics prefix", () => {
    for (const key of Object.values(mod.KEYS)) {
      expect(key.startsWith("cb_analytics_")).toBe(true);
    }
  });

  it("round-trips through localGet / localSet / localRemove", () => {
    mod.localSet(mod.KEYS.VISIT_COUNT, "3");
    expect(mod.localGet(mod.KEYS.VISIT_COUNT)).toBe("3");
    mod.localRemove(mod.KEYS.VISIT_COUNT);
    expect(mod.localGet(mod.KEYS.VISIT_COUNT)).toBeNull();
  });

  it("round-trips through sessionGet / sessionSet", () => {
    mod.sessionSet(mod.KEYS.SESSION_ID, "abc");
    expect(mod.sessionGet(mod.KEYS.SESSION_ID)).toBe("abc");
  });

  it("returns null and stays silent when localStorage throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    });
    expect(mod.localGet("k")).toBeNull();
    expect(() => mod.localSet("k", "v")).not.toThrow();
    expect(() => mod.localRemove("k")).not.toThrow();
  });

  it("returns null and stays silent when sessionStorage throws", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(mod.sessionGet("k")).toBeNull();
    expect(() => mod.sessionSet("k", "v")).not.toThrow();
  });
});
