import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createSpellMatcher,
  SPELL_GAP_MS,
  SPELL_STRAY_BUDGET,
  CHARGE_SETTLE_MS,
} from "../../../js/themes/spell-trigger.js";

// The matcher is a pure state machine, exercised with explicit timestamps.
// initSpellTrigger wires it to keydown + click; those tests mock the theme
// registry so they don't pull in every real theme, and mock motion so the
// letter-pop's Web-Animations call is skipped under happy-dom.
//
// glyphAtPoint's rect logic needs layout. Most click tests run under happy-dom
// (no layout) and so exercise the caret-offset fallback; one test stubs
// getBoundingClientRect to cover the rect-bounded hit test — a tap must land on
// the glyph's box, not just resolve to the nearest caret. What stays manual is
// the real-font rendering: reading the exact glyph under varied fonts, and the
// pop matching the glyph's size and case.

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

    it("tolerates up to the stray budget in a row, even between every letter", () => {
      const m = createSpellMatcher(NAMES);
      // The max tolerated run of junk between each letter — far more than the
      // budget in total, but never more in a row, so it still completes
      // (strays are counted consecutively, forgiven by each correct letter).
      const gap = "Q".repeat(SPELL_STRAY_BUDGET);
      expect(spell(m, `P${gap}A${gap}P${gap}E${gap}R`).matchedId).toBe("paper");
    });

    it("drops a word's progress once a junk run exceeds the budget", () => {
      const m = createSpellMatcher(NAMES);
      const tooMany = "Q".repeat(SPELL_STRAY_BUDGET + 1);
      expect(spell(m, `PA${tooMany}PER`).matchedId).toBeNull();
    });

    it("rejects a word spelled as a distant subsequence", () => {
      const m = createSpellMatcher([{ id: "rainy", name: "Rainy" }]);
      // RAIN reached, then a junk run past the budget before Y — the kind of
      // scatter that used to let RAINY fall out of PAR·WA·WI·SN·DEPLOY.
      const gap = "X".repeat(SPELL_STRAY_BUDGET + 1);
      expect(spell(m, `RAIN${gap}Y`).matchedId).toBeNull();
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

    it("reports live progress and charge for the cursor buildup", () => {
      const m = createSpellMatcher([
        { id: "boom", name: "BOOM", chargeChar: "O" },
      ]);
      expect(m.feed("B", 0).progress).toBeCloseTo(0.25);
      m.feed("O", 1);
      expect(m.feed("O", 2).progress).toBeCloseTo(0.75); // parked before the M
      expect(m.feed("O", 3).liveCharge).toBe(1); // surplus O stacks while parked
      expect(m.feed("O", 4).liveCharge).toBe(2);
      expect(m.feed("M", 5).progress).toBe(0); // completion discharges
    });

    it("clamps charge at chargeMax", () => {
      const m = createSpellMatcher([
        { id: "boom", name: "BOOM", chargeChar: "O", chargeMax: () => 2 },
      ]);
      // BOOOOOOM: four surplus O's, but the cap is 2.
      expect(spell(m, "BOOOOOOM").matchedCharge).toBe(2);
    });

    it("reports charged until the cap, then stops without a miss", () => {
      const m = createSpellMatcher([
        { id: "boom", name: "BOOM", chargeChar: "O", chargeMax: () => 1 },
      ]);
      "BOO".split("").forEach((ch, i) => m.feed(ch, i)); // parked, charge 0
      expect(m.feed("O", 10).charged).toBe(true); // charge → 1
      const maxed = m.feed("O", 11); // would be 2, but capped at 1
      expect(maxed.charged).toBe(false);
      expect(maxed.brokeStreak).toBe(false); // recognised, not a dead letter
    });
  });

  describe("initSpellTrigger", () => {
    let mod;
    let toggled;
    let casts;
    let charges;
    let achievements;
    let soundRevealed;
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
            chargeMax: () => 2,
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
      soundRevealed = 0;
      vi.doMock("../../../js/audio/toggle.js", () => ({
        revealSoundToggle: () => {
          soundRevealed++;
        },
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
      vi.doUnmock("../../../js/audio/toggle.js");
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
        maxed: false,
      });
    });

    it("flags maxed when an incantation is charged to its cap", () => {
      type("BOOOOM"); // two surplus O's hits the mock cap of 2
      expect(achievements).toContainEqual({
        type: "incantation",
        word: "BOOM",
        maxed: true,
      });
    });

    it("reveals the cheatsheet and announces its discovery when CHEATSHEET is spelled", () => {
      localStorage.clear(); // a prior test may have already discovered it
      type("CHEATSHEET");
      expect(document.querySelector(".cheatsheet-overlay")).not.toBeNull();
      expect(achievements).toContainEqual({ type: "cheatsheet-discovered" });
    });

    it("reveals the sound toggle when SOUND is spelled", () => {
      type("SOUND");
      expect(soundRevealed).toBe(1);
    });

    it("also reveals it via SOUNDON — SOUND completes at the fifth letter", () => {
      type("SOUNDON");
      expect(soundRevealed).toBe(1);
    });

    it("ignores spelling while the cheatsheet modal is open", () => {
      localStorage.clear();
      type("CHEATSHEET"); // opens the panel
      toggled.length = 0;
      type("PAPER"); // would normally toggle the paper theme
      expect(toggled).toEqual([]);
      // Close it so the modal-open state doesn't leak into later assertions.
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
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

    const chargeAmount = () =>
      parseFloat(
        document.documentElement.style.getPropertyValue("--spell-charge"),
      ) || 0;

    it("drives the cursor charge variable while spelling", () => {
      type("PAP"); // 3/5 of PAPER, above the threshold
      expect(chargeAmount()).toBeGreaterThan(0);
    });

    it("keeps a single stray letter below the charge threshold", () => {
      type("P"); // 1/5 of PAPER, below the threshold
      expect(chargeAmount()).toBe(0);
    });

    it("flags overcharge while a charge letter stacks", () => {
      type("BOOOO"); // BOOM parked + surplus O's
      expect(document.body.classList.contains("spell-overcharging")).toBe(true);
    });

    it("twitches the cursor on each surplus charge letter", () => {
      type("BOOOO"); // surplus O's fire the per-letter kick
      expect(document.body.classList.contains("spell-kick")).toBe(true);
    });

    it("clears the twitch class once the spell completes", () => {
      type("BOOOO");
      expect(document.body.classList.contains("spell-kick")).toBe(true);
      type("M"); // completes BOOM → discharge clears the twitch class
      expect(document.body.classList.contains("spell-kick")).toBe(false);
    });

    it("eases the cursor charge back to rest after the settle delay", () => {
      type("PAP");
      expect(chargeAmount()).toBeGreaterThan(0);
      vi.advanceTimersByTime(CHARGE_SETTLE_MS + 1);
      expect(chargeAmount()).toBe(0);
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

    // With real layout, the tap must land on the glyph's box — caret snapping
    // must not let a far-off tap resolve to the nearest letter.
    it("registers a tap inside a glyph's box but ignores one outside it", () => {
      const p = document.createElement("p");
      const textNode = document.createTextNode("vhs");
      p.appendChild(textNode);
      document.body.appendChild(p);
      // Pretend every glyph occupies a 20×20 box at the origin.
      const rectSpy = vi
        .spyOn(Range.prototype, "getBoundingClientRect")
        .mockReturnValue({
          left: 0,
          right: 20,
          top: 0,
          bottom: 20,
          width: 20,
          height: 20,
        });
      let offset = 0;
      document.caretPositionFromPoint = () => ({
        offsetNode: textNode,
        offset,
      });
      const tapAt = (x, y) =>
        document.dispatchEvent(
          new MouseEvent("click", {
            detail: 1,
            clientX: x,
            clientY: y,
            bubbles: true,
          }),
        );

      // Far outside the box → caret snaps to the text but the tap isn't on it.
      offset = 0;
      tapAt(500, 500);
      expect(toggled).toEqual([]);

      // Inside the box → spells normally.
      offset = 0;
      tapAt(5, 5); // v
      offset = 1;
      tapAt(5, 5); // h
      offset = 2;
      tapAt(5, 5); // s
      expect(toggled).toEqual(["vhs"]);

      rectSpy.mockRestore();
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
