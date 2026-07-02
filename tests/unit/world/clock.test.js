import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  TICK_HZ,
  TICK_MS,
  worldTick,
  worldTickTime,
  tickToMs,
} from "../../../js/world/clock.js";

describe("world/clock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("derives the tick length from the tick rate", () => {
    expect(TICK_MS * TICK_HZ).toBeCloseTo(1000, 9);
  });

  it("reads the same tick for any instant inside one tick window", () => {
    const tick = worldTick(0);
    expect(worldTick(TICK_MS / 2)).toBe(tick);
    expect(worldTick(TICK_MS + 1)).toBe(tick + 1);
  });

  it("advances by the tick rate every second", () => {
    vi.setSystemTime(0);
    const before = worldTick();
    // Half a tick of slack — exactly 1000ms lands on a tick boundary, where
    // float division can round to either side.
    vi.advanceTimersByTime(1000 + TICK_MS / 2);
    expect(worldTick()).toBe(before + TICK_HZ);
  });

  it("agrees across independent readers given the same instant", () => {
    // The shared-epoch property: no negotiation, just the same wall clock.
    const nowMs = 1_780_000_000_000;
    expect(worldTick(nowMs)).toBe(worldTick(nowMs));
    expect(worldTickTime(nowMs)).toBe(worldTickTime(nowMs));
  });

  it("keeps the fractional tick consistent with the integer tick", () => {
    const nowMs = 123456;
    expect(Math.floor(worldTickTime(nowMs))).toBe(worldTick(nowMs));
  });

  it("round-trips a tick through its start-of-tick milliseconds", () => {
    const tick = worldTick(987654321);
    expect(worldTick(tickToMs(tick))).toBe(tick);
  });
});
