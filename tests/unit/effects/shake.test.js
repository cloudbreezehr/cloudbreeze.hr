import { describe, it, expect } from "vitest";
import { createShakeDetector } from "../../../js/effects/shake.js";

// A shake is several distinct jerks within a window — not a single jolt (which
// is all that tilting or lifting the phone produces). Readings alternate the
// axis value so each consecutive delta clears the threshold.
describe("effects/shake — createShakeDetector", () => {
  const params = {
    threshold: 24,
    jerkGapMs: 100,
    jerksRequired: 4,
    windowMs: 1200,
    cooldownMs: 1400,
  };
  const make = () => createShakeDetector(params);

  it("does not fire on a single jolt (a tilt or lift)", () => {
    const d = make();
    d.feed(0, 0, 0, 0);
    expect(d.feed(50, 0, 0, 100)).toBe(false); // one jerk — nowhere near enough
  });

  it("fires once enough distinct jerks land within the window", () => {
    const d = make();
    d.feed(0, 0, 0, 0);
    expect(d.feed(50, 0, 0, 100)).toBe(false); // 1
    expect(d.feed(0, 0, 0, 200)).toBe(false); // 2
    expect(d.feed(50, 0, 0, 300)).toBe(false); // 3
    expect(d.feed(0, 0, 0, 400)).toBe(true); // 4 → deliberate shake
  });

  it("collapses the many readings inside one swing into a single jerk", () => {
    const d = make();
    d.feed(0, 0, 0, 0);
    // Big deltas every 10ms all fall inside one 100ms gap → one jerk, no fire.
    for (let i = 1; i <= 9; i++) {
      expect(d.feed(i % 2 ? 50 : 0, 0, 0, i * 10)).toBe(false);
    }
  });

  it("does not fire when the jerks are spread beyond the window", () => {
    const d = make();
    d.feed(0, 0, 0, 0);
    expect(d.feed(50, 0, 0, 100)).toBe(false); // jerk 1
    expect(d.feed(0, 0, 0, 500)).toBe(false); // 2
    expect(d.feed(50, 0, 0, 900)).toBe(false); // 3
    // By 1400ms the first jerk has aged out of the 1200ms window, so the run
    // never holds four at once.
    expect(d.feed(0, 0, 0, 1400)).toBe(false);
  });

  it("ignores gentle movement below the threshold", () => {
    const d = make();
    d.feed(0, 0, 0, 0);
    expect(d.feed(5, 5, 5, 100)).toBe(false); // delta 15 < 24
  });

  it("holds off another shake until the cooldown passes", () => {
    const d = make();
    d.feed(0, 0, 0, 0);
    d.feed(50, 0, 0, 100);
    d.feed(0, 0, 0, 200);
    d.feed(50, 0, 0, 300);
    expect(d.feed(0, 0, 0, 400)).toBe(true); // first shake

    // A fresh run of jerks during the cooldown is swallowed.
    d.feed(50, 0, 0, 500);
    d.feed(0, 0, 0, 600);
    d.feed(50, 0, 0, 700);
    expect(d.feed(0, 0, 0, 800)).toBe(false);

    // Past the cooldown, a fresh run fires again.
    d.feed(50, 0, 0, 1900);
    d.feed(0, 0, 0, 2000);
    d.feed(50, 0, 0, 2100);
    expect(d.feed(0, 0, 0, 2200)).toBe(true);
  });

  it("ignores readings with null axes (sensor returned nothing)", () => {
    const d = make();
    d.feed(0, 0, 0, 0);
    expect(d.feed(null, null, null, 100)).toBe(false);
  });
});
