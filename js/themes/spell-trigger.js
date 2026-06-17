// ── Spell-to-Toggle Trigger ──
// A pointer-friendly, registry-driven way to spell secrets: enter a word's
// letters in order — by tapping them on the page (touch) or typing them
// (keyboard). Spelling a theme's name toggles it (a touch user's route to
// keyboard-only themes and their achievements); spelling an incantation word
// fires its effect. One matcher spans both, so adding a theme or a word
// needs no change to the input handling.
//
// Cross-cutting, not a per-theme factory trigger. Tapped letters are read
// from the existing page text via caretPositionFromPoint — no per-letter
// markup.

import { getThemes, toggleTheme } from "./registry.js";
import { INCANTATIONS } from "../effects/incantations.js";
import {
  openCheatsheet,
  markCheatsheetDiscovered,
} from "../effects/cheatsheet.js";
import { prefersReducedMotion } from "../motion.js";

// Spelled like an incantation, but it reveals the reference panel rather than
// casting an effect — kept out of INCANTATIONS so it isn't a collectible spell.
const CHEATSHEET_WORD = "CHEATSHEET";

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
// The pop overlays the tapped glyph in the same font, so it reads as a coloured
// ghost of the letter rather than a separate mark.
const POP_DURATION_MS = 600;
const POP_BROKE_MS = 500;
const POP_SHAKE_PX = 4;
const POP_ADVANCE_SCALE = 1.15;
const POP_START_OPACITY = 0.85;

// Where an incantation effect originates when there's no pointer at all
// (keyboard cast, mouse never moved): horizontally centred, upper third.
const CAST_FALLBACK_X_FRACTION = 0.5;
const CAST_FALLBACK_Y_FRACTION = 1 / 3;

// Cursor spell-charge buildup: progress below this stays invisible so a stray
// advancing letter doesn't flicker the cursor; the charge eases back to rest
// this long after the last letter.
export const CHARGE_MIN_PROGRESS = 0.35;
export const CHARGE_SETTLE_MS = 1500;

function normalizeName(s) {
  return s.toUpperCase().replace(/[^A-Z]/g, "");
}

