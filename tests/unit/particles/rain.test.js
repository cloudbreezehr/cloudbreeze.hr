import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Tests for the bits of js/particles/rain.js that are exported and
// don't need a mounted canvas — currently just the Ember class, which
// owns its own integration via step() from motion.js.

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
