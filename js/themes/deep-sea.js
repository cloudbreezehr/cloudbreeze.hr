import { defineConstants } from "../dev/registry.js";
import { getCanvasCtx } from "../canvas-utils.js";
import { spawnRipple } from "../effects/ripple.js";
import { enableCardEffects } from "../service-cards.js";
import { createDeepSea } from "../particles/deep-sea.js";
import { createTheme } from "./factory.js";
import { hasActiveThemeExcept } from "./registry.js";
import { registerCanvasHooks } from "./canvas-hooks.js";
import { createHoldTrigger } from "./triggers.js";

// ── Particle counts ──
const COUNTS = defineConstants(
  "themes.deepSea.particles",
  {
    BUBBLE: {
      value: 30,
      min: 0,
      max: 100,
      step: 1,
      description: "Bubble pool size",
    },
    JELLY: {
      value: 8,
      min: 0,
      max: 30,
      step: 1,
      description: "Jellyfish count",
    },
  },
  { theme: "deep-sea" },
);

// Theme metadata (id, label, color, icon) lives in themes/registry.js.
// This file is for behavior only.

// ── Force & Activation ──
const DF = defineConstants(
  "themes.deepSea.force",
  {
    HOLD_TO_DIVE_MS: 10000,
    HOLD_TO_SURFACE_MS: 5000,
    DECAY_RATE: 0.15,
    WATER_CREEP_AT: 0.2,
    COLOR_SHIFT_AT: 0.4,
    VIGNETTE_AT: 0.6,
    WIPE_COVER_MS: 400,
    WIPE_REVEAL_MS: 600,
  },
  { theme: "deep-sea" },
);

// ── Visual Effects ──
const DV = defineConstants(
  "themes.deepSea.visuals",
  {
    RIPPLE_INTERVAL_MS: 400,
    RIPPLE_COUNT: 3,
    RIPPLE_DURATION: 1200,
    RIPPLE_MAX_SCALE: 3,
    RIPPLE_STAGGER_MS: 150,
    RIPPLE_START_OPACITY: 0.6,
    WATER_SIZE_MIN: 8,
    WATER_SIZE_RANGE: 25,
    HUE_ROTATE: 50,
    SAT_BOOST: 0.4,
    BRI_DROP: 0.65,
    VIGNETTE_MAX_OPACITY: 0.7,
    TILT_INTENSITY: 10,
    TILT_SCALE: 1.03,
  },
  { theme: "deep-sea" },
);

