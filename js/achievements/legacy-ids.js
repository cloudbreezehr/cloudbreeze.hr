// ── Legacy Achievement Ids ──
// Ids double as storage keys, so renaming one would orphan progress already
// earned under it. Each entry maps a current id to every id it has worn
// before; anything reading stored ids resolves them through resolveLegacyId
// so old unlocks (local state, passport codes) keep counting. An id renamed
// more than once lists all of its former ids.
//
// Deliberately a standalone data module with no imports, so the storage
// layer can resolve ids without dragging the full registry into its graph.

export const LEGACY_IDS = {
  // "current-id": ["former-id", "older-former-id"],
  "to-the-minute": ["time-warp"],
};

const _legacyToCurrent = new Map();
for (const [currentId, formerIds] of Object.entries(LEGACY_IDS)) {
  for (const formerId of formerIds) _legacyToCurrent.set(formerId, currentId);
}

/** Resolve a possibly-renamed achievement id to its current form. */
export function resolveLegacyId(id) {
  return _legacyToCurrent.get(id) ?? id;
}
