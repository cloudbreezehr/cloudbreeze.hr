import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The bridge maps the dev console's dedicated dock window events to voices.
// sfx is mocked to capture what it would play.

describe("audio/bridges/dock", () => {
  let calls;
  let stop;

  beforeEach(async () => {
    vi.resetModules();
    calls = [];
    vi.doMock("../../../../js/audio/sfx.js", () => ({
      playSfx: (name) => calls.push(name),
    }));
    const mod = await import("../../../../js/audio/bridges/dock.js");
    stop = mod.initDockAudioBridge();
  });

  afterEach(() => {
    if (stop) stop();
    vi.doUnmock("../../../../js/audio/sfx.js");
  });

  const fire = (type) => window.dispatchEvent(new CustomEvent(type));

  it("shivers on magnet, snaps on dock, peels on release", () => {
    fire("dock-magnet");
    fire("dock-snap");
    fire("dock-release");
    expect(calls).toEqual(["shimmer", "snap", "unsnap"]);
  });

  it("stops listening after cleanup", () => {
    stop();
    stop = null;
    fire("dock-magnet");
    fire("dock-snap");
    expect(calls).toEqual([]);
  });
});
