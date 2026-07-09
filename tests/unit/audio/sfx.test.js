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
  const node = (extra = {}) => ({
    connect() {},
    disconnect: vi.fn(),
    ...extra,
  });
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
    this.createGain = () => {
      const g = node({ gain: param() });
      if (created.gainNodes) created.gainNodes.push(g);
      return g;
    };
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
      const src = node({ buffer: null, start() {}, stop() {}, onended: null });
      if (created.sourceNodes) created.sourceNodes.push(src);
      return src;
    };
    this.createStereoPanner = () => {
      const p = node({ pan: param() });
      if (created.panners) created.panners.push(p);
      return p;
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
    created = {
      oscillators: 0,
      sources: 0,
      oscNodes: [],
      sourceNodes: [],
      gainNodes: [],
      panners: [],
    };
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

  // The wrapper is the first gain playSfx creates for a call — but the
  // engine builds its shared buses lazily inside the first call, so prime
  // that once and snapshot the node tallies before the play under test.
  function playTracked(name, opts) {
    sfx.playSfx("uiTick");
    const gainsBefore = created.gainNodes.length;
    const oscBefore = created.oscNodes.length;
    const srcsBefore = created.sourceNodes.length;
    sfx.playSfx(name, opts);
    return {
      wrapper: created.gainNodes[gainsBefore],
      sources: [
        ...created.oscNodes.slice(oscBefore),
        ...created.sourceNodes.slice(srcsBefore),
      ],
    };
  }

  it("frees the per-call wrapper gain and panner once every source ends", () => {
    engine.setSoundEnabled(true);
    const { wrapper, sources } = playTracked("burst", { pan: 0.5 });
    const panner = created.panners[0];
    expect(wrapper.disconnect).not.toHaveBeenCalled();

    expect(sources.length).toBeGreaterThan(0);
    for (const src of sources) src.onended?.();

    expect(wrapper.disconnect).toHaveBeenCalled();
    expect(panner.disconnect).toHaveBeenCalled();
  });

  it("keeps the wrapper connected while any source is still playing", () => {
    engine.setSoundEnabled(true);
    const { wrapper, sources } = playTracked("burst", { pan: 0.5 });
    // All but one source end — the wrapper must stay in the graph.
    for (const src of sources.slice(1)) src.onended?.();
    expect(wrapper.disconnect).not.toHaveBeenCalled();
  });

  it("ignores an unknown voice", () => {
    engine.setSoundEnabled(true);
    sfx.playSfx("definitely-not-a-voice");
    expect(created.oscillators + created.sources).toBe(0);
  });

  it("places a voice in the stereo field when given a pan", () => {
    engine.setSoundEnabled(true);
    sfx.playSfx("burst", { pan: -0.5 });
    expect(created.panners).toHaveLength(1);
    expect(created.panners[0].pan.value).toBe(-0.5);
  });

  it("skips the panner when no pan is supplied", () => {
    engine.setSoundEnabled(true);
    sfx.playSfx("burst");
    expect(created.panners).toHaveLength(0);
  });

  it("panForX maps viewport x to a -1..1 pan", () => {
    const w = window.innerWidth;
    expect(sfx.panForX(0)).toBe(-1);
    expect(sfx.panForX(w)).toBe(1);
    expect(sfx.panForX(w / 2)).toBeCloseTo(0, 5);
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
