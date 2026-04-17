// ── Keyboard Shortcut Helper ──
// Centralized keydown binding with automatic guards for modifier keys
// and focused input elements. All keyboard shortcuts should use this
// so behavior is consistent across the site.

// ── Input Guard ──
const INPUT_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/**
 * Register a keyboard shortcut.
 *
 * @param {string}   key       — The key to listen for (case-insensitive, e.g. "l", ".")
 * @param {Function} callback  — Called with the KeyboardEvent when the shortcut fires
 * @param {Object}   [opts]
 * @param {boolean}  [opts.ctrl]   — Require Ctrl/Cmd (default false)
 * @param {boolean}  [opts.shift]  — Require Shift (default false)
 * @param {boolean}  [opts.alt]    — Require Alt (default false)
 * @param {boolean}  [opts.allowInInput] — Fire even when an input is focused (default false)
 * @returns {Function} cleanup — removes the listener
 */
export function onKey(key, callback, opts = {}) {
  const lowerKey = key.toLowerCase();
  const needCtrl = opts.ctrl || false;
  const needShift = opts.shift || false;
  const needAlt = opts.alt || false;
  const allowInInput = opts.allowInInput || false;

  function handler(e) {
    if (e.key.toLowerCase() !== lowerKey) return;

    // Modifier matching — require specified, reject unspecified
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl !== needCtrl) return;
    if (e.shiftKey !== needShift) return;
    if (e.altKey !== needAlt) return;

    // Input guard
    if (!allowInInput) {
      const tag = document.activeElement?.tagName;
      if (tag && INPUT_TAGS.has(tag)) return;
      if (document.activeElement?.isContentEditable) return;
    }

    e.preventDefault();
    callback(e);
  }

  document.addEventListener("keydown", handler);
  return () => document.removeEventListener("keydown", handler);
}
