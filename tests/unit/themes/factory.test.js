import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// playWipe is stubbed so tests can drive cover/reveal timing precisely and
// avoid leaving wipe <div>s in the DOM between tests.
vi.mock("../../../js/effects/wipe.js", () => ({
  playWipe: vi.fn(),
}));

import { playWipe } from "../../../js/effects/wipe.js";
import { createTheme, rampAbove } from "../../../js/themes/factory.js";
import { toggleTheme } from "../../../js/themes/registry.js";

describe("rampAbove", () => {
  it("is 0 at the threshold and 1 at full progress", () => {
    expect(rampAbove(0.4, 0.4)).toBe(0);
    expect(rampAbove(1, 0.4)).toBe(1);
  });

  it("ramps linearly across the span above the threshold", () => {
    expect(rampAbove(0.7, 0.4)).toBeCloseTo(0.5, 5); // halfway from 0.4 → 1
  });

  it("clamps at 1 past full progress", () => {
    expect(rampAbove(2, 0.4)).toBe(1);
  });
});

// createTheme requires an id that exists in the registry; pick one and share it.
// The id is only used as a body-class and an achievement-event field.
const THEME_ID = "frozen";
const OTHER_THEME_ID = "blocky";

function makeIndicator({ threshold = 0, withClear = false } = {}) {
  const ind = { threshold, apply: vi.fn() };
  if (withClear) ind.clear = vi.fn();
  return ind;
}

// A trigger that captures the ctx handed to start() so tests can drive
// setForce/complete directly without simulating user input.
function makeManualTrigger() {
  const capture = {};
  return {
    trigger: {
      start(ctx) {
        capture.ctx = ctx;
      },
    },
    capture,
  };
}

function defaultPlayWipeImpl({ onMidpoint, onComplete }) {
  // Run the full cover→midpoint→reveal cycle synchronously by default.
  if (onMidpoint) onMidpoint();
  if (onComplete) onComplete();
}

describe("createTheme — force and indicators", () => {
  beforeEach(() => {
    document.body.className = "";
    delete document.body.dataset.lastTheme;
    playWipe.mockReset();
    playWipe.mockImplementation(defaultPlayWipeImpl);
  });

  afterEach(() => {
    document.body.className = "";
    delete document.body.dataset.lastTheme;
  });

  it("passes the current force and ctx to every indicator's apply on setForce", () => {
    const a = makeIndicator();
    const b = makeIndicator();
    const { trigger, capture } = makeManualTrigger();

    const ctx = createTheme({
      id: THEME_ID,
      trigger,
      indicators: [a, b],
      wipe: { className: "w", coverMs: 0, revealMs: 0 },
    });

    capture.ctx.setForce(0.5);

    expect(a.apply).toHaveBeenLastCalledWith(0.5, ctx);
    expect(b.apply).toHaveBeenLastCalledWith(0.5, ctx);
  });

  it("clamps setForce below 0 to 0", () => {
    const ind = makeIndicator();
    const { trigger, capture } = makeManualTrigger();
    createTheme({
      id: THEME_ID,
      trigger,
      indicators: [ind],
      wipe: { className: "w", coverMs: 0, revealMs: 0 },
    });

    capture.ctx.setForce(-3);

    expect(ind.apply).toHaveBeenLastCalledWith(0, expect.anything());
  });

  it("clamps setForce above 1 to 1", () => {
    const ind = makeIndicator();
    const { trigger, capture } = makeManualTrigger();
    createTheme({
      id: THEME_ID,
      trigger,
      indicators: [ind],
      wipe: { className: "w", coverMs: 0, revealMs: 0 },
    });

    capture.ctx.setForce(3);

    expect(ind.apply).toHaveBeenLastCalledWith(1, expect.anything());
  });

  it("returned ctx reports force as a live getter", () => {
    const { trigger, capture } = makeManualTrigger();
    const ctx = createTheme({
      id: THEME_ID,
      trigger,
      indicators: [],
      wipe: { className: "w", coverMs: 0, revealMs: 0 },
    });

    expect(ctx.force).toBe(0);
    capture.ctx.setForce(0.42);
    expect(ctx.force).toBe(0.42);
  });

  it("returned ctx reports isActive as a live getter", () => {
    const { trigger, capture } = makeManualTrigger();
    const ctx = createTheme({
      id: THEME_ID,
      trigger,
      indicators: [],
      wipe: { className: "w", coverMs: 0, revealMs: 0 },
    });

    expect(ctx.isActive).toBe(false);
    capture.ctx.complete();
    expect(ctx.isActive).toBe(true);
  });
});

