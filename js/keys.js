// ── Keyboard Input Helpers ──
// Shared guards for the letter/key triggers spread across themes and effects,
// so "what counts as a typed letter" and "which focused elements swallow
// typing" live in exactly one place.

// Focused elements that should consume typing rather than feed a trigger.
export const INPUT_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

/**
 * The A–Z letter a keydown represents, or null when the press must not feed a
 * letter accumulator: a modifier is held, focus is in a text field or
 * contenteditable, or the key isn't a single letter. Non-letter keys (arrows,
 * F-keys, Tab, Enter, Shift, …) return null rather than a wrong letter, so a
 * user can press modifiers mid-word without resetting a sequence.
 */
export function letterFromKeyEvent(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  const tag = document.activeElement?.tagName;
  if (tag && INPUT_TAGS.has(tag)) return null;
  if (document.activeElement?.isContentEditable) return null;
  if (e.key.length !== 1) return null;
  const letter = e.key.toUpperCase();
  if (letter < "A" || letter > "Z") return null;
  return letter;
}
