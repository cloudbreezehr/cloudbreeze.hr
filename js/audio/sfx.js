// ── Sound Effects ──
// Procedural one-shot voices — no audio files, everything is synthesised from
// oscillators and filtered noise, mirroring how the canvas draws rather than
// ships sprites. Each voice builds a tiny graph onto the master bus, schedules
// itself against the audio clock, and tears its nodes down on completion.
// playSfx() is a no-op when sound is off or unavailable, so callers never guard.

import { defineConstants } from "../dev/registry.js";
import { audioContext, masterBus, isSoundEnabled } from "./engine.js";
import { effectsBus } from "./bus.js";
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
  // A theme entering / leaving — a soft noise sweep up / down. Played through
  // the effects bus after the tint is set, so it takes on the theme's colour.
  themeIn(ctx, bus) {
    breath(ctx, bus, {
      dur: 0.55,
      type: "bandpass",
      freq: 300,
      sweepTo: 1800,
      q: 0.7,
      gain: 0.28,
      attack: 0.18,
    });
  },
  themeOut(ctx, bus) {
    breath(ctx, bus, {
      dur: 0.45,
      type: "bandpass",
      freq: 1800,
      sweepTo: 280,
      q: 0.7,
      gain: 0.24,
      attack: 0.04,
    });
  },
  // A soft tap for a pointer click — short filtered-noise tick plus a faint
  // body. Kept subtle: it fires on every click, so it can't grate.
  click(ctx, bus) {
    breath(ctx, bus, {
      dur: 0.05,
      type: "bandpass",
      freq: 2000,
      q: 0.8,
      gain: 0.18,
    });
    tone(ctx, bus, {
      freq: 440,
      type: "sine",
      attack: 0.002,
      release: 0.05,
      gain: 0.1,
    });
  },
  // A firework rocket leaving the ground — a soft rising whistle. Fires once
  // per rocket, so a staggered volley layers into a natural crescendo.
  rocket(ctx, bus) {
    tone(ctx, bus, {
      freq: 320,
      slideTo: 1150,
      type: "triangle",
      attack: 0.02,
      release: 0.34,
      gain: 0.12,
    });
    breath(ctx, bus, {
      dur: 0.34,
      type: "bandpass",
      freq: 1300,
      q: 0.6,
      gain: 0.09,
      attack: 0.05,
    });
  },
  // A firework detonation — a soft body thump, a sub, and a high crackle tail
  // for the shimmer. One per burst, so denser shows sound bigger on their own.
  burst(ctx, bus) {
    breath(ctx, bus, {
      dur: 0.4,
      type: "lowpass",
      freq: 900,
      sweepTo: 80,
      gain: 0.6,
    });
    tone(ctx, bus, {
      freq: 90,
      slideTo: 45,
      type: "sine",
      attack: 0.005,
      release: 0.34,
      gain: 0.45,
    });
    breath(ctx, bus, {
      dur: 0.5,
      type: "highpass",
      freq: 4200,
      q: 0.5,
      gain: 0.12,
      attack: 0.03,
    });
  },
  // A ripple ring — a soft water-drop plink.
  drop(ctx, bus) {
    tone(ctx, bus, {
      freq: 900,
      slideTo: 320,
      type: "sine",
      attack: 0.002,
      release: 0.18,
      gain: 0.18,
    });
    breath(ctx, bus, {
      dur: 0.05,
      type: "bandpass",
      freq: 1800,
      q: 1.0,
      gain: 0.1,
    });
  },
  // Confetti / snow scatter — a soft pop and a high flutter tail.
  confetti(ctx, bus) {
    breath(ctx, bus, {
      dur: 0.12,
      type: "bandpass",
      freq: 1800,
      q: 0.8,
      gain: 0.22,
    });
    breath(ctx, bus, {
      dur: 0.5,
      type: "highpass",
      freq: 5000,
      q: 0.4,
      gain: 0.1,
      attack: 0.05,
    });
  },
  // A screen flash (surge / glow / sun) — a soft brightening swell.
  flash(ctx, bus) {
    tone(ctx, bus, {
      freq: 400,
      slideTo: 820,
      type: "sine",
      attack: 0.04,
      release: 0.32,
      gain: 0.16,
    });
    breath(ctx, bus, {
      dur: 0.36,
      type: "lowpass",
      freq: 600,
      sweepTo: 4200,
      gain: 0.13,
      attack: 0.06,
    });
  },
  // A quake — a low, short rumble.
  rumble(ctx, bus) {
    breath(ctx, bus, {
      dur: 0.7,
      type: "lowpass",
      freq: 130,
      q: 1.2,
      gain: 0.6,
      attack: 0.05,
    });
  },
  // A hue sweep (disco / rainbow) — a filtered whoosh that opens up.
  sweep(ctx, bus) {
    breath(ctx, bus, {
      dur: 0.8,
      type: "bandpass",
      freq: 400,
      sweepTo: 5000,
      q: 0.7,
      gain: 0.18,
      attack: 0.1,
    });
  },
  // A lightning strike — a sharp high crack over a low thunder tail.
  lightning(ctx, bus) {
    breath(ctx, bus, {
      dur: 0.12,
      type: "highpass",
      freq: 3000,
      q: 0.5,
      gain: 0.5,
    });
    breath(ctx, bus, {
      dur: 0.6,
      type: "lowpass",
      freq: 320,
      sweepTo: 80,
      gain: 0.4,
      attack: 0.02,
    });
  },
  // A streak shooting across (comet / warp / gust / wish) — a quick airy zip.
  streak(ctx, bus) {
    breath(ctx, bus, {
      dur: 0.4,
      type: "bandpass",
      freq: 900,
      sweepTo: 3200,
      q: 0.7,
      gain: 0.16,
      attack: 0.04,
    });
  },
  // Motes circling the cursor — a gentle rising shimmer.
  orbit(ctx, bus) {
    tone(ctx, bus, {
      freq: 520,
      slideTo: 880,
      type: "sine",
      attack: 0.08,
      hold: 0.4,
      release: 0.5,
      gain: 0.16,
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

// Play a named voice. intensity (0..1) scales the charged variants. World/effect
// voices route through the per-theme effects bus; pass `ui: true` for theme-
// agnostic cues (toggle, unlock) that should play dry. No-op when sound is off,
// unavailable, or the name is unknown.
export function playSfx(name, { intensity = 0, ui = false } = {}) {
  if (!isSoundEnabled()) return;
  const voice = VOICES[name];
  if (!voice) return;
  const ctx = audioContext();
  if (!ctx) return;
  const bus = ui ? masterBus() : effectsBus();
  if (!bus) return;
  const sfxGain = ctx.createGain();
  sfxGain.gain.value = SFX.GAIN;
  sfxGain.connect(bus);
  voice(ctx, sfxGain, Math.max(0, Math.min(1, intensity)));
}
