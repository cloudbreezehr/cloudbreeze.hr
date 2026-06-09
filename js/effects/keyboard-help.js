// ── Keyboard Shortcut Help Overlay ──
// Press "?" to toggle a modal listing the site's keyboard shortcuts.
// Deliberately lists only the documented controls — the easter-egg
// sequences (Konami, theme triggers) stay out so the overlay is a
// reference, not a spoiler.  Esc, the close button, or a backdrop click
// dismiss it.  Because it's an aria-modal dialog, focus is trapped
// inside (on the close button) while open so Tab can't wander into the
// page behind it.

import { onKey } from "../keyboard.js";
import { trapFocus } from "../achievements/focus-trap.js";

// Fallback removal delay — generously past the overlay's CSS fade so the
// node is still removed if transitionend never fires (e.g. detached early).
const FADE_FALLBACK_MS = 400;

// key label → what it does.  Modifier glyphs are spelled out rather than
// platform-detected; both Ctrl and Cmd map to the same handler.
const SHORTCUTS = [
  ["?", "Show this help"],
  ["L", "Open or close the Cloudlog"],
  ["[ / ]", "Switch Cloudlog tabs"],
  ["Esc", "Close panels and overlays"],
  ["Tab", "Move through interactive elements"],
  ["Ctrl/Cmd + Shift + .", "Toggle the dev console"],
  ["Ctrl/Cmd + Shift + F", "Toggle the FPS meter"],
];

let overlayEl = null;
let _escHandler = null;
let _releaseFocusTrap = null;
let _unbindToggle = null;

function buildOverlay() {
  const overlay = document.createElement("div");
  overlay.className = "keyboard-help-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Keyboard shortcuts");

  const panel = document.createElement("div");
  panel.className = "keyboard-help-panel";

  // Focusable close control — gives the focus trap something to hold
  // (an aria-modal dialog must contain focus) and a pointer/keyboard
  // dismiss target beyond Esc.
  const closeBtn = document.createElement("button");
  closeBtn.className = "keyboard-help-close";
  closeBtn.setAttribute("aria-label", "Close");
  closeBtn.innerHTML = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 4l8 8M4 12l8-8"/></svg>`;
  closeBtn.addEventListener("click", () => closeHelp());
  panel.appendChild(closeBtn);

  const title = document.createElement("h2");
  title.className = "keyboard-help-title";
  title.textContent = "Keyboard shortcuts";
  panel.appendChild(title);

  const list = document.createElement("dl");
  list.className = "keyboard-help-list";
  for (const [keys, desc] of SHORTCUTS) {
    const dt = document.createElement("dt");
    // Render each token as its own <kbd> so the keycaps read distinctly.
    for (const token of keys.split(" ")) {
      if (token === "+" || token === "/") {
        dt.appendChild(document.createTextNode(` ${token} `));
      } else {
        const kbd = document.createElement("kbd");
        kbd.textContent = token;
        dt.appendChild(kbd);
      }
    }
    const dd = document.createElement("dd");
    dd.textContent = desc;
    list.appendChild(dt);
    list.appendChild(dd);
  }
  panel.appendChild(list);

  const hint = document.createElement("p");
  hint.className = "keyboard-help-hint";
  hint.textContent = "Press Esc, ?, or the × to close.";
  panel.appendChild(hint);

  overlay.appendChild(panel);
  // Backdrop click (outside the panel) closes.
  overlay.addEventListener("pointerdown", (e) => {
    if (e.target === overlay) closeHelp();
  });
  return overlay;
}

export function openHelp() {
  if (overlayEl) return;
  overlayEl = buildOverlay();
  document.body.appendChild(overlayEl);
  void overlayEl.offsetHeight;
  overlayEl.classList.add("visible");
  // Contain focus inside the dialog — without this an aria-modal dialog
  // still lets Tab reach the page behind it.  Starts focus on the close
  // button.
  _releaseFocusTrap = trapFocus(overlayEl, {
    initialFocus: overlayEl.querySelector(".keyboard-help-close"),
  });
  // Esc closes — scoped to the overlay's lifetime so it never
  // preventDefaults Escape for other handlers (VHS chord, panel close)
  // when the help isn't open.
  _escHandler = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeHelp();
    }
  };
  document.addEventListener("keydown", _escHandler);
}

export function closeHelp() {
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

export function isHelpOpen() {
  return overlayEl != null;
}

export function initKeyboardHelp() {
  // "?" is Shift+/ on most layouts, so the keypress carries Shift.
  // onKey returns an unregister fn — kept so _resetForTests can detach
  // it (tests re-init each run and would otherwise stack listeners).
  _unbindToggle = onKey(
    "?",
    () => {
      if (overlayEl) closeHelp();
      else openHelp();
    },
    { shift: true },
  );
}

// Test hook — drop the singleton + toggle listener between runs.
export function _resetForTests() {
  if (_releaseFocusTrap) {
    _releaseFocusTrap();
    _releaseFocusTrap = null;
  }
  if (_escHandler) {
    document.removeEventListener("keydown", _escHandler);
    _escHandler = null;
  }
  if (_unbindToggle) {
    _unbindToggle();
    _unbindToggle = null;
  }
  if (overlayEl && overlayEl.parentNode) overlayEl.remove();
  overlayEl = null;
}
