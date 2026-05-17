import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Test stub: Dust uses module-scoped _canvas/_ctx populated by
// createUpsideDown.  The class itself reads _canvas.width/height in
// spawn() and update().  Calling Dust.spawn() without a factory init
// would crash, so each test that exercises a Dust instance has to
// drive it via createUpsideDown — which itself is straightforward to
// stand up with a minimal fake canvas.

function makeFakeCanvas(w = 800, h = 600) {
  return { width: w, height: h };
}

function makeForces() {
  return {
    clickImpulse: { x: 0, y: 0, strength: 0 },
    isDragging: false,
    dragPos: { x: 0, y: 0 },
    holdStrength: 0,
    wellStrength: 0,
    hover: { x: 0, y: 0, active: false },
  };
}

describe("Dust — anti-gravity mote", () => {
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

  it("spawn places mote within the configured band at canvas-data top", async () => {
    mqlMatches = false;
    const { Dust, DUST, createUpsideDown } =
      await import("../../../js/particles/upside-down.js");
    const canvas = makeFakeCanvas();
    // Initialize module-scoped canvas refs by constructing the factory.
    createUpsideDown(canvas, {});
    const d = new Dust();
    d.spawn();
    expect(d.y).toBeGreaterThanOrEqual(0);
    // Mote y must land inside the spawn band; tighten the bound to the
    // configured constant so a future regression that broadens the band
    // gets caught.  Math.random() is exclusive of 1, so y is strictly
    // less than band; tests use the same exclusive bound.
    expect(d.y).toBeLessThan(canvas.height * DUST.SPAWN_BAND_FRAC);
    expect(d.x).toBeGreaterThanOrEqual(0);
    expect(d.x).toBeLessThanOrEqual(canvas.width);
  });

  it("position is invariant across update() when motion is reduced", async () => {
    mqlMatches = true;
    const { Dust, createUpsideDown } =
      await import("../../../js/particles/upside-down.js");
    createUpsideDown(makeFakeCanvas(), {});
    const d = new Dust();
    d.spawn();
    const x0 = d.x;
    const y0 = d.y;
    const phase0 = d.swayPhase;
    d.update();
    expect(d.x).toBe(x0);
    expect(d.y).toBe(y0);
    // Sway phase is also motion — wrapped in scaled() so it freezes too.
    expect(d.swayPhase).toBe(phase0);
  });

  it("position drifts toward larger y under full motion (visually upward in flipped view)", async () => {
    mqlMatches = false;
    const { Dust, createUpsideDown } =
      await import("../../../js/particles/upside-down.js");
    createUpsideDown(makeFakeCanvas(), {});
    const d = new Dust();
    d.spawn();
    const y0 = d.y;
    // A handful of frames lets sway average out and the lift
    // contribution dominate.
    for (let i = 0; i < 20; i++) d.update();
    expect(d.y).toBeGreaterThan(y0);
  });

  it("deactivates when drifting past canvas.height", async () => {
    mqlMatches = false;
    const { Dust, createUpsideDown } =
      await import("../../../js/particles/upside-down.js");
    const canvas = makeFakeCanvas(800, 100);
    createUpsideDown(canvas, {});
    const d = new Dust();
    d.spawn();
    // Drive past the cull threshold.  Lift is 0.25-0.7 px/frame; with
    // canvas.height=100 even worst-case takes only a few hundred frames.
    for (let i = 0; i < 600; i++) d.update();
    expect(d.active).toBe(false);
  });

  it("friction decays vx/vy even under reduced motion", async () => {
    mqlMatches = true;
    const { Dust, createUpsideDown } =
      await import("../../../js/particles/upside-down.js");
    createUpsideDown(makeFakeCanvas(), {});
    const d = new Dust();
    d.spawn();
    d.vx = 5;
    d.vy = -5;
    const vx0 = Math.abs(d.vx);
    const vy0 = Math.abs(d.vy);
    d.update();
    expect(Math.abs(d.vx)).toBeLessThan(vx0);
    expect(Math.abs(d.vy)).toBeLessThan(vy0);
  });

  it("factory.draw spawns motes over time and never throws on a minimal ctx", async () => {
    mqlMatches = false;
    const { createUpsideDown } =
      await import("../../../js/particles/upside-down.js");
    // Fake ctx covering every method the draw path touches.
    const ctx = {
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      arc: () => {},
      fill: () => {},
      createRadialGradient: () => ({ addColorStop: () => {} }),
      translate: () => {},
      rotate: () => {},
      moveTo: () => {},
      lineTo: () => {},
      closePath: () => {},
      set fillStyle(v) {},
      set globalAlpha(v) {},
    };
    const ud = createUpsideDown(makeFakeCanvas(), ctx);
    const forces = makeForces();
    // Run enough frames that the chance() roll fires at least once
    // statistically.  P(no spawn in 200 frames at 0.15) ≈ 1e-14.
    for (let i = 0; i < 200; i++) ud.draw(forces);
    // No assertion beyond "didn't throw" — the factory's contract is
    // ambient spawn + render with no exceptions.
  });
});

