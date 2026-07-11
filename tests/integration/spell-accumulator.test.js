import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Integration: the real spell matcher (initSpellTrigger) drives the real
// accumulator HUD through the `spell-progress` event. Content modules (theme
// registry, incantations) and heavy leaf deps are stubbed at the edges so the
// test exercises the one thing the unit tests don't — the event wire between
// the two modules, which each unit suite mounts in isolation. A rename of the
// event or a drift in the state() shape would slip past both unit suites and
// only break here.

describe("spell accumulator integration", () => {
  let stopTrigger;
  let stopHud;

  beforeEach(async () => {
    document.body.innerHTML = "";
    document.body.className = "";
    vi.useFakeTimers();
    vi.resetModules();

    // Two overlapping themes so a completion leaves a sibling mid-match (STAR
    // stuck at "ST" while STORM finishes) — the ghost the clear-on-complete
    // behavior must prevent.
    vi.doMock("../../js/themes/registry.js", () => ({
      getThemes: () => [
        { id: "storm", label: "STORM" },
        { id: "star", label: "STAR" },
      ],
      toggleTheme: () => {},
    }));
    vi.doMock("../../js/effects/incantations.js", () => ({
      INCANTATIONS: [
        { word: "BOOM", chargeChar: "O", chargeMax: () => 10, cast: () => {} },
      ],
    }));
    vi.doMock("../../js/motion.js", () => ({
      prefersReducedMotion: () => true,
    }));
    vi.doMock("../../js/audio/toggle.js", () => ({
      revealSoundToggle: () => {},
    }));
    vi.doMock("../../js/terminal/index.js", () => ({
      isTerminalOpen: () => false,
    }));

    const trigger = await import("../../js/themes/spell-trigger.js");
    const hud = await import("../../js/effects/spell-accumulator.js");
    stopHud = hud.initSpellAccumulatorHud().stop;
    stopTrigger = trigger.initSpellTrigger().stop;
  });

  afterEach(() => {
    if (stopTrigger) stopTrigger();
    if (stopHud) stopHud();
    vi.useRealTimers();
    vi.doUnmock("../../js/themes/registry.js");
    vi.doUnmock("../../js/effects/incantations.js");
    vi.doUnmock("../../js/motion.js");
    vi.doUnmock("../../js/audio/toggle.js");
    vi.doUnmock("../../js/terminal/index.js");
  });

  function type(word) {
    for (const ch of word) {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: ch, bubbles: true }),
      );
    }
  }

  const acc = () => document.querySelector(".spell-acc");
  const shown = () => acc().classList.contains("spell-acc--visible");
  const visibleText = () =>
    [...acc().querySelectorAll(".spell-acc__letter")]
      .filter((l) => !l.classList.contains("spell-acc__letter--empty"))
      .map((l) => l.textContent)
      .join("");

  it("mirrors typed letters into the accumulator as a word builds", () => {
    type("ST");
    expect(shown()).toBe(true);
    expect(visibleText()).toBe("ST");
    type("O");
    expect(visibleText()).toBe("STO");
  });

  it("flashes the whole word on completion", () => {
    type("STOR");
    expect(visibleText()).toBe("STOR");
    type("M"); // completes STORM
    expect(shown()).toBe(true);
    expect(acc().classList.contains("spell-acc--complete")).toBe(true);
    expect(visibleText()).toBe("STORM");
  });

  it("leaves no ghost fragment after a completion", () => {
    type("STORM"); // completes; STAR was left at "ST" before the clear
    // The next letter that would have continued the stale STAR fragment now
    // starts from nothing, so the accumulator doesn't resurface it.
    type("A");
    expect(shown()).toBe(false);
  });

  it("carries a charged word's surplus through to the accumulator", () => {
    // Reduced motion is mocked on, so the merge animation is skipped and the
    // charged word lands straight on its clean form.
    type("BOOOOM"); // BOOM + two surplus O's
    expect(shown()).toBe(true);
    expect(visibleText()).toBe("BOOM");
    expect(acc().classList.contains("spell-acc--complete")).toBe(true);
  });
});
