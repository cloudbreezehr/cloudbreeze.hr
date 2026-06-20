import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The bridge applies a theme's sound identity (bus tint + entry/exit cue) from
// theme-activate/deactivate, mirroring the render loop's "last-triggered wins"
// rule. Collaborators are mocked to capture what it would do; the engine is
// mocked so sound-enabled can be flipped for the "heard" credit. The tint
// sequence doubles as the readout of which theme currently wins.

describe("audio/bridges/themes", () => {
  let tints;
  let cues;
  let heard;
  let soundOn;
  let soundChangeCb;
  let stop;
  let onHeard;

  beforeEach(async () => {
    vi.resetModules();
    tints = [];
    cues = [];
    heard = [];
    soundOn = true;
    soundChangeCb = null;
    vi.doMock("../../../../js/audio/bus.js", () => ({
      setThemeFilter: (f) => tints.push(f),
    }));
    vi.doMock("../../../../js/audio/sfx.js", () => ({
      playSfx: (name) => cues.push(name),
    }));
    vi.doMock("../../../../js/audio/engine.js", () => ({
      isSoundEnabled: () => soundOn,
      onSoundChange: (cb) => {
        soundChangeCb = cb;
        return () => {};
      },
    }));
    onHeard = (e) => {
      if (e.detail.type === "theme-sound-heard") heard.push(e.detail.theme);
    };
    window.addEventListener("achievement", onHeard);
    const mod = await import("../../../../js/audio/bridges/themes.js");
    stop = mod.initThemesAudioBridge();
  });

  afterEach(() => {
    if (stop) stop();
    window.removeEventListener("achievement", onHeard);
    vi.doUnmock("../../../../js/audio/bus.js");
    vi.doUnmock("../../../../js/audio/sfx.js");
    vi.doUnmock("../../../../js/audio/engine.js");
  });

  const fire = (type, theme) =>
    window.dispatchEvent(
      new CustomEvent("achievement", { detail: { type, theme } }),
    );
  const activate = (t) => fire("theme-activate", t);
  const deactivate = (t) => fire("theme-deactivate", t);
  const lastTint = () => tints[tints.length - 1];

  it("tints for the activated theme", () => {
    activate("frozen");
    expect(lastTint()).toMatchObject({ type: "highpass" }); // frozen's filter
  });

  it("hands the tint to the most recently activated theme", () => {
    activate("frozen");
    activate("vhs");
    expect(lastTint()).toMatchObject({ type: "bandpass" }); // vhs's filter
  });

  it("falls back to the prior theme when the winner deactivates", () => {
    activate("frozen");
    activate("vhs");
    deactivate("vhs");
    expect(lastTint()).toMatchObject({ type: "highpass" }); // frozen again
  });

  it("returns to neutral when the last theme deactivates", () => {
    activate("frozen");
    deactivate("frozen");
    expect(lastTint()).toBeNull();
  });

  it("plays an entry cue on activate and an exit cue on deactivate", () => {
    activate("frozen");
    deactivate("frozen");
    expect(cues).toEqual(["themeIn", "themeOut"]);
  });

  it("credits the theme as heard on activate when sound is on", () => {
    activate("frozen");
    expect(heard).toEqual(["frozen"]);
  });

  it("does not credit a theme as heard while sound is off", () => {
    soundOn = false;
    activate("frozen");
    expect(heard).toEqual([]);
  });

  it("does not tint (build the audio graph) while sound is off", () => {
    soundOn = false;
    activate("frozen");
    expect(tints).toEqual([]);
  });

  it("tints the active theme when sound is turned on", () => {
    soundOn = false;
    activate("frozen");
    expect(tints).toEqual([]);
    soundOn = true;
    soundChangeCb(true); // visitor enables sound
    expect(tints[tints.length - 1]).toMatchObject({ type: "highpass" });
  });
});
