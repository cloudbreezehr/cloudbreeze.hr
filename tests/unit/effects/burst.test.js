import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// spawnRadialBurst scatters `count` transient DOM particles that self-remove
// when their WAAPI animation finishes. happy-dom has no WAAPI, so animate() is
// stubbed to hand back a handle whose onfinish the test can fire; countRange 0
// makes the count deterministic.

describe("effects/burst", () => {
  let mod;
  let finishers;

  beforeEach(async () => {
    vi.resetModules();
    finishers = [];
    Element.prototype.animate = vi.fn(() => {
      const handle = { onfinish: null };
      finishers.push(() => handle.onfinish && handle.onfinish());
      return handle;
    });
    document.body.innerHTML = "";
    mod = await import("../../../js/effects/burst.js");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const opts = (over) => ({
    x: 0,
    y: 0,
    className: "test-burst",
    countMin: 3,
    countRange: 0,
    sizeMin: 2,
    sizeRange: 0,
    distMin: 5,
    distRange: 0,
    durMin: 100,
    durRange: 0,
    ...over,
  });

  it("spawns countMin particles carrying the class, positioned at the origin", () => {
    mod.spawnRadialBurst(opts({ x: 10, y: 20 }));
    const els = document.querySelectorAll(".test-burst");
    expect(els).toHaveLength(3);
    expect(els[0].style.left).toBe("10px");
    expect(els[0].style.top).toBe("20px");
  });

  it("removes each particle when its animation finishes", () => {
    mod.spawnRadialBurst(opts({ countMin: 2 }));
    expect(document.querySelectorAll(".test-burst")).toHaveLength(2);
    finishers.forEach((f) => f());
    expect(document.querySelectorAll(".test-burst")).toHaveLength(0);
  });
});
