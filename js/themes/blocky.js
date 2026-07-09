import { defineConstants } from "../dev/registry.js";
import { getCanvasCtx } from "../canvas-utils.js";
import { enableCardEffects } from "../service-cards.js";
import { prefersReducedMotion } from "../motion.js";
import { createBlocky } from "../particles/blocky.js";
import { createTheme, rampAbove } from "./factory.js";
import { registerCanvasHooks } from "./canvas-hooks.js";
import { createClickCountTrigger } from "./triggers.js";
import { playSfx } from "../audio/sfx.js";

// ── Particle counts ──
const COUNTS = defineConstants(
  "themes.blocky.particles",
  {
    FIREFLY: {
      value: 28,
      min: 0,
      max: 100,
      step: 1,
      description: "Firefly count",
    },
  },
  { theme: "blocky" },
);

// Theme metadata (id, label, color, icon) lives in themes/registry.js.
// This file is for behavior only.

// ── Force & Activation ──
const BF = defineConstants(
  "themes.blocky.force",
  {
    PRESSES_TO_ACTIVATE: 20,
    PRESSES_TO_DEACTIVATE: 10,
    DECAY_TIMEOUT_MS: 2000,
    DECAY_RATE: 2,
    ICON_PIXEL_AT: 0.2,
    SCANLINE_AT: 0.35,
    QUANTIZE_AT: 0.5,
    JITTER_AT: 0.7,
    HEAVY_PIXEL_AT: 0.9,
    CASCADE_COLLAPSE_MS: 500,
    CASCADE_REFINE_MS: 300,
    CASCADE_TERRAIN_MS: 500,
  },
  { theme: "blocky" },
);

// ── Visual Effects ──
const BV = defineConstants(
  "themes.blocky.visuals",
  {
    ICON_SHRINK_FACTOR: 0.4,
    ICON_CONTRAST_THRESHOLD: 0.3,
    ICON_CONTRAST_STRENGTH: 0.3,
    SCANLINE_BASE_OPACITY: 0.15,
    SCANLINE_HEAVY_BOOST: 0.35,
    GRID_MAX_OPACITY: 0.08,
    QUANTIZE_CONTRAST: 0.15,
    JITTER_AMPLITUDE: 3,
    STATIC_FLASH_CHANCE: 0.06,
    STATIC_FLASH_BASE: 0.15,
    STATIC_FLASH_RANGE: 0.1,
    STATIC_FLASH_DURATION_MS: 50,
  },
  { theme: "blocky" },
);

