// ── Themes Audio Bridge ──
// Applies a theme's sound identity — its effects-bus tint, its ambient bed (for
// the two ambient worlds), and an entry/exit cue — from the theme lifecycle
// events the factory already dispatches, so a theme sounds the same however
// it's entered (HUD, URL, hidden trigger, typing) and the theme modules stay
// unaware of audio. Mirrors the render loop's "last-triggered wins" rule: the
// most recently activated theme still in the stack owns the sound.

import { setBed } from "../beds.js";
import { setThemeFilter } from "../bus.js";
import { themeFilter } from "../theme-sounds.js";
import { playSfx } from "../sfx.js";
import { isSoundEnabled } from "../engine.js";

export function initThemesAudioBridge() {
  const stack = []; // active theme ids, most-recent last

  function applyWinner() {
    const winner = stack.length ? stack[stack.length - 1] : null;
    setBed(winner);
    // Set the tint before the cue plays so the cue takes on the new colour.
    setThemeFilter(themeFilter(winner));
  }

  function onAchievement(e) {
    const d = e.detail || {};
    if (d.type === "theme-activate" && d.theme) {
      const i = stack.indexOf(d.theme);
      if (i >= 0) stack.splice(i, 1);
      stack.push(d.theme);
      applyWinner();
      playSfx("themeIn");
      // Credit "heard" only when sound is actually on, so Perfect Pitch tracks
      // themes the visitor truly heard — independent of how they were entered.
      if (isSoundEnabled()) {
        window.dispatchEvent(
          new CustomEvent("achievement", {
            detail: { type: "theme-sound-heard", theme: d.theme },
          }),
        );
      }
    } else if (d.type === "theme-deactivate" && d.theme) {
      const i = stack.indexOf(d.theme);
      if (i >= 0) stack.splice(i, 1);
      applyWinner();
      playSfx("themeOut");
    }
  }

  window.addEventListener("achievement", onAchievement);
  return () => window.removeEventListener("achievement", onAchievement);
}
