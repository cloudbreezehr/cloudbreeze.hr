import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The arrangement stream is module-level lazy state keyed off the URL and
// clock; each test re-imports with a controlled hash and system time.

describe("daily/random", () => {
  let daily;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 2, 12, 0));
    location.hash = "";
    location.search = "";
    vi.resetModules();
    daily = await import("../../../js/daily/random.js");
  });

  afterEach(() => {
    location.hash = "";
    location.search = "";
    vi.useRealTimers();
  });

  it("seeds from today's key and replays the same arrangement", () => {
    expect(daily.skySeedKey()).toBe("2026-07-02");
    expect(daily.isTimeTraveling()).toBe(false);
    const first = [
      daily.arrangementRandom(),
      daily.arrangementRandom(),
      daily.arrangementRandom(),
    ];
    daily._resetForTests();
    const replay = [
      daily.arrangementRandom(),
      daily.arrangementRandom(),
      daily.arrangementRandom(),
    ];
    expect(replay).toEqual(first);
  });

  it("a #sky URL seed overrides the date and flags time travel", () => {
    location.hash = "#sky=2025-12-24";
    daily._resetForTests();
    expect(daily.skySeedKey()).toBe("2025-12-24");
    expect(daily.isTimeTraveling()).toBe(true);
  });

  it("a #sky seed for today is not time travel", () => {
    location.hash = "#sky=2026-07-02";
    daily._resetForTests();
    expect(daily.isTimeTraveling()).toBe(false);
  });

  it("a ?sky query seed also overrides the date", () => {
    location.search = "?sky=2025-12-24";
    daily._resetForTests();
    expect(daily.skySeedKey()).toBe("2025-12-24");
    expect(daily.isTimeTraveling()).toBe(true);
    location.search = "";
  });

  it("different days give different arrangements", () => {
    const today = daily.arrangementRandom();
    vi.setSystemTime(new Date(2026, 6, 3, 12, 0));
    daily._resetForTests();
    expect(daily.arrangementRandom()).not.toBe(today);
  });
});
