// ── Sound Effects ──
// Procedural one-shot voices — no audio files, everything is synthesised from
// oscillators and filtered noise, mirroring how the canvas draws rather than
// ships sprites. Each voice builds a tiny graph onto the master bus, schedules
// itself against the audio clock, and tears its nodes down on completion.
// playSfx() is a no-op when sound is off or unavailable, so callers never guard.

import { defineConstants } from "../dev/registry.js";
import { audioContext, masterBus, isSoundEnabled } from "./engine.js";
import { whiteNoise } from "./noise.js";

const SFX = defineConstants("audio.sfx", {
  GAIN: {
    value: 0.5,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Sound-effect bus level",
  },
});

// ── Synthesis constants ──
const FLOOR = 0.0001; // exponential ramps can't reach 0
const TAIL_S = 0.03; // slack before a node is stopped/freed

// Attack→hold→release envelope on a gain node; returns the end time so the
// voice knows when to stop its source.
function envelope(ctx, gain, { attack, hold = 0, release, peak }) {
  const t = ctx.currentTime;
  const g = gain.gain;
  g.setValueAtTime(FLOOR, t);
  g.exponentialRampToValueAtTime(peak, t + attack);
  const holdEnd = t + attack + hold;
  g.setValueAtTime(peak, holdEnd);
  g.exponentialRampToValueAtTime(FLOOR, holdEnd + release);
  return holdEnd + release;
}

function freeOnEnd(node, ...nodes) {
  node.onended = () => {
    node.disconnect();
    for (const n of nodes) n.disconnect();
  };
}

// A pitched voice: oscillator → gain → bus, with an optional pitch slide.
function tone(
  ctx,
  bus,
  { freq, type = "sine", attack, hold, release, gain, slideTo },
) {
  const osc = ctx.createOscillator();
  osc.type = type;
  const t = ctx.currentTime;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) {
    osc.frequency.exponentialRampToValueAtTime(
      slideTo,
      t + attack + (hold || 0) + release,
    );
  }
  const g = ctx.createGain();
  osc.connect(g);
  g.connect(bus);
  const end = envelope(ctx, g, { attack, hold, release, peak: gain });
  osc.start(t);
  osc.stop(end + TAIL_S);
  freeOnEnd(osc, g);
}

