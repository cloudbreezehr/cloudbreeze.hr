// ── World Effects Audio Bridge ──
// Sounds the discrete canvas-internal effects that announce themselves through
// the achievement event stream — the orbit a hold spins up, and the
// aurora/meteor fury tiers (once per activation) — so the canvas modules stay
// unaware of audio.
//
// Two effects are handled elsewhere on purpose: lightning sounds per bolt in
// fury.js (a bolt spawns on every click in the tier), and the gravity well's
// charge/release is a continuous hum in continuous.js (driven by hold strength)
// rather than discrete cues.

import { eventVoiceBridge } from "./event-voice.js";

export const initWorldAudioBridge = eventVoiceBridge({
  orbit: "orbit",
  "fury-aurora": "aurora",
  "fury-meteor": "meteor",
});
