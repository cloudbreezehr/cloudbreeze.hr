import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// motion.js reads the media query at import time and updates on "change".
// We stub matchMedia before importing, then use vi.resetModules to ensure
// the module re-evaluates for each test with the current stub.

describe("motion — prefersReducedMotion", () => {
  let mqlListeners;
  let mqlMatches;

  beforeEach(() => {
    mqlListeners = [];
    mqlMatches = false;
    window.matchMedia = vi.fn(() => ({
      get matches() {
        return mqlMatches;
      },
      addEventListener: (type, listener) => {
        if (type === "change") mqlListeners.push(listener);
      },
      removeEventListener: vi.fn(),
    }));
    vi.resetModules();
  });

  afterEach(() => {
    delete window.matchMedia;
  });

  it("reports the initial media-query value", async () => {
    mqlMatches = true;
    const { prefersReducedMotion } = await import("../../js/motion.js");
    expect(prefersReducedMotion()).toBe(true);
  });

  it("defaults to false when the user has not set a preference", async () => {
    mqlMatches = false;
    const { prefersReducedMotion } = await import("../../js/motion.js");
    expect(prefersReducedMotion()).toBe(false);
  });

  it("updates when the media query fires a change event", async () => {
    mqlMatches = false;
    const { prefersReducedMotion } = await import("../../js/motion.js");
    expect(prefersReducedMotion()).toBe(false);

    // Simulate the OS toggling reduce-motion while the page is open.
    mqlListeners.forEach((fn) => fn({ matches: true }));
    expect(prefersReducedMotion()).toBe(true);

    mqlListeners.forEach((fn) => fn({ matches: false }));
    expect(prefersReducedMotion()).toBe(false);
  });
});
