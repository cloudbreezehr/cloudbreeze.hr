import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createVhs,
  drawCursorTrail,
  TRAIL,
} from "../../../js/particles/vhs.js";

// Fake palette with the three cursor channels populated. Distinct
// colors per channel so tests can identify which channel painted
// which strokes.
const PAL = {
  cursorPhosphor: [10, 20, 30],
  cursorPhosphorMagenta: [40, 50, 60],
  cursorPhosphorCyan: [70, 80, 90],
};

// Spy ctx — records every operation in `calls` so a test can assert on
// counts, ordering, or specific arguments. Methods that don't matter to
// the trail (drawImage, fillRect, save, restore) are still spied so a
// regression in unrelated draw paths surfaces as an unexpected call.
function makeSpyCtx() {
  const calls = [];
  const record = (name) => {
    return (...args) => calls.push({ name, args });
  };
  return {
    save: record("save"),
    restore: record("restore"),
    beginPath: record("beginPath"),
    moveTo: record("moveTo"),
    lineTo: record("lineTo"),
    stroke: record("stroke"),
    drawImage: record("drawImage"),
    fillRect: record("fillRect"),
    arc: record("arc"),
    fill: record("fill"),
    set globalAlpha(v) {
      calls.push({ name: "globalAlpha=", args: [v] });
    },
    set strokeStyle(v) {
      calls.push({ name: "strokeStyle=", args: [v] });
    },
    set fillStyle(v) {
      calls.push({ name: "fillStyle=", args: [v] });
    },
    set lineWidth(v) {
      calls.push({ name: "lineWidth=", args: [v] });
    },
    set lineCap(v) {
      calls.push({ name: "lineCap=", args: [v] });
    },
    set lineJoin(v) {
      calls.push({ name: "lineJoin=", args: [v] });
    },
    _calls: calls,
  };
}

function makeFakeCanvas() {
  const ctx = makeSpyCtx();
  return {
    width: 400,
    height: 300,
    getContext: () => ctx,
    _ctx: ctx,
  };
}

// happy-dom canvases don't return a 2D context, but createVhs allocates
// an offscreen phosphor canvas via document.createElement("canvas").
// Patch createElement so the offscreen canvas gets a spy ctx too —
// otherwise drawAfter throws inside the phosphor pipeline before it
// reaches the trail step.
function patchOffscreenCanvas() {
  const original = document.createElement.bind(document);
  document.createElement = (tag) => {
    if (tag === "canvas") {
      return {
        width: 0,
        height: 0,
        getContext: () => makeSpyCtx(),
      };
    }
    return original(tag);
  };
  return () => {
    document.createElement = original;
  };
}

