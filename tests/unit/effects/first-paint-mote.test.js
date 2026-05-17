import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MOTE } from "../../../js/effects/first-paint-mote.js";

// first-paint-mote arms a one-shot pointermove listener on init and
// spawns a single drifting mote on the first qualifying movement.
// Gated by sessionStorage; reduced-motion collapses the animation
// duration to 0 (via reducedDuration) rather than skipping the spawn.
// Tests stub matchMedia to control the reduced-motion path.

// Small epsilon so vi.advanceTimersByTime lands just past the arming
// boundary rather than on it.
const SLACK_MS = 5;
const PAST_ARMING_MS = MOTE.ARM_DELAY_MS + SLACK_MS;

// Pointer travel that comfortably clears the dead zone (squared distance
// well above POINTER_DEAD_ZONE_PX²). Computed as a multiple of the dead
// zone so tuning the source automatically retunes the test.
const PAST_DEAD_ZONE_PX = MOTE.POINTER_DEAD_ZONE_PX * 4;

// Tiny travel that stays inside the dead zone.
const WITHIN_DEAD_ZONE_PX = Math.floor(MOTE.POINTER_DEAD_ZONE_PX / 4);

const SEED_X = 100;
const SEED_Y = 100;

describe("effects/first-paint-mote", () => {
  let mod;
  let matchMediaCalls;
  let reducedMotion;

  beforeEach(async () => {
    sessionStorage.clear();
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
    vi.advanceTimersByTime(PAST_ARMING_MS);

    dispatchPointerMove(SEED_X, SEED_Y); // seeds reference point
    dispatchPointerMove(SEED_X + PAST_DEAD_ZONE_PX, SEED_Y + PAST_DEAD_ZONE_PX);

    expect(getMote()).not.toBeNull();
  });

  it("uses a zero-duration animation when prefers-reduced-motion is set", async () => {
    // motion.js snapshots matchMedia at import time, so the flag must
    // be in place before the module imports.  Re-import after flipping.
    reducedMotion = true;
    vi.resetModules();
    mod = await import("../../../js/effects/first-paint-mote.js");

    mod.initFirstPaintMote();
    vi.advanceTimersByTime(PAST_ARMING_MS);
    dispatchPointerMove(SEED_X, SEED_Y);
    dispatchPointerMove(SEED_X + PAST_DEAD_ZONE_PX, SEED_Y + PAST_DEAD_ZONE_PX);
    // The mote element is created so the session-once contract still
    // holds, but its animation duration collapses to 0 so the visitor
    // never sees a sustained drift.
    const animateCalls = Element.prototype.animate.mock.calls;
    expect(animateCalls.length).toEqual(1);
    expect(animateCalls[0][1].duration).toEqual(0);
  });

  it("does not spawn a mote when the session flag is already set", () => {
    sessionStorage.setItem("first-paint-mote-shown", "1");
    mod.initFirstPaintMote();
    vi.advanceTimersByTime(PAST_ARMING_MS);
    dispatchPointerMove(SEED_X, SEED_Y);
    dispatchPointerMove(SEED_X + PAST_DEAD_ZONE_PX, SEED_Y + PAST_DEAD_ZONE_PX);
    expect(getMote()).toBeNull();
  });

  it("ignores pointer movement before the arming delay", () => {
    mod.initFirstPaintMote();
    // Don't advance — fire immediately.
    dispatchPointerMove(SEED_X, SEED_Y);
    dispatchPointerMove(SEED_X + PAST_DEAD_ZONE_PX, SEED_Y + PAST_DEAD_ZONE_PX);
    expect(getMote()).toBeNull();
  });

  it("ignores tiny pointer travel within the dead zone", () => {
    mod.initFirstPaintMote();
    vi.advanceTimersByTime(PAST_ARMING_MS);
    dispatchPointerMove(SEED_X, SEED_Y); // seed
    dispatchPointerMove(
      SEED_X + WITHIN_DEAD_ZONE_PX,
      SEED_Y + WITHIN_DEAD_ZONE_PX,
    );
    expect(getMote()).toBeNull();
  });

  it("fires only once across multiple init cycles in the same tab", async () => {
    mod.initFirstPaintMote();
    vi.advanceTimersByTime(PAST_ARMING_MS);
    dispatchPointerMove(SEED_X, SEED_Y);
    dispatchPointerMove(SEED_X + PAST_DEAD_ZONE_PX, SEED_Y + PAST_DEAD_ZONE_PX);
    expect(getMote()).not.toBeNull();

    // Drain the cleanup microtask before re-init.
    await vi.runAllTimersAsync();

    // Simulate a refresh in the same tab — module-level state resets
    // via resetModules, but the sessionStorage flag persists.
    vi.resetModules();
    mod = await import("../../../js/effects/first-paint-mote.js");
    mod.initFirstPaintMote();
    vi.advanceTimersByTime(PAST_ARMING_MS);
    dispatchPointerMove(SEED_X, SEED_Y);
    dispatchPointerMove(SEED_X + PAST_DEAD_ZONE_PX, SEED_Y + PAST_DEAD_ZONE_PX);
    // No new mote on this fresh init — the gate held.
    expect(document.querySelectorAll(".first-paint-mote").length).toEqual(0);
  });
});
