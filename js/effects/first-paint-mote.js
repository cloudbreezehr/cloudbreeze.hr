// ── First-Paint Mote ──
// Per-tab affordance: on the first cursor movement of a fresh tab,
// summon a single drifting glow at the cursor that fades over a short
// lifetime.  The visitor learns "the canvas responds to me" without
// giving away any of the discovery arc — just a tiny "oh, neat"
// moment.  Gated by sessionStorage so refresh = silent, new tab =
// fresh mote.

import { defineConstants } from "../dev/registry.js";
import { reducedDuration, prefersReducedMotion } from "../motion.js";

const SESSION_FLAG_KEY = "first-paint-mote-shown";

export const MOTE = defineConstants("onboarding.firstPaintMote", {
  SIZE_PX: { value: 8, min: 2, max: 32, step: 1 },
  DRIFT_PX: { value: 28, min: 0, max: 120, step: 1 },
  FADE_MS: { value: 4000, min: 200, max: 20000, step: 100 },
  ARM_DELAY_MS: { value: 200, min: 0, max: 2000, step: 50 },
  POINTER_DEAD_ZONE_PX: { value: 24, min: 0, max: 200, step: 1 },
});

export function initFirstPaintMote() {
  // Onboarding mote is a one-shot motion cue — skip entirely for
  // users who opted out of animation rather than rendering a near-
  // instant flash via the duration clamp.
  if (prefersReducedMotion()) return;

  let shown;
  try {
    shown = !!window.sessionStorage.getItem(SESSION_FLAG_KEY);
  } catch {
    return;
  }
  if (shown) return;

  // Defer arming briefly so the affordance doesn't fire on whatever
  // pointer position the page happens to inherit at load time.
  let armed = false;
  setTimeout(() => {
    armed = true;
  }, MOTE.ARM_DELAY_MS);

  let firstPointer = null;

  function onPointerMove(e) {
    if (!armed) return;
    if (!firstPointer) {
      firstPointer = { x: e.clientX, y: e.clientY };
      return;
    }
    const dx = e.clientX - firstPointer.x;
    const dy = e.clientY - firstPointer.y;
    if (
      dx * dx + dy * dy <
      MOTE.POINTER_DEAD_ZONE_PX * MOTE.POINTER_DEAD_ZONE_PX
    ) {
      return;
    }
    fire(e.clientX, e.clientY);
  }

  function fire(x, y) {
    window.removeEventListener("pointermove", onPointerMove);
    try {
      window.sessionStorage.setItem(SESSION_FLAG_KEY, "1");
    } catch {
      // Cosmetic fallback — proceed without the gate; worst case, the
      // affordance shows again on the next interaction this tab.
    }
    spawnMote(x, y);
  }

  window.addEventListener("pointermove", onPointerMove, { passive: true });
}

function spawnMote(x, y) {
  const el = document.createElement("div");
  el.className = "first-paint-mote";
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.width = `${MOTE.SIZE_PX}px`;
  el.style.height = `${MOTE.SIZE_PX}px`;
  document.body.appendChild(el);

  const driftAngle = Math.random() * Math.PI * 2;
  const driftX = Math.cos(driftAngle) * MOTE.DRIFT_PX;
  const driftY = Math.sin(driftAngle) * MOTE.DRIFT_PX;

  const anim = el.animate(
    [
      {
        transform: "translate(-50%, -50%) scale(0.4)",
        opacity: 0,
      },
      {
        transform: "translate(-50%, -50%) scale(1)",
        opacity: 1,
        offset: 0.2,
      },
      {
        transform: `translate(calc(-50% + ${driftX}px), calc(-50% + ${driftY}px)) scale(0.6)`,
        opacity: 0,
      },
    ],
    {
      duration: reducedDuration(MOTE.FADE_MS),
      easing: "ease-out",
    },
  );

  anim.onfinish = () => el.remove();
}

// Test hook — clear the session flag so a follow-up init arms again.
export function _resetForTests() {
  try {
    window.sessionStorage.removeItem(SESSION_FLAG_KEY);
  } catch {
    // ignore — sessionStorage may be unavailable
  }
}
