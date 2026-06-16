import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createSpellMatcher,
  SPELL_GAP_MS,
} from "../../../js/themes/spell-trigger.js";

// The matcher is a pure state machine, exercised with explicit timestamps.
// initSpellTrigger wires it to keydown + click; those tests mock the theme
// registry so they don't pull in every real theme, and mock motion so the
// letter-pop's Web-Animations call is skipped under happy-dom.
//
// Coverage boundary: glyphAtPoint's rect-based glyph picking needs real
// layout, which happy-dom lacks — charRect's getBoundingClientRect returns
// no box, so the click tests below fall back to the bare caret offset (the
// pre-fix path). The rect disambiguation is therefore MANUAL-ONLY; verify by
// hand in a browser that (a) clicking the right edge of a letter selects that
// letter, not its neighbour, and (b) a large heading letter pops large and in
// its original case.

const SLACK_MS = 1;

describe("themes/spell-trigger", () => {
  describe("createSpellMatcher", () => {
    const NAMES = [
      { id: "paper", name: "Paper" },
      { id: "vhs", name: "VHS" },
      { id: "deep-sea", name: "Deep Sea" },
    ];

    // Feed a word one letter at a time, each within the gap window.
    function spell(matcher, word, startAt = 0) {
      let res;
      let t = startAt;
      for (const ch of word) {
        res = matcher.feed(ch, t);
        t += 1;
      }
      return res;
    }

    it("completes when a name's letters are entered in order", () => {
      const m = createSpellMatcher(NAMES);
      expect(spell(m, "PAPER").matchedId).toBe("paper");
    });

    it("normalizes spaces and case in names (Deep Sea → DEEPSEA)", () => {
      const m = createSpellMatcher(NAMES);
      expect(spell(m, "DEEPSEA").matchedId).toBe("deep-sea");
    });

    it("flags advance only for letters that move some name forward", () => {
      const m = createSpellMatcher(NAMES);
      expect(m.feed("P", 0).advanced).toBe(true); // begins PAPER
      expect(m.feed("Q", 1).advanced).toBe(false); // no name expects Q here
    });

    it("is forgiving: a non-matching letter doesn't reset progress", () => {
      const m = createSpellMatcher(NAMES);
      expect(spell(m, "PAQPER").matchedId).toBe("paper");
    });

    it("flags brokeStreak when a dead letter is tapped mid-spell", () => {
      const m = createSpellMatcher(NAMES);
      m.feed("P", 0); // paper now in progress
      const res = m.feed("Z", 1); // Z advances nothing here
      expect(res.advanced).toBe(false);
      expect(res.brokeStreak).toBe(true);
    });

    it("does not flag brokeStreak when nothing was in progress", () => {
      const m = createSpellMatcher(NAMES);
      expect(m.feed("Z", 0).brokeStreak).toBe(false);
    });

    it("resets progress after an idle gap longer than the window", () => {
      const m = createSpellMatcher(NAMES);
      m.feed("P", 0);
      m.feed("A", 1);
      // Past the window — progress clears, so this P starts fresh.
      const resumed = 1 + SPELL_GAP_MS + SLACK_MS;
      expect(m.feed("P", resumed).matchedId).toBeNull();
      expect(spell(m, "APER", resumed + 1).matchedId).toBe("paper");
    });

    it("re-completes on a second spelling so it can toggle back off", () => {
      const m = createSpellMatcher(NAMES);
      expect(spell(m, "VHS").matchedId).toBe("vhs");
      expect(spell(m, "VHS", 100).matchedId).toBe("vhs");
    });

    it("ignores names shorter than the minimum length", () => {
      const m = createSpellMatcher([{ id: "hi", name: "Hi" }]);
      expect(spell(m, "HI").matchedId).toBeNull();
    });

    it("accumulates charge from extra repeats of a chargeChar", () => {
      const m = createSpellMatcher([
        { id: "boom", name: "BOOM", chargeChar: "O" },
      ]);
      expect(spell(m, "BOOM").matchedCharge).toBe(0);
      expect(spell(m, "BOOOOM", 100).matchedCharge).toBe(2);
    });

    it("counts a charge letter as an advance, not a broken streak", () => {
      const m = createSpellMatcher([
        { id: "boom", name: "BOOM", chargeChar: "O" },
      ]);
      "BOO".split("").forEach((ch, i) => m.feed(ch, i)); // parked, expecting M
      const res = m.feed("O", 100); // a surplus O
      expect(res.advanced).toBe(true);
      expect(res.brokeStreak).toBe(false);
    });
  });

  describe("initSpellTrigger", () => {
    let mod;
    let toggled;
    let casts;
    let charges;
    let achievements;
    let stop;
    let onAchievement;

    beforeEach(async () => {
      document.body.innerHTML = "";
      document.body.className = "";
      vi.useFakeTimers();
      vi.resetModules();

      toggled = [];
      vi.doMock("../../../js/themes/registry.js", () => ({
        getThemes: () => [
          { id: "paper", label: "Paper" },
          { id: "vhs", label: "VHS" },
        ],
        toggleTheme: (id) => toggled.push(id),
      }));
      casts = [];
      charges = [];
      vi.doMock("../../../js/effects/incantations.js", () => ({
        INCANTATIONS: [
          {
            word: "BOOM",
            chargeChar: "O",
            cast: (origin, charge) => {
              casts.push(origin);
              charges.push(charge);
            },
          },
        ],
      }));
      vi.doMock("../../../js/motion.js", () => ({
        prefersReducedMotion: () => true,
      }));

      achievements = [];
      onAchievement = (e) => achievements.push(e.detail);
      window.addEventListener("achievement", onAchievement);

      mod = await import("../../../js/themes/spell-trigger.js");
      stop = mod.initSpellTrigger().stop;
    });

    afterEach(() => {
      if (stop) stop();
      window.removeEventListener("achievement", onAchievement);
      vi.useRealTimers();
      vi.doUnmock("../../../js/themes/registry.js");
      vi.doUnmock("../../../js/effects/incantations.js");
      vi.doUnmock("../../../js/motion.js");
    });

    function type(word) {
      for (const ch of word) {
        document.dispatchEvent(
          new KeyboardEvent("keydown", { key: ch, bubbles: true }),
        );
      }
    }

    it("toggles the theme when its name is typed", () => {
      type("PAPER");
      expect(toggled).toEqual(["paper"]);
    });

    it("dispatches a theme-spelled achievement event on completion", () => {
      type("VHS");
      expect(achievements).toContainEqual({
        type: "theme-spelled",
        theme: "vhs",
      });
    });

    it("casts an incantation when its word is spelled", () => {
      type("BOOM");
      expect(casts).toHaveLength(1);
    });

    it("dispatches an incantation achievement event on a cast", () => {
      type("BOOM");
      expect(achievements).toContainEqual({
        type: "incantation",
        word: "BOOM",
      });
    });

    it("anchors a keyboard cast to a viewport fallback when the pointer hasn't moved", () => {
      type("BOOM");
      expect(casts[0]).toMatchObject({
        x: expect.any(Number),
        y: expect.any(Number),
      });
    });

    it("anchors a cast to the last pointer position", () => {
      document.dispatchEvent(
        new MouseEvent("pointermove", {
          clientX: 123,
          clientY: 45,
          bubbles: true,
        }),
      );
      type("BOOM");
      expect(casts[0]).toEqual({ x: 123, y: 45 });
    });

    it("passes accumulated charge from extra letters to the cast", () => {
      type("BOOOOM");
      expect(charges[0]).toBe(2);
    });

    it("ignores letters typed into a focused input", () => {
      const input = document.createElement("input");
      document.body.appendChild(input);
      input.focus();
      type("PAPER");
      expect(toggled).toEqual([]);
    });

    it("reads the tapped letter from page text and toggles", () => {
      const p = document.createElement("p");
      const textNode = document.createTextNode("vhs");
      p.appendChild(textNode);
      document.body.appendChild(p);

      let offset = 0;
      document.caretPositionFromPoint = () => ({
        offsetNode: textNode,
        offset,
      });
      const tap = () =>
        document.dispatchEvent(
          new MouseEvent("click", {
            detail: 1,
            clientX: 5,
            clientY: 5,
            bubbles: true,
          }),
        );

      offset = 0;
      tap(); // v
      offset = 1;
      tap(); // h
      offset = 2;
      tap(); // s

      expect(toggled).toEqual(["vhs"]);
      delete document.caretPositionFromPoint;
    });

    it("does not read letters from inside interactive elements", () => {
      const link = document.createElement("a");
      link.href = "#x";
      const textNode = document.createTextNode("vhs");
      link.appendChild(textNode);
      document.body.appendChild(link);

      let offset = 0;
      document.caretPositionFromPoint = () => ({
        offsetNode: textNode,
        offset,
      });
      const tap = () =>
        document.dispatchEvent(
          new MouseEvent("click", {
            detail: 1,
            clientX: 5,
            clientY: 5,
            bubbles: true,
          }),
        );
      offset = 0;
      tap();
      offset = 1;
      tap();
      offset = 2;
      tap();

      expect(toggled).toEqual([]);
      delete document.caretPositionFromPoint;
    });
  });
});
