import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createKeyChordTrigger } from "../../../js/themes/triggers.js";

// A stub ctx that mimics what createTheme hands to trigger.start(). Tests
// drive setForce/complete flags manually so the trigger can be exercised
// without spinning up the full factory.
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

function pressKey(key, opts = {}) {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ctrlKey: !!opts.ctrl,
    metaKey: !!opts.meta,
    altKey: !!opts.alt,
    shiftKey: !!opts.shift,
  });
  window.dispatchEvent(event);
  return event;
}

describe("createKeyChordTrigger", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("reaches force 1 and calls complete after activateCount presses", () => {
    const ctx = makeStubCtx();
    const trigger = createKeyChordTrigger({
      key: "Escape",
      activateCount: 5,
      deactivateCount: 3,
    });
    trigger.start(ctx);

    for (let i = 0; i < 4; i++) pressKey("Escape");
    expect(ctx.complete).not.toHaveBeenCalled();
    expect(ctx.state.force).toBeCloseTo(0.8);

    pressKey("Escape");
    expect(ctx.complete).toHaveBeenCalledOnce();
  });

  it("uses deactivateCount as the target while ctx.isActive() is true", () => {
    const ctx = makeStubCtx({ active: true });
    const trigger = createKeyChordTrigger({
      key: "Escape",
      activateCount: 10,
      deactivateCount: 3,
    });
    trigger.start(ctx);

    for (let i = 0; i < 3; i++) pressKey("Escape");

    expect(ctx.complete).toHaveBeenCalledOnce();
  });

  it("ignores presses while isTransitioning is true", () => {
    const ctx = makeStubCtx({ transitioning: true });
    const trigger = createKeyChordTrigger({
      key: "Escape",
      activateCount: 1,
      deactivateCount: 1,
    });
    trigger.start(ctx);

    pressKey("Escape");

    expect(ctx.setForce).not.toHaveBeenCalled();
    expect(ctx.complete).not.toHaveBeenCalled();
  });

  it("ignores presses of any other key", () => {
    const ctx = makeStubCtx();
    const trigger = createKeyChordTrigger({
      key: "Escape",
      activateCount: 2,
      deactivateCount: 2,
    });
    trigger.start(ctx);

    pressKey("Enter");
    pressKey("a");
    pressKey("Tab");

    expect(ctx.setForce).not.toHaveBeenCalled();
    expect(ctx.complete).not.toHaveBeenCalled();
  });

  it("ignores presses with any modifier (Ctrl/Meta/Alt/Shift)", () => {
    const ctx = makeStubCtx();
    const trigger = createKeyChordTrigger({
      key: "Escape",
      activateCount: 2,
      deactivateCount: 2,
    });
    trigger.start(ctx);

    pressKey("Escape", { ctrl: true });
    pressKey("Escape", { meta: true });
    pressKey("Escape", { alt: true });
    pressKey("Escape", { shift: true });

    expect(ctx.setForce).not.toHaveBeenCalled();
  });

  it("ignores presses while a form input is focused", () => {
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    const ctx = makeStubCtx();
    const trigger = createKeyChordTrigger({
      key: "Escape",
      activateCount: 2,
      deactivateCount: 2,
    });
    trigger.start(ctx);

    pressKey("Escape");

    expect(ctx.setForce).not.toHaveBeenCalled();
  });

  it("ignores presses while a contentEditable element is focused", () => {
    const div = document.createElement("div");
    div.contentEditable = "true";
    document.body.appendChild(div);
    div.focus();
    const ctx = makeStubCtx();
    const trigger = createKeyChordTrigger({
      key: "Escape",
      activateCount: 2,
      deactivateCount: 2,
    });
    trigger.start(ctx);

    pressKey("Escape");

    expect(ctx.setForce).not.toHaveBeenCalled();
  });

  it("calls preventDefault only on contributing presses", () => {
    const ctx = makeStubCtx();
    const trigger = createKeyChordTrigger({
      key: "Escape",
      activateCount: 5,
      deactivateCount: 3,
    });
    trigger.start(ctx);

    const counted = pressKey("Escape");
    const wrongKey = pressKey("Enter");
    const modified = pressKey("Escape", { ctrl: true });

    expect(counted.defaultPrevented).toBe(true);
    expect(wrongKey.defaultPrevented).toBe(false);
    expect(modified.defaultPrevented).toBe(false);
  });

  it("resets internal force to 0 on completion so the next build-up starts fresh", () => {
    const ctx = makeStubCtx();
    const trigger = createKeyChordTrigger({
      key: "Escape",
      activateCount: 2,
      deactivateCount: 2,
    });
    trigger.start(ctx);

    pressKey("Escape");
    pressKey("Escape");
    // After complete: force was reset. The next press should land at 1/target,
    // not carry residue from the prior build-up.
    ctx.setForce.mockClear();
    pressKey("Escape");
    expect(ctx.setForce).toHaveBeenLastCalledWith(0.5);
  });

  it("does not decay before timeoutMs has elapsed", () => {
    const ctx = makeStubCtx();
    const TIMEOUT_MS = 1500;
    const trigger = createKeyChordTrigger({
      key: "Escape",
      activateCount: 5,
      deactivateCount: 3,
      timeoutMs: TIMEOUT_MS,
      decayRate: 4,
    });
    trigger.start(ctx);
    pressKey("Escape");
    const forceAfterPress = ctx.state.force;
    ctx.setForce.mockClear();

    vi.advanceTimersByTime(TIMEOUT_MS / 2);

    expect(ctx.state.force).toBe(forceAfterPress);
  });

  it("drains force to zero after enough idle time past timeoutMs", () => {
    const TIMEOUT_MS = 500;
    const FULL_DRAIN_MS = TIMEOUT_MS * 4;
    const ctx = makeStubCtx();
    const trigger = createKeyChordTrigger({
      key: "Escape",
      activateCount: 5,
      deactivateCount: 3,
      timeoutMs: TIMEOUT_MS,
      decayRate: 4,
    });
    trigger.start(ctx);
    pressKey("Escape");
    const forceAfterPress = ctx.state.force;

    vi.advanceTimersByTime(FULL_DRAIN_MS);

    expect(ctx.state.force).toBeLessThan(forceAfterPress);
    expect(ctx.state.force).toBe(0);
  });

  it("completes on exactly N presses for targets whose reciprocal isn't FP-exact", () => {
    // Targets like 10, 13, 15 produce drift when 1/N is summed N times — the
    // final sum lands at 0.999... instead of 1.0. The trigger must still
    // complete at the declared count, not N+1.
    for (const target of [10, 13, 15]) {
      const ctx = makeStubCtx();
      const trigger = createKeyChordTrigger({
        key: "Escape",
        activateCount: target,
        deactivateCount: target,
      });
      trigger.start(ctx);

      for (let i = 0; i < target; i++) pressKey("Escape");

      expect(ctx.complete).toHaveBeenCalledOnce();
    }
  });
});
