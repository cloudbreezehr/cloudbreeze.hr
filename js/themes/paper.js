import { defineConstants } from "../dev/registry.js";
import { enableCardEffects } from "../service-cards.js";
import { prefersReducedMotion } from "../motion.js";
import { createTheme } from "./factory.js";
import { hasActiveThemeExcept } from "./registry.js";
import { createKeySequenceTrigger } from "./triggers.js";

// Theme metadata (id, label, color, icon) lives in themes/registry.js.
// This file is for behavior only.

// ── Force & Activation ──
const PF = defineConstants(
  "themes.paperForce",
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
  { theme: "paper" },
);

// ── Visual Effects ──
const PV = defineConstants(
  "themes.paperVisuals",
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
    // Hover text thickening — cursor within HOVER_RADIUS_PX of a text
    // element bumps its --paper-ink-proximity toward 1; CSS reads the var
    // and darkens the text-shadow so the pen feels like it's pressing
    // harder nearby.
    HOVER_RADIUS_PX: 80,
    HOVER_LERP: 0.2,
    HOVER_SETTLE: 0.005,
    TILT_INTENSITY: 2,
    TILT_SCALE: 1.005,
  },
  { theme: "paper" },
);

// Every semantic text element thickens when the cursor is near it.
// Kept intentionally broad so paper theme doesn't have to know about
// specific other modules' markup.
const HOVER_TARGETS = "h1, h2, h3, h4, h5, h6, p, span, a, li, em, strong";

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

  // ── Hover text thickening ──
  // While paper is active, text elements near the cursor get a stronger
  // text-shadow so the pen feels like it's pressing harder.  A rAF loop
  // lerps each element's --paper-ink-proximity toward the current target
  // (0..1 based on distance to cursor).  Disabled on touch-only devices
  // and under reduced-motion.
  const touchOnly = matchMedia("(hover: none)").matches;
  let hoverEls = [];
  // Per-element state — parallel arrays keyed by index into hoverEls.
  // Using arrays of primitives instead of a Map keeps the per-frame
  // inner loop branch-free.
  let hoverTargets = [];
  let hoverCurrents = [];
  let hoverCursorX = -Infinity;
  let hoverCursorY = -Infinity;
  let hoverRaf = null;

  function hoverPointer(e) {
    hoverCursorX = e.clientX;
    hoverCursorY = e.clientY;
  }

  function hoverTick() {
    if (prefersReducedMotion()) {
      hoverRaf = null;
      return;
    }
    const r = PV.HOVER_RADIUS_PX;
    for (let i = 0; i < hoverEls.length; i++) {
      const el = hoverEls[i];
      const rect = el.getBoundingClientRect();
      // Closest point on rect to cursor, then distance.
      const nx = Math.max(rect.left, Math.min(hoverCursorX, rect.right));
      const ny = Math.max(rect.top, Math.min(hoverCursorY, rect.bottom));
      const dx = hoverCursorX - nx;
      const dy = hoverCursorY - ny;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const target = dist >= r ? 0 : 1 - dist / r;
      hoverTargets[i] = target;
      const next =
        hoverCurrents[i] + (target - hoverCurrents[i]) * PV.HOVER_LERP;
      // Snap close-to-zero back to exactly 0 so we can remove the property.
      if (Math.abs(next - target) < PV.HOVER_SETTLE && target === 0) {
        if (hoverCurrents[i] !== 0) {
          hoverCurrents[i] = 0;
          el.style.removeProperty("--paper-ink-proximity");
        }
      } else {
        hoverCurrents[i] = next;
        el.style.setProperty("--paper-ink-proximity", next.toFixed(3));
      }
    }
    hoverRaf = requestAnimationFrame(hoverTick);
  }

  function startHover() {
    if (touchOnly || hoverRaf !== null) return;
    hoverEls = Array.from(document.querySelectorAll(HOVER_TARGETS));
    hoverTargets = new Array(hoverEls.length).fill(0);
    hoverCurrents = new Array(hoverEls.length).fill(0);
    window.addEventListener("pointermove", hoverPointer, { passive: true });
    hoverRaf = requestAnimationFrame(hoverTick);
  }

  function stopHover() {
    if (hoverRaf !== null) {
      cancelAnimationFrame(hoverRaf);
      hoverRaf = null;
    }
    window.removeEventListener("pointermove", hoverPointer);
    for (const el of hoverEls) {
      el.style.removeProperty("--paper-ink-proximity");
    }
    hoverEls = [];
    hoverTargets = [];
    hoverCurrents = [];
  }

  createTheme({
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
          // Don't fight other themes' own canvas filters
          if (hasActiveThemeExcept("paper")) {
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
        tilt: { intensity: PV.TILT_INTENSITY, scale: PV.TILT_SCALE },
      });
      startPageTurn();
      startHover();
    },
    onDeactivate() {
      if (disableCardPaper) disableCardPaper();
      stopPageTurn();
      stopHover();
    },
  });
}
