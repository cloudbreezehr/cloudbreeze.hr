import { describe, it, expect, beforeEach, vi } from "vitest";

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
      expect(progress.isCollectionProgress("themes-used")).toBe(true);
      expect(progress.isCollectionProgress("quadrants-clicked")).toBe(true);
      expect(progress.isCollectionProgress("modes-activated")).toBe(true);
      expect(progress.isCollectionProgress("idle-animations")).toBe(true);
    });

    it("returns false for count-based progress keys", () => {
      expect(progress.isCollectionProgress("unlocks-5")).toBe(false);
      expect(progress.isCollectionProgress("points-100")).toBe(false);
      expect(progress.isCollectionProgress("nothing")).toBe(false);
    });
  });

  describe("resolveProgressTotal — collection", () => {
    it("returns 3 for themes-used", () => {
      expect(progress.resolveProgressTotal("themes-used")).toBe(3);
    });

    it("returns 4 for quadrants-clicked", () => {
      expect(progress.resolveProgressTotal("quadrants-clicked")).toBe(4);
    });

    it("returns 6 for modes-activated (one per mode)", () => {
      expect(progress.resolveProgressTotal("modes-activated")).toBe(6);
    });

    it("returns 0 for unknown progress keys", () => {
      expect(progress.resolveProgressTotal("unknown")).toBe(0);
    });
  });

  describe("resolveProgressCurrent — collection", () => {
    it("returns 0 when nothing has been collected", () => {
      expect(progress.resolveProgressCurrent("themes-used")).toBe(0);
    });

    it("counts unique items added via storage.addProgressItem", () => {
      storage.addProgressItem("themes-used", "dark");
      storage.addProgressItem("themes-used", "light");
      expect(progress.resolveProgressCurrent("themes-used")).toBe(2);
    });
  });

  describe("resolveProgressCurrent — counts", () => {
    it("theme-toggles-3 reads the themeToggles counter", () => {
      storage.setCounter("themeToggles", 2);
      expect(progress.resolveProgressCurrent("theme-toggles-3")).toBe(2);
      expect(progress.resolveProgressTotal("theme-toggles-3")).toBe(3);
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
  });
});
