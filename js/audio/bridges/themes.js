// ── Themes Audio Bridge ──
// Applies a theme's sound identity — its ambient bed and its effects-bus tint —
// from the theme lifecycle events the factory already dispatches, so the theme
// modules stay unaware of audio. Mirrors the render loop's "last-triggered
// wins" rule: the most recently activated theme still in the stack owns the
// sound, so toggling between stacked themes crossfades the bed and re-tints.

import { setBed } from "../beds.js";
import { setThemeFilter } from "../bus.js";
import { themeFilter } from "../theme-sounds.js";

export function initThemesAudioBridge() {
  const stack = []; // active theme ids, most-recent last

  function applyWinner() {
    const winner = stack.length ? stack[stack.length - 1] : null;
    setBed(winner);
    setThemeFilter(themeFilter(winner));
  }

  function onAchievement(e) {
    const d = e.detail || {};
    if (d.type === "theme-activate" && d.theme) {
      const i = stack.indexOf(d.theme);
      if (i >= 0) stack.splice(i, 1);
      stack.push(d.theme);
      applyWinner();
    } else if (d.type === "theme-deactivate" && d.theme) {
      const i = stack.indexOf(d.theme);
      if (i >= 0) stack.splice(i, 1);
      applyWinner();
    }
  }

  window.addEventListener("achievement", onAchievement);
  return () => window.removeEventListener("achievement", onAchievement);
}
