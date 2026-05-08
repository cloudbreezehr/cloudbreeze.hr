import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createKeySequenceTrigger } from "../../js/modes/triggers.js";

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

function typeKey(key, modifiers = {}) {
  const event = new KeyboardEvent("keydown", {
    key,
    ctrlKey: !!modifiers.ctrl,
    metaKey: !!modifiers.meta,
    altKey: !!modifiers.alt,
    shiftKey: !!modifiers.shift,
    bubbles: true,
    cancelable: true,
  });
  window.dispatchEvent(event);
}

function typeWord(word) {
  for (const letter of word) typeKey(letter);
}

describe("createKeySequenceTrigger", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(0));
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("advances force one letter at a time as a word is typed", () => {
    const ctx = makeStubCtx();
    const trigger = createKeySequenceTrigger({
      activationWords: ["DRAW"],
      deactivationWords: ["ERASE"],
    });
    trigger.start(ctx);

    typeKey("D");
    expect(ctx.state.force).toBeCloseTo(0.25);
    typeKey("R");
    expect(ctx.state.force).toBeCloseTo(0.5);
    typeKey("A");
    expect(ctx.state.force).toBeCloseTo(0.75);
  });

  it("calls complete() when a full activation word is typed", () => {
    const ctx = makeStubCtx();
    const trigger = createKeySequenceTrigger({
      activationWords: ["DRAW"],
      deactivationWords: ["ERASE"],
    });
    trigger.start(ctx);

    typeWord("DRAW");

    expect(ctx.complete).toHaveBeenCalledOnce();
  });

  it("resets the prefix when a wrong letter interrupts the word", () => {
    const ctx = makeStubCtx();
    const trigger = createKeySequenceTrigger({
      activationWords: ["DRAW"],
      deactivationWords: ["ERASE"],
    });
    trigger.start(ctx);

    typeKey("D");
    typeKey("R");
    typeKey("X"); // wrong letter — resets prefix
    // Lingering force is unchanged by the wrong letter; the prefix was reset
    // but force decays only on idle. Typing the word from scratch should
    // still complete because the internal prefix is back to 0.
    typeKey("D");
    typeKey("R");
    typeKey("A");
    typeKey("W");
    expect(ctx.complete).toHaveBeenCalledOnce();
  });

  it("does not count a wrong letter as a correct advance", () => {
    const ctx = makeStubCtx();
    const trigger = createKeySequenceTrigger({
      activationWords: ["DRAW"],
      deactivationWords: ["ERASE"],
    });
    trigger.start(ctx);

    typeKey("X");

    expect(ctx.setForce).not.toHaveBeenCalled();
  });

  it("expires a stale prefix after maxGapMs so leftover letters can't complete the word", () => {
    const ctx = makeStubCtx();
    const trigger = createKeySequenceTrigger({
      activationWords: ["DRAW"],
      deactivationWords: ["ERASE"],
      maxGapMs: 500,
      decayTimeoutMs: 60000, // keep the decay loop out of the picture
    });
    trigger.start(ctx);

    typeKey("D");
    typeKey("R");
    vi.setSystemTime(new Date(600)); // exceed maxGapMs
    typeKey("A");
    typeKey("W");

    // Prefix was reset by the gap expiry, so typing the tail "AW" alone
    // should not complete DRAW.
    expect(ctx.complete).not.toHaveBeenCalled();
  });

  it("swaps the tracked word set after completion based on isActive", () => {
    const ctx = makeStubCtx();
    const trigger = createKeySequenceTrigger({
      activationWords: ["DRAW"],
      deactivationWords: ["ERASE"],
    });
    trigger.start(ctx);

    typeWord("DRAW");
    // Mode is now active from the perspective of the trigger's ctx. A second
    // DRAW should not complete; only ERASE should.
    ctx.state.active = true;
    ctx.complete.mockClear();

    typeWord("DRAW");
    expect(ctx.complete).not.toHaveBeenCalled();

    typeWord("ERASE");
    expect(ctx.complete).toHaveBeenCalledOnce();
  });

  it("resets the accumulator once force fully drains so stale prefixes can't complete later", () => {
    const ctx = makeStubCtx();
    const trigger = createKeySequenceTrigger({
      activationWords: ["DRAW"],
      deactivationWords: ["ERASE"],
      maxGapMs: 60000, // keep gap expiry out of the picture
      decayTimeoutMs: 500,
      decayRate: 10,
    });
    trigger.start(ctx);

    typeKey("D");
    typeKey("R");
    typeKey("A");
    // Let the decay loop run until force hits 0 and the accumulator resets.
    vi.setSystemTime(new Date(5000));
    vi.advanceTimersByTime(5000);
    expect(ctx.state.force).toBe(0);

    // A lone "W" should not complete — the prefix was reset to 0 on drain,
    // so "W" alone doesn't match the start of DRAW.
    typeKey("W");
    expect(ctx.complete).not.toHaveBeenCalled();
  });

  it("ignores keys while an INPUT is focused", () => {
    const ctx = makeStubCtx();
    const trigger = createKeySequenceTrigger({
      activationWords: ["DRAW"],
      deactivationWords: ["ERASE"],
    });
    trigger.start(ctx);

    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();

    typeKey("D");

    expect(ctx.setForce).not.toHaveBeenCalled();
  });

  it("ignores keys while a TEXTAREA is focused", () => {
    const ctx = makeStubCtx();
    const trigger = createKeySequenceTrigger({
      activationWords: ["DRAW"],
      deactivationWords: ["ERASE"],
    });
    trigger.start(ctx);

    const textarea = document.createElement("textarea");
    document.body.appendChild(textarea);
    textarea.focus();

    typeKey("D");

    expect(ctx.setForce).not.toHaveBeenCalled();
  });

  it("ignores keys while a contenteditable element is focused", () => {
    const ctx = makeStubCtx();
    const trigger = createKeySequenceTrigger({
      activationWords: ["DRAW"],
      deactivationWords: ["ERASE"],
    });
    trigger.start(ctx);

    const div = document.createElement("div");
    div.setAttribute("contenteditable", "true");
    div.tabIndex = 0;
    document.body.appendChild(div);
    div.focus();

    typeKey("D");

    expect(ctx.setForce).not.toHaveBeenCalled();
  });

  it("ignores Ctrl/Cmd/Alt-modified keys", () => {
    const ctx = makeStubCtx();
    const trigger = createKeySequenceTrigger({
      activationWords: ["DRAW"],
      deactivationWords: ["ERASE"],
    });
    trigger.start(ctx);

    typeKey("D", { ctrl: true });
    typeKey("D", { meta: true });
    typeKey("D", { alt: true });

    expect(ctx.setForce).not.toHaveBeenCalled();
  });

  it("ignores non-letter keys entirely (they do not reset a running prefix)", () => {
    const ctx = makeStubCtx();
    const trigger = createKeySequenceTrigger({
      activationWords: ["DRAW"],
      deactivationWords: ["ERASE"],
    });
    trigger.start(ctx);

    typeKey("D");
    typeKey("R");
    typeKey("Enter"); // ignored — multi-char key
    typeKey("1"); // ignored — non-letter
    typeKey("ArrowLeft"); // ignored
    typeKey("A");
    typeKey("W");

    expect(ctx.complete).toHaveBeenCalledOnce();
  });

  it("ignores keys while isTransitioning is true", () => {
    const ctx = makeStubCtx({ transitioning: true });
    const trigger = createKeySequenceTrigger({
      activationWords: ["DRAW"],
      deactivationWords: ["ERASE"],
    });
    trigger.start(ctx);

    typeWord("DRAW");

    expect(ctx.complete).not.toHaveBeenCalled();
    expect(ctx.setForce).not.toHaveBeenCalled();
  });

  it("normalizes lowercase to uppercase so users don't need shift", () => {
    const ctx = makeStubCtx();
    const trigger = createKeySequenceTrigger({
      activationWords: ["DRAW"],
      deactivationWords: ["ERASE"],
    });
    trigger.start(ctx);

    typeWord("draw");

    expect(ctx.complete).toHaveBeenCalledOnce();
  });

  it("tracks parallel words — either activation word completes the trigger", () => {
    const ctx = makeStubCtx();
    const trigger = createKeySequenceTrigger({
      activationWords: ["DRAW", "SKETCH"],
      deactivationWords: ["ERASE"],
    });
    trigger.start(ctx);

    typeWord("SKETCH");

    expect(ctx.complete).toHaveBeenCalledOnce();
  });
});
