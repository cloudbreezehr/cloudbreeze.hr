// ── Analytics Context ──
// Builds the base properties attached to every event.  Two categories:
//
//   1. Captured once per session (or once ever) — referrer domain, UTM
//      params, language, timezone, device flags.  Memoized.
//
//   2. Read live at track() time — viewport, appearance, active theme,
//      unlock totals.  Cheap DOM/localStorage reads, safe per-event.
//
// Base props never include PII.  Referrer is hostname-only; UTM is a
// well-known marketing convention and carries no cross-site identifier.

import * as identity from "./identity.js";
import { KEYS, localGet, localSet } from "./storage.js";
import { sumPoints } from "../achievements/registry.js";

const APP_VERSION = "1.0.0";
const UTM_KEYS = ["source", "medium", "campaign", "term", "content"];

// Memoized once per module load.  On this site that coincides with "once
// per session" because there's no client-side routing — the module only
// reloads on a full page navigation, and referrer/UTM/device flags don't
// change mid-session.  If SPA routing is ever added, revisit: referrer
// would need to be recaptured per in-app navigation.
let _oncePerSession = null;

function referrerDomain() {
  try {
    const ref = document.referrer;
    if (!ref) return null;
    const url = new URL(ref);
    if (url.host === location.host) return null;
    return url.hostname || null;
  } catch {
    return null;
  }
}

// Capture UTM on first arrival, persist for the visitor lifetime so
// attribution survives scroll-depth-triggered navigations back to the
// landing page.  We don't overwrite on re-entry — first touch wins.
function utmParams() {
  const existing = localGet(KEYS.UTM);
  if (existing) {
    try {
      return JSON.parse(existing);
    } catch {
      // fall through to re-parse from the URL
    }
  }
  const out = {};
  try {
    const params = new URLSearchParams(location.search);
    let any = false;
    for (const k of UTM_KEYS) {
      const v = params.get(`utm_${k}`);
      if (v) {
        out[`utm_${k}`] = v;
        any = true;
      }
    }
    if (any) localSet(KEYS.UTM, JSON.stringify(out));
  } catch {
    // ignore
  }
  return out;
}

function staticContext() {
  if (_oncePerSession) return _oncePerSession;

  const nav = typeof navigator !== "undefined" ? navigator : {};
  const lang = nav.language || null;
  let tz = null;
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    tz = null;
  }

  const coarse =
    typeof matchMedia !== "undefined" &&
    matchMedia("(pointer: coarse)").matches;
  const standalone =
    typeof matchMedia !== "undefined" &&
    matchMedia("(display-mode: standalone)").matches;
  const reducedMotion =
    typeof matchMedia !== "undefined" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches;

  _oncePerSession = {
    app_version: APP_VERSION,
    language: lang,
    timezone: tz,
    is_touch: !!coarse,
    is_pwa: !!standalone,
    prefers_reduced_motion: !!reducedMotion,
    referrer_domain: referrerDomain(),
    ...utmParams(),
  };
  return _oncePerSession;
}

function liveContext() {
  const body = document.body;
  const appearanceSetting =
    localGet("appearance") || localGet("theme") || "auto";
  const appearanceEffective =
    body && body.classList.contains("light-appearance") ? "light" : "dark";
  const activeTheme =
    (body && body.dataset && body.dataset.activeTheme) || null;

  let cloudlogActive = false;
  let unlocksTotal = 0;
  let pointsTotal = 0;
  try {
    const raw = localStorage.getItem("achievements");
    if (raw) {
      const parsed = JSON.parse(raw);
      cloudlogActive = !!parsed.active;
      if (Array.isArray(parsed.unlocked)) {
        unlocksTotal = parsed.unlocked.length;
        pointsTotal = sumPoints(parsed.unlocked);
      }
    }
  } catch {
    // ignore
  }

  return {
    viewport_w: window.innerWidth,
    viewport_h: window.innerHeight,
    dpr: window.devicePixelRatio || 1,
    appearance_setting: appearanceSetting,
    appearance_effective: appearanceEffective,
    active_theme: activeTheme,
    cloudlog_active: cloudlogActive,
    unlocks_total: unlocksTotal,
    points_total: pointsTotal,
  };
}

export function baseProps() {
  return {
    ...staticContext(),
    ...liveContext(),
    visitor_id: identity.visitorId(),
    session_id: identity.sessionId(),
    session_seq: identity.bumpAndGetSessionSeq(),
    visit_count: identity.visitCount(),
    days_since_first_visit: identity.daysSinceFirstVisit(),
    ts: new Date().toISOString(),
  };
}

// Test hook — discard memoized static context so subsequent baseProps()
// re-reads referrer / UTM / matchMedia.  Not exported in normal use.
export function _resetForTests() {
  _oncePerSession = null;
}
