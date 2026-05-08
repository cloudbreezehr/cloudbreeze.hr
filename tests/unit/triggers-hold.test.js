import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHoldTrigger } from "../../js/modes/triggers.js";

// Synthesize a pointer event — happy-dom's PointerEvent constructor doesn't
// accept clientX/Y directly, so use a plain Event and define them manually
// (mirrors tests/unit/pointer.test.js).
function pointerEvent(type, { x = 0, y = 0 } = {}) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clientX", { value: x });
  Object.defineProperty(event, "clientY", { value: y });
  return event;
}

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

describe("createHoldTrigger", () => {
  let target;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));
    target = document.createElement("div");
    document.body.appendChild(target);
  });

  afterEach(() => {
    target.remove();
    vi.useRealTimers();
  });

  it("ignores pointerdown when shouldAccept returns false", () => {
    const shouldAccept = vi.fn(() => false);
    const ctx = makeStubCtx();
    const trigger = createHoldTrigger({
      target,
      holdActivateMs: 1000,
      holdDeactivateMs: 500,
      shouldAccept,
    });
    trigger.start(ctx);

    target.dispatchEvent(pointerEvent("pointerdown", { x: 5, y: 7 }));
    vi.advanceTimersByTime(500);

    expect(shouldAccept).toHaveBeenCalledWith(5, 7, expect.any(Event));
    expect(ctx.setForce).not.toHaveBeenCalled();
  });

  it("ignores pointerdown while isTransitioning is true", () => {
    const ctx = makeStubCtx({ transitioning: true });
    const trigger = createHoldTrigger({
      target,
      holdActivateMs: 1000,
      holdDeactivateMs: 500,
    });
    trigger.start(ctx);

    target.dispatchEvent(pointerEvent("pointerdown"));
    vi.advanceTimersByTime(500);

    expect(ctx.setForce).not.toHaveBeenCalled();
  });

  it("grows force linearly toward 1 over holdActivateMs", () => {
    const ctx = makeStubCtx();
    const trigger = createHoldTrigger({
      target,
      holdActivateMs: 1000,
      holdDeactivateMs: 500,
    });
    trigger.start(ctx);

    target.dispatchEvent(pointerEvent("pointerdown"));
    vi.advanceTimersByTime(500);

    // At half the activate duration, force should be ~0.5.
    expect(ctx.state.force).toBeGreaterThan(0.4);
    expect(ctx.state.force).toBeLessThan(0.6);
  });

  it("uses holdDeactivateMs as the target when ctx.isActive() is true", () => {
    const ctx = makeStubCtx({ active: true });
    const trigger = createHoldTrigger({
      target,
      holdActivateMs: 5000,
      holdDeactivateMs: 500,
    });
    trigger.start(ctx);

    target.dispatchEvent(pointerEvent("pointerdown"));
    vi.advanceTimersByTime(250);

    // At half the deactivate duration, force should be ~0.5.
    expect(ctx.state.force).toBeGreaterThan(0.4);
    expect(ctx.state.force).toBeLessThan(0.6);
  });

  it("calls complete() exactly once when the hold reaches 1", () => {
    const ctx = makeStubCtx();
    const trigger = createHoldTrigger({
      target,
      holdActivateMs: 500,
      holdDeactivateMs: 500,
    });
    trigger.start(ctx);

    target.dispatchEvent(pointerEvent("pointerdown"));
    vi.advanceTimersByTime(600);

    expect(ctx.complete).toHaveBeenCalledOnce();
  });

  it("invokes onDown with (x, y, event) on pointerdown", () => {
    const onDown = vi.fn();
    const ctx = makeStubCtx();
    const trigger = createHoldTrigger({
      target,
      holdActivateMs: 100,
      holdDeactivateMs: 100,
      onDown,
    });
    trigger.start(ctx);

    target.dispatchEvent(pointerEvent("pointerdown", { x: 3, y: 9 }));

    expect(onDown).toHaveBeenCalledWith(3, 9, expect.any(Event));
  });

  it("invokes onMove while the hold is active", () => {
    const onMove = vi.fn();
    const ctx = makeStubCtx();
    const trigger = createHoldTrigger({
      target,
      holdActivateMs: 100,
      holdDeactivateMs: 100,
      onMove,
    });
    trigger.start(ctx);

    target.dispatchEvent(pointerEvent("pointerdown", { x: 0, y: 0 }));
    target.dispatchEvent(pointerEvent("pointermove", { x: 7, y: 8 }));

    expect(onMove).toHaveBeenCalledWith(7, 8);
  });

  it("fires onUp exactly once per hold (completion + pointerup do not double-fire)", () => {
    const onUp = vi.fn();
    const ctx = makeStubCtx();
    const trigger = createHoldTrigger({
      target,
      holdActivateMs: 500,
      holdDeactivateMs: 500,
      onUp,
    });
    trigger.start(ctx);

    target.dispatchEvent(pointerEvent("pointerdown"));
    vi.advanceTimersByTime(600); // completion path fires onUp once
    target.dispatchEvent(pointerEvent("pointerup")); // physical release

    expect(onUp).toHaveBeenCalledOnce();
  });

  it("fires onUp on a plain release (no completion)", () => {
    const onUp = vi.fn();
    const ctx = makeStubCtx();
    const trigger = createHoldTrigger({
      target,
      holdActivateMs: 1000,
      holdDeactivateMs: 1000,
      onUp,
    });
    trigger.start(ctx);

    target.dispatchEvent(pointerEvent("pointerdown"));
    vi.advanceTimersByTime(200);
    target.dispatchEvent(pointerEvent("pointerup"));

    expect(onUp).toHaveBeenCalledOnce();
  });

  it("re-arms the onUp latch on a new pointerdown so a fresh hold can fire onUp again", () => {
    const onUp = vi.fn();
    const ctx = makeStubCtx();
    const trigger = createHoldTrigger({
      target,
      holdActivateMs: 500,
      holdDeactivateMs: 500,
      onUp,
    });
    trigger.start(ctx);

    target.dispatchEvent(pointerEvent("pointerdown"));
    target.dispatchEvent(pointerEvent("pointerup"));
    target.dispatchEvent(pointerEvent("pointerdown"));
    target.dispatchEvent(pointerEvent("pointerup"));

    expect(onUp).toHaveBeenCalledTimes(2);
  });

  it("decays force at decayRate per second once the pointer is released", () => {
    const ctx = makeStubCtx();
    const trigger = createHoldTrigger({
      target,
      holdActivateMs: 1000,
      holdDeactivateMs: 1000,
      decayRate: 0.5, // 0.5 force/sec
    });
    trigger.start(ctx);

    target.dispatchEvent(pointerEvent("pointerdown"));
    vi.advanceTimersByTime(600); // build force to ~0.6
    const forceAtRelease = ctx.state.force;
    target.dispatchEvent(pointerEvent("pointerup"));

    vi.advanceTimersByTime(400); // 0.2 force drained at 0.5/sec

    expect(ctx.state.force).toBeLessThan(forceAtRelease);
    expect(ctx.state.force).toBeGreaterThan(0);
  });

  it("stops decaying and drains to 0 eventually", () => {
    const ctx = makeStubCtx();
    const trigger = createHoldTrigger({
      target,
      holdActivateMs: 1000,
      holdDeactivateMs: 1000,
      decayRate: 2,
    });
    trigger.start(ctx);

    target.dispatchEvent(pointerEvent("pointerdown"));
    vi.advanceTimersByTime(500);
    target.dispatchEvent(pointerEvent("pointerup"));

    vi.advanceTimersByTime(2000);

    expect(ctx.state.force).toBe(0);
  });
});
