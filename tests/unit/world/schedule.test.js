import { describe, it, expect } from "vitest";
import { tickRoll, tickStream } from "../../../js/world/schedule.js";

const SEED = 0xdecafbad;

describe("world/schedule — tickRoll", () => {
  it("is identical for the same slot, wherever it's computed", () => {
    expect(tickRoll(SEED, 2, -1, 107_000_000_123)).toBe(
      tickRoll(SEED, 2, -1, 107_000_000_123),
    );
  });

  it("stays in [0, 1)", () => {
    for (let t = 0; t < 200; t++) {
      const r = tickRoll(SEED, 0, 0, t);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(1);
    }
  });

  it("differs across seeds, tiles, and ticks", () => {
    const base = tickRoll(SEED, 1, 1, 1000);
    expect(tickRoll(SEED + 1, 1, 1, 1000)).not.toBe(base);
    expect(tickRoll(SEED, 2, 1, 1000)).not.toBe(base);
    expect(tickRoll(SEED, 1, 2, 1000)).not.toBe(base);
    expect(tickRoll(SEED, 1, 1, 1001)).not.toBe(base);
  });

  it("fires a probability gate at roughly the asked-for rate", () => {
    const p = 0.05;
    let hits = 0;
    const n = 20000;
    for (let t = 0; t < n; t++) {
      if (tickRoll(SEED, 3, 4, t) < p) hits++;
    }
    expect(hits / n).toBeGreaterThan(p * 0.7);
    expect(hits / n).toBeLessThan(p * 1.3);
  });
});

describe("world/schedule — tickStream", () => {
  it("replays the same parameter sequence for the same slot", () => {
    const a = tickStream(SEED, 5, 6, 777);
    const b = tickStream(SEED, 5, 6, 777);
    expect([a(), a(), a(), a()]).toEqual([b(), b(), b(), b()]);
  });

  it("gives different sequences to different slots", () => {
    const a = tickStream(SEED, 5, 6, 777);
    const b = tickStream(SEED, 5, 6, 778);
    expect([a(), a(), a()]).not.toEqual([b(), b(), b()]);
  });

  it("is independent of the roll at the same slot", () => {
    // The stream's first draw must not equal the roll — same slot, two
    // separated channels.
    expect(tickStream(SEED, 9, 9, 42)()).not.toBe(tickRoll(SEED, 9, 9, 42));
  });
});
