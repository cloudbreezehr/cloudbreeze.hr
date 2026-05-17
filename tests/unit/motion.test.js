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

describe("motion — scaled", () => {
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

  it("returns the input value when motion is allowed", async () => {
    mqlMatches = false;
    const { scaled } = await import("../../js/motion.js");
    expect(scaled(7)).toBe(7);
    expect(scaled(0)).toBe(0);
    expect(scaled(-3.5)).toBe(-3.5);
  });

  it("returns zero when motion is reduced", async () => {
    mqlMatches = true;
    const { scaled } = await import("../../js/motion.js");
    expect(scaled(7)).toBe(0);
    expect(scaled(-3.5)).toBe(-0);
    expect(scaled(99999)).toBe(0);
  });

  it("tracks mid-session toggles without caching", async () => {
    mqlMatches = false;
    const { scaled } = await import("../../js/motion.js");
    expect(scaled(10)).toBe(10);
    mqlListeners.forEach((fn) => fn({ matches: true }));
    expect(scaled(10)).toBe(0);
    mqlListeners.forEach((fn) => fn({ matches: false }));
    expect(scaled(10)).toBe(10);
  });
});

describe("motion — chance", () => {
  let mqlListeners;
  let mqlMatches;
  let randomSpy;

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
    if (randomSpy) randomSpy.mockRestore();
  });

  it("returns true when Math.random() is below the threshold under full motion", async () => {
    mqlMatches = false;
    randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.1);
    const { chance } = await import("../../js/motion.js");
    expect(chance(0.5)).toBe(true);
  });

  it("returns false when Math.random() is at or above the threshold under full motion", async () => {
    mqlMatches = false;
    randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.6);
    const { chance } = await import("../../js/motion.js");
    expect(chance(0.5)).toBe(false);
  });

  it("returns false unconditionally when motion is reduced", async () => {
    mqlMatches = true;
    randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    const { chance } = await import("../../js/motion.js");
    // Even Math.random() === 0 with a full-probability threshold returns
    // false, because p * motionScale() collapses to 0.
    expect(chance(1)).toBe(false);
    expect(chance(0.5)).toBe(false);
  });

  it("tracks mid-session toggles without caching", async () => {
    mqlMatches = false;
    randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.1);
    const { chance } = await import("../../js/motion.js");
    expect(chance(0.5)).toBe(true);
    mqlListeners.forEach((fn) => fn({ matches: true }));
    expect(chance(0.5)).toBe(false);
    mqlListeners.forEach((fn) => fn({ matches: false }));
    expect(chance(0.5)).toBe(true);
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
