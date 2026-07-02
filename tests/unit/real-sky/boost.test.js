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

  it("re-reads the calendar when the time grid advances", () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 7, 12, 12, 0)));
    boost._resetBoostForTests();
    const atPeak = boost.shootingStarBoost();
    expect(atPeak).toBeGreaterThan(1);

    // Jump far off-season — a different grid bucket, so the memo drops.
    vi.setSystemTime(new Date(Date.UTC(2027, 2, 1, 12, 0)));
    expect(boost.shootingStarBoost()).toBe(1);
  });

  it("answers for the instant asked, not for when it was last asked", () => {
    // Determinism property behind the shared sky schedule: the multiplier
    // is a pure function of the grid bucket, so query history in one
    // window can't skew what another window computes for the same tick.
    boost._resetBoostForTests();
    const peakMs = Date.UTC(2026, 7, 12, 12, 0);
    const offSeasonMs = Date.UTC(2026, 2, 1, 12, 0);
    const atPeak = boost.shootingStarBoost(peakMs);
    expect(atPeak).toBeGreaterThan(1);
    expect(boost.shootingStarBoost(offSeasonMs)).toBe(1);
    expect(boost.shootingStarBoost(peakMs)).toBe(atPeak);
  });
});
