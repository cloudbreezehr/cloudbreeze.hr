// ── Cursor Ghosts ──
// A linked window's pointer, redrawn here as the site's own custom cursor
// continuing across the seam. The OS routes the mouse to whichever window
// captured the drag, so this window never sees the neighbour's pointer from its
// own events — it arrives over the channel. Each peer cursor is a pair of DOM
// elements on the cursor layer, styled exactly like #cursor / #cursor-ring
// (same size, same theme colour) and, living on the cursor layer, drawn on top
// of the page rather than occluded by content. So as the mouse leaves the
// neighbour and its cursor exits that window's edge, an identical cursor enters
// this one — one cursor crossing, not a blob. Position is set inline from the
// streamed pointer and smoothed by a short CSS transition (the stream is coarser
// than the render). A peer cursor is only drawn while its pointer is actually
// within this viewport — a pointer still in its own window is drawn there, not
// here. This module also witnesses the moment a neighbour's drag reaches inside
// this viewport — the ghost-hand discovery.

import { defineConstants } from "../dev/registry.js";
import { spawnRipple } from "../effects/ripple.js";
import { WELL } from "../interactions.constants.js";

const GHOST = defineConstants("skyLink.ghost", {
  REMOVE_MS: {
    value: 400,
    min: 0,
    max: 3000,
    step: 50,
    description:
      "Delay before a departed peer cursor's elements are removed — must exceed the CSS fade so it fades before it's dropped (ms)",
  },
});

export function createCursorGhosts() {
  // id → { dot, ring, removeTimer } — the DOM cursor pair for each peer whose
  // pointer is (or was recently) inside this viewport.
  const cursors = new Map();
  let handFired = false;

  function makeCursor() {
    const dot = document.createElement("div");
    dot.className = "sky-link-cursor";
    dot.setAttribute("aria-hidden", "true");
    const ring = document.createElement("div");
    ring.className = "sky-link-cursor-ring";
    ring.setAttribute("aria-hidden", "true");
    document.body.append(dot, ring);
    // prevWell tracks the peer's last well charge so a 0→charging transition
    // fires the activation pulse once, not every frame it stays charged.
    return { dot, ring, removeTimer: 0, prevWell: 0 };
  }

  // Centre the element on (x, y), matching how cursor.js places #cursor.
  function place(el, x, y) {
    el.style.translate = `calc(${x}px - 50%) calc(${y}px - 50%)`;
  }

  return {
    /**
     * Reconcile the peer cursors with the seam's remote-pointer list (true
     * viewport coordinates). `canvas` supplies the viewport bounds. Returns the
     * number of peer cursors still in the DOM — a departed one fades out over
     * `REMOVE_MS`, so the caller keeps calling while this is above zero even
     * after `remotes` empties.
     */
    update(remotes, canvas) {
      const present = new Set();
      for (const rp of remotes) {
        // Only a pointer actually inside this viewport is a cursor here; one
        // still in its own window belongs on that window's screen.
        const inside =
          rp.x >= 0 &&
          rp.x <= canvas.width &&
          rp.y >= 0 &&
          rp.y <= canvas.height;
        if (!inside) continue;
        present.add(rp.id);
        let c = cursors.get(rp.id);
        if (!c) {
          c = makeCursor();
          cursors.set(rp.id, c);
        }
        if (c.removeTimer) {
          clearTimeout(c.removeTimer);
          c.removeTimer = 0;
        }
        place(c.dot, rp.x, rp.y);
        place(c.ring, rp.x, rp.y);
        c.dot.classList.add("visible");
        c.ring.classList.add("visible");
        // Mirror the origin cursor's pressed look while its drag is captured —
        // dot swells, ring tightens — so the ghost reads as pressing, not idle.
        c.dot.classList.toggle("pressing", !!rp.isDragging);
        c.ring.classList.toggle("pressing", !!rp.isDragging);
        const well = rp.wellStrength || 0;
        c.ring.style.setProperty("--well-strength", well.toFixed(3));
        c.ring.classList.toggle("gravity-well", well > 0);
        // The peer's well just activated in view: bloom the same pulse ring it
        // spawned on its own screen. Silent — the origin already sounded it, so
        // this side answers with the visual only, like the mirrored burst.
        if (well > 0 && c.prevWell === 0) {
          spawnRipple(rp.x, rp.y, {
            className: "well-pulse-ring",
            count: WELL.PULSE_RING_COUNT,
            staggerMs: WELL.PULSE_RING_STAGGER_MS,
            duration: WELL.PULSE_RING_DURATION_MS,
            maxScale: WELL.PULSE_RING_MAX_SCALE,
            startOpacity: WELL.PULSE_RING_OPACITY,
            sound: null,
          });
        }
        c.prevWell = well;

        // A neighbour's captured drag physically inside this viewport is the
        // feature's flagship moment — celebrate it once per page load.
        if (!handFired && rp.isDragging) {
          handFired = true;
          window.dispatchEvent(
            new CustomEvent("achievement", {
              detail: { type: "sky-link-ghost-hand" },
            }),
          );
        }
      }

      // Fade out (then remove) cursors whose pointer has left this viewport.
      for (const [id, c] of cursors) {
        if (present.has(id)) continue;
        c.dot.classList.remove("visible", "pressing");
        c.ring.classList.remove("visible", "pressing", "gravity-well");
        if (!c.removeTimer) {
          c.removeTimer = setTimeout(() => {
            c.dot.remove();
            c.ring.remove();
            cursors.delete(id);
          }, GHOST.REMOVE_MS);
        }
      }
      return cursors.size;
    },
  };
}
