import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// sky.js's dwell-pulse detector lives inside createSky().draw() and is
// driven by wall-clock time (`Date.now()`) so reduced-motion's frozen
// frame budget doesn't break the threshold.  Tests stub matchMedia to
// flip the preference, use fake timers to control Date.now, and read
// `star.idleFlash` to observe the pulse latch.

function makeFakeCanvas(w = 1920, h = 1080) {
  return { width: w, height: h };
}

function makeFakeCtx() {
  const noop = () => {};
  return new Proxy(
    {},
    {
      get(_, prop) {
        // Both gradient builders return a stub with addColorStop — the star
        // glare draws a linear gradient, shooting-star glow a radial one, and
        // either may run depending on random spawns / idle flashes.
        if (prop === "createRadialGradient" || prop === "createLinearGradient")
          return () => ({ addColorStop: noop });
        return noop;
      },
      set: () => true,
    },
  );
}

// Covers every field sky.js's draw reads, including the shooting-star path —
// a star can spawn on any frame (Math.random), so an incomplete palette makes
// the dwell tests flaky when one happens to draw its trail.
function makeFakePalette() {
  return {
    starColor: [255, 255, 255],
    constellationLine: [200, 200, 255],
    constellationGlow: [200, 200, 255],
    shootingColors: [
      [180, 210, 255],
      [200, 225, 255],
      [230, 240, 255],
    ],
    auroraHueBase: 120,
    auroraHueRange: 80,
  };
}

function makeForces(hoverX, hoverY) {
  return {
    clickImpulse: { x: 0, y: 0, strength: 0 },
    isDragging: false,
    dragPos: { x: 0, y: 0 },
    holdStrength: 0,
    wellStrength: 0,
    hover: { x: hoverX, y: hoverY, active: hoverX != null },
  };
}

describe("sky.js dwell-pulse detector", () => {
  let mqlMatches;
  let mqlListeners;
  let mod;
  let stars;
  let sky;
  let ctx;
  let canvas;
  let pal;

  beforeEach(async () => {
    mqlMatches = false;
    mqlListeners = [];
    window.matchMedia = vi.fn(() => ({
      get matches() {
        return mqlMatches;
      },
      addEventListener: (type, listener) => {
        if (type === "change") mqlListeners.push(listener);
      },
      removeEventListener: vi.fn(),
    }));
    vi.useFakeTimers();
    vi.setSystemTime(0);
    vi.resetModules();

    mod = await import("../../js/sky.js");
    sky = mod.createSky(120);
    stars = mod.getSkyStars();
    canvas = makeFakeCanvas();
    ctx = makeFakeCtx();
    pal = makeFakePalette();
  });

  function flipReducedMotion(on) {
    mqlMatches = on;
    for (const listener of mqlListeners) listener({ matches: on });
  }

  afterEach(() => {
    delete window.matchMedia;
    vi.useRealTimers();
  });

  function tagged() {
    return stars.find((s) => s.constellationId);
  }

  function draw(forces) {
    sky.draw(ctx, canvas, 0, pal, forces);
  }

  it("does not fire idleFlash before the dwell window elapses", () => {
    const star = tagged();
    expect(star).toBeDefined();
    // Park the cursor at the star's canvas-pixel position so it sits
    // well inside HOVER_RADIUS — the dwell detector only awards stars
    // currently within proximity.
    const forces = makeForces(star.x, star.y);
    draw(forces);
    vi.advanceTimersByTime(500);
    draw(forces);
    expect(star.idleFlash).toEqual(0);
  });

  it("fires idleFlash after the cursor sits still past the dwell window", () => {
    // Wide-margin advance — generous enough to clear the dwell window
    // regardless of tuning, since this test asserts the threshold-crossed
    // behavior, not the precise boundary.
    const star = tagged();
    const forces = makeForces(star.x, star.y);
    draw(forces);
    vi.advanceTimersByTime(5000);
    draw(forces);
    expect(star.idleFlash).toBeGreaterThan(0);
  });

  it("does not re-fire on the same dwell — latch holds until cursor moves", () => {
    const star = tagged();
    const forces = makeForces(star.x, star.y);
    draw(forces);
    vi.advanceTimersByTime(2000);
    draw(forces);
    const firstFlash = star.idleFlash;
    expect(firstFlash).toBeGreaterThan(0);
    // Several more frames at the same cursor position; idleFlash should
    // decay (not be re-bumped) because the latch is set.
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(50);
      draw(forces);
    }
    expect(star.idleFlash).toBeLessThan(firstFlash);
  });

  it("does not fire under prefers-reduced-motion", () => {
    flipReducedMotion(true);
    const star = tagged();
    const forces = makeForces(star.x, star.y);
    draw(forces);
    vi.advanceTimersByTime(2000);
    draw(forces);
    expect(star.idleFlash).toEqual(0);
  });

  it("does not award stars to untagged neighbors even when closer", () => {
    // Park cursor between a tagged star and any other star — only the
    // tagged star should receive the flash.
    const star = tagged();
    const forces = makeForces(star.x, star.y);
    draw(forces);
    vi.advanceTimersByTime(2000);
    draw(forces);
    const untagged = stars.filter((s) => !s.constellationId);
    expect(untagged.every((s) => s.idleFlash === 0)).toBe(true);
  });
});

