import { defineConstants } from "../dev/registry.js";
import { enableCardEffects } from "../service-cards.js";
import { prefersReducedMotion } from "../motion.js";
import { createMode } from "./factory.js";
import { createKeySequenceTrigger } from "./triggers.js";

// Mode metadata (id, label, color, icon) lives in modes/registry.js.
// This file is for behavior only.

// ── Force & Activation ──
const PF = defineConstants(
  "modes.paperForce",
  {
    MAX_GAP_MS: 600,
    DECAY_TIMEOUT_MS: 2000,
    DECAY_RATE: 0.4,
    GRAIN_AT: 0.15,
    DESAT_AT: 0.3,
    STROKE_SEEP_AT: 0.5,
    INK_FLOOD_AT: 0.8,
    WIPE_COVER_MS: 400,
    WIPE_REVEAL_MS: 600,
  },
  { mode: "paper" },
);

// ── Visual Effects ──
const PV = defineConstants(
  "modes.paperVisuals",
  {
    GRAIN_OPACITY_BASE: 0.025,
    GRAIN_OPACITY_PEAK: 0.14,
    DESAT_SAT_MIN: 0.4,
    DESAT_CONTRAST_BOOST: 0.15,
    DESAT_SEPIA_MAX: 0.35,
    OVERLAY_MAX_OPACITY: 0.9,
    LOGO_SAT_DROP: 0.9,
    LOGO_BRI_DROP: 0.6,
    LOGO_CONTRAST_BOOST: 0.4,
    PAGE_TURN_AMP_PX: 2,
    PAGE_TURN_ROT_DEG: 0.6,
    PAGE_TURN_LERP: 0.08,
    PAGE_TURN_TARGET_DECAY: 0.88,
    SCROLL_NORM_FACTOR: 0.05,
    PAGE_TURN_SETTLE_PX: 0.01,
    PAGE_TURN_SETTLE_DEG: 0.001,
  },
  { mode: "paper" },
);

// ── Activation words — tracked in parallel until one completes ──
const ACTIVATION_WORDS = ["SKETCH", "DRAW"];
const DEACTIVATION_WORDS = ["ERASE"];