describe("createTheme — runMidpoint side effects", () => {
  beforeEach(() => {
    document.body.className = "";
    delete document.body.dataset.lastTheme;
    playWipe.mockReset();
    playWipe.mockImplementation(defaultPlayWipeImpl);
  });

  afterEach(() => {
    document.body.className = "";
    delete document.body.dataset.lastTheme;
  });

  it("toggles body class on activation", () => {
    const { trigger, capture } = makeManualTrigger();
    createTheme({
      id: THEME_ID,
      trigger,
      indicators: [],
      wipe: { className: "w", coverMs: 0, revealMs: 0 },
    });

    capture.ctx.complete();

    expect(document.body.classList.contains(THEME_ID)).toBe(true);
  });

  it("removes body class on deactivation", () => {
    const { trigger, capture } = makeManualTrigger();
    createTheme({
      id: THEME_ID,
      trigger,
      indicators: [],
      wipe: { className: "w", coverMs: 0, revealMs: 0 },
    });

    capture.ctx.complete(); // activate
    capture.ctx.complete(); // deactivate

    expect(document.body.classList.contains(THEME_ID)).toBe(false);
  });

  it("stamps body.dataset.lastTheme on activation", () => {
    const { trigger, capture } = makeManualTrigger();
    createTheme({
      id: THEME_ID,
      trigger,
      indicators: [],
      wipe: { className: "w", coverMs: 0, revealMs: 0 },
    });

    capture.ctx.complete();

    expect(document.body.dataset.lastTheme).toBe(THEME_ID);
  });

  it("leaves a prior lastTheme value untouched on deactivation", () => {
    const { trigger, capture } = makeManualTrigger();
    createTheme({
      id: THEME_ID,
      trigger,
      indicators: [],
      wipe: { className: "w", coverMs: 0, revealMs: 0 },
    });

    capture.ctx.complete(); // activate stamps lastTheme
    capture.ctx.complete(); // deactivate

    expect(document.body.dataset.lastTheme).toBe(THEME_ID);
  });

  it("dispatches an achievement event with type theme-activate on activation", () => {
    const listener = vi.fn();
    window.addEventListener("achievement", listener);

    const { trigger, capture } = makeManualTrigger();
    createTheme({
      id: THEME_ID,
      trigger,
      indicators: [],
      wipe: { className: "w", coverMs: 0, revealMs: 0 },
    });
    capture.ctx.complete();
    window.removeEventListener("achievement", listener);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0][0].detail).toMatchObject({
      type: "theme-activate",
      theme: THEME_ID,
      silent: false,
    });
  });

  it("dispatches an achievement event with type theme-deactivate on deactivation", () => {
    const { trigger, capture } = makeManualTrigger();
    createTheme({
      id: THEME_ID,
      trigger,
      indicators: [],
      wipe: { className: "w", coverMs: 0, revealMs: 0 },
    });
    capture.ctx.complete(); // activate first

    const listener = vi.fn();
    window.addEventListener("achievement", listener);
    capture.ctx.complete();
    window.removeEventListener("achievement", listener);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0][0].detail.type).toBe("theme-deactivate");
  });

  it("propagates payload.silent into the achievement event detail", () => {
    const listener = vi.fn();
    window.addEventListener("achievement", listener);

    const { trigger, capture } = makeManualTrigger();
    createTheme({
      id: THEME_ID,
      trigger,
      indicators: [],
      wipe: { className: "w", coverMs: 0, revealMs: 0 },
    });
    capture.ctx.complete({ silent: true });
    window.removeEventListener("achievement", listener);

    expect(listener.mock.calls[0][0].detail.silent).toBe(true);
  });

  it("invokes onActivate with the payload on activation", () => {
    const onActivate = vi.fn();
    const onDeactivate = vi.fn();
    const { trigger, capture } = makeManualTrigger();
    createTheme({
      id: THEME_ID,
      trigger,
      indicators: [],
      wipe: { className: "w", coverMs: 0, revealMs: 0 },
      onActivate,
      onDeactivate,
    });

    const payload = { silent: false };
    capture.ctx.complete(payload);

    expect(onActivate).toHaveBeenCalledOnce();
    expect(onActivate).toHaveBeenCalledWith({ payload });
    expect(onDeactivate).not.toHaveBeenCalled();
  });

  it("invokes onDeactivate with the payload on deactivation", () => {
    const onActivate = vi.fn();
    const onDeactivate = vi.fn();
    const { trigger, capture } = makeManualTrigger();
    createTheme({
      id: THEME_ID,
      trigger,
      indicators: [],
      wipe: { className: "w", coverMs: 0, revealMs: 0 },
      onActivate,
      onDeactivate,
    });

    capture.ctx.complete();
    const payload = { silent: true };
    capture.ctx.complete(payload);

    expect(onDeactivate).toHaveBeenCalledOnce();
    expect(onDeactivate).toHaveBeenCalledWith({ payload });
  });

  it("calls each indicator's clear() when provided", () => {
    const ind = makeIndicator({ withClear: true });
    const { trigger, capture } = makeManualTrigger();
    createTheme({
      id: THEME_ID,
      trigger,
      indicators: [ind],
      wipe: { className: "w", coverMs: 0, revealMs: 0 },
    });

    capture.ctx.complete();

    expect(ind.clear).toHaveBeenCalledOnce();
  });

  it("falls back to apply(0, ctx) when an indicator has no clear", () => {
    const ind = makeIndicator();
    const { trigger, capture } = makeManualTrigger();
    const ctx = createTheme({
      id: THEME_ID,
      trigger,
      indicators: [ind],
      wipe: { className: "w", coverMs: 0, revealMs: 0 },
    });

    capture.ctx.setForce(0.7);
    ind.apply.mockClear();
    capture.ctx.complete();

    expect(ind.apply).toHaveBeenCalledWith(0, ctx);
  });

  it("resets force to 0 on midpoint so ctx.force reflects the cleared state", () => {
    const { trigger, capture } = makeManualTrigger();
    const ctx = createTheme({
      id: THEME_ID,
      trigger,
      indicators: [],
      wipe: { className: "w", coverMs: 0, revealMs: 0 },
    });

    capture.ctx.setForce(0.8);
    capture.ctx.complete();

    expect(ctx.force).toBe(0);
  });
});

