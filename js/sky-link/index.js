// ── Sky Link ──
// Links every open window of the site on the same machine into one
// continuous sky. Windows announce their desktop-space viewport rects over a
// BroadcastChannel; while at least one peer is fresh, the body carries
// `sky-linked`, the edges facing peer windows glow, the renderer sees the
// live peer rects through the seam and anchors the shared sky to the
// desktop, pointer states stream between windows so a neighbour's cursor
// acts on this sky as a live force source, and clicks and gravity-well blasts
// mirror across into neighbouring viewports as both force and visible burst.
//
// Everything is desktop-coordinate math from peers.js; this module owns the
// transport (channel, heartbeats, expiry) and the DOM touchpoints (body
// class, glows, events). Browsers without BroadcastChannel simply never
// link — the site behaves as a solo window.

import {
  createPeerRegistry,
  toDesktop,
  toLocal,
  sideToward,
  edgeGap,
} from "./peers.js";
import { viewportDesktopRect } from "../world/space.js";
import { createRemotePointerRegistry } from "./pointers.js";
import {
  setPeerRectsSource,
  setRemotePointersSource,
  localPointerState,
} from "./seam.js";
import { HOLD } from "../interactions.js";
import { hasCapability } from "../device.js";
import { skySeedKey } from "../daily/random.js";
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
  EFFECT_REACH_PX: {
    value: 600,
    min: 0,
    max: 2000,
    step: 25,
    description:
      "How far beyond a peer's viewport a mirrored effect still reaches (px)",
  },
  EFFECT_FORCE_FACTOR: {
    value: 0.7,
    min: 0,
    max: 2,
    step: 0.05,
    description: "Mirrored effect's push strength relative to the original",
  },
  GLOW_RANGE_PX: {
    value: 900,
    min: 100,
    max: 3000,
    step: 50,
    description: "Peer distance at which the facing-edge glow fades to zero",
  },
  POINTER_SEND_MS: {
    value: 50,
    min: 16,
    max: 500,
    step: 2,
    description: "Interval between pointer-state broadcasts while linked (ms)",
  },
  POINTER_TTL_MS: {
    value: 1800,
    min: 300,
    max: 6000,
    step: 100,
    description:
      "Pointer silence before its force and ghost drop — tighter than the rect TTL so a lost cursor stops acting fast (ms)",
  },
});

