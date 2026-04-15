import { playWipe } from "../effects/wipe.js";

export function initBlocky(toggleEl) {
  // ── Trigger tuning ──
  const PRESSES_TO_ACTIVATE = 20;
  const PRESSES_TO_DEACTIVATE = 10;
  const DECAY_TIMEOUT_MS = 2000;
  const DECAY_RATE = 2; // presses/sec after timeout

  // ── Indicator thresholds (fraction of 1.0) ──
  const ICON_PIXEL_AT = 0.2;
  const SCANLINE_AT = 0.35;
  const QUANTIZE_AT = 0.5;
  const JITTER_AT = 0.7;
  const HEAVY_PIXEL_AT = 0.9;

  // ── Icon pixelation ──
  const ICON_SHRINK_FACTOR = 0.4; // scale reduction at full progress (1 → 0.6)
  const ICON_CONTRAST_THRESHOLD = 0.3; // t above which contrast boost kicks in
  const ICON_CONTRAST_STRENGTH = 0.3; // max contrast increase

  // ── Scanline / static tuning ──
  const SCANLINE_BASE_OPACITY = 0.15; // scanline opacity at threshold
  const SCANLINE_HEAVY_BOOST = 0.35; // extra opacity past HEAVY_PIXEL_AT
  const GRID_MAX_OPACITY = 0.08; // quantize grid overlay opacity
  const QUANTIZE_CONTRAST = 0.15; // page contrast boost at full quantize

  // ── Jitter / static flash ──
  const JITTER_AMPLITUDE = 3; // max pixel displacement
  const STATIC_FLASH_CHANCE = 0.06; // probability per frame per unit t
  const STATIC_FLASH_BASE = 0.15; // minimum flash opacity
  const STATIC_FLASH_RANGE = 0.1; // random addition to flash opacity
  const STATIC_FLASH_DURATION_MS = 50; // flash visible duration

  // ── Transition timing ──
  const CASCADE_COLLAPSE_MS = 500;
  const CASCADE_REFINE_MS = 300;
  const CASCADE_TERRAIN_MS = 500;

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
    if (progress < ICON_PIXEL_AT) {
      toggleEl.style.imageRendering = "";
      toggleEl.style.transform = "";
      return;
    }
    const t = Math.min(1, (progress - ICON_PIXEL_AT) / (1 - ICON_PIXEL_AT));
    // Shrink SVG to half size then scale back up — forces pixelation
    const shrink = 1 - t * ICON_SHRINK_FACTOR;
    toggleEl.style.imageRendering = "pixelated";
    toggleEl.style.transform = `scale(${shrink.toFixed(3)})`;
    toggleEl.style.filter =
      t > ICON_CONTRAST_THRESHOLD
        ? `contrast(${(1 + t * ICON_CONTRAST_STRENGTH).toFixed(2)})`
        : "";
  }

  // ── 2. Scanlines ──
  function updateScanlines(progress) {
    if (progress < SCANLINE_AT) {
      scanlineOverlay.style.opacity = "0";
      return;
    }
    const t = Math.min(1, (progress - SCANLINE_AT) / (1 - SCANLINE_AT));
    scanlineOverlay.style.opacity = String(
      t * SCANLINE_BASE_OPACITY +
        (progress >= HEAVY_PIXEL_AT ? t * SCANLINE_HEAVY_BOOST : 0),
    );
  }

  // ── 3. Color quantization + grid ──
  function updateQuantize(progress) {
    if (progress < QUANTIZE_AT) {
      gridOverlay.style.opacity = "0";
      const page = document.querySelector(".page");
      if (page) page.style.filter = "";
      return;
    }
    const t = Math.min(1, (progress - QUANTIZE_AT) / (1 - QUANTIZE_AT));
    gridOverlay.style.opacity = String(t * GRID_MAX_OPACITY);
    // Posterize page content — subtle color stepping
    const page = document.querySelector(".page");
    if (page) {
      const contrast = 1 + t * QUANTIZE_CONTRAST;
      page.style.filter = `contrast(${contrast.toFixed(2)})`;
    }
  }

  // ── 4. Screen jitter + static flashes ──
  function updateJitter(progress) {
    if (progress < JITTER_AT) {
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
      if (!jitterRunning || force < JITTER_AT) {
        if (page) page.style.translate = "";
        staticOverlay.style.opacity = "0";
        jitterRunning = false;
        return;
      }
      const t = Math.min(1, (force - JITTER_AT) / (1 - JITTER_AT));
      const amp = JITTER_AMPLITUDE * t;
      const tx = (Math.random() - 0.5) * amp * 2;
      const ty = (Math.random() - 0.5) * amp * 2;
      if (page) page.style.translate = `${tx.toFixed(1)}px ${ty.toFixed(1)}px`;

      // Random static flash at edges
      if (Math.random() < STATIC_FLASH_CHANCE * t) {
        staticOverlay.style.opacity = String(
          STATIC_FLASH_BASE + Math.random() * STATIC_FLASH_RANGE,
        );
        setTimeout(() => {
          staticOverlay.style.opacity = "0";
        }, STATIC_FLASH_DURATION_MS);
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
    if (progress < HEAVY_PIXEL_AT) {
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
  function enableCardPixel() {
    document.querySelectorAll(".service-card").forEach((card) => {
      card.classList.add("pixel-card");
    });
  }

  function disableCardPixel() {
    document.querySelectorAll(".service-card").forEach((card) => {
      card.classList.remove("pixel-card");
    });
  }

  // ── Resolution cascade transition ──
  function triggerBlocky() {
    if (isTransitioning) return;
    isTransitioning = true;

    playWipe({
      className: "blocky-wipe",
      coverMs: CASCADE_COLLAPSE_MS,
      revealMs: CASCADE_REFINE_MS + CASCADE_TERRAIN_MS,
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
      coverMs: CASCADE_COLLAPSE_MS,
      revealMs: CASCADE_REFINE_MS + CASCADE_TERRAIN_MS,
      onMidpoint() {
        isBlocky = false;
        document.body.classList.remove("blocky");
        window.dispatchEvent(
          new CustomEvent("achievement", {
            detail: { type: "mode-deactivate", mode: "blocky" },
          }),
        );
        clearIndicators();
        disableCardPixel();
      },
      onComplete() {
        isTransitioning = false;
      },
    });
  }

  // ── Toggle press handler ──
  // We listen on the toggle directly with capture to count presses
  // before the theme handler runs. The theme still flips normally.
  toggleEl.addEventListener("click", () => {
    if (isTransitioning) return;

    const now = Date.now();
    lastPressTime = now;
    const target = isBlocky ? PRESSES_TO_DEACTIVATE : PRESSES_TO_ACTIVATE;

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
      if (timeSincePress > DECAY_TIMEOUT_MS) {
        const target = isBlocky ? PRESSES_TO_DEACTIVATE : PRESSES_TO_ACTIVATE;
        const decay = (DECAY_RATE / target) * dt;
        force = Math.max(0, force - decay);
        updateVisuals();
      }
    }
    requestAnimationFrame(tick);
  }
  tick();
}
