import { describe, it, expect } from "vitest";
import {
  lerpColor,
  multiLerp,
  toRgba,
  resolvePalette,
  palettes,
} from "../../js/colors.js";

describe("lerpColor", () => {
  it("returns the first color at t=0", () => {
    expect(lerpColor([10, 20, 30, 0.5], [50, 60, 70, 1], 0)).toEqual([
      10, 20, 30, 0.5,
    ]);
  });

  it("returns the second color at t=1", () => {
    expect(lerpColor([10, 20, 30, 0.5], [50, 60, 70, 1], 1)).toEqual([
      50, 60, 70, 1,
    ]);
  });

  it("interpolates linearly at t=0.5", () => {
    expect(lerpColor([0, 0, 0, 0], [100, 200, 40, 1], 0.5)).toEqual([
      50, 100, 20, 0.5,
    ]);
  });
});

describe("multiLerp", () => {
  const stops = [
    [0, 0, 0, 1],
    [100, 100, 100, 1],
    [200, 200, 200, 1],
  ];

  it("returns the first stop at p=0", () => {
    expect(multiLerp(stops, 0)).toEqual([0, 0, 0, 1]);
  });

  it("returns the midpoint stop at p=0.5", () => {
    expect(multiLerp(stops, 0.5)).toEqual([100, 100, 100, 1]);
  });

  it("returns the last stop at p=1", () => {
    // p=1 lands at the last segment, fully interpolated → final stop
    expect(multiLerp(stops, 1)).toEqual([200, 200, 200, 1]);
  });

  it("interpolates inside a segment", () => {
    // 0.25 of the way through: halfway between first and second stop
    expect(multiLerp(stops, 0.25)).toEqual([50, 50, 50, 1]);
  });
});

describe("toRgba", () => {
  it("rounds RGB channels and formats alpha to 4 decimals", () => {
    expect(toRgba([12.6, 200.4, 100, 0.5])).toBe("rgba(13,200,100,0.5000)");
  });

  it("handles fully transparent", () => {
    expect(toRgba([0, 0, 0, 0])).toBe("rgba(0,0,0,0.0000)");
  });

  it("handles fully opaque", () => {
    expect(toRgba([255, 255, 255, 1])).toBe("rgba(255,255,255,1.0000)");
  });
});

describe("resolvePalette", () => {
  it("returns the base dark palette when no submode is given", () => {
    const pal = resolvePalette("dark", null);
    expect(pal).toBe(palettes.dark);
  });

  it("falls back to dark when theme is unknown", () => {
    const pal = resolvePalette("nosuch-theme", null);
    expect(pal).toBe(palettes.dark);
  });

  it("overrides base colors with submode overrides", () => {
    const pal = resolvePalette("dark", "frozen");
    // frozen overrides clickColor; base cloudWhite should survive
    expect(pal.clickColor).toEqual([0, 220, 255]);
    expect(pal.cloudWhite).toEqual(palettes.dark.cloudWhite);
  });

  it("returns the base palette when submode has no overrides for the theme", () => {
    // There is no "nothere" override table, so it should pass through.
    const pal = resolvePalette("light", "nothere");
    expect(pal).toEqual(palettes.light);
  });

  it("never mutates the base palette object", () => {
    const before = { ...palettes.dark };
    resolvePalette("dark", "blocky");
    expect(palettes.dark).toEqual(before);
  });
});
