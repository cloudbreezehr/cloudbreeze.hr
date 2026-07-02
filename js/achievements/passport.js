// ── Progress Passport ──
// Serializes Cloudlog progress into a compact, checksummed code so a
// visitor can carry it between browsers and machines — the static-site
// answer to account sync. Import merges rather than replaces: unlocks keep
// their earliest timestamp, numeric counters take the higher value, and
// collections union.

import * as storage from "./storage.js";
import { getAchievement } from "./registry.js";
import { hashString } from "../daily/seed.js";

// Format: PREFIX.<base64 payload>.<checksum base36>. The version rides in
// the prefix so a future format can be told apart at a glance.
const PASSPORT_PREFIX = "CBP1";
const CHECKSUM_RADIX = 36;

function toBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** Serialize the current progress into a portable passport code. */
export function exportPassport() {
  const state = storage.getState();
  const payload = {
    u: state.unlocked,
    c: state.counters,
    p: Object.fromEntries(
      Object.entries(state.progress).map(([key, entry]) => [key, entry.items]),
    ),
  };
  const b64 = toBase64(JSON.stringify(payload));
  const checksum = hashString(b64).toString(CHECKSUM_RADIX);
  return `${PASSPORT_PREFIX}.${b64}.${checksum}`;
}

/**
 * Parse and validate a passport code. Returns the payload, or null for
 * anything that isn't a complete, untampered CBP1 code.
 */
export function parsePassport(code) {
  if (typeof code !== "string") return null;
  const parts = code.trim().split(".");
  if (parts.length !== 3 || parts[0] !== PASSPORT_PREFIX) return null;
  const [, b64, checksum] = parts;
  if (hashString(b64).toString(CHECKSUM_RADIX) !== checksum) return null;
  try {
    const payload = JSON.parse(fromBase64(b64));
    if (!Array.isArray(payload.u)) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Merge a passport into local progress. Returns { added, total } — how many
 * new unlocks arrived — or null when the code doesn't validate. Unknown
 * achievement ids (a code from a newer site) are skipped, not errors.
 */
export function importPassport(code) {
  const payload = parsePassport(code);
  if (!payload) return null;

  const state = storage.getState();
  let added = 0;
  for (const entry of payload.u) {
    if (!entry || typeof entry.id !== "string") continue;
    if (!getAchievement(entry.id)) continue;
    const ts = typeof entry.ts === "number" ? entry.ts : Date.now();
    const existing = state.unlocked.find((u) => u.id === entry.id);
    if (!existing) {
      state.unlocked.push({ id: entry.id, ts });
      added++;
    } else if (ts < existing.ts) {
      existing.ts = ts;
    }
  }

  for (const [key, value] of Object.entries(payload.c || {})) {
    const current = state.counters[key];
    if (Array.isArray(value)) {
      state.counters[key] = [
        ...new Set([...(Array.isArray(current) ? current : []), ...value]),
      ];
    } else if (typeof value === "number") {
      state.counters[key] = Math.max(
        typeof current === "number" ? current : 0,
        value,
      );
    }
  }

  for (const [key, items] of Object.entries(payload.p || {})) {
    if (!Array.isArray(items)) continue;
    for (const item of items) storage.addProgressItem(key, item);
  }

  storage.saveNow();
  return { added, total: payload.u.length };
}
