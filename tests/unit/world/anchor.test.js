import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The regime probe and crossfade tracker read the live peer-rect seam and an
// injectable clock, so both are exercised without a real link or real time.

describe("world/anchor", () => {
  let seam;
  let anchor;

  beforeEach(async () => {
    window.matchMedia = vi.fn(() => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }));
    vi.resetModules();
    seam = await import("../../../js/sky-link/seam.js");
    anchor = await import("../../../js/world/anchor.js");
  });

  afterEach(() => {
    seam.setPeerRectsSource(null);
    delete window.matchMedia;
  });

  const peer = { x: 0, y: 0, w: 800, h: 600 };
  const linkUp = () => seam.setPeerRectsSource(() => [peer]);
  const unlink = () => seam.setPeerRectsSource(() => []);

  it("reports the world regime off the live peer-rect seam", () => {
    expect(anchor.isWorldAnchored()).toBe(false);
    linkUp();
    expect(anchor.isWorldAnchored()).toBe(true);
  });

  it("holds blend at 1 while the regime is settled", () => {
    const blend = anchor.createAnchorBlend();
    expect(blend(0)).toEqual({ anchored: false, blend: 1 });
    expect(blend(10_000)).toEqual({ anchored: false, blend: 1 });
  });

  it("ramps blend 0→1 over LINK_BLEND_MS after a link flip", () => {
    const ms = anchor.ANCHOR.LINK_BLEND_MS;
    const blend = anchor.createAnchorBlend();
    blend(0); // settle solo
    linkUp();
    // The flip frame restarts the crossfade clock at the outgoing layout.
    expect(blend(0)).toEqual({ anchored: true, blend: 0 });
    expect(blend(ms / 2).blend).toBeCloseTo(0.5, 5);
    expect(blend(ms).blend).toBe(1);
    expect(blend(ms + 1).blend).toBe(1);
  });

  it("re-arms the crossfade on unlink", () => {
    const ms = anchor.ANCHOR.LINK_BLEND_MS;
    const blend = anchor.createAnchorBlend();
    linkUp();
    blend(0); // flip to anchored
    blend(ms); // settle anchored
    unlink();
    const flip = blend(ms + 100);
    expect(flip).toEqual({ anchored: false, blend: 0 });
    expect(blend(ms + 100 + ms).blend).toBe(1);
  });

  it("collapses the crossfade to instant under reduced motion", () => {
    const blend = anchor.createAnchorBlend();
    linkUp();
    expect(blend(0, true)).toEqual({ anchored: true, blend: 1 });
  });
});
