import { defineConstants } from "../dev/registry.js";
import { getCanvasCtx } from "../canvas-utils.js";
import { enableCardEffects } from "../service-cards.js";
import { scaled } from "../motion.js";
import { createVhs } from "../particles/vhs.js";
import { subscribe as subscribeScroll } from "../scroll-bus.js";
import { createTheme } from "./factory.js";
import { hasActiveThemeExcept } from "./registry.js";
import { registerCanvasHooks } from "./canvas-hooks.js";
import { createKeyChordTrigger } from "./triggers.js";

// Theme metadata (id, label, color, icon) lives in themes/registry.js.
// This file is for behavior only.

// ── Force & Activation ──
const VF = defineConstants(
  "themes.vhs.force",
  {
    // Fewer presses to deactivate than to activate so an accidental trip
    // is recoverable in a couple of seconds without a long unwind.
    PRESSES_TO_ACTIVATE: 5,
    PRESSES_TO_DEACTIVATE: 3,
    PRESS_TIMEOUT_MS: 1500,
    DECAY_RATE: 2,
    SCANLINE_AT: 0.2,
    COLOR_CAST_AT: 0.4,
    CHROMATIC_FLASH_AT: 0.6,
    STATIC_INTERRUPT_AT: 0.8,
    PRE_TRIGGER_PULSE_AT: 0.95,
    WIPE_COVER_MS: 500,
    WIPE_REVEAL_MS: 600,
  },
  { theme: "vhs" },
);

// ── Visual Effects ──
const VV = defineConstants(
  "themes.vhs.visuals",
  {
    SCANLINE_OPACITY_BASE: 0.05,
    SCANLINE_OPACITY_PEAK: 0.25,
    BUILDUP_SAT_MIN: 0.85,
    BUILDUP_SEPIA_MAX: 0.05,
    // Tracking-drift wobble on .page during scroll.
    DRIFT_AMP_PX: 2,
    DRIFT_LERP: 0.18,
    DRIFT_TARGET_DECAY: 0.85,
    DRIFT_SETTLE_PX: 0.05,
    SCROLL_NORM_FACTOR: 0.04,
    // Cursor stillness watcher — fires phosphor-burn when the cursor stays
    // within a small radius for this duration.
    STILLNESS_RADIUS_PX: 5,
    STILLNESS_DURATION_MS: 5000,
    STILLNESS_CHECK_INTERVAL_MS: 250,
    TILT_INTENSITY: 2,
    TILT_SCALE: 1.005,
    // Idle static — once the pointer's been still this long, fire a glitch
    // line every interval; moves beyond the noise floor reset the timer.
    IDLE_STATIC_MS: 30000,
    STATIC_INTERVAL_MS: 8000,
    IDLE_MOVE_NOISE_PX: 3,
  },
  { theme: "vhs" },
);

const TRIGGER_KEY = "Escape";

