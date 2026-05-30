import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  formatRelativeTime,
  formatAbsoluteTime,
  formatAbsoluteDate,
  paintRelativeTime,
  _resetForTests,
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

describe("paintRelativeTime", () => {
  const NOW = Date.UTC(2026, 4, 7, 12, 0, 0);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
    document.body.innerHTML = "";
    _resetForTests();
  });

  afterEach(() => {
    _resetForTests();
    vi.useRealTimers();
  });

  it("paints the initial label and stamps the timestamp dataset", () => {
    const el = document.createElement("span");
    paintRelativeTime(el, NOW - 5 * MINUTE);
    expect(el.textContent).toBe("5m ago");
    expect(el.getAttribute("data-relative-ts")).toBe(String(NOW - 5 * MINUTE));
  });

  it("includes the prefix when supplied", () => {
    const el = document.createElement("span");
    paintRelativeTime(el, NOW - 2 * MINUTE, "dismissed ");
    expect(el.textContent).toBe("dismissed 2m ago");
  });

  it("refreshes the label as wall-clock time advances", () => {
    const el = document.createElement("span");
    document.body.appendChild(el);
    paintRelativeTime(el, NOW);
    expect(el.textContent).toBe("just now");
    // Roll the clock forward and let the interval fire — the label
    // should now reflect the new delta.
    vi.setSystemTime(new Date(NOW + 5 * MINUTE));
    vi.advanceTimersByTime(31_000);
    expect(el.textContent).toBe("5m ago");
  });

  it("stops the refresh loop once every painted element is detached", () => {
    const el = document.createElement("span");
    document.body.appendChild(el);
    paintRelativeTime(el, NOW);
    el.remove();
    // Tick once — the loop notices zero observers and clears itself.
    vi.advanceTimersByTime(31_000);
    // A second tick should be a no-op since the timer was cleared.  Add
    // a fresh element after the loop died and re-painting should kick
    // a new interval back up.
    const fresh = document.createElement("span");
    document.body.appendChild(fresh);
    paintRelativeTime(fresh, NOW - 2 * MINUTE);
    expect(fresh.textContent).toBe("2m ago");
    vi.setSystemTime(new Date(NOW + 3 * MINUTE));
    vi.advanceTimersByTime(31_000);
    expect(fresh.textContent).toBe("5m ago");
  });

  it("does not touch elements with an unrelated data-ts attribute", () => {
    // Achievement cards stamp data-ts on a wrapper that carries a
    // leading text node + a child progress span.  The refresh selector
    // must be namespaced enough that it can't sweep those into its
    // textContent rewrite.
    const card = document.createElement("div");
    card.className = "achievement-card-time";
    card.dataset.ts = String(NOW); // legacy bare attribute
    card.textContent = "Feb 3";
    const sep = document.createTextNode(" · ");
    const progress = document.createElement("span");
    progress.textContent = "3/5";
    card.appendChild(sep);
    card.appendChild(progress);
    document.body.appendChild(card);

    const activity = document.createElement("span");
    document.body.appendChild(activity);
    paintRelativeTime(activity, NOW - 2 * MINUTE);

    vi.setSystemTime(new Date(NOW + 5 * MINUTE));
    vi.advanceTimersByTime(31_000);

    // Card still carries every child.
    expect(card.children.length).toBe(1);
    expect(card.querySelector("span")).not.toBeNull();
    expect(card.firstChild.textContent).toBe("Feb 3");
    // Activity entry did get refreshed.
    expect(activity.textContent).toBe("7m ago");
  });
});
