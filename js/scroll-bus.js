// ── Scroll Bus ──
// One window-scoped scroll listener that broadcasts {scrollY, deltaY} to
// every subscriber, so the page has a single source of scroll state
// instead of each consumer attaching its own listener and recomputing
// deltas privately.
//
// Subscribers receive a single readonly snapshot per scroll event.  Order
// of dispatch is registration order — but consumers must not depend on
// it; if a future consumer needs to run before/after another, it should
// register a coordinated handler rather than rely on incidental ordering.
//
// The bus reads `scrollY` once per native event and owns the `lastScrollY`
// between dispatches, so subscribers don't keep their own shadow copy.

let _lastScrollY = 0;
let _attached = false;
const _subscribers = new Set();

function _read() {
  return window.scrollY || document.documentElement.scrollTop || 0;
}

function _onScroll() {
  const scrollY = _read();
  const deltaY = scrollY - _lastScrollY;
  _lastScrollY = scrollY;
  // Snapshot is intentionally a fresh object per dispatch so a buggy
  // subscriber that holds onto it can't affect the next event.  Six
  // subscribers × ~one scroll event per frame ≈ negligible alloc cost.
  const snapshot = { scrollY, deltaY };
  for (const fn of _subscribers) {
    try {
      fn(snapshot);
    } catch (err) {
      console.error("[scroll-bus] subscriber threw:", err);
    }
  }
}

/**
 * Subscribe to scroll events.  Returns an unsubscribe function.  The
 * native listener attaches lazily on the first subscriber and stays
 * attached for the page's lifetime — there's no churn from rapidly
 * subscribing/unsubscribing within a session.
 *
 * @param {(s: {scrollY: number, deltaY: number}) => void} fn
 * @returns {() => void}
 */
export function subscribe(fn) {
  if (!_attached) {
    _lastScrollY = _read();
    window.addEventListener("scroll", _onScroll, { passive: true });
    _attached = true;
  }
  _subscribers.add(fn);
  return () => {
    _subscribers.delete(fn);
  };
}

/** Current `scrollY`, read fresh from the document. */
export function getScrollY() {
  return _read();
}

/**
 * Test-only: drop every subscriber and detach the native listener so
 * suites that exercise the bus directly don't leak between cases.
 */
export function _resetForTests() {
  _subscribers.clear();
  if (_attached) {
    window.removeEventListener("scroll", _onScroll);
    _attached = false;
  }
  _lastScrollY = 0;
}
