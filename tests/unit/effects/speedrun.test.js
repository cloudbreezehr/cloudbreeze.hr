import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Drives the run clock with fake timers over real storage. The finish
// condition mirrors the completionist progress resolvers, so "finishing"
// a run in a test means actually unlocking everything reachable — instead,
// splits and PB behavior are exercised through real set unlocks and the
// pure formatter is pinned directly.

describe("effects/speedrun — formatRunTime", () => {
  let speedrun;

  beforeEach(async () => {
    vi.resetModules();
    speedrun = await import("../../../js/effects/speedrun.js");
  });

  it("formats tenths, minutes, and hours", () => {
    expect(speedrun.formatRunTime(0)).toBe("00:00.0");
    expect(speedrun.formatRunTime(754321)).toBe("12:34.3");
    expect(speedrun.formatRunTime(3600000)).toBe("1:00:00.0");
  });
});

describe("effects/speedrun — run clock", () => {
  let speedrun;
  let storage;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-08T12:00:00"));
    localStorage.clear();
    document.body.innerHTML = "";
    window.matchMedia = vi.fn(() => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }));
    vi.resetModules();
    storage = await import("../../../js/achievements/storage.js");
    speedrun = await import("../../../js/effects/speedrun.js");
    storage.activate();
  });

  afterEach(() => {
    speedrun._resetForTests();
    vi.useRealTimers();
    delete window.matchMedia;
  });

  it("arms with a ticking clock and reports the discovery", () => {
    const events = [];
    window.addEventListener("achievement", (e) => events.push(e.detail.type));
    speedrun.armSpeedrun();
    expect(speedrun.isSpeedrunArmed()).toBe(true);
    expect(events).toContain("speedrun-armed");

    vi.advanceTimersByTime(61500);
    expect(document.querySelector(".speedrun-clock").textContent).toBe(
      "01:01.5",
    );
  });

  it("records a split when a set mastery lands mid-run", async () => {
    const { getSetPrereqs } =
      await import("../../../js/achievements/registry.js");
    speedrun.armSpeedrun();
    vi.advanceTimersByTime(5000);
    // Master the frozen set for real: unlock its prereqs, then the mastery.
    for (const id of getSetPrereqs("frozen")) storage.unlock(id);
    storage.unlock("glacial-mastery");
    vi.advanceTimersByTime(200);
    const splits = [...document.querySelectorAll(".speedrun-split")];
    expect(
      splits.some((el) => el.textContent.includes("Glacial Mastery")),
    ).toBe(true);
  });

  it("disarms cleanly and shows the stored personal best on re-arm", () => {
    storage.setPref(speedrun.BEST_RUN_PREF, 754321);
    speedrun.armSpeedrun();
    expect(document.querySelector(".speedrun-best").textContent).toBe(
      "pb 12:34.3",
    );
    speedrun.disarmSpeedrun();
    expect(document.querySelector(".speedrun-hud")).toBeNull();
    expect(speedrun.isSpeedrunArmed()).toBe(false);
  });

  it("toggle arms and disarms", () => {
    speedrun.toggleSpeedrun();
    expect(speedrun.isSpeedrunArmed()).toBe(true);
    speedrun.toggleSpeedrun();
    expect(speedrun.isSpeedrunArmed()).toBe(false);
  });
});
