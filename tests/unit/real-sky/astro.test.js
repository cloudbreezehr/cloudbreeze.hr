import { describe, it, expect } from "vitest";
import {
  solarDeclinationDeg,
  solarElevationDeg,
  dayPhase,
  moonPhase,
  activeMeteorShower,
  seasonalMoment,
  METEOR_SHOWERS,
} from "../../../js/real-sky/astro.js";

// Sanity-checks the celestial math against well-known reference moments —
// solstice declination, the J2000 new-moon epoch, shower peak nights. The
// target is "a human looking up would agree", so assertions use generous
// tolerances, not ephemeris precision.

const PULA_LAT = 44.8666;
const PULA_LON = 13.8496;

describe("real-sky/astro — sun", () => {
  it("puts the midsummer midday sun high over Pula", () => {
    // Solar noon in Pula is ~11:05 UTC; expected elevation ≈ 90 − 44.9 + 23.4.
    const noon = new Date(Date.UTC(2026, 5, 21, 11, 0));
    expect(solarElevationDeg(noon, PULA_LAT, PULA_LON)).toBeGreaterThan(60);
  });

  it("puts the midnight sun far below the horizon", () => {
    const midnight = new Date(Date.UTC(2026, 5, 21, 23, 0));
    expect(solarElevationDeg(midnight, PULA_LAT, PULA_LON)).toBeLessThan(-10);
  });

  it("classifies day and night phases from elevation", () => {
    expect(
      dayPhase(new Date(Date.UTC(2026, 5, 21, 11, 0)), PULA_LAT, PULA_LON),
    ).toBe("day");
    expect(
      dayPhase(new Date(Date.UTC(2026, 5, 21, 23, 0)), PULA_LAT, PULA_LON),
    ).toBe("night");
  });

  it("tracks the declination through the seasons", () => {
    const june = solarDeclinationDeg(new Date(Date.UTC(2026, 5, 21, 12, 0)));
    const december = solarDeclinationDeg(
      new Date(Date.UTC(2026, 11, 21, 12, 0)),
    );
    expect(june).toBeGreaterThan(23.3);
    expect(december).toBeLessThan(-23.3);
  });
});

describe("real-sky/astro — moon", () => {
  const EPOCH = Date.UTC(2000, 0, 6, 18, 14);
  const MS_PER_DAY = 86400000;
  const HALF_SYNODIC_DAYS = 14.765;

  it("is new at the reference epoch", () => {
    const { illumination, isFull } = moonPhase(new Date(EPOCH));
    expect(illumination).toBeLessThan(0.01);
    expect(isFull).toBe(false);
  });

  it("is full half a synodic month later", () => {
    const full = new Date(EPOCH + HALF_SYNODIC_DAYS * MS_PER_DAY);
    const { illumination, isFull } = moonPhase(full);
    expect(illumination).toBeGreaterThan(0.97);
    expect(isFull).toBe(true);
  });

  it("waxes in the first half of the cycle and wanes in the second", () => {
    expect(moonPhase(new Date(EPOCH + 7 * MS_PER_DAY)).waxing).toBe(true);
    expect(moonPhase(new Date(EPOCH + 20 * MS_PER_DAY)).waxing).toBe(false);
  });
});

describe("real-sky/astro — meteor showers", () => {
  it("peaks the Perseids on their peak night", () => {
    const peak = activeMeteorShower(new Date(Date.UTC(2026, 7, 12)));
    expect(peak).toMatchObject({ id: "perseids", intensity: 1 });
  });

  it("ramps intensity down away from the peak", () => {
    const near = activeMeteorShower(new Date(Date.UTC(2026, 7, 9)));
    expect(near.id).toBe("perseids");
    expect(near.intensity).toBeGreaterThan(0);
    expect(near.intensity).toBeLessThan(1);
  });

  it("is quiet outside every shower window", () => {
    expect(activeMeteorShower(new Date(Date.UTC(2026, 2, 1)))).toBeNull();
  });

  it("keeps each shower's peak inside its window", () => {
    for (const s of METEOR_SHOWERS) {
      const doy = ([m, d]) => m * 31 + d;
      expect(doy(s.peak)).toBeGreaterThanOrEqual(doy(s.start));
      expect(doy(s.peak)).toBeLessThanOrEqual(doy(s.end));
    }
  });
});

describe("real-sky/astro — seasonal moments", () => {
  it("detects the June solstice from the declination extreme", () => {
    expect(seasonalMoment(new Date(Date.UTC(2026, 5, 21, 12, 0)))).toBe(
      "solstice",
    );
  });

  it("detects the March equinox from the zero crossing", () => {
    expect(seasonalMoment(new Date(Date.UTC(2026, 2, 20, 15, 0)))).toBe(
      "equinox",
    );
  });

  it("returns null on an ordinary day", () => {
    expect(seasonalMoment(new Date(Date.UTC(2026, 4, 5, 12, 0)))).toBeNull();
  });
});
