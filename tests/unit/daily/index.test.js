import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("daily/index", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 2, 12, 0));
    location.hash = "";
    vi.resetModules();
  });

  afterEach(() => {
    location.hash = "";
    vi.useRealTimers();
  });

  it("reports a time-traveling visit on init", async () => {
    location.hash = "#sky=2025-12-24";
    const events = [];
    window.addEventListener("achievement", (e) => events.push(e.detail));
    const mod = await import("../../../js/daily/index.js");
    mod.initDailySky();
    expect(events).toContainEqual({ type: "time-travel", seed: "2025-12-24" });
  });

  it("stays silent on an ordinary same-day visit", async () => {
    const events = [];
    window.addEventListener("achievement", (e) => events.push(e.detail));
    const mod = await import("../../../js/daily/index.js");
    mod.initDailySky();
    expect(events).toEqual([]);
  });
});
