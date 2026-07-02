import { describe, it, expect } from "vitest";
import { dayKey, hashString, mulberry32 } from "../../../js/daily/seed.js";

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
