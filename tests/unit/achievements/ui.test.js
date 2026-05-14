import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ui.js owns the activity-log subscription that turns theme-activate/
// theme-deactivate window events into "theme-switched" log entries.
// These tests exercise that wiring directly.

vi.mock("../../../js/effects/fireworks.js", () => ({
  burstFireworks: vi.fn(),
  launchRocketFireworks: vi.fn(),
  rocketCountForTier: vi.fn(() => 1),
}));

describe("achievements/ui — theme-switch logging", () => {
  let mod;
  let activityLog;

  beforeEach(async () => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.resetModules();
    document.body.innerHTML = "";

    mod = await import("../../../js/achievements/ui.js");
    activityLog = await import("../../../js/achievements/activity-log.js");
  });

  afterEach(() => {
    mod._resetForTests();
    vi.useRealTimers();
  });

  function dispatch(type, theme, silent = false) {
    window.dispatchEvent(
      new CustomEvent("achievement", {
        detail: { type, theme, silent },
      }),
    );
  }

  it("logs an activated entry on theme-activate", () => {
    dispatch("theme-activate", "rainy");
    const entries = activityLog.getActive();
    const themeEntries = entries.filter((e) => e.type === "theme-switched");
    expect(themeEntries.length).toEqual(1);
    expect(themeEntries[0].payload).toEqual({
      themeId: "rainy",
      activated: true,
    });
  });

  it("logs a deactivated entry on theme-deactivate", () => {
    dispatch("theme-deactivate", "frozen");
    const entries = activityLog.getActive();
    const themeEntries = entries.filter((e) => e.type === "theme-switched");
    expect(themeEntries.length).toEqual(1);
    expect(themeEntries[0].payload).toEqual({
      themeId: "frozen",
      activated: false,
    });
  });

  it("logs silent (programmatic) toggles too", () => {
    dispatch("theme-activate", "rainy", true);
    dispatch("theme-deactivate", "frozen", true);
    const entries = activityLog
      .getActive()
      .filter((e) => e.type === "theme-switched");
    expect(entries.length).toEqual(2);
  });

  it("ignores unrelated achievement events", () => {
    dispatch("panel-open");
    dispatch("achievement-unlocked");
    const entries = activityLog
      .getActive()
      .filter((e) => e.type === "theme-switched");
    expect(entries.length).toEqual(0);
  });
});
