// ── Spell Accumulator HUD ──
// A subtle row of the letters being spelled, shown low on the viewport while a
// word is in progress. Normal users see only the letters they've entered;
// when the dev console is active it renders the full candidate word(s) with
// un-pressed letters dimmed in, karaoke-style, and lists every candidate rather
// than just the leading one. Driven by `spell-progress` events (detail:
// `{ candidates }`); one persistent element whose rows are rebuilt per letter.

import { defineConstants } from "../dev/registry.js";
import { isDevActive } from "../dev/active.js";
import { prefersReducedMotion } from "../motion.js";

export const SACC = defineConstants("effects.spellAccumulator", {
  MIN_LETTERS: {
    value: 2,
    min: 1,
    max: 6,
    step: 1,
    description: "Entered letters before the accumulator appears (non-dev)",
  },
  LINGER_MS: {
    value: 1600,
    min: 200,
    max: 8000,
    step: 100,
    description: "How long the accumulator lingers after the last letter (ms)",
  },
  COMPLETE_HOLD_MS: {
    value: 800,
    min: 100,
    max: 4000,
    step: 100,
    description: "How long a finished word stays on screen before fading (ms)",
  },
  COLLAPSE_MS: {
    value: 420,
    min: 100,
    max: 2000,
    step: 20,
    description:
      "How long surplus charge letters take to merge into the word (ms)",
  },
});

