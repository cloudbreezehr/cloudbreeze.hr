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
      const osc = node({
        type: "",
        frequency: param(),
        detune: param(),
        start() {},
        stop() {},
        onended: null,
      });
      if (created.oscNodes) created.oscNodes.push(osc);
      return osc;
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
    created = { oscillators: 0, sources: 0, oscNodes: [] };
    window.AudioContext = stubAudioContext(created);
    engine = await import("../../../js/audio/engine.js");
    sfx = await import("../../../js/audio/sfx.js");
  });

  afterEach(() => {
    engine._resetForTests();
    delete window.AudioContext;
  });

  it("builds nothing when sound is off", () => {
    sfx.playSfx("burst");
    expect(created.oscillators + created.sources).toBe(0);
  });

  it("synthesises a known voice when enabled", () => {
    engine.setSoundEnabled(true);
    expect(() => sfx.playSfx("burst")).not.toThrow();
    expect(created.oscillators + created.sources).toBeGreaterThan(0);
  });

  it("ignores an unknown voice", () => {
    engine.setSoundEnabled(true);
    sfx.playSfx("definitely-not-a-voice");
    expect(created.oscillators + created.sources).toBe(0);
  });

  it("jitters a repeat voice's pitch coherently so repeats don't machine-gun", () => {
    // Pin the random shift so the offset is deterministic and nonzero.
    vi.spyOn(Math, "random").mockReturnValue(0);
    engine.setSoundEnabled(true);
    sfx.playSfx("twinkle");
    const detunes = created.oscNodes.map((o) => o.detune.value);
    // The voice shifted off its rest pitch...
    expect(detunes.some((v) => v !== 0)).toBe(true);
    // ...and every pitched tone shares the one offset, so the chime stays in
    // tune with itself rather than each partial wandering independently.
    const nonzero = detunes.filter((v) => v !== 0);
    expect(new Set(nonzero).size).toBe(1);
    Math.random.mockRestore();
  });

  it("stays silent when remembered on but no gesture has unlocked audio", async () => {
    // A persisted "on" preference makes sound enabled at load, but the browser
    // forbids audio until a gesture — so playback must build nothing (and thus
    // never trip the autoplay warning) until then.
    localStorage.setItem("sound", "on");
    vi.resetModules();
    const created2 = { oscillators: 0, sources: 0 };
    window.AudioContext = stubAudioContext(created2);
    const engine2 = await import("../../../js/audio/engine.js");
    const sfx2 = await import("../../../js/audio/sfx.js");

    expect(engine2.isSoundEnabled()).toBe(true);
    expect(engine2.isAudioUnlocked()).toBe(false);
    sfx2.playSfx("burst");
    expect(created2.oscillators + created2.sources).toBe(0);

    engine2._resetForTests();
  });
});
