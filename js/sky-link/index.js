// ── Sky Link ──
// Links every open window of the site on the same machine into one
// continuous sky. Windows announce their desktop-space viewport rects over a
// BroadcastChannel; while at least one peer is fresh, the body carries
// `sky-linked`, the edges facing peer windows glow, shooting stars that fly
// off-screen continue their arc in the window they were heading toward, and
// click impulses ripple across into neighbouring viewports.
//
// Everything is desktop-coordinate math from peers.js; this module owns the
// transport (channel, heartbeats, expiry) and the DOM touchpoints (body
// class, glows, events). Browsers without BroadcastChannel simply never
// link — the site behaves as a solo window.

import {
  createPeerRegistry,
  viewportDesktopRect,
  toDesktop,
  toLocal,
  sideToward,
  edgeGap,
  rayTargetPeer,
} from "./peers.js";
import { setOfferHandler, spawnHandoff, setLinkProbe } from "./handoff.js";
import { HOLD } from "../interactions.js";
import { hasCapability } from "../device.js";
import { prefersReducedMotion } from "../motion.js";
import { defineConstants } from "../dev/registry.js";

const CHANNEL_NAME = "cloudbreeze-sky-link";

export const SKY_LINK = defineConstants("skyLink", {
  POLL_MS: {
    value: 150,
    min: 50,
    max: 1000,
    step: 10,
    description: "Interval between window-rect polls (ms)",
  },
  HEARTBEAT_MS: {
    value: 900,
    min: 200,
    max: 5000,
    step: 100,
    description: "Max quiet time before re-announcing an unchanged rect (ms)",
  },
  TTL_MS: {
    value: 3000,
    min: 500,
    max: 15000,
    step: 100,
    description: "Peer expiry — silence longer than this drops the link (ms)",
  },
  HANDOFF_MAX_GAP_PX: {
    value: 1400,
    min: 0,
    max: 5000,
    step: 50,
    description: "Farthest a particle travels off-screen to reach a peer (px)",
  },
  IMPULSE_REACH_PX: {
    value: 600,
    min: 0,
    max: 2000,
    step: 25,
    description: "How far beyond a peer's viewport a click still pushes (px)",
  },
  IMPULSE_FACTOR: {
    value: 0.7,
    min: 0,
    max: 2,
    step: 0.05,
    description: "Remote click impulse strength relative to a local click",
  },
  GLOW_RANGE_PX: {
    value: 900,
    min: 100,
    max: 3000,
    step: 50,
    description: "Peer distance at which the facing-edge glow fades to zero",
  },
});

const GLOW_SIDES = ["left", "right", "top", "bottom"];

