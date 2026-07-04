import { describe, it, expect } from "vitest";
import {
  WORLD_W,
  WORLD_H,
  floorMod,
  viewportDesktopRect,
  worldOrigin,
} from "../../../js/world/space.js";

describe("world/space — floorMod", () => {
  it("wraps positives like the plain modulo", () => {
    expect(floorMod(5, 4)).toBe(1);
    expect(floorMod(0, 4)).toBe(0);
  });

  it("wraps negatives into [0, m)", () => {
    expect(floorMod(-1, 4)).toBe(3);
    expect(floorMod(-8, 4)).toBe(0);
    expect(floorMod(-WORLD_W - 10, WORLD_W)).toBe(WORLD_W - 10);
  });

  it("keeps fractional offsets", () => {
    expect(floorMod(-0.5, 4)).toBeCloseTo(3.5, 9);
  });
});

describe("world/space — viewport geometry", () => {
  const win = {
    screenX: 100,
    screenY: 50,
    outerWidth: 1040,
    innerWidth: 1000,
    outerHeight: 900,
    innerHeight: 800,
  };

  it("derives the viewport rect from window chrome metrics", () => {
    // Chrome splits evenly into side borders; the rest stacks on top.
    expect(viewportDesktopRect(win)).toEqual({
      x: 120,
      y: 130,
      w: 1000,
      h: 800,
    });
  });

  it("reads the world origin off the viewport rect", () => {
    expect(worldOrigin(win)).toEqual({ x: 120, y: 130 });
  });

  it("exposes a fixed sky tile", () => {
    expect(WORLD_W).toBeGreaterThan(0);
    expect(WORLD_H).toBeGreaterThan(0);
  });
});
