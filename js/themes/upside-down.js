import { defineConstants } from "../dev/registry.js";
import { enableCardEffects } from "../service-cards.js";
import { getCanvasCtx } from "../canvas-utils.js";
import { createUpsideDown } from "../particles/upside-down.js";
import { registerCanvasHooks } from "./canvas-hooks.js";
import { createTheme } from "./factory.js";
import { createOverscrollTrigger } from "./triggers.js";

// Theme metadata (id, label, color, icon) lives in themes/registry.js.
// This file is for behavior only.

// ── Force & Activation ──
const UD_FORCE = defineConstants(
  "themes.upsideDown.force",
  {
    COOLDOWN: {
      value: 300,
      min: 50,
      max: 1000,
      step: 10,
      description: "Milliseconds between accepted overscroll hits",
    },
    FORCE_PER_HIT: {
      value: 0.05,
      min: 0.01,
      max: 0.2,
      step: 0.005,
      description: "Force added per accepted hit (0–1 scale)",
    },
    FORCE_RETURN_MUL: {
      value: 2,
      min: 1,
      max: 5,
      step: 0.5,
      description: "Force multiplier when deactivating",
    },
    WARNING_AT: {
      value: 0.6,
      min: 0.1,
      max: 1,
      step: 0.05,
      description: "Force threshold to show warning overlay",
    },
    WARNING_MIN_MS: {
      value: 2000,
      min: 500,
      max: 5000,
      step: 100,
      description: "Minimum time warning must display before flip",
    },
    WARNING_HIDE_OFFSET: {
      value: 0.1,
      min: 0,
      max: 0.5,
      step: 0.05,
      description: "Force drop below warning threshold to hide it",
    },
    DRAIN_BASE: {
      value: 0.0015,
      min: 0,
      max: 0.01,
      step: 0.0001,
      description: "Base force drain per frame at 60fps",
    },
    DRAIN_FORCE_SCALE: {
      value: 0.00075,
      min: 0,
      max: 0.005,
      step: 0.0001,
      description: "Drain reduction at high force",
    },
    EDGE_TOLERANCE: {
      value: 30,
      min: 5,
      max: 100,
      step: 5,
      description: "Pixels from scroll boundary to count as edge",
    },
    TOUCH_DRAG_THRESHOLD: {
      value: 60,
      min: 20,
      max: 200,
      step: 10,
      description: "Touch drag distance to register a hit",
    },
  },
  { theme: "upside-down" },
);

// ── Visual Effects ──
const UD_VFX = defineConstants(
  "themes.upsideDown.visuals",
  {
    SHAKE_THRESHOLD: {
      value: 0.2,
      min: 0,
      max: 1,
      step: 0.05,
      description: "Force level where screen shake begins",
    },
    SHAKE_INTENSITY: {
      value: 6,
      min: 0,
      max: 20,
      step: 1,
      description: "Maximum screen shake in pixels",
    },
    VIGNETTE_THRESHOLD: {
      value: 0.01,
      min: 0,
      max: 0.5,
      step: 0.01,
      description: "Force level where red vignette appears",
    },
    VIGNETTE_MAX_OPACITY: {
      value: 0.5,
      min: 0,
      max: 1,
      step: 0.05,
      description: "Maximum vignette opacity at warning threshold",
    },
    WARNING_HIDE_DELAY: {
      value: 300,
      min: 0,
      max: 1000,
      step: 50,
      description: "Warning fade-out duration in milliseconds",
    },
    WIPE_PHASE_MS: {
      value: 500,
      min: 100,
      max: 2000,
      step: 50,
      description: "Duration of wipe animation phase",
    },
    WIPE_SETTLE_MS: {
      value: 550,
      min: 100,
      max: 2000,
      step: 50,
      description: "Settle time before state changes",
    },
    FPS_BASELINE_MS: {
      value: 16.667,
      min: 8,
      max: 33,
      step: 0.001,
      description: "Frame normalization baseline (16.667 = 60fps)",
    },
    TILT_INTENSITY: {
      value: 8,
      min: 0,
      max: 20,
      step: 1,
      description: "Card tilt intensity at full pointer travel",
    },
    TILT_SCALE: {
      value: 1.02,
      min: 1,
      max: 1.1,
      step: 0.005,
      description: "Card tilt scale at full pointer travel",
    },
  },
  { theme: "upside-down" },
);

