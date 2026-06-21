// ── Achievements Audio Bridge ──
// Sounds the trophy jingle whenever an achievement unlocks. Listens to the
// "analytics-unlock" window event the Cloudlog already emits for observers, so
// the achievement system stays unaware of audio.
//
// One action can satisfy several achievements at once (the trigger, a
// milestone, a set, completionist), each firing its own unlock event in the
// same tick. The jingle is long and lush, so a burst would stack into a muddy
// wash — collapse it: play on the leading edge, then ignore repeats for a short
// window so a cascade is heard as a single reward.

import { playSfx } from "../sfx.js";

export const COALESCE_MS = 300;

export function initAchievementsAudioBridge() {
  let last = 0;
  function onUnlock() {
    const now = Date.now();
    if (now - last < COALESCE_MS) return;
    last = now;
    playSfx("unlock", { ui: true });
  }
  window.addEventListener("analytics-unlock", onUnlock);
  return () => window.removeEventListener("analytics-unlock", onUnlock);
}
