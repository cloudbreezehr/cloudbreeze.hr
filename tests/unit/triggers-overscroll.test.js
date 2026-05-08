import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createOverscrollTrigger } from "../../js/modes/triggers.js";

function makeStubCtx(overrides = {}) {
  const state = {
    active: false,
    transitioning: false,
    force: 0,
    ...overrides,
  };
  const ctx = {
    setForce: vi.fn((f) => {
      state.force = f;
    }),
    complete: vi.fn(),
    isActive: () => state.active,
    isTransitioning: () => state.transitioning,
    state,
  };
  return ctx;
}

// Overscroll reads scrollHeight and innerHeight; stub them so tests can
// stage "at the bottom" vs. "in the middle" without a real layout.
function setScroll({ scrollY, scrollHeight, innerHeight }) {
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    value: scrollY,
  });
  Object.defineProperty(document.documentElement, "scrollHeight", {
    configurable: true,
    value: scrollHeight,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: innerHeight,
  });
}

function wheel(deltaY) {
  const event = new Event("wheel", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "deltaY", { value: deltaY });
  window.dispatchEvent(event);
}

function touchEvent(type, touches) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "touches", { value: touches });
  return event;
}

describe("createOverscrollTrigger", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));
    // Default scroll staging: at the bottom.
    setScroll({ scrollY: 900, scrollHeight: 2000, innerHeight: 1100 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts a downward wheel at the bottom edge", () => {
    const ctx = makeStubCtx();
    const trigger = createOverscrollTrigger({
      forcePerHit: 0.25,
      cooldownMs: 0,
      edgeTolerance: 10,
      touchDragThreshold: 100,
    });
    trigger.start(ctx);

    wheel(50);

    expect(ctx.state.force).toBeCloseTo(0.25);
  });

  it("ignores a wheel in the middle of the page (not at the edge)", () => {
    setScroll({ scrollY: 400, scrollHeight: 2000, innerHeight: 1100 });
    const ctx = makeStubCtx();
    const trigger = createOverscrollTrigger({
      forcePerHit: 0.25,
      cooldownMs: 0,
      edgeTolerance: 10,
      touchDragThreshold: 100,
    });
    trigger.start(ctx);

    wheel(50);

    expect(ctx.setForce).not.toHaveBeenCalled();
  });

  it("ignores a wheel when isTransitioning is true", () => {
    const ctx = makeStubCtx({ transitioning: true });
    const trigger = createOverscrollTrigger({
      forcePerHit: 0.5,
      cooldownMs: 0,
      edgeTolerance: 10,
      touchDragThreshold: 100,
    });
    trigger.start(ctx);

    wheel(50);

    expect(ctx.setForce).not.toHaveBeenCalled();
  });

  it("applies cooldownMs to prevent trackpad swipes from multi-counting", () => {
    const ctx = makeStubCtx();
    const trigger = createOverscrollTrigger({
      forcePerHit: 0.25,
      cooldownMs: 500,
      edgeTolerance: 10,
      touchDragThreshold: 100,
    });
    trigger.start(ctx);

    // Advance past cooldown so the first hit lands (lastHitTime defaults to 0).
    vi.setSystemTime(new Date(1000));
    wheel(50);
    expect(ctx.setForce).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date(1200)); // inside cooldown
    wheel(50);
    expect(ctx.setForce).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date(1600)); // past cooldown
    wheel(50);
    expect(ctx.setForce).toHaveBeenCalledTimes(2);
  });

  it("multiplies forcePerHit by returnMultiplier while isActive", () => {
    const ctx = makeStubCtx({ active: true });
    const trigger = createOverscrollTrigger({
      forcePerHit: 0.1,
      cooldownMs: 0,
      edgeTolerance: 10,
      touchDragThreshold: 100,
      returnMultiplier: 3,
    });
    trigger.start(ctx);

    wheel(50);

    expect(ctx.state.force).toBeCloseTo(0.3);
  });

  it("does not apply returnMultiplier while inactive", () => {
    const ctx = makeStubCtx();
    const trigger = createOverscrollTrigger({
      forcePerHit: 0.1,
      cooldownMs: 0,
      edgeTolerance: 10,
      touchDragThreshold: 100,
      returnMultiplier: 3,
    });
    trigger.start(ctx);

    wheel(50);

    expect(ctx.state.force).toBeCloseTo(0.1);
  });

  it("accepts a wheel at the top edge only when isActive (deactivation path)", () => {
    setScroll({ scrollY: 5, scrollHeight: 2000, innerHeight: 1100 });
    const ctx = makeStubCtx({ active: true });
    const trigger = createOverscrollTrigger({
      forcePerHit: 0.25,
      cooldownMs: 0,
      edgeTolerance: 10,
      touchDragThreshold: 100,
    });
    trigger.start(ctx);

    wheel(-50);

    expect(ctx.state.force).toBeCloseTo(0.25);
  });

  it("ignores a top-edge wheel while inactive (activation path only accepts bottom)", () => {
    setScroll({ scrollY: 5, scrollHeight: 2000, innerHeight: 1100 });
    const ctx = makeStubCtx();
    const trigger = createOverscrollTrigger({
      forcePerHit: 0.25,
      cooldownMs: 0,
      edgeTolerance: 10,
      touchDragThreshold: 100,
    });
    trigger.start(ctx);

    wheel(-50);

    expect(ctx.setForce).not.toHaveBeenCalled();
  });

  it("calls complete({ direction }) when force reaches 1 and canComplete is absent", () => {
    const ctx = makeStubCtx();
    const trigger = createOverscrollTrigger({
      forcePerHit: 1,
      cooldownMs: 0,
      edgeTolerance: 10,
      touchDragThreshold: 100,
    });
    trigger.start(ctx);

    wheel(50);

    expect(ctx.complete).toHaveBeenCalledWith({ direction: "bottom" });
  });

  it("gates complete with canComplete", () => {
    const canComplete = vi.fn(() => false);
    const ctx = makeStubCtx();
    const trigger = createOverscrollTrigger({
      forcePerHit: 1,
      cooldownMs: 0,
      edgeTolerance: 10,
      touchDragThreshold: 100,
      canComplete,
    });
    trigger.start(ctx);

    wheel(50);

    expect(canComplete).toHaveBeenCalledWith({
      force: 1,
      direction: "bottom",
    });
    expect(ctx.complete).not.toHaveBeenCalled();
  });

  it("completes when canComplete returns true", () => {
    const canComplete = vi.fn(() => true);
    const ctx = makeStubCtx();
    const trigger = createOverscrollTrigger({
      forcePerHit: 1,
      cooldownMs: 0,
      edgeTolerance: 10,
      touchDragThreshold: 100,
      canComplete,
    });
    trigger.start(ctx);

    wheel(50);

    expect(ctx.complete).toHaveBeenCalledOnce();
  });

  it("invokes onHit with { force, direction, isActive } on each accepted hit", () => {
    const onHit = vi.fn();
    const ctx = makeStubCtx();
    const trigger = createOverscrollTrigger({
      forcePerHit: 0.3,
      cooldownMs: 0,
      edgeTolerance: 10,
      touchDragThreshold: 100,
      onHit,
    });
    trigger.start(ctx);

    wheel(50);

    expect(onHit).toHaveBeenCalledOnce();
    const [{ force, direction, isActive }] = onHit.mock.calls[0];
    expect(force).toBeCloseTo(0.3);
    expect(direction).toBe("bottom");
    expect(isActive).toBe(false);
  });

  it("calls drainFn with (force, dt, isActive) on each frame", async () => {
    // Stub rAF to drive the drain loop deterministically.
    let rafCb = null;
    const rafSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb) => {
        rafCb = cb;
        return 1;
      });
    try {
      const drainFn = vi.fn((force) => force); // no-op drain
      const ctx = makeStubCtx();
      const trigger = createOverscrollTrigger({
        forcePerHit: 0.4,
        cooldownMs: 0,
        edgeTolerance: 10,
        touchDragThreshold: 100,
        drainFn,
      });
      trigger.start(ctx);

      // Accumulate some force so the drainFn is actually called (drain gated on force > 0)
      wheel(50);
      drainFn.mockClear();

      // Drive one additional frame of the drain loop.
      rafCb();

      expect(drainFn).toHaveBeenCalled();
      const args = drainFn.mock.calls[0];
      expect(args[0]).toBeCloseTo(0.4); // force
      expect(typeof args[1]).toBe("number"); // dt
      expect(args[2]).toBe(false); // isActive
    } finally {
      rafSpy.mockRestore();
    }
  });

  it("clamps drainFn output into [0, 1]", () => {
    let rafCb = null;
    const rafSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((cb) => {
        rafCb = cb;
        return 1;
      });
    try {
      const ctx = makeStubCtx();
      const trigger = createOverscrollTrigger({
        forcePerHit: 0.3,
        cooldownMs: 0,
        edgeTolerance: 10,
        touchDragThreshold: 100,
        drainFn: () => 10, // always too high
      });
      trigger.start(ctx);

      wheel(50);
      rafCb();

      expect(ctx.state.force).toBe(1);
    } finally {
      rafSpy.mockRestore();
    }
  });

  it("counts a downward touch drag past the threshold at the bottom edge", () => {
    const ctx = makeStubCtx();
    const trigger = createOverscrollTrigger({
      forcePerHit: 0.3,
      cooldownMs: 0,
      edgeTolerance: 10,
      touchDragThreshold: 50,
    });
    trigger.start(ctx);

    window.dispatchEvent(
      touchEvent("touchstart", [{ clientX: 0, clientY: 200 }]),
    );
    window.dispatchEvent(
      touchEvent("touchmove", [{ clientX: 0, clientY: 100 }]),
    );

    expect(ctx.state.force).toBeCloseTo(0.3);
  });

  it("does not count touch drags when not at the bottom edge", () => {
    setScroll({ scrollY: 400, scrollHeight: 2000, innerHeight: 1100 });
    const ctx = makeStubCtx();
    const trigger = createOverscrollTrigger({
      forcePerHit: 0.3,
      cooldownMs: 0,
      edgeTolerance: 10,
      touchDragThreshold: 50,
    });
    trigger.start(ctx);

    window.dispatchEvent(
      touchEvent("touchstart", [{ clientX: 0, clientY: 200 }]),
    );
    window.dispatchEvent(
      touchEvent("touchmove", [{ clientX: 0, clientY: 50 }]),
    );

    expect(ctx.setForce).not.toHaveBeenCalled();
  });

  it("does not count an upward touch drag (delta <= 0) at the bottom", () => {
    const ctx = makeStubCtx();
    const trigger = createOverscrollTrigger({
      forcePerHit: 0.3,
      cooldownMs: 0,
      edgeTolerance: 10,
      touchDragThreshold: 50,
    });
    trigger.start(ctx);

    window.dispatchEvent(
      touchEvent("touchstart", [{ clientX: 0, clientY: 100 }]),
    );
    window.dispatchEvent(
      touchEvent("touchmove", [{ clientX: 0, clientY: 200 }]),
    );

    expect(ctx.setForce).not.toHaveBeenCalled();
  });
});