export function initDeepSea() {
  const { canvasEl, ctx: canvasCtx } = getCanvasCtx();
  const footerEl = document.querySelector("footer");

  // ── Water creep overlay ──
  const waterOverlay = document.createElement("div");
  waterOverlay.className = "deep-sea-overlay";
  document.body.appendChild(waterOverlay);

  // ── Pressure vignette overlay ──
  const vignetteOverlay = document.createElement("div");
  vignetteOverlay.className = "deep-sea-vignette";
  document.body.appendChild(vignetteOverlay);

  // ── Helper: is pointer inside the footer strip? ──
  function inFooter(x, y) {
    if (!footerEl) return false;
    const rect = footerEl.getBoundingClientRect();
    return (
      x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
    );
  }

  // ── 1. Ripple rings from cursor ──
  const rippleOpts = {
    className: "deep-sea-ripple",
    count: DV.RIPPLE_COUNT,
    staggerMs: DV.RIPPLE_STAGGER_MS,
    duration: DV.RIPPLE_DURATION,
    maxScale: DV.RIPPLE_MAX_SCALE,
    startOpacity: DV.RIPPLE_START_OPACITY,
  };

  let holdX = 0;
  let holdY = 0;
  let rippleTimer = null;

  function startRipples() {
    spawnRipple(holdX, holdY, rippleOpts);
    rippleTimer = setInterval(
      () => spawnRipple(holdX, holdY, rippleOpts),
      DV.RIPPLE_INTERVAL_MS,
    );
  }

  function stopRipples() {
    if (rippleTimer) {
      clearInterval(rippleTimer);
      rippleTimer = null;
    }
  }

  // ── Card caustic interactions ──
  let disableCardCaustics = null;

  // Canvas-side hooks — bubbles + jellyfish render layer, click bursts,
  // bubble spawning while dragging.
  const deepSea = createDeepSea(
    canvasEl,
    canvasCtx,
    COUNTS.BUBBLE,
    COUNTS.JELLY,
  );
  registerCanvasHooks("deep-sea", {
    drawAmbient({ scrollVelocity, dt, palFor, forces }) {
      deepSea.draw(forces, scrollVelocity, dt, palFor("deep-sea"));
    },
    onClick({ cx, cy }) {
      deepSea.clickBurst(cx, cy);
    },
    onDragMove({ cx, cy, trailAdded }) {
      // Trail rate-limits to one point per frame; skipping non-trail
      // moves keeps the bubble count bounded.
      if (trailAdded) deepSea.dragBubble(cx, cy);
    },
  });

  createTheme({
    id: "deep-sea",
    trigger: createHoldTrigger({
      holdActivateMs: DF.HOLD_TO_DIVE_MS,
      holdDeactivateMs: DF.HOLD_TO_SURFACE_MS,
      decayRate: DF.DECAY_RATE,
      shouldAccept: (x, y) => inFooter(x, y),
      onDown(x, y) {
        holdX = x;
        holdY = y;
        startRipples();
      },
      onMove(x, y) {
        holdX = x;
        holdY = y;
      },
      onUp() {
        stopRipples();
      },
    }),
    indicators: [
      // ── 2. Screen-edge water creep ──
      {
        threshold: DF.WATER_CREEP_AT,
        apply(progress) {
          if (progress < DF.WATER_CREEP_AT) {
            waterOverlay.style.opacity = "0";
            return;
          }
          const t = Math.min(
            1,
            (progress - DF.WATER_CREEP_AT) / (1 - DF.WATER_CREEP_AT),
          );
          waterOverlay.style.opacity = String(t);
          const size = DV.WATER_SIZE_MIN + t * DV.WATER_SIZE_RANGE;
          waterOverlay.style.setProperty("--water-size", size + "%");
        },
        clear() {
          waterOverlay.style.opacity = "0";
        },
      },
      // ── 3. Color temperature shift (canvas filter) ──
      {
        threshold: DF.COLOR_SHIFT_AT,
        apply(progress) {
          // Don't fight other themes' own canvas filters
          if (hasActiveThemeExcept("deep-sea")) {
            canvasEl.style.filter = "";
            return;
          }
          if (progress < DF.COLOR_SHIFT_AT) {
            canvasEl.style.filter = "";
            return;
          }
          const t = Math.min(
            1,
            (progress - DF.COLOR_SHIFT_AT) / (1 - DF.COLOR_SHIFT_AT),
          );
          const hue = 360 - t * DV.HUE_ROTATE;
          const sat = 1 + t * DV.SAT_BOOST;
          const bri = 1 - t * DV.BRI_DROP;
          canvasEl.style.filter = `hue-rotate(${hue.toFixed(0)}deg) saturate(${sat.toFixed(2)}) brightness(${bri.toFixed(2)})`;
        },
        clear() {
          canvasEl.style.filter = "";
        },
      },
      // ── 4. Pressure vignette ──
      {
        threshold: DF.VIGNETTE_AT,
        apply(progress) {
          if (progress < DF.VIGNETTE_AT) {
            vignetteOverlay.style.opacity = "0";
            return;
          }
          const t = Math.min(
            1,
            (progress - DF.VIGNETTE_AT) / (1 - DF.VIGNETTE_AT),
          );
          vignetteOverlay.style.opacity = String(t * DV.VIGNETTE_MAX_OPACITY);
        },
        clear() {
          vignetteOverlay.style.opacity = "0";
        },
      },
    ],
    wipe: {
      className: "deep-sea-wipe",
      reverseModifier: "resurface",
      coverMs: DF.WIPE_COVER_MS,
      revealMs: DF.WIPE_REVEAL_MS,
    },
    onActivate() {
      disableCardCaustics = enableCardEffects({
        className: "caustic-card",
        trackingPrefix: "caustic",
        tilt: {
          intensity: DV.TILT_INTENSITY,
          scale: DV.TILT_SCALE,
          transition: "background 0.4s, transform 0.8s ease",
          transitionEnter: "background 0.4s, transform 0.6s ease",
        },
      });
    },
    onDeactivate() {
      if (disableCardCaustics) disableCardCaustics();
    },
  });
}
