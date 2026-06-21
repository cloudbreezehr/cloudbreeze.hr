import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The engine owns the on/off state, the persisted preference, and the Web
// Audio graph. happy-dom has no Web Audio, so the state/persistence/event
// tests run without a context (exercising the unsupported path), and a second
// block stubs AudioContext to cover graph creation + resume/suspend.

describe("audio/engine", () => {
  let mod;

  beforeEach(async () => {
    vi.resetModules();
    localStorage.clear();
    mod = await import("../../../js/audio/engine.js");
  });

  afterEach(() => {
    mod._resetForTests();
    delete window.AudioContext;
    delete window.webkitAudioContext;
  });

  it("defaults to off", () => {
    expect(mod.isSoundEnabled()).toBe(false);
  });

  it("persists the preference across reloads", async () => {
    mod.setSoundEnabled(true);
    expect(localStorage.getItem("sound")).toBe("on");
    vi.resetModules();
    const reloaded = await import("../../../js/audio/engine.js");
    expect(reloaded.isSoundEnabled()).toBe(true);
  });

  it("notifies subscribers on change, and stops after unsubscribe", () => {
    const seen = [];
    const off = mod.onSoundChange((on) => seen.push(on));
    mod.setSoundEnabled(true);
    mod.setSoundEnabled(false);
    off();
    mod.setSoundEnabled(true);
    expect(seen).toEqual([true, false]);
  });

  it("announces sound-enabled on turn-on, but not on turn-off", () => {
    const handler = vi.fn();
    window.addEventListener("achievement", handler);
    mod.setSoundEnabled(true);
    mod.setSoundEnabled(false);
    window.removeEventListener("achievement", handler);
    const types = handler.mock.calls.map(([e]) => e.detail.type);
    expect(types).toEqual(["sound-enabled"]);
  });

  it("toggles between states", () => {
    mod.toggleSound();
    expect(mod.isSoundEnabled()).toBe(true);
    mod.toggleSound();
    expect(mod.isSoundEnabled()).toBe(false);
  });

  describe("with Web Audio available", () => {
    let resume, suspend;

    beforeEach(() => {
      resume = vi.fn();
      suspend = vi.fn();
      const param = () => ({ value: 0 });
      window.AudioContext = vi.fn(function () {
        this.state = "suspended";
        this.destination = {};
        this.resume = resume.mockImplementation(() => {
          this.state = "running";
        });
        this.suspend = suspend.mockImplementation(() => {
          this.state = "suspended";
        });
        this.createGain = () => ({ gain: param(), connect() {} });
        this.createDynamicsCompressor = () => ({
          threshold: param(),
          knee: param(),
          ratio: param(),
          connect() {},
        });
      });
    });

    it("builds the master bus and resumes the context on enable", () => {
      expect(mod.masterBus()).not.toBeNull();
      mod.setSoundEnabled(true);
      expect(resume).toHaveBeenCalled();
    });

    it("suspends the context a grace period after turning off", () => {
      vi.useFakeTimers();
      mod.setSoundEnabled(true);
      mod.setSoundEnabled(false);
      expect(suspend).not.toHaveBeenCalled(); // deferred, not immediate
      vi.advanceTimersByTime(mod.SUSPEND_GRACE_MS);
      expect(suspend).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it("cancels the deferred suspend if sound returns within the grace window", () => {
      vi.useFakeTimers();
      mod.setSoundEnabled(true);
      mod.setSoundEnabled(false);
      mod.setSoundEnabled(true); // back on before the grace elapses
      vi.advanceTimersByTime(mod.SUSPEND_GRACE_MS);
      expect(suspend).not.toHaveBeenCalled();
      vi.useRealTimers();
    });
  });
});
