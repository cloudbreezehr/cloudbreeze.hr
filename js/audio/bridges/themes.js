// ── Themes Audio Bridge ──
// Applies a theme's sound identity — its effects-bus tint and an entry/exit cue
// — from the theme lifecycle events the factory already dispatches, so a theme
// sounds the same however it's entered (HUD, URL, hidden trigger, typing) and
// the theme modules stay unaware of audio.
//
// Winner = most-recently-activated theme still in the stack. Tracked here from
// the events rather than read from `body.dataset.activeTheme` so it updates the
// instant a theme toggles (the dataset winner is only resolved on the next
// render frame) and stays unit-testable. In a rare multi-theme stack this can
// differ from the render loop's declaration-order fallback — an inaudible
// enough divergence not to chase.
//
// The tint is applied only while sound is on: applying it builds the audio
// graph, and a muted visitor shouldn't manufacture an AudioContext just by
// triggering a theme. onSoundChange re-applies the active theme's tint the
// moment sound is turned on.

import { setThemeFilter } from "../bus.js";
import { themeFilter } from "../theme-sounds.js";
import { playSfx } from "../sfx.js";
import { isSoundEnabled, onSoundChange } from "../engine.js";

export function initThemesAudioBridge() {
  const stack = []; // active theme ids, most-recent last

  function applyWinner() {
    if (!isSoundEnabled()) return; // applying the tint would build the graph
    const winner = stack.length ? stack[stack.length - 1] : null;
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
  // Colour the active theme the moment sound is enabled (the activations that
  // happened while muted never built the graph).
  const releaseSoundChange = onSoundChange((on) => {
    if (on) applyWinner();
  });
  return () => {
    window.removeEventListener("achievement", onAchievement);
    releaseSoundChange();
  };
}
