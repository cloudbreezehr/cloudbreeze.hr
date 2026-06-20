// ── Incantations Audio Bridge ──
// Gives each cast a voice. Listens to the same "incantation" achievement event
// the words already dispatch, so incantations.js stays unaware of audio. A
// charged cast (maxed) plays the beefier variant of its voice.

import { playSfx } from "../sfx.js";

// Word → voice. Several words share a voice — the family they belong to
// (rocket volleys, light streaks) reads as one sound.
const WORD_VOICE = {
  BOOM: "boom",
  DEPLOY: "boom",
  NOVA: "boom",
  PARTY: "boom",
  STORM: "thunder",
  BOLT: "zap",
  STAR: "sparkle",
  PULSE: "pulse",
  CONFETTI: "pop",
  SNOW: "shimmer",
  SUDO: "surge",
  GLOW: "swell",
  SUN: "swell",
  QUAKE: "rumble",
  ORBIT: "whirl",
  DISCO: "gliss",
  RAINBOW: "gliss",
  COMET: "whoosh",
  WARP: "whoosh",
  GUST: "whoosh",
  WISH: "whoosh",
};

export function initIncantationsAudioBridge() {
  function onAchievement(e) {
    const d = e.detail || {};
    if (d.type !== "incantation" || !d.word) return;
    const voice = WORD_VOICE[d.word];
    if (voice) playSfx(voice, { intensity: d.maxed ? 1 : 0 });
  }
  window.addEventListener("achievement", onAchievement);
  return () => window.removeEventListener("achievement", onAchievement);
}
