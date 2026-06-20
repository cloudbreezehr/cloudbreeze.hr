// ── World Effects Audio Bridge ──
// Sounds the canvas-internal effects that announce themselves through the
// existing achievement event stream — the gravity well's charge → engage →
// full → release arc, the orbit it spins up, and the click-fury tiers
// (lightning, aurora, meteors) — so the canvas modules stay unaware of audio.

import { eventVoiceBridge } from "./event-voice.js";

export const initWorldAudioBridge = eventVoiceBridge({
  hold: "charge",
  "well-activate": "wellEngage",
  "well-full": "wellFull",
  "well-release": "wellRelease",
  orbit: "orbit",
  "fury-lightning": "lightning",
  "fury-aurora": "aurora",
  "fury-meteor": "meteor",
});
