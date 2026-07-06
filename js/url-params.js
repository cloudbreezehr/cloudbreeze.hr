// ── URL Parameters ──
// Single source of truth for every parameter the site reads from or writes
// to the URL, spanning both the hash fragment and the query string.
// Consumers name a parameter and ask for its value; they never touch
// location.hash, location.search, or URLSearchParams, and never care
// whether a parameter currently lives in the fragment or the query string.
// That "where" is the catalog's business, so a parameter can migrate
// between the two — or be resolvable from both at once — without any
// consumer changing.

// ── Sources ──
// Where a parameter can be read from / written to.
const HASH = "hash";
const QUERY = "query";

// ── Kinds ──
// value — key=value; resolves to the decoded string, or null when absent.
// flag  — presence of a bare key; resolves to boolean.
const VALUE = "value";
const FLAG = "flag";

// ── Catalog ──
// Each entry lists the source(s) to resolve from in precedence order
// (the first source carrying the key wins), its kind, and — for values
// written back into a shareable URL — the single source buildUrl emits
// it into.  Adding a URL parameter is one entry here.
const PARAMS = {
  sky: { sources: [QUERY, HASH], kind: VALUE, write: HASH },
  dev: { sources: [HASH], kind: FLAG },
  theme: { sources: [QUERY], kind: VALUE, write: QUERY },
  finale: { sources: [QUERY], kind: FLAG },
  achievement: { sources: [QUERY], kind: VALUE, write: QUERY },
  "cloudlog-activity": { sources: [HASH], kind: FLAG },
  "cloudlog-achievements": { sources: [HASH], kind: FLAG },
};

// ── Parsing ──
// decodeURIComponent throws on a malformed escape; a stray one in any
// segment must not blow up resolution of an unrelated parameter, so a
// failed decode falls back to the raw text.
function decode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

// The fragment is parsed as an &-separated list of key=value pairs, with
// a bare token (no `=`) treated as a present flag.  Returns a Map of
// key → decoded string, or key → true for bare flags.
function hashEntries() {
  const map = new Map();
  const raw = typeof location !== "undefined" ? location.hash : "";
  if (!raw) return map;
  const body = raw.charAt(0) === "#" ? raw.slice(1) : raw;
  for (const seg of body.split("&")) {
    if (!seg) continue;
    const eq = seg.indexOf("=");
    if (eq === -1) map.set(decode(seg), true);
    else map.set(decode(seg.slice(0, eq)), decode(seg.slice(eq + 1)));
  }
  return map;
}

function queryParams() {
  const search = typeof location !== "undefined" ? location.search : "";
  return new URLSearchParams(search);
}

// Look a key up in one source.  Returns null when the source doesn't
// carry the key at all, else { value } — an empty string for a bare
// flag, the decoded value otherwise.
function readSource(source, key) {
  if (source === QUERY) {
    const params = queryParams();
    return params.has(key) ? { value: params.get(key) } : null;
  }
  const map = hashEntries();
  if (!map.has(key)) return null;
  const v = map.get(key);
  return { value: v === true ? "" : v };
}

// ── Reads ──

/** Decoded value of a parameter, or null when absent / present-but-empty. */
export function getParam(name) {
  for (const source of PARAMS[name].sources) {
    const hit = readSource(source, name);
    if (hit && hit.value) return hit.value;
  }
  return null;
}

/** True when a flag parameter is present in any of its sources. */
export function hasFlag(name) {
  for (const source of PARAMS[name].sources) {
    if (readSource(source, name)) return true;
  }
  return false;
}

// ── Writes ──

/**
 * Build a URL carrying the given { name: value } parameters, each placed
 * into its catalog `write` source.  Defaults to the current page's
 * origin + pathname; pass { base } to target another.
 */
export function buildUrl(params, { base } = {}) {
  const origin =
    base ??
    (typeof location !== "undefined"
      ? location.origin + location.pathname
      : "");
  const queryParts = [];
  const hashParts = [];
  for (const [name, value] of Object.entries(params)) {
    const encoded = `${name}=${encodeURIComponent(value)}`;
    if (PARAMS[name].write === HASH) hashParts.push(encoded);
    else queryParts.push(encoded);
  }
  let url = origin;
  if (queryParts.length) url += "?" + queryParts.join("&");
  if (hashParts.length) url += "#" + hashParts.join("&");
  return url;
}

// ── Change notification ──
// The URL can change in place (a hash deep-link followed live, the
// address bar edited).  Subscribers re-read by name on each change; the
// callback carries no payload because the value is always a fresh query
// away.
const listeners = new Set();
let bound = false;

function emitChange() {
  for (const cb of listeners) cb();
}

/**
 * Subscribe to in-place URL changes.  Returns an unsubscribe function.
 */
export function onUrlChange(cb) {
  listeners.add(cb);
  if (!bound && typeof window !== "undefined") {
    bound = true;
    window.addEventListener("hashchange", emitChange);
  }
  return () => listeners.delete(cb);
}
