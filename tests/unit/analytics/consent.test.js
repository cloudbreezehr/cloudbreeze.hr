import { describe, it, expect, beforeEach, vi } from "vitest";

// consent.js reads navigator.doNotTrack and localStorage on every call, so
// no module-level memoization to reset.  We still do vi.resetModules() per
// test to stay consistent with the repo pattern.

describe("analytics/consent", () => {
  let consent;

  beforeEach(async () => {
    localStorage.clear();
    vi.resetModules();
    // Reset DNT to default (unspecified).
    Object.defineProperty(navigator, "doNotTrack", {
      configurable: true,
      get: () => null,
    });
    consent = await import("../../../js/analytics/consent.js");
  });

  it("allowed() returns true by default", () => {
    expect(consent.allowed()).toBe(true);
  });

  it("allowed() is false when DNT is enabled", () => {
    Object.defineProperty(navigator, "doNotTrack", {
      configurable: true,
      get: () => "1",
    });
    expect(consent.allowed()).toBe(false);
  });

  it("allowed() is false after optOut()", () => {
    consent.optOut();
    expect(consent.isOptedOut()).toBe(true);
    expect(consent.allowed()).toBe(false);
  });

  it("optIn() clears the opt-out flag", () => {
    consent.optOut();
    consent.optIn();
    expect(consent.isOptedOut()).toBe(false);
    expect(consent.allowed()).toBe(true);
  });
});
