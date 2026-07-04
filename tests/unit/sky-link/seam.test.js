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

  it("reports no remote pointers while unbound", () => {
    expect(seam.remotePointers()).toEqual([]);
  });

  it("reads live remote pointers from the bound source", () => {
    const ptrs = [
      { id: "a", x: 5, y: 6, active: true, isDragging: true, holdStrength: 1 },
    ];
    seam.setRemotePointersSource(() => ptrs);
    expect(seam.remotePointers()).toEqual(ptrs);
    seam.setRemotePointersSource(null);
    expect(seam.remotePointers()).toEqual([]);
  });

  it("reports no local pointer until the renderer binds one", () => {
    expect(seam.localPointerState()).toBeNull();
  });

  it("reads the local pointer state from the bound source", () => {
    const state = { x: 1, y: 2, active: true, isDragging: false };
    seam.setLocalPointerSource(() => state);
    expect(seam.localPointerState()).toEqual(state);
    seam.setLocalPointerSource(null);
    expect(seam.localPointerState()).toBeNull();
  });
});
