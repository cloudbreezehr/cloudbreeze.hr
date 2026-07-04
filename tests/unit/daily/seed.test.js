import { describe, it, expect } from "vitest";
import {
  dayKey,
  hashString,
  hashInts,
  mulberry32,
} from "../../../js/daily/seed.js";

describe("daily/seed", () => {
  it("formats the local calendar date as a stable key", () => {
    expect(dayKey(new Date(2026, 6, 2, 23, 59))).toBe("2026-07-02");
    expect(dayKey(new Date(2026, 0, 5, 0, 0))).toBe("2026-01-05");
  });

  it("hashes strings deterministically and distinctly", () => {
    expect(hashString("2026-07-02")).toBe(hashString("2026-07-02"));
    expect(hashString("2026-07-02")).not.toBe(hashString("2026-07-03"));
  });

  it("produces the same sequence from the same seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it("produces a different sequence from a different seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(43);
    expect([a(), a(), a()]).not.toEqual([b(), b(), b()]);
  });

  it("stays in [0, 1)", () => {
    const rand = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = rand();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("daily/seed — hashInts", () => {
  it("hashes the same inputs to the same 32-bit unsigned value", () => {
    expect(hashInts(1, 2, 3)).toBe(hashInts(1, 2, 3));
    const h = hashInts(7, -3, 123456789);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(2 ** 32);
    expect(Number.isInteger(h)).toBe(true);
  });

  it("changes when any input changes", () => {
    const base = hashInts(5, 10, 100);
    expect(hashInts(6, 10, 100)).not.toBe(base);
    expect(hashInts(5, 11, 100)).not.toBe(base);
    expect(hashInts(5, 10, 101)).not.toBe(base);
  });

  it("is sensitive to input order", () => {
    expect(hashInts(1, 2)).not.toBe(hashInts(2, 1));
  });

  it("distinguishes negative from positive inputs", () => {
    expect(hashInts(-1, 0)).not.toBe(hashInts(1, 0));
    expect(hashInts(-5, -7)).not.toBe(hashInts(5, 7));
  });

  it("keeps inputs beyond 32 bits distinct via their high halves", () => {
    const tick = 107_000_000_000;
    expect(hashInts(tick)).not.toBe(hashInts(tick + 2 ** 32));
  });

  it("spreads values roughly uniformly over [0, 2^32)", () => {
    let sum = 0;
    const n = 1000;
    for (let i = 0; i < n; i++) sum += hashInts(42, i) / 2 ** 32;
    const mean = sum / n;
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
  });
});
