import { defineConstants } from "../dev/registry.js";
import { getCanvasCtx } from "../canvas-utils.js";
import { getSkyStars } from "../sky.js";
import { createConstellation } from "../particles/constellation.js";
import { createTheme } from "./factory.js";
import { hasActiveThemeExcept } from "./registry.js";
import { registerCanvasHooks } from "./canvas-hooks.js";
import { createConstellationTrigger } from "./triggers.js";
import { prefersReducedMotion } from "../motion.js";

// ── Force & Stage Thresholds ──
const CF = defineConstants(
  "themes.constellation.force",
  {
    NEBULA_AT: 0.2,
    HINT_PULSE_AT: 0.4,
    VIGNETTE_AT: 0.6,
    DIM_REST_AT: 0.8,
    WIPE_COVER_MS: 400,
    WIPE_REVEAL_MS: 600,
  },
  { theme: "constellation" },
);

// ── Visual Constants ──
const CV = defineConstants(
  "themes.constellation.visuals",
  {
    HIT_RADIUS: 28,
    NEBULA_MAX_OPACITY: 0.55,
    VIGNETTE_MAX_OPACITY: 0.7,
    HINT_PULSE_STRENGTH: 0.7,
    // Faint ember shown on a locked constellation's remaining stars before the
    // staged hint threshold — guidance the moment the user engages.
    HINT_FLOOR: 0.22,
    HUE_ROTATE: 220,
    SAT_BOOST: 0.3,
    BRI_DROP: 0.45,
    // Chain length at which the "N / M" progress badge briefly appears.
    PROGRESS_MIN_CHAIN: 2,
    // How long the progress badge fades in, holds, and fades out (ms).
    PROGRESS_SHOW_MS: 1600,
    // Idle time mid-trace before the remaining stars twinkle strongly (ms).
    IDLE_HINT_MS: 60000,
    // Hint-pulse strength for the "you seem stuck" idle nudge — above the
    // staged HINT_PULSE_STRENGTH so it reads as a deliberate beckon.
    IDLE_HINT_STRENGTH: 1,
  },
  { theme: "constellation" },
);

