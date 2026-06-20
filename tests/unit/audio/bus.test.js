import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The effects bus routes every world voice through one per-theme tint filter.
// A stub AudioContext stands in for happy-dom's missing Web Audio and captures
// the biquad so its params can be read back.

function stubAudioContext(captured) {
  const param = () => ({
    value: 0,
    setValueAtTime() {},
    exponentialRampToValueAtTime() {},
    setTargetAtTime(v) {
      this.value = v; // tests don't advance audio time — settle to the target
    },
  });
  const node = (extra = {}) => ({ connect() {}, disconnect() {}, ...extra });
  return vi.fn(function () {
    this.state = "suspended";
    this.destination = {};
    this.resume = () => {};
    this.suspend = () => {};
    this.createGain = () => node({ gain: param() });
    this.createDynamicsCompressor = () =>
      node({ threshold: param(), knee: param(), ratio: param() });
    this.createBiquadFilter = () => {
      captured.filter = node({ type: "", frequency: param(), Q: param() });
      return captured.filter;
    };
  });
}

describe("audio/bus", () => {
  let bus, engine, captured;

  beforeEach(async () => {
    vi.resetModules();
    localStorage.clear();
    captured = {};
    window.AudioContext = stubAudioContext(captured);
    engine = await import("../../../js/audio/engine.js");
    bus = await import("../../../js/audio/bus.js");
  });

  afterEach(() => {
    bus._resetForTests();
    engine._resetForTests();
    delete window.AudioContext;
  });

  it("builds an effects bus node", () => {
    expect(bus.effectsBus()).not.toBeNull();
  });

  it("starts transparent — a wide-open lowpass", () => {
    bus.effectsBus();
    expect(captured.filter.type).toBe("lowpass");
    expect(captured.filter.frequency.value).toBeGreaterThan(10000);
  });

  it("applies a theme tint, and restores neutral on null", () => {
    bus.effectsBus();
    bus.setThemeFilter({ type: "highpass", freq: 900, q: 0.7 });
    expect(captured.filter.type).toBe("highpass");
    expect(captured.filter.frequency.value).toBe(900);

    bus.setThemeFilter(null);
    expect(captured.filter.type).toBe("lowpass");
    expect(captured.filter.frequency.value).toBeGreaterThan(10000);
  });
});
