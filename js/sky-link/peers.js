// ── Sky-Link Peers ──
// Pure peer registry and desktop-space geometry for the multi-window shared
// sky. A "peer" is another window of this site on the same machine, known
// only through the rects it broadcasts. All math here works in desktop
// coordinates — CSS pixels anchored to the OS screen origin — so windows can
// reason about each other's viewports without sharing any DOM. No channel,
// no timers, no side effects: the transport layer feeds this module.

/** Local viewport point → desktop point, given the viewport's desktop rect. */
export function toDesktop(pt, rect) {
  return { x: rect.x + pt.x, y: rect.y + pt.y };
}

/** Desktop point → local viewport point, given the viewport's desktop rect. */
export function toLocal(pt, rect) {
  return { x: pt.x - rect.x, y: pt.y - rect.y };
}

/**
 * Which edge of `selfRect` faces `peerRect`, by the dominant axis of the
 * center-to-center vector. Ties resolve horizontally so two side-by-side
 * windows with slightly offset heights still glow on their facing edges.
 */
export function sideToward(selfRect, peerRect) {
  const dx = peerRect.x + peerRect.w / 2 - (selfRect.x + selfRect.w / 2);
  const dy = peerRect.y + peerRect.h / 2 - (selfRect.y + selfRect.h / 2);
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "right" : "left";
  return dy >= 0 ? "bottom" : "top";
}

/**
 * Shortest gap between two rects' edges in px — 0 when they touch or
 * overlap. Drives proximity-scaled visuals (a nearer window glows harder).
 */
export function edgeGap(a, b) {
  const gx = Math.max(0, Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w)));
  const gy = Math.max(0, Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h)));
  return Math.hypot(gx, gy);
}

/**
 * Live registry of peer windows, expiring entries not re-announced within
 * `ttlMs`. Time is an explicit parameter everywhere — the caller owns the
 * clock. Each peer also carries whether it's currently reporting itself
 * visible: only one tab of a given OS window can ever be visible at once (a
 * backgrounded tab is always hidden), while two genuinely separate windows can
 * both be visible side by side — so "visible" is what distinguishes another
 * window from another tab of this one, and is what "linked" (glow, world
 * anchoring, force admission) means. A peer can be known (`has`) but not
 * currently visible (`hasVisible`) — that's exactly a backgrounded tab.
 */
export function createPeerRegistry(ttlMs) {
  const peers = new Map();
  return {
    upsert(id, rect, now, visible = true) {
      peers.set(id, { id, rect, seenAt: now, visible });
    },
    remove(id) {
      return peers.delete(id);
    },
    has(id) {
      return peers.has(id);
    },
    hasVisible(id) {
      return !!peers.get(id)?.visible;
    },
    /** Drop expired peers; returns true when anything was removed. */
    prune(now) {
      let changed = false;
      for (const [id, peer] of peers) {
        if (now - peer.seenAt > ttlMs) {
          peers.delete(id);
          changed = true;
        }
      }
      return changed;
    },
    all() {
      return [...peers.values()];
    },
    /** Known peers currently reporting themselves visible — the set that
     *  counts as "linked" for glow, world-anchoring, and achievements. */
    visiblePeers() {
      return [...peers.values()].filter((p) => p.visible);
    },
    count() {
      return peers.size;
    },
  };
}
