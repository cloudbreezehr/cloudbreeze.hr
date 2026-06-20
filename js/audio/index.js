// ── Audio Subsystem ──
// Entry point wired from bootstrap. Arms the engine (gesture resume + tab
// suspend) and mounts the nav toggle. Sound stays silent until the visitor
// turns it on; the voices and event bridges that actually make noise are
// registered here as they're added.

import { initEngine } from "./engine.js";
import { initSoundToggle } from "./toggle.js";
import { initBeds } from "./beds.js";
import { initThemesAudioBridge } from "./bridges/themes.js";
import { initAchievementsAudioBridge } from "./bridges/achievements.js";

export function initAudio() {
  initEngine();
  initBeds();
  initSoundToggle(document.querySelector(".sound-toggle"));
  initThemesAudioBridge();
  initAchievementsAudioBridge();
}
