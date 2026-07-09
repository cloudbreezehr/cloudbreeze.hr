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
    fire("vhs-glitch");
    expect(calls).toEqual(["ice", "pencil", "glitch"]);
  });

  it("maps the sky/constellation interactions", () => {
    fire("star-clicked");
    fire("shooting-star-clicked");
    fire("constellation-formed");
    fire("constellation-wrong-hit");
    expect(calls).toEqual(["twinkle", "starWhoosh", "chord", "dud"]);
  });

  it("maps the matrix click surge and decode", () => {
    fire("matrix-click");
    fire("matrix-decode");
    expect(calls).toEqual(["glyph", "decode"]);
  });

  it("maps the upside-down click lurch", () => {
    fire("upside-down-click");
    expect(calls).toEqual(["wobble"]);
  });

  it("leaves passive background animations silent", () => {
    fire("jellyfish-pulse"); // a periodic animation, not a triggered effect
    fire("scroll");
    // Thunder strikes fire on a timer, not on user input — ambient, silent.
    fire("rain-thunder");
    expect(calls).toEqual([]);
  });

  it("does not sound the snow-globe shake — frozen.js rattles at the source", () => {
    // The event fires on any shake-scroll (achievement reachability), but the
    // rattle is the burst's sound, played by frozen.js only when frozen renders
    // it. Sounding it here would rattle on a plain scroll with nothing on screen.
    fire("snow-globe");
    expect(calls).toEqual([]);
  });
});
