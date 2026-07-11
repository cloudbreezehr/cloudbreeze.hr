import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Drives the HUD through the public `spell-progress` event. The dev-view gate
// is the body `dev-active` class (same signal the achievement tally uses), so
// tests toggle that to switch between the normal and karaoke renders.

describe("effects/spell-accumulator", () => {
  let hud;
  let SACC;

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = "";
    document.body.className = "";
  });

  afterEach(() => {
    if (hud) hud.stop();
    hud = null;
    vi.useRealTimers();
  });

  async function mount() {
    vi.resetModules();
    const mod = await import("../../../js/effects/spell-accumulator.js");
    SACC = mod.SACC;
    hud = mod.initSpellAccumulatorHud();
  }

  const root = () => document.querySelector(".spell-acc");
  const words = () => root().querySelectorAll(".spell-acc__word");
  const letters = () => root().querySelectorAll(".spell-acc__letter");

  function progress(candidates) {
    window.dispatchEvent(
      new CustomEvent("spell-progress", { detail: { candidates } }),
    );
  }
  const cand = (word, matched, extra = {}) => ({
    id: word.toLowerCase(),
    word,
    matched,
    charge: 0,
    chargeChar: null,
    ...extra,
  });

  it("mounts a hidden accumulator element", async () => {
    await mount();
    expect(root()).not.toBeNull();
    expect(root().classList.contains("spell-acc--visible")).toBe(false);
  });

  it("shows only the entered letters once a chain reaches the minimum", async () => {
    await mount();
    progress([cand("PAPER", 2)]);
    expect(root().classList.contains("spell-acc--visible")).toBe(true);
    // The full word is rendered, but un-pressed letters are tagged for hiding.
    expect(letters()).toHaveLength(5);
    const pressed = [...letters()].filter(
      (l) => !l.classList.contains("spell-acc__letter--empty"),
    );
    expect(pressed.map((l) => l.textContent).join("")).toBe("PA");
  });

  it("stays hidden below the minimum length for normal users", async () => {
    await mount();
    progress([cand("PAPER", SACC.MIN_LETTERS - 1)]);
    expect(root().classList.contains("spell-acc--visible")).toBe(false);
  });

  it("renders only the leading candidate for normal users", async () => {
    await mount();
    progress([cand("PAPER", 2), cand("PULSE", 2)]);
    expect(words()).toHaveLength(1);
  });

  it("shows every candidate, even single letters, for dev users", async () => {
    await mount();
    document.body.classList.add("dev-active");
    progress([cand("PAPER", 1), cand("PULSE", 1)]);
    expect(root().classList.contains("spell-acc--visible")).toBe(true);
    expect(root().classList.contains("spell-acc--dev")).toBe(true);
    expect(words()).toHaveLength(2);
  });

  it("re-renders when the dev console toggles without a new letter", async () => {
    await mount();
    progress([cand("PAPER", 2), cand("PULSE", 2)]);
    expect(words()).toHaveLength(1);
    document.body.classList.add("dev-active");
    window.dispatchEvent(
      new CustomEvent("achievement", { detail: { type: "dev-console-open" } }),
    );
    expect(words()).toHaveLength(2);
  });

  it("appends surplus charge letters as pressed glyphs", async () => {
    await mount();
    document.body.classList.add("dev-active");
    progress([cand("BOOM", 3, { charge: 2, chargeChar: "O" })]);
    expect(root().querySelectorAll(".spell-acc__letter--charge")).toHaveLength(
      2,
    );
  });

  it("hides after the linger window with no further letters", async () => {
    await mount();
    progress([cand("PAPER", 3)]);
    expect(root().classList.contains("spell-acc--visible")).toBe(true);
    vi.advanceTimersByTime(SACC.LINGER_MS + 1);
    expect(root().classList.contains("spell-acc--visible")).toBe(false);
  });

  it("hides immediately when a word completes and leaves no candidates", async () => {
    await mount();
    progress([cand("PAPER", 3)]);
    progress([]);
    expect(root().classList.contains("spell-acc--visible")).toBe(false);
  });
});