describe("createTheme — complete with wipe config", () => {
  beforeEach(() => {
    document.body.className = "";
    delete document.body.dataset.lastTheme;
    playWipe.mockReset();
  });

  afterEach(() => {
    document.body.className = "";
    delete document.body.dataset.lastTheme;
  });

  it("delegates to playWipe with className, coverMs, revealMs", () => {
    const { trigger, capture } = makeManualTrigger();
    createTheme({
      id: THEME_ID,
      trigger,
      indicators: [],
      wipe: { className: "theme-wipe", coverMs: 200, revealMs: 400 },
    });

    capture.ctx.complete();

    expect(playWipe).toHaveBeenCalledOnce();
    const opts = playWipe.mock.calls[0][0];
    expect(opts.className).toBe("theme-wipe");
    expect(opts.coverMs).toBe(200);
    expect(opts.revealMs).toBe(400);
  });

  it("appends reverseModifier to the class on the deactivation path", () => {
    playWipe.mockImplementation(defaultPlayWipeImpl);
    const { trigger, capture } = makeManualTrigger();
    createTheme({
      id: THEME_ID,
      trigger,
      indicators: [],
      wipe: {
        className: "theme-wipe",
        reverseModifier: "reverse",
        coverMs: 0,
        revealMs: 0,
      },
    });

    capture.ctx.complete(); // activate
    capture.ctx.complete(); // deactivate

    expect(playWipe.mock.calls[1][0].className).toBe("theme-wipe reverse");
  });

  it("does not append reverseModifier on the activation path", () => {
    playWipe.mockImplementation(defaultPlayWipeImpl);
    const { trigger, capture } = makeManualTrigger();
    createTheme({
      id: THEME_ID,
      trigger,
      indicators: [],
      wipe: {
        className: "theme-wipe",
        reverseModifier: "reverse",
        coverMs: 0,
        revealMs: 0,
      },
    });

    capture.ctx.complete();

    expect(playWipe.mock.calls[0][0].className).toBe("theme-wipe");
  });

  it("runs the midpoint callback during the cover phase (before reveal)", () => {
    let capturedOpts;
    playWipe.mockImplementation((opts) => {
      capturedOpts = opts;
    });
    const { trigger, capture } = makeManualTrigger();
    createTheme({
      id: THEME_ID,
      trigger,
      indicators: [],
      wipe: { className: "w", coverMs: 100, revealMs: 100 },
    });

    capture.ctx.complete();
    // Cover phase: midpoint has not yet fired
    expect(document.body.classList.contains(THEME_ID)).toBe(false);

    capturedOpts.onMidpoint();
    expect(document.body.classList.contains(THEME_ID)).toBe(true);
  });

  it("blocks re-entry into complete() while a wipe is in progress", () => {
    playWipe.mockImplementation(() => {
      // never call onMidpoint / onComplete — simulate an in-flight wipe
    });
    const { trigger, capture } = makeManualTrigger();
    createTheme({
      id: THEME_ID,
      trigger,
      indicators: [],
      wipe: { className: "w", coverMs: 100, revealMs: 100 },
    });

    capture.ctx.complete();
    capture.ctx.complete();
    capture.ctx.complete();

    expect(playWipe).toHaveBeenCalledOnce();
  });

  it("releases the transition lock after onComplete so the next complete() runs", () => {
    let capturedOpts;
    playWipe.mockImplementation((opts) => {
      capturedOpts = opts;
    });
    const { trigger, capture } = makeManualTrigger();
    createTheme({
      id: THEME_ID,
      trigger,
      indicators: [],
      wipe: { className: "w", coverMs: 0, revealMs: 0 },
    });

    capture.ctx.complete();
    capturedOpts.onMidpoint();
    capturedOpts.onComplete();

    capture.ctx.complete();

    expect(playWipe).toHaveBeenCalledTimes(2);
  });

  it("ignores setForce while a wipe is in progress", () => {
    playWipe.mockImplementation(() => {
      // in-flight: never runs midpoint/complete
    });
    const ind = makeIndicator();
    const { trigger, capture } = makeManualTrigger();
    createTheme({
      id: THEME_ID,
      trigger,
      indicators: [ind],
      wipe: { className: "w", coverMs: 0, revealMs: 0 },
    });

    capture.ctx.complete();
    const before = ind.apply.mock.calls.length;
    capture.ctx.setForce(0.9);

    expect(ind.apply.mock.calls.length).toBe(before);
  });
});