export function initVhs() {
  const pageEl = document.querySelector(".page");

  // ── Progressive overlay — buildup scanlines ──
  const scanlines = document.createElement("div");
  scanlines.className = "vhs-scanlines";
  document.body.appendChild(scanlines);

  // Persistent VHS overlays — boil-noise layer + iconic rolling tracking
  // band.  Both are pure CSS animations; JS just owns their lifetime so
  // they only exist while the theme is active and don't leak DOM nodes.
  let noiseEl = null;
  let trackingBandEl = null;

  function mountOverlays() {
    if (!noiseEl) {
      noiseEl = document.createElement("div");
      noiseEl.className = "vhs-noise";
      document.body.appendChild(noiseEl);
    }
    if (!trackingBandEl) {
      trackingBandEl = document.createElement("div");
      trackingBandEl.className = "vhs-tracking-band";
      document.body.appendChild(trackingBandEl);
    }
  }

  function unmountOverlays() {
    if (noiseEl) {
      noiseEl.remove();
      noiseEl = null;
    }
    if (trackingBandEl) {
      trackingBandEl.remove();
      trackingBandEl = null;
    }
  }

  let disableCardVhs = null;

  // ── One-shot indicator gating ──
  // Threshold-crossing detection: each one-shot fires only on the rising
  // edge so the indicator's per-frame `apply()` doesn't re-spawn the
  // effect every frame while force lingers above the threshold.
  let chromaticFlashFiredAt = 0;
  let staticInterruptFiredAt = 0;

  function spawnStaticFlash() {
    const el = document.createElement("div");
    el.className = "vhs-static-flash";
    document.body.appendChild(el);
    el.addEventListener("animationend", () => el.remove(), { once: true });
  }

  // ── Tracking drift on scroll ──
  let driftTargetX = 0;
  let driftCurrentX = 0;
  let driftUnsub = null;
  let driftRaf = null;

  function driftTick() {
    if (!pageEl) {
      driftRaf = null;
      return;
    }
    driftCurrentX += (driftTargetX - driftCurrentX) * VV.DRIFT_LERP;
    driftTargetX *= VV.DRIFT_TARGET_DECAY;
    if (
      Math.abs(driftTargetX) < VV.DRIFT_SETTLE_PX &&
      Math.abs(driftCurrentX) < VV.DRIFT_SETTLE_PX
    ) {
      driftCurrentX = 0;
      driftTargetX = 0;
      pageEl.style.removeProperty("--vhs-drift-x");
      driftRaf = null;
      return;
    }
    pageEl.style.setProperty("--vhs-drift-x", `${driftCurrentX.toFixed(2)}px`);
    driftRaf = requestAnimationFrame(driftTick);
  }

  function onScroll({ deltaY }) {
    if (!pageEl) return;
    // Drift in the opposite direction of scroll so it feels like a
    // tracking error chasing the playhead.  Reduced-motion users see a
    // still page even on aggressive scroll because scaled() collapses
    // the increment to zero.
    driftTargetX += scaled(-deltaY * VV.SCROLL_NORM_FACTOR);
    // Clamp so a frantic scroll doesn't jolt the page off-screen.
    driftTargetX = Math.max(
      -VV.DRIFT_AMP_PX,
      Math.min(VV.DRIFT_AMP_PX, driftTargetX),
    );
    if (driftRaf === null) driftRaf = requestAnimationFrame(driftTick);
  }

  function startDrift() {
    if (driftUnsub) return;
    driftUnsub = subscribeScroll(onScroll);
  }

  function stopDrift() {
    if (driftUnsub) {
      driftUnsub();
      driftUnsub = null;
    }
    if (driftRaf !== null) {
      cancelAnimationFrame(driftRaf);
      driftRaf = null;
    }
    driftCurrentX = 0;
    driftTargetX = 0;
    if (pageEl) pageEl.style.removeProperty("--vhs-drift-x");
  }

  // ── Cursor stillness watcher ──
  // Polls cursor position; if it stays within STILLNESS_RADIUS_PX for
  // STILLNESS_DURATION_MS, dispatches `vhs-cursor-still` for the tracker
  // (phosphor-burn achievement). One-shot per still session — resets
  // when the cursor moves past the radius.
  let stillnessLastX = 0;
  let stillnessLastY = 0;
  let stillnessSinceMs = 0;
  let stillnessFired = false;
  let stillnessInterval = null;
  let stillnessHasPos = false;

  function onPointerMove(e) {
    if (!stillnessHasPos) {
      stillnessLastX = e.clientX;
      stillnessLastY = e.clientY;
      stillnessSinceMs = performance.now();
      stillnessHasPos = true;
      stillnessFired = false;
      return;
    }
    const dx = e.clientX - stillnessLastX;
    const dy = e.clientY - stillnessLastY;
    if (dx * dx + dy * dy > VV.STILLNESS_RADIUS_PX * VV.STILLNESS_RADIUS_PX) {
      stillnessLastX = e.clientX;
      stillnessLastY = e.clientY;
      stillnessSinceMs = performance.now();
      stillnessFired = false;
    }
  }

  function checkStillness() {
    if (!stillnessHasPos || stillnessFired) return;
    const elapsed = performance.now() - stillnessSinceMs;
    if (elapsed >= VV.STILLNESS_DURATION_MS) {
      stillnessFired = true;
      window.dispatchEvent(
        new CustomEvent("achievement", {
          detail: { type: "vhs-cursor-still" },
        }),
      );
    }
  }

  function startStillness() {
    stillnessHasPos = false;
    stillnessFired = false;
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    stillnessInterval = setInterval(
      checkStillness,
      VV.STILLNESS_CHECK_INTERVAL_MS,
    );
  }

  function stopStillness() {
    window.removeEventListener("pointermove", onPointerMove);
    if (stillnessInterval !== null) {
      clearInterval(stillnessInterval);
      stillnessInterval = null;
    }
  }

  // Canvas-side phosphor-decay layer.  Runs as drawPost so every other
  // layer is committed before the phosphor captures into its buffer —
  // anything painting after this would be lost from the trail.
  const { canvasEl } = getCanvasCtx();
  const vhs = createVhs(canvasEl);

  // Idle static — while VHS is active and the pointer has been still for
  // a while, fire a glitch line every so often to sell the "tape left
  // running" feel.  Wall-clock timed so it's honest under any frame rate.
  let lastHoverX = NaN;
  let lastHoverY = NaN;
  let lastMoveMs = Date.now();
  let lastStaticMs = 0;

  registerCanvasHooks("vhs", {
    drawPost({ ctx, palFor, forces, reducedMotion }) {
      // Track pointer stillness off wall-clock.  Any move beyond the
      // noise floor resets the idle timer.
      if (forces.hover.active) {
        if (
          Number.isNaN(lastHoverX) ||
          Math.abs(forces.hover.x - lastHoverX) > VV.IDLE_MOVE_NOISE_PX ||
          Math.abs(forces.hover.y - lastHoverY) > VV.IDLE_MOVE_NOISE_PX
        ) {
          lastMoveMs = Date.now();
        }
        lastHoverX = forces.hover.x;
        lastHoverY = forces.hover.y;
      }
      const now = Date.now();
      if (
        !reducedMotion &&
        now - lastMoveMs > VV.IDLE_STATIC_MS &&
        now - lastStaticMs > VV.STATIC_INTERVAL_MS
      ) {
        lastStaticMs = now;
        vhs.clickGlitch(
          Math.random() * canvasEl.width,
          Math.random() * canvasEl.height,
        );
      }
      // The DOM cursor is not part of the canvas, so the trail history
      // has to be fed manually for the cursor to leave a phosphor
      // afterimage. clearCursor on hover-out so a stale trail doesn't
      // hang in mid-air after the pointer leaves.  Under reduced
      // motion the cursor trail is suppressed (it's a motion-reactive
      // visual) but the phosphor decay over a static frame keeps
      // running — without it, vhs reads as just a color cast.
      if (forces.hover.active && !reducedMotion) {
        vhs.recordCursor(forces.hover.x, forces.hover.y);
      } else {
        vhs.clearCursor();
      }
      vhs.drawAfter(ctx, palFor("vhs"));
    },
    onClick({ cx, cy, reducedMotion }) {
      if (reducedMotion) return;
      vhs.clickGlitch(cx, cy);
    },
    onDeactivate() {
      vhs.cleanup();
    },
  });

  createTheme({
    id: "vhs",
    trigger: createKeyChordTrigger({
      key: TRIGGER_KEY,
      activateCount: VF.PRESSES_TO_ACTIVATE,
      deactivateCount: VF.PRESSES_TO_DEACTIVATE,
      timeoutMs: VF.PRESS_TIMEOUT_MS,
      decayRate: VF.DECAY_RATE,
    }),
    indicators: [
      // ── 1. Buildup scanlines opacity ──
      {
        threshold: VF.SCANLINE_AT,
        apply(progress) {
          if (progress < VF.SCANLINE_AT) {
            scanlines.style.removeProperty("--vhs-scanline-opacity");
            return;
          }
          const t = Math.min(
            1,
            (progress - VF.SCANLINE_AT) / (1 - VF.SCANLINE_AT),
          );
          const o =
            VV.SCANLINE_OPACITY_BASE +
            t * (VV.SCANLINE_OPACITY_PEAK - VV.SCANLINE_OPACITY_BASE);
          scanlines.style.setProperty("--vhs-scanline-opacity", o.toFixed(3));
        },
        clear() {
          scanlines.style.removeProperty("--vhs-scanline-opacity");
        },
      },
      // ── 2. Color cast (canvas filter via custom properties) ──
      {
        threshold: VF.COLOR_CAST_AT,
        apply(progress) {
          if (hasActiveThemeExcept("vhs")) {
            document.body.removeAttribute("data-vhs-buildup");
            return;
          }
          if (progress < VF.COLOR_CAST_AT) {
            document.body.removeAttribute("data-vhs-buildup");
            return;
          }
          const t = Math.min(
            1,
            (progress - VF.COLOR_CAST_AT) / (1 - VF.COLOR_CAST_AT),
          );
          const sat = 1 - t * (1 - VV.BUILDUP_SAT_MIN);
          const sepia = t * VV.BUILDUP_SEPIA_MAX;
          document.body.dataset.vhsBuildup = "true";
          document.body.style.setProperty(
            "--vhs-buildup-saturate",
            sat.toFixed(3),
          );
          document.body.style.setProperty(
            "--vhs-buildup-sepia",
            sepia.toFixed(3),
          );
        },
        clear() {
          document.body.removeAttribute("data-vhs-buildup");
          document.body.style.removeProperty("--vhs-buildup-saturate");
          document.body.style.removeProperty("--vhs-buildup-sepia");
        },
      },
      // ── 3. Chromatic flash (one-shot at threshold crossing) ──
      {
        threshold: VF.CHROMATIC_FLASH_AT,
        apply(progress) {
          const above = progress >= VF.CHROMATIC_FLASH_AT;
          const now = Date.now();
          if (above && chromaticFlashFiredAt === 0) {
            chromaticFlashFiredAt = now;
            // Reuse the static-flash element — visually indistinguishable
            // from a one-frame channel offset and avoids inventing another
            // overlay just for this stage.
            spawnStaticFlash();
          } else if (!above) {
            chromaticFlashFiredAt = 0;
          }
        },
        clear() {
          chromaticFlashFiredAt = 0;
        },
      },
      // ── 4. Static interruption (one-shot at threshold crossing) ──
      {
        threshold: VF.STATIC_INTERRUPT_AT,
        apply(progress) {
          const above = progress >= VF.STATIC_INTERRUPT_AT;
          if (above && staticInterruptFiredAt === 0) {
            staticInterruptFiredAt = Date.now();
            spawnStaticFlash();
          } else if (!above) {
            staticInterruptFiredAt = 0;
          }
        },
        clear() {
          staticInterruptFiredAt = 0;
        },
      },
      // ── 5. Pre-trigger pulse — peak scanline opacity ──
      // Indicator 1 already handles the scanline ramp; this stage layers a
      // small extra darkening at the very top of the curve to signal the
      // imminent trigger.  Implemented as a body class for CSS to consume.
      {
        threshold: VF.PRE_TRIGGER_PULSE_AT,
        apply(progress) {
          if (progress < VF.PRE_TRIGGER_PULSE_AT) {
            document.body.classList.remove("vhs-pre-trigger");
            return;
          }
          document.body.classList.add("vhs-pre-trigger");
        },
        clear() {
          document.body.classList.remove("vhs-pre-trigger");
        },
      },
    ],
    wipe: {
      className: "vhs-wipe",
      reverseModifier: "eject",
      coverMs: VF.WIPE_COVER_MS,
      revealMs: VF.WIPE_REVEAL_MS,
    },
    onActivate() {
      disableCardVhs = enableCardEffects({
        className: "vhs-card",
        tilt: { intensity: VV.TILT_INTENSITY, scale: VV.TILT_SCALE },
      });
      mountOverlays();
      startDrift();
      startStillness();
    },
    onDeactivate() {
      if (disableCardVhs) disableCardVhs();
      unmountOverlays();
      stopDrift();
      stopStillness();
    },
  });
}
