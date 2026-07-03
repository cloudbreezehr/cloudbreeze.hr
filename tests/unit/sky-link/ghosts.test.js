import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createCursorGhosts } from "../../../js/sky-link/ghosts.js";

// A fake 2D context that records every halo it's asked to draw, so tests
// can assert what the ghost layer renders without a real canvas.
function makeRecordingCtx() {
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

const pal = { cursorGhost: [190, 220, 255] };
const canvas = { width: 800, height: 600 };

function remote(overrides = {}) {
  return {
    id: "peer",
    x: 100,
    y: 100,
    active: true,
    isDragging: false,
    holdStrength: 0,
    wellStrength: 0,
    seenAt: Date.now(),
    ...overrides,
  };
}

describe("sky-link/ghosts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("draws a ghost halo at the remote pointer's position", () => {
    const ghosts = createCursorGhosts();
    const ctx = makeRecordingCtx();
    for (let i = 0; i < 10; i++) ghosts.draw(ctx, pal, [remote()], canvas);
    expect(ctx.halos.at(-1)).toMatchObject({ x: 100, y: 100 });
  });

  it("widens the halo while a remote pointer charges a hold", () => {
    const ghosts = createCursorGhosts();
    const ctx = makeRecordingCtx();
    // Settle both cases to steady state so only hold differs.
    for (let i = 0; i < 40; i++)
      ghosts.draw(ctx, pal, [remote({ holdStrength: 0 })], canvas);
    const rest = ctx.halos.at(-1).r;

    const ghosts2 = createCursorGhosts();
    const ctx2 = makeRecordingCtx();
    for (let i = 0; i < 40; i++)
      ghosts2.draw(ctx2, pal, [remote({ holdStrength: 1 })], canvas);
    const charged = ctx2.halos.at(-1).r;

    expect(charged).toBeGreaterThan(rest);
  });

  it("fades a vanished ghost out instead of dropping it instantly", () => {
    const ghosts = createCursorGhosts();
    const ctx = makeRecordingCtx();
    for (let i = 0; i < 40; i++) ghosts.draw(ctx, pal, [remote()], canvas);
    const drawnWhilePresent = ctx.halos.length;

    // Pointer gone: still draws for a while as it eases out.
    ghosts.draw(ctx, pal, [], canvas);
    expect(ctx.halos.length).toBeGreaterThan(drawnWhilePresent);

    // Eventually stops drawing entirely.
    for (let i = 0; i < 100; i++) ghosts.draw(ctx, pal, [], canvas);
    const settled = ctx.halos.length;
    ghosts.draw(ctx, pal, [], canvas);
    expect(ctx.halos.length).toBe(settled);
  });

  it("fires ghost-hand once when a remote drag reaches inside the viewport", () => {
    const ghosts = createCursorGhosts();
    const ctx = makeRecordingCtx();
    const events = [];
    const onAch = (e) => events.push(e.detail);
    window.addEventListener("achievement", onAch);
    try {
      // A remote drag outside the viewport doesn't count.
      ghosts.draw(ctx, pal, [remote({ isDragging: true, x: -50 })], canvas);
      expect(
        events.filter((d) => d.type === "sky-link-ghost-hand"),
      ).toHaveLength(0);
      // Inside: fires exactly once, even across many frames.
      for (let i = 0; i < 5; i++)
        ghosts.draw(ctx, pal, [remote({ isDragging: true, x: 400 })], canvas);
      expect(
        events.filter((d) => d.type === "sky-link-ghost-hand"),
      ).toHaveLength(1);
    } finally {
      window.removeEventListener("achievement", onAch);
    }
  });

  it("does not fire ghost-hand for a hovering (non-dragging) remote pointer", () => {
    const ghosts = createCursorGhosts();
    const ctx = makeRecordingCtx();
    const events = [];
    const onAch = (e) => events.push(e.detail);
    window.addEventListener("achievement", onAch);
    try {
      for (let i = 0; i < 5; i++)
        ghosts.draw(ctx, pal, [remote({ isDragging: false, x: 400 })], canvas);
      expect(
        events.filter((d) => d.type === "sky-link-ghost-hand"),
      ).toHaveLength(0);
    } finally {
      window.removeEventListener("achievement", onAch);
    }
  });
});
