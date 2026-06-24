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
const BURST_CRACKLE_POPS = 11; // sharp noise cracks scattered after a firework boom

// Attack→hold→release envelope on a gain node; returns the end time so the
// voice knows when to stop its source.
function envelope(ctx, gain, { attack, hold = 0, release, peak, start }) {
  const t = start ?? ctx.currentTime;
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

// A pitched voice: oscillator → gain → bus, with an optional pitch slide and an
// optional start `delay` (seconds) so a voice can sequence tones in time rather
// than blooming them all at once.
function tone(
  ctx,
  bus,
  { freq, type = "sine", attack, hold, release, gain, slideTo, delay = 0 },
) {
  const osc = ctx.createOscillator();
  osc.type = type;
  const t = ctx.currentTime + delay;
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
  const end = envelope(ctx, g, { attack, hold, release, peak: gain, start: t });
  osc.start(t);
  osc.stop(end + TAIL_S);
  freeOnEnd(osc, g);
}

// A breath of filtered noise: source → biquad → gain → bus, with an optional
// cutoff sweep across the voice and an optional start `delay` (seconds) so a
// voice can sequence breaths in time.
function breath(
  ctx,
  bus,
  {
    dur,
    type = "lowpass",
    freq,
    q = 1,
    gain,
    sweepTo,
    attack = 0.005,
    delay = 0,
  },
) {
  const src = ctx.createBufferSource();
  src.buffer = whiteNoise(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  const t = ctx.currentTime + delay;
  filter.frequency.setValueAtTime(freq, t);
  filter.Q.value = q;
  if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  const g = ctx.createGain();
  src.connect(filter);
  filter.connect(g);
  g.connect(bus);
  envelope(ctx, g, { attack, release: dur - attack, peak: gain, start: t });
  src.start(t);
  src.stop(t + dur + TAIL_S);
  freeOnEnd(src, filter, g);
}

// ── Voice catalogue ──
// Each entry is a recipe `(ctx, bus) => …` built from tone()/breath() onto the
// given bus. Frequencies in Hz, times in seconds — a readable data table.
const VOICES = {
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
    // A tonal riser (G3 → G4) under the sweep, so entering a theme swells into
    // place rather than just swishing.
    tone(ctx, bus, {
      freq: 196,
      slideTo: 392,
      type: "triangle",
      attack: 0.2,
      release: 0.4,
      gain: 0.12,
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
    // A tonal faller (G4 → E3) under the sweep — the theme releasing its hold.
    tone(ctx, bus, {
      freq: 392,
      slideTo: 165,
      type: "triangle",
      attack: 0.03,
      release: 0.34,
      gain: 0.11,
    });
  },
  // A soft tap for a pointer click — a low woody tick over a faint body that
  // drops a hair in pitch for a rounded "tok". Kept subtle and warm rather than
  // bright: it fires on every click, so it can't grate.
  click(ctx, bus) {
    breath(ctx, bus, {
      dur: 0.04,
      type: "bandpass",
      freq: 1100,
      q: 1.1,
      gain: 0.14,
    });
    tone(ctx, bus, {
      freq: 360,
      slideTo: 280,
      type: "triangle",
      attack: 0.002,
      release: 0.07,
      gain: 0.12,
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
  // A firework detonation — a deep body thump and sub, then a real crackling
  // sparkle tail: a brief airy hiss and a dense scatter of sharp noise cracks as
  // the embers snap and fall. One per burst, so denser shows sound bigger.
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
    // A brief airy hiss of scattering embers.
    breath(ctx, bus, {
      dur: 0.4,
      type: "highpass",
      freq: 4200,
      q: 0.5,
      gain: 0.09,
      attack: 0.03,
      delay: 0.04,
    });
    // Crackle — a dense scatter of sharp broadband noise cracks (randomised for
    // an organic, irregular crackle) as the sparks snap and pop after the boom.
    // Noise rather than tones: pitched pops read as bubbles, real crackle is
    // broadband transients.
    for (let i = 0; i < BURST_CRACKLE_POPS; i++) {
      breath(ctx, bus, {
        dur: 0.015 + Math.random() * 0.025,
        type: "highpass",
        freq: 2600 + Math.random() * 3400,
        q: 0.5,
        gain: 0.14 + Math.random() * 0.1,
        attack: 0.001,
        delay: 0.05 + Math.random() * 0.5,
      });
    }
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
  // A hue sweep (rainbow) — a filtered whoosh that opens up.
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
  // The DISCO incantation — a two-bar groove at 120 BPM: four-on-the-floor
  // kick, off-beat hi-hats, an octave-bouncing bass, and syncopated Am7→Dm7
  // chord stabs. Sequenced in time via each tone's `delay`, so it plays as
  // actual music rather than a single hit; self-cleans like any one-shot.
  disco(ctx, bus) {
    const BEAT = 0.5; // 120 BPM
    const BARS = 2;
    const beats = BARS * 4;
    const off = BEAT / 2; // the "and" between beats

    for (let b = 0; b < beats; b++) {
      const at = b * BEAT;
      // Four-on-the-floor kick.
      tone(ctx, bus, {
        freq: 130,
        slideTo: 45,
        type: "sine",
        attack: 0.002,
        release: 0.16,
        gain: 0.42,
        delay: at,
      });
      // Closed hi-hat on the off-beat.
      breath(ctx, bus, {
        dur: 0.05,
        type: "highpass",
        freq: 8000,
        q: 1.4,
        gain: 0.12,
        delay: at + off,
      });
      // Octave bass — root on the beat, octave on the "and"; A minor for the
      // first bar, D minor for the second.
      const root = b < 4 ? 55 : 73.42; // A1, D2
      tone(ctx, bus, {
        freq: root,
        type: "triangle",
        attack: 0.005,
        release: 0.2,
        gain: 0.3,
        delay: at,
      });
      tone(ctx, bus, {
        freq: root * 2,
        type: "triangle",
        attack: 0.005,
        release: 0.16,
        gain: 0.26,
        delay: at + off,
      });
    }

    // Syncopated chord stabs on the "and" of beats 2 and 4 — Am7, then Dm7.
    const chords = [
      [220, 261.63, 329.63, 392], // Am7: A3 C4 E4 G4
      [293.66, 349.23, 440, 523.25], // Dm7: D4 F4 A4 C5
    ];
    for (let bar = 0; bar < BARS; bar++) {
      for (const beatInBar of [1, 3]) {
        const at = (bar * 4 + beatInBar) * BEAT + off;
        for (const freq of chords[bar]) {
          tone(ctx, bus, {
            freq,
            type: "sawtooth",
            attack: 0.004,
            hold: 0.02,
            release: 0.12,
            gain: 0.06,
            delay: at,
          });
        }
      }
    }
  },
  // RAINBOW — a dreamy ascending shimmer up a major pentatonic, the audible
  // twin of the smooth spectral sweep; bells ring into one another over a soft
  // pad.
  rainbow(ctx, bus) {
    const notes = [
      523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51,
    ];
    notes.forEach((freq, n) =>
      tone(ctx, bus, {
        freq,
        type: "sine",
        attack: 0.01,
        release: 0.6 - n * 0.03,
        gain: 0.11,
        delay: n * 0.16,
      }),
    );
    [261.63, 392, 523.25].forEach((freq) =>
      tone(ctx, bus, {
        freq,
        type: "triangle",
        attack: 0.25,
        hold: 0.7,
        release: 0.7,
        gain: 0.06,
      }),
    );
  },
  // WARP — jump to lightspeed: a pitch accelerating upward and a rising noise
  // rush, then a low punch as it hits.
  warp(ctx, bus) {
    tone(ctx, bus, {
      freq: 110,
      slideTo: 1760,
      type: "sawtooth",
      attack: 0.01,
      release: 0.42,
      gain: 0.16,
    });
    breath(ctx, bus, {
      dur: 0.45,
      type: "bandpass",
      freq: 300,
      sweepTo: 6000,
      q: 0.6,
      gain: 0.16,
      attack: 0.05,
    });
    tone(ctx, bus, {
      freq: 200,
      slideTo: 50,
      type: "sine",
      attack: 0.002,
      release: 0.26,
      gain: 0.4,
      delay: 0.42,
    });
  },
  // WISH — a hopeful little rise: a soft arc of bells (E5 A5 E6) with a sparkle
  // at the apex, like a wish taking flight.
  wish(ctx, bus) {
    [659.25, 880, 1318.51].forEach((freq, n) =>
      tone(ctx, bus, {
        freq,
        type: "sine",
        attack: 0.02,
        release: 0.5,
        gain: 0.13,
        delay: n * 0.12,
      }),
    );
    tone(ctx, bus, {
      freq: 2637.02,
      type: "sine",
      attack: 0.004,
      release: 0.4,
      gain: 0.07,
      delay: 0.4,
    });
  },
  // SUN — a warm major chord (C E G C) blooming open, sun breaking through:
  // soft staggered attacks over a long radiant tail.
  sun(ctx, bus) {
    [261.63, 329.63, 392, 523.25].forEach((freq, n) =>
      tone(ctx, bus, {
        freq,
        type: "triangle",
        attack: 0.06 + n * 0.03,
        hold: 0.1,
        release: 0.7,
        gain: 0.12,
      }),
    );
  },
  // STORM — a deep rolling boom rumbling out under the bolts: low noise
  // swelling and decaying with a sub thump beneath.
  thunderclap(ctx, bus) {
    breath(ctx, bus, {
      dur: 1.1,
      type: "lowpass",
      freq: 200,
      sweepTo: 60,
      q: 0.8,
      gain: 0.5,
      attack: 0.04,
    });
    tone(ctx, bus, {
      freq: 70,
      slideTo: 38,
      type: "sine",
      attack: 0.01,
      hold: 0.1,
      release: 0.9,
      gain: 0.4,
    });
  },
  // QUAKE — a grinding sub-bass earthquake that swells and rolls off; lower and
  // longer than the generic shake, with a gritty saw sub under the rumble.
  quake(ctx, bus) {
    breath(ctx, bus, {
      dur: 1.4,
      type: "lowpass",
      freq: 160,
      sweepTo: 45,
      q: 1.2,
      gain: 0.5,
      attack: 0.12,
    });
    tone(ctx, bus, {
      freq: 42,
      type: "sawtooth",
      attack: 0.08,
      hold: 0.5,
      release: 0.85,
      gain: 0.32,
    });
  },
  // PARTY — a quick brassy fanfare flourish: a rising triad capped by a held
  // party-horn top note.
  party(ctx, bus) {
    [392, 523.25, 659.25, 783.99].forEach((freq, n) =>
      tone(ctx, bus, {
        freq,
        type: "sawtooth",
        attack: 0.01,
        hold: 0.04,
        release: 0.18,
        gain: 0.12,
        delay: n * 0.09,
      }),
    );
    tone(ctx, bus, {
      freq: 1046.5,
      type: "sawtooth",
      attack: 0.02,
      hold: 0.12,
      release: 0.3,
      gain: 0.12,
      delay: 0.36,
    });
  },
  // NOVA — the shock ring ripping outward: a deep impact boom under a high zing
  // that sweeps up and away.
  shockwave(ctx, bus) {
    tone(ctx, bus, {
      freq: 160,
      slideTo: 40,
      type: "sine",
      attack: 0.002,
      release: 0.35,
      gain: 0.45,
    });
    breath(ctx, bus, {
      dur: 0.5,
      type: "bandpass",
      freq: 1200,
      sweepTo: 7000,
      q: 0.5,
      gain: 0.18,
      attack: 0.01,
    });
  },
  // PULSE — a soft resonant ping for the ripple rings: a clean bell tone with a
  // gentle shimmer a fifth above.
  ping(ctx, bus) {
    tone(ctx, bus, {
      freq: 880,
      type: "sine",
      attack: 0.003,
      release: 0.5,
      gain: 0.16,
    });
    tone(ctx, bus, {
      freq: 1318.51,
      type: "sine",
      attack: 0.01,
      release: 0.4,
      gain: 0.08,
      delay: 0.04,
    });
  },
  // A lightning strike — a razor-sharp snap, a brief sizzling electric crackle
  // and a pitched zap, then a deeper rolling thunder that lags behind the flash.
  lightning(ctx, bus) {
    // The snap — an instant broadband crack.
    breath(ctx, bus, {
      dur: 0.04,
      type: "highpass",
      freq: 3500,
      q: 0.4,
      gain: 0.6,
      attack: 0.001,
    });
    // The sizzle — a bright resonant crackle riding just after.
    breath(ctx, bus, {
      dur: 0.18,
      type: "bandpass",
      freq: 5000,
      sweepTo: 2000,
      q: 1.4,
      gain: 0.26,
      attack: 0.002,
      delay: 0.02,
    });
    // A pitched zap for the electric edge.
    tone(ctx, bus, {
      freq: 2200,
      slideTo: 900,
      type: "sawtooth",
      attack: 0.001,
      release: 0.12,
      gain: 0.1,
      delay: 0.01,
    });
    // The rolling thunder, arriving a beat after the flash.
    breath(ctx, bus, {
      dur: 0.7,
      type: "lowpass",
      freq: 360,
      sweepTo: 60,
      q: 0.9,
      gain: 0.4,
      attack: 0.05,
      delay: 0.12,
    });
  },
  // A streak shooting across (comet / gust) — a doppler swoosh: the pitch rises
  // as it approaches, then drops as it sweeps past and recedes.
  streak(ctx, bus) {
    breath(ctx, bus, {
      dur: 0.25,
      type: "bandpass",
      freq: 700,
      sweepTo: 2800,
      q: 0.7,
      gain: 0.16,
      attack: 0.04,
    });
    breath(ctx, bus, {
      dur: 0.4,
      type: "bandpass",
      freq: 2800,
      sweepTo: 500,
      q: 0.7,
      gain: 0.15,
      attack: 0.02,
      delay: 0.2,
    });
  },
  // Motes gathering into orbit — a soft sweep up with open bell tones (E5 B5
  // E6) entering one after another, settling into a brief sustained ring.
  orbit(ctx, bus) {
    breath(ctx, bus, {
      dur: 0.5,
      type: "bandpass",
      freq: 600,
      sweepTo: 1600,
      q: 0.8,
      gain: 0.1,
      attack: 0.1,
    });
    [659.25, 987.77, 1318.51].forEach((freq, n) =>
      tone(ctx, bus, {
        freq,
        type: "sine",
        attack: 0.03,
        hold: 0.1,
        release: 0.5,
        gain: 0.1,
        delay: n * 0.08,
      }),
    );
  },
  // The gravity well locking in — a deep resonant pulse: a low bloom with a
  // fifth above, like mass settling into place. The continuous hum carries on
  // from here; this is the moment it forms.
  wellPulse(ctx, bus) {
    tone(ctx, bus, {
      freq: 110,
      slideTo: 80,
      type: "sine",
      attack: 0.01,
      hold: 0.06,
      release: 0.5,
      gain: 0.32,
    });
    tone(ctx, bus, {
      freq: 165,
      type: "sine",
      attack: 0.02,
      hold: 0.04,
      release: 0.4,
      gain: 0.14,
    });
  },
  // The well collapsing on release — it pays off the whole hold: energy rushing
  // inward, a deep resonant boom as it implodes, then a bright scatter as the
  // captured motes fling back out.
  wellRelease(ctx, bus) {
    // The inward suck — a quick bright-to-low rush feeding the collapse.
    breath(ctx, bus, {
      dur: 0.2,
      type: "lowpass",
      freq: 2400,
      sweepTo: 70,
      q: 0.9,
      gain: 0.4,
      attack: 0.005,
    });
    // The deep collapse boom, with a resonant tail.
    tone(ctx, bus, {
      freq: 180,
      slideTo: 36,
      type: "sine",
      attack: 0.004,
      hold: 0.04,
      release: 0.55,
      gain: 0.42,
    });
    // A sub layer for weight.
    tone(ctx, bus, {
      freq: 90,
      slideTo: 27,
      type: "triangle",
      attack: 0.006,
      hold: 0.03,
      release: 0.48,
      gain: 0.2,
    });
    // The outward scatter — a bright noise sweep flung up and out as the motes
    // release, landing just after the boom.
    breath(ctx, bus, {
      dur: 0.45,
      type: "bandpass",
      freq: 1400,
      sweepTo: 6500,
      q: 0.5,
      gain: 0.13,
      attack: 0.02,
      delay: 0.07,
    });
  },
  // Aurora settling in — a soft high shimmer pad.
  aurora(ctx, bus) {
    // A lush, slowly-swelling shimmer pad — a stacked chord (E B E B E across
    // octaves) whose partials each have a gently detuned partner beating against
    // them, so it shimmers like curtains of light. Ethereal, soft, long.
    const partials = [
      { freq: 330, gain: 0.09 },
      { freq: 494, gain: 0.08 },
      { freq: 660, gain: 0.07 },
      { freq: 988, gain: 0.05 },
      { freq: 1320, gain: 0.035 },
    ];
    partials.forEach(({ freq, gain }, n) => {
      tone(ctx, bus, {
        freq,
        type: "sine",
        attack: 0.4 + n * 0.08,
        hold: 0.4,
        release: 1.0,
        gain,
      });
      tone(ctx, bus, {
        freq: freq * 1.004,
        type: "sine",
        attack: 0.45 + n * 0.08,
        hold: 0.35,
        release: 1.0,
        gain: gain * 0.7,
      });
    });
  },
  // A meteor shower beginning — a soft falling whoosh.
  meteor(ctx, bus) {
    // A meteor tearing in — a descending whoosh, a heavy low impact as it lands,
    // and a bright scatter of debris after.
    breath(ctx, bus, {
      dur: 0.5,
      type: "bandpass",
      freq: 1400,
      sweepTo: 150,
      q: 0.7,
      gain: 0.2,
      attack: 0.05,
    });
    tone(ctx, bus, {
      freq: 140,
      slideTo: 40,
      type: "sine",
      attack: 0.004,
      hold: 0.03,
      release: 0.45,
      gain: 0.4,
      delay: 0.32,
    });
    breath(ctx, bus, {
      dur: 0.4,
      type: "highpass",
      freq: 3000,
      sweepTo: 6000,
      q: 0.5,
      gain: 0.12,
      attack: 0.02,
      delay: 0.36,
    });
  },
  // Frost breath on a click in the frozen world — a crystalline tick.
  ice(ctx, bus) {
    breath(ctx, bus, {
      dur: 0.12,
      type: "highpass",
      freq: 6000,
      q: 0.6,
      gain: 0.18,
    });
    tone(ctx, bus, {
      freq: 2400,
      slideTo: 3200,
      type: "triangle",
      attack: 0.003,
      release: 0.12,
      gain: 0.1,
    });
  },
  // A pencil stroke in the paper world — a short scratch.
  pencil(ctx, bus) {
    breath(ctx, bus, {
      dur: 0.14,
      type: "bandpass",
      freq: 1600,
      q: 0.7,
      gain: 0.16,
      attack: 0.01,
    });
  },
  // A snow-globe shake — a brief shaken rustle.
  rattle(ctx, bus) {
    breath(ctx, bus, {
      dur: 0.4,
      type: "bandpass",
      freq: 3000,
      q: 0.5,
      gain: 0.18,
      attack: 0.01,
    });
  },
  // A VHS click glitch — a short bitcrushed buzz.
  glitch(ctx, bus) {
    tone(ctx, bus, {
      freq: 140,
      slideTo: 90,
      type: "square",
      attack: 0.002,
      release: 0.12,
      gain: 0.12,
    });
    breath(ctx, bus, {
      dur: 0.12,
      type: "bandpass",
      freq: 1200,
      q: 1.5,
      gain: 0.14,
    });
  },
  // Bursting the world into voxels in the blocky theme — a chunky crunch.
  shatter(ctx, bus) {
    breath(ctx, bus, {
      dur: 0.1,
      type: "lowpass",
      freq: 800,
      sweepTo: 200,
      gain: 0.4,
    });
    tone(ctx, bus, {
      freq: 200,
      slideTo: 90,
      type: "square",
      attack: 0.002,
      release: 0.1,
      gain: 0.16,
    });
  },
  // A burst of bubbles in the deep-sea theme — a wet bloop.
  bloop(ctx, bus) {
    tone(ctx, bus, {
      freq: 500,
      slideTo: 180,
      type: "sine",
      attack: 0.004,
      release: 0.18,
      gain: 0.22,
    });
    breath(ctx, bus, {
      dur: 0.06,
      type: "bandpass",
      freq: 900,
      q: 2,
      gain: 0.1,
    });
  },
  // Thunder for a lightning flash in the rain — a sharp distant crack, a rolling
  // low rumble, and a second clap echoing off a beat later.
  thunder(ctx, bus) {
    breath(ctx, bus, {
      dur: 0.08,
      type: "highpass",
      freq: 1800,
      q: 0.5,
      gain: 0.3,
      attack: 0.002,
    });
    breath(ctx, bus, {
      dur: 1.1,
      type: "lowpass",
      freq: 200,
      sweepTo: 45,
      q: 1,
      gain: 0.34,
      attack: 0.05,
    });
    breath(ctx, bus, {
      dur: 0.5,
      type: "lowpass",
      freq: 120,
      sweepTo: 50,
      q: 1,
      gain: 0.18,
      attack: 0.04,
      delay: 0.5,
    });
  },
  // The world inverting (upside-down) — a tumbling, disorienting whoosh.
  flip(ctx, bus) {
    breath(ctx, bus, {
      dur: 0.5,
      type: "bandpass",
      freq: 1200,
      sweepTo: 300,
      q: 0.6,
      gain: 0.22,
      attack: 0.04,
    });
    tone(ctx, bus, {
      freq: 400,
      slideTo: 200,
      type: "triangle",
      attack: 0.02,
      release: 0.4,
      gain: 0.16,
    });
  },
  // Clicking a star — a bright little ping.
  twinkle(ctx, bus) {
    // Tapping a star — a tiny bright chime with shimmering overtones entering a
    // hair apart, like a struck bell of light.
    tone(ctx, bus, {
      freq: 1760,
      type: "sine",
      attack: 0.002,
      release: 0.25,
      gain: 0.15,
    });
    tone(ctx, bus, {
      freq: 2637.02,
      type: "sine",
      attack: 0.004,
      release: 0.3,
      gain: 0.07,
      delay: 0.02,
    });
    tone(ctx, bus, {
      freq: 3520,
      type: "sine",
      attack: 0.006,
      release: 0.2,
      gain: 0.04,
      delay: 0.04,
    });
  },
  // Catching a shooting star — a descending whoosh with a sparkle.
  starWhoosh(ctx, bus) {
    breath(ctx, bus, {
      dur: 0.4,
      type: "bandpass",
      freq: 3000,
      sweepTo: 800,
      q: 0.6,
      gain: 0.16,
      attack: 0.02,
    });
    tone(ctx, bus, {
      freq: 1600,
      type: "sine",
      attack: 0.005,
      release: 0.2,
      gain: 0.1,
    });
  },
  // Completing a constellation — a warm three-note chord.
  chord(ctx, bus) {
    // Completing a constellation — a warm C-major chord blooming with an
    // arpeggiated entry (the stars lighting up and connecting one by one) and a
    // high sparkle settling on top as it resolves.
    [261.63, 329.63, 392, 523.25, 659.25].forEach((freq, n) =>
      tone(ctx, bus, {
        freq,
        type: "sine",
        attack: 0.02,
        hold: 0.2,
        release: 0.8,
        gain: 0.13 - n * 0.012,
        delay: n * 0.07,
      }),
    );
    tone(ctx, bus, {
      freq: 1046.5,
      type: "sine",
      attack: 0.06,
      release: 0.7,
      gain: 0.06,
      delay: 0.32,
    });
  },
  // Tapping the wrong star while tracing — a soft low dud.
  dud(ctx, bus) {
    tone(ctx, bus, {
      freq: 160,
      slideTo: 120,
      type: "sine",
      attack: 0.005,
      release: 0.16,
      gain: 0.14,
    });
  },
  // Dev console nearing a screen edge — a sparkly rising shiver as the magnet
  // grabs it: staggered high pings over an airy top.
  shimmer(ctx, bus) {
    [0, 1, 2, 3].forEach((n) =>
      tone(ctx, bus, {
        freq: 1400 * (1 + n * 0.28),
        type: "triangle",
        attack: 0.004 + n * 0.03,
        release: 0.16,
        gain: 0.11,
      }),
    );
    breath(ctx, bus, {
      dur: 0.4,
      type: "highpass",
      freq: 6000,
      q: 0.5,
      gain: 0.08,
      attack: 0.05,
    });
  },
  // The console snapping to the edge — a crisp click, a low thunk, a faint ring.
  snap(ctx, bus) {
    breath(ctx, bus, {
      dur: 0.04,
      type: "highpass",
      freq: 3500,
      q: 0.5,
      gain: 0.4,
    });
    tone(ctx, bus, {
      freq: 180,
      slideTo: 70,
      type: "sine",
      attack: 0.002,
      release: 0.12,
      gain: 0.4,
    });
    tone(ctx, bus, {
      freq: 1200,
      type: "triangle",
      attack: 0.002,
      release: 0.14,
      gain: 0.12,
    });
  },
  // Pulling the console off the edge — a downward peel and a detaching swish.
  unsnap(ctx, bus) {
    tone(ctx, bus, {
      freq: 600,
      slideTo: 160,
      type: "triangle",
      attack: 0.003,
      release: 0.22,
      gain: 0.22,
    });
    breath(ctx, bus, {
      dur: 0.18,
      type: "bandpass",
      freq: 1500,
      sweepTo: 600,
      q: 0.7,
      gain: 0.14,
      attack: 0.01,
    });
  },
  // A theme charging toward its trigger — a tick whose pitch climbs with the
  // build-up threshold (progress 0..1), so repeated input reads as a ramp.
  buildup(ctx, bus, { progress = 0 } = {}) {
    tone(ctx, bus, {
      freq: 400 + progress * 900,
      type: "triangle",
      attack: 0.004,
      release: 0.14,
      gain: 0.16,
    });
  },
  // Konami code accepted — a cheery ascending arpeggio (C E G C).
  fanfare(ctx, bus) {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, n) =>
      tone(ctx, bus, {
        freq,
        type: "triangle",
        attack: 0.004 + n * 0.07,
        release: 0.3,
        gain: 0.2,
      }),
    );
  },
  // Opening the cheat-codes panel — a soft paper riffle and a faint chime.
  pageflip(ctx, bus) {
    breath(ctx, bus, {
      dur: 0.18,
      type: "bandpass",
      freq: 2200,
      sweepTo: 3500,
      q: 0.5,
      gain: 0.12,
      attack: 0.01,
    });
    tone(ctx, bus, {
      freq: 880,
      type: "sine",
      attack: 0.02,
      release: 0.25,
      gain: 0.1,
    });
  },
  // Switching appearance — a small tonal tick, higher toward light, lower
  // toward dark (progress 0 dark → 1 light).
  uiTick(ctx, bus, { progress = 0.5 } = {}) {
    tone(ctx, bus, {
      freq: 500 + progress * 700,
      type: "sine",
      attack: 0.003,
      release: 0.1,
      gain: 0.12,
    });
  },
  // The Cloudlog panel sliding open / closed — a soft rising / falling whoosh.
  panelOpen(ctx, bus) {
    breath(ctx, bus, {
      dur: 0.3,
      type: "bandpass",
      freq: 500,
      sweepTo: 2000,
      q: 0.6,
      gain: 0.14,
      attack: 0.02,
    });
  },
  panelClose(ctx, bus) {
    breath(ctx, bus, {
      dur: 0.25,
      type: "bandpass",
      freq: 2000,
      sweepTo: 500,
      q: 0.6,
      gain: 0.12,
      attack: 0.01,
    });
  },
  // Cursor settling on a primary call to action — the faintest high feather.
  // The lightest voice in the catalogue: it fires on every hover, so it has to
  // sit just under conscious notice.
  hoverShimmer(ctx, bus) {
    tone(ctx, bus, {
      freq: 1600,
      type: "sine",
      attack: 0.002,
      release: 0.07,
      gain: 0.05,
    });
  },
  // Powering sound on — a quick rising two-note bloom (C5 → G5).
  toggleOn(ctx, bus) {
    tone(ctx, bus, {
      freq: 523.25,
      type: "triangle",
      attack: 0.005,
      release: 0.16,
      gain: 0.2,
    });
    tone(ctx, bus, {
      freq: 783.99,
      type: "triangle",
      attack: 0.04,
      release: 0.2,
      gain: 0.18,
      delay: 0.06,
    });
  },
  // Powering sound off — a softer falling two-note (E5 → G4). The engine holds
  // its suspend briefly so this rings out before the context freezes.
  toggleOff(ctx, bus) {
    tone(ctx, bus, {
      freq: 659.25,
      type: "triangle",
      attack: 0.005,
      release: 0.16,
      gain: 0.16,
    });
    tone(ctx, bus, {
      freq: 392,
      type: "triangle",
      attack: 0.03,
      release: 0.22,
      gain: 0.15,
      delay: 0.06,
    });
  },
  // An achievement unlocking — a "premium reward" jingle in the spirit of a
  // console trophy: a soft round pop, a warm bell for body, then a crystalline
  // C-major run climbing two octaves, each partial entering a beat later (via
  // `delay`) and ringing on so they shimmer together. Distinct from the toggle
  // power-up so the two don't smear when both land on first enable.
  unlock(ctx, bus) {
    // The pop — a round bubble that drops a touch in pitch.
    tone(ctx, bus, {
      freq: 520,
      slideTo: 320,
      type: "sine",
      attack: 0.003,
      release: 0.14,
      gain: 0.2,
    });
    // A warm bell holds underneath for body and a lush tail.
    tone(ctx, bus, {
      freq: 523.25,
      type: "triangle",
      attack: 0.015,
      hold: 0.08,
      release: 0.85,
      gain: 0.15,
      delay: 0.05,
    });
    // The ascending sparkle — C6 E6 G6 C7 E7, staggered so it rises in time.
    [1046.5, 1318.51, 1567.98, 2093.0, 2637.02].forEach((freq, n) =>
      tone(ctx, bus, {
        freq,
        type: "sine",
        attack: 0.004,
        release: 0.6 - n * 0.05,
        gain: 0.12 - n * 0.011,
        delay: 0.09 + n * 0.052,
      }),
    );
  },
};

// Play a named voice. World/effect voices route through the per-theme effects
// bus; pass `ui: true` for theme-agnostic cues (toggle, unlock) that should
// play dry. Any other options are forwarded to the voice (e.g. a buildup
// tick's `progress`). No-op when sound is off, unavailable, or name unknown.
export function playSfx(name, { ui = false, ...opts } = {}) {
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
  voice(ctx, sfxGain, opts);
}
