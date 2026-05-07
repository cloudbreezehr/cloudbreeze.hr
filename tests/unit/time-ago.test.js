import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  formatRelativeTime,
  formatAbsoluteTime,
  formatAbsoluteDate,
} from "../../js/time-ago.js";

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const WEEK = 604_800_000;

describe("formatRelativeTime", () => {
  // Fix "now" to a deterministic instant so thresholds are reproducible.
  const NOW = Date.UTC(2026, 4, 7, 12, 0, 0); // 2026-05-07 12:00 UTC

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'just now' for deltas under a minute", () => {
    expect(formatRelativeTime(NOW - 30_000)).toBe("just now");
    expect(formatRelativeTime(NOW - MINUTE + 1)).toBe("just now");
  });

  it("returns minutes for deltas 1m–59m", () => {
    expect(formatRelativeTime(NOW - 5 * MINUTE)).toBe("5m ago");
    expect(formatRelativeTime(NOW - 59 * MINUTE)).toBe("59m ago");
  });

  it("returns hours for deltas 1h–23h", () => {
    expect(formatRelativeTime(NOW - 3 * HOUR)).toBe("3h ago");
    expect(formatRelativeTime(NOW - 23 * HOUR)).toBe("23h ago");
  });

  it("returns days for deltas 1d–6d", () => {
    expect(formatRelativeTime(NOW - 2 * DAY)).toBe("2d ago");
    expect(formatRelativeTime(NOW - 6 * DAY)).toBe("6d ago");
  });

  it("falls back to an absolute date for anything ≥ 1 week", () => {
    // One week earlier: 2026-04-30 → "Apr 30"
    expect(formatRelativeTime(NOW - WEEK)).toBe("Apr 30");
  });
});

describe("formatAbsoluteTime", () => {
  it("formats as 'D Mon YYYY, HH:mm'", () => {
    // 2026-02-03 14:07 in whatever timezone the test runs — we don't assert
    // the hour/minute precisely because toLocaleString respects TZ, but the
    // structural shape is stable.
    const ts = new Date(2026, 1, 3, 14, 7).getTime();
    const out = formatAbsoluteTime(ts);
    expect(out).toMatch(/^3 Feb 2026, \d\d:\d\d$/);
  });
});

describe("formatAbsoluteDate", () => {
  it("formats as 'Mon D'", () => {
    const ts = new Date(2026, 1, 3).getTime();
    expect(formatAbsoluteDate(ts)).toBe("Feb 3");
  });
});
