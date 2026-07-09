import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The run drives real storage + the passport codec. Each test starts from a
// cleared localStorage with a fresh module graph, stubs matchMedia (the
// transitive motion.js import reads it), and drives the flow through the
// dialog buttons and the tick interval.

const DIALOG_FADE_MS = 300;

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

describe("effects/speedrun — run lifecycle", () => {
  let speedrun;
  let storage;
  let registry;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-08T12:00:00"));
    localStorage.clear();
    document.body.innerHTML = "";
    window.matchMedia = vi.fn((query) => ({
      matches: false, // hover-capable; not reduced-motion
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }));
    vi.resetModules();
    storage = await import("../../../js/achievements/storage.js");
    registry = await import("../../../js/achievements/registry.js");
    speedrun = await import("../../../js/effects/speedrun.js");
    storage.activate();
  });

  afterEach(() => {
    speedrun._resetForTests();
    vi.useRealTimers();
    delete window.matchMedia;
  });

  function overlay() {
    const all = document.querySelectorAll(".speedrun-dialog-overlay");
    return all[all.length - 1] || null;
  }
  // The confirm/cancel handlers run synchronously; the overlay's DOM removal
  // is deferred but the node is inert (`.visible` dropped) and `overlay()`
  // always picks the latest, so tests don't flush it — advancing timers here
  // would wrongly bill the dialog-fade to the run clock.
  function confirmDialog() {
    overlay().querySelector(".speedrun-dialog-confirm").click();
  }
  function cancelDialog() {
    overlay().querySelector(".speedrun-dialog-cancel").click();
  }
  const hud = () => document.querySelector(".speedrun-hud");
  const clockText = () => document.querySelector(".speedrun-clock").textContent;

  it("opens a start dialog without touching the Cloudlog", () => {
    storage.unlock("first-light");
    speedrun.requestSpeedrun();
    expect(overlay()).not.toBeNull();
    expect(overlay().textContent).toContain("from zero");
    // Nothing armed, nothing reset until the visitor confirms.
    expect(speedrun.isSpeedrunArmed()).toBe(false);
    expect(storage.isUnlocked("first-light")).toBe(true);
  });

  it("cancelling the start dialog changes nothing", () => {
    storage.unlock("first-light");
    speedrun.requestSpeedrun();
    cancelDialog();
    expect(speedrun.isSpeedrunArmed()).toBe(false);
    expect(storage.isUnlocked("first-light")).toBe(true);
    expect(storage.getPref("speedrunStartedAt")).toBeNull();
  });

  it("confirming backs up, resets to zero, arms the HUD, and announces", () => {
    storage.unlock("first-light");
    storage.unlock("stargazer");
    const events = [];
    window.addEventListener("achievement", (e) => events.push(e.detail.type));
    let bulk = 0;
    window.addEventListener("cloudlog-bulk-change", () => bulk++);

    speedrun.requestSpeedrun();
    confirmDialog();

    expect(speedrun.isSpeedrunArmed()).toBe(true);
    expect(hud()).not.toBeNull();
    // Cloudlog wiped to zero, backup + start time persisted.
    expect(storage.getUnlocked()).toEqual([]);
    expect(typeof storage.getPref("speedrunBackup")).toBe("string");
    expect(typeof storage.getPref("speedrunStartedAt")).toBe("number");
    expect(events).toContain("speedrun-armed");
    expect(bulk).toBeGreaterThan(0);
  });

  it("ticks the clock while running", () => {
    speedrun.requestSpeedrun();
    confirmDialog();
    vi.advanceTimersByTime(61500);
    expect(clockText()).toBe("01:01.5");
  });

  it("records a split when a set mastery lands mid-run", () => {
    speedrun.requestSpeedrun();
    confirmDialog();
    vi.advanceTimersByTime(5000);
    for (const id of registry.getSetPrereqs("frozen")) storage.unlock(id);
    storage.unlock("glacial-mastery");
    vi.advanceTimersByTime(200);
    const masteryTitle = registry.getAchievement("glacial-mastery").title;
    const splits = [...document.querySelectorAll(".speedrun-split")];
    expect(splits.some((el) => el.textContent.includes(masteryTitle))).toBe(
      true,
    );
  });

  it("ending mid-run restores the original Cloudlog and clears the run", () => {
    storage.unlock("first-light");
    speedrun.requestSpeedrun();
    confirmDialog();
    expect(storage.isUnlocked("first-light")).toBe(false); // reset

    // Spelling again offers to end; confirming restores.
    speedrun.requestSpeedrun();
    expect(overlay().textContent).toContain("restored");
    confirmDialog();

    expect(speedrun.isSpeedrunArmed()).toBe(false);
    expect(storage.isUnlocked("first-light")).toBe(true); // back
    expect(storage.getPref("speedrunBackup")).toBeNull();
    expect(storage.getPref("speedrunStartedAt")).toBeNull();
  });

  it("keeps anything re-earned during the run after restoring", () => {
    storage.unlock("first-light");
    speedrun.requestSpeedrun();
    confirmDialog();
    // Earn something new during the run, then stop.
    storage.unlock("stargazer");
    speedrun.requestSpeedrun();
    confirmDialog();
    expect(storage.isUnlocked("first-light")).toBe(true); // original
    expect(storage.isUnlocked("stargazer")).toBe(true); // run's
  });

  it("restores seen marks so returned unlocks aren't re-badged as new", () => {
    storage.unlock("first-light");
    storage.markSeen("first-light");
    speedrun.requestSpeedrun();
    confirmDialog(); // arm: back up, then reset to zero
    speedrun.requestSpeedrun();
    confirmDialog(); // end: restore the backup

    expect(storage.isSeen("first-light")).toBe(true);
    expect(storage.getUnseenCount()).toBe(0);
  });

  it("finishing banks a PB, restores progress, and freezes the HUD", () => {
    storage.unlock("first-light"); // an original to restore
    const events = [];
    window.addEventListener("achievement", (e) => events.push(e.detail.type));

    speedrun.requestSpeedrun();
    confirmDialog();
    vi.advanceTimersByTime(90000);

    // Rediscover the whole speedrun goal — patient entries stay locked and
    // must not be needed for the finish.
    for (const id of registry.getSpeedrunGoal()) storage.unlock(id);
    vi.advanceTimersByTime(200); // let a tick observe completion

    expect(events).toContain("speedrun-finished");
    expect(typeof storage.getPref(BEST_RUN_PREF())).toBe("number");
    // Reload-safe: the run is no longer active once finished.
    expect(storage.getPref("speedrunStartedAt")).toBeNull();
    // Original progress merged back in.
    expect(storage.isUnlocked("first-light")).toBe(true);
    // HUD lingers, frozen, with a dismiss button.
    expect(hud().classList.contains("finished")).toBe(true);
    const btn = document.querySelector(".speedrun-end");
    expect(btn.textContent).toBe("Close");
    btn.click();
    expect(hud()).toBeNull();
  });

  it("does not finish while a goal achievement is still locked", () => {
    const events = [];
    window.addEventListener("achievement", (e) => events.push(e.detail.type));
    speedrun.requestSpeedrun();
    confirmDialog();

    const [holdout, ...rest] = registry.getSpeedrunGoal();
    for (const id of rest) storage.unlock(id);
    vi.advanceTimersByTime(200); // let a tick observe the near-complete state
    expect(events).not.toContain("speedrun-finished");

    storage.unlock(holdout);
    vi.advanceTimersByTime(200); // let a tick observe completion
    expect(events).toContain("speedrun-finished");
  });

  it("resumes an in-progress run after a reload", () => {
    speedrun.requestSpeedrun();
    confirmDialog();
    vi.advanceTimersByTime(30000);
    const startedAt = storage.getPref("speedrunStartedAt");

    // Simulate a reload: drop the in-memory HUD but keep persisted prefs.
    speedrun._resetForTests();
    expect(speedrun.isSpeedrunArmed()).toBe(false);

    speedrun.initSpeedrun();
    expect(speedrun.isSpeedrunArmed()).toBe(true);
    expect(storage.getPref("speedrunStartedAt")).toBe(startedAt);
    // Clock continues from the original start, not from zero.
    vi.advanceTimersByTime(TICK_MS());
    expect(clockText()).not.toBe("00:00.0");
  });

  it("does nothing on init when no run is persisted", () => {
    speedrun.initSpeedrun();
    expect(speedrun.isSpeedrunArmed()).toBe(false);
  });

  it("Escape closes the dialog without starting a run", () => {
    speedrun.requestSpeedrun();
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", cancelable: true }),
    );
    vi.advanceTimersByTime(DIALOG_FADE_MS);
    expect(speedrun.isSpeedrunArmed()).toBe(false);
    expect(storage.getPref("speedrunStartedAt")).toBeNull();
  });

  // Small readable aliases for the module's exported constant.
  function BEST_RUN_PREF() {
    return speedrun.BEST_RUN_PREF;
  }
  function TICK_MS() {
    return 100;
  }
});
