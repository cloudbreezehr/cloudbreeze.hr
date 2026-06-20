// ── Sound Toggle ──
// Wires the nav speaker button to the audio engine: reflects the current
// on/off state (icon swap via `data-sound`, tooltip, aria-pressed) and flips it
// on click. The click is the user gesture the engine needs to resume the
// audio context.

import { isSoundEnabled, toggleSound, onSoundChange } from "./engine.js";

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
  buttonEl.addEventListener("click", () => toggleSound());
  onSoundChange(paint);
}
