import { defineConstants } from "../dev/registry.js";
import { playWipe } from "../effects/wipe.js";
import { enableCardEffects } from "../service-cards.js";
import { prefersReducedMotion } from "../motion.js";
import { registerToggle } from "./registry.js";

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

// Key-sequence accumulator.  Advances a per-word prefix index on each letter;
// wrong letters reset *all* tracked words' prefixes.  Returns { matchForce,
// completed, anyAdvanced } after each keystroke.
function createSequenceTracker(words) {
  const state = words.map(() => ({ idx: 0, lastLetterAt: 0 }));
  return {
    reset() {
      for (const s of state) {
        s.idx = 0;
        s.lastLetterAt = 0;
      }
    },
    ingest(letter, now) {
      let matchForce = 0;
      let completed = null;
      let anyAdvanced = false;
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const s = state[i];
        // Expire if gap exceeded since the last advance on this word
        if (s.idx > 0 && now - s.lastLetterAt > PF.MAX_GAP_MS) s.idx = 0;
        const expected = word[s.idx];
        if (letter === expected) {
          s.idx++;
          s.lastLetterAt = now;
          anyAdvanced = true;
          if (s.idx >= word.length) {
            completed = word;
            s.idx = 0;
          }
        } else {
          s.idx = 0;
          // Letters may also be the first letter of this word — start fresh
          if (letter === word[0]) {
            s.idx = 1;
            s.lastLetterAt = now;
            anyAdvanced = true;
          }
        }
        const f = s.idx / word.length;
        if (f > matchForce) matchForce = f;
      }
      return { matchForce, completed, anyAdvanced };
    },
  };
}

