import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Achievements-bridge test.  Primary coverage target: the progress-
// milestone math.  The pattern for bridge tests is:
//   1. reset modules + localStorage
//   2. wire up a capturing adapter via core.start({ adapter })
//   3. dispatch real window events (analytics-unlock / achievement)
//   4. flush the queue + assert on captured event names and props
//
// Reviewer-flagged correctness concerns this locks down:
//   - progress_milestone counts only non-meta unlocks, not meta ones
//   - progress_milestone thresholds dedupe (each fires once per session)
//   - achievement_unlocked shape is stable across unlocks

describe("analytics/bridges/achievements", () => {
  let core;
  let bridge;
  let registry;
  let storage;
  let captured;

  async function bootstrap() {
    localStorage.clear();
    sessionStorage.clear();
    vi.resetModules();
    captured = [];
    core = await import("../../../../js/analytics/core.js");
    bridge = await import("../../../../js/analytics/bridges/achievements.js");
    registry = await import("../../../../js/achievements/registry.js");
    storage = await import("../../../../js/achievements/storage.js");
    storage.load();
    const capture = {
      name: "capture",
      send: (batch) => captured.push(...batch),
    };
    core.start({ adapter: capture });
    bridge.initAchievementsBridge();
  }

  function dispatchUnlock(id) {
    // Persist the unlock then fan-out the analytics event the same way
    // the achievements shim in js/achievements/index.js does in production.
    storage.unlock(id);
    const achievement = registry.getAchievement(id);
    window.dispatchEvent(
      new CustomEvent("analytics-unlock", { detail: { achievement } }),
    );
  }

  function eventsNamed(name) {
    return captured.filter((e) => e.name === name);
  }

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-08T12:00:00Z"));
    await bootstrap();
  });

  afterEach(() => {
    if (core && core._stopForTests) core._stopForTests();
    vi.useRealTimers();
  });

  it("fires achievement_unlocked with set, points, and order fields", () => {
    dispatchUnlock("first-light");
    core.flush();
    const events = eventsNamed("achievement_unlocked");
    expect(events.length).toEqual(1);
    const p = events[0].props;
    expect(p.achievement_id).toEqual("first-light");
    expect(p.set_id).toEqual("exploration");
    expect(p.points).toBeGreaterThan(0);
    expect(p.session_unlock_order).toEqual(1);
    expect(p.unlocks_after).toEqual(1);
    expect(p.points_after).toEqual(p.points);
  });

  it("progress_milestone counts non-meta unlocks only, excluding meta", () => {
    // Setup: unlock N non-meta just under the 10% threshold, then all
    // meta.  Correct count stays under 10% → no milestone fires.  The
    // broken filter (which counts meta as non-meta for all but the
    // just-unlocked entry) would cross the threshold and fire.
    const nonMetaIds = registry.getAllNonMeta();
    const tenPercent = Math.ceil(nonMetaIds.length * 0.1);
    const justUnder = tenPercent - 1;
    for (let i = 0; i < justUnder; i++) dispatchUnlock(nonMetaIds[i]);

    const metaIds = registry.ACHIEVEMENTS.filter((a) => a.set === "meta").map(
      (a) => a.id,
    );
    for (const id of metaIds) dispatchUnlock(id);
    core.flush();

    const milestones = eventsNamed("progress_milestone");
    expect(milestones.length).toEqual(0);
  });

  it("achievement_unlocked total_unlocks never counts meta as non-meta in milestones", () => {
    // Mix: unlock one non-meta + several meta.  Non-meta count should be 1
    // regardless of how many meta unlocks happened alongside.
    dispatchUnlock("first-light"); // non-meta
    dispatchUnlock("curious-mind"); // meta
    dispatchUnlock("dedicated"); // meta
    core.flush();

    const milestones = eventsNamed("progress_milestone");
    for (const m of milestones) {
      expect(m.props.total_unlocks).toEqual(1);
    }
  });

  it("progress_milestone fires once per threshold per session", () => {
    // Unlock enough non-meta achievements to cross the 10% threshold.
    const nonMetaIds = registry.getAllNonMeta();
    const target = Math.ceil(nonMetaIds.length * 0.1);
    for (let i = 0; i < target; i++) dispatchUnlock(nonMetaIds[i]);
    core.flush();

    const ten = eventsNamed("progress_milestone").filter(
      (e) => e.props.percent === 10,
    );
    expect(ten.length).toEqual(1);
  });

  it("cloudlog_activated fires once, labeled by source event type", () => {
    window.dispatchEvent(
      new CustomEvent("achievement", { detail: { type: "cloudlog-activate" } }),
    );
    window.dispatchEvent(
      new CustomEvent("achievement", { detail: { type: "cloudlog-activate" } }),
    );
    core.flush();
    const events = eventsNamed("cloudlog_activated");
    expect(events.length).toEqual(1);
    expect(events[0].props.method).toEqual("triple_click");
  });

  it("cloudlog_activated labels shortcut method when dispatched as such", () => {
    window.dispatchEvent(
      new CustomEvent("achievement", { detail: { type: "cloudlog-shortcut" } }),
    );
    core.flush();
    const events = eventsNamed("cloudlog_activated");
    expect(events.length).toEqual(1);
    expect(events[0].props.method).toEqual("shortcut");
  });

  it("cloudlog_activated records trigger coords and quadrant", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 1000,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 800,
    });
    window.dispatchEvent(
      new CustomEvent("achievement", {
        detail: { type: "cloudlog-activate", x: 800, y: 600 },
      }),
    );
    core.flush();
    const evt = eventsNamed("cloudlog_activated")[0];
    expect(evt.props.trigger_x).toEqual(800);
    expect(evt.props.trigger_y).toEqual(600);
    expect(evt.props.trigger_quadrant).toEqual("br");
  });

  it("cloudlog_activated leaves trigger fields null for the shortcut path", () => {
    window.dispatchEvent(
      new CustomEvent("achievement", { detail: { type: "cloudlog-shortcut" } }),
    );
    core.flush();
    const evt = eventsNamed("cloudlog_activated")[0];
    expect(evt.props.trigger_x).toEqual(null);
    expect(evt.props.trigger_y).toEqual(null);
    expect(evt.props.trigger_quadrant).toEqual(null);
  });

  it("achievement_unlocked reports time_since_cloudlog_activated_ms after activation", () => {
    const TIME_BETWEEN_ACTIVATE_AND_UNLOCK_MS = 1_500;
    window.dispatchEvent(
      new CustomEvent("achievement", { detail: { type: "cloudlog-activate" } }),
    );
    vi.advanceTimersByTime(TIME_BETWEEN_ACTIVATE_AND_UNLOCK_MS);
    dispatchUnlock("first-light");
    core.flush();
    const unlock = eventsNamed("achievement_unlocked")[0];
    expect(
      unlock.props.time_since_cloudlog_activated_ms,
    ).toBeGreaterThanOrEqual(TIME_BETWEEN_ACTIVATE_AND_UNLOCK_MS);
  });

  it("achievement_unlocked time_since_cloudlog_activated_ms is null before activation", () => {
    dispatchUnlock("first-light");
    core.flush();
    const unlock = eventsNamed("achievement_unlocked")[0];
    expect(unlock.props.time_since_cloudlog_activated_ms).toEqual(null);
  });

  it("set_completed fires once when the mastery achievement for a set unlocks", () => {
    // Unlock every non-mastery achievement in the frozen set, then the
    // mastery achievement itself.  set_completed should fire exactly once,
    // on the unlock that flips the mastery id to unlocked.
    const frozenPrereqs = registry.getSetPrereqs("frozen");
    for (const id of frozenPrereqs) dispatchUnlock(id);
    dispatchUnlock(registry.SET_MASTERY_MAP.frozen);
    core.flush();

    const completions = eventsNamed("set_completed");
    expect(completions.length).toEqual(1);
    expect(completions[0].props.set_id).toEqual("frozen");
    expect(completions[0].props.unlocks_at_completion).toEqual(
      frozenPrereqs.length + 1,
    );
  });

  it("set_completed does not fire for unrelated set's unlocks", () => {
    dispatchUnlock("first-light"); // exploration set, has no mastery map entry
    core.flush();
    expect(eventsNamed("set_completed").length).toEqual(0);
  });
});
