import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Tests for the bits of js/particles/rain.js that are exported and
// don't need a mounted canvas: Ember (integrates via step() from
// motion.js) and Raindrop (wind/fall deltas through scaled()).

describe("Ember — reduced motion invariant", () => {
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

  it("position is invariant across update() when motion is reduced", async () => {
    mqlMatches = true;
    const { Ember } = await import("../../../js/particles/rain.js");
    const e = new Ember();
    e.spawn(100, 200);
    const x0 = e.x;
    const y0 = e.y;
    e.update();
    expect(e.x).toBe(x0);
    expect(e.y).toBe(y0);
  });

  it("position advances under full motion", async () => {
    mqlMatches = false;
    const { Ember } = await import("../../../js/particles/rain.js");
    const e = new Ember();
    e.spawn(100, 200);
    const x0 = e.x;
    const y0 = e.y;
    e.update();
    // Spawn always emits velocity in an upward cone, so y must decrease
    // and x can drift either side — assert position changed at all.
    expect(e.x !== x0 || e.y !== y0).toBe(true);
  });

  it("deactivates after maxLife frames", async () => {
    mqlMatches = false;
    const { Ember } = await import("../../../js/particles/rain.js");
    const { EMBER } = await import("../../../js/particles/rain.constants.js");
    const e = new Ember();
    e.spawn(0, 0);
    // Worst-case: LIFE_MIN + LIFE_RANGE rounded up.  Drive past it.
    const maxFrames = Math.ceil(EMBER.LIFE_MIN + EMBER.LIFE_RANGE) + 2;
    for (let i = 0; i < maxFrames; i++) e.update();
    expect(e.active).toBe(false);
  });

  it("friction decays velocity even under reduced motion", async () => {
    // Friction is damping decay, not motion budget — coasting embers
    // bleed off velocity even when scale is zero, so a reduced-motion
    // toggle mid-flight doesn't leave them hot.
    mqlMatches = true;
    const { Ember } = await import("../../../js/particles/rain.js");
    const e = new Ember();
    e.spawn(0, 0);
    const vx0 = Math.abs(e.vx);
    const vy0 = Math.abs(e.vy);
    e.update();
    expect(Math.abs(e.vx)).toBeLessThan(vx0);
    expect(Math.abs(e.vy)).toBeLessThan(vy0);
  });
});

describe("Raindrop — reduced motion invariant", () => {
  let mqlMatches;

  beforeEach(() => {
    mqlMatches = false;
    window.matchMedia = vi.fn(() => ({
      get matches() {
        return mqlMatches;
      },
      addEventListener() {},
      removeEventListener() {},
    }));
    vi.resetModules();
  });

  afterEach(() => {
    delete window.matchMedia;
  });

  const CANVAS = { width: 800, height: 600 };
  const NEAR_LAYER = 2;

  it("position is invariant across update() when motion is reduced", async () => {
    mqlMatches = true;
    const { Raindrop } = await import("../../../js/particles/rain.js");
    const d = new Raindrop(CANVAS, NEAR_LAYER);
    d.vx = 2;
    d.vy = 1;
    const x0 = d.x;
    const y0 = d.y;
    d.update(5, 0.5);
    expect(d.x).toBe(x0);
    expect(d.y).toBe(y0);
  });

  it("falls under full motion", async () => {
    mqlMatches = false;
    const { Raindrop } = await import("../../../js/particles/rain.js");
    const d = new Raindrop(CANVAS, NEAR_LAYER);
    const y0 = d.y;
    d.update(0, 0);
    expect(d.y).toBeGreaterThan(y0);
  });

  it("friction decays deflection velocity even under reduced motion", async () => {
    mqlMatches = true;
    const { Raindrop } = await import("../../../js/particles/rain.js");
    const d = new Raindrop(CANVAS, NEAR_LAYER);
    d.vx = 2;
    d.vy = 1;
    d.update(0, 0);
    expect(Math.abs(d.vx)).toBeLessThan(2);
    expect(Math.abs(d.vy)).toBeLessThan(1);
  });
});
