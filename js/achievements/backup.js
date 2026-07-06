// ── Cloudlog Backup ──
// The save-to-file / restore-from-file format: readable JSON that carries a
// passport as its seal. The passport (a checksummed code over the
// cheat-sensitive core — unlocks, counters, collections) is what import trusts;
// the readable `state` block is there so the file can still be opened and read.
// On import the two must agree, so hand-editing a number in the file breaks the
// seal and the restore is refused.
//
// This only closes the open-it-in-a-text-editor path: a client-only site ships
// the checksum with the page, so it can't stop someone in devtools who edits
// storage directly or recomputes the seal. That's the intended ceiling.

import * as storage from "./storage.js";
import { exportPassport, parsePassport, payloadFromState } from "./passport.js";

// Envelope shape. The tag names the file at a glance; the format version is the
// envelope's own, separate from the state schema version living inside `state`.
const FILE_TAG = "cloudbreeze-cloudlog";
const FORMAT_VERSION = 1;

/** Serialize progress into readable, sealed JSON for download. */
export function exportBackup() {
  return JSON.stringify(
    {
      cloudbreeze: FILE_TAG,
      version: FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      state: storage.getState(),
      passport: exportPassport(),
    },
    null,
    2,
  );
}

// The readable block and the sealed passport encode the same core; compare
// their canonical forms. Equal means the file wasn't hand-edited after export
// (both are our own output, built the same way, so key order lines up).
function sealMatchesState(sealed, state) {
  return JSON.stringify(sealed) === JSON.stringify(payloadFromState(state));
}

/**
 * Restore progress from a sealed backup. Returns true on success; false when
 * the file isn't a valid backup — unparseable, missing its seal, a seal that
 * fails its own checksum, or a seal that disagrees with the readable block (the
 * tamper case). A successful restore runs the same merge/migrate as any load,
 * so an older-schema backup still imports.
 */
export function importBackup(json) {
  try {
    const file = JSON.parse(json);
    if (!file || typeof file !== "object") return false;
    if (typeof file.passport !== "string") return false;
    if (!file.state || typeof file.state !== "object") return false;

    const sealed = parsePassport(file.passport);
    if (!sealed) return false;
    if (!sealMatchesState(sealed, file.state)) return false;

    return storage.importState(JSON.stringify(file.state));
  } catch {
    return false;
  }
}
