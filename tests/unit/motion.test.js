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

describe("motion — motionScale", () => {
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

  it("returns 1 when motion is allowed", async () => {
    mqlMatches = false;
    const { motionScale } = await import("../../js/motion.js");
    expect(motionScale()).toBe(1);
  });

  it("returns 0 when motion is reduced", async () => {
    mqlMatches = true;
    const { motionScale } = await import("../../js/motion.js");
    expect(motionScale()).toBe(0);
  });

  it("tracks mid-session toggles without caching", async () => {
    mqlMatches = false;
    const { motionScale } = await import("../../js/motion.js");
    expect(motionScale()).toBe(1);
    mqlListeners.forEach((fn) => fn({ matches: true }));
    expect(motionScale()).toBe(0);
    mqlListeners.forEach((fn) => fn({ matches: false }));
    expect(motionScale()).toBe(1);
  });
});

describe("motion — reducedDuration", () => {
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

  it("passes through the input ms when motion is allowed", async () => {
    mqlMatches = false;
    const { reducedDuration } = await import("../../js/motion.js");
    expect(reducedDuration(1000)).toBe(1000);
    expect(reducedDuration(0)).toBe(0);
    expect(reducedDuration(123.5)).toBe(123.5);
  });

  it("collapses to 0 when motion is reduced", async () => {
    mqlMatches = true;
    const { reducedDuration } = await import("../../js/motion.js");
    expect(reducedDuration(1000)).toBe(0);
    expect(reducedDuration(0)).toBe(0);
    expect(reducedDuration(99999)).toBe(0);
  });

  it("tracks mid-session toggles without caching", async () => {
    mqlMatches = false;
    const { reducedDuration } = await import("../../js/motion.js");
    expect(reducedDuration(500)).toBe(500);
    mqlListeners.forEach((fn) => fn({ matches: true }));
    expect(reducedDuration(500)).toBe(0);
    mqlListeners.forEach((fn) => fn({ matches: false }));
    expect(reducedDuration(500)).toBe(500);
  });
});