// Pure matcher: feed one uppercase letter at a time. Returns whether the
// letter advanced any name's progress, the id of a name that just completed
// (if any), the charge it completed with, and whether it broke an in-progress
// streak (a dead letter tapped while mid-spell — drives the miss feedback).
// Forgiving: a non-matching letter is ignored rather than resetting progress
// (fat-finger tolerance); only an idle gap longer than gapMs clears progress.
// A target may declare a `chargeChar`: extra repeats of it right after its run
// accumulate `matchedCharge` instead of being ignored (e.g. the surplus O's in
// BOOOOM).
export function createSpellMatcher(names, gapMs = SPELL_GAP_MS) {
  const targets = names
    .map((n) => ({
      id: n.id,
      letters: normalizeName(n.name),
      chargeChar: n.chargeChar ? n.chargeChar.toUpperCase() : null,
      // Optional cap on accumulated charge (number or a live getter). Past it,
      // surplus charge letters do nothing — no advance, no charge, no miss.
      chargeMax: n.chargeMax ?? null,
    }))
    .filter((n) => n.letters.length >= MIN_SPELL_LEN);
  const prog = new Map(targets.map((t) => [t.id, 0]));
  const charge = new Map(targets.map((t) => [t.id, 0]));
  let lastTime = -Infinity;

  function reset() {
    for (const t of targets) {
      prog.set(t.id, 0);
      charge.set(t.id, 0);
    }
  }

  function feed(letter, now) {
    if (now - lastTime > gapMs) reset();
    lastTime = now;
    const hadProgress = targets.some((t) => prog.get(t.id) > 0);
    let advanced = false;
    let charged = false; // a charge counter ticked up this letter
    let chargeMatched = false; // a charge letter landed, even if already maxed
    let matchedId = null;
    let matchedCharge = 0;
    for (const t of targets) {
      const i = prog.get(t.id);
      if (t.letters[i] === letter) {
        advanced = true;
        const next = i + 1;
        if (next === t.letters.length) {
          if (!matchedId) {
            matchedId = t.id;
            matchedCharge = charge.get(t.id);
          }
          prog.set(t.id, 0); // ready to re-spell (toggles back off)
          charge.set(t.id, 0);
        } else {
          prog.set(t.id, next);
        }
      } else if (
        t.chargeChar &&
        letter === t.chargeChar &&
        i > 0 &&
        t.letters[i - 1] === t.chargeChar
      ) {
        // An extra repeat of the just-finished charge run — accumulate rather
        // than ignore, so BOOOOM carries more charge than BOOM. Past chargeMax
        // it's recognised but inert (no advance), so the buildup stops cleanly.
        chargeMatched = true;
        const max =
          typeof t.chargeMax === "function" ? t.chargeMax() : t.chargeMax;
        if (max == null || charge.get(t.id) < max) {
          advanced = true;
          charged = true;
          charge.set(t.id, charge.get(t.id) + 1);
        }
      }
    }
    // Live buildup signals for the cursor: how far into the nearest word we
    // are (0..1, never a sustained 1 — completion resets it) and how much
    // surplus charge is stacked while parked before the final letter.
    let progress = 0;
    let liveCharge = 0;
    for (const t of targets) {
      const frac = prog.get(t.id) / t.letters.length;
      if (frac > progress) progress = frac;
      if (charge.get(t.id) > liveCharge) liveCharge = charge.get(t.id);
    }
    return {
      advanced,
      charged,
      matchedId,
      matchedCharge,
      // A maxed-out charge letter is recognised, not a miss — so it never goes
      // red even though it didn't advance.
      brokeStreak: !advanced && !chargeMatched && hadProgress,
      progress,
      liveCharge,
    };
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

  // Snapshot the tapped element's font so the pop can overlay the glyph exactly.
  const cs = node.parentElement ? getComputedStyle(node.parentElement) : null;
  const font = cs
    ? {
        family: cs.fontFamily,
        size: cs.fontSize,
        weight: cs.fontWeight,
        style: cs.fontStyle,
        stretch: cs.fontStretch,
        letterSpacing: cs.letterSpacing,
        lineHeight: cs.lineHeight,
        textTransform: cs.textTransform,
      }
    : null;

  // The point must land inside a candidate glyph's box on BOTH axes.
  // caretPositionFromPoint snaps to the nearest caret even for a click in empty
  // space, so without this bound a tap anywhere would resolve to the closest
  // letter — the hit target has to be the glyph itself, not the viewport. The
  // box is the line height for that character (generous vertically, exact
  // horizontally), which also disambiguates left/right halves between glyphs.
  let sawRect = false;
  for (const i of candidates) {
    const rect = charRect(node, i);
    if (!rect) continue;
    sawRect = true;
    if (
      x >= rect.left &&
      x <= rect.right &&
      y >= rect.top &&
      y <= rect.bottom
    ) {
      return { raw: text.charAt(i), rect, font };
    }
  }
  // Rects existed but the point was outside every candidate → not on a letter.
  if (sawRect) return null;
  // No layout available (e.g. the test environment) — trust the caret offset.
  const fallback = offset < text.length ? offset : offset - 1;
  return { raw: text.charAt(fallback), rect: null, font };
}

// status: "advance" (green, blooms) or "broke" (red, shakes). The pop is a
// coloured copy of the tapped glyph laid exactly over it, fading in place.
function popGlyph(glyph, fallbackX, fallbackY, status) {
  if (prefersReducedMotion()) return;
  const el = document.createElement("span");
  el.className = `spell-pop spell-pop--${status}`;
  el.textContent = glyph.raw;
  el.setAttribute("aria-hidden", "true");
  el.style.transformOrigin = "center";

  const f = glyph.font;
  if (f) {
    el.style.fontFamily = f.family;
    el.style.fontSize = f.size;
    el.style.fontWeight = f.weight;
    el.style.fontStyle = f.style;
    el.style.fontStretch = f.stretch;
    el.style.letterSpacing = f.letterSpacing;
    el.style.lineHeight = f.lineHeight;
    el.style.textTransform = f.textTransform;
  }

  // With the rect, sit exactly over the glyph (same font + line height makes it
  // a ghost of the letter). Without one (keyboard / layout-less), centre on the
  // fallback point — base carries the centring so the keyframes can add to it.
  const rect = glyph.rect;
  const base = rect ? "" : "translate(-50%, -50%) ";
  el.style.left = `${rect ? rect.left : fallbackX}px`;
  el.style.top = `${rect ? rect.top : fallbackY}px`;
  document.body.appendChild(el);

  const frames =
    status === "broke"
      ? [
          { opacity: POP_START_OPACITY, transform: `${base}translateX(0)` },
          { transform: `${base}translateX(-${POP_SHAKE_PX}px)`, offset: 0.25 },
          { transform: `${base}translateX(${POP_SHAKE_PX}px)`, offset: 0.75 },
          { opacity: 0, transform: `${base}translateX(0)` },
        ]
      : [
          { opacity: POP_START_OPACITY, transform: `${base}scale(1)` },
          { opacity: 0, transform: `${base}scale(${POP_ADVANCE_SCALE})` },
        ];
  el.animate(frames, {
    duration: status === "broke" ? POP_BROKE_MS : POP_DURATION_MS,
    easing: "ease-out",
    fill: "forwards",
  }).onfinish = () => el.remove();
}

// Build the spellable targets and what each does on completion. Themes
// toggle; incantation words fire their effect. One matcher over both means
// the input plumbing below is shared — adding a theme or a word needs no
// change here.
function buildActions() {
  const targets = [];
  const actions = new Map();

  for (const theme of getThemes()) {
    targets.push({ id: theme.id, name: theme.label });
    actions.set(theme.id, () => {
      // Non-silent on purpose: spelling is a touch user's only route to a
      // theme's exit achievement, so deactivating by re-spelling must award
      // it. lights-out.js and the HUD pass { silent: true } to suppress that
      // reward — do NOT copy them here, or touch users lose those unlocks.
      toggleTheme(theme.id);
      window.dispatchEvent(
        new CustomEvent("achievement", {
          detail: { type: "theme-spelled", theme: theme.id },
        }),
      );
    });
  }

  for (const inc of INCANTATIONS) {
    const id = `incantation:${inc.word}`;
    targets.push({
      id,
      name: inc.word,
      chargeChar: inc.chargeChar,
      chargeMax: inc.chargeMax,
    });
    actions.set(id, (origin, charge) => {
      inc.cast(origin, charge);
      const max =
        typeof inc.chargeMax === "function" ? inc.chargeMax() : inc.chargeMax;
      const maxed = max > 0 && charge >= max;
      window.dispatchEvent(
        new CustomEvent("achievement", {
          detail: { type: "incantation", word: inc.word, maxed },
        }),
      );
    });
  }

  const cheatId = `incantation:${CHEATSHEET_WORD}`;
  targets.push({ id: cheatId, name: CHEATSHEET_WORD });
  actions.set(cheatId, () => {
    // First spell persists the discovery (surfacing the corner button); every
    // spell reveals the panel.
    markCheatsheetDiscovered();
    openCheatsheet();
  });

  return { targets, actions };
}

export function initSpellTrigger() {
  const { targets, actions } = buildActions();
  const matcher = createSpellMatcher(targets);

  // Track the cursor so keyboard-typed casts originate where the pointer is,
  // not at a fixed spot. Updated on move and on tap.
  let lastPointer = null;

  // Resolve where an incantation's effect originates: an explicit cast point
  // (the tapped letter), else the last cursor position, else viewport centre.
  function castOrigin(point) {
    return (
      point ||
      lastPointer || {
        x: window.innerWidth * CAST_FALLBACK_X_FRACTION,
        y: window.innerHeight * CAST_FALLBACK_Y_FRACTION,
      }
    );
  }

  // Drive the cursor's spell-charge halo from live matcher state. progress
  // ramps the swell/glow; liveCharge (surplus charge letters, parked before
  // the final letter) flips the overcharge pulse. Eases back to rest after a
  // pause. CSS renders it from the variables — see #cursor-ring::after.
  let settleTimer = null;
  const root = document.documentElement;
  function applyCharge(progress, liveCharge) {
    clearTimeout(settleTimer);
    const shown = progress >= CHARGE_MIN_PROGRESS ? progress : 0;
    root.style.setProperty("--spell-charge", shown.toFixed(3));
    root.style.setProperty("--spell-overcharge", String(liveCharge));
    document.body.classList.toggle("spell-overcharging", liveCharge > 0);
    // Drop the per-letter twitch class once the overcharge ends (completion or
    // a non-charge letter) so a finished kick doesn't linger on the body.
    if (liveCharge === 0) document.body.classList.remove("spell-kick");
    if (shown > 0 || liveCharge > 0) {
      settleTimer = setTimeout(resetCharge, CHARGE_SETTLE_MS);
    }
  }
  // A discrete twitch on each surplus charge letter, restarted per letter by
  // re-adding the class after a reflow. Stops naturally at the charge cap (the
  // matcher no longer reports `charged`).
  function kick() {
    document.body.classList.remove("spell-kick");
    void document.body.offsetWidth;
    document.body.classList.add("spell-kick");
  }
  function resetCharge() {
    clearTimeout(settleTimer);
    root.style.setProperty("--spell-charge", "0");
    root.style.setProperty("--spell-overcharge", "0");
    document.body.classList.remove("spell-overcharging");
    document.body.classList.remove("spell-kick");
  }

  // point is the tapped-letter location, or null for keyboard input.
  function runMatch(letter, point) {
    const result = matcher.feed(letter, Date.now());
    applyCharge(result.progress, result.liveCharge);
    if (result.charged) kick();
    if (result.matchedId) {
      actions.get(result.matchedId)?.(castOrigin(point), result.matchedCharge);
    }
    return result;
  }

  function onPointerMove(e) {
    lastPointer = { x: e.clientX, y: e.clientY };
  }

  function onKeydown(e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = document.activeElement?.tagName;
    if (tag && INPUT_TAGS.has(tag)) return;
    if (document.activeElement?.isContentEditable) return;
    if (e.key.length !== 1) return;
    const letter = e.key.toUpperCase();
    if (letter < "A" || letter > "Z") return;
    runMatch(letter, null);
  }

  function onClick(e) {
    // Skip keyboard-synthesized clicks (Enter/Space on a focused control):
    // they carry detail 0 and no meaningful coordinates.
    if (e.detail === 0) return;
    const glyph = glyphAtPoint(e.clientX, e.clientY);
    if (!glyph) return;
    const letter = glyph.raw.toUpperCase();
    if (letter < "A" || letter > "Z") return;
    lastPointer = { x: e.clientX, y: e.clientY };
    const { advanced, brokeStreak } = runMatch(letter, {
      x: e.clientX,
      y: e.clientY,
    });
    // Pop the tapped glyph green when it advanced a name, red + shake when a
    // mid-spell tap fell on a dead letter. Letters that begin nothing (no
    // streak to break) stay silent so casual taps don't litter the page.
    if (advanced) popGlyph(glyph, e.clientX, e.clientY, "advance");
    else if (brokeStreak) popGlyph(glyph, e.clientX, e.clientY, "broke");
  }

  document.addEventListener("pointermove", onPointerMove, { passive: true });
  document.addEventListener("keydown", onKeydown);
  document.addEventListener("click", onClick);

  return {
    stop() {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("keydown", onKeydown);
      document.removeEventListener("click", onClick);
      resetCharge();
    },
  };
}