// ── Non-numeric constants ──
const VIGNETTE_INNER_STOP = "30%";
const VIGNETTE_COLOR = [180, 0, 0];

export function initUpsideDown() {
  let warningVisible = false;
  let warningShowTime = 0;
  let lastEdgeWasBottom = true;
  let disableCardUpside = null;
  // `themeCtx` is filled in by createTheme's return value below.  We read
  // themeCtx.isActive wherever we need to know "is the world currently
  // flipped?" — no local duplicate state.
  let themeCtx;

  const pageEl = document.querySelector(".page");
  const navEl = document.querySelector("nav");
  const { canvasEl, ctx: canvasCtx } = getCanvasCtx();

  // Red vignette overlay
  const overlay = document.createElement("div");
  overlay.className = "ud-overlay";
  document.body.appendChild(overlay);

  // Canvas-side hooks — anti-gravity dust drifting from the visual
  // floor toward the visual ceiling.  Coordinates are plain canvas
  // pixels; the canvas's own .flips-with-page CSS class handles the
  // visual inversion.
  const ud = createUpsideDown(canvasEl, canvasCtx);
  registerCanvasHooks("upside-down", {
    drawAmbient({ forces }) {
      ud.draw(forces);
    },
  });

  function showWarning() {
    if (warningVisible) return;
    warningVisible = true;
    window.dispatchEvent(
      new CustomEvent("achievement", {
        detail: { type: "upside-down-warning" },
      }),
    );
    const el = document.createElement("div");
    el.className = "ud-warning";
    el.id = "ud-warning";
    const flipped = themeCtx.isActive;
    const content = document.createElement("div");
    content.className = "ud-warning-content";

    const icon = document.createElement("p");
    icon.className = "ud-warning-icon";
    icon.textContent = "⚠";
    content.appendChild(icon);

    const title = document.createElement("h2");
    title.className = "ud-warning-title";
    title.textContent = flipped
      ? "THE RIFT IS REOPENING"
      : "THE WALL IS CRACKING";
    content.appendChild(title);

    const sub = document.createElement("p");
    sub.className = "ud-warning-sub";
    sub.textContent = flipped
      ? "You are clawing your way back to the surface."
      : "You are approaching the boundary between worlds.";
    content.appendChild(sub);

    const hint = document.createElement("p");
    hint.className = "ud-warning-hint";
    hint.textContent = flipped
      ? "Keep scrolling to break free…"
      : "Keep scrolling to break through… or stop while you can.";
    content.appendChild(hint);

    el.appendChild(content);
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add("visible"));
    warningShowTime = Date.now();
  }

  function hideWarning() {
    warningVisible = false;
    const el = document.getElementById("ud-warning");
    if (!el) return;
    el.classList.remove("visible");
    setTimeout(() => el.remove(), UD_VFX.WARNING_HIDE_DELAY);
  }

  // ── Bespoke sliding wipe ──
  // Unlike other themes, upside-down's wipe is a translateY slide that covers
  // the viewport, persists through the state swap, then slides out the other
  // side.  Direction depends on which scroll edge triggered the flip.
  function runSlidingWipe({ activating, runMidpoint, payload }) {
    hideWarning();
    const wipeFromBottom =
      payload && payload.direction
        ? payload.direction === "bottom"
        : lastEdgeWasBottom;

    return new Promise((resolve) => {
      // Dark wipe — sweeps across the screen in the direction of travel
      const wipe = document.createElement("div");
      wipe.className = "ud-wipe" + (activating ? "" : " ud-wipe-return");
      wipe.style.transform = wipeFromBottom
        ? "translateY(100%)"
        : "translateY(-100%)";
      document.body.appendChild(wipe);
      void wipe.offsetHeight;

      // Phase 1: Wipe covers the screen
      wipe.style.transition = `transform ${UD_VFX.WIPE_PHASE_MS / 1000}s ease-in`;
      wipe.style.transform = "translateY(0)";

      // Phase 2: Swap state while fully covered
      setTimeout(() => {
        runMidpoint();
        pageEl.style.translate = "";
        overlay.style.background = "none";

        // runMidpoint flipped themeCtx.isActive; read the post-flip value.
        if (themeCtx.isActive) {
          document.body.appendChild(navEl);
          window.scrollTo(0, 0);
        } else {
          pageEl.insertBefore(navEl, pageEl.firstChild);
          // Bottom edge → land on top (mirror of where we left), top edge → land on bottom
          window.scrollTo(
            0,
            wipeFromBottom ? 0 : document.documentElement.scrollHeight,
          );
        }

        // Phase 3: Wipe continues through, revealing the new world
        requestAnimationFrame(() => {
          wipe.style.transition = `transform ${UD_VFX.WIPE_PHASE_MS / 1000}s ease-out`;
          wipe.style.transform = wipeFromBottom
            ? "translateY(-100%)"
            : "translateY(100%)";
          setTimeout(() => {
            wipe.remove();
            resolve();
          }, UD_VFX.WIPE_SETTLE_MS);
        });
      }, UD_VFX.WIPE_SETTLE_MS);
    });
  }

  const trigger = createOverscrollTrigger({
    forcePerHit: UD_FORCE.FORCE_PER_HIT,
    cooldownMs: UD_FORCE.COOLDOWN,
    edgeTolerance: UD_FORCE.EDGE_TOLERANCE,
    touchDragThreshold: UD_FORCE.TOUCH_DRAG_THRESHOLD,
    returnMultiplier: UD_FORCE.FORCE_RETURN_MUL,
    fpsBaselineMs: UD_VFX.FPS_BASELINE_MS,
    onHit({ force, direction }) {
      lastEdgeWasBottom = direction === "bottom";
      if (force >= UD_FORCE.WARNING_AT && !warningVisible) {
        showWarning();
      }
    },
    canComplete({ force }) {
      // Only complete once the warning has been up long enough
      return (
        warningVisible &&
        Date.now() - warningShowTime >= UD_FORCE.WARNING_MIN_MS
      );
    },
    // Dynamic drain — fast at low force (early damage clears quickly),
    // slow at high force (sustained effort is rewarded, warning sticks around).
    // The factory's drainFn is time-based (dt is 60fps-normalized), so drain
    // rate is consistent regardless of browser FPS.
    drainFn(force, dt, _active) {
      const drain =
        (UD_FORCE.DRAIN_BASE - force * UD_FORCE.DRAIN_FORCE_SCALE) * dt;
      const next = Math.max(0, force - drain);
      if (
        next < UD_FORCE.WARNING_AT - UD_FORCE.WARNING_HIDE_OFFSET &&
        warningVisible
      ) {
        hideWarning();
      }
      return next;
    },
  });

  themeCtx = createTheme({
    id: "upside-down",
    trigger,
    indicators: [
      // Red vignette intensity
      {
        threshold: UD_VFX.VIGNETTE_THRESHOLD,
        apply(force) {
          const intensity = Math.min(1, force / UD_FORCE.WARNING_AT);
          overlay.style.background =
            force > UD_VFX.VIGNETTE_THRESHOLD
              ? `radial-gradient(ellipse at center, transparent ${VIGNETTE_INNER_STOP}, rgba(${VIGNETTE_COLOR},${intensity * UD_VFX.VIGNETTE_MAX_OPACITY}) 100%)`
              : "none";
        },
        clear() {
          overlay.style.background = "none";
        },
      },
      // Screen shake on .page
      {
        threshold: UD_VFX.SHAKE_THRESHOLD,
        apply(force) {
          if (force > UD_VFX.SHAKE_THRESHOLD) {
            const shake = force * UD_VFX.SHAKE_INTENSITY;
            const dx = (Math.random() - 0.5) * shake;
            const dy = (Math.random() - 0.5) * shake;
            pageEl.style.translate = `${dx}px ${dy}px`;
          } else {
            pageEl.style.translate = "";
          }
        },
        clear() {
          pageEl.style.translate = "";
        },
      },
    ],
    wipe: runSlidingWipe,
    onActivate() {
      disableCardUpside = enableCardEffects({
        className: "upside-card",
        tilt: {
          intensity: UD_VFX.TILT_INTENSITY,
          scale: UD_VFX.TILT_SCALE,
          invertY: true,
        },
      });
    },
    onDeactivate() {
      if (disableCardUpside) disableCardUpside();
      ud.cleanup();
    },
  });
}
