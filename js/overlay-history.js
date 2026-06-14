// ── Overlay History ──
// Back-button / back-gesture handling for dismissable overlays with
// Forward-to-reopen after a browser-Back close.  Each overlay
// registers via pushOverlay() when it opens; the returned handle
// exposes pop() for the overlay's own close paths.
//
// Model: each push assigns a monotonic seq and pushes a synthetic
// history entry carrying that seq.  The module tracks every entry
// ever pushed (keyed by seq) plus currentSeq — where the browser
// cursor currently sits in our timeline.  On popstate we compare the
// destination seq to currentSeq to distinguish direction:
//   Back    (destSeq  <  currentSeq, or dest is non-overlay) →
//           invoke onClose of the entry we're leaving.
//   Forward (destSeq  >  currentSeq, or arriving from non-overlay) →
//           invoke onReopen of the entry we're entering.
// Each entry carries an alive flag that tracks whether the overlay
// is currently on screen; it flips on Forward/open and off on
// Back/UI-close, and guards onClose/onReopen from firing redundantly.
//
// When the UI closes the topmost overlay via handle.pop(), we call
// history.replaceState to convert the overlay entry into a plain base
// entry in place.  This avoids history.back(), which triggers browser
// scroll restoration even with scrollRestoration='manual' on some
// platforms, causing the page to jump to where it was when the overlay
// was opened.  replaceState emits no popstate, so the overlay's own
// close path handles cleanup; no double-close risk.  The trade-off:
// a UI close does not leave a forward entry, so Forward won't reopen
// the overlay (it will after a browser-Back close).
//
// When the UI closes an overlay that is *not* on top, we can't
// selectively remove a middle entry — the stack just marks it dead.
// A later Back traversal lands on it, sees alive=false, and skims
// past without invoking close again.  A later Forward into it will
// call onReopen if defined (the caller is expected to be idempotent).
//
// No URL mutation (no hash, no query param): overlay state is never
// bookmarkable or shareable — share links stay clean and anchor-based
// in-page navigation is untouched.
//
// Assumption: this module is the only code in the app that calls
// history.pushState / history.replaceState.  popstate events are
// interpreted as overlay traversals; a future SPA router or analytics
// state would need to coexist with this module explicitly.

// Opt out of browser scroll restoration globally so history.back() never
// animates or snaps the page to the position recorded at pushState time.
// This module owns all pushState calls for the app, so the opt-out is safe.
history.scrollRestoration = "manual";

const entries = new Map();
let currentSeq = null;
let nextSeq = 0;
let popstateListener = null;

function seqOf(event) {
  const state = event.state;
  if (state && typeof state === "object" && state.overlay) {
    return typeof state.seq === "number" ? state.seq : null;
  }
  return null;
}

function safeInvoke(label, fn) {
  try {
    fn();
  } catch (err) {
    // Swallow — a misbehaving overlay callback must not break back/forward navigation.
    console.warn(`[overlay-history] ${label} threw:`, err);
  }
}

function handlePopstate(event) {
  const oldSeq = currentSeq;
  const newSeq = seqOf(event);
  if (oldSeq === newSeq) return;
  currentSeq = newSeq;

  const isForward = newSeq !== null && (oldSeq === null || newSeq > oldSeq);

  if (isForward) {
    const entry = newSeq !== null ? entries.get(newSeq) : null;
    if (entry && !entry.alive && entry.onReopen) {
      entry.alive = true;
      safeInvoke("onReopen", entry.onReopen);
    }
  } else {
    const entry = oldSeq !== null ? entries.get(oldSeq) : null;
    if (entry && entry.alive && entry.onClose) {
      entry.alive = false;
      safeInvoke("onClose", entry.onClose);
    }
  }
}

function ensureListener() {
  if (popstateListener) return;
  popstateListener = handlePopstate;
  window.addEventListener("popstate", popstateListener);
}

/**
 * Register a newly-opened overlay with the history stack.
 *
 * @param {Function} onClose — invoked when the user navigates back
 *   out of this overlay's history entry (Back press / back-gesture).
 * @param {Function} [onReopen] — optional.  Invoked when the user
 *   navigates forward into this overlay's entry after a browser-Back
 *   close.  Not called after a UI close (handle.pop()), which leaves
 *   no forward entry.  Must be idempotent — it may fire for an
 *   already-open overlay in edge cases.
 * @returns {{ pop: Function }} handle.  Call pop() from the overlay's
 *   own close paths (X button, Escape, outside click, auto-close on
 *   scroll).  Idempotent: safe to call more than once per close.
 */
export function pushOverlay(onClose, onReopen) {
  const seq = nextSeq++;
  const entry = { onClose, onReopen, alive: true };
  entries.set(seq, entry);
  history.pushState({ overlay: true, seq }, "");
  currentSeq = seq;
  ensureListener();
  return {
    pop() {
      if (!entry.alive) return;
      entry.alive = false;
      // Only touch the history entry when this overlay is the topmost
      // one.  replaceState converts it to a plain base entry without
      // triggering browser scroll restoration (history.back() causes a
      // page jump on some platforms even with scrollRestoration='manual').
      // replaceState fires no popstate, so onClose is never re-invoked.
      // If this entry is buried under a newer overlay, we can't remove
      // a middle entry — leave it dead until a natural Back traversal
      // reaches it; the handler will skim past.
      if (currentSeq === seq) {
        currentSeq = null;
        history.replaceState(null, "");
      }
    },
    // Unregister this overlay entirely — no future popstate traversal
    // will invoke its onClose or onReopen.  Use when the overlay is
    // being torn down (not just closed) so Forward presses can't
    // resurrect a destroyed UI.  Idempotent.
    dispose() {
      entry.alive = false;
      entry.onClose = null;
      entry.onReopen = null;
      entries.delete(seq);
    },
  };
}

// Test hook — drop module-level state between runs.
export function _resetForTests() {
  entries.clear();
  currentSeq = null;
  nextSeq = 0;
  if (popstateListener) {
    window.removeEventListener("popstate", popstateListener);
    popstateListener = null;
  }
}
