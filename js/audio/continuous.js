// ── Continuous Voices ──
// Sustained voices driven each frame by the live interaction state: a drag
// whoosh that brightens and swells with cursor speed, and a gravity-well hum
// that rises in pitch and level across a press-and-hold, discharging when the
// well it formed is released. Unlike the one-shot effect voices, these are
// persistent nodes whose gain/cutoff/pitch are eased toward per-frame targets
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
    value: 0.22,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Gravity-well hum level at full strength",
  },
});

const GLIDE_S = 0.06; // setTargetAtTime time constant — smooth but responsive
const DRAG_SPEED_REF = 35; // px/frame mapping to full whoosh
const DRAG_CUTOFF_MIN = 400; // bandpass cutoff at rest (Hz)
const DRAG_CUTOFF_RANGE = 2600; // … added at full speed
const WELL_FREQ_BASE = 55; // hum pitch at zero strength (Hz)
const WELL_FREQ_RANGE = 110; // … added at full strength

let rafId = null;
let drag = null; // { gain, filter }
let well = null; // { gain, osc }
let prevX = null;
let prevY = null;
let prevWell = 0;

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

  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.value = WELL_FREQ_BASE;
  const wellGain = ctx.createGain();
  wellGain.gain.value = 0;
  osc.connect(wellGain);
  wellGain.connect(bus);
  osc.start();
  well = { gain: wellGain, osc };
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

  // Drag whoosh — brightness + level from cursor speed while dragging.
  let speed = 0;
  if (f && f.isDragging) {
    if (prevX != null)
      speed = Math.hypot(f.dragPos.x - prevX, f.dragPos.y - prevY);
    prevX = f.dragPos.x;
    prevY = f.dragPos.y;
  } else {
    prevX = prevY = null;
  }
  const dragLevel = Math.min(speed / DRAG_SPEED_REF, 1);
  drag.gain.gain.setTargetAtTime(dragLevel * CONT.DRAG_GAIN, t, GLIDE_S);
  drag.filter.frequency.setTargetAtTime(
    DRAG_CUTOFF_MIN + dragLevel * DRAG_CUTOFF_RANGE,
    t,
    GLIDE_S,
  );

  // Gravity-well hum — rises in pitch + level across the whole press-and-hold
  // (holdStrength, which starts the moment you hold), then discharges when a
  // real well (wellStrength, the later ramp) collapses on release. A quick
  // click barely moves holdStrength and never forms a well, so it stays quiet.
  const hold = f ? f.holdStrength : 0;
  const w = f ? f.wellStrength : 0;
  well.gain.gain.setTargetAtTime(hold * CONT.WELL_GAIN, t, GLIDE_S);
  well.osc.frequency.setTargetAtTime(
    WELL_FREQ_BASE + hold * WELL_FREQ_RANGE,
    t,
    GLIDE_S,
  );
  if (prevWell > 0 && w === 0) playSfx("wellRelease");
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
}

export function initContinuous() {
  onSoundChange((on) => (on ? start() : stop()));
  if (isSoundEnabled()) start();
}

// Test hook — stop the loop and drop the voices.
export function _resetForTests() {
  stop();
  drag = null;
  well = null;
}
