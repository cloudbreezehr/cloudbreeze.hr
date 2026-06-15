// ── Spell-to-Toggle Trigger ──
// A pointer-friendly, registry-driven way to toggle any theme: enter the
// letters of its name in order — by tapping them on the page (touch) or
// typing them (keyboard). This gives touch users a path to themes whose
// primary trigger needs a keyboard, and to those themes' achievements,
// without a physical keyboard or third-party app.
//
// Cross-cutting, not a per-theme factory trigger: one listener pair reads
// the theme catalog from the registry and toggles whichever name completes,
// so adding a theme needs no change here. Tapped letters are read from the
// existing page text via caretPositionFromPoint — no per-letter markup.

import { getThemes, toggleTheme } from "./registry.js";
import { prefersReducedMotion } from "../motion.js";

const INPUT_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);
// Tapping a letter inside a link or control should do that control's job,
// not feed the speller — only plain text counts as spell input.
const INTERACTIVE_SELECTOR =
  "a, button, input, textarea, select, label, [role='button'], [contenteditable]";

// Max time between consecutive matching letters before progress resets.
// Generous enough to hunt for the next letter elsewhere on the page, tight
// enough that ordinary reading-taps don't accumulate into a match.
export const SPELL_GAP_MS = 15000;
// Names shorter than this aren't spell targets — guards a future one- or
// two-letter name from completing on a stray tap or two.
const MIN_SPELL_LEN = 3;

// ── Letter-pop feedback ──
const POP_DURATION_MS = 600;
const POP_BROKE_MS = 500;
const POP_RISE_PX = 26;
const POP_SHAKE_PX = 4;
const POP_END_SCALE = 0.7;
const POP_START_OPACITY = 0.9;
// Pop size when the tapped glyph's own size can't be read (keyboard input has
// no glyph; layout-less environments report no font size).
const POP_FALLBACK_FONT = "1.1rem";

function normalizeName(s) {
  return s.toUpperCase().replace(/[^A-Z]/g, "");
}

// Pure matcher: feed one uppercase letter at a time. Returns whether the
// letter advanced any name's progress, the id of a name that just completed
// (if any), and whether it broke an in-progress streak (a dead letter tapped
// while mid-spell — drives the miss feedback). Forgiving: a non-matching
// letter is ignored rather than resetting progress (fat-finger tolerance);
// only an idle gap longer than gapMs clears progress.
export function createSpellMatcher(names, gapMs = SPELL_GAP_MS) {
  const targets = names
    .map((n) => ({ id: n.id, letters: normalizeName(n.name) }))
    .filter((n) => n.letters.length >= MIN_SPELL_LEN);
  const prog = new Map(targets.map((t) => [t.id, 0]));
  let lastTime = -Infinity;

  function reset() {
    for (const t of targets) prog.set(t.id, 0);
  }

  function feed(letter, now) {
    if (now - lastTime > gapMs) reset();
    lastTime = now;
    const hadProgress = targets.some((t) => prog.get(t.id) > 0);
    let advanced = false;
    let matchedId = null;
    for (const t of targets) {
      const i = prog.get(t.id);
      if (t.letters[i] !== letter) continue;
      advanced = true;
      const next = i + 1;
      if (next === t.letters.length) {
        prog.set(t.id, 0); // ready to re-spell (toggles back off)
        if (!matchedId) matchedId = t.id;
      } else {
        prog.set(t.id, next);
      }
    }
    return { advanced, matchedId, brokeStreak: !advanced && hadProgress };
  }

  return { feed, reset };
}

// Bounding rect of a single character in a text node, or null when layout
// is unavailable (no dimensions reported).
function charRect(node, i) {
  try {
    const range = document.createRange();
    range.setStart(node, i);
    range.setEnd(node, i + 1);
    const r = range.getBoundingClientRect();
    return r && (r.width || r.height) ? r : null;
  } catch {
    return null;
  }
}

