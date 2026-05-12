// ── Screen Reader Announcer ──
// Minimal aria-live region for screen-reader users.  Achievement
// notifications are otherwise purely visual; without this, screen
// reader users never learn an achievement unlocked.
//
// Contract:
//   - `announce(text)` is the only entry point.  Idempotent — the first
//     call creates the <div aria-live="polite">; subsequent calls reuse.
//   - Messages are cleared between updates so the same text announced
//     twice in a row still reads.  Without the clear step, some screen
//     readers de-dupe and stay silent.
//   - Visually hidden via the sr-only clip-path pattern.  aria-live
//     regions must not be display:none or visibility:hidden — those
//     remove the element from the accessibility tree.

// Delay between clearing the live region and writing the new message.
// Needed for screen readers to pick up the diff — see the aria-live
// spec "Triggering screen readers" notes.
export const ANNOUNCE_CLEAR_DELAY_MS = 60;

let _liveEl = null;
let _clearTimer = null;

function ensureLiveEl() {
  if (_liveEl) return _liveEl;
  _liveEl = document.createElement("div");
  _liveEl.setAttribute("aria-live", "polite");
  _liveEl.setAttribute("aria-atomic", "true");
  _liveEl.setAttribute("role", "status");
  // sr-only: present in the accessibility tree but invisible.  Using
  // clip-path instead of display:none keeps the announcer readable to
  // screen readers.
  _liveEl.style.cssText =
    "position:absolute;width:1px;height:1px;padding:0;margin:-1px;" +
    "overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0";
  document.body.appendChild(_liveEl);
  return _liveEl;
}

export function announce(text) {
  if (!text) return;
  const el = ensureLiveEl();
  if (_clearTimer) clearTimeout(_clearTimer);
  el.textContent = "";
  _clearTimer = setTimeout(() => {
    el.textContent = String(text);
    _clearTimer = null;
  }, ANNOUNCE_CLEAR_DELAY_MS);
}

// Test hook — discards the singleton so vi.resetModules + re-import
// gives each test a fresh DOM node.  Not exported in normal use.
export function _resetForTests() {
  if (_clearTimer) {
    clearTimeout(_clearTimer);
    _clearTimer = null;
  }
  if (_liveEl && _liveEl.parentNode) _liveEl.parentNode.removeChild(_liveEl);
  _liveEl = null;
}
