import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createScribbleDetector,
  SCRIBBLE_MIN_SWING_PX,
  SCRIBBLE_REVERSALS,
  SCRIBBLE_WINDOW_MS,
} from "../../../js/themes/scribble-clear.js";

// Samples to feed for a guaranteed fire: two prime the direction, then one
// reversal per alternation after that, plus slack. Derived from the source
// constant so retuning the reversal count keeps these tests honest.
const FIRING_SAMPLES = SCRIBBLE_REVERSALS + 3;

describe("themes/scribble-clear", () => {
  describe("createScribbleDetector", () => {
    const SWING = SCRIBBLE_MIN_SWING_PX + 10; // comfortably past the threshold

    // Feed an alternating 0 / SWING zigzag at a flat y; return true if it fires.
    function zigzag(detector, samples, stepMs = 1) {
      let fired = false;
      for (let i = 0; i < samples; i++) {
        const x = i % 2 === 0 ? 0 : SWING;
        if (detector.feed(x, 0, i * stepMs)) fired = true;
      }
      return fired;
    }

    it("fires after enough rapid full-swing reversals", () => {
      const detector = createScribbleDetector();
      // Two samples establish direction; each later alternation is a reversal.
      expect(zigzag(detector, FIRING_SAMPLES)).toBe(true);
    });

    it("ignores jitter smaller than the swing threshold", () => {
      const detector = createScribbleDetector();
      const tiny = SCRIBBLE_MIN_SWING_PX - 5;
      let fired = false;
      for (let i = 0; i < 40; i++) {
        const x = i % 2 === 0 ? 0 : tiny;
        if (detector.feed(x, 0, i)) fired = true;
      }
      expect(fired).toBe(false);
    });

    it("ignores circular motion (each swing carries too much vertical travel)", () => {
      const detector = createScribbleDetector();
      // Trace circles: x swings past the threshold, but every horizontal swing
      // also climbs and falls through ~the radius, so none counts as flat.
      const R = SCRIBBLE_MIN_SWING_PX + 30;
      let fired = false;
      for (let i = 0; i < 80; i++) {
        const a = (i / 10) * Math.PI;
        if (detector.feed(Math.cos(a) * R, Math.sin(a) * R, i)) fired = true;
      }
      expect(fired).toBe(false);
    });

    it("does not fire when reversals are spread beyond the window", () => {
      const detector = createScribbleDetector();
      // One reversal per window+ — each prunes the previous, so the count
      // never accumulates.
      let fired = false;
      for (let i = 0; i < 40; i++) {
        const x = i % 2 === 0 ? 0 : SWING;
        if (detector.feed(x, 0, i * (SCRIBBLE_WINDOW_MS + 1))) fired = true;
      }
      expect(fired).toBe(false);
    });

    it("re-arms after firing", () => {
      const detector = createScribbleDetector();
      expect(zigzag(detector, FIRING_SAMPLES)).toBe(true);
      // A fresh zigzag fires again.
      expect(zigzag(detector, FIRING_SAMPLES, 1)).toBe(true);
    });
  });

  describe("initScribbleClear", () => {
    let mod;
    let toggled;
    let achievements;
    let stop;
    let onAchievement;

    beforeEach(async () => {
      document.body.innerHTML = "";
      document.body.className = "";
      vi.resetModules();

      toggled = [];
      vi.doMock("../../../js/themes/registry.js", () => ({
        getThemes: () => [
          { id: "frozen", label: "Frozen" },
          { id: "paper", label: "Paper", capturesPointer: true },
        ],
        toggleTheme: (id, opts) => toggled.push({ id, opts }),
      }));

      achievements = [];
      onAchievement = (e) => achievements.push(e.detail);
      window.addEventListener("achievement", onAchievement);

      mod = await import("../../../js/themes/scribble-clear.js");
      stop = mod.initScribbleClear().stop;
    });

    afterEach(() => {
      if (stop) stop();
      window.removeEventListener("achievement", onAchievement);
      vi.doUnmock("../../../js/themes/registry.js");
    });

    // buttons defaults to 1 (a held drag); pass 0 to simulate idle mouse drift.
    function scribble(buttons = 1) {
      const swing = SCRIBBLE_MIN_SWING_PX + 10;
      for (let i = 0; i < FIRING_SAMPLES; i++) {
        window.dispatchEvent(
          new MouseEvent("pointermove", {
            clientX: i % 2 === 0 ? 0 : swing,
            buttons,
            bubbles: true,
          }),
        );
      }
    }

    it("clears every active theme silently when scribbled", () => {
      document.body.classList.add("frozen");
      scribble();
      expect(toggled).toEqual([{ id: "frozen", opts: { silent: true } }]);
    });

    it("dispatches a themes-scribbled achievement event", () => {
      document.body.classList.add("frozen");
      scribble();
      expect(achievements).toContainEqual({ type: "themes-scribbled" });
    });

    it("ignores movement with no button held (idle mouse drift)", () => {
      document.body.classList.add("frozen");
      scribble(0);
      expect(toggled).toEqual([]);
      expect(achievements).toEqual([]);
    });

    it("yields when a drag-capturing theme is the only thing active (scribble = drawing)", () => {
      document.body.classList.add("paper");
      scribble();
      expect(toggled).toEqual([]);
      expect(achievements).toEqual([]);
    });

    it("still clears a stack that also holds a drag-capturing theme", () => {
      // Paper alone shields the wipe, but stacked with a normal theme a scrub
      // clears everything, paper included — matching the double-Escape wipe.
      document.body.classList.add("frozen");
      document.body.classList.add("paper");
      scribble();
      expect(toggled).toEqual([
        { id: "frozen", opts: { silent: true } },
        { id: "paper", opts: { silent: true } },
      ]);
      expect(achievements).toContainEqual({ type: "themes-scribbled" });
    });

    it("does nothing when no theme is active", () => {
      scribble();
      expect(toggled).toEqual([]);
      expect(achievements).toEqual([]);
    });
  });
});
