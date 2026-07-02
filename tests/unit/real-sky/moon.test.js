import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The renderer's contract: the moon renders during the visitor's night,
// stays out of the daytime sky, and fades out with the stars on scroll. The
// canvas is a recording stub — fill calls are the observable. (Whether the
// moon is revealed at all is the caller's business, not this module's.)

function makeRecordingCtx() {
  const calls = [];
  const gradient = { addColorStop() {} };
  return {
    calls,
    ctx: new Proxy(
      {},
      {
        get(_, prop) {
          if (prop === "calls") return calls;
          if (
            prop === "createRadialGradient" ||
            prop === "createLinearGradient"
          ) {
            return () => gradient;
          }
          return (...args) => {
            calls.push([prop, args]);
          };
        },
        set: () => true,
      },
    ),
  };
}

describe("real-sky/moon", () => {
  let layer;

  beforeEach(async () => {
    vi.useFakeTimers();
    window.matchMedia = vi.fn(() => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    }));
    vi.resetModules();
    const mod = await import("../../../js/real-sky/moon.js");
    layer = mod.createMoon();
  });

  afterEach(() => {
    vi.useRealTimers();
    delete window.matchMedia;
  });

  const canvas = { width: 1920, height: 1080 };
  const pal = { starColor: "220,230,255" };

  function drawAt(localDate) {
    vi.setSystemTime(localDate);
    const { ctx, calls } = makeRecordingCtx();
    layer.draw(ctx, canvas, 0, pal);
    return calls;
  }

  it("draws the moon at local midnight", () => {
    // 2026-01-01 23:30 local — deep night at any temperate location, and
    // the moon is ~95% lit that night.
    const calls = drawAt(new Date(2026, 0, 1, 23, 30));
    expect(calls.some(([name]) => name === "fill")).toBe(true);
    expect(calls.some(([name]) => name === "ellipse")).toBe(true);
  });

  it("stays out of the midday sky", () => {
    const calls = drawAt(new Date(2026, 5, 21, 12, 0));
    expect(calls.length).toBe(0);
  });

  it("fades out with the stars as the page scrolls", () => {
    vi.setSystemTime(new Date(2026, 0, 1, 23, 30));
    const { ctx, calls } = makeRecordingCtx();
    // Past the stars' fade window nothing should render.
    layer.draw(ctx, canvas, 1, pal);
    expect(calls.length).toBe(0);
  });
});
