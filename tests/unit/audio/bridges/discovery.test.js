import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The bridge sounds the build-up ramp and the Konami fanfare off the
// achievement stream. sfx is mocked to capture the (name, opts) it would play.

describe("audio/bridges/discovery", () => {
  let calls;
  let stop;

  beforeEach(async () => {
    vi.resetModules();
    calls = [];
    vi.doMock("../../../../js/audio/sfx.js", () => ({
      playSfx: (name, opts) => calls.push({ name, opts }),
    }));
    const mod = await import("../../../../js/audio/bridges/discovery.js");
    stop = mod.initDiscoveryAudioBridge();
  });

  afterEach(() => {
    if (stop) stop();
    vi.doUnmock("../../../../js/audio/sfx.js");
  });

  const fire = (detail) =>
    window.dispatchEvent(new CustomEvent("achievement", { detail }));

  it("ticks the build-up with the threshold as pitch progress", () => {
    fire({
      type: "theme-buildup",
      theme: "frozen",
      threshold: 0.5,
      phase: "activate",
    });
    expect(calls).toEqual([{ name: "buildup", opts: { progress: 0.5 } }]);
  });

  it("ignores build-up on the deactivate phase", () => {
    fire({
      type: "theme-buildup",
      theme: "frozen",
      threshold: 0.5,
      phase: "deactivate",
    });
    expect(calls).toEqual([]);
  });

  it("plays a dry fanfare on the Konami code", () => {
    fire({ type: "konami-cheat" });
    expect(calls).toEqual([{ name: "fanfare", opts: { ui: true } }]);
  });
});