export function initPaper() {
  let force = 0;
  let isPaper = false;
  let isTransitioning = false;
  let lastAdvanceTime = 0;

  const canvasEl = document.getElementById("bg-canvas");
  const cloudSvg = document.querySelector(".cloud-svg");
  const pageEl = document.querySelector(".page");

  // ── Progressive overlay ──
  const overlay = document.createElement("div");
  overlay.className = "paper-overlay";
  document.body.appendChild(overlay);

  // ── Sequence trackers ──
  let tracker = createSequenceTracker(ACTIVATION_WORDS);

  // ── 1. Grain boost (via body CSS variable) ──
  function updateGrain(progress) {
    if (progress < PF.GRAIN_AT) {
      document.body.style.removeProperty("--paper-grain-opacity");
      return;
    }
    const t = Math.min(1, (progress - PF.GRAIN_AT) / (1 - PF.GRAIN_AT));
    const o =
      PV.GRAIN_OPACITY_BASE +
      t * (PV.GRAIN_OPACITY_PEAK - PV.GRAIN_OPACITY_BASE);
    document.body.style.setProperty("--paper-grain-opacity", o.toFixed(3));
  }

  // ── 2. Desaturation on canvas ──
  function updateDesat(progress) {
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
  }

  // ── 3. Stroke seeping — overlay opacity ──
  function updateOverlay(progress) {
    if (progress < PF.STROKE_SEEP_AT) {
      overlay.style.opacity = "0";
      return;
    }
    const t = Math.min(
      1,
      (progress - PF.STROKE_SEEP_AT) / (1 - PF.STROKE_SEEP_AT),
    );
    overlay.style.opacity = (t * PV.OVERLAY_MAX_OPACITY).toFixed(2);
  }

  // ── 4. Ink flood — logo filter at high force ──
  function updateInkFlood(progress) {
    if (progress < PF.INK_FLOOD_AT) {
      if (cloudSvg) cloudSvg.style.filter = "";
      return;
    }
    const t = Math.min(1, (progress - PF.INK_FLOOD_AT) / (1 - PF.INK_FLOOD_AT));
    if (cloudSvg) {
      const sat = 1 - t * PV.LOGO_SAT_DROP;
      const bri = 1 - t * PV.LOGO_BRI_DROP;
      const con = 1 + t * PV.LOGO_CONTRAST_BOOST;
      cloudSvg.style.filter = `saturate(${sat.toFixed(2)}) brightness(${bri.toFixed(2)}) contrast(${con.toFixed(2)})`;
    }
  }

  function updateVisuals() {
    updateGrain(force);
    updateDesat(force);
    updateOverlay(force);
    updateInkFlood(force);
  }

  function clearIndicators() {
    force = 0;
    document.body.style.removeProperty("--paper-grain-opacity");
    canvasEl.style.filter = "";
    if (cloudSvg) cloudSvg.style.filter = "";
    overlay.style.opacity = "0";
  }

  // ── Card paper interactions ──
  let disableCardPaper = null;

  function enableCardPaper() {
    disableCardPaper = enableCardEffects({
      className: "paper-card",
      tilt: { intensity: 2, scale: 1.005 },
    });
  }

  // ── Paper transition (ink sweep) ──
  function triggerPaper() {
    if (isTransitioning) return;
    isTransitioning = true;
    tracker.reset();

    playWipe({
      className: "paper-wipe",
      coverMs: PF.WIPE_COVER_MS,
      revealMs: PF.WIPE_REVEAL_MS,
      onMidpoint() {
        isPaper = true;
        document.body.classList.add("paper");
        document.body.dataset.lastSubmode = "paper";
        window.dispatchEvent(
          new CustomEvent("achievement", {
            detail: { type: "mode-activate", mode: "paper" },
          }),
        );
        clearIndicators();
        enableCardPaper();
        tracker = createSequenceTracker(DEACTIVATION_WORDS);
      },
      onComplete() {
        isTransitioning = false;
      },
    });
  }

  // ── Reverse transition (eraser sweep) ──
  function triggerErase() {
    if (isTransitioning) return;
    isTransitioning = true;
    tracker.reset();

    playWipe({
      className: "paper-wipe eraser",
      coverMs: PF.WIPE_COVER_MS,
      revealMs: PF.WIPE_REVEAL_MS,
      onMidpoint() {
        isPaper = false;
        document.body.classList.remove("paper");
        window.dispatchEvent(
          new CustomEvent("achievement", {
            detail: { type: "mode-deactivate", mode: "paper" },
          }),
        );
        clearIndicators();
        if (disableCardPaper) disableCardPaper();
        tracker = createSequenceTracker(ACTIVATION_WORDS);
      },
      onComplete() {
        isTransitioning = false;
      },
    });
  }

  // ── Keydown handler ──
  const INPUT_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);
  function onKeydown(e) {
    if (isTransitioning) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = document.activeElement?.tagName;
    if (tag && INPUT_TAGS.has(tag)) return;
    if (document.activeElement?.isContentEditable) return;
    // Only single-letter keys advance the sequence.  Everything else
    // (arrows, F-keys, Tab, Enter, Shift, etc.) is ignored — not counted
    // as a wrong letter — so users can hit modifiers without resetting.
    if (e.key.length !== 1) return;
    const letter = e.key.toUpperCase();
    if (letter < "A" || letter > "Z") return;

    const now = Date.now();
    const { matchForce, completed, anyAdvanced } = tracker.ingest(letter, now);
    if (anyAdvanced) lastAdvanceTime = now;

    // The running force is max(sequence progress, decaying force).
    // When anyAdvanced, bump to at least the new match.  Otherwise the
    // decay loop owns force evolution.
    if (anyAdvanced) {
      force = Math.max(force, matchForce);
      updateVisuals();
    }

    if (completed) {
      force = 1;
      updateVisuals();
      if (isPaper) triggerErase();
      else triggerPaper();
    }
  }

  window.addEventListener("keydown", onKeydown);

  // ── Decay loop ──
  let lastTick = performance.now();
  function tick() {
    const now = performance.now();
    const dt = (now - lastTick) / 1000;
    lastTick = now;

    if (force > 0 && !isTransitioning) {
      const sinceAdvance = Date.now() - lastAdvanceTime;
      if (sinceAdvance > PF.DECAY_TIMEOUT_MS) {
        const decay = PF.DECAY_RATE * dt;
        force = Math.max(0, force - decay);
        if (force === 0) tracker.reset();
        updateVisuals();
      }
    }
    requestAnimationFrame(tick);
  }
  tick();

  // ── Scroll page-turn shift — active only in paper mode ──
  let pageTargetX = 0;
  let pageTargetRot = 0;
  let pageCurrentX = 0;
  let pageCurrentRot = 0;
  let lastScrollY = window.scrollY || 0;

  function onScroll() {
    if (!isPaper) return;
    const y = window.scrollY || 0;
    const delta = y - lastScrollY;
    lastScrollY = y;
    const norm = Math.max(-1, Math.min(1, delta * PV.SCROLL_NORM_FACTOR));
    pageTargetX = norm * PV.PAGE_TURN_AMP_PX;
    pageTargetRot = norm * PV.PAGE_TURN_ROT_DEG;
  }
  window.addEventListener("scroll", onScroll, { passive: true });

  function pageTurnTick() {
    if (isPaper && !prefersReducedMotion() && pageEl) {
      // Targets decay toward zero when scroll stops
      pageTargetX *= PV.PAGE_TURN_TARGET_DECAY;
      pageTargetRot *= PV.PAGE_TURN_TARGET_DECAY;
      pageCurrentX +=
        (pageTargetX - pageCurrentX) * PV.PAGE_TURN_LERP;
      pageCurrentRot +=
        (pageTargetRot - pageCurrentRot) * PV.PAGE_TURN_LERP;
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
    } else if (pageEl) {
      pageEl.style.removeProperty("--paper-page-x");
      pageEl.style.removeProperty("--paper-page-rot");
      pageCurrentX = 0;
      pageCurrentRot = 0;
      pageTargetX = 0;
      pageTargetRot = 0;
    }
    requestAnimationFrame(pageTurnTick);
  }
  pageTurnTick();

  registerToggle("paper", () => (isPaper ? triggerErase() : triggerPaper()));
}
