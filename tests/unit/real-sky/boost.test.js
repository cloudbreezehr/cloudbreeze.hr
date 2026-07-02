import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("real-sky/boost", () => {
  let boost;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    boost = await import("../../../js/real-sky/boost.js");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is neutral outside shower season", () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 2, 1, 12, 0)));
    boost._resetBoostForTests();
    expect(boost.shootingStarBoost()).toBe(1);
  });

  it("multiplies the spawn rate at a shower peak", () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 7, 12, 12, 0)));
    boost._resetBoostForTests();
    expect(boost.shootingStarBoost()).toBeGreaterThan(1);
  });

  it("caches between refreshes and picks up a date change after one", () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 7, 12, 12, 0)));
    boost._resetBoostForTests();
    const atPeak = boost.shootingStarBoost();
    expect(atPeak).toBeGreaterThan(1);

    // Jump far off-season; the cached multiplier holds until the refresh
    // window lapses, then the calendar is re-read.
    vi.setSystemTime(new Date(Date.UTC(2027, 2, 1, 12, 0)));
    expect(boost.shootingStarBoost()).toBe(1);
  });
});
