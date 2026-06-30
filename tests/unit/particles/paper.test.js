import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("Shaving — reduced motion invariant", () => {
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

  const INK = [26, 21, 18];

  it("position is invariant across update() when motion is reduced", async () => {
    mqlMatches = true;
    const { Shaving } = await import("../../../js/particles/paper.js");
    const s = new Shaving();
    s.spawn(50, 60, INK);
    const x0 = s.x;
    const y0 = s.y;
    const rot0 = s.rotation;
    const vy0 = s.vy;
    s.update();
    expect(s.x).toBe(x0);
    expect(s.y).toBe(y0);
    // Rotation also wrapped in scaled() — freezes.
    expect(s.rotation).toBe(rot0);
    // Gravity is also wrapped in scaled() — vy doesn't accumulate
    // downward velocity invisibly while motion is paused.
    expect(s.vy).toBe(vy0);
  });

  it("position advances and gravity accumulates under full motion", async () => {
    mqlMatches = false;
    const { Shaving } = await import("../../../js/particles/paper.js");
    const s = new Shaving();
    s.spawn(50, 60, INK);
    const x0 = s.x;
    const y0 = s.y;
    const vy0 = s.vy;
    s.update();
    expect(s.x !== x0 || s.y !== y0).toBe(true);
    // Gravity adds downward velocity each frame.
    expect(s.vy).toBeGreaterThan(vy0);
  });

  it("deactivates after maxLife frames", async () => {
    mqlMatches = false;
    const { Shaving } = await import("../../../js/particles/paper.js");
    const s = new Shaving();
    s.spawn(0, 0, INK);
    const maxFrames = Math.ceil(s.maxLife) + 2;
    for (let i = 0; i < maxFrames; i++) s.update();
    expect(s.active).toBe(false);
  });

  it("draws with the ink color provided at spawn", async () => {
    mqlMatches = false;
    const { Shaving } = await import("../../../js/particles/paper.js");
    const s = new Shaving();
    s.spawn(0, 0, [42, 84, 168]);

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
        set fillStyle(v) {
          calls.push({ name: "fillStyle", value: v });
        },
        set globalAlpha(v) {},
        calls,
      };
    }
    const ctx = makeSpyCtx();
    s.draw(ctx);
    const fill = ctx.calls.find((c) => c.name === "fillStyle").value;
    expect(fill).toBe("rgb(42,84,168)");
  });
});

describe("InkDot — paper sketch smudge", () => {
  let mqlMatches;

  beforeEach(() => {
    mqlMatches = false;
    window.matchMedia = vi.fn(() => ({
      get matches() {
        return mqlMatches;
      },
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    vi.resetModules();
  });

  afterEach(() => {
    delete window.matchMedia;
  });

  // A click landing right next to the dot, strong enough to push it.
  function clickForces() {
    return {
      clickImpulse: { x: 60, y: 60, strength: 6 },
      isDragging: false,
      dragPos: { x: 0, y: 0 },
      holdStrength: 0,
      wellStrength: 0,
    };
  }

  function idleForces() {
    return {
      clickImpulse: { x: 0, y: 0, strength: 0 },
      isDragging: false,
      dragPos: { x: 0, y: 0 },
      holdStrength: 0,
      wellStrength: 0,
    };
  }

  it("does not move when motion is reduced", async () => {
    mqlMatches = true;
    const { InkDot } = await import("../../../js/particles/paper.js");
    const d = new InkDot(100, 100, 1, false);
    d.update(clickForces());
    d.update(clickForces());
    expect(d.x).toBe(100);
    expect(d.y).toBe(100);
  });

  it("smudges away from a click under full motion", async () => {
    mqlMatches = false;
    const { InkDot } = await import("../../../js/particles/paper.js");
    const d = new InkDot(100, 100, 1, false);
    d.update(clickForces());
    expect(d.x !== 100 || d.y !== 100).toBe(true);
  });

  it("settles back toward home after being pushed", async () => {
    mqlMatches = false;
    const { InkDot } = await import("../../../js/particles/paper.js");
    const d = new InkDot(100, 100, 1, false);
    d.update(clickForces());
    const pushed = Math.hypot(d.x - 100, d.y - 100);
    for (let i = 0; i < 200; i++) d.update(idleForces());
    const settled = Math.hypot(d.x - 100, d.y - 100);
    expect(settled).toBeLessThan(pushed);
  });
});
