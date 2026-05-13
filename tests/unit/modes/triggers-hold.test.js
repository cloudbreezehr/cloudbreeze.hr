import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHoldTrigger } from "../../../js/modes/triggers.js";

// Hold durations used across tests. The factory takes these as parameters,
// so the values are defined here (not in the source) — naming them keeps
// every test consistent and readable. Symbolic math (HOLD_ACTIVATE_MS / 2,
// HOLD_ACTIVATE_MS + SLACK_MS) survives any tuning of these constants.
const HOLD_ACTIVATE_MS = 1000;
const HOLD_DEACTIVATE_MS = 500;
const SLACK_MS = 100;

// Synthesize a pointer event — happy-dom's PointerEvent constructor doesn't
// accept clientX/Y directly, so use a plain Event and define them manually
// (mirrors pointer.test.js).
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
      holdActivateMs: HOLD_ACTIVATE_MS,
      holdDeactivateMs: HOLD_DEACTIVATE_MS,
      shouldAccept,
    });
    trigger.start(ctx);

    target.dispatchEvent(pointerEvent("pointerdown", { x: 5, y: 7 }));
    vi.advanceTimersByTime(HOLD_ACTIVATE_MS / 2);

    expect(shouldAccept).toHaveBeenCalledWith(5, 7, expect.any(Event));
    expect(ctx.setForce).not.toHaveBeenCalled();
  });

  it("ignores pointerdown while isTransitioning is true", () => {
    const ctx = makeStubCtx({ transitioning: true });
    const trigger = createHoldTrigger({
      target,
      holdActivateMs: HOLD_ACTIVATE_MS,
      holdDeactivateMs: HOLD_DEACTIVATE_MS,
    });
    trigger.start(ctx);

    target.dispatchEvent(pointerEvent("pointerdown"));
    vi.advanceTimersByTime(HOLD_ACTIVATE_MS / 2);

    expect(ctx.setForce).not.toHaveBeenCalled();
  });

  it("grows force linearly toward 1 over holdActivateMs", () => {
    const ctx = makeStubCtx();
    const trigger = createHoldTrigger({
      target,
      holdActivateMs: HOLD_ACTIVATE_MS,
      holdDeactivateMs: HOLD_DEACTIVATE_MS,
    });
    trigger.start(ctx);

    target.dispatchEvent(pointerEvent("pointerdown"));
    vi.advanceTimersByTime(HOLD_ACTIVATE_MS / 2);

    // At half the activate duration, force should be ~0.5.
    expect(ctx.state.force).toBeGreaterThan(0.4);
    expect(ctx.state.force).toBeLessThan(0.6);
  });

  it("uses holdDeactivateMs as the target when ctx.isActive() is true", () => {
    // Activate and deactivate are deliberately different so the test fails
    // loudly if the trigger uses the wrong duration once active.
    const ctx = makeStubCtx({ active: true });
    const trigger = createHoldTrigger({
      target,
      holdActivateMs: HOLD_ACTIVATE_MS,
      holdDeactivateMs: HOLD_DEACTIVATE_MS,
    });
    trigger.start(ctx);

    target.dispatchEvent(pointerEvent("pointerdown"));
    vi.advanceTimersByTime(HOLD_DEACTIVATE_MS / 2);

    // At half the deactivate duration, force should be ~0.5.
    expect(ctx.state.force).toBeGreaterThan(0.4);
    expect(ctx.state.force).toBeLessThan(0.6);
  });

  it("calls complete() exactly once when the hold reaches 1", () => {
    const ctx = makeStubCtx();
    const trigger = createHoldTrigger({
      target,
      holdActivateMs: HOLD_ACTIVATE_MS,
      holdDeactivateMs: HOLD_ACTIVATE_MS,
    });
    trigger.start(ctx);

    target.dispatchEvent(pointerEvent("pointerdown"));
    vi.advanceTimersByTime(HOLD_ACTIVATE_MS + SLACK_MS);

    expect(ctx.complete).toHaveBeenCalledOnce();
  });

  it("invokes onDown with (x, y, event) on pointerdown", () => {
    const onDown = vi.fn();
    const ctx = makeStubCtx();
    const trigger = createHoldTrigger({
      target,
      holdActivateMs: HOLD_ACTIVATE_MS,
      holdDeactivateMs: HOLD_ACTIVATE_MS,
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
      holdActivateMs: HOLD_ACTIVATE_MS,
      holdDeactivateMs: HOLD_ACTIVATE_MS,
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
      holdActivateMs: HOLD_ACTIVATE_MS,
      holdDeactivateMs: HOLD_ACTIVATE_MS,
      onUp,
    });
    trigger.start(ctx);

    target.dispatchEvent(pointerEvent("pointerdown"));
    // Past the activate duration — completion path fires onUp once.
    vi.advanceTimersByTime(HOLD_ACTIVATE_MS + SLACK_MS);
    target.dispatchEvent(pointerEvent("pointerup")); // physical release

    expect(onUp).toHaveBeenCalledOnce();
  });

  it("fires onUp on a plain release (no completion)", () => {
    const SHORT_HOLD_MS = HOLD_ACTIVATE_MS / 5;
    const onUp = vi.fn();
    const ctx = makeStubCtx();
    const trigger = createHoldTrigger({
      target,
      holdActivateMs: HOLD_ACTIVATE_MS,
      holdDeactivateMs: HOLD_ACTIVATE_MS,
      onUp,
    });
    trigger.start(ctx);

    target.dispatchEvent(pointerEvent("pointerdown"));
    vi.advanceTimersByTime(SHORT_HOLD_MS);
    target.dispatchEvent(pointerEvent("pointerup"));

    expect(onUp).toHaveBeenCalledOnce();
  });

  it("re-arms the onUp latch on a new pointerdown so a fresh hold can fire onUp again", () => {
    const onUp = vi.fn();
    const ctx = makeStubCtx();
    const trigger = createHoldTrigger({
      target,
      holdActivateMs: HOLD_ACTIVATE_MS,
      holdDeactivateMs: HOLD_ACTIVATE_MS,
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
    const BUILD_DURATION_MS = HOLD_ACTIVATE_MS * 0.6;
    const DECAY_DURATION_MS = HOLD_ACTIVATE_MS * 0.4;
    const ctx = makeStubCtx();
    const trigger = createHoldTrigger({
      target,
      holdActivateMs: HOLD_ACTIVATE_MS,
      holdDeactivateMs: HOLD_ACTIVATE_MS,
      decayRate: 0.5,
    });
    trigger.start(ctx);

    target.dispatchEvent(pointerEvent("pointerdown"));
    vi.advanceTimersByTime(BUILD_DURATION_MS);
    const forceAtRelease = ctx.state.force;
    target.dispatchEvent(pointerEvent("pointerup"));

    vi.advanceTimersByTime(DECAY_DURATION_MS);

    expect(ctx.state.force).toBeLessThan(forceAtRelease);
    expect(ctx.state.force).toBeGreaterThan(0);
  });

  it("stops decaying and drains to 0 eventually", () => {
    const HALF_HOLD_MS = HOLD_ACTIVATE_MS / 2;
    // Decay rate is 2/sec; FULL_DRAIN_MS is well past the time required to
    // drain a full hold so the result is unambiguous regardless of tuning.
    const FULL_DRAIN_MS = HOLD_ACTIVATE_MS * 2;
    const ctx = makeStubCtx();
    const trigger = createHoldTrigger({
      target,
      holdActivateMs: HOLD_ACTIVATE_MS,
      holdDeactivateMs: HOLD_ACTIVATE_MS,
      decayRate: 2,
    });
    trigger.start(ctx);

    target.dispatchEvent(pointerEvent("pointerdown"));
    vi.advanceTimersByTime(HALF_HOLD_MS);
    target.dispatchEvent(pointerEvent("pointerup"));

    vi.advanceTimersByTime(FULL_DRAIN_MS);

    expect(ctx.state.force).toBe(0);
  });
});