export function initSpellAccumulatorHud() {
  const root = document.createElement("div");
  root.className = "spell-acc";
  root.setAttribute("aria-hidden", "true");
  document.body.appendChild(root);

  let lingerTimer = null;
  let lastCandidates = [];

  // One row per candidate word: a span per letter, un-pressed ones tagged so
  // CSS can collapse them (normal) or dim them (dev). Surplus charge letters
  // are pressed glyphs, inserted right after the last chargeChar already
  // entered — that's where they were typed, before any letters still to come,
  // so BOOOOM reads B O O O O M, not B O O M O O.
  function buildRow(cand, isLead) {
    const row = document.createElement("div");
    row.className = "spell-acc__word";
    if (isLead) row.classList.add("spell-acc__word--lead");

    let chargeAt = -1;
    if (cand.charge > 0 && cand.chargeChar) {
      for (let i = 0; i < cand.matched; i++) {
        if (cand.word[i] === cand.chargeChar) chargeAt = i;
      }
    }

    for (let i = 0; i < cand.word.length; i++) {
      const span = document.createElement("span");
      span.className = "spell-acc__letter";
      if (i >= cand.matched) span.classList.add("spell-acc__letter--empty");
      span.textContent = cand.word[i];
      row.appendChild(span);
      if (i === chargeAt) {
        for (let c = 0; c < cand.charge; c++) {
          const cs = document.createElement("span");
          cs.className = "spell-acc__letter spell-acc__letter--charge";
          cs.textContent = cand.chargeChar;
          row.appendChild(cs);
        }
      }
    }
    return row;
  }

  function render(detail) {
    const candidates = detail.candidates || [];

    // A finished word takes over the display: show it whole for a beat, then
    // fade — so the speller sees the full word they landed rather than it
    // vanishing on the last keystroke, and the fragments other words were left
    // mid-match never flash in its place.
    if (detail.completed) {
      lastCandidates = [];
      root.classList.remove("spell-acc--complete");
      root.classList.toggle("spell-acc--dev", isDevActive());
      const { word, charge = 0, chargeChar = null } = detail.completed;
      const row = buildRow(
        { word, matched: word.length, charge, chargeChar },
        true,
      );
      root.replaceChildren(row);
      root.classList.add("spell-acc--visible");
      clearTimeout(lingerTimer);

      const surplus = [...row.querySelectorAll(".spell-acc__letter--charge")];
      if (surplus.length && !prefersReducedMotion() && canAnimate(surplus[0])) {
        mergeCharge(row, surplus, popComplete);
      } else {
        // No charge, reduced motion, or no WAAPI: land straight on the word.
        surplus.forEach((s) => s.remove());
        popComplete();
      }
      return;
    }

    lastCandidates = candidates;
    root.classList.remove("spell-acc--complete");
    const dev = isDevActive();
    root.classList.toggle("spell-acc--dev", dev);

    const lead = candidates[0];
    const visible = dev
      ? candidates.length > 0
      : !!lead && lead.matched >= SACC.MIN_LETTERS;
    if (!visible) {
      conceal();
      return;
    }

    const rows = dev ? candidates : [lead];
    root.replaceChildren(...rows.map((c, i) => buildRow(c, i === 0)));
    root.classList.add("spell-acc--visible");
    clearTimeout(lingerTimer);
    lingerTimer = setTimeout(conceal, SACC.LINGER_MS);
  }

  function canAnimate(el) {
    return typeof el.animate === "function";
  }

  // The surplus charge letters shrink away while the word's two halves slide
  // together to meet in the middle. Sliding both sides (not just the tail)
  // keeps the word centred throughout the collapse, so it doesn't lurch back
  // to centre once the surplus — and the width it held — is gone.
  function mergeCharge(row, surplus, onDone) {
    const all = [...row.children];
    const leading = all.slice(0, all.indexOf(surplus[0]));
    const trailing = all.slice(
      all.lastIndexOf(surplus[surplus.length - 1]) + 1,
    );
    // Width the row loses when the surplus goes; each half travels half of it.
    const lost = trailing.length
      ? trailing[0].getBoundingClientRect().left -
        surplus[0].getBoundingClientRect().left
      : 0;
    const half = lost / 2;
    const opts = {
      duration: SACC.COLLAPSE_MS,
      easing: "ease-in",
      fill: "forwards",
    };
    const sideAnims = [
      ...leading.map((el) =>
        el.animate(
          [
            { transform: "translateX(0)" },
            { transform: `translateX(${half}px)` },
          ],
          opts,
        ),
      ),
      ...trailing.map((el) =>
        el.animate(
          [
            { transform: "translateX(0)" },
            { transform: `translateX(-${half}px)` },
          ],
          opts,
        ),
      ),
    ];
    let last = null;
    for (const s of surplus) {
      last = s.animate(
        [
          { opacity: 1, transform: "scale(1)" },
          { opacity: 0, transform: "scale(0)" },
        ],
        opts,
      );
    }
    last.onfinish = () => {
      // Remove the collapsed surplus, then cancel the side slides so the halves
      // rest at their natural (now centred) positions. Leaving the fill would
      // stack the slide on top of the layout re-centre and shift them too far.
      surplus.forEach((s) => s.remove());
      for (const a of sideAnims) a.cancel();
      onDone();
    };
  }

  // Land on the finished word: brighten-pop it and start the fade timer.
  function popComplete() {
    root.classList.add("spell-acc--complete");
    clearTimeout(lingerTimer);
    lingerTimer = setTimeout(conceal, SACC.COMPLETE_HOLD_MS);
  }

  function conceal() {
    clearTimeout(lingerTimer);
    root.classList.remove("spell-acc--visible");
  }

  function onProgress(e) {
    render(e.detail || {});
  }
  // Re-render live when the dev console toggles so the reveal switches over
  // without waiting for the next letter.
  function onAchievement(e) {
    const t = e.detail?.type;
    if (t === "dev-console-open" || t === "dev-console-close") {
      render({ candidates: lastCandidates });
    }
  }
  window.addEventListener("spell-progress", onProgress);
  window.addEventListener("achievement", onAchievement);

  return {
    stop() {
      window.removeEventListener("spell-progress", onProgress);
      window.removeEventListener("achievement", onAchievement);
      clearTimeout(lingerTimer);
      root.remove();
    },
  };
}
