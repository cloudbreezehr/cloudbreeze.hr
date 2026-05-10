import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// announcer.js owns a module-level live region element and a clear
// timer.  Reset modules per test so the element and timer start fresh.

describe("achievements/announcer", () => {
  let announcer;

  beforeEach(async () => {
    vi.useFakeTimers();
    document.body.innerHTML = "";
    vi.resetModules();
    announcer = await import("../../../js/achievements/announcer.js");
  });

  afterEach(() => {
    announcer._resetForTests();
    vi.useRealTimers();
  });

  function getLiveEl() {
    return document.querySelector('[aria-live="polite"]');
  }

  it("creates a polite live region on first announce", () => {
    expect(getLiveEl()).toBeNull();
    announcer.announce("hello");
    expect(getLiveEl()).not.toBeNull();
  });

  it("reuses the same live region across announces", () => {
    announcer.announce("one");
    const first = getLiveEl();
    vi.advanceTimersByTime(100);
    announcer.announce("two");
    expect(getLiveEl()).toBe(first);
  });

  it("writes the announced text into the live region after the clear delay", () => {
    announcer.announce("achievement unlocked");
    // Before the clear delay elapses, the region is empty.
    expect(getLiveEl().textContent).toEqual("");
    vi.advanceTimersByTime(100);
    expect(getLiveEl().textContent).toEqual("achievement unlocked");
  });

  it("clears between messages so repeated identical text still triggers a read", () => {
    announcer.announce("same");
    vi.advanceTimersByTime(100);
    expect(getLiveEl().textContent).toEqual("same");

    announcer.announce("same");
    // A fresh announce must clear first, so mid-flight the text is empty.
    expect(getLiveEl().textContent).toEqual("");
    vi.advanceTimersByTime(100);
    expect(getLiveEl().textContent).toEqual("same");
  });

  it("is a no-op for empty text", () => {
    announcer.announce("");
    announcer.announce(null);
    announcer.announce(undefined);
    expect(getLiveEl()).toBeNull();
  });

  it("coerces non-string values to strings", () => {
    announcer.announce(42);
    vi.advanceTimersByTime(100);
    expect(getLiveEl().textContent).toEqual("42");
  });

  it("marks the region as aria-atomic and role=status", () => {
    announcer.announce("x");
    const el = getLiveEl();
    expect(el.getAttribute("aria-atomic")).toEqual("true");
    expect(el.getAttribute("role")).toEqual("status");
  });

  it("is visually hidden but present in the DOM", () => {
    announcer.announce("x");
    const el = getLiveEl();
    // sr-only pattern: positioned off-screen with clip-path, NOT
    // display:none (which would remove it from the accessibility tree).
    expect(el.style.position).toEqual("absolute");
    expect(el.style.display).not.toEqual("none");
    expect(el.style.visibility).not.toEqual("hidden");
  });
});
