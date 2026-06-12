import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  getQualityTier,
  PARTICLE_SCALE,
  observeFps,
} from "../../js/quality.js";

// quality.js classifies the device into a coarse tier based on
// navigator.hardwareConcurrency and navigator.deviceMemory.  Tests
// stash and restore the original navigator descriptors so leak-free
// mutation only affects the current case.

describe("quality.js", () => {
  let originalCores;
  let originalMemory;

  beforeEach(() => {
    originalCores = Object.getOwnPropertyDescriptor(
      Navigator.prototype,
      "hardwareConcurrency",
    );
    originalMemory = Object.getOwnPropertyDescriptor(
      Navigator.prototype,
      "deviceMemory",
    );
  });

  afterEach(() => {
    if (originalCores) {
      Object.defineProperty(
        Navigator.prototype,
        "hardwareConcurrency",
        originalCores,
      );
    } else {
      delete Navigator.prototype.hardwareConcurrency;
    }
    if (originalMemory) {
      Object.defineProperty(
        Navigator.prototype,
        "deviceMemory",
        originalMemory,
      );
    } else {
      delete Navigator.prototype.deviceMemory;
    }
  });

  function setHardware(cores, memGB) {
    Object.defineProperty(Navigator.prototype, "hardwareConcurrency", {
      configurable: true,
      get: () => cores,
    });
    Object.defineProperty(Navigator.prototype, "deviceMemory", {
      configurable: true,
      get: () => memGB,
    });
  }

  describe("getQualityTier", () => {
    it("returns 'low' for severely-constrained memory regardless of cores", () => {
      setHardware(16, 2);
      expect(getQualityTier()).toEqual("low");
    });

    it("returns 'low' when both cores and memory are weak", () => {
      setHardware(4, 4);
      expect(getQualityTier()).toEqual("low");
    });

    it("returns 'high' when both cores and memory are strong", () => {
      setHardware(12, 16);
      expect(getQualityTier()).toEqual("high");
    });

    it("returns 'mid' for typical mid-range devices", () => {
      setHardware(6, 8);
      expect(getQualityTier()).toEqual("mid");
    });

    it("returns 'mid' when one signal is missing", () => {
      setHardware(8, 0);
      expect(getQualityTier()).toEqual("mid");
    });

    it("returns 'mid' when both signals are unknown (0/0)", () => {
      setHardware(0, 0);
      expect(getQualityTier()).toEqual("mid");
    });
  });

  describe("PARTICLE_SCALE", () => {
    it("scales low below mid and high above mid", () => {
      expect(PARTICLE_SCALE.low).toBeLessThan(PARTICLE_SCALE.mid);
      expect(PARTICLE_SCALE.high).toBeGreaterThan(PARTICLE_SCALE.mid);
      expect(PARTICLE_SCALE.mid).toEqual(1.0);
    });

    it("is frozen so callers can't mutate the shared map", () => {
      expect(Object.isFrozen(PARTICLE_SCALE)).toBe(true);
    });
  });

  describe("observeFps", () => {
    let rafCbs;
    let nowMs;
    let origRaf;
    let origCancel;
    let origNow;

    beforeEach(() => {
      rafCbs = [];
      nowMs = 0;
      origRaf = globalThis.requestAnimationFrame;
      origCancel = globalThis.cancelAnimationFrame;
      origNow = performance.now;
      globalThis.requestAnimationFrame = (cb) => {
        rafCbs.push(cb);
        return rafCbs.length;
      };
      globalThis.cancelAnimationFrame = () => {};
      performance.now = () => nowMs;
    });

    afterEach(() => {
      globalThis.requestAnimationFrame = origRaf;
      globalThis.cancelAnimationFrame = origCancel;
      performance.now = origNow;
    });

    // Drive one frame `dtMs` after the previous, flushing the rAF queue.
    function frame(dtMs) {
      nowMs += dtMs;
      const cbs = rafCbs;
      rafCbs = [];
      for (const cb of cbs) cb(nowMs);
    }

    it("reports a downscale after sustained low FPS, then restores", () => {
      const changes = [];
      observeFps((f) => changes.push(f));
      // Prime the loop (first tick just sets `last`).
      frame(16);
      // ~20 FPS (50ms/frame) for >2s → downscale.
      for (let i = 0; i < 60; i++) frame(50);
      expect(changes).toContain(0.7);

      // ~60 FPS (16ms/frame) for >2s → restore to 1.
      for (let i = 0; i < 200; i++) frame(16);
      expect(changes[changes.length - 1]).toEqual(1);
    });

    it("ignores a huge frame gap (backgrounded tab)", () => {
      const changes = [];
      observeFps((f) => changes.push(f));
      frame(16);
      // A single multi-second gap must not trip the guard.
      frame(60000);
      frame(16);
      expect(changes).toEqual([]);
    });
  });
});
