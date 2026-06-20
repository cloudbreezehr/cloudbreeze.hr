import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The bridge maps canvas-internal effect events (gravity well, orbit, fury
// tiers) to voices. sfx is mocked to capture what it would play.

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

  it("sounds the gravity-well arc", () => {
    fire("hold");
    fire("well-activate");
    fire("well-full");
    fire("well-release");
    expect(calls).toEqual(["charge", "wellEngage", "wellFull", "wellRelease"]);
  });

  it("sounds the fury tiers", () => {
    fire("fury-lightning");
    fire("fury-aurora");
    fire("fury-meteor");
    expect(calls).toEqual(["lightning", "aurora", "meteor"]);
  });

  it("ignores events it doesn't map", () => {
    fire("scroll");
    fire("panel-open");
    expect(calls).toEqual([]);
  });
});
