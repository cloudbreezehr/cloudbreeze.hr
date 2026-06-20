// ── Effects Bus ──
// Every world/effect voice routes through one bus → a per-theme "tint" filter →
// the master. Swapping the filter when a theme wins re-colours every effect at
// once (clicks, fireworks, lightning, and anything added later) without each
// voice knowing the theme — the audio counterpart to a theme defining its icon
// once. UI cues (toggle, unlock) deliberately bypass this and play dry.

import { audioContext, masterBus } from "./engine.js";

// A wide-open lowpass reads as "no colour" — the resting state with no theme.
const NEUTRAL = { type: "lowpass", freq: 20000, q: 0.0001 };

// Ease the tint when a theme changes so the swap doesn't zip an already-ringing
// sustained voice (a drag whoosh or well hum mid-flight). The discrete `type`
// can't ramp, but gliding frequency/Q masks the switch.
const TINT_GLIDE_S = 0.08;

let effects = null; // gain node every effect voice connects to
let tint = null; // the per-theme biquad

function build() {
  const ctx = audioContext();
  const master = masterBus();
  if (!ctx || !master) return null;
  if (effects) return effects;
  effects = ctx.createGain();
  tint = ctx.createBiquadFilter();
  applyFilter(NEUTRAL); // initial colour — instant, nothing is ringing yet
  effects.connect(tint);
  tint.connect(master);
  return effects;
}

function applyFilter(p, glide = false) {
  if (!tint) return;
  tint.type = p.type; // discrete — can't ramp
  if (glide) {
    const ctx = audioContext();
    const now = ctx ? ctx.currentTime : 0;
    tint.frequency.setTargetAtTime(p.freq, now, TINT_GLIDE_S);
    tint.Q.setTargetAtTime(p.q, now, TINT_GLIDE_S);
  } else {
    tint.frequency.value = p.freq;
    tint.Q.value = p.q;
  }
}

// The node effect voices connect to. Null when audio is unavailable.
export function effectsBus() {
  return build();
}

// Tint every effect for the active theme; null restores the neutral resting
// colour. Builds the bus lazily so a theme that wins before any sound has
// played still colours the first one.
export function setThemeFilter(params) {
  if (!tint && !build()) return;
  applyFilter(params || NEUTRAL, true);
}

// Test hook — drop the bus so a fresh stub context rebuilds it.
export function _resetForTests() {
  effects = null;
  tint = null;
}
