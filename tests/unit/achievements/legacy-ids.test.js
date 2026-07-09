import { describe, it, expect } from "vitest";
import {
  LEGACY_IDS,
  resolveLegacyId,
} from "../../../js/achievements/legacy-ids.js";
import { getAchievement } from "../../../js/achievements/registry.js";

describe("achievements/legacy-ids", () => {
  it("maps only onto live achievement ids", () => {
    for (const currentId of Object.keys(LEGACY_IDS)) {
      expect(getAchievement(currentId), currentId).toBeTruthy();
    }
  });

  it("holds former ids no live achievement uses", () => {
    for (const formerIds of Object.values(LEGACY_IDS)) {
      for (const formerId of formerIds) {
        expect(getAchievement(formerId), formerId).toBeNull();
      }
    }
  });

  it("never lists the same former id under two entries", () => {
    const all = Object.values(LEGACY_IDS).flat();
    expect(new Set(all).size).toBe(all.length);
  });

  it("maps former ids to their current id and passes others through", () => {
    for (const [currentId, formerIds] of Object.entries(LEGACY_IDS)) {
      for (const formerId of formerIds) {
        expect(resolveLegacyId(formerId)).toBe(currentId);
      }
    }
    expect(resolveLegacyId("first-light")).toBe("first-light");
    expect(resolveLegacyId("never-existed")).toBe("never-existed");
  });
});
