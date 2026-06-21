// ── Pointer Audio Bridge ──
// A soft tap voicing the default click-burst, off the click-burst event
// canvas.js dispatches for non-UI clicks. Routed through the effects bus so the
// active theme tints it for free. Stays silent when the default burst was
// suppressed — a theme that draws its own click visual sounds that instead, so
// the tap never plays for a burst that didn't render.

import { playSfx } from "../sfx.js";

export function initPointerAudioBridge() {
  function onAchievement(e) {
    const d = e.detail || {};
    if (d.type === "click-burst" && !d.suppressDefault) playSfx("click");
  }
  window.addEventListener("achievement", onAchievement);
  return () => window.removeEventListener("achievement", onAchievement);
}
