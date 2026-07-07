import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The continuous loop drives sustained drag/well voices from the live force
// state each animation frame. Everything around it is stubbed — a fake context
// captures the nodes, getForces feeds controllable state, and a faked
// requestAnimationFrame lets us step ticks by hand — so we can assert the three
// behaviours with real branching: the muted no-spin-up guarantee, the drag
// speed→level clamp, and the once-per-collapse well discharge.

describe("audio/continuous", () => {
  let mod, dispose;
  let soundOn, forces, calls, soundChangeCbs, reducedMotion;
  let ctxStub, audioContextSpy, gains, oscs, filters;
  let rafScheduled, rafCount, cancelCount;

  const param = () => ({
    value: 0,
    setValueAtTime() {},
    setTargetAtTime(v) {
      this.value = v; // tests don't advance audio time — settle to the target
      this.calls = (this.calls || 0) + 1;
    },
  });

  const step = () => {
    const cb = rafScheduled;
    rafScheduled = null;
    cb();
  };

  beforeEach(async () => {
    vi.resetModules();
    soundOn = false;
    reducedMotion = false;
    forces = null;
    calls = [];
    dispose = null;
    soundChangeCbs = [];
    gains = [];
    oscs = [];
    filters = [];
    rafScheduled = null;
    rafCount = 0;
    cancelCount = 0;

    ctxStub = {
      currentTime: 0,
      createBufferSource: () => ({
        buffer: null,
        loop: false,
        connect() {},
        start() {},
      }),
      createBiquadFilter: () => {
        const n = { type: "", frequency: param(), Q: param(), connect() {} };
        filters.push(n);
        return n;
      },
      createGain: () => {
        const n = { gain: param(), connect() {} };
        gains.push(n);
        return n;
      },
      createOscillator: () => {
        const n = { type: "", frequency: param(), connect() {}, start() {} };
        oscs.push(n);
        return n;
      },
    };
    audioContextSpy = vi.fn(() => ctxStub);

    vi.doMock("../../../js/audio/engine.js", () => ({
      audioContext: audioContextSpy,
      isSoundEnabled: () => soundOn,
      onSoundChange: (cb) => {
        soundChangeCbs.push(cb);
        return () => {
          const i = soundChangeCbs.indexOf(cb);
          if (i >= 0) soundChangeCbs.splice(i, 1);
        };
      },
    }));
    vi.doMock("../../../js/audio/bus.js", () => ({
      effectsBus: () => ({ connect() {} }),
    }));
    vi.doMock("../../../js/audio/noise.js", () => ({ whiteNoise: () => ({}) }));
    vi.doMock("../../../js/audio/sfx.js", () => ({
      playSfx: (n, opts) => calls.push({ name: n, opts }),
    }));
    vi.doMock("../../../js/canvas.js", () => ({ getForces: () => forces }));
    vi.doMock("../../../js/motion.js", () => ({
      prefersReducedMotion: () => reducedMotion,
    }));
    vi.doMock("../../../js/dev/registry.js", () => ({
      defineConstants: (_ns, defs) =>
        Object.fromEntries(Object.entries(defs).map(([k, v]) => [k, v.value])),
    }));

    vi.stubGlobal("requestAnimationFrame", (cb) => {
      rafScheduled = cb;
      return ++rafCount;
    });
    vi.stubGlobal("cancelAnimationFrame", () => {
      cancelCount++;
    });

    mod = await import("../../../js/audio/continuous.js");
  });

  afterEach(() => {
    if (dispose) dispose();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  const dragging = (x) => ({
    isDragging: true,
    dragPos: { x, y: 0 },
    holdStrength: 0,
    wellStrength: 0,
  });

  it("never spins up a context or a frame loop while sound is off", () => {
    soundOn = false;
    dispose = mod.initContinuous();
    expect(rafCount).toBe(0); // no loop scheduled
    expect(audioContextSpy).not.toHaveBeenCalled(); // no context requested
    expect(gains).toHaveLength(0); // no voices built
  });

  it("starts the loop when sound is enabled after a muted init", () => {
    soundOn = false;
    dispose = mod.initContinuous();
    expect(rafCount).toBe(0);
    soundOn = true;
    soundChangeCbs.forEach((cb) => cb(true));
    expect(rafCount).toBe(1);
  });

  it("builds the sustained voices on the first tick, not before", () => {
    soundOn = true;
    dispose = mod.initContinuous();
    expect(gains).toHaveLength(0); // scheduled, not yet ticked
    step();
    expect(gains).toHaveLength(3); // drag + well master + well fifth
  });

  it("maps drag speed to level, clamping at the speed reference", () => {
    soundOn = true;
    dispose = mod.initContinuous();
    const REF = mod.DRAG_SPEED_REF;
    const dragGain = () => gains[0].gain.value;

    forces = dragging(0);
    step(); // builds voices, seeds prev position, speed 0
    forces.dragPos.x = REF;
    step(); // speed = REF → level 1
    const atRef = dragGain();
    expect(atRef).toBeGreaterThan(0);

    forces.dragPos.x = REF + 2 * REF;
    step(); // speed = 2·REF → clamped to level 1
    expect(dragGain()).toBe(atRef); // no louder past the reference

    forces.dragPos.x = 3 * REF + REF / 2;
    step(); // speed = REF/2 → level 0.5
    expect(dragGain()).toBeCloseTo(atRef / 2, 5);
  });

  it("discharges the well exactly once when it collapses on release", () => {
    soundOn = true;
    dispose = mod.initContinuous();
    forces = {
      isDragging: false,
      dragPos: { x: 0, y: 0 },
      holdStrength: 0.5,
      wellStrength: 0.5,
    };
    step(); // prevWell → 0.5
    forces = {
      isDragging: false,
      dragPos: { x: 0, y: 0 },
      holdStrength: 0,
      wellStrength: 0,
    };
    step(); // wellStrength 0.5 → 0 : discharge
    step(); // still 0 : no repeat
    // Fires once, carrying the charge it reached so the boom scales with it.
    expect(calls).toEqual([{ name: "wellRelease", opts: { strength: 0.5 } }]);
  });

  it("keeps the well hum and release silent under reduced motion", () => {
    reducedMotion = true;
    soundOn = true;
    dispose = mod.initContinuous();
    // A formed well held strongly, then released — which would normally hum
    // and then boom; under reduced motion the gathered motes never move.
    forces = {
      isDragging: false,
      dragPos: { x: 0, y: 0 },
      holdStrength: 0.8,
      wellStrength: 0.8,
    };
    step(); // builds voices; well master is gains[1] (drag, well, fifth)
    expect(gains[1].gain.value).toBe(0); // hum never rises
    forces = {
      isDragging: false,
      dragPos: { x: 0, y: 0 },
      holdStrength: 0,
      wellStrength: 0,
    };
    step(); // would-be collapse
    expect(calls).toEqual([]); // no discharge boom
  });

  it("stops writing drag params once the drag ends, so an idle loop is silent", () => {
    soundOn = true;
    dispose = mod.initContinuous();
    forces = dragging(0);
    step(); // build + seed
    forces.dragPos.x = 10;
    step(); // dragging — writes
    forces.isDragging = false;
    step(); // edge: one rest write, then goes idle
    const settled = gains[0].gain.calls;
    step(); // idle — must not write
    step();
    expect(gains[0].gain.calls).toBe(settled);
  });

  it("returns a disposer that cancels the loop and unsubscribes", () => {
    soundOn = true;
    dispose = mod.initContinuous();
    expect(soundChangeCbs).toHaveLength(1);
    dispose();
    dispose = null;
    expect(cancelCount).toBeGreaterThan(0); // stop() cancelled the frame
    expect(soundChangeCbs).toHaveLength(0); // and released its subscription
  });
});
