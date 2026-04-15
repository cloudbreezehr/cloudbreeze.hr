import { defineConstants } from "../dev/registry.js";
import { bindPointer } from "../pointer.js";
import { playWipe } from "../effects/wipe.js";
import { spawnRipple } from "../effects/ripple.js";
import { enableCardEffects } from "../service-cards.js";

// ── Force & Activation ──
const DF = defineConstants(
  "modes.deepSeaForce",
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
  { mode: "deep-sea" },
);

// ── Visual Effects ──
const DV = defineConstants(
  "modes.deepSeaVisuals",
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
  },
  { mode: "deep-sea" },
);

export function initDeepSea() {
  let force = 0;
  let isSubmerged = false;
  let isTransitioning = false;
  let isHolding = false;
  let holdStartTime = 0;
  let rippleTimer = null;
  let holdX = 0;
  let holdY = 0;

  const canvasEl = document.getElementById("bg-canvas");
  const cloudSvg = document.querySelector(".cloud-svg");
  const logoEl = document.querySelector(".nav-logo");
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

  function startRipples(x, y) {
    holdX = x;
    holdY = y;
    spawnRipple(x, y, rippleOpts);
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

  // ── 2. Screen-edge water creep ──
  function updateWaterCreep(progress) {
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
  }

  // ── 3. Color temperature shift (canvas filter) ──
  function updateColorShift(progress) {
    if (
      document.body.classList.contains("upside-down") ||
      document.body.classList.contains("frozen")
    ) {
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
  }

  // ── 4. Pressure vignette ──
  function updateVignette(progress) {
    if (progress < DF.VIGNETTE_AT) {
      vignetteOverlay.style.opacity = "0";
      return;
    }
    const t = Math.min(1, (progress - DF.VIGNETTE_AT) / (1 - DF.VIGNETTE_AT));
    vignetteOverlay.style.opacity = String(t * DV.VIGNETTE_MAX_OPACITY);
  }

  // ── Update all indicators ──
  function updateVisuals() {
    updateWaterCreep(force);
    updateColorShift(force);
    updateVignette(force);
  }

  // ── Clear all indicators ──
  function clearIndicators() {
    force = 0;
    waterOverlay.style.opacity = "0";
    vignetteOverlay.style.opacity = "0";
    canvasEl.style.filter = "";
  }

  // ── Card caustic interactions ──
  let disableCardCaustics = null;

  function enableCardCaustics() {
    disableCardCaustics = enableCardEffects({
      className: "caustic-card",
      trackingPrefix: "caustic",
    });
  }

  // ── Dive transition ──
  function triggerDive() {
    if (isTransitioning) return;
    isTransitioning = true;

    playWipe({
      className: "deep-sea-wipe",
      coverMs: DF.WIPE_COVER_MS,
      revealMs: DF.WIPE_REVEAL_MS,
      onMidpoint() {
        isSubmerged = true;
        document.body.classList.add("deep-sea");
        document.body.dataset.lastSubmode = "deep-sea";
        window.dispatchEvent(
          new CustomEvent("achievement", {
            detail: { type: "mode-activate", mode: "deep-sea" },
          }),
        );
        clearIndicators();
        enableCardCaustics();
      },
      onComplete() {
        isTransitioning = false;
      },
    });
  }

  // ── Resurface transition ──
  function triggerResurface() {
    if (isTransitioning) return;
    isTransitioning = true;

    playWipe({
      className: "deep-sea-wipe resurface",
      coverMs: DF.WIPE_COVER_MS,
      revealMs: DF.WIPE_REVEAL_MS,
      onMidpoint() {
        isSubmerged = false;
        document.body.classList.remove("deep-sea");
        window.dispatchEvent(
          new CustomEvent("achievement", {
            detail: { type: "mode-deactivate", mode: "deep-sea" },
          }),
        );
        clearIndicators();
        if (disableCardCaustics) disableCardCaustics();
      },
      onComplete() {
        isTransitioning = false;
      },
    });
  }

  // ── Hold detection ──
  function updateHold() {
    if (!isHolding || isTransitioning) return;

    const elapsed = performance.now() - holdStartTime;
    const target = isSubmerged ? DF.HOLD_TO_SURFACE_MS : DF.HOLD_TO_DIVE_MS;
    force = Math.min(1, elapsed / target);

    updateVisuals();

    if (force >= 1.0) {
      isHolding = false;
      stopRipples();
      if (isSubmerged) {
        triggerResurface();
      } else {
        triggerDive();
      }
      return;
    }

    requestAnimationFrame(updateHold);
  }

  // ── Decay loop — force drains when not holding ──
  let lastTick = performance.now();
  function tick() {
    const now = performance.now();
    const dt = (now - lastTick) / 1000;
    lastTick = now;

    if (!isHolding && force > 0 && !isTransitioning) {
      force = Math.max(0, force - DF.DECAY_RATE * dt);
      updateVisuals();
    }
    requestAnimationFrame(tick);
  }
  tick();

  // ── Bind events (touch fallback handled by bindPointer) ──
  bindPointer(document, {
    onDown(x, y) {
      if (isTransitioning || !inFooter(x, y)) return false;
      isHolding = true;
      holdStartTime = performance.now();
      holdX = x;
      holdY = y;
      startRipples(x, y);
      updateHold();
    },
    onMove(x, y) {
      holdX = x;
      holdY = y;
    },
    onUp() {
      isHolding = false;
      stopRipples();
    },
  });
}