function randomId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export function initSkyLink() {
  if (typeof BroadcastChannel === "undefined") return () => {};
  // Touch-only devices can't place windows side by side — two tabs there
  // would still broadcast and "link", glowing at an edge no other window
  // can ever occupy.
  if (!hasCapability("multiwindow")) return () => {};

  const id = randomId();
  const channel = new BroadcastChannel(CHANNEL_NAME);
  const registry = createPeerRegistry(SKY_LINK.TTL_MS);

  let selfRect = viewportDesktopRect();
  let lastSentJson = "";
  let lastSentAt = 0;
  let linkedWindows = 1;

  // ── Facing-edge glows ──
  // One fixed element per edge; intensity rides a CSS custom property so
  // the stylesheet owns every visual decision.
  const glows = new Map();
  for (const side of GLOW_SIDES) {
    const el = document.createElement("div");
    el.className = "sky-link-glow";
    el.dataset.side = side;
    el.setAttribute("aria-hidden", "true");
    document.body.appendChild(el);
    glows.set(side, el);
  }

  function refreshGlows() {
    const strongest = { left: 0, right: 0, top: 0, bottom: 0 };
    for (const peer of registry.all()) {
      const side = sideToward(selfRect, peer.rect);
      const gap = edgeGap(selfRect, peer.rect);
      const intensity = Math.max(0, 1 - gap / SKY_LINK.GLOW_RANGE_PX);
      strongest[side] = Math.max(strongest[side], intensity);
    }
    for (const [side, el] of glows) {
      el.style.setProperty("--sky-link-glow", strongest[side].toFixed(3));
      el.classList.toggle("on", strongest[side] > 0);
    }
  }

  // ── Link state ──
  // The body class flips with any live peer; the achievement event fires
  // only when the window count grows, so heartbeats stay silent.
  function refreshLinkState() {
    const windows = registry.count() + 1;
    document.body.classList.toggle("sky-linked", windows > 1);
    if (windows > linkedWindows) {
      window.dispatchEvent(
        new CustomEvent("achievement", {
          detail: { type: "sky-link", windows },
        }),
      );
    }
    linkedWindows = windows;
    refreshGlows();
  }

  function announce(now) {
    // A hidden window isn't visibly beside anything — go quiet and let the
    // peers' TTL drop this side of the link until the window is seen again.
    if (document.hidden) return;
    selfRect = viewportDesktopRect();
    const json = JSON.stringify(selfRect);
    if (json === lastSentJson && now - lastSentAt < SKY_LINK.HEARTBEAT_MS)
      return;
    lastSentJson = json;
    lastSentAt = now;
    channel.postMessage({ kind: "rect", id, rect: selfRect });
  }

  channel.onmessage = (e) => {
    const msg = e.data;
    if (!msg || msg.id === id) return;
    if (msg.kind === "rect") {
      registry.upsert(msg.id, msg.rect, Date.now());
      refreshLinkState();
    } else if (msg.kind === "bye") {
      if (registry.remove(msg.id)) refreshLinkState();
    } else if (msg.kind === "star") {
      receiveStar(msg.star);
    } else if (msg.kind === "impulse") {
      receiveImpulse(msg.point);
    }
  };

  // ── Shooting-star handoff ──
  // Outbound: the sky offers a particle that flew off-screen; accept it when
  // its heading reaches a peer viewport within the gap budget.
  setOfferHandler((exit) => {
    if (registry.count() === 0) return false;
    const origin = toDesktop(exit, selfRect);
    const target = rayTargetPeer(
      origin,
      exit.angle,
      registry.all(),
      SKY_LINK.HANDOFF_MAX_GAP_PX,
    );
    if (!target) return false;
    channel.postMessage({
      kind: "star",
      id,
      star: {
        dx: origin.x,
        dy: origin.y,
        angle: exit.angle,
        speed: exit.speed,
        len: exit.len,
        opacity: exit.opacity,
        life: exit.life,
        maxLife: exit.maxLife,
      },
    });
    window.dispatchEvent(
      new CustomEvent("achievement", {
        detail: { type: "sky-link-handoff", role: "sent" },
      }),
    );
    return true;
  });

  // Inbound: continue the arc from the exact desktop point it left the
  // sender — the hop across the physical gap between windows is invisible,
  // which is what sells the effect. No new arcs under reduced motion (the
  // same policy that gates local spawns), and none into hidden windows,
  // where the paused render loop would hold the star until the tab returns.
  function receiveStar(star) {
    if (prefersReducedMotion() || document.hidden) return;
    const local = toLocal({ x: star.dx, y: star.dy }, selfRect);
    spawnHandoff({ ...star, x: local.x, y: local.y });
    window.dispatchEvent(
      new CustomEvent("achievement", {
        detail: { type: "sky-link-handoff", role: "received" },
      }),
    );
  }

  // ── Cross-window click impulses ──
  // Local canvas clicks already announce themselves on the achievement
  // stream; forward those to peers so a click near a shared edge nudges the
  // neighbouring sky too.
  function onLocalAchievement(e) {
    const d = e.detail || {};
    if (d.type !== "click" || d.x == null || d.y == null) return;
    if (registry.count() === 0) return;
    channel.postMessage({
      kind: "impulse",
      id,
      point: toDesktop({ x: d.x, y: d.y }, selfRect),
    });
  }
  window.addEventListener("achievement", onLocalAchievement);

  function receiveImpulse(point) {
    const local = toLocal(point, selfRect);
    const reach = SKY_LINK.IMPULSE_REACH_PX;
    if (
      local.x < -reach ||
      local.x > selfRect.w + reach ||
      local.y < -reach ||
      local.y > selfRect.h + reach
    ) {
      return;
    }
    window.dispatchEvent(
      new CustomEvent("sky-link-impulse", {
        detail: {
          x: local.x,
          y: local.y,
          strength: HOLD.BLAST_BASE * SKY_LINK.IMPULSE_FACTOR,
        },
      }),
    );
  }

  setLinkProbe(() => registry.count() > 0);

  const pollTimer = setInterval(() => {
    announce(Date.now());
    if (registry.prune(Date.now())) refreshLinkState();
  }, SKY_LINK.POLL_MS);

  function onPageHide() {
    channel.postMessage({ kind: "bye", id });
  }
  window.addEventListener("pagehide", onPageHide);

  announce(Date.now());

  return function cleanup() {
    clearInterval(pollTimer);
    window.removeEventListener("achievement", onLocalAchievement);
    window.removeEventListener("pagehide", onPageHide);
    channel.postMessage({ kind: "bye", id });
    channel.close();
    setOfferHandler(null);
    setLinkProbe(null);
    for (const el of glows.values()) el.remove();
    document.body.classList.remove("sky-linked");
  };
}
