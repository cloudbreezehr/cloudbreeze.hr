// ── Continuous Voices ──
// Sustained voices driven each frame by the live interaction state: a drag
// whoosh that brightens and swells with cursor speed, and a gravity-well hum
// that deepens, throbs, and gathers an overtone across a press-and-hold,
// discharging when the well it formed is released. Unlike the one-shot voices,
// these are persistent nodes whose gain/cutoff/pitch are eased toward per-frame
// targets
// (setTargetAtTime, so no zipper). The polling loop runs only while sound is
// enabled, and the nodes are built lazily the first time it ticks — so a muted
// visitor never spins up a context or a rAF.

import { audioContext, isSoundEnabled, onSoundChange } from "./engine.js";
import { effectsBus } from "./bus.js";
import { whiteNoise } from "./noise.js";
import { playSfx } from "./sfx.js";
import { getForces } from "../canvas.js";
import { defineConstants } from "../dev/registry.js";

const CONT = defineConstants("audio.continuous", {
  DRAG_GAIN: {
    value: 0.18,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Drag whoosh level at full speed",
  },
  WELL_GAIN: {
    value: 0.1,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Gravity-well hum level at full strength",
  },
});

const GLIDE_S = 0.06; // setTargetAtTime time constant — smooth but responsive
export const DRAG_SPEED_REF = 35; // px/frame mapping to full whoosh
const DRAG_CUTOFF_MIN = 400; // bandpass cutoff at rest (Hz)
const DRAG_CUTOFF_RANGE = 2600; // … added at full speed
const WELL_FREQ_BASE = 40; // deep hum fundamental at zero strength (Hz)
const WELL_FREQ_RANGE = 90; // … added at full strength
const WELL_DETUNE_BASE = 0.8; // beat between the two oscillators at rest (Hz)
const WELL_DETUNE_RANGE = 2.2; // … added at full — the throb quickens as it builds
const WELL_FIFTH_RATIO = 1.5; // a perfect-fifth overtone above the fundamental
const WELL_FIFTH_LEVEL = 0.4; // its level (relative to the fundamentals) at full
const WELL_CUTOFF_BASE = 130; // lowpass at rest — deep and muffled (Hz)
const WELL_CUTOFF_RANGE = 680; // … opens as the well intensifies

let rafId = null;
let drag = null; // { gain, filter }
let well = null; // { gain, osc }
let prevX = null;
let prevY = null;
let prevWell = 0;
let dragActive = false; // true while the drag voice still needs per-frame writes
let wellActive = false; // true while the well voice still needs per-frame writes

function buildVoices(ctx, bus) {
  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = whiteNoise(ctx);
  noiseSrc.loop = true;
  const dragFilter = ctx.createBiquadFilter();
  dragFilter.type = "bandpass";
  dragFilter.frequency.value = DRAG_CUTOFF_MIN;
  dragFilter.Q.value = 0.7;
  const dragGain = ctx.createGain();
  dragGain.gain.value = 0;
  noiseSrc.connect(dragFilter);
  dragFilter.connect(dragGain);
  dragGain.connect(bus);
  noiseSrc.start();
  drag = { gain: dragGain, filter: dragFilter };

  // Gravity-well hum — two near-detuned sub oscillators beat against each other
  // for a slow throb, a perfect-fifth overtone swells in as the well builds, and
  // a lowpass opens with strength: a deep mass gathering, not a flat buzz.
  const wellGain = ctx.createGain();
  wellGain.gain.value = 0;
  const wellFilter = ctx.createBiquadFilter();
  wellFilter.type = "lowpass";
  wellFilter.frequency.value = WELL_CUTOFF_BASE;
  wellFilter.Q.value = 0.8;
  wellGain.connect(wellFilter);
  wellFilter.connect(bus);

  const sub = ctx.createOscillator();
  sub.type = "sine";
  sub.frequency.value = WELL_FREQ_BASE;
  sub.connect(wellGain);
  sub.start();

  const beat = ctx.createOscillator();
  beat.type = "sine";
  beat.frequency.value = WELL_FREQ_BASE + WELL_DETUNE_BASE;
  beat.connect(wellGain);
  beat.start();

  // The fifth rides its own gain so it can emerge with hold (≈ hold², since the
  // master gain also scales with hold) rather than being present from the start.
  const fifth = ctx.createOscillator();
  fifth.type = "sine";
  fifth.frequency.value = WELL_FREQ_BASE * WELL_FIFTH_RATIO;
  const fifthGain = ctx.createGain();
  fifthGain.gain.value = 0;
  fifth.connect(fifthGain);
  fifthGain.connect(wellGain);
  fifth.start();

  well = { gain: wellGain, filter: wellFilter, sub, beat, fifth, fifthGain };
}

