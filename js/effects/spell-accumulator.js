// ── Spell Accumulator HUD ──
// A subtle row of the letters being spelled, shown low on the viewport while a
// word is in progress. Normal users see only the letters they've entered;
// when the dev console is active it renders the full candidate word(s) with
// un-pressed letters dimmed in, karaoke-style, and lists every candidate rather
// than just the leading one. Driven by `spell-progress` events (detail:
// `{ candidates }`); one persistent element whose rows are rebuilt per letter.

import { defineConstants } from "../dev/registry.js";
import { isDevActive } from "../dev/active.js";

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
      root.classList.toggle("spell-acc--dev", isDevActive());
      root.replaceChildren(
        buildRow(
          {
            word: detail.completed.word,
            matched: detail.completed.word.length,
          },
          true,
        ),
      );
      root.classList.add("spell-acc--visible", "spell-acc--complete");
      clearTimeout(lingerTimer);
      lingerTimer = setTimeout(conceal, SACC.COMPLETE_HOLD_MS);
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
