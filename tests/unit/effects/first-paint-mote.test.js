import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// first-paint-mote arms a one-shot pointermove listener on init for
// brand-new visitors and spawns a single drifting mote on the first
// qualifying movement.  Gated by localStorage and prefers-reduced-
// motion.  Tests stub matchMedia to control the reduced-motion gate.

describe("effects/first-paint-mote", () => {
  let mod;
  let matchMediaCalls;
  let reducedMotion;

  beforeEach(async () => {
    localStorage.clear();
    document.body.innerHTML = "";
    vi.useFakeTimers();
    vi.resetModules();

    matchMediaCalls = [];
    reducedMotion = false;
    window.matchMedia = vi.fn((query) => {
      matchMediaCalls.push(query);
      return {
        matches: query.includes("reduce") ? reducedMotion : false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
    });

    // happy-dom doesn't implement Element.animate; stub it so the spawn
    // path runs.  Capture the call so tests can drive onfinish.
    Element.prototype.animate = vi.fn(function () {
      const fakeAnim = { onfinish: null };
      // Schedule onfinish for the next tick so removal happens after
      // assertions about presence.
      queueMicrotask(() => {
        if (fakeAnim.onfinish) fakeAnim.onfinish();
      });
      return fakeAnim;
    });

    mod = await import("../../../js/effects/first-paint-mote.js");
  });

  afterEach(() => {
    mod._resetForTests();
    vi.useRealTimers();
    delete Element.prototype.animate;
  });

  function dispatchPointerMove(x, y) {
    const e = new MouseEvent("pointermove", {
      clientX: x,
      clientY: y,
      bubbles: true,
    });
    window.dispatchEvent(e);
  }

  function getMote() {
    return document.querySelector(".first-paint-mote");
  }

  it("spawns one mote on the first qualifying pointer movement", async () => {
    mod.initFirstPaintMote();
    // Past the arming delay.
    vi.advanceTimersByTime(1000);

    dispatchPointerMove(100, 100); // seeds reference point
    dispatchPointerMove(200, 200); // travels well past the dead zone

    expect(getMote()).not.toBeNull();
  });

  it("does not spawn a mote when prefers-reduced-motion is set", async () => {
    // motion.js snapshots matchMedia at import time, so the flag must
    // be in place before the module imports.  Re-import after flipping.
    reducedMotion = true;
    vi.resetModules();
    mod = await import("../../../js/effects/first-paint-mote.js");

    mod.initFirstPaintMote();
    vi.advanceTimersByTime(1000);
    dispatchPointerMove(100, 100);
    dispatchPointerMove(500, 500);
    expect(getMote()).toBeNull();
  });

  it("does not spawn a mote when the seen flag is already set", () => {
    localStorage.setItem("first-paint-mote-seen", "1");
    mod.initFirstPaintMote();
    vi.advanceTimersByTime(1000);
    dispatchPointerMove(100, 100);
    dispatchPointerMove(500, 500);
    expect(getMote()).toBeNull();
  });

  it("ignores pointer movement before the arming delay", () => {
    mod.initFirstPaintMote();
    // Don't advance — fire immediately.
    dispatchPointerMove(100, 100);
    dispatchPointerMove(500, 500);
    expect(getMote()).toBeNull();
  });

  it("ignores tiny pointer travel within the dead zone", () => {
    mod.initFirstPaintMote();
    vi.advanceTimersByTime(1000);
    dispatchPointerMove(100, 100); // seed
    dispatchPointerMove(105, 102); // tiny nudge — within dead zone
    expect(getMote()).toBeNull();
  });

  it("fires only once even across multiple init cycles in the same browser", async () => {
    mod.initFirstPaintMote();
    vi.advanceTimersByTime(1000);
    dispatchPointerMove(100, 100);
    dispatchPointerMove(500, 500);
    expect(getMote()).not.toBeNull();

    // Drain the cleanup microtask before re-init.
    await vi.runAllTimersAsync();

    // Simulate a new page load — module-level state resets via
    // resetModules, but the localStorage flag persists.
    vi.resetModules();
    mod = await import("../../../js/effects/first-paint-mote.js");
    mod.initFirstPaintMote();
    vi.advanceTimersByTime(1000);
    dispatchPointerMove(100, 100);
    dispatchPointerMove(500, 500);
    // No new mote on this fresh init — the gate held.
    expect(document.querySelectorAll(".first-paint-mote").length).toEqual(0);
  });
});
