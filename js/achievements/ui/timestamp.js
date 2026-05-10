// ── Timestamp Formatting ──
// Tiny state machine around a single boolean: do cards show "2m ago"
// or "14 Feb 2026, 14:07"?  Clicking any timestamp toggles the mode
// for every visible timestamp in the panel.
//
// The module owns the boolean and the mode-change achievement event
// dispatch.  The caller owns the DOM it wants refreshed — pass the
// scope (usually the Cloudlog panel element) to `toggleTimestampMode`
// so the module doesn't need to know where timestamps live.

import { formatRelativeTime, formatAbsoluteTime } from "../../time-ago.js";

let showAbsoluteTime = false;

export function formatTimestamp(ts) {
  return showAbsoluteTime ? formatAbsoluteTime(ts) : formatRelativeTime(ts);
}

export function toggleTimestampMode(scopeEl) {
  showAbsoluteTime = !showAbsoluteTime;
  if (showAbsoluteTime) {
    window.dispatchEvent(
      new CustomEvent("achievement", {
        detail: { type: "timestamp-toggle" },
      }),
    );
  }
  if (!scopeEl) return;
  scopeEl.querySelectorAll(".achievement-card-time").forEach((el) => {
    const ts = Number(el.dataset.ts);
    if (!ts) return;
    // Update only the leading text node to preserve inline progress spans.
    const firstText = el.firstChild;
    if (firstText && firstText.nodeType === Node.TEXT_NODE) {
      firstText.textContent = formatTimestamp(ts);
    } else {
      el.textContent = formatTimestamp(ts);
    }
  });
}

// Test hook — reset the mode so each test starts from a known state.
export function _resetForTests() {
  showAbsoluteTime = false;
}
