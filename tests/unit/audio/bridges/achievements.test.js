import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The bridge sounds the trophy jingle off the "analytics-unlock" event the
// Cloudlog already emits, coalescing a same-tick burst into one note. sfx is
// mocked to capture what it would play; fake timers drive the coalesce window.

import { COALESCE_MS } from "../../../../js/audio/bridges/achievements.js";

describe("audio/bridges/achievements", () => {
  let calls;
  let stop;

  const fire = () =>
    window.dispatchEvent(
      new CustomEvent("analytics-unlock", {
        detail: { achievement: { id: "first-light" } },
      }),
    );

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    calls = [];
    vi.doMock("../../../../js/audio/sfx.js", () => ({
      playSfx: (name) => calls.push(name),
    }));
    const mod = await import("../../../../js/audio/bridges/achievements.js");
    stop = mod.initAchievementsAudioBridge();
  });

  afterEach(() => {
    if (stop) stop();
    vi.useRealTimers();
    vi.doUnmock("../../../../js/audio/sfx.js");
  });

  it("plays the unlock note on an unlock event", () => {
    fire();
    expect(calls).toEqual(["unlock"]);
  });

  it("coalesces a same-tick burst of unlocks into one note", () => {
    fire(); // the trigger achievement
    fire(); // a milestone it satisfied
    fire(); // a set / completionist, same tick
    expect(calls).toEqual(["unlock"]);
  });

  it("stays coalesced within the window", () => {
    fire();
    vi.advanceTimersByTime(COALESCE_MS / 2);
    fire();
    expect(calls).toEqual(["unlock"]);
  });

  it("plays again once the coalesce window passes", () => {
    fire();
    vi.advanceTimersByTime(COALESCE_MS);
    fire();
    expect(calls).toEqual(["unlock", "unlock"]);
  });

  it("stops listening after cleanup", () => {
    stop();
    stop = null;
    fire();
    expect(calls).toEqual([]);
  });
});
