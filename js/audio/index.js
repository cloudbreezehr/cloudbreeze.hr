// ── Audio Subsystem ──
// Entry point wired from bootstrap. Arms the engine (gesture resume + tab
// suspend) and mounts the nav toggle. Sound stays silent until the visitor
// turns it on; the voices and event bridges that actually make noise are
// registered here as they're added.

import { initEngine } from "./engine.js";
import { initSoundToggle } from "./toggle.js";
import { initThemesAudioBridge } from "./bridges/themes.js";
import { initAchievementsAudioBridge } from "./bridges/achievements.js";
import { initPointerAudioBridge } from "./bridges/pointer.js";
import { initWorldAudioBridge } from "./bridges/world.js";
import { initThemeEffectsAudioBridge } from "./bridges/theme-effects.js";
import { initDockAudioBridge } from "./bridges/dock.js";
import { initDiscoveryAudioBridge } from "./bridges/discovery.js";
import { initUiAudioBridge } from "./bridges/ui.js";
import { initContinuous } from "./continuous.js";

export function initAudio() {
  initEngine();
  initSoundToggle(document.querySelector(".sound-toggle"));
  initThemesAudioBridge();
  initAchievementsAudioBridge();
  initPointerAudioBridge();
  initWorldAudioBridge();
  initThemeEffectsAudioBridge();
  initDockAudioBridge();
  initDiscoveryAudioBridge();
  initUiAudioBridge();
  initContinuous();
}
