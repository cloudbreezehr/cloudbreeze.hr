import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Firefly is blocky's ambient particle — one class, two drawings (firefly
// at night, butterfly by day). Motion policy: every per-frame delta goes
// through scaled(), friction stays unwrapped, so reduced motion freezes
// position and phase while coasting velocity still bleeds off.

const CANVAS = { width: 800, height: 600 };

describe("Firefly — reduced motion invariant", () => {
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

  it("position and phase are invariant across update() when motion is reduced", async () => {
    mqlMatches = true;
    const { Firefly } = await import("../../../js/particles/blocky.js");
    const f = new Firefly(CANVAS);
    f.vx = 2;
    f.vy = -1;
    const x0 = f.x;
    const y0 = f.y;
    const phase0 = f.phase;
    const flap0 = f.flapPhase;
    f.update();
    expect(f.x).toBe(x0);
    expect(f.y).toBe(y0);
    expect(f.phase).toBe(phase0);
    expect(f.flapPhase).toBe(flap0);
  });

  it("friction decays seeded velocity even under reduced motion", async () => {
    mqlMatches = true;
    const { Firefly } = await import("../../../js/particles/blocky.js");
    const f = new Firefly(CANVAS);
    f.vx = 2;
    f.vy = -1;
    f.update();
    expect(Math.abs(f.vx)).toBeLessThan(2);
    expect(Math.abs(f.vy)).toBeLessThan(1);
  });

  it("moves and pulses under full motion", async () => {
    mqlMatches = false;
    const { Firefly } = await import("../../../js/particles/blocky.js");
    const f = new Firefly(CANVAS);
    f.vx = 2;
    f.vy = 1;
    const x0 = f.x;
    const phase0 = f.phase;
    f.update();
    expect(f.x).not.toBe(x0);
    expect(f.phase).not.toBe(phase0);
  });

  it("respawns after drifting past the canvas floor", async () => {
    mqlMatches = false;
    const { Firefly } = await import("../../../js/particles/blocky.js");
    const f = new Firefly(CANVAS);
    f.y = CANVAS.height * 100;
    f.update();
    expect(f.y).toBeLessThanOrEqual(CANVAS.height);
  });
});
