// ── Errors Bridge ──
// Caps at MAX_PER_SESSION and dedupes by a hash of the message + top
// stack frame so a runaway loop doesn't exhaust the vendor's event
// budget.  Captures the active theme — useful for pinpointing theme-
// specific regressions without needing Sentry's full fidelity.

import { track } from "../core.js";

const MAX_PER_SESSION = 10;
const MESSAGE_MAX_LEN = 300;

let sent = 0;
const seenHashes = new Set();

function hashString(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

function topFrame(stack) {
  if (!stack) return null;
  const lines = String(stack).split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    // V8/Chrome stacks start with "Error: message" — skip that header
    // but keep legitimate frames like Safari's "ErrorHandler@file.js:12".
    if (trimmed && !trimmed.startsWith("Error:")) {
      return trimmed.slice(0, 200);
    }
  }
  return null;
}

function report(name, message, stack) {
  if (sent >= MAX_PER_SESSION) return;
  const msg = (message || "").slice(0, MESSAGE_MAX_LEN);
  const frame = topFrame(stack);
  const key = hashString(msg + "|" + (frame || ""));
  if (seenHashes.has(key)) return;
  seenHashes.add(key);
  sent++;
  track(name, {
    message_hash: key,
    message_truncated: msg,
    stack_top_frame: frame,
    active_theme:
      (document.body.dataset && document.body.dataset.activeTheme) || null,
  });
}

export function initErrorsBridge() {
  window.addEventListener("error", (e) => {
    report("error", e.message, e.error && e.error.stack);
  });
  window.addEventListener("unhandledrejection", (e) => {
    const reason = e.reason;
    const message =
      (reason && (reason.message || String(reason))) || "unhandled rejection";
    const stack = reason && reason.stack;
    report("unhandled_rejection", message, stack);
  });
}
