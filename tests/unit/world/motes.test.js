import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mulberry32 } from "../../../js/daily/seed.js";
import { WORLD_W } from "../../../js/world/space.js";
import { worldTickTime } from "../../../js/world/clock.js";

// The mote field is a deterministic function of the daily seed, the shared
// world clock, and the folded-in pointer forces — so it's exercised with a
// frozen clock (fake timers) and hand-built forces, no real link or canvas.

function idleForces(overrides = {}) {
  return {
    clickImpulse: { x: 0, y: 0, strength: 0 },
    isDragging: false,
    dragPos: { x: 0, y: 0 },
    holdStrength: 0,
    wellStrength: 0,
    hover: { x: 0, y: 0, active: false },
    remotePointers: [],
    ...overrides,
  };
}

const canvas = { width: 1000, height: 800 };
const pal = { moteColor: [200, 230, 255], moteGlow: [130, 195, 255] };
const origin = { x: 0, y: 0 };
const attract = { radius: 300, force: 0.5 };
const START_MS = 1_700_000_000_000;

function recordingCtx() {
  const halos = [];
  const grad = { addColorStop() {} };
  return {
    halos,
    createRadialGradient(x0, y0, r0, x1, y1, r1) {
      halos.push({ x: x1, y: y1, r: r1 });
      return grad;
    },
    beginPath() {},
    arc() {},
    fill() {},
    set fillStyle(_) {},
  };
}

describe("world/motes", () => {
  let WorldMote;
  let createWorldMotes;

  beforeEach(async () => {
    window.matchMedia = vi.fn((q) => ({
      matches: false,
      media: q,
      addEventListener() {},
      removeEventListener() {},
    }));
    vi.useFakeTimers();
    vi.setSystemTime(START_MS);
    vi.resetModules();
    ({ WorldMote, createWorldMotes } =
      await import("../../../js/world/motes.js"));
  });

  afterEach(() => {
    vi.useRealTimers();
    delete window.matchMedia;
  });

  it("gives two motes from the same seed an identical layout", () => {
    const a = new WorldMote(mulberry32(999));
    const b = new WorldMote(mulberry32(999));
    expect({ x: a.homeX, y: a.homeY, r: a.r, fx: a.fx, px: a.px }).toEqual({
      x: b.homeX,
      y: b.homeY,
      r: b.r,
      fx: b.fx,
      px: b.px,
    });
  });

  it("keeps identical fields in lockstep across identical updates", () => {
    // Two windows: same seed, same clock, same (idle) forces → same field.
    const a = new WorldMote(mulberry32(7));
    const b = new WorldMote(mulberry32(7));
    for (let i = 0; i < 30; i++) {
      vi.advanceTimersByTime(16);
      // Both windows read the same tick — the field agrees only under that.
      const t = worldTickTime();
      a.update(t, canvas, origin, idleForces(), attract);
      b.update(t, canvas, origin, idleForces(), attract);
    }
    expect(a.wx).toBe(b.wx);
    expect(a.wy).toBe(b.wy);
  });

  it("springs a displaced mote back toward its home", () => {
    const m = new WorldMote(mulberry32(11));
    m.wx = m.homeX + 300;
    m.wy = m.homeY + 300;
    const before = Math.hypot(m.wx - m.homeX, m.wy - m.homeY);
    for (let i = 0; i < 60; i++) {
      vi.advanceTimersByTime(16);
      m.update(worldTickTime(), canvas, origin, idleForces(), attract);
    }
    const after = Math.hypot(m.wx - m.homeX, m.wy - m.homeY);
    expect(after).toBeLessThan(before);
  });

  // A displaced mote fed a well, versus the same mote (same seed, same drift
  // sequence) left idle — the well is the only difference, so any extra
  // displacement toward the drag point is the force biting.
  function runToward(forces) {
    vi.setSystemTime(START_MS);
    const m = new WorldMote(mulberry32(5));
    m.wx = m.homeX = 400;
    m.wy = m.homeY = 300;
    for (let i = 0; i < 12; i++) {
      vi.advanceTimersByTime(16);
      m.update(worldTickTime(), canvas, origin, forces, attract);
    }
    return m.wx;
  }

  it("pulls a mote toward a local well", () => {
    const idle = runToward(idleForces());
    const welled = runToward(
      idleForces({ wellStrength: 1, dragPos: { x: 450, y: 300 } }),
    );
    expect(welled).toBeGreaterThan(idle);
  });

  it("lets a linked peer's well reach across into the field", () => {
    const idle = runToward(idleForces());
    const remote = runToward(
      idleForces({
        remotePointers: [
          {
            id: "peer",
            x: 450,
            y: 300,
            active: true,
            isDragging: true,
            holdStrength: 1,
            wellStrength: 1,
          },
        ],
      }),
    );
    expect(remote).toBeGreaterThan(idle);
  });

  it("freezes position under reduced motion", async () => {
    window.matchMedia = vi.fn(() => ({
      matches: true,
      addEventListener() {},
      removeEventListener() {},
    }));
    vi.resetModules();
    const rm = await import("../../../js/world/motes.js");
    const m = new rm.WorldMote(mulberry32(3));
    m.wx = m.homeX + 120;
    m.wy = m.homeY - 60;
    const x0 = m.wx;
    const y0 = m.wy;
    vi.advanceTimersByTime(400);
    m.update(worldTickTime(), canvas, origin, idleForces(), attract);
    m.update(worldTickTime(), canvas, origin, idleForces(), attract);
    expect(m.wx).toBe(x0);
    expect(m.wy).toBe(y0);
  });

  it("repeats the field per tile and translates by the window origin", () => {
    const m = new WorldMote(mulberry32(1));
    m.opacity = 1;
    m.wx = 100;
    m.wy = 200;
    // Viewport wider than the tile sees the mote twice, one tile apart.
    const wide = { width: 2200, height: 800 };
    const ctx = recordingCtx();
    m.draw(ctx, wide, pal, { x: 0, y: 0 }, 1, {});
    const xs = ctx.halos.map((h) => h.x).sort((a, b) => a - b);
    expect(xs).toEqual([100, 100 + WORLD_W]);

    // Sliding the window origin shifts where the same world point lands.
    const ctx2 = recordingCtx();
    m.draw(ctx2, canvas, pal, { x: 50, y: 0 }, 1, {});
    expect(ctx2.halos[0].x).toBe(50);
  });

  it("fades draws out below the weight-scaled threshold", () => {
    const m = new WorldMote(mulberry32(2));
    m.opacity = 0.02;
    const ctx = recordingCtx();
    m.draw(ctx, canvas, pal, origin, 0, {});
    expect(ctx.halos).toHaveLength(0); // weight 0 → nothing painted
  });

  it("builds a field that renders its on-slice motes", () => {
    const field = createWorldMotes(12);
    const ctx = recordingCtx();
    // A few frames for the ambient opacity to ease up past the draw floor.
    for (let i = 0; i < 10; i++) {
      vi.advanceTimersByTime(16);
      field.draw(ctx, canvas, pal, idleForces(), origin, 1);
    }
    // Not asserting an exact count (some motes fall off this slice), only that
    // the field renders and paints the motes that land on it.
    expect(ctx.halos.length).toBeGreaterThan(0);
  });
});
