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

describe("framesToExit — linked-sky life extension", () => {
  let framesToExit;

  beforeEach(async () => {
    // sky.js pulls in motion.js, whose module scope reads matchMedia.
    window.matchMedia = vi.fn(() => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }));
    vi.resetModules();
    ({ framesToExit } = await import("../../js/sky.js"));
  });

  afterEach(() => {
    delete window.matchMedia;
  });

  const W = 1000;
  const H = 800;
  const LEN = 50;

  it("counts frames to the first bound along the heading, tail included", () => {
    // Heading straight right from x=900 at 10 px/frame: must clear
    // x = W + LEN, i.e. 150 px → 15 frames.
    expect(framesToExit(900, 400, 0, 10, LEN, W, H)).toBe(15);
  });

  it("uses the nearer bound when the heading crosses two", () => {
    // Down-right at 45° from near the bottom edge — the bottom bound is
    // closer than the right one.
    const angle = Math.PI / 4;
    const speed = 10;
    const framesToBottom = Math.ceil(
      (H + LEN - 700) / (Math.sin(angle) * speed),
    );
    expect(framesToExit(100, 700, angle, speed, LEN, W, H)).toBe(
      framesToBottom,
    );
  });

  it("is zero for a particle already past the bound moving away", () => {
    expect(framesToExit(W + LEN, 400, 0, 10, LEN, W, H)).toBe(0);
  });
});
