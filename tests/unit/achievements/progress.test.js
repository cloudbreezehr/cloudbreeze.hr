import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  THEME_SETS,
  getReachableAchievements,
  isBonus,
} from "../../../js/achievements/registry.js";

// progress.js computes "current / total" for each progressive achievement.
// These tests poke the underlying storage through the same module imports
// so we go through the real API surface.

describe("achievements/progress", () => {
  let progress;
  let storage;

  beforeEach(async () => {
    localStorage.clear();
    vi.resetModules();
    progress = await import("../../../js/achievements/progress.js");
    storage = await import("../../../js/achievements/storage.js");
  });

  describe("isCollectionProgress", () => {
    it("returns true for the known collection keys", () => {
      expect(progress.isCollectionProgress("appearances-used")).toBe(true);
      expect(progress.isCollectionProgress("quadrants-clicked")).toBe(true);
      expect(progress.isCollectionProgress("themes-activated")).toBe(true);
      expect(progress.isCollectionProgress("idle-animations")).toBe(true);
    });

    it("returns false for count-based progress keys", () => {
      expect(progress.isCollectionProgress("unlocks-5")).toBe(false);
      expect(progress.isCollectionProgress("points-100")).toBe(false);
      expect(progress.isCollectionProgress("nothing")).toBe(false);
    });
  });

  describe("resolveProgressTotal — collection", () => {
    it("returns 3 for appearances-used", () => {
      expect(progress.resolveProgressTotal("appearances-used")).toBe(3);
    });

    it("returns 4 for quadrants-clicked", () => {
      expect(progress.resolveProgressTotal("quadrants-clicked")).toBe(4);
    });

    it("returns one per theme for themes-activated", () => {
      expect(progress.resolveProgressTotal("themes-activated")).toBe(
        THEME_SETS.length,
      );
    });

    it("returns 0 for unknown progress keys", () => {
      expect(progress.resolveProgressTotal("unknown")).toBe(0);
    });
  });

  describe("resolveProgressCurrent — collection", () => {
    it("returns 0 when nothing has been collected", () => {
      expect(progress.resolveProgressCurrent("appearances-used")).toBe(0);
    });

    it("counts unique items added via storage.addProgressItem", () => {
      storage.addProgressItem("appearances-used", "dark");
      storage.addProgressItem("appearances-used", "light");
      expect(progress.resolveProgressCurrent("appearances-used")).toBe(2);
    });
  });

  describe("resolveProgressCurrent — counts", () => {
    it("appearance-toggles-3 reads the appearanceToggles counter", () => {
      storage.setCounter("appearanceToggles", 2);
      expect(progress.resolveProgressCurrent("appearance-toggles-3")).toBe(2);
      expect(progress.resolveProgressTotal("appearance-toggles-3")).toBe(3);
    });

    it("unlocks-5 reads the total unlock count", () => {
      storage.unlock("a");
      storage.unlock("b");
      expect(progress.resolveProgressCurrent("unlocks-5")).toBe(2);
      expect(progress.resolveProgressTotal("unlocks-5")).toBe(5);
    });

    it("points-100 aggregates points of unlocked non-meta achievements", () => {
      // Unlock "cloudlog-activated" (UNCOMMON = 10 points per registry).
      storage.unlock("cloudlog-activated");
      expect(progress.resolveProgressCurrent("points-100")).toBe(10);
      expect(progress.resolveProgressTotal("points-100")).toBe(100);
    });

    it("jellyfish-pulses reads the jellyfishPulses counter", () => {
      storage.setCounter("jellyfishPulses", 3);
      expect(progress.resolveProgressCurrent("jellyfish-pulses")).toBe(3);
    });

    it("click milestones read totalClicks against their thresholds", () => {
      storage.setCounter("totalClicks", 750);
      expect(progress.resolveProgressCurrent("clicks-1000")).toBe(750);
      expect(progress.resolveProgressTotal("clicks-1000")).toBe(
        progress.COMMITTED_CLICKS,
      );
      expect(progress.resolveProgressCurrent("clicks-10000")).toBe(750);
      expect(progress.resolveProgressTotal("clicks-10000")).toBe(
        progress.DEVOTED_CLICKS,
      );
    });

    it("beyond-100 spans the core plus a single bonus slot", () => {
      const core = getReachableAchievements().filter((a) => !isBonus(a));
      expect(progress.resolveProgressTotal("beyond-100")).toBe(core.length + 1);
      // Core unlocks fill the bar one by one…
      storage.unlock("first-light");
      expect(progress.resolveProgressCurrent("beyond-100")).toBe(1);
      // …while every bonus found fills the same single extra slot.
      storage.unlock("moonstruck");
      storage.unlock("star-shower");
      expect(progress.resolveProgressCurrent("beyond-100")).toBe(2);
    });

    it("beyond-100's bonus slot ignores overachiever itself", () => {
      storage.unlock("overachiever");
      expect(progress.resolveProgressCurrent("beyond-100")).toBe(0);
    });

    it("beyond-100 completes at full core plus any one bonus", () => {
      for (const a of getReachableAchievements()) {
        if (!isBonus(a)) storage.unlock(a.id);
      }
      expect(progress.resolveProgressCurrent("beyond-100")).toBe(
        progress.resolveProgressTotal("beyond-100") - 1,
      );
      storage.unlock("moonstruck");
      expect(progress.resolveProgressCurrent("beyond-100")).toBe(
        progress.resolveProgressTotal("beyond-100"),
      );
    });

    it("whole-sky spans every reachable achievement except itself", () => {
      expect(progress.resolveProgressTotal("whole-sky")).toBe(
        getReachableAchievements().length - 1,
      );
      storage.unlock("first-light");
      storage.unlock("the-whole-sky");
      expect(progress.resolveProgressCurrent("whole-sky")).toBe(1);
    });

    it("whole-sky completes once everything else reachable is unlocked", () => {
      for (const a of getReachableAchievements()) {
        if (a.id !== "the-whole-sky") storage.unlock(a.id);
      }
      expect(progress.resolveProgressCurrent("whole-sky")).toBe(
        progress.resolveProgressTotal("whole-sky"),
      );
    });
  });
});
