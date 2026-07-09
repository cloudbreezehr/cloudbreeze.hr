import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("Plankton — reduced motion invariant", () => {
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

  const COLOR = [0, 200, 255];

  it("position is invariant across update() when motion is reduced", async () => {
    mqlMatches = true;
    const { Plankton } = await import("../../../js/particles/deep-sea.js");
    const p = new Plankton();
    p.spawn(50, 60, 1, -1, COLOR);
    const x0 = p.x;
    const y0 = p.y;
    p.update();
    expect(p.x).toBe(x0);
    expect(p.y).toBe(y0);
  });

  it("position advances under full motion", async () => {
    mqlMatches = false;
    const { Plankton } = await import("../../../js/particles/deep-sea.js");
    const p = new Plankton();
    p.spawn(50, 60, 1, -1, COLOR);
    const x0 = p.x;
    const y0 = p.y;
    p.update();
    expect(p.x !== x0 || p.y !== y0).toBe(true);
  });

  it("inherits a fraction of jelly velocity on spawn", async () => {
    // INHERIT_VEL is 0.35 by default; with a jelly velocity of (4, 0)
    // the plankton's vx should at minimum carry a chunk of that 1.4 px/f
    // even on top of the random scatter component (which can be ±max).
    // Test the contract loosely: average several spawns to wash out scatter.
    mqlMatches = false;
    const { Plankton } = await import("../../../js/particles/deep-sea.js");
    let sum = 0;
    const N = 200;
    for (let i = 0; i < N; i++) {
      const p = new Plankton();
      p.spawn(0, 0, 4, 0, COLOR);
      sum += p.vx;
    }
    // Average vx should be ≈ 4 * INHERIT_VEL = 1.4 (random scatter
    // averages to zero).  Allow a wide tolerance for sample noise.
    expect(sum / N).toBeGreaterThan(0.5);
  });

  it("deactivates after maxLife frames", async () => {
    mqlMatches = false;
    const { Plankton } = await import("../../../js/particles/deep-sea.js");
    const p = new Plankton();
    p.spawn(0, 0, 0, 0, COLOR);
    const maxFrames = Math.ceil(p.maxLife) + 2;
    for (let i = 0; i < maxFrames; i++) p.update();
    expect(p.active).toBe(false);
  });

  it("friction decays velocity even under reduced motion", async () => {
    mqlMatches = true;
    const { Plankton } = await import("../../../js/particles/deep-sea.js");
    const p = new Plankton();
    p.spawn(0, 0, 5, 5, COLOR);
    const vx0 = Math.abs(p.vx);
    const vy0 = Math.abs(p.vy);
    p.update();
    expect(Math.abs(p.vx)).toBeLessThan(vx0);
    expect(Math.abs(p.vy)).toBeLessThan(vy0);
  });
});

describe("Bubble — reduced motion invariant", () => {
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

  it("position is invariant across update() when motion is reduced", async () => {
    mqlMatches = true;
    const { Bubble } = await import("../../../js/particles/deep-sea.js");
    const b = new Bubble(CANVAS, {});
    b.vx = 2;
    b.vy = -1;
    const x0 = b.x;
    const y0 = b.y;
    b.update();
    expect(b.x).toBe(x0);
    expect(b.y).toBe(y0);
  });

  it("rises under full motion", async () => {
    mqlMatches = false;
    const { Bubble } = await import("../../../js/particles/deep-sea.js");
    const b = new Bubble(CANVAS, {});
    const y0 = b.y;
    b.update();
    expect(b.y).toBeLessThan(y0);
  });

  it("friction decays impulse velocity even under reduced motion", async () => {
    mqlMatches = true;
    const { Bubble } = await import("../../../js/particles/deep-sea.js");
    const b = new Bubble(CANVAS, {});
    b.vx = 2;
    b.vy = -1;
    b.update();
    expect(Math.abs(b.vx)).toBeLessThan(2);
    expect(Math.abs(b.vy)).toBeLessThan(1);
  });
});

describe("Jellyfish — reduced motion invariant", () => {
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

  it("position and pulse are invariant across update() when motion is reduced", async () => {
    mqlMatches = true;
    const { Jellyfish } = await import("../../../js/particles/deep-sea.js");
    const j = new Jellyfish(CANVAS, {});
    j.vx = 1.5;
    j.vy = -2;
    const x0 = j.x;
    const y0 = j.y;
    const pulse0 = j.pulse;
    j.update();
    expect(j.x).toBe(x0);
    expect(j.y).toBe(y0);
    expect(j.pulse).toBe(pulse0);
  });

  it("pulses and drifts under full motion", async () => {
    mqlMatches = false;
    const { Jellyfish } = await import("../../../js/particles/deep-sea.js");
    const j = new Jellyfish(CANVAS, {});
    const pulse0 = j.pulse;
    j.update();
    expect(j.pulse).not.toBe(pulse0);
  });

  it("friction decays impulse velocity even under reduced motion", async () => {
    mqlMatches = true;
    const { Jellyfish } = await import("../../../js/particles/deep-sea.js");
    const j = new Jellyfish(CANVAS, {});
    j.vx = 1.5;
    j.vy = -2;
    j.update();
    expect(Math.abs(j.vx)).toBeLessThan(1.5);
    expect(Math.abs(j.vy)).toBeLessThan(2);
  });
});
