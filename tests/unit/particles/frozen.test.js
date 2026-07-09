import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("Crackle — reduced motion invariant", () => {
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
    const { Crackle } = await import("../../../js/particles/frozen.js");
    const c = new Crackle();
    c.spawn(100, 200, false);
    const x0 = c.x;
    const y0 = c.y;
    const rot0 = c.rotation;
    c.update();
    expect(c.x).toBe(x0);
    expect(c.y).toBe(y0);
    // Rotation is also motion-bearing — wrapped in scaled() so it
    // freezes too.
    expect(c.rotation).toBe(rot0);
  });

  it("position and rotation advance under full motion", async () => {
    mqlMatches = false;
    const { Crackle } = await import("../../../js/particles/frozen.js");
    const c = new Crackle();
    c.spawn(100, 200, false);
    const x0 = c.x;
    const y0 = c.y;
    const rot0 = c.rotation;
    c.update();
    expect(c.x !== x0 || c.y !== y0).toBe(true);
    expect(c.rotation).not.toBe(rot0);
  });

  it("deactivates after maxLife frames", async () => {
    mqlMatches = false;
    const { Crackle } = await import("../../../js/particles/frozen.js");
    const c = new Crackle();
    c.spawn(0, 0, false);
    // Each spawn rolls its own maxLife, so derive frame count from the
    // instance.  Adding +2 covers the post-maxLife deactivation branch.
    const maxFrames = Math.ceil(c.maxLife) + 2;
    for (let i = 0; i < maxFrames; i++) c.update();
    expect(c.active).toBe(false);
  });

  it("friction decays velocity even under reduced motion", async () => {
    mqlMatches = true;
    const { Crackle } = await import("../../../js/particles/frozen.js");
    const c = new Crackle();
    c.spawn(0, 0, false);
    const vx0 = Math.abs(c.vx);
    const vy0 = Math.abs(c.vy);
    c.update();
    expect(Math.abs(c.vx)).toBeLessThan(vx0);
    expect(Math.abs(c.vy)).toBeLessThan(vy0);
  });

  it("warm flag selects the warm color path in draw", async () => {
    // Verify the warm/cool branch by feeding a spy ctx and asserting
    // fillStyle differs between the two.
    mqlMatches = false;
    const { Crackle } = await import("../../../js/particles/frozen.js");
    const cool = new Crackle();
    const warm = new Crackle();
    cool.spawn(0, 0, false);
    warm.spawn(0, 0, true);

    function makeSpyCtx() {
      const calls = [];
      return {
        save: () => {},
        restore: () => {},
        translate: () => {},
        rotate: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        closePath: () => {},
        fill: () => {},
        stroke: () => {},
        set fillStyle(v) {
          calls.push({ name: "fillStyle", value: v });
        },
        set strokeStyle(v) {},
        set lineWidth(v) {},
        set globalAlpha(v) {},
        calls,
      };
    }
    const coolCtx = makeSpyCtx();
    const warmCtx = makeSpyCtx();
    cool.draw(coolCtx);
    warm.draw(warmCtx);
    const coolFill = coolCtx.calls.find((c) => c.name === "fillStyle").value;
    const warmFill = warmCtx.calls.find((c) => c.name === "fillStyle").value;
    expect(coolFill).not.toBe(warmFill);
  });
});

describe("Snowflake — reduced motion invariant", () => {
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

  it("position, sway, and rotation are invariant when motion is reduced", async () => {
    mqlMatches = true;
    const { Snowflake } = await import("../../../js/particles/frozen.js");
    const s = new Snowflake(CANVAS, {});
    s.vx = 3;
    s.vy = 2;
    const x0 = s.x;
    const y0 = s.y;
    const sway0 = s.sway;
    const rot0 = s.rotation;
    s.update();
    expect(s.x).toBe(x0);
    expect(s.y).toBe(y0);
    expect(s.sway).toBe(sway0);
    expect(s.rotation).toBe(rot0);
  });

  it("friction decays impulse velocity even under reduced motion", async () => {
    mqlMatches = true;
    const { Snowflake } = await import("../../../js/particles/frozen.js");
    const s = new Snowflake(CANVAS, {});
    s.vx = 3;
    s.vy = 2;
    s.update();
    expect(Math.abs(s.vx)).toBeLessThan(3);
    expect(Math.abs(s.vy)).toBeLessThan(2);
  });

  it("falls and sways under full motion", async () => {
    mqlMatches = false;
    const { Snowflake } = await import("../../../js/particles/frozen.js");
    const s = new Snowflake(CANVAS, {});
    const y0 = s.y;
    const sway0 = s.sway;
    s.update();
    expect(s.y).toBeGreaterThan(y0);
    expect(s.sway).not.toBe(sway0);
  });
});
