import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The bridge taps a soft click off the click-burst event canvas.js dispatches.
// sfx is mocked to capture what it would play.

describe("audio/bridges/pointer", () => {
  let calls;
  let stop;

  beforeEach(async () => {
    vi.resetModules();
    calls = [];
    vi.doMock("../../../../js/audio/sfx.js", () => ({
      playSfx: (name, opts) => calls.push({ name, opts }),
      panForX: (x) => x, // identity stub — just proves the x flows through
    }));
    const mod = await import("../../../../js/audio/bridges/pointer.js");
    stop = mod.initPointerAudioBridge();
  });

  afterEach(() => {
    if (stop) stop();
    vi.doUnmock("../../../../js/audio/sfx.js");
  });

  it("taps on a world click that drew the default burst, panned to its x", () => {
    window.dispatchEvent(
      new CustomEvent("achievement", {
        detail: { type: "click-burst", x: 42 },
      }),
    );
    expect(calls).toEqual([{ name: "click", opts: { pan: 42 } }]);
  });

  it("stays silent when a theme suppressed the default burst", () => {
    window.dispatchEvent(
      new CustomEvent("achievement", {
        detail: { type: "click-burst", suppressDefault: true },
      }),
    );
    expect(calls).toEqual([]);
  });

  it("ignores unrelated events", () => {
    window.dispatchEvent(
      new CustomEvent("achievement", { detail: { type: "drag" } }),
    );
    expect(calls).toEqual([]);
  });
});
