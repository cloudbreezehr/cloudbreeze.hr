import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// upside-down.js's warning overlay used to spawn a fresh element on
// every show, leaving the previous one orphaned in the DOM with a
// duplicate id when a show fired before the prior hide's removal
// timeout completed (commit 8cddc4a).  This test pins the invariant —
// document.querySelectorAll("#ud-warning").length stays ≤ 1 across a
// rapid show → hide → show → wait sequence.
//
// The theme module has heavy dependencies (canvas, particles, trigger
// factory) so we mock them minimally — the warning DOM lifecycle is
// what the test actually exercises.

const noop = () => {};

vi.mock("../../../js/canvas-utils.js", () => ({
  getCanvasCtx: () => ({
    canvasEl: { width: 800, height: 600 },
    ctx: new Proxy(
      {},
      {
        get() {
          return noop;
        },
        set: () => true,
      },
    ),
  }),
  drawHaloParticle: noop,
  drawTrail: noop,
  rgbaStr: () => "rgba(0,0,0,1)",
  scrollFade: () => 1,
}));

vi.mock("../../../js/particles/upside-down.js", () => ({
  createUpsideDown: () => ({
    draw: noop,
    pulseAlignment: noop,
    resizeNeedles: noop,
    cleanup: noop,
  }),
}));

vi.mock("../../../js/themes/canvas-hooks.js", () => ({
  registerCanvasHooks: noop,
}));

vi.mock("../../../js/themes/factory.js", () => ({
  createTheme: () => ({ isActive: false }),
}));

vi.mock("../../../js/themes/triggers.js", () => ({
  createOverscrollTrigger: () => ({ start: noop }),
}));

vi.mock("../../../js/service-cards.js", () => ({
  enableCardEffects: () => () => {},
}));

describe("upside-down warning lifecycle", () => {
  let mod;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.resetModules();
    document.body.innerHTML = "";
    document.body.className = "";
    // Stub the canvas element the theme will look up.
    const canvas = document.createElement("canvas");
    canvas.id = "bg-canvas";
    document.body.appendChild(canvas);
    // Page chrome the theme expects to mutate.
    const page = document.createElement("div");
    page.className = "page";
    document.body.appendChild(page);

    mod = await import("../../../js/themes/upside-down.js");
    mod.initUpsideDown();
  });

  afterEach(() => {
    mod._resetWarningTestHandles();
    vi.useRealTimers();
  });

  function warningCount() {
    return document.querySelectorAll("#ud-warning").length;
  }

  it("never paints more than one #ud-warning across a rapid show/hide/show cycle", () => {
    const { show, hide } = mod._getWarningTestHandles();

    show();
    expect(warningCount()).toBe(1);

    hide();
    // Element stays in the DOM through the fade-out delay, even though
    // .visible has been removed.
    expect(warningCount()).toBe(1);

    // Re-show *during* the fade window — the bug was that this created
    // a second element with the same id.  The fix reuses the existing
    // node.
    show();
    expect(warningCount()).toBe(1);

    // Past the original hide's WARNING_HIDE_DELAY: the reused element
    // is still present because the timeout was cancelled by re-show.
    vi.advanceTimersByTime(10_000);
    expect(warningCount()).toBe(1);

    // Final hide + wait → element actually removed this time.
    hide();
    vi.advanceTimersByTime(10_000);
    expect(warningCount()).toBe(0);
  });

  it("does not duplicate even when a long burst of show/hide alternates", () => {
    const { show, hide } = mod._getWarningTestHandles();
    for (let i = 0; i < 10; i++) {
      show();
      hide();
      vi.advanceTimersByTime(10);
    }
    expect(warningCount()).toBeLessThanOrEqual(1);
  });
});