describe("drawCursorTrail", () => {
  let ctx;
  beforeEach(() => {
    ctx = makeSpyCtx();
  });

  it("no-ops on empty history", () => {
    drawCursorTrail(ctx, [], PAL);
    expect(ctx._calls.filter((c) => c.name === "stroke")).toHaveLength(0);
  });

  it("no-ops on a single-point history (need at least one segment)", () => {
    drawCursorTrail(ctx, [{ x: 50, y: 50 }], PAL);
    expect(ctx._calls.filter((c) => c.name === "stroke")).toHaveLength(0);
  });

  it("no-ops when the palette is missing the cursor channels", () => {
    drawCursorTrail(
      ctx,
      [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      {},
    );
    expect(ctx._calls.filter((c) => c.name === "stroke")).toHaveLength(0);
  });

  it("draws three channels (magenta, cyan, green) per segment", () => {
    const history = [
      { x: 10, y: 10 },
      { x: 20, y: 20 },
      { x: 30, y: 30 },
    ];
    drawCursorTrail(ctx, history, PAL);

    const segments = history.length - 1;
    const channels = 3;
    expect(ctx._calls.filter((c) => c.name === "stroke")).toHaveLength(
      segments * channels,
    );
  });

  it("offsets the magenta and cyan channels horizontally by FRINGE_OFFSET_PX", () => {
    const history = [
      { x: 100, y: 50 },
      { x: 100, y: 60 },
    ];
    drawCursorTrail(ctx, history, PAL);

    // The moveTo / lineTo for each channel is shifted in x.  Pull them
    // out and verify the offset matches the constant.
    const moves = ctx._calls.filter((c) => c.name === "moveTo");
    expect(moves).toHaveLength(3);
    // Channels are issued magenta, cyan, green (so the green core paints
    // last on top).
    expect(moves[0].args[0]).toBe(100 - TRAIL.FRINGE_OFFSET_PX);
    expect(moves[1].args[0]).toBe(100 + TRAIL.FRINGE_OFFSET_PX);
    expect(moves[2].args[0]).toBe(100); // green core, no offset
  });

  it("interpolates segment width from TAIL_WIDTH_PX (oldest) to HEAD_WIDTH_PX (newest)", () => {
    // Use enough points that head/tail widths are distinguishable.
    const history = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
      { x: 30, y: 0 },
      { x: 40, y: 0 },
    ];
    drawCursorTrail(ctx, history, PAL);

    const widths = ctx._calls
      .filter((c) => c.name === "lineWidth=")
      .map((c) => c.args[0]);
    // 4 segments × 3 channels = 12 width writes. Each channel writes
    // width per segment in tail→head order, so for a single channel:
    //   widths[0] is the closest-to-tail segment, widths[3] is the head.
    // Pull the first channel's writes (every 4th value, offset 0).
    const segs = history.length - 1;
    const firstChannelWidths = [];
    for (let i = 0; i < segs; i++) firstChannelWidths.push(widths[i]);
    // Strictly increasing tail → head.
    for (let i = 1; i < firstChannelWidths.length; i++) {
      expect(firstChannelWidths[i]).toBeGreaterThan(firstChannelWidths[i - 1]);
    }
    // Head segment uses the head-width constant; first segment is between
    // tail-width and head-width but never the tail value exactly (because
    // t = (i+1)/segs, never 0).
    expect(firstChannelWidths[firstChannelWidths.length - 1]).toBeCloseTo(
      TRAIL.HEAD_WIDTH_PX,
      5,
    );
  });

  it("paints fringe channels at FRINGE_ALPHA_FACTOR of the core alpha", () => {
    const history = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    drawCursorTrail(ctx, history, PAL);

    const styles = ctx._calls
      .filter((c) => c.name === "strokeStyle=")
      .map((c) => c.args[0]);
    expect(styles).toHaveLength(3);
    // Parse alpha from `rgba(r,g,b,a)` strings — the third value (index
    // 2) is the green core, which should have alpha ≈ HEAD_ALPHA. The
    // first two are fringes at HEAD_ALPHA × FRINGE_ALPHA_FACTOR.
    const alpha = (s) => parseFloat(s.match(/,([\d.]+)\)$/)[1]);
    const headAlpha = TRAIL.HEAD_ALPHA;
    const fringeAlpha = headAlpha * TRAIL.FRINGE_ALPHA_FACTOR;
    expect(alpha(styles[0])).toBeCloseTo(fringeAlpha, 3);
    expect(alpha(styles[1])).toBeCloseTo(fringeAlpha, 3);
    expect(alpha(styles[2])).toBeCloseTo(headAlpha, 3);
  });

  it("skips segments whose alpha computes to zero", () => {
    // Default TAIL_ALPHA is 0; the very first segment's alpha is
    // therefore very small but the formula uses (i+1)/segments — for
    // segments=1 this is t=1, which gives full head alpha. Verify that
    // a single-segment polyline still issues exactly 3 strokes (not 0).
    const history = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    drawCursorTrail(ctx, history, PAL);
    expect(ctx._calls.filter((c) => c.name === "stroke")).toHaveLength(3);
  });

  it("emits the green core after the fringes so it paints on top", () => {
    const history = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ];
    drawCursorTrail(ctx, history, PAL);

    // Fish out the strokeStyle calls in order — the third should
    // reference the cursorPhosphor color (green core), not the magenta
    // or cyan fringes.
    const styles = ctx._calls
      .filter((c) => c.name === "strokeStyle=")
      .map((c) => c.args[0]);
    expect(styles[2]).toContain("10,20,30"); // PAL.cursorPhosphor
    expect(styles[0]).toContain("40,50,60"); // PAL.cursorPhosphorMagenta
    expect(styles[1]).toContain("70,80,90"); // PAL.cursorPhosphorCyan
  });
});

