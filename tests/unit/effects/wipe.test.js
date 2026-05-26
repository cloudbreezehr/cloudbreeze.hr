import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// wipe.js consults motion.js's prefersReducedMotion() and either skips
// the visual transition entirely (callbacks still fire, async) or runs
// the full cover → midpoint → reveal sequence.  Tests control the
// preference via the same matchMedia stub motion.test.js uses, then
// reset modules so wipe.js binds to the freshly-stubbed motion module.

describe("effects/wipe", () => {
  let mqlMatches;

  beforeEach(() => {
    mqlMatches = false;
    window.matchMedia = vi.fn(() => ({
      get matches() {
        return mqlMatches;
      },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    vi.useFakeTimers();
    vi.resetModules();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    delete window.matchMedia;
    vi.useRealTimers();
  });

  describe("with motion enabled", () => {
    it("paints a wipe element and fires onMidpoint after coverMs", async () => {
      const { playWipe } = await import("../../../js/effects/wipe.js");
      const COVER_MS = 200;
      const REVEAL_MS = 300;
      const onMidpoint = vi.fn();
      const onComplete = vi.fn();

      playWipe({
        className: "test-wipe",
        coverMs: COVER_MS,
        revealMs: REVEAL_MS,
        onMidpoint,
        onComplete,
      });

      expect(document.querySelector(".test-wipe")).not.toBeNull();
      expect(onMidpoint).not.toHaveBeenCalled();

      vi.advanceTimersByTime(COVER_MS);
      expect(onMidpoint).toHaveBeenCalledOnce();
      expect(onComplete).not.toHaveBeenCalled();
    });
  });

  describe("with motion reduced", () => {
    it("skips the wipe element entirely", async () => {
      mqlMatches = true;
      const { playWipe } = await import("../../../js/effects/wipe.js");
      playWipe({
        className: "test-wipe",
        coverMs: 200,
        revealMs: 300,
        onMidpoint: vi.fn(),
        onComplete: vi.fn(),
      });
      expect(document.querySelector(".test-wipe")).toBeNull();
    });

    it("still fires onMidpoint then onComplete asynchronously", async () => {
      mqlMatches = true;
      const { playWipe } = await import("../../../js/effects/wipe.js");
      const order = [];
      playWipe({
        className: "test-wipe",
        coverMs: 9999,
        revealMs: 9999,
        onMidpoint: () => order.push("midpoint"),
        onComplete: () => order.push("complete"),
      });
      // Callbacks must not fire synchronously inside playWipe.
      expect(order).toEqual([]);
      vi.runAllTimers();
      expect(order).toEqual(["midpoint", "complete"]);
    });
  });
});
