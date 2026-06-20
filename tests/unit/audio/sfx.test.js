import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Synthesis itself is low-ROI to assert (it makes sound, not data), so this
// covers the contract: silent when off, runs end-to-end against a Web Audio
// shape when on, and ignores unknown voices. A stub AudioContext stands in for
// happy-dom's missing Web Audio and tallies the nodes each voice builds.

function stubAudioContext(created) {
  const param = () => ({
    value: 0,
    setValueAtTime() {},
    exponentialRampToValueAtTime() {},
  });
  const node = (extra = {}) => ({ connect() {}, disconnect() {}, ...extra });
  return vi.fn(function () {
    this.currentTime = 0;
    this.sampleRate = 44100;
    this.state = "suspended";
    this.destination = {};
    this.resume = () => {
      this.state = "running";
    };
    this.suspend = () => {
      this.state = "suspended";
    };
    this.createGain = () => node({ gain: param() });
    this.createDynamicsCompressor = () =>
      node({ threshold: param(), knee: param(), ratio: param() });
    this.createBiquadFilter = () =>
      node({ type: "", frequency: param(), Q: { value: 0 } });
    this.createOscillator = () => {
      created.oscillators++;
      return node({
        type: "",
        frequency: param(),
        start() {},
        stop() {},
        onended: null,
      });
    };
    this.createBufferSource = () => {
      created.sources++;
      return node({ buffer: null, start() {}, stop() {}, onended: null });
    };
    this.createBuffer = (_ch, len) => ({
      getChannelData: () => new Float32Array(len),
    });
  });
}

describe("audio/sfx", () => {
  let sfx, engine, created;

  beforeEach(async () => {
    vi.resetModules();
    localStorage.clear();
    created = { oscillators: 0, sources: 0 };
    window.AudioContext = stubAudioContext(created);
    engine = await import("../../../js/audio/engine.js");
    sfx = await import("../../../js/audio/sfx.js");
  });

  afterEach(() => {
    engine._resetForTests();
    delete window.AudioContext;
  });

  it("builds nothing when sound is off", () => {
    sfx.playSfx("boom");
    expect(created.oscillators + created.sources).toBe(0);
  });

  it("synthesises a known voice when enabled", () => {
    engine.setSoundEnabled(true);
    expect(() => sfx.playSfx("boom")).not.toThrow();
    expect(created.oscillators + created.sources).toBeGreaterThan(0);
  });

  it("ignores an unknown voice", () => {
    engine.setSoundEnabled(true);
    sfx.playSfx("definitely-not-a-voice");
    expect(created.oscillators + created.sources).toBe(0);
  });
});
