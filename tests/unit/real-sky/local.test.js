import { describe, it, expect } from "vitest";
import {
  HOME_LOCATION,
  estimatedLocation,
  localDayPhase,
} from "../../../js/real-sky/local.js";

// The location is a parameter (default: the home town) so a different place can
// be plugged in later. These pin the parameterization: latitude comes from the
// given location, longitude from the clock (which already tracks the visitor).

describe("real-sky/local", () => {
  it("defaults the reference latitude to the home town", () => {
    expect(estimatedLocation(new Date()).latDeg).toBe(HOME_LOCATION.latDeg);
  });

  it("borrows the latitude of whatever location it's given", () => {
    const loc = { latDeg: -33.87, lonDeg: 151.21, label: "Sydney" };
    expect(estimatedLocation(new Date(), loc).latDeg).toBe(loc.latDeg);
  });

  it("derives longitude from the clock's offset, not the location's own", () => {
    const est = estimatedLocation(new Date(), {
      latDeg: 0,
      lonDeg: 12345, // absurd on purpose — must not leak through
      label: "nowhere",
    });
    expect(est.lonDeg).not.toBe(12345);
    expect(typeof est.lonDeg).toBe("number");
  });

  it("localDayPhase returns a valid phase for the given location", () => {
    expect(["day", "golden", "twilight", "night"]).toContain(
      localDayPhase(new Date(), HOME_LOCATION),
    );
  });
});