function tick() {
  rafId = requestAnimationFrame(tick);
  if (!isSoundEnabled()) return;
  const ctx = audioContext();
  const bus = effectsBus();
  if (!ctx || !bus) return;
  if (!drag) buildVoices(ctx, bus);

  const f = getForces();
  const t = ctx.currentTime;

  // Drag whoosh — brightness + level from cursor speed while dragging. On the
  // frame the drag ends we write the rest target once more and let the glide
  // coast; after that we leave the params alone so an idle loop schedules
  // nothing (setTargetAtTime keeps easing toward the last target on its own).
  const dragging = !!(f && f.isDragging);
  let speed = 0;
  if (dragging) {
    if (prevX != null)
      speed = Math.hypot(f.dragPos.x - prevX, f.dragPos.y - prevY);
    prevX = f.dragPos.x;
    prevY = f.dragPos.y;
  } else {
    prevX = prevY = null;
  }
  if (dragging || dragActive) {
    const dragLevel = dragging ? Math.min(speed / DRAG_SPEED_REF, 1) : 0;
    drag.gain.gain.setTargetAtTime(dragLevel * CONT.DRAG_GAIN, t, GLIDE_S);
    drag.filter.frequency.setTargetAtTime(
      DRAG_CUTOFF_MIN + dragLevel * DRAG_CUTOFF_RANGE,
      t,
      GLIDE_S,
    );
    dragActive = dragging;
  }

  // Gravity-well hum — rises in pitch + level across the whole press-and-hold
  // (holdStrength, which starts the moment you hold), then discharges when a
  // real well (wellStrength, the later ramp) collapses on release. A quick
  // click barely moves holdStrength and never forms a well, so it stays quiet.
  const hold = f ? f.holdStrength : 0;
  const w = f ? f.wellStrength : 0;
  if (hold > 0 || wellActive) {
    const freq = WELL_FREQ_BASE + hold * WELL_FREQ_RANGE;
    well.sub.frequency.setTargetAtTime(freq, t, GLIDE_S);
    well.beat.frequency.setTargetAtTime(
      freq + WELL_DETUNE_BASE + hold * WELL_DETUNE_RANGE,
      t,
      GLIDE_S,
    );
    well.fifth.frequency.setTargetAtTime(freq * WELL_FIFTH_RATIO, t, GLIDE_S);
    well.fifthGain.gain.setTargetAtTime(hold * WELL_FIFTH_LEVEL, t, GLIDE_S);
    well.filter.frequency.setTargetAtTime(
      WELL_CUTOFF_BASE + hold * WELL_CUTOFF_RANGE,
      t,
      GLIDE_S,
    );
    well.gain.gain.setTargetAtTime(hold * CONT.WELL_GAIN, t, GLIDE_S);
    wellActive = hold > 0;
  }
  // On release the well snaps to 0 in one frame, so prevWell holds the charge
  // it reached — pass it through so the boom pays off how long it was held.
  if (prevWell > 0 && w === 0) playSfx("wellRelease", { strength: prevWell });
  prevWell = w;
}

function start() {
  if (rafId == null) rafId = requestAnimationFrame(tick);
}

function stop() {
  if (rafId != null) cancelAnimationFrame(rafId);
  rafId = null;
  if (drag) drag.gain.gain.value = 0;
  if (well) well.gain.gain.value = 0;
  prevX = prevY = null;
  prevWell = 0;
  dragActive = wellActive = false;
}

export function initContinuous() {
  const off = onSoundChange((on) => (on ? start() : stop()));
  if (isSoundEnabled()) start();
  return () => {
    off();
    stop();
  };
}
