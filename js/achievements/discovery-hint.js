// ── Discovery Hint ──
// A single, gentle nudge for a visitor who's lingered without finding
// any of the interactive easter eggs.  After a stretch of inactivity
// with no theme activated this session, one toast points them at the
// idea ("things here respond to you") without spoiling any specific
// gesture.  Fires at most once per tab and never after the user has
// already discovered a theme.

import { prefersReducedMotion } from "../motion.js";

const IDLE_MS = 90000;
const SESSION_FLAG_KEY = "cloudlog-discovery-hint-shown";
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "scroll"];

// Above-the-fold, click-triggered themes whose trigger is a single element we
// can glow to say "this responds" without revealing the gesture. One is chosen
// per visit (rotating) so the nudge points somewhere different each time.
const TRIGGER_ZONES = [
  { theme: "frozen", selector: ".cloud-svg" },
  { theme: "rainy", selector: ".hero-tag" },
  { theme: "blocky", selector: ".appearance-toggle" },
];
const HINT_ZONE_KEY = "cloudlog-hint-zone";
const ZONE_CLASS = "trigger-hinting";
const ZONE_PULSE_MS = 2600;

let _idleTimer = null;
let _shown = false;
let _themeFound = false;
let _showFn = null;
let _resetIdle = null;
let _onThemeActivate = null;
let _hintZone = null;
let _zoneTimer = null;

// Read + advance the per-visit rotation cursor, returning this visit's zone.
function pickZone() {
  let i = 0;
  try {
    i = Number.parseInt(window.localStorage.getItem(HINT_ZONE_KEY) || "0", 10);
    if (!Number.isFinite(i)) i = 0;
    window.localStorage.setItem(
      HINT_ZONE_KEY,
      String((i + 1) % TRIGGER_ZONES.length),
    );
  } catch {
    // ignore — localStorage may be unavailable
  }
  return TRIGGER_ZONES[i % TRIGGER_ZONES.length];
}

// Glow the chosen zone's element, unless its theme is already active (found) or
// motion is reduced. Self-clears after the pulse.
function pulseZone() {
  if (!_hintZone || prefersReducedMotion()) return;
  if (document.body.classList.contains(_hintZone.theme)) return;
  const el = document.querySelector(_hintZone.selector);
  if (!el) return;
  el.classList.add(ZONE_CLASS);
  _zoneTimer = setTimeout(() => el.classList.remove(ZONE_CLASS), ZONE_PULSE_MS);
}

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
  pulseZone();
  teardown();
}

// Wire the idle watcher.  `showActivationToast` is injected so this
// module stays decoupled from the toast implementation.
export function initDiscoveryHint(showActivationToast) {
  if (typeof showActivationToast !== "function") return;
  if (alreadyShown()) return;
  _showFn = showActivationToast;
  _hintZone = pickZone();

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
  if (_zoneTimer) clearTimeout(_zoneTimer);
  _zoneTimer = null;
  _hintZone = null;
  _shown = false;
  _themeFound = false;
  _showFn = null;
  try {
    window.sessionStorage.removeItem(SESSION_FLAG_KEY);
  } catch {
    // ignore
  }
}
