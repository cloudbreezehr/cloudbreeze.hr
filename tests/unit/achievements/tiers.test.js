import { describe, it, expect } from "vitest";
import {
  TIERS,
  POINT_TIERS,
  rarityTierFor,
} from "../../../js/achievements/tiers.js";

describe("achievements/tiers", () => {
  describe("POINT_TIERS", () => {
    it("maps each tier's uppercased name to its points", () => {
      for (const t of TIERS) {
        expect(POINT_TIERS[t.name.toUpperCase()]).toEqual(t.points);
      }
    });

    it("carries the full ladder up to Celestial", () => {
      expect(POINT_TIERS.LEGENDARY).toEqual(100);
      expect(POINT_TIERS.MYTHIC).toEqual(500);
      expect(POINT_TIERS.CELESTIAL).toEqual(1000);
    });

    it("is frozen so callers can't mutate it", () => {
      expect(Object.isFrozen(POINT_TIERS)).toBe(true);
    });
  });

  describe("TIERS", () => {
    it("is ordered by ascending points (rarityTierFor relies on it)", () => {
      for (let i = 1; i < TIERS.length; i++) {
        expect(TIERS[i].points).toBeGreaterThan(TIERS[i - 1].points);
      }
    });
  });

  describe("rarityTierFor", () => {
    it("returns null below the first fanfare tier", () => {
      expect(rarityTierFor(POINT_TIERS.EPIC - 1)).toBeNull();
      expect(rarityTierFor(POINT_TIERS.RARE)).toBeNull();
    });

    it("returns epic at the epic threshold", () => {
      expect(rarityTierFor(POINT_TIERS.EPIC)).toEqual("epic");
      expect(rarityTierFor(POINT_TIERS.LEGENDARY - 1)).toEqual("epic");
    });

    it("returns legendary at the legendary threshold", () => {
      expect(rarityTierFor(POINT_TIERS.LEGENDARY)).toEqual("legendary");
      expect(rarityTierFor(POINT_TIERS.MYTHIC - 1)).toEqual("legendary");
    });

    it("returns mythic at the mythic threshold", () => {
      expect(rarityTierFor(POINT_TIERS.MYTHIC)).toEqual("mythic");
      expect(rarityTierFor(POINT_TIERS.CELESTIAL - 1)).toEqual("mythic");
    });

    it("returns celestial at the celestial threshold", () => {
      expect(rarityTierFor(POINT_TIERS.CELESTIAL)).toEqual("celestial");
    });
  });
});