export function initConstellation() {
  const { canvasEl } = getCanvasCtx();

  // Progressive DOM overlays (nebula tint + vignette).  Both elements
  // persist; opacity is driven by indicator apply functions.
  const nebulaOverlay = document.createElement("div");
  nebulaOverlay.className = "constellation-nebula";
  document.body.appendChild(nebulaOverlay);

  const vignetteOverlay = document.createElement("div");
  vignetteOverlay.className = "constellation-vignette";
  document.body.appendChild(vignetteOverlay);

  const particles = createConstellation(canvasEl);

  // Transient "N / M" badge that surfaces the trace's progress once a couple
  // of stars are in, then fades — reused across shows so it never accumulates.
  const progressEl = document.createElement("div");
  progressEl.className = "constellation-progress";
  progressEl.setAttribute("aria-hidden", "true");
  document.body.appendChild(progressEl);
  let progressAnim = null;
  let progressHideTimer = null;

  function showProgress(chainLength, total) {
    if (chainLength < CV.PROGRESS_MIN_CHAIN || !total) return;
    progressEl.textContent = `${chainLength} / ${total}`;
    progressAnim?.cancel?.();
    clearTimeout(progressHideTimer);
    if (prefersReducedMotion()) {
      // Reduced motion: still show the count, just plainly — no fade.
      progressEl.style.opacity = "1";
      progressHideTimer = setTimeout(() => {
        progressEl.style.opacity = "";
      }, CV.PROGRESS_SHOW_MS);
      return;
    }
    progressEl.style.opacity = "";
    progressAnim = progressEl.animate(
      [
        { opacity: 0 },
        { opacity: 1, offset: 0.15 },
        { opacity: 1, offset: 0.7 },
        { opacity: 0 },
      ],
      { duration: CV.PROGRESS_SHOW_MS, easing: "ease-out" },
    );
  }

  // If a trace stalls mid-pattern, beckon the remaining stars with a stronger
  // twinkle. Rearmed on each correct hit; only fires while a candidate is
  // locked and the pattern hasn't formed yet.
  let idleTimer = null;
  function clearIdleHint() {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  }
  function armIdleHint() {
    clearIdleHint();
    idleTimer = setTimeout(() => {
      const state = trigger.getState();
      if (state.isActive || !state.candidateId) return;
      applyHintPulse(CV.IDLE_HINT_STRENGTH);
    }, CV.IDLE_HINT_MS);
  }

  const trigger = createConstellationTrigger({
    getStars: getSkyStars,
    getCanvas: () => canvasEl,
    hitRadius: CV.HIT_RADIUS,
    onChainChange(state) {
      particles.setChain(state);
    },
    onCorrectHit({ constellationId, chainLength, total }) {
      showProgress(chainLength, total);
      armIdleHint();
      window.dispatchEvent(
        new CustomEvent("achievement", {
          detail: {
            type: "star-clicked",
            constellationId,
            chainLength,
          },
        }),
      );
    },
    onWrongHit() {
      window.dispatchEvent(
        new CustomEvent("achievement", {
          detail: { type: "constellation-wrong-hit" },
        }),
      );
    },
  });

  function setHintPulse(star, value) {
    if (star.hintPulse !== value) star.hintPulse = value;
  }

  function clearAllHints() {
    const stars = getSkyStars();
    if (!stars) return;
    for (const s of stars) setHintPulse(s, 0);
  }

  function applyHintPulse(intensity) {
    const stars = getSkyStars();
    if (!stars) return;
    const state = trigger.getState();
    const locked = state.candidateId;
    if (!locked) {
      clearAllHints();
      return;
    }
    const clickedIndices = new Set(state.chain.map((c) => c.index));
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const want =
        s.constellationId === locked && !clickedIndices.has(i) ? intensity : 0;
      setHintPulse(s, want);
    }
  }

  createTheme({
    id: "constellation",
    trigger,
    indicators: [
      // ── 1. Indigo nebula tint via CSS overlay ──
      {
        threshold: CF.NEBULA_AT,
        apply(progress) {
          if (progress < CF.NEBULA_AT) {
            nebulaOverlay.style.opacity = "0";
            return;
          }
          const t = Math.min(1, (progress - CF.NEBULA_AT) / (1 - CF.NEBULA_AT));
          nebulaOverlay.style.opacity = String(t * CV.NEBULA_MAX_OPACITY);
        },
        clear() {
          nebulaOverlay.style.opacity = "0";
        },
      },
      // ── 2. Hint-pulse on remaining candidate stars ──
      // Once a candidate constellation is locked (the user clicked a correct
      // star), its remaining stars get a faint ember immediately, ramping up
      // to the full staged hint at the threshold — so guidance starts the
      // moment they engage instead of after several blind clicks. The ember is
      // buildup-only; deactivation keeps the original staged-threshold pulse.
      {
        threshold: CF.HINT_PULSE_AT,
        apply(progress, ctx) {
          const floor = ctx.isActive ? 0 : CV.HINT_FLOOR;
          if (progress < CF.HINT_PULSE_AT) {
            applyHintPulse(floor);
            return;
          }
          const t = Math.min(
            1,
            (progress - CF.HINT_PULSE_AT) / (1 - CF.HINT_PULSE_AT),
          );
          applyHintPulse(Math.max(floor, t * CV.HINT_PULSE_STRENGTH));
        },
        clear() {
          clearAllHints();
        },
      },
      // ── 3. Vignette darkens the periphery ──
      {
        threshold: CF.VIGNETTE_AT,
        apply(progress) {
          if (progress < CF.VIGNETTE_AT) {
            vignetteOverlay.style.opacity = "0";
            return;
          }
          const t = Math.min(
            1,
            (progress - CF.VIGNETTE_AT) / (1 - CF.VIGNETTE_AT),
          );
          vignetteOverlay.style.opacity = String(t * CV.VIGNETTE_MAX_OPACITY);
        },
        clear() {
          vignetteOverlay.style.opacity = "0";
        },
      },
      // ── 4. Canvas filter — only when no other theme is stealing it ──
      {
        threshold: CF.DIM_REST_AT,
        apply(progress) {
          if (hasActiveThemeExcept("constellation")) {
            canvasEl.style.filter = "";
            return;
          }
          if (progress < CF.DIM_REST_AT) {
            canvasEl.style.filter = "";
            return;
          }
          const t = Math.min(
            1,
            (progress - CF.DIM_REST_AT) / (1 - CF.DIM_REST_AT),
          );
          const sat = 1 + t * CV.SAT_BOOST;
          const bri = 1 - t * CV.BRI_DROP;
          const hue = t * CV.HUE_ROTATE;
          canvasEl.style.filter = `hue-rotate(${hue.toFixed(0)}deg) saturate(${sat.toFixed(2)}) brightness(${bri.toFixed(2)})`;
        },
        clear() {
          canvasEl.style.filter = "";
        },
      },
    ],
    wipe: {
      className: "constellation-wipe",
      reverseModifier: "reverse",
      coverMs: CF.WIPE_COVER_MS,
      revealMs: CF.WIPE_REVEAL_MS,
    },
    onActivate({ payload }) {
      // The pattern formed — no more nudging toward the next star.
      clearIdleHint();
      const id = payload && payload.constellationId;
      if (id) {
        // Gesture-based activation.  The trigger's last emit ran inside
        // the completing click, before the factory flipped isActive at
        // the wipe midpoint — refresh the particle state so dust and
        // chain-active styling pick up the now-true isActive without
        // waiting for the user's next click.
        particles.setChain(trigger.getState());
        window.dispatchEvent(
          new CustomEvent("achievement", {
            detail: { type: "constellation-formed", constellationId: id },
          }),
        );
      } else {
        // HUD/programmatic activation: no gesture built up state, so any
        // residual chain or candidate is stale relative to the now-active
        // theme.  Reset clears it and emits a fresh snapshot — also
        // restores gesture-based deactivation, which otherwise gets
        // wedged at force = 0 because target() can't resolve a
        // constellation without activatedConstellationId.
        trigger.reset();
      }
    },
    onDeactivate() {
      // reset() emits an empty chain through onChainChange so the
      // particle renderer follows in the same step.
      trigger.reset();
      clearAllHints();
      clearIdleHint();
    },
  });

  // Hooks run every frame so chain lines render during buildup; dust
  // and lines both self-gate inside particles.draw.
  registerCanvasHooks("constellation", {
    alwaysActive: true,
    drawAmbient(frame) {
      particles.draw(frame);
    },
  });

  return {
    stop() {
      trigger.stop();
      clearIdleHint();
      clearTimeout(progressHideTimer);
      nebulaOverlay.remove();
      vignetteOverlay.remove();
      progressEl.remove();
      clearAllHints();
    },
  };
}
