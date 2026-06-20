import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The bridge maps each incantation word to a synthesised voice off the existing
// "incantation" achievement event — so the words stay unaware of audio. sfx is
// mocked to capture the (name, opts) it would play.

describe("audio/bridges/incantations", () => {
  let calls;
  let stop;

  beforeEach(async () => {
    vi.resetModules();
    calls = [];
    vi.doMock("../../../../js/audio/sfx.js", () => ({
      playSfx: (name, opts) => calls.push({ name, opts }),
    }));
    const mod = await import("../../../../js/audio/bridges/incantations.js");
    stop = mod.initIncantationsAudioBridge();
  });

  afterEach(() => {
    if (stop) stop();
    vi.doUnmock("../../../../js/audio/sfx.js");
  });

  function cast(word, maxed = false) {
    window.dispatchEvent(
      new CustomEvent("achievement", {
        detail: { type: "incantation", word, maxed },
      }),
    );
  }

  it("plays the mapped voice for a word", () => {
    cast("BOOM");
    expect(calls).toEqual([{ name: "boom", opts: { intensity: 0 } }]);
  });

  it("groups a family onto one voice (light streaks → whoosh)", () => {
    cast("COMET");
    cast("WARP");
    cast("GUST");
    cast("WISH");
    expect(calls.map((c) => c.name)).toEqual([
      "whoosh",
      "whoosh",
      "whoosh",
      "whoosh",
    ]);
  });

  it("plays the charged variant when the cast is maxed", () => {
    cast("STORM", true);
    expect(calls[0]).toEqual({ name: "thunder", opts: { intensity: 1 } });
  });

  it("ignores non-incantation events and unmapped words", () => {
    window.dispatchEvent(
      new CustomEvent("achievement", { detail: { type: "click-burst" } }),
    );
    cast("XYZZY");
    expect(calls).toEqual([]);
  });

  it("maps every real incantation word to a voice", async () => {
    const { INCANTATION_WORDS } =
      await import("../../../../js/effects/incantations.js");
    for (const word of INCANTATION_WORDS) cast(word);
    // Every word produced a sound — none fell through the map unmapped.
    expect(calls).toHaveLength(INCANTATION_WORDS.length);
    expect(calls.every((c) => typeof c.name === "string")).toBe(true);
  });
});
