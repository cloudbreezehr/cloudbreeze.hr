// ── Sound Toggle ──
// Wires the nav speaker button to the audio engine: reflects the current
// on/off state (icon swap via `data-sound`, tooltip, aria-pressed) and flips it
// on click. The click is the user gesture the engine needs to resume the
// audio context.

import { isSoundEnabled, toggleSound, onSoundChange } from "./engine.js";
import { playSfx } from "./sfx.js";

const TOOLTIP_ON = "Sound on";
const TOOLTIP_OFF = "Sound off";

export function initSoundToggle(buttonEl) {
  if (!buttonEl) return;

  function paint(on) {
    buttonEl.setAttribute("data-sound", on ? "on" : "off");
    buttonEl.setAttribute("data-tooltip", on ? TOOLTIP_ON : TOOLTIP_OFF);
    buttonEl.setAttribute("aria-pressed", String(on));
  }

  paint(isSoundEnabled());
  buttonEl.addEventListener("click", () => {
    toggleSound();
    // A confirmation note on turn-on — the click resumed the context, so this
    // is the first thing the visitor hears (and proof it's working).
    if (isSoundEnabled()) playSfx("chime");
  });
  onSoundChange(paint);
}
