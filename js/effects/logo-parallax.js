// ── Logo Letter Parallax ──
// Per-letter drift on the nav logo: each letter leans toward the cursor by a
// small, per-letter weight.  Motion is eased each frame so the logo feels
// physical.

import { defineConstants } from "../dev/registry.js";
import { scaled } from "../motion.js";

// ── Constants ──
const LP = defineConstants("effects.logoParallax", {
  // Max pixel offset any letter can drift (center letters drift more).
  MAX_OFFSET_PX: 6,
  // Influence radius in pixels.  Beyond this the effect fades to zero.
  INFLUENCE_PX: 220,
  // Easing toward the target offset (0 → frozen, 1 → instant).
  EASE: 0.12,
  // Achievement: total frames of visible motion before unlock dispatches.
  ACHIEVEMENT_ACTIVE_FRAMES: 120,
  // Below this per-letter offset magnitude, the letter counts as "at rest".
  ACHIEVEMENT_MOTION_THRESHOLD_PX: 1,
  // Sub-perceptible drift at which a homing letter snaps to zero, so the loop
  // can idle instead of easing toward zero forever.
  SETTLE_EPSILON_PX: 0.05,
});

// Cursor is tracked at document level so letters respond to the pointer
// anywhere on the page, not only when hovering the logo.
let cursorX = 0;
let cursorY = 0;
let cursorKnown = false;

export function initLogoParallax() {
  const textEl = document.querySelector(".nav-logo .logo-text");
  const navEl = document.querySelector("nav");
  if (!textEl || !navEl) return;

  // Original markup: Cloud<span>breeze</span>.  Split both chunks into
  // per-letter spans, preserving the accent-color span around "breeze".
  const letters = splitIntoLetters(textEl);
  if (letters.length === 0) return;

  // Pre-compute per-letter weights so the middle of the word drifts more.
  // Sine-shaped curve from 0 → 1 → 0 across the letters.
  const weights = letters.map((_, i) => {
    const t = letters.length <= 1 ? 0.5 : i / (letters.length - 1);
    return Math.sin(t * Math.PI);
  });

  // Current offsets (eased toward targets each frame).
  const currentX = new Array(letters.length).fill(0);
  const currentY = new Array(letters.length).fill(0);

  // Cached geometry in viewport coordinates: the nav box (activation gate) and
  // each letter's home center. Read only when stale — never per frame — so the
  // eased loop does zero layout reads and can't thrash by interleaving reads
  // with the per-letter translate writes. The sticky nav holds these steady
  // across scroll; a resize (or the first use) invalidates them.
  let metricsStale = true;
  let navBox = null;
  const homeX = new Array(letters.length).fill(0);
  const homeY = new Array(letters.length).fill(0);

  function measure() {
    navBox = navEl.getBoundingClientRect();
    for (let i = 0; i < letters.length; i++) {
      const r = letters[i].getBoundingClientRect();
      // Back out the offset we've applied so a mid-motion remeasure still
      // yields the resting (untranslated) center.
      homeX[i] = r.left + r.width / 2 - currentX[i];
      homeY[i] = r.top + r.height / 2 - currentY[i];
    }
    metricsStale = false;
  }

  let activeFrames = 0;
  let achievementFired = false;

  // The loop self-suspends when there's nothing to animate and re-arms on the
  // next pointer move or resize, so an idle logo costs no frames.
  let rafId = null;
  function schedule() {
    if (rafId === null) rafId = requestAnimationFrame(tick);
  }

  function tick() {
    rafId = null;
    let busy = false;

    if (cursorKnown) {
      if (metricsStale) measure();
      // Activation gate: only pull letters when the cursor is inside the nav
      // box.  Outside it, letters ease back home — keeps the effect from
      // triggering off nearby page content like the hero tag.
      const inNav =
        cursorX >= navBox.left &&
        cursorX <= navBox.right &&
        cursorY >= navBox.top &&
        cursorY <= navBox.bottom;

      for (let i = 0; i < letters.length; i++) {
        let targetX = 0;
        let targetY = 0;
        if (inNav) {
          const dx = cursorX - homeX[i];
          const dy = cursorY - homeY[i];
          const dist = Math.hypot(dx, dy);
          const influence =
            dist < LP.INFLUENCE_PX ? 1 - dist / LP.INFLUENCE_PX : 0;
          const pull = influence * weights[i] * LP.MAX_OFFSET_PX;
          const norm = dist > 0 ? 1 / dist : 0;
          targetX = scaled(dx * norm * pull);
          targetY = scaled(dy * norm * pull);
        }
        currentX[i] += (targetX - currentX[i]) * LP.EASE;
        currentY[i] += (targetY - currentY[i]) * LP.EASE;
        // Settled means converged on the target — zero or not. A cursor
        // resting inside the nav pins letters at a non-zero offset, and the
        // loop must suspend there too instead of easing forever.
        if (
          Math.abs(targetX - currentX[i]) < LP.SETTLE_EPSILON_PX &&
          Math.abs(targetY - currentY[i]) < LP.SETTLE_EPSILON_PX
        ) {
          currentX[i] = targetX;
          currentY[i] = targetY;
        } else {
          busy = true;
        }
        letters[i].style.translate =
          `${currentX[i].toFixed(2)}px ${currentY[i].toFixed(2)}px`;
      }

      // Achievement tracking: count frames where any letter is visibly drifting
      if (!achievementFired) {
        let anyMoving = false;
        for (let i = 0; i < letters.length; i++) {
          if (
            Math.hypot(currentX[i], currentY[i]) >=
            LP.ACHIEVEMENT_MOTION_THRESHOLD_PX
          ) {
            anyMoving = true;
            break;
          }
        }
        if (anyMoving) {
          activeFrames++;
          if (activeFrames >= LP.ACHIEVEMENT_ACTIVE_FRAMES) {
            achievementFired = true;
            window.dispatchEvent(
              new CustomEvent("achievement", {
                detail: { type: "logo-parallax" },
              }),
            );
          }
        }
      }
    }

    if (busy) schedule();
  }

  document.addEventListener(
    "mousemove",
    (e) => {
      cursorX = e.clientX;
      cursorY = e.clientY;
      cursorKnown = true;
      schedule();
    },
    { passive: true },
  );

  window.addEventListener(
    "resize",
    () => {
      metricsStale = true;
      schedule();
    },
    { passive: true },
  );

  schedule();
}

// Split a text element containing "Cloud<span>breeze</span>" into per-letter
// spans, preserving the original accent-colored span boundary.  Returns a
// flat array of the letter elements (so the caller can translate them).
function splitIntoLetters(root) {
  const letters = [];
  const label = root.textContent.trim() || "Cloudbreeze";
  const children = Array.from(root.childNodes);
  root.innerHTML = "";
  root.setAttribute("aria-label", label);

  for (const child of children) {
    if (child.nodeType === Node.TEXT_NODE) {
      appendLetters(root, child.textContent, letters);
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const wrapper = document.createElement("span");
      wrapper.className = child.className;
      appendLetters(wrapper, child.textContent, letters);
      root.appendChild(wrapper);
    }
  }

  return letters;
}

function appendLetters(parent, text, sink) {
  for (const ch of text) {
    const span = document.createElement("span");
    span.className = "logo-letter";
    span.setAttribute("aria-hidden", "true");
    span.textContent = ch;
    parent.appendChild(span);
    sink.push(span);
  }
}
