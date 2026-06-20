import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Beds only build while sound is on, and announce "theme-bed-heard" the moment
// one actually starts — so the achievement credits beds the visitor truly
// heard, including one chosen while sound was off and started when it came on.
// A stub AudioContext stands in for happy-dom's missing Web Audio.

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
  let beds, engine, created, heard, onHeard;

  beforeEach(async () => {
    vi.resetModules();
    localStorage.clear();
    created = { sources: 0 };
    window.AudioContext = stubAudioContext(created);
    engine = await import("../../../js/audio/engine.js");
    beds = await import("../../../js/audio/beds.js");
    beds.initBeds();
    heard = [];
    onHeard = (e) => {
      if (e.detail.type === "theme-bed-heard") heard.push(e.detail.theme);
    };
    window.addEventListener("achievement", onHeard);
  });

  afterEach(() => {
    window.removeEventListener("achievement", onHeard);
    beds._resetForTests();
    engine._resetForTests();
    delete window.AudioContext;
  });

  it("stays silent and uncredited while sound is off", () => {
    beds.setBed("frozen");
    expect(created.sources).toBe(0);
    expect(heard).toEqual([]);
  });

  it("starts and announces a bed when sound is on", () => {
    engine.setSoundEnabled(true);
    beds.setBed("frozen");
    expect(created.sources).toBeGreaterThan(0);
    expect(heard).toEqual(["frozen"]);
  });

  it("honours a bed chosen while off once sound turns on", () => {
    beds.setBed("deep-sea");
    expect(heard).toEqual([]);
    engine.setSoundEnabled(true);
    expect(heard).toEqual(["deep-sea"]);
  });

  it("ignores an unknown theme", () => {
    engine.setSoundEnabled(true);
    beds.setBed("not-a-theme");
    expect(created.sources).toBe(0);
    expect(heard).toEqual([]);
  });
});
