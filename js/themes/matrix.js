import { defineConstants } from "../dev/registry.js";
import { createMatrix } from "../particles/matrix.js";
import { createTheme } from "./factory.js";
import { registerCanvasHooks } from "./canvas-hooks.js";
import { createKeySequenceTrigger } from "./triggers.js";

// Theme metadata (id, label, color, icon) lives in themes/registry.js.
// This file is for behavior only.

// ── Force & Activation ──
// Typing REDPILL charges the theme; BLUEPILL unplugs back out. (Spelling the
// theme's name — MATRIX — also toggles it via the cross-cutting speller.)
const MF = defineConstants(
  "themes.matrix.force",
  {
    CHARGE_AT: 0.4, // green charge glow begins
    PRE_TRIGGER_AT: 0.85, // imminent-trigger pulse
    WIPE_COVER_MS: 450,
    WIPE_REVEAL_MS: 650,
  },
  { theme: "matrix" },
);

export function initMatrix() {
  // A resolved hidden word in the rain is a discovery — award it.
  const matrix = createMatrix({
    onDecode: () => {
      window.dispatchEvent(
        new CustomEvent("achievement", { detail: { type: "matrix-decode" } }),
      );
    },
  });

  // Buildup overlay — a green wash that deepens as REDPILL is typed. Lives in
  // the DOM (opacity 0 at rest) like the other themes' indicator overlays.
  const chargeGlow = document.createElement("div");
  chargeGlow.className = "matrix-charge";
  chargeGlow.setAttribute("aria-hidden", "true");
  document.body.appendChild(chargeGlow);

  // The code rain owns its own full-screen canvas; the theme mounts it while
  // active and ticks its draw once per frame from the canvas hook. The sky and
  // atmosphere are suppressed — the rain replaces the backdrop entirely.
  registerCanvasHooks("matrix", {
    suppressSky: true,
    suppressAtmosphere: true,
    drawAmbient(frame) {
      matrix.draw(frame);
    },
    onClick(p) {
      matrix.click(p.x, p.y);
    },
  });

  createTheme({
    id: "matrix",
    trigger: createKeySequenceTrigger({
      activationWords: ["REDPILL"],
      deactivationWords: ["BLUEPILL"],
    }),
    indicators: [
      // ── 1. Charge glow — a green wash deepening as the code builds ──
      {
        threshold: MF.CHARGE_AT,
        apply(progress) {
          if (progress < MF.CHARGE_AT) {
            chargeGlow.style.opacity = "0";
            return;
          }
          const t = Math.min(1, (progress - MF.CHARGE_AT) / (1 - MF.CHARGE_AT));
          chargeGlow.style.opacity = t.toFixed(3);
        },
        clear() {
          chargeGlow.style.opacity = "0";
        },
      },
      // ── 2. Pre-trigger pulse — a body class CSS consumes for the final cue ──
      {
        threshold: MF.PRE_TRIGGER_AT,
        apply(progress) {
          document.body.classList.toggle(
            "matrix-pre-trigger",
            progress >= MF.PRE_TRIGGER_AT,
          );
        },
        clear() {
          document.body.classList.remove("matrix-pre-trigger");
        },
      },
    ],
    wipe: {
      className: "matrix-wipe",
      reverseModifier: "reverse", // exit sweeps with the brighter reverse gradient
      coverMs: MF.WIPE_COVER_MS,
      revealMs: MF.WIPE_REVEAL_MS,
    },
    onActivate() {
      document.body.appendChild(matrix.canvas);
    },
    onDeactivate() {
      matrix.canvas.remove();
      matrix.clear();
    },
  });
}