export function initPaper() {
  const canvasEl = document.getElementById("bg-canvas");
  const cloudSvg = document.querySelector(".cloud-svg");
  const pageEl = document.querySelector(".page");

  // ── Progressive overlay ──
  const overlay = document.createElement("div");
  overlay.className = "paper-overlay";
  document.body.appendChild(overlay);

  // ── Card paper interactions ──
  let disableCardPaper = null;

  // ── Page-turn state — written by the scroll handler, read by pageTurnTick ──
  let pageTargetX = 0;
  let pageTargetRot = 0;
  let pageCurrentX = 0;
  let pageCurrentRot = 0;
  let lastScrollY = window.scrollY || 0;
  let pageTurnRaf = null;

  function pageTurnTick() {
    if (prefersReducedMotion() || !pageEl) {
      pageTurnRaf = null;
      return;
    }
    pageTargetX *= PV.PAGE_TURN_TARGET_DECAY;
    pageTargetRot *= PV.PAGE_TURN_TARGET_DECAY;
    pageCurrentX += (pageTargetX - pageCurrentX) * PV.PAGE_TURN_LERP;
    pageCurrentRot += (pageTargetRot - pageCurrentRot) * PV.PAGE_TURN_LERP;
    if (
      Math.abs(pageCurrentX) > PV.PAGE_TURN_SETTLE_PX ||
      Math.abs(pageCurrentRot) > PV.PAGE_TURN_SETTLE_DEG
    ) {
      pageEl.style.setProperty(
        "--paper-page-x",
        pageCurrentX.toFixed(2) + "px",
      );
      pageEl.style.setProperty(
        "--paper-page-rot",
        pageCurrentRot.toFixed(3) + "deg",
      );
    } else {
      pageEl.style.removeProperty("--paper-page-x");
      pageEl.style.removeProperty("--paper-page-rot");
    }
    pageTurnRaf = requestAnimationFrame(pageTurnTick);
  }

  function startPageTurn() {
    if (pageTurnRaf !== null) return;
    lastScrollY = window.scrollY || 0;
    pageTurnRaf = requestAnimationFrame(pageTurnTick);
  }

  function stopPageTurn() {
    if (pageTurnRaf !== null) {
      cancelAnimationFrame(pageTurnRaf);
      pageTurnRaf = null;
    }
    pageTargetX = 0;
    pageTargetRot = 0;
    pageCurrentX = 0;
    pageCurrentRot = 0;
    if (pageEl) {
      pageEl.style.removeProperty("--paper-page-x");
      pageEl.style.removeProperty("--paper-page-rot");
    }
  }

  window.addEventListener(
    "scroll",
    () => {
      if (pageTurnRaf === null) return;
      const y = window.scrollY || 0;
      const delta = y - lastScrollY;
      lastScrollY = y;
      const norm = Math.max(-1, Math.min(1, delta * PV.SCROLL_NORM_FACTOR));
      pageTargetX = norm * PV.PAGE_TURN_AMP_PX;
      pageTargetRot = norm * PV.PAGE_TURN_ROT_DEG;
    },
    { passive: true },
  );

  createMode({
    id: "paper",
    trigger: createKeySequenceTrigger({
      activationWords: ACTIVATION_WORDS,
      deactivationWords: DEACTIVATION_WORDS,
      maxGapMs: PF.MAX_GAP_MS,
      decayTimeoutMs: PF.DECAY_TIMEOUT_MS,
      decayRate: PF.DECAY_RATE,
    }),
    indicators: [
      // ── 1. Grain boost (via body CSS variable) ──
      {
        threshold: PF.GRAIN_AT,
        apply(progress) {
          if (progress < PF.GRAIN_AT) {
            document.body.style.removeProperty("--paper-grain-opacity");
            return;
          }
          const t = Math.min(1, (progress - PF.GRAIN_AT) / (1 - PF.GRAIN_AT));
          const o =
            PV.GRAIN_OPACITY_BASE +
            t * (PV.GRAIN_OPACITY_PEAK - PV.GRAIN_OPACITY_BASE);
          document.body.style.setProperty(
            "--paper-grain-opacity",
            o.toFixed(3),
          );
        },
        clear() {
          document.body.style.removeProperty("--paper-grain-opacity");
        },
      },
      // ── 2. Desaturation on canvas ──
      {
        threshold: PF.DESAT_AT,
        apply(progress) {
          // Don't fight other modes' own canvas filters
          if (
            document.body.classList.contains("upside-down") ||
            document.body.classList.contains("frozen") ||
            document.body.classList.contains("deep-sea") ||
            document.body.classList.contains("blocky") ||
            document.body.classList.contains("rainy")
          ) {
            canvasEl.style.filter = "";
            return;
          }
          if (progress < PF.DESAT_AT) {
            canvasEl.style.filter = "";
            return;
          }
          const t = Math.min(1, (progress - PF.DESAT_AT) / (1 - PF.DESAT_AT));
          const sat = 1 - t * (1 - PV.DESAT_SAT_MIN);
          const contrast = 1 + t * PV.DESAT_CONTRAST_BOOST;
          const sepia = t * PV.DESAT_SEPIA_MAX;
          canvasEl.style.filter = `saturate(${sat.toFixed(2)}) contrast(${contrast.toFixed(2)}) sepia(${sepia.toFixed(2)})`;
        },
        clear() {
          canvasEl.style.filter = "";
        },
      },
      // ── 3. Stroke seeping — overlay opacity ──
      {
        threshold: PF.STROKE_SEEP_AT,
        apply(progress) {
          if (progress < PF.STROKE_SEEP_AT) {
            overlay.style.opacity = "0";
            return;
          }
          const t = Math.min(
            1,
            (progress - PF.STROKE_SEEP_AT) / (1 - PF.STROKE_SEEP_AT),
          );
          overlay.style.opacity = (t * PV.OVERLAY_MAX_OPACITY).toFixed(2);
        },
        clear() {
          overlay.style.opacity = "0";
        },
      },
      // ── 4. Ink flood — logo filter at high force ──
      {
        threshold: PF.INK_FLOOD_AT,
        apply(progress) {
          if (!cloudSvg) return;
          if (progress < PF.INK_FLOOD_AT) {
            cloudSvg.style.filter = "";
            return;
          }
          const t = Math.min(
            1,
            (progress - PF.INK_FLOOD_AT) / (1 - PF.INK_FLOOD_AT),
          );
          const sat = 1 - t * PV.LOGO_SAT_DROP;
          const bri = 1 - t * PV.LOGO_BRI_DROP;
          const con = 1 + t * PV.LOGO_CONTRAST_BOOST;
          cloudSvg.style.filter = `saturate(${sat.toFixed(2)}) brightness(${bri.toFixed(2)}) contrast(${con.toFixed(2)})`;
        },
        clear() {
          if (cloudSvg) cloudSvg.style.filter = "";
        },
      },
    ],
    wipe: {
      className: "paper-wipe",
      reverseModifier: "eraser",
      coverMs: PF.WIPE_COVER_MS,
      revealMs: PF.WIPE_REVEAL_MS,
    },
    onActivate() {
      disableCardPaper = enableCardEffects({
        className: "paper-card",
        tilt: { intensity: 2, scale: 1.005 },
      });
      startPageTurn();
    },
    onDeactivate() {
      if (disableCardPaper) disableCardPaper();
      stopPageTurn();
    },
  });
}
