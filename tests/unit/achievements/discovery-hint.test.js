import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// discovery-hint fires one toast after IDLE_MS of no input, but only if
// no theme has been activated and it hasn't already shown this session.

describe("achievements/discovery-hint", () => {
  let mod;
  let showFn;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    sessionStorage.clear();
    mod = await import("../../../js/achievements/discovery-hint.js");
    showFn = vi.fn();
  });

  afterEach(() => {
    mod._resetForTests();
    vi.useRealTimers();
  });

  it("fires the hint after the idle window with no activity", () => {
    mod.initDiscoveryHint(showFn);
    vi.advanceTimersByTime(91000);
    expect(showFn).toHaveBeenCalledTimes(1);
    expect(showFn.mock.calls[0][0]).toMatch(/respond to you/i);
  });

  it("resets the timer on activity, delaying the hint", () => {
    mod.initDiscoveryHint(showFn);
    vi.advanceTimersByTime(60000);
    window.dispatchEvent(new Event("pointerdown"));
    vi.advanceTimersByTime(60000);
    // Total 120s elapsed, but the activity reset the 90s window.
    expect(showFn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(31000);
    expect(showFn).toHaveBeenCalledTimes(1);
  });

  it("never fires once a theme has been activated", () => {
    mod.initDiscoveryHint(showFn);
    window.dispatchEvent(
      new CustomEvent("achievement", {
        detail: { type: "theme-activate", theme: "frozen" },
      }),
    );
    vi.advanceTimersByTime(120000);
    expect(showFn).not.toHaveBeenCalled();
  });

  it("does not fire when already shown this session", () => {
    sessionStorage.setItem("cloudlog-discovery-hint-shown", "1");
    mod.initDiscoveryHint(showFn);
    vi.advanceTimersByTime(120000);
    expect(showFn).not.toHaveBeenCalled();
  });
});
