import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// HalftoneDot is the pop-art halftone dot. Like every canvas particle its
// motion (scatter + spring) goes through scaled(), so reduced motion must
// freeze it. matchMedia is stubbed to drive prefersReducedMotion();
// resetModules so motion re-reads it.

describe("HalftoneDot — wanted pop-art", () => {
  let mqlMatches;

  beforeEach(() => {
    mqlMatches = false;
    window.matchMedia = vi.fn(() => ({
      get matches() {
        return mqlMatches;
      },
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
    vi.resetModules();
  });

  afterEach(() => {
    delete window.matchMedia;
  });

  // A click impulse landing right next to the dot, strong enough to scatter it.
  function clickForces() {
    return {
      clickImpulse: { x: 60, y: 60, strength: 6 },
      isDragging: false,
      dragPos: { x: 0, y: 0 },
      holdStrength: 0,
      wellStrength: 0,
    };
  }

  it("does not move when motion is reduced", async () => {
    mqlMatches = true;
    const { HalftoneDot } = await import("../../../js/particles/wanted.js");
    const dot = new HalftoneDot(100, 100, 5);
    dot.update(clickForces());
    dot.update(clickForces());
    expect(dot.x).toBe(100);
    expect(dot.y).toBe(100);
  });

  it("scatters from a click under full motion", async () => {
    mqlMatches = false;
    const { HalftoneDot } = await import("../../../js/particles/wanted.js");
    const dot = new HalftoneDot(100, 100, 5);
    dot.update(clickForces());
    expect(dot.x !== 100 || dot.y !== 100).toBe(true);
  });
});