export function initBlocky(toggleEl) {
  const { canvasEl, ctx: canvasCtx } = getCanvasCtx();

  // ── Scanline overlay ──
  const scanlineOverlay = document.createElement("div");
  scanlineOverlay.className = "blocky-scanlines";
  document.body.appendChild(scanlineOverlay);

  // ── Grid overlay ──
  const gridOverlay = document.createElement("div");
  gridOverlay.className = "blocky-grid";
  document.body.appendChild(gridOverlay);

  // ── Static flash overlay ──
  const staticOverlay = document.createElement("div");
  staticOverlay.className = "blocky-static";
  document.body.appendChild(staticOverlay);

  // `themeCtx` is filled in by createTheme's return value below.  The jitter
  // loop reads themeCtx.force directly — no local mirror required.
  let themeCtx;
  let jitterRunning = false;

  // ── Screen jitter + static flashes ──
  function startJitter() {
    if (jitterRunning) return;
    jitterRunning = true;
    const page = document.querySelector(".page");
    function jitterLoop() {
      const force = themeCtx.force;
      // Jitter translates the page and the static overlay flashes — both
      // are skipped under reduced motion, not just dampened.
      if (!jitterRunning || force < BF.JITTER_AT || prefersReducedMotion()) {
        if (page) page.style.translate = "";
        staticOverlay.style.opacity = "0";
        jitterRunning = false;
        return;
      }
      const t = rampAbove(force, BF.JITTER_AT);
      const amp = BV.JITTER_AMPLITUDE * t;
      const tx = (Math.random() - 0.5) * amp * 2;
      const ty = (Math.random() - 0.5) * amp * 2;
      if (page) page.style.translate = `${tx.toFixed(1)}px ${ty.toFixed(1)}px`;
      // Random static flash at edges
      if (Math.random() < BV.STATIC_FLASH_CHANCE * t) {
        staticOverlay.style.opacity = String(
          BV.STATIC_FLASH_BASE + Math.random() * BV.STATIC_FLASH_RANGE,
        );
        setTimeout(() => {
          staticOverlay.style.opacity = "0";
        }, BV.STATIC_FLASH_DURATION_MS);
      }
      requestAnimationFrame(jitterLoop);
    }
    jitterLoop();
  }

  function stopJitter() {
    jitterRunning = false;
    const page = document.querySelector(".page");
    if (page) page.style.translate = "";
    staticOverlay.style.opacity = "0";
  }

  // ── Card pixel interactions ──
  let disableCardPixel = null;

  function enableCardPixel() {
    // ── Blocky Tilt ──
    const SNAP_DEG = 4;
    const BLOCKY_INTENSITY = 8;
    const BLOCKY_PERSPECTIVE = 600;
    const TILT_SCALE = 1.01;
    disableCardPixel = enableCardEffects({
      className: "pixel-card",
      tilt: {
        transformFn(x, y) {
          const rx = Math.round((-y * BLOCKY_INTENSITY) / SNAP_DEG) * SNAP_DEG;
          const ry = Math.round((x * BLOCKY_INTENSITY) / SNAP_DEG) * SNAP_DEG;
          return `perspective(${BLOCKY_PERSPECTIVE}px) rotateX(${rx}deg) rotateY(${ry}deg) scale(${TILT_SCALE})`;
        },
        transition: "background 0.4s, transform 0.15s steps(3)",
        transitionEnter: "background 0.4s",
      },
    });
  }

  // Canvas-side hooks — pixelation post-process + fireflies, click block
  // fragments.  Runs as drawPost so the entire scene below has been
  // composited before the post-process kicks in.
  const blocky = createBlocky(canvasEl, canvasCtx, COUNTS.FIREFLY);
  // Invariant: the main canvas's resize handler runs before this one, so
  // canvasEl already has its new dimensions when resizePixelCanvas reads
  // them.  Browser resize listeners fire in registration order, and the
  // canvas listener registers earlier in the bootstrap path.
  window.addEventListener("resize", () => {
    blocky.resizePixelCanvas();
  });
  registerCanvasHooks("blocky", {
    suppressDefaultClickBurst: true,
    drawPost({ scrollVelocity, isDark, forces }) {
      blocky.draw(forces, scrollVelocity, isDark);
    },
    onClick({ cx, cy, reducedMotion }) {
      if (reducedMotion) return;
      blocky.clickBurst(cx, cy);
      playSfx("shatter");
    },
  });

  themeCtx = createTheme({
    id: "blocky",
    trigger: createClickCountTrigger({
      element: toggleEl,
      activateCount: BF.PRESSES_TO_ACTIVATE,
      deactivateCount: BF.PRESSES_TO_DEACTIVATE,
      timeoutMs: BF.DECAY_TIMEOUT_MS,
      decayRate: BF.DECAY_RATE,
    }),
    indicators: [
      // ── 1. Toggle icon pixelation ──
      {
        threshold: BF.ICON_PIXEL_AT,
        apply(progress) {
          if (progress < BF.ICON_PIXEL_AT) {
            toggleEl.style.imageRendering = "";
            toggleEl.style.transform = "";
            toggleEl.style.filter = "";
            return;
          }
          const t = rampAbove(progress, BF.ICON_PIXEL_AT);
          const shrink = 1 - t * BV.ICON_SHRINK_FACTOR;
          toggleEl.style.imageRendering = "pixelated";
          toggleEl.style.transform = `scale(${shrink.toFixed(3)})`;
          toggleEl.style.filter =
            t > BV.ICON_CONTRAST_THRESHOLD
              ? `contrast(${(1 + t * BV.ICON_CONTRAST_STRENGTH).toFixed(2)})`
              : "";
        },
        clear() {
          toggleEl.style.imageRendering = "";
          toggleEl.style.transform = "";
          toggleEl.style.filter = "";
        },
      },
      // ── 2. Scanlines ──
      {
        threshold: BF.SCANLINE_AT,
        apply(progress) {
          if (progress < BF.SCANLINE_AT) {
            scanlineOverlay.style.opacity = "0";
            return;
          }
          const t = rampAbove(progress, BF.SCANLINE_AT);
          scanlineOverlay.style.opacity = String(
            t * BV.SCANLINE_BASE_OPACITY +
              (progress >= BF.HEAVY_PIXEL_AT ? t * BV.SCANLINE_HEAVY_BOOST : 0),
          );
        },
        clear() {
          scanlineOverlay.style.opacity = "0";
        },
      },
      // ── 3. Color quantization + grid ──
      {
        threshold: BF.QUANTIZE_AT,
        apply(progress) {
          if (progress < BF.QUANTIZE_AT) {
            gridOverlay.style.opacity = "0";
            const page = document.querySelector(".page");
            if (page) page.style.filter = "";
            return;
          }
          const t = rampAbove(progress, BF.QUANTIZE_AT);
          gridOverlay.style.opacity = String(t * BV.GRID_MAX_OPACITY);
          const page = document.querySelector(".page");
          if (page) {
            const contrast = 1 + t * BV.QUANTIZE_CONTRAST;
            page.style.filter = `contrast(${contrast.toFixed(2)})`;
          }
        },
        clear() {
          gridOverlay.style.opacity = "0";
          const page = document.querySelector(".page");
          if (page) page.style.filter = "";
        },
      },
      // ── 4. Screen jitter + static flashes ──
      // The jitter loop reads themeCtx.force directly, so this indicator only
      // flips the loop on/off at the threshold.
      {
        threshold: BF.JITTER_AT,
        apply(progress) {
          if (progress < BF.JITTER_AT) stopJitter();
          else if (!jitterRunning) startJitter();
        },
        clear: stopJitter,
      },
      // ── 5. Heavy pixelation ──
      {
        threshold: BF.HEAVY_PIXEL_AT,
        apply(progress) {
          canvasEl.style.imageRendering =
            progress < BF.HEAVY_PIXEL_AT ? "" : "pixelated";
        },
        clear() {
          canvasEl.style.imageRendering = "";
        },
      },
    ],
    wipe: {
      className: "blocky-wipe",
      reverseModifier: "unblocky",
      coverMs: BF.CASCADE_COLLAPSE_MS,
      revealMs: BF.CASCADE_REFINE_MS + BF.CASCADE_TERRAIN_MS,
    },
    onActivate: enableCardPixel,
    onDeactivate() {
      if (disableCardPixel) disableCardPixel();
    },
  });
}
