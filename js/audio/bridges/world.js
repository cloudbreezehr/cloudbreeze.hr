// ── World Effects Audio Bridge ──
// Sounds the canvas-internal effects that announce themselves through the
// existing achievement event stream — the gravity well's charge → engage →
// full → release arc, the orbit it spins up, and the aurora/meteor fury tiers
// (once per activation) — so the canvas modules stay unaware of audio.
//
// Lightning is deliberately absent: a bolt spawns on every click in the tier,
// so fury.js sounds each one at its spawn rather than once via the tier event.

import { eventVoiceBridge } from "./event-voice.js";

export const initWorldAudioBridge = eventVoiceBridge({
  hold: "charge",
  "well-activate": "wellEngage",
  "well-full": "wellFull",
  "well-release": "wellRelease",
  orbit: "orbit",
  "fury-aurora": "aurora",
  "fury-meteor": "meteor",
});
