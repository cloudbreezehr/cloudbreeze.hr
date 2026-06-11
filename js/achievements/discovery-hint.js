// ── Discovery Hint ──
// A single, gentle nudge for a visitor who's lingered without finding
// any of the interactive easter eggs.  After a stretch of inactivity
// with no theme activated this session, one toast points them at the
// idea ("things here respond to you") without spoiling any specific
// gesture.  Fires at most once per tab and never after the user has
// already discovered a theme.

const IDLE_MS = 90000;
const SESSION_FLAG_KEY = "cloudlog-discovery-hint-shown";
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "scroll"];

let _idleTimer = null;
let _shown = false;
let _themeFound = false;
let _showFn = null;
let _resetIdle = null;
let _onThemeActivate = null;

function alreadyShown() {
  try {
    return !!window.sessionStorage.getItem(SESSION_FLAG_KEY);
  } catch {
    return true; // no sessionStorage → behave as if shown (don't nag)
  }
}

function markShown() {
  _shown = true;
  try {
    window.sessionStorage.setItem(SESSION_FLAG_KEY, "1");
  } catch {
    // ignore
  }
}

function teardown() {
  if (_idleTimer) clearTimeout(_idleTimer);
  _idleTimer = null;
  if (_resetIdle) {
    for (const evt of ACTIVITY_EVENTS) {
      window.removeEventListener(evt, _resetIdle);
    }
    _resetIdle = null;
  }
  if (_onThemeActivate) {
    window.removeEventListener("achievement", _onThemeActivate);
    _onThemeActivate = null;
  }
}

function fire() {
  if (_shown || _themeFound) return;
  markShown();
  _showFn("Tip: some things on this page respond to you.");
  teardown();
}

// Wire the idle watcher.  `showActivationToast` is injected so this
// module stays decoupled from the toast implementation.
export function initDiscoveryHint(showActivationToast) {
  if (typeof showActivationToast !== "function") return;
  if (alreadyShown()) return;
  _showFn = showActivationToast;

  _resetIdle = () => {
    if (_shown || _themeFound) return;
    if (_idleTimer) clearTimeout(_idleTimer);
    _idleTimer = setTimeout(fire, IDLE_MS);
  };
  // A theme discovery cancels the hint for good — they found the layer.
  _onThemeActivate = (e) => {
    if (e.detail?.type === "theme-activate") {
      _themeFound = true;
      teardown();
    }
  };

  for (const evt of ACTIVITY_EVENTS) {
    window.addEventListener(evt, _resetIdle, { passive: true });
  }
  window.addEventListener("achievement", _onThemeActivate);
  _resetIdle();
}

// Test hook — clear listeners + flags so each run starts fresh.
export function _resetForTests() {
  teardown();
  _shown = false;
  _themeFound = false;
  _showFn = null;
  try {
    window.sessionStorage.removeItem(SESSION_FLAG_KEY);
  } catch {
    // ignore
  }
}
