// ── Analytics Identity ──
// Visitor / session / first-visit persistence.  No cookies — all state is
// per-origin localStorage + sessionStorage.  Identifiers are opaque UUIDv4s.
//
// Policy:
//   - visitorId is created lazily, only when a first event is tracked and
//     consent allows sending.  If the user is opted out we never create it.
//   - sessionId lives in sessionStorage, so closing the tab ends the
//     session.  A sessionSeq counter inside orders events within a session
//     so batches can be reconciled server-side when ms timestamps collide.
//   - firstVisitTs is set exactly once and never updated.

import { KEYS, localGet, localSet, sessionGet, sessionSet } from "./storage.js";

// ── UUIDv4 ──
// Uses crypto.randomUUID when available (all evergreen browsers do),
// with a non-crypto fallback so tests in minimal environments still work.
export function uuid() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  const rand = () =>
    Math.floor(Math.random() * 0x10000)
      .toString(16)
      .padStart(4, "0");
  return `${rand()}${rand()}-${rand()}-4${rand().slice(1)}-${(Math.floor(Math.random() * 4) + 8).toString(16)}${rand().slice(1)}-${rand()}${rand()}${rand()}`;
}

export function visitorId() {
  let id = localGet(KEYS.VISITOR_ID);
  if (!id) {
    id = uuid();
    localSet(KEYS.VISITOR_ID, id);
  }
  return id;
}

export function firstVisitTs() {
  let ts = localGet(KEYS.FIRST_VISIT_TS);
  if (!ts) {
    ts = new Date().toISOString();
    localSet(KEYS.FIRST_VISIT_TS, ts);
  }
  return ts;
}

export function daysSinceFirstVisit() {
  const ts = firstVisitTs();
  const now = Date.now();
  const then = Date.parse(ts);
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((now - then) / 86400000));
}

export function visitCount() {
  const raw = localGet(KEYS.VISIT_COUNT);
  const n = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(n) ? n : 0;
}

// Bumps the count and returns the new value.  Called exactly once per tab
// session (from the session bridge on session_start).
export function bumpVisitCount() {
  const next = visitCount() + 1;
  localSet(KEYS.VISIT_COUNT, String(next));
  localSet(KEYS.LAST_VISIT_TS, new Date().toISOString());
  return next;
}

export function isFirstVisitEver() {
  return !localGet(KEYS.LAST_VISIT_TS);
}

export function sessionId() {
  let id = sessionGet(KEYS.SESSION_ID);
  if (!id) {
    id = uuid();
    sessionSet(KEYS.SESSION_ID, id);
    sessionSet(KEYS.SESSION_STARTED_TS, new Date().toISOString());
    sessionSet(KEYS.SESSION_SEQ, "0");
  }
  return id;
}

export function sessionStartedTs() {
  sessionId(); // ensure initialized
  return sessionGet(KEYS.SESSION_STARTED_TS);
}

// Returns the next sequence number AND increments the persisted counter.
// Name is explicit about the mutation so a caller building a preview of
// the base props can't accidentally corrupt event ordering.
export function bumpAndGetSessionSeq() {
  sessionId(); // ensure initialized
  const raw = sessionGet(KEYS.SESSION_SEQ);
  const n = raw ? parseInt(raw, 10) : 0;
  const next = (Number.isFinite(n) ? n : 0) + 1;
  sessionSet(KEYS.SESSION_SEQ, String(next));
  return next;
}
