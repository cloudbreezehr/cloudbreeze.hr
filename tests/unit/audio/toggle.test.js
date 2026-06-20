import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The toggle reveals progressively: hidden for a fresh first-time visitor until
// the dwell elapses, immediate for a returning visitor or one who already had
// sound on. Engine + sfx are mocked so the test drives only the reveal logic;
// fake timers stand in for the dwell.

describe("audio/toggle reveal", () => {
  let enabled;
  let btn;
  let initSoundToggle;

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    localStorage.clear();
    enabled = false;
    vi.doMock("../../../js/audio/engine.js", () => ({
      isSoundEnabled: () => enabled,
      toggleSound: () => {},
      onSoundChange: () => () => {},
    }));
    vi.doMock("../../../js/audio/sfx.js", () => ({ playSfx: () => {} }));
    ({ initSoundToggle } = await import("../../../js/audio/toggle.js"));
    btn = document.createElement("button");
    btn.className = "sound-toggle";
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.doUnmock("../../../js/audio/engine.js");
    vi.doUnmock("../../../js/audio/sfx.js");
  });

  const revealed = () => btn.classList.contains("revealed");

  it("hides the toggle for a first-time visitor until the dwell elapses", () => {
    initSoundToggle(btn);
    expect(revealed()).toBe(false);
    vi.runAllTimers();
    expect(revealed()).toBe(true);
  });

  it("reveals immediately for a returning visitor", () => {
    localStorage.setItem("cb_visited", "1");
    initSoundToggle(btn);
    expect(revealed()).toBe(true);
  });

  it("reveals immediately when sound is already enabled", () => {
    enabled = true;
    initSoundToggle(btn);
    expect(revealed()).toBe(true);
  });

  it("marks the visitor so a later visit reveals at once", () => {
    initSoundToggle(btn);
    expect(localStorage.getItem("cb_visited")).toBe("1");
  });
});
