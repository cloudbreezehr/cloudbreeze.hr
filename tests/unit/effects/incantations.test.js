import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Incantations is a content + effect-binding module: each word's cast()
// calls a self-contained effect. Mock those effects and assert the wiring;
// the visuals themselves are out of scope for unit tests.

describe("effects/incantations", () => {
  let mod;
  let fireworks;
  let ripple;

  beforeEach(async () => {
    vi.resetModules();
    fireworks = { rockets: [], bursts: [] };
    ripple = { rings: [] };
    vi.doMock("../../../js/effects/fireworks.js", () => ({
      launchRocketFireworks: (opts) => fireworks.rockets.push(opts),
      burstFireworks: (x, y, opts) => fireworks.bursts.push({ x, y, opts }),
    }));
    vi.doMock("../../../js/effects/ripple.js", () => ({
      spawnRipple: (x, y, opts) => ripple.rings.push({ x, y, opts }),
    }));
    mod = await import("../../../js/effects/incantations.js");
  });

  afterEach(() => {
    vi.doUnmock("../../../js/effects/fireworks.js");
    vi.doUnmock("../../../js/effects/ripple.js");
  });

  function cast(word, point) {
    mod.INCANTATIONS.find((i) => i.word === word).cast(point);
  }

  it("exposes words that are matcher-eligible (uppercase, >= 3 letters)", () => {
    expect(mod.INCANTATIONS.length).toBeGreaterThan(0);
    for (const inc of mod.INCANTATIONS) {
      expect(inc.word).toMatch(/^[A-Z]{3,}$/);
      expect(typeof inc.cast).toBe("function");
    }
  });

  it("BOOM launches a rocket volley", () => {
    cast("BOOM");
    expect(fireworks.rockets).toHaveLength(1);
  });

  it("STAR bursts at the cast origin", () => {
    cast("STAR", { x: 10, y: 20 });
    expect(fireworks.bursts[0]).toMatchObject({ x: 10, y: 20 });
  });

  it("PULSE spawns concentric rings at the cast origin", () => {
    cast("PULSE", { x: 5, y: 6 });
    expect(ripple.rings[0]).toMatchObject({ x: 5, y: 6 });
    expect(ripple.rings[0].opts.className).toBe("incantation-ring");
  });
});
