import { defineConstants } from "../dev/registry.js";
import { playWipe } from "../effects/wipe.js";
import { enableCardEffects } from "../service-cards.js";

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
  let force = 0;
  let isBlocky = false;
  let isTransitioning = false;
  let lastPressTime = 0;
  let jitterRaf = null;

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

  // ── 1. Toggle icon pixelation ──
  function updateIconPixel(progress) {
    if (progress < BF.ICON_PIXEL_AT) {
      toggleEl.style.imageRendering = "";
      toggleEl.style.transform = "";
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
  }

  // ── 2. Scanlines ──
  function updateScanlines(progress) {
    if (progress < BF.SCANLINE_AT) {
      scanlineOverlay.style.opacity = "0";
      return;
    }
    const t = Math.min(1, (progress - BF.SCANLINE_AT) / (1 - BF.SCANLINE_AT));
    scanlineOverlay.style.opacity = String(
      t * BV.SCANLINE_BASE_OPACITY +
        (progress >= BF.HEAVY_PIXEL_AT ? t * BV.SCANLINE_HEAVY_BOOST : 0),
    );
  }

  // ── 3. Color quantization + grid ──
  function updateQuantize(progress) {
    if (progress < BF.QUANTIZE_AT) {
      gridOverlay.style.opacity = "0";
      const page = document.querySelector(".page");
      if (page) page.style.filter = "";
      return;
    }
    const t = Math.min(1, (progress - BF.QUANTIZE_AT) / (1 - BF.QUANTIZE_AT));
    gridOverlay.style.opacity = String(t * BV.GRID_MAX_OPACITY);
    const page = document.querySelector(".page");
    if (page) {
      const contrast = 1 + t * BV.QUANTIZE_CONTRAST;
      page.style.filter = `contrast(${contrast.toFixed(2)})`;
    }
  }

  // ── 4. Screen jitter + static flashes ──
  function updateJitter(progress) {
    if (progress < BF.JITTER_AT) {
      stopJitter();
      return;
    }
    if (!jitterRunning) startJitter();
  }

  let jitterRunning = false;
  function startJitter() {
    if (jitterRunning) return;
    jitterRunning = true;
    const page = document.querySelector(".page");
    function jitterLoop() {
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

      jitterRaf = requestAnimationFrame(jitterLoop);
    }
    jitterLoop();
  }

  function stopJitter() {
    jitterRunning = false;
    const page = document.querySelector(".page");
    if (page) page.style.translate = "";
    staticOverlay.style.opacity = "0";
  }

  // ── 5. Heavy pixelation ──
  function updateHeavyPixel(progress) {
    if (progress < BF.HEAVY_PIXEL_AT) {
      canvasEl.style.imageRendering = "";
      return;
    }
    canvasEl.style.imageRendering = "pixelated";
  }

  // ── Update all visual indicators ──
  function updateVisuals() {
    updateIconPixel(force);
    updateScanlines(force);
    updateQuantize(force);
    updateJitter(force);
    updateHeavyPixel(force);
  }

  // ── Clear all indicators ──
  function clearIndicators() {
    force = 0;
    toggleEl.style.imageRendering = "";
    toggleEl.style.transform = "";
    toggleEl.style.filter = "";
    scanlineOverlay.style.opacity = "0";
    gridOverlay.style.opacity = "0";
    staticOverlay.style.opacity = "0";
    canvasEl.style.imageRendering = "";
    stopJitter();
    const page = document.querySelector(".page");
    if (page) page.style.filter = "";
  }

  // ── Card pixel interactions ──
  let disableCardPixel = null;

  function enableCardPixel() {
    disableCardPixel = enableCardEffects({
      className: "pixel-card",
    });
  }

  // ── Resolution cascade transition ──
  function triggerBlocky() {
    if (isTransitioning) return;
    isTransitioning = true;

    playWipe({
      className: "blocky-wipe",
      coverMs: BF.CASCADE_COLLAPSE_MS,
      revealMs: BF.CASCADE_REFINE_MS + BF.CASCADE_TERRAIN_MS,
      onMidpoint() {
        isBlocky = true;
        document.body.classList.add("blocky");
        document.body.dataset.lastSubmode = "blocky";
        window.dispatchEvent(
          new CustomEvent("achievement", {
            detail: { type: "mode-activate", mode: "blocky" },
          }),
        );
        clearIndicators();
        enableCardPixel();
      },
      onComplete() {
        isTransitioning = false;
      },
    });
  }

  // ── Reverse cascade transition ──
  function triggerUnblocky() {
    if (isTransitioning) return;
    isTransitioning = true;

    playWipe({
      className: "blocky-wipe unblocky",
      coverMs: BF.CASCADE_COLLAPSE_MS,
      revealMs: BF.CASCADE_REFINE_MS + BF.CASCADE_TERRAIN_MS,
      onMidpoint() {
        isBlocky = false;
        document.body.classList.remove("blocky");
        window.dispatchEvent(
          new CustomEvent("achievement", {
            detail: { type: "mode-deactivate", mode: "blocky" },
          }),
        );
        clearIndicators();
        if (disableCardPixel) disableCardPixel();
      },
      onComplete() {
        isTransitioning = false;
      },
    });
  }

  // ── Toggle press handler ──
  toggleEl.addEventListener("click", () => {
    if (isTransitioning) return;

    const now = Date.now();
    lastPressTime = now;
    const target = isBlocky ? BF.PRESSES_TO_DEACTIVATE : BF.PRESSES_TO_ACTIVATE;

    force = Math.min(1, force + 1 / target);

    updateVisuals();

    if (force >= 1.0) {
      if (isBlocky) {
        triggerUnblocky();
      } else {
        triggerBlocky();
      }
    }
  });

  // ── Decay loop ──
  let lastTick = performance.now();
  function tick() {
    const now = performance.now();
    const dt = (now - lastTick) / 1000;
    lastTick = now;

    if (force > 0 && !isTransitioning) {
      const timeSincePress = Date.now() - lastPressTime;
      if (timeSincePress > BF.DECAY_TIMEOUT_MS) {
        const target = isBlocky
          ? BF.PRESSES_TO_DEACTIVATE
          : BF.PRESSES_TO_ACTIVATE;
        const decay = (BF.DECAY_RATE / target) * dt;
        force = Math.max(0, force - decay);
        updateVisuals();
      }
    }
    requestAnimationFrame(tick);
  }
  tick();
}
