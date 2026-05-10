import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// timestamp.js owns a module-level boolean.  Each test resets so
// nothing leaks.

describe("achievements/ui/timestamp", () => {
  let mod;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-11T12:00:00Z"));
    vi.resetModules();
    mod = await import("../../../../js/achievements/ui/timestamp.js");
  });

  afterEach(() => {
    mod._resetForTests();
    vi.useRealTimers();
  });

  it("formats relative by default", () => {
    const twoMinAgo = Date.now() - 2 * 60 * 1000;
    expect(mod.formatTimestamp(twoMinAgo)).toEqual("2m ago");
  });

  it("formats absolute after a toggle", () => {
    const ts = Date.now() - 2 * 60 * 1000;
    mod.toggleTimestampMode(null);
    expect(mod.formatTimestamp(ts)).toMatch(/2026, \d\d:\d\d$/);
  });

  it("toggles back to relative on a second call", () => {
    const ts = Date.now() - 2 * 60 * 1000;
    mod.toggleTimestampMode(null);
    mod.toggleTimestampMode(null);
    expect(mod.formatTimestamp(ts)).toEqual("2m ago");
  });

  it("dispatches timestamp-toggle only when switching TO absolute", () => {
    const listener = vi.fn();
    window.addEventListener("achievement", listener);
    mod.toggleTimestampMode(null); // relative → absolute, should fire
    mod.toggleTimestampMode(null); // absolute → relative, should NOT fire
    window.removeEventListener("achievement", listener);
    const matching = listener.mock.calls.filter(
      (c) => c[0].detail.type === "timestamp-toggle",
    );
    expect(matching).toHaveLength(1);
  });

  it("refreshes timestamps in the provided scope element", () => {
    const scope = document.createElement("div");
    const a = document.createElement("span");
    a.className = "achievement-card-time";
    const ts = Date.now() - 2 * 60 * 1000;
    a.dataset.ts = String(ts);
    a.textContent = "2m ago";
    scope.appendChild(a);

    mod.toggleTimestampMode(scope);
    // After toggle, absolute form replaces the text
    expect(a.textContent).toMatch(/2026, \d\d:\d\d$/);
  });

  it("skips refresh when scopeEl is null", () => {
    expect(() => mod.toggleTimestampMode(null)).not.toThrow();
    expect(() => mod.toggleTimestampMode(undefined)).not.toThrow();
  });

  it("updates only the leading text node to preserve inline progress spans", () => {
    const scope = document.createElement("div");
    const el = document.createElement("span");
    el.className = "achievement-card-time";
    el.dataset.ts = String(Date.now() - 3600_000);
    // First child is a text node; an inline progress span follows it.
    el.appendChild(document.createTextNode("1h ago"));
    const progressSpan = document.createElement("span");
    progressSpan.className = "achievement-card-progress";
    progressSpan.textContent = "3/5";
    el.appendChild(progressSpan);
    scope.appendChild(el);

    mod.toggleTimestampMode(scope);

    // The inline span should survive.
    expect(el.querySelector(".achievement-card-progress")).not.toBeNull();
    expect(el.querySelector(".achievement-card-progress").textContent).toEqual(
      "3/5",
    );
  });
});
