import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Minimal canvas stub: createConstellation only calls getContext("2d")
// at factory time and uses the returned ctx purely for draw calls.
// Dust update() doesn't touch the ctx, so a no-op ctx is sufficient for
// the position-invariance tests.
function makeStubCanvas() {
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    set globalAlpha(v) {},
    set globalCompositeOperation(v) {},
    set fillStyle(v) {},
    set strokeStyle(v) {},
    set lineWidth(v) {},
    set lineCap(v) {},
  };
  return {
    width: 800,
    height: 600,
    getContext: vi.fn(() => ctx),
  };
}

describe("createConstellation — dust reduced-motion invariance", () => {
  let mqlMatches;

  beforeEach(() => {
    mqlMatches = false;
    window.matchMedia = vi.fn(() => ({
      get matches() {
        return mqlMatches;
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    vi.resetModules();
  });

  afterEach(() => {
    delete window.matchMedia;
  });

  it("dust position is invariant across a frame when motion is reduced", async () => {
    mqlMatches = true;
    const { createConstellation } =
      await import("../../../js/particles/constellation.js");
    const canvas = makeStubCanvas();
    const particles = createConstellation(canvas);

    // Chain active so dust drives the draw path.  Chain itself stays
    // empty so the only ctx.arc calls come from Dust.draw (via
    // drawHaloParticle).
    particles.setChain({
      chain: [],
      candidateId: "orions-belt",
      isActive: true,
    });
    const frame = {
      sp: 0,
      dt: 0.016,
      scrollVelocity: 0,
      drawVelocity: 0,
      pal: {},
      palFor: () => ({ cosmicDust: [200, 215, 250] }),
      isDark: true,
      forces: {
        clickImpulse: { x: 0, y: 0, strength: 0 },
        isDragging: false,
        dragPos: { x: 0, y: 0 },
        holdStrength: 0,
        wellStrength: 0,
        hover: { x: 0, y: 0, active: false },
      },
      ctx: canvas.getContext("2d"),
      canvas,
      reducedMotion: true,
    };

    particles.draw(frame);
    // arc(x, y, r, ...) — capture the (x, y) of every dust halo from
    // the first frame, then assert the second frame's calls land at
    // the same coordinates.  Anything moving would diverge.
    const firstFrame = frame.ctx.arc.mock.calls.map((args) => [
      args[0],
      args[1],
    ]);
    particles.draw(frame);
    const secondFrame = frame.ctx.arc.mock.calls
      .slice(firstFrame.length)
      .map((args) => [args[0], args[1]]);
    expect(secondFrame).toEqual(firstFrame);
  });
});

describe("createConstellation — chain rendering gating", () => {
  let mqlMatches;

  beforeEach(() => {
    mqlMatches = false;
    window.matchMedia = vi.fn(() => ({
      get matches() {
        return mqlMatches;
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    vi.resetModules();
  });

  afterEach(() => {
    delete window.matchMedia;
  });

  function makeFrame(sp, ctx, canvas) {
    return {
      sp,
      dt: 0.016,
      drawVelocity: 0,
      palFor: () => ({}),
      forces: {
        clickImpulse: { x: 0, y: 0, strength: 0 },
        isDragging: false,
        dragPos: { x: 0, y: 0 },
        holdStrength: 0,
        wellStrength: 0,
        hover: { x: 0, y: 0, active: false },
      },
      ctx,
      canvas,
    };
  }

  it("does not draw lines or halos when chain is empty", async () => {
    const { createConstellation } =
      await import("../../../js/particles/constellation.js");
    const canvas = makeStubCanvas();
    const particles = createConstellation(canvas);
    particles.setChain({ chain: [], candidateId: null, isActive: false });
    const ctx = canvas.getContext("2d");
    ctx.stroke.mockClear();
    ctx.fill.mockClear();
    particles.draw(makeFrame(0, ctx, canvas));
    // Chain-line stroke and chain-halo fill should both be silent when
    // there's nothing to draw.  (Dust skipped via isActive: false.)
    expect(ctx.stroke).not.toHaveBeenCalled();
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it("skips chain draw past the star scroll-fade window", async () => {
    // Past sp = FADE_END the stars are gone; the chain must follow or
    // its lines hover over unrelated sections after the user scrolls.
    // Tested with isActive: false (buildup state) so the dust pass —
    // which also calls fill() for its halos — stays gated off and the
    // assertion isolates the chain renderer.
    const { createConstellation } =
      await import("../../../js/particles/constellation.js");
    const { createSky } = await import("../../../js/sky.js");
    createSky(30);
    const canvas = makeStubCanvas();
    const particles = createConstellation(canvas);
    particles.setChain({
      chain: [{ index: 0 }, { index: 1 }],
      candidateId: "x",
      isActive: false,
    });
    const ctx = canvas.getContext("2d");
    ctx.stroke.mockClear();
    ctx.fill.mockClear();
    particles.draw(makeFrame(0.8, ctx, canvas));
    expect(ctx.stroke).not.toHaveBeenCalled();
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it("skips segments where the parallax wrap puts endpoints on opposite vertical edges", async () => {
    // Reproduces the actual bug: with shared depth and a scroll progress
    // where shift > one star's raw y but < the other's, the modulo wrap
    // puts the first star near the bottom and the second near the top.
    // The connecting segment would span the viewport — guard skips it.
    const { createConstellation } =
      await import("../../../js/particles/constellation.js");
    const { createSky, getSkyStars, getStarsParallaxScale } =
      await import("../../../js/sky.js");
    createSky(30);
    const stars = getSkyStars();
    // Canvas is 600 tall; with depth=1, sp=0.3, parallax=0.4: shift=72.
    // y=10 wraps to py=538; y=300 stays at py=228.  Separation 310 >
    // canvas.height/2 = 300, so the segment is skipped.
    stars[0] = { x: 100, y: 10, depth: 1, r: 1, constellationId: "x" };
    stars[1] = { x: 200, y: 300, depth: 1, r: 1, constellationId: "x" };
    // Sanity: the symbolic relationship that puts the test past the
    // wrap threshold.  Tuning STARS.PARALLAX_SCALE retunes the test
    // automatically because both sides read it.
    expect(1 * 0.3 * 600 * getStarsParallaxScale()).toBeGreaterThan(stars[0].y);

    const canvas = makeStubCanvas();
    const particles = createConstellation(canvas);
    particles.setChain({
      chain: [{ index: 0 }, { index: 1 }],
      candidateId: "x",
      isActive: true,
    });
    const ctx = canvas.getContext("2d");
    ctx.moveTo.mockClear();
    ctx.lineTo.mockClear();
    particles.draw(makeFrame(0.3, ctx, canvas));
    expect(ctx.moveTo).not.toHaveBeenCalled();
    expect(ctx.lineTo).not.toHaveBeenCalled();
  });
});
