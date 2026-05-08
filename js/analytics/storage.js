// ── Analytics Storage ──
// Namespaced localStorage / sessionStorage wrappers.  Keeps keys in one
// place so identity.js, consent.js, and context.js don't collide with the
// site's other localStorage keys (theme, achievements).  Every read is
// defensive — localStorage can throw in private-mode Safari, disabled
// storage policies, etc., and analytics must never break the page.

const PREFIX = "cb_analytics_";

export const KEYS = {
  VISITOR_ID: PREFIX + "visitor_id",
  FIRST_VISIT_TS: PREFIX + "first_visit_ts",
  VISIT_COUNT: PREFIX + "visit_count",
  LAST_VISIT_TS: PREFIX + "last_visit_ts",
  UTM: PREFIX + "utm",
  OPT_OUT: "cb_analytics_opt_out",
  SESSION_ID: PREFIX + "session_id",
  SESSION_SEQ: PREFIX + "session_seq",
  SESSION_STARTED_TS: PREFIX + "session_started_ts",
};

export function localGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function localSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Full or blocked — silently no-op.
  }
}

export function localRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export function sessionGet(key) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function sessionSet(key, value) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // ignore
  }
}
