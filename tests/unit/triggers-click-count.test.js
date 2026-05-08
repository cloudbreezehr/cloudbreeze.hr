import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createClickCountTrigger } from "../../js/modes/triggers.js";

// A stub ctx that mimics what createMode hands to trigger.start(). Tests
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

describe("createClickCountTrigger", () => {
  let element;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));
    element = document.createElement("button");
    document.body.appendChild(element);
  });

  afterEach(() => {
    element.remove();
    vi.useRealTimers();
  });

  it("reaches force 1 and calls complete after activateCount clicks", () => {
    const ctx = makeStubCtx();
    const trigger = createClickCountTrigger({
      element,
      activateCount: 4,
      deactivateCount: 2,
    });
    trigger.start(ctx);

    for (let i = 0; i < 3; i++) {
      element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    }
    expect(ctx.complete).not.toHaveBeenCalled();
    expect(ctx.state.force).toBeCloseTo(0.75);

    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(ctx.complete).toHaveBeenCalledOnce();
  });

  it("uses deactivateCount as the target while ctx.isActive() is true", () => {
    const ctx = makeStubCtx({ active: true });
    const trigger = createClickCountTrigger({
      element,
      activateCount: 10,
      deactivateCount: 2,
    });
    trigger.start(ctx);

    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(ctx.complete).toHaveBeenCalledOnce();
  });

  it("ignores clicks while isTransitioning is true", () => {
    const ctx = makeStubCtx({ transitioning: true });
    const trigger = createClickCountTrigger({
      element,
      activateCount: 1,
      deactivateCount: 1,
    });
    trigger.start(ctx);

    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(ctx.setForce).not.toHaveBeenCalled();
    expect(ctx.complete).not.toHaveBeenCalled();
  });

  it("fires preClick on every click, even during a transition", () => {
    const preClick = vi.fn();
    const ctx = makeStubCtx({ transitioning: true });
    const trigger = createClickCountTrigger({
      element,
      activateCount: 5,
      deactivateCount: 3,
      preClick,
    });
    trigger.start(ctx);

    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(preClick).toHaveBeenCalledTimes(2);
  });

  it("passes force and isActive to onClick", () => {
    const onClick = vi.fn();
    const ctx = makeStubCtx();
    const trigger = createClickCountTrigger({
      element,
      activateCount: 4,
      deactivateCount: 2,
      onClick,
    });
    trigger.start(ctx);

    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(onClick).toHaveBeenCalledOnce();
    const [, payload] = onClick.mock.calls[0];
    expect(payload.force).toBeCloseTo(0.25);
    expect(payload.isActive).toBe(false);
  });

  it("resets internal force to 0 on completion so the next build-up starts fresh", () => {
    const ctx = makeStubCtx();
    const trigger = createClickCountTrigger({
      element,
      activateCount: 2,
      deactivateCount: 2,
    });
    trigger.start(ctx);

    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    // After complete: force was reset. The next click should land at 1/target,
    // not carry residue from the prior build-up.
    ctx.setForce.mockClear();
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(ctx.setForce).toHaveBeenLastCalledWith(0.5);
  });

  it("does not decay before timeoutMs has elapsed", () => {
    const ctx = makeStubCtx();
    const trigger = createClickCountTrigger({
      element,
      activateCount: 4,
      deactivateCount: 2,
      timeoutMs: 1000,
      decayRate: 4,
    });
    trigger.start(ctx);
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const forceAfterClick = ctx.state.force;
    ctx.setForce.mockClear();

    vi.advanceTimersByTime(500);

    // 500ms is below timeoutMs; force must not have been updated
    expect(ctx.state.force).toBe(forceAfterClick);
  });

  it("drains force after timeoutMs of idle", () => {
    const ctx = makeStubCtx();
    const trigger = createClickCountTrigger({
      element,
      activateCount: 4,
      deactivateCount: 2,
      timeoutMs: 500,
      decayRate: 4, // 4 clicks/sec → 1.0 force/sec against a 4-click target
    });
    trigger.start(ctx);
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const forceAfterClick = ctx.state.force;

    // Advance past timeoutMs plus a full decay span
    vi.advanceTimersByTime(2000);

    expect(ctx.state.force).toBeLessThan(forceAfterClick);
    expect(ctx.state.force).toBe(0);
  });

  it("uses a target-relative decay rate so deactivate and activate drain proportionally", () => {
    const ctx = makeStubCtx({ active: true });
    const trigger = createClickCountTrigger({
      element,
      activateCount: 20,
      deactivateCount: 4,
      timeoutMs: 100,
      decayRate: 2, // 2 clicks/sec → 0.5 force/sec against a 4-click target
    });
    trigger.start(ctx);
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(ctx.state.force).toBeCloseTo(0.25);

    vi.advanceTimersByTime(300);

    // ~200ms of decay at 0.5/sec ≈ 0.1 drop. Assert it is noticeably below 0.25.
    expect(ctx.state.force).toBeLessThan(0.2);
    expect(ctx.state.force).toBeGreaterThan(0);
  });

  it("clamps force at 1 even if click count overflows the target (completion resets)", () => {
    const ctx = makeStubCtx();
    const trigger = createClickCountTrigger({
      element,
      activateCount: 2,
      deactivateCount: 2,
    });
    trigger.start(ctx);

    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    // First complete fires at click 2; click 3 starts a fresh build-up.
    expect(ctx.complete).toHaveBeenCalledOnce();
    expect(ctx.state.force).toBeCloseTo(0.5);
  });

  it("completes on exactly N clicks for targets whose reciprocal isn't FP-exact", () => {
    // Targets like 10, 13, 15 produce drift when 1/N is summed N times — the
    // final sum lands at 0.999... instead of 1.0. The trigger must still
    // complete at the declared count, not N+1.
    for (const target of [10, 13, 15]) {
      const ctx = makeStubCtx();
      const trigger = createClickCountTrigger({
        element,
        activateCount: target,
        deactivateCount: target,
      });
      trigger.start(ctx);

      for (let i = 0; i < target; i++) {
        element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      }

      expect(ctx.complete).toHaveBeenCalledOnce();
    }
  });
});
