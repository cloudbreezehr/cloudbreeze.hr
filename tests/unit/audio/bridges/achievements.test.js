import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The bridge sounds the unlock note off the "analytics-unlock" event the
// Cloudlog already emits. sfx is mocked to capture what it would play.

describe("audio/bridges/achievements", () => {
  let calls;
  let stop;

  beforeEach(async () => {
    vi.resetModules();
    calls = [];
    vi.doMock("../../../../js/audio/sfx.js", () => ({
      playSfx: (name) => calls.push(name),
    }));
    const mod = await import("../../../../js/audio/bridges/achievements.js");
    stop = mod.initAchievementsAudioBridge();
  });

  afterEach(() => {
    if (stop) stop();
    vi.doUnmock("../../../../js/audio/sfx.js");
  });

  it("plays the unlock note on an unlock event", () => {
    window.dispatchEvent(
      new CustomEvent("analytics-unlock", {
        detail: { achievement: { id: "first-light" } },
      }),
    );
    expect(calls).toEqual(["unlock"]);
  });

  it("stops listening after cleanup", () => {
    stop();
    stop = null;
    window.dispatchEvent(
      new CustomEvent("analytics-unlock", {
        detail: { achievement: { id: "first-light" } },
      }),
    );
    expect(calls).toEqual([]);
  });
});
