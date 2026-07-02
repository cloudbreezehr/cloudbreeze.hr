import { describe, it, expect, beforeEach, vi } from "vitest";

describe("sky-link/seam", () => {
  let seam;

  beforeEach(async () => {
    vi.resetModules();
    seam = await import("../../../js/sky-link/seam.js");
  });

  it("reports no peers while unbound", () => {
    expect(seam.peerWorldRects()).toEqual([]);
  });

  it("reads live rects from the bound source", () => {
    const rects = [{ x: 100, y: 0, w: 800, h: 600 }];
    seam.setPeerRectsSource(() => rects);
    expect(seam.peerWorldRects()).toEqual(rects);
  });

  it("returns to the no-link default when unbound again", () => {
    seam.setPeerRectsSource(() => [{ x: 0, y: 0, w: 1, h: 1 }]);
    seam.setPeerRectsSource(null);
    expect(seam.peerWorldRects()).toEqual([]);
  });
});