// A breath of filtered noise: source → biquad → gain → bus, with an optional
// cutoff sweep across the voice.
function breath(
  ctx,
  bus,
  { dur, type = "lowpass", freq, q = 1, gain, sweepTo, attack = 0.005 },
) {
  const src = ctx.createBufferSource();
  src.buffer = whiteNoise(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  const t = ctx.currentTime;
  filter.frequency.setValueAtTime(freq, t);
  filter.Q.value = q;
  if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  const g = ctx.createGain();
  src.connect(filter);
  filter.connect(g);
  g.connect(bus);
  envelope(ctx, g, { attack, release: dur - attack, peak: gain });
  src.start(t);
  src.stop(t + dur + TAIL_S);
  freeOnEnd(src, filter, g);
}

// ── Voice catalogue ──
// Each entry receives (ctx, bus, intensity 0..1) — intensity beefs up the
// charged casts (a maxed BOOOOM, a STOOORM). Frequencies in Hz, times in s.
const VOICES = {
  boom(ctx, bus, i) {
    breath(ctx, bus, {
      dur: 0.5 + i * 0.3,
      type: "lowpass",
      freq: 700,
      sweepTo: 90,
      gain: 0.9,
    });
    tone(ctx, bus, {
      freq: 120,
      slideTo: 40,
      type: "sine",
      attack: 0.005,
      release: 0.45,
      gain: 0.7,
    });
  },
  thunder(ctx, bus, i) {
    VOICES.boom(ctx, bus, i);
    breath(ctx, bus, {
      dur: 1.1 + i * 0.5,
      type: "lowpass",
      freq: 200,
      sweepTo: 60,
      gain: 0.6,
      attack: 0.08,
    });
  },
  zap(ctx, bus) {
    breath(ctx, bus, {
      dur: 0.16,
      type: "highpass",
      freq: 2600,
      q: 0.7,
      gain: 0.6,
    });
    tone(ctx, bus, {
      freq: 1800,
      slideTo: 320,
      type: "sawtooth",
      attack: 0.002,
      release: 0.12,
      gain: 0.4,
    });
  },
  whoosh(ctx, bus) {
    breath(ctx, bus, {
      dur: 0.5,
      type: "bandpass",
      freq: 500,
      q: 0.8,
      sweepTo: 2400,
      gain: 0.5,
      attack: 0.12,
    });
  },
  sparkle(ctx, bus) {
    const base = 1200;
    [0, 1, 2].forEach((n) =>
      tone(ctx, bus, {
        freq: base * (1 + n * 0.5),
        type: "triangle",
        attack: 0.003 + n * 0.04,
        release: 0.18,
        gain: 0.28,
      }),
    );
  },
  pop(ctx, bus) {
    breath(ctx, bus, {
      dur: 0.09,
      type: "bandpass",
      freq: 1400,
      q: 1.4,
      gain: 0.5,
    });
  },
  shimmer(ctx, bus) {
    breath(ctx, bus, {
      dur: 0.9,
      type: "highpass",
      freq: 5000,
      q: 0.6,
      gain: 0.32,
      attack: 0.25,
    });
  },
  surge(ctx, bus) {
    tone(ctx, bus, {
      freq: 180,
      slideTo: 900,
      type: "sawtooth",
      attack: 0.02,
      release: 0.4,
      gain: 0.4,
    });
    breath(ctx, bus, {
      dur: 0.4,
      type: "lowpass",
      freq: 400,
      sweepTo: 3000,
      gain: 0.3,
      attack: 0.15,
    });
  },
  swell(ctx, bus, i) {
    tone(ctx, bus, {
      freq: 330,
      type: "sine",
      attack: 0.18,
      hold: 0.1,
      release: 0.5,
      gain: 0.3 + i * 0.15,
    });
    tone(ctx, bus, {
      freq: 495,
      type: "sine",
      attack: 0.22,
      hold: 0.1,
      release: 0.5,
      gain: 0.18 + i * 0.1,
    });
  },
  rumble(ctx, bus, i) {
    breath(ctx, bus, {
      dur: 0.7 + i * 0.4,
      type: "lowpass",
      freq: 140,
      q: 1.2,
      gain: 0.7,
      attack: 0.06,
    });
  },
  whirl(ctx, bus) {
    tone(ctx, bus, {
      freq: 420,
      slideTo: 760,
      type: "triangle",
      attack: 0.1,
      hold: 0.3,
      release: 0.4,
      gain: 0.3,
    });
  },
  gliss(ctx, bus) {
    tone(ctx, bus, {
      freq: 260,
      slideTo: 1300,
      type: "sawtooth",
      attack: 0.04,
      release: 0.7,
      gain: 0.3,
    });
  },
  pulse(ctx, bus) {
    tone(ctx, bus, {
      freq: 300,
      type: "sine",
      attack: 0.04,
      hold: 0.25,
      release: 0.45,
      gain: 0.34,
    });
  },
  chime(ctx, bus) {
    [523.25, 659.25, 783.99].forEach((freq, n) =>
      tone(ctx, bus, {
        freq,
        type: "sine",
        attack: 0.005 + n * 0.03,
        release: 0.5,
        gain: 0.26,
      }),
    );
  },
  // A bright rising fifth (E5 → B5) for an unlock — distinct from the toggle's
  // chime so the two don't sound like a stutter when both land on first enable.
  unlock(ctx, bus) {
    tone(ctx, bus, {
      freq: 659.25,
      type: "triangle",
      attack: 0.004,
      release: 0.2,
      gain: 0.26,
    });
    tone(ctx, bus, {
      freq: 987.77,
      type: "triangle",
      attack: 0.11,
      release: 0.34,
      gain: 0.24,
    });
  },
};

// Play a named voice. intensity (0..1) scales the charged variants. No-op when
// sound is off, unavailable, or the name is unknown.
export function playSfx(name, { intensity = 0 } = {}) {
  if (!isSoundEnabled()) return;
  const voice = VOICES[name];
  if (!voice) return;
  const ctx = audioContext();
  const bus = masterBus();
  if (!ctx || !bus) return;
  const sfxGain = ctx.createGain();
  sfxGain.gain.value = SFX.GAIN;
  sfxGain.connect(bus);
  voice(ctx, sfxGain, Math.max(0, Math.min(1, intensity)));
}
