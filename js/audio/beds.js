// ── Ambient Beds ──
// A continuous ambient loop for the two themes whose worlds have a natural
// ambience — rain and the deep sea — crossfaded in when the theme wins and out
// when it's gone (other themes carry their character through the effects-bus
// tint and their entry cue, not a bed). Kept well under the SFX so it never
// becomes the foreground. A bed builds only while sound is on; if the theme was
// entered with sound off, the choice is remembered and honoured on the next
// enable.

import { defineConstants } from "../dev/registry.js";
import {
  audioContext,
  masterBus,
  isSoundEnabled,
  onSoundChange,
} from "./engine.js";
import { whiteNoise } from "./noise.js";

const BEDS = defineConstants("audio.beds", {
  GAIN: {
    value: 0.08,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Ambient bed bus level",
  },
  CROSSFADE_S: {
    value: 1.2,
    min: 0.1,
    max: 5,
    step: 0.1,
    description: "Bed crossfade time",
  },
});

const FLOOR = 0.0001; // exponential ramps can't reach 0
const STOP_SLACK_S = 0.1; // beyond the fade before a faded-out source is stopped

// The two ambient worlds. type/freq/q shape the filtered-noise loop; gain is
// relative to the bed bus; a slow LFO breathes the cutoff (lfoDepth 0 = steady).
// deep-sea: a low, slowly-swelling underwater hush. rainy: soft broadband
// rainfall.
const BED_DEFS = {
  "deep-sea": {
    type: "lowpass",
    freq: 350,
    q: 1.0,
    gain: 1.0,
    lfoRate: 0.07,
    lfoDepth: 120,
  },
  rainy: {
    type: "lowpass",
    freq: 3200,
    q: 0.5,
    gain: 0.8,
    lfoRate: 0,
    lfoDepth: 0,
  },
};

let current = null; // { theme, gain, stop() }
let desired = null; // theme whose bed should be playing (null = silence)

// Build a playing, faded-up bed and return a handle that fades it back out and
// frees its nodes.
function startBed(ctx, bus, def) {
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = whiteNoise(ctx);
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = def.type;
  filter.frequency.value = def.freq;
  filter.Q.value = def.q;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(FLOOR, t);
  gain.gain.exponentialRampToValueAtTime(
    BEDS.GAIN * def.gain,
    t + BEDS.CROSSFADE_S,
  );
  src.connect(filter);
  filter.connect(gain);
  gain.connect(bus);
  src.start(t);

  let lfo = null;
  if (def.lfoDepth > 0) {
    lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = def.lfoRate;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = def.lfoDepth;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start(t);
  }

  function stop() {
    const end = ctx.currentTime + BEDS.CROSSFADE_S;
    gain.gain.cancelScheduledValues(ctx.currentTime);
    gain.gain.setValueAtTime(Math.max(FLOOR, gain.gain.value), ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(FLOOR, end);
    src.stop(end + STOP_SLACK_S);
    if (lfo) lfo.stop(end + STOP_SLACK_S);
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }

  return { gain, stop };
}

// Bring the playing bed in line with `desired` + the current sound state.
function sync() {
  const ctx = isSoundEnabled() ? audioContext() : null;
  const bus = ctx ? masterBus() : null;
  if (!ctx || !bus) {
    if (current) {
      current.stop();
      current = null;
    }
    return;
  }
  if (current && current.theme === desired) return;
  if (current) {
    current.stop();
    current = null;
  }
  if (desired && BED_DEFS[desired]) {
    current = { theme: desired, ...startBed(ctx, bus, BED_DEFS[desired]) };
  }
}

// Choose which theme's bed should play (null silences). Crossfades if sound is
// on; if it's off the choice is remembered and honoured when sound comes on.
export function setBed(themeId) {
  desired = themeId && BED_DEFS[themeId] ? themeId : null;
  sync();
}

export function initBeds() {
  onSoundChange(sync);
}

// Test hook — silence and drop bed state.
export function _resetForTests() {
  if (current) {
    current.stop();
    current = null;
  }
  desired = null;
}
