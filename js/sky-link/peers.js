// ── Sky-Link Peers ──
// Pure peer registry and desktop-space geometry for the multi-window shared
// sky. A "peer" is another window of this site on the same machine, known
// only through the rects it broadcasts. All math here works in desktop
// coordinates — CSS pixels anchored to the OS screen origin — so windows can
// reason about each other's viewports without sharing any DOM. No channel,
// no timers, no side effects: the transport layer feeds this module.

/**
 * Best-effort desktop-space rect of a window's *viewport* (not the OS
 * window). Browsers don't expose the viewport's screen position directly;
 * this assumes the window chrome splits its horizontal extent evenly into
 * side borders and stacks the rest (tab strip, toolbars) on top. Exact
 * enough for cross-window effects, which tolerate a few px of drift.
 */
export function viewportDesktopRect(win = window) {
  const sideChrome = (win.outerWidth - win.innerWidth) / 2;
  const topChrome = win.outerHeight - win.innerHeight - sideChrome;
  return {
    x: win.screenX + sideChrome,
    y: win.screenY + topChrome,
    w: win.innerWidth,
    h: win.innerHeight,
  };
}

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
 * Distance along a ray (desktop origin + angle) to its entry into `rect`,
 * or null when the ray misses. Standard slab intersection; a ray starting
 * inside the rect enters at distance 0.
 */
export function rayRectEntry(origin, angle, rect) {
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  let tEnter = -Infinity;
  let tExit = Infinity;

  for (const [pos, dir, lo, hi] of [
    [origin.x, dirX, rect.x, rect.x + rect.w],
    [origin.y, dirY, rect.y, rect.y + rect.h],
  ]) {
    if (dir === 0) {
      if (pos < lo || pos > hi) return null;
      continue;
    }
    const t1 = (lo - pos) / dir;
    const t2 = (hi - pos) / dir;
    tEnter = Math.max(tEnter, Math.min(t1, t2));
    tExit = Math.min(tExit, Math.max(t1, t2));
  }
  if (tEnter > tExit || tExit < 0) return null;
  return Math.max(0, tEnter);
}

/**
 * The nearest peer whose viewport the ray reaches within `maxDistance` px,
 * or null. `peers` is a list of { rect } entries; extra fields ride along
 * untouched so the caller gets its own peer object back.
 */
export function rayTargetPeer(origin, angle, peers, maxDistance) {
  let best = null;
  let bestT = Infinity;
  for (const peer of peers) {
    const t = rayRectEntry(origin, angle, peer.rect);
    if (t !== null && t <= maxDistance && t < bestT) {
      bestT = t;
      best = peer;
    }
  }
  return best;
}

/**
 * Live registry of peer windows, expiring entries not re-announced within
 * `ttlMs`. Time is an explicit parameter everywhere — the caller owns the
 * clock.
 */
export function createPeerRegistry(ttlMs) {
  const peers = new Map();
  return {
    upsert(id, rect, now) {
      peers.set(id, { id, rect, seenAt: now });
    },
    remove(id) {
      return peers.delete(id);
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
    count() {
      return peers.size;
    },
  };
}
