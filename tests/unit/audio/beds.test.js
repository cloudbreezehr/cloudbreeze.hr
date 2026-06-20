import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Beds exist only for the two ambient worlds (rainy, deep-sea) and build only
// while sound is on — including one chosen while sound was off and started when
// it came on. A stub AudioContext stands in for happy-dom's missing Web Audio
// and tallies the buffer sources a bed creates.

function stubAudioContext(created) {
  const param = () => ({
    value: 0,
    setValueAtTime() {},
    exponentialRampToValueAtTime() {},
    cancelScheduledValues() {},
  });
  const node = (extra = {}) => ({ connect() {}, disconnect() {}, ...extra });
  return vi.fn(function () {
    this.currentTime = 0;
    this.sampleRate = 44100;
    this.state = "suspended";
    this.destination = {};
    this.resume = () => {};
    this.suspend = () => {};
    this.createGain = () => node({ gain: param() });
    this.createDynamicsCompressor = () =>
      node({ threshold: param(), knee: param(), ratio: param() });
    this.createBiquadFilter = () =>
      node({ type: "", frequency: param(), Q: { value: 0 } });
    this.createOscillator = () =>
      node({ type: "", frequency: param(), start() {}, stop() {} });
    this.createBufferSource = () => {
      created.sources++;
      return node({
        buffer: null,
        loop: false,
        start() {},
        stop() {},
        onended: null,
      });
    };
    this.createBuffer = (_ch, len) => ({
      getChannelData: () => new Float32Array(len),
    });
  });
}

describe("audio/beds", () => {
  let beds, engine, created;

  beforeEach(async () => {
    vi.resetModules();
    localStorage.clear();
    created = { sources: 0 };
    window.AudioContext = stubAudioContext(created);
    engine = await import("../../../js/audio/engine.js");
    beds = await import("../../../js/audio/beds.js");
    beds.initBeds();
  });

  afterEach(() => {
    beds._resetForTests();
    engine._resetForTests();
    delete window.AudioContext;
  });

  it("stays silent while sound is off", () => {
    beds.setBed("rainy");
    expect(created.sources).toBe(0);
  });

  it("starts an ambient bed when sound is on", () => {
    engine.setSoundEnabled(true);
    beds.setBed("rainy");
    expect(created.sources).toBeGreaterThan(0);
  });

  it("honours a bed chosen while off once sound turns on", () => {
    beds.setBed("deep-sea");
    expect(created.sources).toBe(0);
    engine.setSoundEnabled(true);
    expect(created.sources).toBeGreaterThan(0);
  });

  it("has no bed for non-ambient themes", () => {
    engine.setSoundEnabled(true);
    beds.setBed("frozen");
    expect(created.sources).toBe(0);
  });

  it("ignores an unknown theme", () => {
    engine.setSoundEnabled(true);
    beds.setBed("not-a-theme");
    expect(created.sources).toBe(0);
  });
});
