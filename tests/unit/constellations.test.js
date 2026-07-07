import { describe, it, expect } from "vitest";
import {
  CONSTELLATIONS,
  getConstellation,
  PLANTED_SCALE,
  PLANTED_JITTER,
} from "../../js/constellations.js";

// Pure data + lookup: guard the shape (unique ids, ≥3 finite points per
// pattern) and the null-fallback contract.

describe("constellations", () => {
  it("has unique ids", () => {
    const ids = CONSTELLATIONS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every entry is well-formed", () => {
    for (const c of CONSTELLATIONS) {
      expect(typeof c.id).toBe("string");
      expect(typeof c.name).toBe("string");
      expect(Array.isArray(c.points)).toBe(true);
      expect(c.points.length).toBeGreaterThanOrEqual(3);
      for (const [dx, dy] of c.points) {
        expect(Number.isFinite(dx)).toBe(true);
        expect(Number.isFinite(dy)).toBe(true);
      }
    }
  });

  it("looks up a known constellation by id", () => {
    const c = getConstellation("orions-belt");
    expect(c).not.toBeNull();
    expect(c.name).toBe("Orion's Belt");
  });

  it("returns null for an unknown id", () => {
    expect(getConstellation("nope")).toBeNull();
  });

  it("exposes positive planting constants", () => {
    expect(PLANTED_SCALE).toBeGreaterThan(0);
    expect(PLANTED_JITTER).toBeGreaterThan(0);
  });
});
