import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The toggle reveals progressively: hidden for a fresh first-time visitor until
// the dwell elapses, immediate for a returning visitor or one who already had
// sound on. It also sounds directional cues on click. Engine + sfx are mocked
// so the test drives the reveal logic and the cue selection; fake timers stand
// in for the dwell.

describe("audio/toggle", () => {
  let enabled;
  let btn;
  let initSoundToggle;
  let sfxCalls;

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    localStorage.clear();
    enabled = false;
    sfxCalls = [];
    vi.doMock("../../../js/audio/engine.js", () => ({
      isSoundEnabled: () => enabled,
      toggleSound: () => {},
      onSoundChange: () => () => {},
    }));
    vi.doMock("../../../js/audio/sfx.js", () => ({
      playSfx: (name) => sfxCalls.push(name),
    }));
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

  it("plays a rising power-up when turning sound on", () => {
    enabled = false;
    initSoundToggle(btn);
    btn.click();
    expect(sfxCalls).toEqual(["toggleOn"]);
  });

  it("plays a falling power-down when turning sound off", () => {
    enabled = true;
    initSoundToggle(btn);
    btn.click();
    expect(sfxCalls).toEqual(["toggleOff"]);
  });
});
