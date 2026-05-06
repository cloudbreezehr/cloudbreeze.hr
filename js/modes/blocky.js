import { defineConstants } from "../dev/registry.js";
import { enableCardEffects } from "../service-cards.js";
import { createMode } from "./factory.js";
import { createClickCountTrigger } from "./triggers.js";

// Mode metadata (id, label, color, icon) lives in modes/registry.js.
// This file is for behavior only.

// ── Force & Activation ──
const BF = defineConstants(
  "modes.blockyForce",
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
  { mode: "blocky" },
);

// ── Visual Effects ──
const BV = defineConstants(
  "modes.blockyVisuals",
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
  { mode: "blocky" },
);

export function initBlocky(toggleEl) {
  const canvasEl = document.getElementById("bg-canvas");

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

  // `modeCtx` is filled in by createMode's return value below.  The jitter
  // loop reads modeCtx.force directly — no local mirror required.
  let modeCtx;
  let jitterRunning = false;

  // ── Screen jitter + static flashes ──
  function startJitter() {
    if (jitterRunning) return;
    jitterRunning = true;
    const page = document.querySelector(".page");
    function jitterLoop() {
      const force = modeCtx.force;
      if (!jitterRunning || force < BF.JITTER_AT) {
        if (page) page.style.translate = "";
        staticOverlay.style.opacity = "0";
        jitterRunning = false;
        return;
      }
      const t = Math.min(1, (force - BF.JITTER_AT) / (1 - BF.JITTER_AT));
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
    disableCardPixel = enableCardEffects({
      className: "pixel-card",
      tilt: {
        transformFn(x, y) {
          const rx = Math.round((-y * BLOCKY_INTENSITY) / SNAP_DEG) * SNAP_DEG;
          const ry = Math.round((x * BLOCKY_INTENSITY) / SNAP_DEG) * SNAP_DEG;
          return `perspective(${BLOCKY_PERSPECTIVE}px) rotateX(${rx}deg) rotateY(${ry}deg) scale(1.01)`;
        },
        transition: "background 0.4s, transform 0.15s steps(3)",
        transitionEnter: "background 0.4s",
      },
    });
  }

  modeCtx = createMode({
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
          const t = Math.min(
            1,
            (progress - BF.ICON_PIXEL_AT) / (1 - BF.ICON_PIXEL_AT),
          );
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
          const t = Math.min(
            1,
            (progress - BF.SCANLINE_AT) / (1 - BF.SCANLINE_AT),
          );
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
          const t = Math.min(
            1,
            (progress - BF.QUANTIZE_AT) / (1 - BF.QUANTIZE_AT),
          );
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
      // The jitter loop reads modeCtx.force directly, so this indicator only
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
