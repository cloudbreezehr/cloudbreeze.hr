import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { scrollFade, drawTrail, getCanvasCtx } from "../../js/canvas-utils.js";

describe("scrollFade", () => {
  // Canonical trapezoid: fade in 0.1→0.2, hold to 0.8, fade out 0.8→0.9.
  const IN_START = 0.1;
  const IN_END = 0.2;
  const OUT_START = 0.8;
  const OUT_END = 0.9;

  it("returns 0 before the fade-in range", () => {
    expect(scrollFade(0, IN_START, IN_END, OUT_START, OUT_END)).toBe(0);
    expect(scrollFade(0.09, IN_START, IN_END, OUT_START, OUT_END)).toBe(0);
  });

  it("ramps linearly during fade-in", () => {
    expect(scrollFade(0.15, IN_START, IN_END, OUT_START, OUT_END)).toBeCloseTo(
      0.5,
    );
  });

  it("holds at 1 in the plateau", () => {
    expect(scrollFade(0.5, IN_START, IN_END, OUT_START, OUT_END)).toBe(1);
    expect(scrollFade(0.79, IN_START, IN_END, OUT_START, OUT_END)).toBe(1);
  });

  it("ramps linearly during fade-out", () => {
    expect(scrollFade(0.85, IN_START, IN_END, OUT_START, OUT_END)).toBeCloseTo(
      0.5,
    );
  });

  it("returns 0 past the fade-out range", () => {
    expect(scrollFade(0.95, IN_START, IN_END, OUT_START, OUT_END)).toBe(0);
    expect(scrollFade(1, IN_START, IN_END, OUT_START, OUT_END)).toBe(0);
  });

  it("degenerates to instant-on when inStart === inEnd (fade-out-only mode)", () => {
    // Used for stars — visible immediately, fade out later.
    expect(scrollFade(0, 0, 0, 0.2, 0.5)).toBe(1);
    expect(scrollFade(0.35, 0, 0, 0.2, 0.5)).toBeCloseTo(0.5);
    expect(scrollFade(0.5, 0, 0, 0.2, 0.5)).toBe(0);
  });
});

// A lightweight canvas-context stub — drawTrail should call exactly the
// methods below, in a compatible order.  We avoid hand-rolling the full
// CanvasRenderingContext2D API; only what drawTrail touches matters.
function createCtxStub() {
  const grad = { addColorStop: vi.fn() };
  return {
    grad,
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    createLinearGradient: vi.fn(() => grad),
    createRadialGradient: vi.fn(() => grad),
    lineWidth: 0,
    lineCap: "",
    strokeStyle: null,
    fillStyle: null,
    globalCompositeOperation: "",
  };
}

describe("drawTrail", () => {
  const colors = ["10,20,30", "40,50,60", "70,80,90"];

  it("creates a linear gradient from tail to head", () => {
    const ctx = createCtxStub();
    drawTrail(ctx, 100, 100, 40, 40, colors, 0.5, 2);
    expect(ctx.createLinearGradient).toHaveBeenCalledWith(40, 40, 100, 100);
  });

  it("sets gradient stops for tail/mid/head with the supplied colors", () => {
    const ctx = createCtxStub();
    drawTrail(ctx, 0, 0, 0, 0, colors, 1, 1);
    expect(ctx.grad.addColorStop).toHaveBeenCalledTimes(3);
    // Stop 1: tail (opacity 0)
    expect(ctx.grad.addColorStop).toHaveBeenNthCalledWith(
      1,
      0,
      "rgba(10,20,30,0)",
    );
    // Stop 2: mid (opacity * 0.3)
    expect(ctx.grad.addColorStop).toHaveBeenNthCalledWith(
      2,
      0.7,
      "rgba(40,50,60,0.3)",
    );
    // Stop 3: head (full opacity)
    expect(ctx.grad.addColorStop).toHaveBeenNthCalledWith(
      3,
      1,
      "rgba(70,80,90,1)",
    );
  });

  it("strokes a single line segment", () => {
    const ctx = createCtxStub();
    drawTrail(ctx, 10, 10, 0, 0, colors, 1, 4);
    expect(ctx.beginPath).toHaveBeenCalledOnce();
    expect(ctx.moveTo).toHaveBeenCalledWith(0, 0);
    expect(ctx.lineTo).toHaveBeenCalledWith(10, 10);
    expect(ctx.stroke).toHaveBeenCalledOnce();
    expect(ctx.lineWidth).toBe(4);
    expect(ctx.lineCap).toBe("round");
  });

  it("wraps in save/restore so caller state is preserved", () => {
    const ctx = createCtxStub();
    drawTrail(ctx, 1, 1, 0, 0, colors, 0.2, 1);
    expect(ctx.save).toHaveBeenCalledOnce();
    expect(ctx.restore).toHaveBeenCalledOnce();
  });

  it("draws no head halo when headGlow is omitted", () => {
    const ctx = createCtxStub();
    drawTrail(ctx, 10, 10, 0, 0, colors, 1, 2);
    expect(ctx.createRadialGradient).not.toHaveBeenCalled();
    expect(ctx.arc).not.toHaveBeenCalled();
  });

  it("draws an additive hot head when headGlow is supplied", () => {
    const ctx = createCtxStub();
    // Production passes [r,g,b] arrays; the head halo formats colors[2] via
    // rgbaStr, which indexes the array.
    const rgbColors = [
      [10, 20, 30],
      [40, 50, 60],
      [70, 80, 90],
    ];
    drawTrail(ctx, 10, 10, 0, 0, rgbColors, 1, 2, { radius: 5, alpha: 0.8 });
    expect(ctx.createRadialGradient).toHaveBeenCalled();
    expect(ctx.arc).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
    // Additive blend so the head reads as a bright spark over the trail.
    expect(ctx.globalCompositeOperation).toBe("lighter");
  });
});

describe("getCanvasCtx", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("returns the #bg-canvas element and its 2D context", () => {
    const canvas = document.createElement("canvas");
    canvas.id = "bg-canvas";
    document.body.appendChild(canvas);
    const { canvasEl, ctx } = getCanvasCtx();
    expect(canvasEl).toBe(canvas);
    expect(ctx).toBe(canvas.getContext("2d"));
  });

  it("returns the same context across calls (no re-initialization)", () => {
    const canvas = document.createElement("canvas");
    canvas.id = "bg-canvas";
    document.body.appendChild(canvas);
    const a = getCanvasCtx();
    const b = getCanvasCtx();
    expect(a.ctx).toBe(b.ctx);
  });

  it("throws when #bg-canvas is missing", () => {
    expect(() => getCanvasCtx()).toThrow(/bg-canvas/);
  });
});
