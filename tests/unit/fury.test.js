import { describe, it, expect, afterEach, vi } from "vitest";

// Lightning sounds per bolt, not once per tier: a bolt spawns on every click
// while in the lightning tier, so fury plays the voice at each spawn. Guards
// the "only the first strike sounds" bug. sfx is mocked to capture; matchMedia
// drives the reduced-motion gate (fury isn't drawn under RM, so it's silent).

describe("fury — lightning sounds per bolt", () => {
  let calls;
  let createFury;

  async function setup(reducedMotion) {
    vi.resetModules();
    calls = [];
    window.matchMedia = vi.fn((q) => ({
      matches: q.includes("reduce") ? reducedMotion : false,
      media: q,
      addEventListener() {},
      removeEventListener() {},
    }));
    vi.doMock("../../js/audio/sfx.js", () => ({
      playSfx: (name) => calls.push(name),
    }));
    ({ createFury } = await import("../../js/fury.js"));
  }

  afterEach(() => {
    delete window.matchMedia;
    vi.doUnmock("../../js/audio/sfx.js");
    vi.restoreAllMocks();
  });

  // Click well past the lightning tier; each in-tier click spawns (and sounds)
  // a bolt until the pool cap, so a healthy run sounds lightning many times.
  function clickMany(fury, n = 100) {
    const canvas = { width: 1000, height: 800 };
    for (let i = 0; i < n; i++) fury.click(500, 400, canvas, 0);
  }

  it("sounds lightning on more than just the first bolt", async () => {
    await setup(false);
    // Pin RNG above BRANCH_CHANCE so each click spawns exactly one bolt (no
    // branches filling the pool at once) — the bolts don't decay without a
    // draw loop, so this fills the pool one strike per click.
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const fury = createFury();
    clickMany(fury);
    const strikes = calls.filter((c) => c === "lightning").length;
    expect(strikes).toBeGreaterThan(1);
  });

  it("stays silent under reduced motion (fury isn't drawn)", async () => {
    await setup(true);
    const fury = createFury();
    clickMany(fury);
    expect(calls.filter((c) => c === "lightning")).toHaveLength(0);
  });
});
