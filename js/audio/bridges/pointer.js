// ── Pointer Audio Bridge ──
// A soft tap on every world click, off the click-burst event canvas.js already
// dispatches (it fires only for clicks that aren't on UI controls). Routed
// through the effects bus, so the active theme tints it for free.

import { playSfx } from "../sfx.js";

export function initPointerAudioBridge() {
  function onAchievement(e) {
    if ((e.detail || {}).type === "click-burst") playSfx("click");
  }
  window.addEventListener("achievement", onAchievement);
  return () => window.removeEventListener("achievement", onAchievement);
}