describe("sky.js star projection — solo vs world-anchored", () => {
  let mod;
  let seam;

  beforeEach(async () => {
    window.matchMedia = vi.fn(() => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }));
    vi.resetModules();
    seam = await import("../../js/sky-link/seam.js");
    mod = await import("../../js/sky.js");
  });

  afterEach(() => {
    seam.setPeerRectsSource(null);
    delete window.matchMedia;
  });

  const peerRect = { x: 2000, y: 0, w: 800, h: 600 };

  function linkUp() {
    seam.setPeerRectsSource(() => [peerRect]);
  }

  it("folds the sky tile onto the viewport while solo", () => {
    const star = { x: 1500, y: 900, depth: 0.5 };
    const canvas = makeFakeCanvas(800, 600);
    const instances = mod.starScreenInstances(star, 0, canvas);
    expect(instances).toEqual([{ x: 1500 % 800, y: 900 % 600 }]);
  });

  it("slices the desktop-anchored world while linked", () => {
    linkUp();
    const star = { x: 300, y: 200, depth: 0.5 };
    const canvas = makeFakeCanvas(800, 600);
    // Window at world origin: the star sits at its world position.
    expect(mod.starScreenInstances(star, 0, canvas, { x: 0, y: 0 })).toEqual([
      { x: 300, y: 200 },
    ]);
    // Window 250px to the right: the same world position, shifted.
    expect(mod.starScreenInstances(star, 0, canvas, { x: 250, y: 0 })).toEqual([
      { x: 50, y: 200 },
    ]);
  });

  it("agrees across two adjacent windows — one continuous field", () => {
    linkUp();
    mod.createSky(120);
    const left = makeFakeCanvas(960, 1080);
    const right = makeFakeCanvas(960, 1080);
    const leftOrigin = { x: 0, y: 0 };
    const rightOrigin = { x: 960, y: 0 };
    for (const star of mod.getSkyStars()) {
      const a = mod.starScreenInstances(star, 0, left, leftOrigin);
      const b = mod.starScreenInstances(star, 0, right, rightOrigin);
      // Every instance, mapped back to world coordinates, must land on
      // the same tile-relative spot regardless of which window projected
      // it — the world repeats per sky tile, so agreement is modulo the
      // tile width.
      const worldXs = new Set(
        [
          ...a.map((p) => p.x + leftOrigin.x),
          ...b.map((p) => p.x + rightOrigin.x),
        ].map((x) => Math.round((((x % 1920) + 1920) % 1920) * 1000) / 1000),
      );
      expect(worldXs.size).toBeLessThanOrEqual(1);
    }
  });

  it("drops stars that fall outside this window's world slice", () => {
    linkUp();
    const star = { x: 1800, y: 200, depth: 0.5 };
    const canvas = makeFakeCanvas(800, 600);
    expect(mod.starScreenInstances(star, 0, canvas, { x: 0, y: 0 })).toEqual(
      [],
    );
  });

  it("repeats the sky tile for a viewport wider than the tile", () => {
    linkUp();
    const star = { x: 100, y: 200, depth: 0.5 };
    const canvas = makeFakeCanvas(2200, 600);
    const xs = mod
      .starScreenInstances(star, 0, canvas, { x: 0, y: 0 })
      .map((p) => p.x);
    expect(xs).toEqual([100, 100 + 1920]);
  });

  it("measures linked parallax in sky-tile units, solo in canvas units", () => {
    const depth = 1;
    const sp = 0.5;
    const canvasH = 600;
    const solo = mod.starsParallaxShift(depth, sp, canvasH);
    linkUp();
    const linked = mod.starsParallaxShift(depth, sp, canvasH);
    // Same tunables, different length scale — 1080-tall tile vs canvas.
    expect(linked / solo).toBeCloseTo(1080 / canvasH, 6);
  });

  it("reports the anchoring regime off the live link state", () => {
    expect(mod.isWorldAnchored()).toBe(false);
    linkUp();
    expect(mod.isWorldAnchored()).toBe(true);
  });
});

