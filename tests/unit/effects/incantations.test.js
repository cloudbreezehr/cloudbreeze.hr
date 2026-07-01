import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Incantations is a content + effect-binding module: each word's cast()
// calls a self-contained effect. Mock those effects and assert the wiring;
// the visuals themselves are out of scope for unit tests.

describe("effects/incantations", () => {
  let mod;
  let fireworks;
  let ripple;
  let streaks;
  let confetti;
  let flashes;
  let shakes;

  beforeEach(async () => {
    vi.resetModules();
    fireworks = { rockets: [], bursts: [] };
    ripple = { rings: [] };
    streaks = [];
    confetti = [];
    flashes = [];
    shakes = [];
    vi.doMock("../../../js/effects/fireworks.js", () => ({
      launchRocketFireworks: (opts) => fireworks.rockets.push(opts),
      burstFireworks: (x, y, opts) => fireworks.bursts.push({ x, y, opts }),
    }));
    vi.doMock("../../../js/effects/ripple.js", () => ({
      spawnRipple: (x, y, opts) => ripple.rings.push({ x, y, opts }),
    }));
    vi.doMock("../../../js/effects/streak.js", () => ({
      streak: (opts) => streaks.push(opts),
    }));
    vi.doMock("../../../js/effects/confetti.js", () => ({
      confettiBurst: (opts) => confetti.push(opts),
    }));
    vi.doMock("../../../js/effects/flash.js", () => ({
      screenFlash: (opts) => flashes.push(opts),
    }));
    vi.doMock("../../../js/effects/screen-shake.js", () => ({
      screenShake: (opts) => shakes.push(opts),
    }));
    mod = await import("../../../js/effects/incantations.js");
  });

  afterEach(() => {
    vi.doUnmock("../../../js/effects/fireworks.js");
    vi.doUnmock("../../../js/effects/ripple.js");
    vi.doUnmock("../../../js/effects/streak.js");
    vi.doUnmock("../../../js/effects/confetti.js");
    vi.doUnmock("../../../js/effects/flash.js");
    vi.doUnmock("../../../js/effects/screen-shake.js");
  });

  function cast(word, origin, charge) {
    mod.INCANTATIONS.find((i) => i.word === word).cast(origin, charge);
  }

  it("exposes words that are matcher-eligible (uppercase, >= 3 letters)", () => {
    expect(mod.INCANTATIONS.length).toBeGreaterThan(0);
    for (const inc of mod.INCANTATIONS) {
      expect(inc.word).toMatch(/^[A-Z]{3,}$/);
      expect(typeof inc.cast).toBe("function");
    }
  });

  it("exports the full word set for the collector achievement", () => {
    expect(mod.INCANTATION_WORDS).toEqual(mod.INCANTATIONS.map((i) => i.word));
  });

  it("gives every entry a hint (the cheatsheet renders it)", () => {
    for (const inc of mod.INCANTATIONS) {
      expect(inc.hint, inc.word).toBeTruthy();
    }
  });

  it("pairs chargeChar with a numeric chargeMax, and the char is in the word", () => {
    for (const inc of mod.INCANTATIONS) {
      // A chargeChar without a chargeMax would charge unbounded and make
      // `overkill` unreachable (maxed compares against undefined); guard both.
      expect(Boolean(inc.chargeChar), inc.word).toBe(inc.chargeMax != null);
      if (inc.chargeChar) {
        expect(inc.word, inc.word).toContain(inc.chargeChar);
        expect(typeof inc.chargeMax(), inc.word).toBe("number");
      }
    }
  });

  it("BOOM launches a rocket volley", () => {
    cast("BOOM");
    expect(fireworks.rockets).toHaveLength(1);
  });

  it("BOOM fires more rockets the more it's charged", () => {
    cast("BOOM", null, 0);
    cast("BOOM", null, 4);
    expect(fireworks.rockets[1].count).toBeGreaterThan(
      fireworks.rockets[0].count,
    );
  });

  it("BOOM caps its extra rockets", () => {
    cast("BOOM", null, 0);
    cast("BOOM", null, 9999);
    const capped = fireworks.rockets[1].count;
    cast("BOOM", null, 10000);
    expect(fireworks.rockets[2].count).toBe(capped);
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

  it("METEOR streaks downward from the origin with the meteor voice", () => {
    cast("METEOR", { x: 1, y: 2 });
    expect(streaks[0].sound).toBe("meteor");
    expect(streaks[0].angle).toBeGreaterThan(0); // falling, not arcing up
  });

  it("SUPERNOVA detonates and rings out with the shockwave voice", () => {
    cast("SUPERNOVA", { x: 3, y: 4 }, 0);
    expect(fireworks.bursts[0]).toMatchObject({ x: 3, y: 4 });
    expect(ripple.rings[0].opts.sound).toBe("shockwave");
  });

  it("SUPERNOVA's shock ring grows with charge, up to the cap", () => {
    cast("SUPERNOVA", { x: 0, y: 0 }, 0);
    cast("SUPERNOVA", { x: 0, y: 0 }, 9999);
    const capped = ripple.rings[1].opts.maxScale;
    expect(capped).toBeGreaterThan(ripple.rings[0].opts.maxScale);
    cast("SUPERNOVA", { x: 0, y: 0 }, 100000);
    expect(ripple.rings[2].opts.maxScale).toBe(capped);
  });

  it("ECHO echoes staggered rings with the echo voice", () => {
    cast("ECHO", { x: 7, y: 8 });
    expect(ripple.rings[0]).toMatchObject({ x: 7, y: 8 });
    expect(ripple.rings[0].opts.sound).toBe("echo");
    expect(ripple.rings[0].opts.staggerMs).toBeGreaterThan(0);
  });

  it("BLOOM scatters round petals from the origin with the bloom voice", () => {
    cast("BLOOM", { x: 9, y: 10 });
    expect(confetti[0].sound).toBe("bloom");
    expect(confetti[0].round).toBe(true);
    expect(confetti[0].origin).toMatchObject({ x: 9, y: 10 });
  });

  it("DRIP rains round drops with the drop voice", () => {
    cast("DRIP");
    expect(confetti[0].sound).toBe("drop");
    expect(confetti[0].round).toBe(true);
    expect(confetti[0].origin).toBeUndefined(); // falls from the top, not a burst
  });

  it("AURORA washes the page with the shimmer-pad voice", () => {
    cast("AURORA");
    expect(flashes[0].sound).toBe("aurora");
    expect(flashes[0].color).toBe("#5affc4");
  });

  it("SHATTER cracks (flash carries the sound) and jolts silently", () => {
    cast("SHATTER");
    expect(flashes[0].sound).toBe("shatter");
    expect(shakes).toHaveLength(1);
    expect(shakes[0].sound).toBeNull();
  });
});
