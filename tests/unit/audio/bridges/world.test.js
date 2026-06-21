import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The bridge maps the discrete canvas-internal effects (orbit, fury tiers) to
// voices. sfx is mocked to capture what it would play. Lightning (per-bolt in
// fury) and the gravity-well hum (continuous) are handled elsewhere.

describe("audio/bridges/world", () => {
  let calls;
  let stop;

  beforeEach(async () => {
    vi.resetModules();
    calls = [];
    vi.doMock("../../../../js/audio/sfx.js", () => ({
      playSfx: (name) => calls.push(name),
    }));
    const mod = await import("../../../../js/audio/bridges/world.js");
    stop = mod.initWorldAudioBridge();
  });

  afterEach(() => {
    if (stop) stop();
    vi.doUnmock("../../../../js/audio/sfx.js");
  });

  const fire = (type) =>
    window.dispatchEvent(new CustomEvent("achievement", { detail: { type } }));

  it("sounds the orbit a hold spins up", () => {
    fire("orbit");
    expect(calls).toEqual(["orbit"]);
  });

  it("sounds the aurora and meteor tiers once each", () => {
    fire("fury-aurora");
    fire("fury-meteor");
    expect(calls).toEqual(["aurora", "meteor"]);
  });

  it("leaves lightning and the well to their own handlers", () => {
    fire("fury-lightning"); // per-bolt in fury.js
    fire("hold"); // continuous well hum in continuous.js
    fire("well-activate");
    expect(calls).toEqual([]);
  });

  it("ignores events it doesn't map", () => {
    fire("scroll");
    fire("panel-open");
    expect(calls).toEqual([]);
  });
});
