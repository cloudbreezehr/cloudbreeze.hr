// ── Cheatsheet ──
// A hidden reference listing the site's spellable secrets — themes you can
// toggle and incantations you can cast. Spelling CHEATSHEET reveals it; the
// first reveal is remembered, after which a small corner button reopens it on
// later visits. The overlay is a focus-trapped modal dismissed by Esc, the
// close button, or a backdrop click.

import { trapFocus } from "../achievements/focus-trap.js";
import { getThemes } from "../themes/registry.js";
import { INCANTATIONS } from "./incantations.js";
import { getPref, setPref } from "../achievements/storage.js";
import { playSfx } from "../audio/sfx.js";

// Fallback removal delay — generously past the overlay's CSS fade so the node
// is still removed if transitionend never fires (e.g. detached early).
const FADE_FALLBACK_MS = 400;
// Persisted once the panel has ever been revealed; gates the corner button.
const DISCOVERED_PREF = "cheatsheetDiscovered";

let overlayEl = null;
let toggleBtn = null;
let _escHandler = null;
let _releaseFocusTrap = null;

const CLOSE_ICON = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 4l8 8M4 12l8-8"/></svg>`;
const BOOK_ICON = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="2" width="10" height="12" rx="1.5"/><path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3"/></svg>`;

function buildSection(heading, rows) {
  const section = document.createElement("section");
  section.className = "cheatsheet-section";
  const h = document.createElement("h3");
  h.className = "cheatsheet-section-title";
  h.textContent = heading;
  section.appendChild(h);
  const dl = document.createElement("dl");
  dl.className = "cheatsheet-list";
  for (const [term, desc, icon] of rows) {
    const dt = document.createElement("dt");
    if (icon) {
      const ic = document.createElement("span");
      ic.className = "cheatsheet-icon";
      ic.innerHTML = icon; // trusted static markup from our own icon sets
      dt.appendChild(ic);
    }
    dt.appendChild(document.createTextNode(term));
    const dd = document.createElement("dd");
    dd.textContent = desc;
    dl.appendChild(dt);
    dl.appendChild(dd);
  }
  section.appendChild(dl);
  return section;
}

function buildOverlay() {
  const overlay = document.createElement("div");
  overlay.className = "cheatsheet-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Cheat codes");

  const panel = document.createElement("div");
  panel.className = "cheatsheet-panel";

  // Focusable close control — gives the focus trap something to hold and a
  // pointer/keyboard dismiss target beyond Esc.
  const closeBtn = document.createElement("button");
  closeBtn.className = "cheatsheet-close";
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.innerHTML = CLOSE_ICON;
  closeBtn.addEventListener("click", () => closeCheatsheet());
  panel.appendChild(closeBtn);

  const title = document.createElement("h2");
  title.className = "cheatsheet-title";
  title.textContent = "Cheat codes";
  panel.appendChild(title);

  const intro = document.createElement("p");
  intro.className = "cheatsheet-intro";
  intro.textContent = "Spell these anywhere — tap the letters or type them.";
  panel.appendChild(intro);

  const body = document.createElement("div");
  body.className = "cheatsheet-body";
  body.appendChild(
    buildSection(
      "Themes",
      getThemes().map((t) => [t.label, "", t.icon]),
    ),
  );
  body.appendChild(
    buildSection(
      "Incantations",
      INCANTATIONS.map((inc) => [inc.word, inc.hint || "", inc.icon]),
    ),
  );
  panel.appendChild(body);

  const note = document.createElement("p");
  note.className = "cheatsheet-note";
  note.textContent =
    "Repeat a letter in some words (BOOOOM) to charge them. Esc or × to close.";
  panel.appendChild(note);

  overlay.appendChild(panel);
  // Backdrop click (outside the panel) closes.
  overlay.addEventListener("pointerdown", (e) => {
    if (e.target === overlay) closeCheatsheet();
  });
  return overlay;
}

function buildToggleButton() {
  const btn = document.createElement("button");
  btn.className = "cheatsheet-toggle";
  btn.setAttribute("aria-label", "Cheat codes");
  btn.setAttribute("title", "Cheat codes");
  btn.innerHTML = BOOK_ICON;
  btn.addEventListener("click", () => toggleCheatsheet());
  return btn;
}

function mountToggleButton() {
  if (toggleBtn) return;
  toggleBtn = buildToggleButton();
  document.body.appendChild(toggleBtn);
}

export function isCheatsheetDiscovered() {
  return getPref(DISCOVERED_PREF, false) === true;
}

// Record that the cheatsheet has been found and surface the corner button. The
// first discovery persists the flag and announces itself for achievements;
// later calls just ensure the button is present. Returns true on first find.
export function markCheatsheetDiscovered() {
  const firstTime = !isCheatsheetDiscovered();
  if (firstTime) {
    setPref(DISCOVERED_PREF, true);
    window.dispatchEvent(
      new CustomEvent("achievement", {
        detail: { type: "cheatsheet-discovered" },
      }),
    );
  }
  mountToggleButton();
  return firstTime;
}

export function openCheatsheet() {
  if (overlayEl) return;
  overlayEl = buildOverlay();
  document.body.appendChild(overlayEl);
  void overlayEl.offsetHeight;
  overlayEl.classList.add("visible");
  // A soft page-flip as the book of secrets opens (dry — it's a UI panel).
  playSfx("pageflip", { ui: true });
  // Contain focus inside the dialog — without this an aria-modal dialog still
  // lets Tab reach the page behind it. Starts focus on the close button.
  _releaseFocusTrap = trapFocus(overlayEl, {
    initialFocus: overlayEl.querySelector(".cheatsheet-close"),
  });
  // Esc closes — scoped to the overlay's lifetime so it never preventDefaults
  // Escape for other handlers when the panel isn't open.
  _escHandler = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeCheatsheet();
    }
  };
  document.addEventListener("keydown", _escHandler);
}

export function closeCheatsheet() {
  if (!overlayEl) return;
  const el = overlayEl;
  overlayEl = null;
  if (_releaseFocusTrap) {
    _releaseFocusTrap();
    _releaseFocusTrap = null;
  }
  if (_escHandler) {
    document.removeEventListener("keydown", _escHandler);
    _escHandler = null;
  }
  el.classList.remove("visible");
  el.addEventListener("transitionend", () => el.remove(), { once: true });
  // Belt-and-suspenders: remove even if transitionend doesn't fire.
  setTimeout(() => el.remove(), FADE_FALLBACK_MS);
}

export function toggleCheatsheet() {
  if (overlayEl) closeCheatsheet();
  else openCheatsheet();
}

export function isCheatsheetOpen() {
  return overlayEl != null;
}

export function initCheatsheet() {
  if (isCheatsheetDiscovered()) mountToggleButton();
}

// Test hook — drop the singletons + corner button between runs.
export function _resetForTests() {
  if (_releaseFocusTrap) {
    _releaseFocusTrap();
    _releaseFocusTrap = null;
  }
  if (_escHandler) {
    document.removeEventListener("keydown", _escHandler);
    _escHandler = null;
  }
  if (overlayEl && overlayEl.parentNode) overlayEl.remove();
  overlayEl = null;
  if (toggleBtn && toggleBtn.parentNode) toggleBtn.remove();
  toggleBtn = null;
}