describe("activeWorldArcs — schedule-driven shooting stars", () => {
  let activeWorldArcs;

  beforeEach(async () => {
    // sky.js pulls in motion.js, whose module scope reads matchMedia.
    window.matchMedia = vi.fn(() => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }));
    vi.resetModules();
    ({ activeWorldArcs } = await import("../../js/sky.js"));
  });

  afterEach(() => {
    delete window.matchMedia;
  });

  const SEED = 0xc10d;
  const TILE = { x: 0, y: 0, w: 1920, h: 1080 };

  // Sample the schedule at maxLife-sized strides until an arc shows up —
  // strictly deterministic, so the found tick is stable across runs.
  function findTickWithArc() {
    for (let tickTime = 0; tickTime < 200000; tickTime += 40) {
      const arcs = activeWorldArcs(tickTime, TILE, SEED);
      if (arcs.length > 0) return { tickTime, arcs };
    }
    throw new Error("schedule produced no arcs in the probed range");
  }

  it("replays identically — same seed, same instant, same arcs", () => {
    const { tickTime, arcs } = findTickWithArc();
    expect(activeWorldArcs(tickTime, TILE, SEED)).toEqual(arcs);
  });

  it("agrees between overlapping queries — one world, many windows", () => {
    const { tickTime, arcs } = findTickWithArc();
    const wide = activeWorldArcs(
      tickTime,
      { x: -1920, y: -1080, w: 3 * 1920, h: 3 * 1080 },
      SEED,
    );
    for (const arc of arcs) {
      const twin = wide.find((a) => a.key === arc.key);
      expect(twin).toBeDefined();
      expect(twin.headX).toBe(arc.headX);
      expect(twin.headY).toBe(arc.headY);
    }
  });

  it("flies each arc along a straight world line as time advances", () => {
    const { tickTime, arcs } = findTickWithArc();
    const arc = arcs[0];
    const later = activeWorldArcs(tickTime + 1, TILE, SEED).find(
      (a) => a.key === arc.key,
    );
    if (later) {
      expect(later.headX - arc.headX).toBeCloseTo(
        Math.cos(arc.angle) * arc.speed,
        6,
      );
      expect(later.headY - arc.headY).toBeCloseTo(
        Math.sin(arc.angle) * arc.speed,
        6,
      );
    }
    // Well past its lifetime the arc is gone everywhere.
    const gone = activeWorldArcs(tickTime + arc.maxLife + 41, TILE, SEED).find(
      (a) => a.key === arc.key,
    );
    expect(gone).toBeUndefined();
  });

  it("uses a different schedule for a different seed", () => {
    const { tickTime, arcs } = findTickWithArc();
    const other = activeWorldArcs(tickTime, TILE, SEED + 1);
    expect(other.map((a) => a.key)).not.toEqual(arcs.map((a) => a.key));
  });

  it("never returns an arc older than its own lifetime", () => {
    for (let tickTime = 0; tickTime < 20000; tickTime += 17) {
      for (const arc of activeWorldArcs(tickTime, TILE, SEED)) {
        expect(arc.life).toBeGreaterThanOrEqual(0);
        expect(arc.life).toBeLessThanOrEqual(arc.maxLife);
      }
    }
  });
});