// Interaction ramps arrive as continuous floats; quantizing them keeps the
// dedup check from treating every frame's imperceptible drift as news.
const POINTER_QUANTIZE = 100;

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
  const pointers = createRemotePointerRegistry(SKY_LINK.POINTER_TTL_MS);

  let selfRect = viewportDesktopRect();
  let lastSentJson = "";
  let lastSentAt = 0;
  let lastPointerJson = "";
  let lastPointerAt = 0;
  let lastPointerEngaged = false;
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
    channel.postMessage({
      kind: "rect",
      id,
      seed: skySeedKey(),
      rect: selfRect,
    });
  }

  // ── Pointer broadcast ──
  // The renderer's pointer state, sampled on its own cadence and shipped in
  // desktop coordinates so peers fold it in as a force source wherever
  // their viewport sits. A captured drag keeps streaming even when the
  // cursor is physically over a neighbouring window — that's the moment
  // the whole feature exists for.
  function announcePointer(now) {
    if (document.hidden || registry.count() === 0) return;
    const state = localPointerState();
    if (!state) return;
    const engaged = state.active || state.isDragging;
    const pt = toDesktop({ x: state.x, y: state.y }, selfRect);
    const pointer = {
      x: Math.round(pt.x),
      y: Math.round(pt.y),
      active: engaged,
      isDragging: !!state.isDragging,
      holdStrength:
        Math.round(state.holdStrength * POINTER_QUANTIZE) / POINTER_QUANTIZE,
      wellStrength:
        Math.round(state.wellStrength * POINTER_QUANTIZE) / POINTER_QUANTIZE,
    };
    // An idle pointer needs no heartbeat — one inactive message drops it
    // from every peer, then this side goes quiet until re-engaged.
    if (!engaged && !lastPointerEngaged) return;
    const json = JSON.stringify(pointer);
    if (json === lastPointerJson && now - lastPointerAt < SKY_LINK.HEARTBEAT_MS)
      return;
    lastPointerJson = json;
    lastPointerAt = now;
    lastPointerEngaged = engaged;
    channel.postMessage({ kind: "pointer", id, pointer });
  }

  function receivePointer(peerId, pointer) {
    // Only pointers of linked windows exert force — the rect handshake
    // (same seed, fresh TTL) is what admits a peer to the registry.
    if (!registry.has(peerId)) return;
    if (!pointer.active) {
      pointers.remove(peerId);
      return;
    }
    pointers.upsert(peerId, pointer, Date.now());
  }

  channel.onmessage = (e) => {
    const msg = e.data;
    if (!msg || msg.id === id) return;
    if (msg.kind === "rect") {
      // One world needs one arrangement: a window on a different sky —
      // time-traveling via #sky=, or left open past midnight — never
      // links, it just coexists.
      if (msg.seed !== skySeedKey()) return;
      registry.upsert(msg.id, msg.rect, Date.now());
      refreshLinkState();
    } else if (msg.kind === "pointer") {
      receivePointer(msg.id, msg.pointer);
    } else if (msg.kind === "bye") {
      pointers.remove(msg.id);
      if (registry.remove(msg.id)) refreshLinkState();
    } else if (msg.kind === "effect") {
      receiveEffect(msg);
    }
  };

  // ── Cross-window effect mirroring ──
  // A local click or gravity-well release dispatches `sky-effect` in true
  // viewport coordinates; forward it to peers in desktop space so the effect
  // lands in every window whose viewport it reaches — carried as both the push
  // and its visible burst, not just a weakened nudge.
  function onLocalEffect(e) {
    const d = e.detail || {};
    if (d.x == null || d.y == null) return;
    if (registry.count() === 0) return;
    channel.postMessage({
      kind: "effect",
      id,
      point: toDesktop({ x: d.x, y: d.y }, selfRect),
      strength: d.strength,
      well: d.well || 0,
    });
  }
  window.addEventListener("sky-effect", onLocalEffect);

  function receiveEffect(msg) {
    const local = toLocal(msg.point, selfRect);
    const reach = SKY_LINK.EFFECT_REACH_PX;
    if (
      local.x < -reach ||
      local.x > selfRect.w + reach ||
      local.y < -reach ||
      local.y > selfRect.h + reach
    ) {
      return;
    }
    window.dispatchEvent(
      new CustomEvent("sky-link-effect", {
        detail: {
          x: local.x,
          y: local.y,
          strength:
            (msg.strength ?? HOLD.BLAST_BASE) * SKY_LINK.EFFECT_FORCE_FACTOR,
          well: msg.well || 0,
        },
      }),
    );
  }

  setPeerRectsSource(() => registry.all().map((peer) => peer.rect));
  setRemotePointersSource(() =>
    pointers.all().map((ptr) => {
      const local = toLocal(ptr, selfRect);
      return {
        id: ptr.id,
        x: local.x,
        y: local.y,
        active: ptr.active,
        isDragging: ptr.isDragging,
        holdStrength: ptr.holdStrength,
        wellStrength: ptr.wellStrength,
        seenAt: ptr.seenAt,
      };
    }),
  );

  const pollTimer = setInterval(() => {
    announce(Date.now());
    if (registry.prune(Date.now())) refreshLinkState();
    pointers.prune(Date.now());
  }, SKY_LINK.POLL_MS);

  const pointerTimer = setInterval(
    () => announcePointer(Date.now()),
    SKY_LINK.POINTER_SEND_MS,
  );

  function onPageHide() {
    channel.postMessage({ kind: "bye", id });
  }
  window.addEventListener("pagehide", onPageHide);

  announce(Date.now());

  return function cleanup() {
    clearInterval(pollTimer);
    clearInterval(pointerTimer);
    window.removeEventListener("sky-effect", onLocalEffect);
    window.removeEventListener("pagehide", onPageHide);
    channel.postMessage({ kind: "bye", id });
    channel.close();
    setPeerRectsSource(null);
    setRemotePointersSource(null);
    for (const el of glows.values()) el.remove();
    document.body.classList.remove("sky-linked");
  };
}
