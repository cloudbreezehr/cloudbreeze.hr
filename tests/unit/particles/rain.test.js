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

describe("GlassDrop — pane droplet lifecycle", () => {
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

  const FRAME_MS = 16;
  // Big enough to clear every grip roll; small drops sit under both the
  // grip floor and the early-release minimum, so they stay deterministic.
  async function load() {
    const { GlassDrop, mergedSize } =
      await import("../../../js/particles/rain.js");
    const { GLASS } = await import("../../../js/particles/rain.constants.js");
    return { GlassDrop, mergedSize, GLASS };
  }

  it("stays pinned while lighter than its grip", async () => {
    const { GlassDrop, GLASS } = await load();
    const d = new GlassDrop();
    const tiny = Math.min(GLASS.RELEASE_MIN_SIZE, GLASS.GRIP_MIN) - 1;
    d.spawn(100, 100, tiny);
    for (let i = 0; i < 50; i++) d.update(FRAME_MS, 0, 0);
    expect(d.sliding).toBe(false);
    expect(d.x).toBe(100);
    expect(d.y).toBe(100);
  });

  it("releases once it outgrows its grip", async () => {
    const { GlassDrop, GLASS } = await load();
    const d = new GlassDrop();
    d.spawn(100, 100, GLASS.GRIP_MIN + GLASS.GRIP_RANGE + 1);
    d.update(FRAME_MS, 0, 0);
    expect(d.sliding).toBe(true);
  });

  it("slides downward with a mass-dependent pace once released", async () => {
    const { GlassDrop, GLASS } = await load();
    const d = new GlassDrop();
    d.spawn(100, 100, GLASS.GRIP_MIN + GLASS.GRIP_RANGE + 1);
    for (let i = 0; i < 30; i++) d.update(FRAME_MS, 0, 0);
    expect(d.y).toBeGreaterThan(100);
    expect(d.speed).toBeGreaterThan(0);
  });

  it("is fully frozen under reduced motion, even mid-slide", async () => {
    mqlMatches = true;
    const { GlassDrop, GLASS } = await load();
    const d = new GlassDrop();
    d.spawn(100, 100, GLASS.GRIP_MIN + GLASS.GRIP_RANGE + 1);
    d.startSliding();
    d.speed = 2;
    const deposit = vi.fn();
    const trailLen = d.trail.length;
    for (let i = 0; i < 30; i++) d.update(FRAME_MS, 5, 3, deposit);
    expect(d.x).toBe(100);
    expect(d.y).toBe(100);
    expect(d.size).toBe(GLASS.GRIP_MIN + GLASS.GRIP_RANGE + 1);
    expect(d.trail.length).toBe(trailLen);
    expect(deposit).not.toHaveBeenCalled();
  });

  it("absorbs a droplet area-conservingly and lurches toward it", async () => {
    const { GlassDrop, GLASS } = await load();
    const head = new GlassDrop();
    head.spawn(100, 100, 8);
    head.startSliding();
    const food = new GlassDrop();
    food.spawn(110, 104, 6);

    head.absorb(food);

    expect(head.size).toBeCloseTo(Math.min(GLASS.SIZE_MAX, Math.hypot(8, 6)));
    expect(head.x).toBeCloseTo(100 + 10 * GLASS.ABSORB_LURCH);
    expect(head.absorbed).toBe(1);
    expect(food.active).toBe(false);
  });

  it("sheds beads into its track and thins by their area", async () => {
    const { GlassDrop, GLASS } = await load();
    const d = new GlassDrop();
    // Above the stick-slip band so the run is steady, well above stall.
    const size = GLASS.STICK_MAX_SIZE + 3;
    d.spawn(100, 100, size);
    d.startSliding();
    const deposit = vi.fn();
    for (let i = 0; i < 400 && deposit.mock.calls.length === 0; i++) {
      d.update(FRAME_MS, 0, 0, deposit);
    }
    expect(deposit).toHaveBeenCalled();
    const [, beadY, beadSize] = deposit.mock.calls[0];
    expect(beadY).toBeLessThan(d.y);
    expect(beadSize).toBeGreaterThanOrEqual(GLASS.BEAD_MIN);
    expect(beadSize).toBeLessThanOrEqual(GLASS.BEAD_MAX);
    expect(d.size).toBeLessThan(size);
  });

  it("never stalls at speed, however thin it has shed", async () => {
    const { GlassDrop, GLASS } = await load();
    const d = new GlassDrop();
    d.spawn(100, 100, GLASS.GRIP_MIN + GLASS.GRIP_RANGE + 1);
    d.startSliding();
    d.size = GLASS.STALL_SIZE;
    d.speed = GLASS.STALL_MAX_SPEED + 1;
    // Every stochastic roll passes, so only the speed gate holds it open.
    vi.spyOn(Math, "random").mockReturnValue(0);
    d.update(FRAME_MS, 0, 0);
    expect(d.sliding).toBe(true);
    Math.random.mockRestore();
  });

  it("pins from a creep — thin, slow, and given the chance", async () => {
    const { GlassDrop, GLASS } = await load();
    const d = new GlassDrop();
    d.spawn(100, 100, GLASS.GRIP_MIN + GLASS.GRIP_RANGE + 1);
    d.startSliding();
    d.size = GLASS.STALL_SIZE;
    d.speed = 0;
    // Pin the roll so the chance gate deterministically fires.
    vi.spyOn(Math, "random").mockReturnValue(0);
    d.update(FRAME_MS, 0, 0);
    expect(d.sliding).toBe(false);
    expect(d.active).toBe(true);
    // Re-pinned with headroom: it needs a fresh feed before re-releasing.
    expect(d.grip).toBeGreaterThanOrEqual(d.size + GLASS.STALL_GRIP_MARGIN);
    Math.random.mockRestore();
  });

  it("dries a shed bead off until it disappears", async () => {
    const { GlassDrop, GLASS } = await load();
    const d = new GlassDrop();
    d.spawn(100, 100, GLASS.BEAD_MIN, { bead: true });
    // Already-wet water: full strength immediately, no fade-in lagging
    // behind the head that shed it.
    expect(d.opacity).toBe(1);
    const frames =
      Math.ceil(
        (GLASS.BEAD_MIN - GLASS.MIN_VISIBLE_SIZE) / GLASS.BEAD_EVAP_PER_FRAME,
      ) + 2;
    for (let i = 0; i < frames; i++) d.update(FRAME_MS, 0, 0);
    expect(d.active).toBe(false);
  });

  it("keeps a run gravity-dominated even against steering and wind", async () => {
    const { GlassDrop, GLASS } = await load();
    const d = new GlassDrop();
    d.spawn(100, 100, GLASS.STICK_MAX_SIZE + 3);
    d.startSliding();
    for (let i = 0; i < 120; i++) {
      // A steer target far off to the side plus a constant gust — the
      // strongest lateral pressure the field can apply.
      d.steerX = 400;
      d.update(FRAME_MS, 0, 2);
    }
    const drift = Math.abs(d.x - 100);
    const fall = d.y - 100;
    expect(fall).toBeGreaterThan(0);
    expect(drift).toBeLessThanOrEqual(fall * GLASS.LATERAL_RATIO_MAX + 1e-6);
  });

  it("samples its neck by distance and caps its length", async () => {
    const { GlassDrop, GLASS } = await load();
    const d = new GlassDrop();
    d.spawn(100, 100, GLASS.STICK_MAX_SIZE + 3);
    d.startSliding();
    for (let i = 0; i < 60; i++) d.update(FRAME_MS, 0, 0);
    expect(d.trail.length).toBeGreaterThan(2);
    expect(d.trail.length).toBeLessThanOrEqual(GLASS.NECK_POINTS);
    const [a, b] = d.trail;
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThanOrEqual(
      GLASS.NECK_SPACING_PX,
    );
  });

  it("mergedSize conserves area and respects the size cap", async () => {
    const { mergedSize, GLASS } = await load();
    expect(mergedSize(3, 4)).toBeCloseTo(5);
    expect(mergedSize(GLASS.SIZE_MAX, GLASS.SIZE_MAX)).toBe(GLASS.SIZE_MAX);
  });
});