describe("createTheme — complete with wipe function", () => {
  beforeEach(() => {
    document.body.className = "";
    delete document.body.dataset.lastTheme;
    playWipe.mockReset();
  });

  afterEach(() => {
    document.body.className = "";
    delete document.body.dataset.lastTheme;
  });

  it("calls the wipe function with { activating, runMidpoint, payload }", () => {
    const wipe = vi.fn(({ runMidpoint }) => {
      runMidpoint();
    });
    const { trigger, capture } = makeManualTrigger();
    createTheme({
      id: THEME_ID,
      trigger,
      indicators: [],
      wipe,
    });

    const payload = { silent: false };
    capture.ctx.complete(payload);

    expect(wipe).toHaveBeenCalledOnce();
    expect(wipe.mock.calls[0][0]).toMatchObject({
      activating: true,
      payload,
    });
    expect(typeof wipe.mock.calls[0][0].runMidpoint).toBe("function");
  });

  it("reports activating=false on the deactivation path", async () => {
    const wipe = vi.fn(({ runMidpoint }) => {
      runMidpoint();
    });
    const { trigger, capture } = makeManualTrigger();
    createTheme({
      id: THEME_ID,
      trigger,
      indicators: [],
      wipe,
    });

    capture.ctx.complete(); // activate
    // Let the Promise.resolve().finally() microtask flush so isTransitioning
    // releases before the deactivation call.
    await Promise.resolve();
    await Promise.resolve();
    capture.ctx.complete(); // deactivate

    expect(wipe.mock.calls[1][0].activating).toBe(false);
  });

  it("awaits the returned promise before releasing the transition lock", async () => {
    let resolve;
    const wipe = vi.fn(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const { trigger, capture } = makeManualTrigger();
    createTheme({
      id: THEME_ID,
      trigger,
      indicators: [],
      wipe,
    });

    capture.ctx.complete();
    capture.ctx.complete(); // blocked — promise hasn't resolved
    expect(wipe).toHaveBeenCalledOnce();

    resolve();
    await Promise.resolve();
    await Promise.resolve();
    capture.ctx.complete();
    expect(wipe).toHaveBeenCalledTimes(2);
  });

  it("logs a rejected wipe promise and still releases the transition lock", async () => {
    const err = new Error("boom");
    const wipe = vi
      .fn()
      .mockImplementationOnce(() => Promise.reject(err))
      .mockImplementationOnce(() => undefined);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const { trigger, capture } = makeManualTrigger();
    createTheme({
      id: THEME_ID,
      trigger,
      indicators: [],
      wipe,
    });

    capture.ctx.complete();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(consoleError).toHaveBeenCalled();
    capture.ctx.complete();
    expect(wipe).toHaveBeenCalledTimes(2);
    consoleError.mockRestore();
  });

  it("treats a synchronous (non-promise) return value as resolved", async () => {
    const wipe = vi.fn(({ runMidpoint }) => {
      runMidpoint();
    });
    const { trigger, capture } = makeManualTrigger();
    createTheme({
      id: THEME_ID,
      trigger,
      indicators: [],
      wipe,
    });

    capture.ctx.complete();
    // The factory wraps the return value in Promise.resolve().finally(),
    // so the lock release is deferred by two microtasks even when the wipe
    // returned undefined synchronously.
    await Promise.resolve();
    await Promise.resolve();

    capture.ctx.complete();
    expect(wipe).toHaveBeenCalledTimes(2);
  });
});

describe("createTheme — registerToggle wiring", () => {
  beforeEach(() => {
    document.body.className = "";
    delete document.body.dataset.lastTheme;
    playWipe.mockReset();
    playWipe.mockImplementation(defaultPlayWipeImpl);
  });

  afterEach(() => {
    document.body.className = "";
    delete document.body.dataset.lastTheme;
  });

  it("routes toggleTheme(id, opts) through to complete(opts)", () => {
    const listener = vi.fn();
    window.addEventListener("achievement", listener);

    const { trigger } = makeManualTrigger();
    createTheme({
      id: OTHER_THEME_ID,
      trigger,
      indicators: [],
      wipe: { className: "w", coverMs: 0, revealMs: 0 },
    });

    toggleTheme(OTHER_THEME_ID, { silent: true });
    window.removeEventListener("achievement", listener);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0][0].detail).toMatchObject({
      type: "theme-activate",
      theme: OTHER_THEME_ID,
      silent: true,
    });
  });
});
