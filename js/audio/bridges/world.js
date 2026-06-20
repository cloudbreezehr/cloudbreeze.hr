// ── World Effects Audio Bridge ──
// Sounds the canvas-internal effects that announce themselves through the
// existing achievement event stream — the gravity well's charge → engage →
// full → release arc, the orbit it spins up, and the click-fury tiers
// (lightning, aurora, meteors) — so the canvas modules stay unaware of audio.
// Routed through the effects bus, so the active theme colours them.

import { playSfx } from "../sfx.js";

const EVENT_VOICE = {
  hold: "charge",
  "well-activate": "wellEngage",
  "well-full": "wellFull",
  "well-release": "wellRelease",
  orbit: "orbit",
  "fury-lightning": "lightning",
  "fury-aurora": "aurora",
  "fury-meteor": "meteor",
};

export function initWorldAudioBridge() {
  function onAchievement(e) {
    const voice = EVENT_VOICE[(e.detail || {}).type];
    if (voice) playSfx(voice);
  }
  window.addEventListener("achievement", onAchievement);
  return () => window.removeEventListener("achievement", onAchievement);
}
