// ── Sky-Link Remote Pointers ──
// Pure registry of pointers announced by linked windows. Each entry is the
// latest state of one window's pointer in desktop coordinates plus its
// interaction flags, expiring when the owner goes quiet. Time is an
// explicit parameter everywhere — the caller owns the clock. No channel,
// no DOM: the transport layer feeds this module.

export function createRemotePointerRegistry(ttlMs) {
  const pointers = new Map();
  return {
    /**
     * Record the latest state of a peer's pointer. `state` carries desktop
     * coordinates and interaction flags:
     * { x, y, active, isDragging, holdStrength, wellStrength }.
     */
    upsert(id, state, now) {
      pointers.set(id, { id, ...state, seenAt: now });
    },
    remove(id) {
      return pointers.delete(id);
    },
    /** Drop expired pointers; returns true when anything was removed. */
    prune(now) {
      let changed = false;
      for (const [id, ptr] of pointers) {
        if (now - ptr.seenAt > ttlMs) {
          pointers.delete(id);
          changed = true;
        }
      }
      return changed;
    },
    all() {
      return [...pointers.values()];
    },
    count() {
      return pointers.size;
    },
  };
}
