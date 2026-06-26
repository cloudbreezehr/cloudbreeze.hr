import { describe, it, expect } from "vitest";
import { createShakeDetector } from "../../../js/effects/shake.js";

describe("effects/shake — createShakeDetector", () => {
  const THRESHOLD = 24;
  const COOLDOWN = 1400;
  const detector = () =>
    createShakeDetector({ threshold: THRESHOLD, cooldownMs: COOLDOWN });

  it("does not fire on the first reading (no prior to compare)", () => {
    const d = detector();
    expect(d.feed(0, 0, 0, 0)).toBe(false);
  });

  it("fires when the reading jumps past the threshold", () => {
    const d = detector();
    d.feed(0, 0, 0, 0);
    expect(d.feed(30, 0, 0, 100)).toBe(true); // delta 30 > 24
  });

  it("ignores gentle movement below the threshold", () => {
    const d = detector();
    d.feed(0, 0, 0, 0);
    expect(d.feed(5, 5, 5, 100)).toBe(false); // delta 15 < 24
  });

  it("holds off a second fire until the cooldown passes", () => {
    const d = detector();
    d.feed(0, 0, 0, 0);
    expect(d.feed(40, 0, 0, 100)).toBe(true);
    // Another big jolt during the cooldown is swallowed.
    expect(d.feed(0, 0, 0, 100 + COOLDOWN / 2)).toBe(false);
    // Past the cooldown it fires again.
    expect(d.feed(40, 0, 0, 100 + COOLDOWN + 50)).toBe(true);
  });

  it("ignores readings with null axes (sensor returned nothing)", () => {
    const d = detector();
    d.feed(0, 0, 0, 0);
    expect(d.feed(null, null, null, 100)).toBe(false);
  });
});
