// ── Sound Toggle ──
// Wires the nav speaker button to the audio engine: reflects the current
// on/off state (icon swap via `data-sound`, tooltip, aria-pressed) and flips it
// on click. The click is the user gesture the engine needs to resume the
// audio context.
//
// Progressive disclosure: an agency landing page shouldn't greet a first-time
// visitor with an audio control, so the button stays hidden (CSS default) until
// the visitor signals interest — sound was already enabled on a past visit,
// they've come back, they've dwelled past a threshold this visit, or they
// spelled the reveal word (`revealSoundToggle`). Once revealed it stays
// revealed (the return-visit flag persists). Its nav slot is reserved, so
// revealing it shifts nothing.

import { isSoundEnabled, toggleSound, onSoundChange } from "./engine.js";
import { playSfx } from "./sfx.js";
import { defineConstants } from "../dev/registry.js";

const TOOLTIP_ON = "Sound on";
const TOOLTIP_OFF = "Sound off";
// Persisted once the site has been loaded before — drives the return-visit
// reveal. Set on first load so every later visit reveals the toggle at once.
const VISITED_KEY = "cb_visited";

const REVEAL = defineConstants("audio.toggle", {
  DWELL_MS: {
    value: 180000,
    min: 0,
    max: 600000,
    step: 10000,
    description: "Dwell before the sound toggle appears on a first visit",
  },
});

let buttonEl = null;
let revealed = false;

function reveal() {
  if (revealed) return;
  revealed = true;
  if (buttonEl) buttonEl.classList.add("revealed");
}

// Surface the toggle on demand — used by the spell path (typing SOUND) so a
// curious visitor doesn't have to wait out the dwell. Idempotent.
export function revealSoundToggle() {
  reveal();
}

// Read whether the site has been loaded before, marking it visited for next
// time. Returns true for a returning visitor.
function visitedBefore() {
  try {
    const seen = localStorage.getItem(VISITED_KEY) === "1";
    localStorage.setItem(VISITED_KEY, "1");
    return seen;
  } catch {
    return false;
  }
}

export function initSoundToggle(el) {
  buttonEl = el;
  if (!buttonEl) return;

  function paint(on) {
    buttonEl.setAttribute("data-sound", on ? "on" : "off");
    buttonEl.setAttribute("data-tooltip", on ? TOOLTIP_ON : TOOLTIP_OFF);
    buttonEl.setAttribute("aria-pressed", String(on));
  }

  paint(isSoundEnabled());
  buttonEl.addEventListener("click", () => {
    // Directional UI cues, played dry rather than through the active theme's
    // tint. The falling power-down must fire while the context is still live
    // (the engine defers its suspend so it rings out); the rising power-up
    // fires after the click resumes the context — the first thing heard.
    const wasOn = isSoundEnabled();
    if (wasOn) playSfx("toggleOff", { ui: true });
    toggleSound();
    if (!wasOn) playSfx("toggleOn", { ui: true });
  });
  onSoundChange(paint);

  // Reveal now if the visitor already cares (sound on, or a return visit);
  // otherwise wait out the dwell. Always mark visited so the next visit is a
  // return regardless of which path fires.
  const returning = visitedBefore();
  if (isSoundEnabled() || returning) reveal();
  else setTimeout(reveal, REVEAL.DWELL_MS);
}

// Test hook — drop the singleton button + revealed latch between runs.
export function _resetForTests() {
  buttonEl = null;
  revealed = false;
}
