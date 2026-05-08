import { describe, it, expect } from "vitest";
import {
  ACHIEVEMENTS,
  SETS,
  POINT_TIERS,
  MODE_SETS,
  SET_MASTERY_MAP,
  getAchievement,
  sumPoints,
  getSetPrereqs,
  getAllNonMeta,
  isModeSet,
  getProgressiveAchievements,
} from "../../../js/achievements/registry.js";
import { getModeIds } from "../../../js/modes/registry.js";

describe("achievements/registry — data shape", () => {
  it("every achievement has the required fields", () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.id, a.id).toMatch(/^[a-z0-9-]+$/);
      expect(a.set, a.id).toMatch(/^[a-z0-9-]+$/);
      expect(typeof a.title, a.id).toBe("string");
      expect(a.title.length, a.id).toBeGreaterThan(0);
      expect(typeof a.description, a.id).toBe("string");
      expect(typeof a.points, a.id).toBe("number");
      expect(a.points, a.id).toBeGreaterThanOrEqual(0);
    }
  });

  it("achievement IDs are unique", () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every achievement's set refers to a defined set", () => {
    const setIds = new Set(SETS.map((s) => s.id));
    setIds.add("meta"); // meta set exists implicitly
    for (const a of ACHIEVEMENTS) {
      expect(setIds.has(a.set), `${a.id} -> ${a.set}`).toBe(true);
    }
  });

  it("every achievement's points match a point tier", () => {
    const tierValues = new Set(Object.values(POINT_TIERS));
    for (const a of ACHIEVEMENTS) {
      expect(tierValues.has(a.points), `${a.id} (${a.points})`).toBe(true);
    }
  });
});

describe("MODE_SETS", () => {
  it("matches the modes registry one-for-one", () => {
    expect([...MODE_SETS].sort()).toEqual([...getModeIds()].sort());
  });

  it("SET_MASTERY_MAP has an entry per mode set", () => {
    for (const id of MODE_SETS) {
      expect(SET_MASTERY_MAP[id]).toBeTruthy();
    }
  });

  it("each mastery achievement id actually exists in ACHIEVEMENTS", () => {
    const knownIds = new Set(ACHIEVEMENTS.map((a) => a.id));
    for (const [setId, masteryId] of Object.entries(SET_MASTERY_MAP)) {
      expect(knownIds.has(masteryId), `${setId} -> ${masteryId}`).toBe(true);
    }
  });
});

describe("getAchievement", () => {
  it("returns the definition by id", () => {
    const some = ACHIEVEMENTS[0];
    expect(getAchievement(some.id)).toBe(some);
  });

  it("returns null for unknown ids", () => {
    expect(getAchievement("nope-nope")).toBeNull();
  });
});

describe("sumPoints", () => {
  it("returns 0 for an empty list", () => {
    expect(sumPoints([])).toBe(0);
  });

  it("sums points from real achievement ids", () => {
    const [a, b] = ACHIEVEMENTS;
    expect(sumPoints([{ id: a.id }, { id: b.id }])).toBe(a.points + b.points);
  });

  it("ignores entries whose id isn't in the registry", () => {
    const [a] = ACHIEVEMENTS;
    expect(sumPoints([{ id: a.id }, { id: "bogus" }])).toBe(a.points);
  });
});

describe("getSetPrereqs", () => {
  it("excludes the mastery achievement from the prereq list", () => {
    for (const setId of MODE_SETS) {
      const prereqs = getSetPrereqs(setId);
      const masteryId = SET_MASTERY_MAP[setId];
      expect(prereqs).not.toContain(masteryId);
    }
  });

  it("returns only ids belonging to the requested set", () => {
    for (const setId of MODE_SETS) {
      const prereqs = getSetPrereqs(setId);
      for (const id of prereqs) {
        expect(getAchievement(id).set).toBe(setId);
      }
    }
  });

  it("returns an empty list for unknown sets", () => {
    expect(getSetPrereqs("no-such-set")).toEqual([]);
  });
});

describe("getAllNonMeta", () => {
  it("excludes meta-set achievements", () => {
    const nonMeta = new Set(getAllNonMeta());
    for (const a of ACHIEVEMENTS) {
      if (a.set === "meta") expect(nonMeta.has(a.id)).toBe(false);
      else expect(nonMeta.has(a.id)).toBe(true);
    }
  });
});

describe("isModeSet", () => {
  it("returns true for registered mode sets", () => {
    for (const id of MODE_SETS) expect(isModeSet(id)).toBe(true);
  });

  it("returns false for non-mode sets", () => {
    expect(isModeSet("exploration")).toBe(false);
    expect(isModeSet("meta")).toBe(false);
    expect(isModeSet("made-up")).toBe(false);
  });
});

describe("getProgressiveAchievements", () => {
  it("returns only achievements with a progressKey", () => {
    const progressive = getProgressiveAchievements();
    expect(progressive.length).toBeGreaterThan(0);
    for (const a of progressive) expect(a.progressKey).toBeTruthy();
  });
});