describe("Debris — scroll-driven scrap", () => {
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

  it("spawn assigns position, velocity, polygon vertices, and life", async () => {
    mqlMatches = false;
    const { Debris, createUpsideDown } =
      await import("../../../js/particles/upside-down.js");
    createUpsideDown(makeFakeCanvas(), {});
    const d = new Debris();
    d.spawn(2);
    expect(d.active).toBe(true);
    expect(d.x).toBeGreaterThanOrEqual(0);
    expect(d.x).toBeLessThanOrEqual(800);
    expect(d.y).toBeGreaterThanOrEqual(0);
    expect(d.y).toBeLessThanOrEqual(600);
    expect(d.verts.length).toBeGreaterThanOrEqual(3);
    expect(d.maxLife).toBeGreaterThan(0);
  });

  it("position is invariant across update() when motion is reduced", async () => {
    mqlMatches = true;
    const { Debris, createUpsideDown } =
      await import("../../../js/particles/upside-down.js");
    createUpsideDown(makeFakeCanvas(), {});
    const d = new Debris();
    d.spawn(2);
    const x0 = d.x;
    const y0 = d.y;
    const rot0 = d.rotation;
    d.update();
    expect(d.x).toBe(x0);
    expect(d.y).toBe(y0);
    expect(d.rotation).toBe(rot0);
  });

  it("position and rotation advance under full motion with deterministic velocity", async () => {
    mqlMatches = false;
    const { Debris, createUpsideDown } =
      await import("../../../js/particles/upside-down.js");
    createUpsideDown(makeFakeCanvas(), {});
    const d = new Debris();
    d.spawn(2);
    // Set vx/vy/rotSpeed to known non-zero values so the assertions
    // below are independent of the random spawn distribution.
    d.vx = 3;
    d.vy = -2;
    d.rotSpeed = 0.05;
    const x0 = d.x;
    const y0 = d.y;
    const rot0 = d.rotation;
    d.update();
    expect(d.x).toBeGreaterThan(x0);
    expect(d.y).toBeLessThan(y0);
    expect(d.rotation).toBeGreaterThan(rot0);
  });

  it("deactivates after maxLife frames", async () => {
    mqlMatches = false;
    const { Debris, createUpsideDown } =
      await import("../../../js/particles/upside-down.js");
    createUpsideDown(makeFakeCanvas(), {});
    const d = new Debris();
    d.spawn(2);
    const maxFrames = Math.ceil(d.maxLife) + 2;
    for (let i = 0; i < maxFrames; i++) d.update();
    expect(d.active).toBe(false);
  });

  it("friction decays vx/vy even under reduced motion", async () => {
    mqlMatches = true;
    const { Debris, createUpsideDown } =
      await import("../../../js/particles/upside-down.js");
    createUpsideDown(makeFakeCanvas(), {});
    const d = new Debris();
    d.spawn(5);
    // Set vx/vy deterministically so the assertion is independent of
    // the random scatter on spawn.
    d.vx = 4;
    d.vy = -4;
    const vx0 = Math.abs(d.vx);
    const vy0 = Math.abs(d.vy);
    d.update();
    expect(Math.abs(d.vx)).toBeLessThan(vx0);
    expect(Math.abs(d.vy)).toBeLessThan(vy0);
  });

  it("spawn vy sign matches WIND_VY_MUL * scrollVelocity (within scatter)", async () => {
    // Guard against future regressions in the wind-direction sign.
    // Average spawn vy over many trials; the random scatter is
    // symmetric so the mean should be close to WIND_VY_MUL * sv,
    // unambiguously matching its sign.
    mqlMatches = false;
    const { Debris, DEBRIS, createUpsideDown } =
      await import("../../../js/particles/upside-down.js");
    createUpsideDown(makeFakeCanvas(), {});
    const sv = 4;
    const expected = sv * DEBRIS.WIND_VY_MUL;
    let sum = 0;
    const N = 200;
    for (let i = 0; i < N; i++) {
      const d = new Debris();
      d.spawn(sv);
      sum += d.vy;
    }
    const mean = sum / N;
    // Expected sign matches; mean lands within ~half the scatter of the
    // expected value (loose enough to absorb sample noise without
    // hiding a sign error).
    expect(Math.sign(mean)).toBe(Math.sign(expected));
    expect(Math.abs(mean - expected)).toBeLessThan(DEBRIS.SCATTER_VY);
  });
});
