import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The bridge maps discrete theme/sky effect events to voices. sfx is mocked to
// capture what it would play; passive animations must stay silent.

describe("audio/bridges/theme-effects", () => {
  let calls;
  let stop;

  beforeEach(async () => {
    vi.resetModules();
    calls = [];
    vi.doMock("../../../../js/audio/sfx.js", () => ({
      playSfx: (name) => calls.push(name),
    }));
    const mod = await import("../../../../js/audio/bridges/theme-effects.js");
    stop = mod.initThemeEffectsAudioBridge();
  });

  afterEach(() => {
    if (stop) stop();
    vi.doUnmock("../../../../js/audio/sfx.js");
  });

  const fire = (type) =>
    window.dispatchEvent(new CustomEvent("achievement", { detail: { type } }));

  it("maps theme effects to their voices", () => {
    fire("frost-breath");
    fire("paper-stroke");
    fire("snow-globe");
    fire("vhs-glitch");
    fire("rain-thunder");
    expect(calls).toEqual(["ice", "pencil", "rattle", "glitch", "thunder"]);
  });

  it("maps the sky/constellation interactions", () => {
    fire("star-clicked");
    fire("shooting-star-clicked");
    fire("constellation-formed");
    fire("constellation-wrong-hit");
    expect(calls).toEqual(["twinkle", "starWhoosh", "chord", "dud"]);
  });

  it("leaves passive background animations silent", () => {
    fire("jellyfish-pulse"); // a periodic animation, not a triggered effect
    fire("scroll");
    expect(calls).toEqual([]);
  });
});
