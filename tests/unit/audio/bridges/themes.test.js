import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The bridge applies a theme's sound identity (bed, bus tint, entry/exit cue)
// from theme-activate/deactivate, mirroring the render loop's "last-triggered
// wins" rule. Its collaborators are mocked to capture what it would do, and the
// engine is mocked so sound-enabled can be flipped for the "heard" credit.

describe("audio/bridges/themes", () => {
  let beds;
  let tints;
  let cues;
  let heard;
  let soundOn;
  let stop;
  let onHeard;

  beforeEach(async () => {
    vi.resetModules();
    beds = [];
    tints = [];
    cues = [];
    heard = [];
    soundOn = true;
    vi.doMock("../../../../js/audio/beds.js", () => ({
      setBed: (id) => beds.push(id),
    }));
    vi.doMock("../../../../js/audio/bus.js", () => ({
      setThemeFilter: (f) => tints.push(f),
    }));
    vi.doMock("../../../../js/audio/sfx.js", () => ({
      playSfx: (name) => cues.push(name),
    }));
    vi.doMock("../../../../js/audio/engine.js", () => ({
      isSoundEnabled: () => soundOn,
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
    vi.doUnmock("../../../../js/audio/beds.js");
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

  it("plays the activated theme's bed", () => {
    activate("frozen");
    expect(beds).toEqual(["frozen"]);
  });

  it("hands the bed to the most recently activated theme", () => {
    activate("frozen");
    activate("vhs");
    expect(beds).toEqual(["frozen", "vhs"]);
  });

  it("falls back to the prior theme when the winner deactivates", () => {
    activate("frozen");
    activate("vhs");
    deactivate("vhs");
    expect(beds).toEqual(["frozen", "vhs", "frozen"]);
  });

  it("silences when the last active theme deactivates", () => {
    activate("frozen");
    deactivate("frozen");
    expect(beds).toEqual(["frozen", null]);
  });

  it("tints the effects bus for the active theme, neutral when none", () => {
    activate("frozen");
    // frozen declares a real filter; the bridge passes it straight through.
    expect(tints[tints.length - 1]).toMatchObject({ type: "highpass" });
    deactivate("frozen");
    expect(tints[tints.length - 1]).toBeNull();
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
});
