import { describe, it, expect, beforeEach, vi } from "vitest";

// The seam holds module-level bindings, so each test gets a fresh import.

describe("sky-link/handoff", () => {
  let seam;

  beforeEach(async () => {
    vi.resetModules();
    seam = await import("../../../js/sky-link/handoff.js");
  });

  it("defaults to no link: offers refused, spawns dropped, probe inactive", () => {
    expect(seam.offerHandoff({ x: 0, y: 0 })).toBe(false);
    expect(() => seam.spawnHandoff({ x: 0, y: 0 })).not.toThrow();
    expect(seam.isLinkActive()).toBe(false);
  });

  it("routes offers through the bound handler", () => {
    const offer = vi.fn(() => true);
    seam.setOfferHandler(offer);
    const exit = { x: 1, y: 2, angle: 0 };
    expect(seam.offerHandoff(exit)).toBe(true);
    expect(offer).toHaveBeenCalledWith(exit);
  });

  it("routes arriving particles to the bound spawner", () => {
    const spawn = vi.fn();
    seam.setSpawner(spawn);
    const star = { x: 5, y: 6, angle: 1 };
    seam.spawnHandoff(star);
    expect(spawn).toHaveBeenCalledWith(star);
  });

  it("reflects the bound link probe", () => {
    seam.setLinkProbe(() => true);
    expect(seam.isLinkActive()).toBe(true);
    seam.setLinkProbe(null);
    expect(seam.isLinkActive()).toBe(false);
  });
});
