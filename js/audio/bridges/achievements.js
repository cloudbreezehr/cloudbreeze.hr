// ── Achievements Audio Bridge ──
// Sounds a short note whenever an achievement unlocks. Listens to the
// "analytics-unlock" window event the Cloudlog already emits for observers, so
// the achievement system stays unaware of audio.

import { playSfx } from "../sfx.js";

export function initAchievementsAudioBridge() {
  function onUnlock() {
    playSfx("unlock");
  }
  window.addEventListener("analytics-unlock", onUnlock);
  return () => window.removeEventListener("analytics-unlock", onUnlock);
}
