import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createScribbleDetector,
  SCRIBBLE_MIN_SWING_PX,
  SCRIBBLE_WINDOW_MS,
} from "../../../js/themes/scribble-clear.js";

describe("themes/scribble-clear", () => {
  describe("createScribbleDetector", () => {
    const SWING = SCRIBBLE_MIN_SWING_PX + 10; // comfortably past the threshold

    // Feed an alternating 0 / SWING zigzag; return true if it ever fires.
    function zigzag(detector, samples, stepMs = 1) {
      let fired = false;
      for (let i = 0; i < samples; i++) {
        const x = i % 2 === 0 ? 0 : SWING;
        if (detector.feed(x, i * stepMs)) fired = true;
      }
      return fired;
    }

    it("fires after enough rapid full-swing reversals", () => {
      const detector = createScribbleDetector();
      // Two samples establish direction; each later alternation is a reversal.
      expect(zigzag(detector, 10)).toBe(true);
    });

    it("ignores jitter smaller than the swing threshold", () => {
      const detector = createScribbleDetector();
      const tiny = SCRIBBLE_MIN_SWING_PX - 5;
      let fired = false;
      for (let i = 0; i < 40; i++) {
        const x = i % 2 === 0 ? 0 : tiny;
        if (detector.feed(x, i)) fired = true;
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
        if (detector.feed(x, i * (SCRIBBLE_WINDOW_MS + 1))) fired = true;
      }
      expect(fired).toBe(false);
    });

    it("re-arms after firing", () => {
      const detector = createScribbleDetector();
      expect(zigzag(detector, 10)).toBe(true);
      // A fresh zigzag fires again.
      expect(zigzag(detector, 10, 1)).toBe(true);
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
          { id: "paper", label: "Paper" },
          { id: "vhs", label: "VHS" },
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

    function scribble() {
      const swing = SCRIBBLE_MIN_SWING_PX + 10;
      for (let i = 0; i < 10; i++) {
        window.dispatchEvent(
          new MouseEvent("pointermove", {
            clientX: i % 2 === 0 ? 0 : swing,
            bubbles: true,
          }),
        );
      }
    }

    it("clears every active theme silently when scribbled", () => {
      document.body.classList.add("paper");
      scribble();
      expect(toggled).toEqual([{ id: "paper", opts: { silent: true } }]);
    });

    it("dispatches a themes-scribbled achievement event", () => {
      document.body.classList.add("vhs");
      scribble();
      expect(achievements).toContainEqual({ type: "themes-scribbled" });
    });

    it("does nothing when no theme is active", () => {
      scribble();
      expect(toggled).toEqual([]);
      expect(achievements).toEqual([]);
    });
  });
});
