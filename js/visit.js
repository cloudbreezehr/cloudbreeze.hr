// ── Visit ──
// Whether this page load is a return visit: false the first time the site is
// ever loaded, true on every later load. The signal behind progressive
// disclosure of secondary controls (the sound toggle, the precise-location
// button) that shouldn't greet a first-time visitor.
//
// Read-and-mark, memoized on first call. Memoization is load-safe by design: a
// shared flag that each consumer marked independently would let whoever ran
// first flip a genuine first visit into a "return" for the others, so the read
// (and the mark) happen exactly once here and every caller gets that one answer
// regardless of init order.

const VISITED_KEY = "cloudbreeze-visited";

let _isReturn = null;

export function isReturnVisit() {
  if (_isReturn !== null) return _isReturn;
  try {
    _isReturn = localStorage.getItem(VISITED_KEY) === "1";
    localStorage.setItem(VISITED_KEY, "1");
  } catch {
    // No storage — can't tell first from return; treat as a return so
    // return-gated controls (and their achievements) stay reachable.
    _isReturn = true;
  }
  return _isReturn;
}

// Test hook — forget the memo and the stored flag so the next call reads fresh.
export function _resetForTests() {
  _isReturn = null;
  try {
    localStorage.removeItem(VISITED_KEY);
  } catch {
    // ignore
  }
}