// Resolve the glyph under a viewport point: the actual character (original
// case), its on-screen rect, and its rendered font size. Returns null when
// the point isn't over plain (non-interactive) text. Choosing the character
// by its rect — not the bare caret offset — makes the hit target the glyph
// itself: the caret offset lands between characters, so a tap on the right
// half of a letter would otherwise read its neighbour.
function glyphAtPoint(x, y) {
  let node = null;
  let offset = 0;
  if (document.caretPositionFromPoint) {
    const pos = document.caretPositionFromPoint(x, y);
    if (pos) {
      node = pos.offsetNode;
      offset = pos.offset;
    }
  } else if (document.caretRangeFromPoint) {
    const range = document.caretRangeFromPoint(x, y);
    if (range) {
      node = range.startContainer;
      offset = range.startOffset;
    }
  }
  if (!node || node.nodeType !== Node.TEXT_NODE) return null;
  if (node.parentElement?.closest(INTERACTIVE_SELECTOR)) return null;

  const text = node.textContent || "";
  const candidates = [];
  if (offset < text.length) candidates.push(offset);
  if (offset > 0) candidates.push(offset - 1);
  if (candidates.length === 0) return null;

  // Prefer the candidate whose glyph rect contains the point; else the
  // nearest by horizontal distance. With no rects (layout-less), the first
  // candidate (the caret offset) stands in.
  let pick = null;
  for (const i of candidates) {
    const rect = charRect(node, i);
    const within = rect && x >= rect.left && x <= rect.right;
    const dist = rect
      ? x < rect.left
        ? rect.left - x
        : x - rect.right
      : Infinity;
    if (within) {
      pick = { i, rect };
      break;
    }
    if (!pick || dist < pick.dist) pick = { i, rect, dist };
  }

  return {
    raw: text.charAt(pick.i),
    rect: pick.rect,
    fontSize: node.parentElement
      ? getComputedStyle(node.parentElement).fontSize
      : "",
  };
}

// status: "advance" (green, rises) or "broke" (red, shakes).
function popGlyph(glyph, fallbackX, fallbackY, status) {
  if (prefersReducedMotion()) return;
  const el = document.createElement("span");
  el.className = `spell-pop spell-pop--${status}`;
  el.textContent = glyph.raw;
  el.setAttribute("aria-hidden", "true");
  const rect = glyph.rect;
  el.style.left = `${rect ? rect.left + rect.width / 2 : fallbackX}px`;
  el.style.top = `${rect ? rect.top + rect.height / 2 : fallbackY}px`;
  el.style.fontSize = glyph.fontSize || POP_FALLBACK_FONT;
  document.body.appendChild(el);

  const frames =
    status === "broke"
      ? [
          { opacity: POP_START_OPACITY, transform: "translate(-50%, -50%)" },
          {
            transform: `translate(calc(-50% - ${POP_SHAKE_PX}px), -50%)`,
            offset: 0.25,
          },
          {
            transform: `translate(calc(-50% + ${POP_SHAKE_PX}px), -50%)`,
            offset: 0.75,
          },
          { opacity: 0, transform: "translate(-50%, -50%)" },
        ]
      : [
          {
            opacity: POP_START_OPACITY,
            transform: "translate(-50%, -50%) scale(1)",
          },
          {
            opacity: 0,
            transform: `translate(-50%, calc(-50% - ${POP_RISE_PX}px)) scale(${POP_END_SCALE})`,
          },
        ];
  el.animate(frames, {
    duration: status === "broke" ? POP_BROKE_MS : POP_DURATION_MS,
    easing: "ease-out",
    fill: "forwards",
  }).onfinish = () => el.remove();
}

export function initSpellTrigger() {
  const names = getThemes().map((t) => ({ id: t.id, name: t.label }));
  const matcher = createSpellMatcher(names);

  function apply(letter) {
    const result = matcher.feed(letter, Date.now());
    if (result.matchedId) {
      // Non-silent on purpose: spelling is a touch user's only route to a
      // theme's exit achievement, so deactivating by re-spelling must award
      // it. lights-out.js and the HUD pass { silent: true } to suppress that
      // reward — do NOT copy them here, or touch users lose those unlocks.
      toggleTheme(result.matchedId);
      window.dispatchEvent(
        new CustomEvent("achievement", {
          detail: { type: "theme-spelled", theme: result.matchedId },
        }),
      );
    }
    return result;
  }

  function onKeydown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = document.activeElement?.tagName;
    if (tag && INPUT_TAGS.has(tag)) return;
    if (document.activeElement?.isContentEditable) return;
    if (e.key.length !== 1) return;
    const letter = e.key.toUpperCase();
    if (letter < "A" || letter > "Z") return;
    apply(letter);
  }

  function onClick(e) {
    // Skip keyboard-synthesized clicks (Enter/Space on a focused control):
    // they carry detail 0 and no meaningful coordinates.
    if (e.detail === 0) return;
    const glyph = glyphAtPoint(e.clientX, e.clientY);
    if (!glyph) return;
    const letter = glyph.raw.toUpperCase();
    if (letter < "A" || letter > "Z") return;
    const { advanced, brokeStreak } = apply(letter);
    // Pop the tapped glyph green when it advanced a name, red + shake when a
    // mid-spell tap fell on a dead letter. Letters that begin nothing (no
    // streak to break) stay silent so casual taps don't litter the page.
    if (advanced) popGlyph(glyph, e.clientX, e.clientY, "advance");
    else if (brokeStreak) popGlyph(glyph, e.clientX, e.clientY, "broke");
  }

  document.addEventListener("keydown", onKeydown);
  document.addEventListener("click", onClick);

  return {
    stop() {
      document.removeEventListener("keydown", onKeydown);
      document.removeEventListener("click", onClick);
    },
  };
}
