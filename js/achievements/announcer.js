// ── Screen Reader Announcer ──
// Minimal aria-live region for screen-reader users.  Achievement
// notifications are otherwise purely visual; without this, screen
// reader users never learn an achievement unlocked.
//
// Contract:
//   - `announce(text)` is the only entry point.  Idempotent — the first
//     call creates the <div aria-live="polite">; subsequent calls reuse.
//   - Messages queue and read out in order.  Unlocks arrive in
//     synchronous cascades (a threshold meta lands with the unlock that
//     crossed it); sighted users see every toast, so screen-reader
//     users must hear every message too, not just whichever wrote last.
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
// Gap between queued messages, so each registers as its own update
// rather than overwriting one still being spoken.
export const ANNOUNCE_GAP_MS = 1200;
// Queue bound. Bursts are structurally small (cascades run a few deep;
// bulk rewrites don't announce per-unlock), so overflow means something
// is misbehaving — drop the oldest, keep the most recent milestones.
export const ANNOUNCE_MAX_QUEUE = 6;

let _liveEl = null;
let _queue = [];
// Pending step of the write sequence (clear → write → gap). Null when
// idle, which is what lets a fresh announce start its clear immediately.
let _timer = null;

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
  _queue.push(String(text));
  if (_queue.length > ANNOUNCE_MAX_QUEUE) _queue.shift();
  if (_timer == null) step();
}

// Take the next queued message: clear the region, then write after the
// clear delay; once written, wait out the gap before the next message.
function step() {
  const next = _queue.shift();
  if (next == null) {
    _timer = null;
    return;
  }
  const el = ensureLiveEl();
  el.textContent = "";
  _timer = setTimeout(() => {
    el.textContent = next;
    _timer = _queue.length > 0 ? setTimeout(step, ANNOUNCE_GAP_MS) : null;
  }, ANNOUNCE_CLEAR_DELAY_MS);
}

// Test hook — discards the singleton so vi.resetModules + re-import
// gives each test a fresh DOM node.  Not exported in normal use.
export function _resetForTests() {
  if (_timer) {
    clearTimeout(_timer);
    _timer = null;
  }
  _queue = [];
  if (_liveEl && _liveEl.parentNode) _liveEl.parentNode.removeChild(_liveEl);
  _liveEl = null;
}
