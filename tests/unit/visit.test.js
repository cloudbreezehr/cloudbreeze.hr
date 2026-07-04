import { describe, it, expect, beforeEach, vi } from "vitest";

// Return-visit signal: read-and-mark, memoized per load. Module-level memo, so
// each test re-imports against a fresh module.

describe("visit", () => {
  let visit;

  beforeEach(async () => {
    vi.resetModules();
    localStorage.clear();
    visit = await import("../../js/visit.js");
  });

  it("is false on the first ever load", () => {
    expect(visit.isReturnVisit()).toBe(false);
  });

  it("memoizes within a load — a repeat call is not re-read as a return", () => {
    expect(visit.isReturnVisit()).toBe(false);
    // Without memoization the mark from the first call would flip this to true.
    expect(visit.isReturnVisit()).toBe(false);
  });

  it("marks the site so a later load reads as a return", () => {
    visit.isReturnVisit();
    expect(localStorage.getItem("cloudbreeze-visited")).toBe("1");
  });

  it("reads as a return when the flag is already set", () => {
    localStorage.setItem("cloudbreeze-visited", "1");
    expect(visit.isReturnVisit()).toBe(true);
  });

  it("falls open to a return when storage is unavailable", () => {
    const spy = vi
      .spyOn(window.localStorage, "getItem")
      .mockImplementation(() => {
        throw new Error("blocked");
      });
    expect(visit.isReturnVisit()).toBe(true);
    spy.mockRestore();
  });

  it("_resetForTests forgets the memo and the stored flag", () => {
    visit.isReturnVisit();
    visit._resetForTests();
    expect(localStorage.getItem("cloudbreeze-visited")).toBeNull();
    expect(visit.isReturnVisit()).toBe(false);
  });
});
