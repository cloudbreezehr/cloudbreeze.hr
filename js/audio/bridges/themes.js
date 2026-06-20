// ── Themes Audio Bridge ──
// Drives the ambient bed from theme lifecycle events the factory already
// dispatches, so the theme modules stay unaware of audio. Mirrors the render
// loop's "last-triggered wins" rule: the most recently activated theme still
// in the stack owns the bed, so toggling between stacked themes crossfades.

import { setBed } from "../beds.js";

export function initThemesAudioBridge() {
  const stack = []; // active theme ids, most-recent last

  function onAchievement(e) {
    const d = e.detail || {};
    if (d.type === "theme-activate" && d.theme) {
      const i = stack.indexOf(d.theme);
      if (i >= 0) stack.splice(i, 1);
      stack.push(d.theme);
      setBed(d.theme);
    } else if (d.type === "theme-deactivate" && d.theme) {
      const i = stack.indexOf(d.theme);
      if (i >= 0) stack.splice(i, 1);
      setBed(stack.length ? stack[stack.length - 1] : null);
    }
  }

  window.addEventListener("achievement", onAchievement);
  return () => window.removeEventListener("achievement", onAchievement);
}
