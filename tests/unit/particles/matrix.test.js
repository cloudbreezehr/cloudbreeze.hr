import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Column is the matrix code-rain stream. Like every canvas particle its fall
// goes through scaled()/chance(), so reduced motion must freeze it. matchMedia
// is stubbed to drive prefersReducedMotion(); resetModules so motion re-reads it.

describe("Column — matrix code-rain", () => {
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

  const CELL = 16;
  const HEIGHT = 480;

  it("does not fall when motion is reduced", async () => {
    mqlMatches = true;
    const { Column } = await import("../../../js/particles/matrix.js");
    const col = new Column(HEIGHT / CELL);
    const head0 = col.head;
    col.update(CELL, HEIGHT);
    col.update(CELL, HEIGHT);
    expect(col.head).toBe(head0);
    expect(col.acc).toBe(0);
    expect(col.stepped).toBe(false);
  });

  it("accumulates and falls under full motion", async () => {
    mqlMatches = false;
    const { Column } = await import("../../../js/particles/matrix.js");
    const col = new Column(HEIGHT / CELL);
    const head0 = col.head;
    col.update(CELL, HEIGHT);
    expect(col.head > head0 || col.acc > 0).toBe(true);
  });

  it("falls further in a frame when the speed multiplier is raised", async () => {
    mqlMatches = false;
    const { Column } = await import("../../../js/particles/matrix.js");
    const slow = new Column(HEIGHT / CELL);
    const fast = new Column(HEIGHT / CELL);
    // Pin identical state so only the multiplier differs.
    slow.head = fast.head = 0;
    slow.speed = fast.speed = 2;
    slow.acc = fast.acc = 0;
    slow.update(CELL, HEIGHT, 1);
    fast.update(CELL, HEIGHT, 4);
    const progress = (col) => col.head * CELL + col.acc;
    expect(progress(fast)).toBeGreaterThan(progress(slow));
  });
});