describe("createVhs — cursor history buffer", () => {
  let unpatch;
  beforeEach(() => {
    unpatch = patchOffscreenCanvas();
  });
  afterEach(() => {
    unpatch();
  });

  it("recordCursor appends positions in order", () => {
    const fakeCanvas = makeFakeCanvas();
    const vhs = createVhs(fakeCanvas);

    vhs.recordCursor(10, 20);
    vhs.recordCursor(30, 40);
    vhs.recordCursor(50, 60);

    // Inspect via drawCursorTrail — easier than exposing the buffer
    // directly. Three points → 2 segments × 3 channels = 6 strokes.
    const ctx = makeSpyCtx();
    vhs.drawAfter(ctx, PAL);

    expect(ctx._calls.filter((c) => c.name === "stroke")).toHaveLength(6);
  });

  it("recordCursor caps the history at TRAIL.HISTORY_LEN", () => {
    const fakeCanvas = makeFakeCanvas();
    const vhs = createVhs(fakeCanvas);

    // Push more than the cap with each call moving by enough to avoid
    // the dedupe.
    const overflow = TRAIL.HISTORY_LEN + 5;
    for (let i = 0; i < overflow; i++) vhs.recordCursor(i * 10, 100);

    const ctx = makeSpyCtx();
    vhs.drawAfter(ctx, PAL);

    // History capped at HISTORY_LEN points → (HISTORY_LEN - 1) segments
    // per channel × 3 channels.
    const expectedStrokes = (TRAIL.HISTORY_LEN - 1) * 3;
    expect(ctx._calls.filter((c) => c.name === "stroke")).toHaveLength(
      expectedStrokes,
    );
  });

  it("recordCursor dedupes samples within MIN_SAMPLE_DIST_SQ_PX", () => {
    const fakeCanvas = makeFakeCanvas();
    const vhs = createVhs(fakeCanvas);

    vhs.recordCursor(100, 100);
    // Tiny jitter (squared distance < MIN_SAMPLE_DIST_SQ_PX = 1) — this
    // should NOT get added.
    vhs.recordCursor(100.5, 100);
    vhs.recordCursor(100, 100);
    // A meaningful move clears the threshold.
    vhs.recordCursor(120, 100);

    const ctx = makeSpyCtx();
    vhs.drawAfter(ctx, PAL);

    // Only two stored points → 1 segment × 3 channels = 3 strokes.
    expect(ctx._calls.filter((c) => c.name === "stroke")).toHaveLength(3);
  });

  it("clearCursor empties the buffer so subsequent draws produce no trail", () => {
    const fakeCanvas = makeFakeCanvas();
    const vhs = createVhs(fakeCanvas);

    vhs.recordCursor(10, 10);
    vhs.recordCursor(20, 20);
    vhs.recordCursor(30, 30);
    vhs.clearCursor();

    const ctx = makeSpyCtx();
    vhs.drawAfter(ctx, PAL);

    expect(ctx._calls.filter((c) => c.name === "stroke")).toHaveLength(0);
  });

  it("cleanup empties the buffer", () => {
    const fakeCanvas = makeFakeCanvas();
    const vhs = createVhs(fakeCanvas);

    vhs.recordCursor(10, 10);
    vhs.recordCursor(20, 20);
    vhs.cleanup();

    const ctx = makeSpyCtx();
    vhs.drawAfter(ctx, PAL);

    expect(ctx._calls.filter((c) => c.name === "stroke")).toHaveLength(0);
  });
});

describe("createVhs.drawAfter — phosphor + trail integration", () => {
  let unpatch;
  beforeEach(() => {
    unpatch = patchOffscreenCanvas();
  });
  afterEach(() => {
    unpatch();
  });

  it("trail is rendered after the phosphor capture so it paints on top of the ghost overlay", () => {
    const fakeCanvas = makeFakeCanvas();
    const vhs = createVhs(fakeCanvas);
    vhs.recordCursor(10, 10);
    vhs.recordCursor(20, 20);

    const ctx = makeSpyCtx();
    vhs.drawAfter(ctx, PAL);

    // Find the indices of the phosphor capture (drawImage of the canvas
    // back into the phosphor) and the first trail stroke. The trail must
    // come after capture so the trail isn't pulled into the phosphor's
    // recursive decay.
    const captureIdx = ctx._calls.findIndex((c) => c.name === "drawImage");
    const firstStrokeIdx = ctx._calls.findIndex((c) => c.name === "stroke");
    expect(captureIdx).toBeGreaterThanOrEqual(0);
    expect(firstStrokeIdx).toBeGreaterThan(captureIdx);
  });

  it("renders no trail when pal is omitted", () => {
    const fakeCanvas = makeFakeCanvas();
    const vhs = createVhs(fakeCanvas);
    vhs.recordCursor(10, 10);
    vhs.recordCursor(20, 20);

    const ctx = makeSpyCtx();
    vhs.drawAfter(ctx); // no pal

    expect(ctx._calls.filter((c) => c.name === "stroke")).toHaveLength(0);
  });
});
