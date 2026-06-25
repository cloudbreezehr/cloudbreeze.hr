// ── Trigger Strategies ──
// Each strategy accumulates force 0→1 from user input, owns its own decay
// loop (because decay shape differs per input type), and calls the factory-
// provided `complete()` when force reaches 1.  Strategies do not know about
// wipes, body classes, or achievements — they only report force.
//
// Strategies:
//   createClickCountTrigger — N clicks on an element.
//   createHoldTrigger       — hold pointer down inside a region for N ms.
//   createKeySequenceTrigger— type a word within per-letter gap.
//   createKeyChordTrigger   — N rapid presses of one named key.
//   createOverscrollTrigger — N overscroll events at the scroll edge.
//   createConstellationTrigger — click tagged sky stars to draw a pattern.

import { bindPointer } from "../pointer.js";
import { getConstellation } from "../constellations.js";
import { mirrorYWhenInverted, getViewportHeight } from "../viewport.js";
import { getScrollY } from "../scroll-bus.js";
import { getStarsParallaxScale } from "../sky.js";
import { UI_OVERLAY_SELECTOR } from "../selectors.js";

// ── Shared decay primitive ──
// Most strategies share the same "idle decay" shape: after N ms of idle,
// force drains at getRatePerSec() per second.  The loop runs on rAF and
// self-gates on isBlocked (wipe in progress, mid-hold, etc.).
//
// Callers that want a target-relative rate (e.g. "drain at 2 clicks/sec
// against an N-click target") compute that in getRatePerSec; the helper
// doesn't know about targets.  `onDrain` optionally runs after each drain
// step so callers can react to force hitting zero.
function createIdleDecayLoop({
  getForce,
  setForce,
  getIdleMs,
  getRatePerSec,
  idleThresholdMs,
  isBlocked,
  onDrain,
}) {
  let lastTick = performance.now();
  function tick() {
    const now = performance.now();
    const dt = (now - lastTick) / 1000;
    lastTick = now;
    const f = getForce();
    if (f > 0 && !isBlocked()) {
      if (getIdleMs() > idleThresholdMs) {
        const next = Math.max(0, f - getRatePerSec() * dt);
        setForce(next);
        if (onDrain) onDrain(next);
      }
    }
    requestAnimationFrame(tick);
  }
  tick();
}

// ── Click-count trigger ──
// Each click is 1/N of the force.  After idle > timeoutMs, decay resumes at
// decayRate clicks/sec equivalent.
export function createClickCountTrigger({
  element,
  activateCount,
  deactivateCount,
  timeoutMs = 1500,
  decayRate = 2,
  preClick,
  onClick,
}) {
  // Clicks is the source of truth for completion — integer math avoids the
  // floating-point drift that would otherwise require one extra click for
  // targets whose reciprocal (1/N) isn't exactly representable (N=13, 10,
  // 15, etc.). Force is derived for display/indicators, where the accumulated
  // fraction is fine.
  let clicks = 0;
  let lastClickTime = 0;
  let ctx = null;

  function forceFor(target) {
    return Math.min(1, clicks / target);
  }

  return {
    start(_ctx) {
      ctx = _ctx;
      element.addEventListener("click", (e) => {
        // preClick fires on every click (preventDefault, scroll, etc.);
        // counting is gated by isTransitioning.
        if (preClick) preClick(e);
        if (ctx.isTransitioning()) return;
        lastClickTime = Date.now();
        const target = ctx.isActive() ? deactivateCount : activateCount;
        clicks = Math.min(target, clicks + 1);
        const force = forceFor(target);
        ctx.setForce(force);
        if (onClick) onClick(e, { force, isActive: ctx.isActive() });
        if (clicks >= target) {
          clicks = 0;
          ctx.complete();
        }
      });

      createIdleDecayLoop({
        getForce() {
          const target = ctx.isActive() ? deactivateCount : activateCount;
          return forceFor(target);
        },
        setForce(f) {
          // Decay is continuous; reverse-derive clicks from the decayed force
          // so the next real click still lands at the right level. Note that
          // clicks is a float during decay — the integer invariant only
          // applies on the click path, where Math.min(target, clicks + 1)
          // restores it.
          const target = ctx.isActive() ? deactivateCount : activateCount;
          clicks = Math.max(0, Math.min(target, f * target));
          ctx.setForce(f);
        },
        getIdleMs: () => Date.now() - lastClickTime,
        // Target-relative: one click is 1/N of the force, so "decayRate
        // clicks per second" is decayRate/N as a fraction-per-second.
        getRatePerSec() {
          const target = ctx.isActive() ? deactivateCount : activateCount;
          return decayRate / Math.max(1, target);
        },
        idleThresholdMs: timeoutMs,
        isBlocked: () => ctx.isTransitioning(),
      });
    },
  };
}

// ── Hold trigger ──
// While holding, force grows linearly to 1 over the target ms.  On release,
// force decays at a slow constant rate (not target-relative — once you let
// go, the system forgets).
export function createHoldTrigger({
  target = document,
  holdActivateMs,
  holdDeactivateMs,
  decayRate = 0.15,
  shouldAccept,
  onDown,
  onMove,
  onUp,
}) {
  let force = 0;
  let isHolding = false;
  let holdStart = 0;
  let ctx = null;

  // `onUp` must fire exactly once per hold.  Both the completion path (force
  // reaches 1) and the release path (bindPointer's pointerup) end a hold, and
  // before this guard they'd both fire — so cleanup ran twice.  The latch is
  // cleared on the next onDown.
  let onUpFired = false;
  function fireOnUpOnce() {
    if (onUpFired) return;
    onUpFired = true;
    if (onUp) onUp();
  }

  return {
    start(_ctx) {
      ctx = _ctx;
      bindPointer(target, {
        onDown(x, y, e) {
          if (ctx.isTransitioning()) return false;
          if (shouldAccept && !shouldAccept(x, y, e)) return false;
          isHolding = true;
          onUpFired = false;
          holdStart = performance.now();
          if (onDown) onDown(x, y, e);
          holdTick();
        },
        onMove(x, y) {
          if (onMove) onMove(x, y);
        },
        onUp() {
          isHolding = false;
          fireOnUpOnce();
        },
      });

      function holdTick() {
        if (!isHolding || ctx.isTransitioning()) return;
        const elapsed = performance.now() - holdStart;
        const goal = ctx.isActive() ? holdDeactivateMs : holdActivateMs;
        force = Math.min(1, elapsed / goal);
        ctx.setForce(force);
        if (force >= 1) {
          isHolding = false;
          force = 0;
          // Run hold-specific cleanup (ripple intervals, etc.) before the
          // wipe, not after the midpoint.  The physical release that
          // follows won't re-fire onUp — fireOnUpOnce latches it.
          fireOnUpOnce();
          ctx.complete();
          return;
        }
        requestAnimationFrame(holdTick);
      }

      // Release-decay loop — only decays when not holding.  "idle" here
      // means "pointer released," not elapsed time, so isBlocked carries
      // the gating and idleThresholdMs stays at 0.
      createIdleDecayLoop({
        getForce: () => force,
        setForce(f) {
          force = f;
          ctx.setForce(force);
        },
        getIdleMs: () => 1,
        getRatePerSec: () => decayRate,
        idleThresholdMs: 0,
        isBlocked: () => isHolding || ctx.isTransitioning(),
      });
    },
  };
}

// ── Key-sequence trigger ──
// Tracks parallel word prefixes; a wrong letter resets all prefixes (but the
// running force lingers until decay).  Force is max(currentPrefix/wordLength)
// across all tracked words.
const INPUT_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

function createSequenceAccumulator(words, maxGapMs) {
  const state = words.map(() => ({ idx: 0, lastLetterAt: 0 }));
  return {
    reset() {
      for (const s of state) {
        s.idx = 0;
        s.lastLetterAt = 0;
      }
    },
    // Advances a per-word prefix index on each letter; a wrong letter resets
    // *all* tracked words' prefixes.  Returns { matchForce, completed,
    // anyAdvanced } after each keystroke.
    ingest(letter, now) {
      let matchForce = 0;
      let completed = null;
      let anyAdvanced = false;
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const s = state[i];
        // Expire if gap exceeded since the last advance on this word
        if (s.idx > 0 && now - s.lastLetterAt > maxGapMs) s.idx = 0;
        const expected = word[s.idx];
        if (letter === expected) {
          s.idx++;
          s.lastLetterAt = now;
          anyAdvanced = true;
          if (s.idx >= word.length) {
            completed = word;
            s.idx = 0;
          }
        } else {
          s.idx = 0;
          // Letters may also be the first letter of this word — start fresh
          if (letter === word[0]) {
            s.idx = 1;
            s.lastLetterAt = now;
            anyAdvanced = true;
          }
        }
        const f = s.idx / word.length;
        if (f > matchForce) matchForce = f;
      }
      return { matchForce, completed, anyAdvanced };
    },
  };
}

export function createKeySequenceTrigger({
  activationWords,
  deactivationWords,
  maxGapMs = 600,
  decayTimeoutMs = 2000,
  decayRate = 0.4,
}) {
  let force = 0;
  let lastAdvanceTime = 0;
  let accumulator;
  // The isActive value the accumulator was built for. The theme can be toggled
  // by paths other than this trigger (the speller, the HUD, a programmatic
  // toggle), so swapping word-sets at our own completion isn't enough — we
  // re-derive the tracked set from the live isActive whenever it has drifted.
  let accumulatorActive;
  let ctx = null;

  function rebuildAccumulator() {
    accumulatorActive = ctx.isActive();
    accumulator = createSequenceAccumulator(
      accumulatorActive ? deactivationWords : activationWords,
      maxGapMs,
    );
  }

  return {
    start(_ctx) {
      ctx = _ctx;
      rebuildAccumulator();

      function onKeydown(e) {
        if (ctx.isTransitioning()) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const tag = document.activeElement?.tagName;
        if (tag && INPUT_TAGS.has(tag)) return;
        if (document.activeElement?.isContentEditable) return;
        // Only single-letter keys advance the sequence.  Everything else
        // (arrows, F-keys, Tab, Enter, Shift, etc.) is ignored — not counted
        // as a wrong letter — so users can hit modifiers without resetting.
        if (e.key.length !== 1) return;
        const letter = e.key.toUpperCase();
        if (letter < "A" || letter > "Z") return;

        // Resync to the current direction if the theme was toggled by another
        // path (or by our own just-completed sequence) since the last keystroke.
        if (ctx.isActive() !== accumulatorActive) rebuildAccumulator();

        const now = Date.now();
        const { matchForce, completed, anyAdvanced } = accumulator.ingest(
          letter,
          now,
        );
        // When anyAdvanced, bump force to at least the new match.
        // Otherwise the decay loop below owns force evolution.
        if (anyAdvanced) {
          lastAdvanceTime = now;
          force = Math.max(force, matchForce);
          ctx.setForce(force);
        }
        if (completed) {
          force = 0;
          ctx.complete();
          // The accumulator resyncs to the opposite direction on the next
          // keystroke once isActive has flipped (see the guard above).
        }
      }
      window.addEventListener("keydown", onKeydown);

      createIdleDecayLoop({
        getForce: () => force,
        setForce(f) {
          force = f;
          ctx.setForce(force);
        },
        getIdleMs: () => Date.now() - lastAdvanceTime,
        getRatePerSec: () => decayRate,
        idleThresholdMs: decayTimeoutMs,
        isBlocked: () => ctx.isTransitioning(),
        onDrain(next) {
          // Reset the accumulator once the running force fully drains —
          // otherwise a stale prefix could complete a word after a long idle.
          if (next === 0) accumulator.reset();
        },
      });
    },
  };
}

// ── Key-chord trigger ──
// N rapid presses of one named key (e.g. Escape × 5).  Mirrors the integer-
// count source-of-truth and target-relative decay shape of the click-count
// trigger, but listens on window keydown for the configured `key` rather
// than on a DOM element's click.
//
// preventDefault is conditional: only presses that contribute to the count
// are swallowed.  Presses rejected for any reason (modifiers, focused input,
// transitioning) propagate normally so existing handlers (Cloudlog Esc-close,
// browser dialog dismissal) keep working.
export function createKeyChordTrigger({
  key,
  activateCount,
  deactivateCount,
  timeoutMs = 1500,
  decayRate = 2,
}) {
  let presses = 0;
  let lastPressTime = 0;
  let ctx = null;

  function forceFor(target) {
    return Math.min(1, presses / target);
  }

  return {
    start(_ctx) {
      ctx = _ctx;
      function onKeydown(e) {
        if (e.key !== key) return;
        if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
        const tag = document.activeElement?.tagName;
        if (tag && INPUT_TAGS.has(tag)) return;
        if (document.activeElement?.isContentEditable) return;
        if (ctx.isTransitioning()) return;
        // Only swallow the press if we're actually counting it — otherwise
        // existing Escape consumers (panel close, etc.) keep working.
        e.preventDefault();
        lastPressTime = Date.now();
        const target = ctx.isActive() ? deactivateCount : activateCount;
        presses = Math.min(target, presses + 1);
        ctx.setForce(forceFor(target));
        if (presses >= target) {
          presses = 0;
          ctx.complete();
        }
      }
      window.addEventListener("keydown", onKeydown);

      createIdleDecayLoop({
        getForce() {
          const target = ctx.isActive() ? deactivateCount : activateCount;
          return forceFor(target);
        },
        setForce(f) {
          // Decay is continuous; reverse-derive presses so the next real
          // press still lands at the right level. Press count is a float
          // during decay — the integer invariant only applies on the
          // press path, where Math.min(target, presses + 1) restores it.
          const target = ctx.isActive() ? deactivateCount : activateCount;
          presses = Math.max(0, Math.min(target, f * target));
          ctx.setForce(f);
        },
        getIdleMs: () => Date.now() - lastPressTime,
        // Target-relative: one press is 1/N of the force, so "decayRate
        // presses per second" is decayRate/N as a fraction-per-second.
        getRatePerSec() {
          const target = ctx.isActive() ? deactivateCount : activateCount;
          return decayRate / Math.max(1, target);
        },
        idleThresholdMs: timeoutMs,
        isBlocked: () => ctx.isTransitioning(),
      });
    },
  };
}

// ── Constellation trigger ──
// Force = uniqueTaggedHits / N, where N is the length of the constellation
// locked on the first hit.  Captures the document click before the canvas
// bubble-phase handler so fury / click-burst skip for star hits; a click
// achievement event is re-dispatched with intercepted: true so milestone
// counts still tally.

function readScrollProgress() {
  // Same viewport-height source as the canvas renderer's scrollProgress,
  // so the trigger's sp tracks the renderer's even when the mobile URL
  // bar shows/hides (otherwise hit-tests land off their stars).
  const scrollY = getScrollY();
  const maxScroll = document.documentElement.scrollHeight - getViewportHeight();
  return maxScroll > 0 ? Math.min(1, Math.max(0, scrollY / maxScroll)) : 0;
}

export function createConstellationTrigger({
  getStars,
  getCanvas,
  hitRadius,
  onChainChange,
  onWrongHit,
  onCorrectHit,
}) {
  let chain = [];
  let candidateId = null;
  let activatedConstellationId = null;
  let ctx = null;

  function target() {
    const id = ctx.isActive() ? activatedConstellationId : candidateId;
    const c = id ? getConstellation(id) : null;
    return c ? c.points.length : 0;
  }

  function emit() {
    if (onChainChange)
      onChainChange({
        chain: chain.slice(),
        candidateId: ctx.isActive() ? activatedConstellationId : candidateId,
        isActive: ctx.isActive(),
      });
  }

  function refreshForce() {
    const t = target();
    if (t === 0) {
      ctx.setForce(0);
      return;
    }
    if (ctx.isActive()) {
      const removed = t - chain.length;
      const f = removed / t;
      ctx.setForce(f);
      if (chain.length === 0) {
        const completedId = activatedConstellationId;
        activatedConstellationId = null;
        candidateId = null;
        ctx.complete({ constellationId: completedId });
      }
    } else {
      const f = chain.length / t;
      ctx.setForce(f);
      if (chain.length === t) {
        const completedId = candidateId;
        activatedConstellationId = completedId;
        candidateId = null;
        ctx.complete({ constellationId: completedId });
      }
    }
  }

  function hitTest(cx, cy) {
    const stars = getStars();
    const canvas = getCanvas();
    if (!stars || !canvas) return null;
    const sp = readScrollProgress();
    const parallaxScale = getStarsParallaxScale();
    let best = null;
    let bestDistSq = hitRadius * hitRadius;
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      if (!s.constellationId) continue;
      const shift = s.depth * sp * canvas.height * parallaxScale;
      const sx = s.x % canvas.width;
      const py =
        (((s.y - shift) % canvas.height) + canvas.height) % canvas.height;
      const dx = cx - sx;
      const dy = cy - py;
      const distSq = dx * dx + dy * dy;
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        best = { star: s, index: i };
      }
    }
    return best;
  }

  function onClick(e) {
    if (ctx.isTransitioning()) return;
    if (e.target.closest(UI_OVERLAY_SELECTOR)) return;
    const canvas = getCanvas();
    if (!canvas) return;
    const cx = e.clientX;
    const cy = mirrorYWhenInverted(e.clientY, canvas.height);
    const hit = hitTest(cx, cy);
    if (!hit) return;
    const locked = ctx.isActive() ? activatedConstellationId : candidateId;
    const isOwnConstellation =
      locked === null || hit.star.constellationId === locked;
    if (!isOwnConstellation) {
      if (onWrongHit) onWrongHit({ star: hit.star });
      return;
    }
    e.stopPropagation();
    window.dispatchEvent(
      new CustomEvent("achievement", {
        detail: {
          type: "click",
          x: e.clientX,
          y: e.clientY,
          intercepted: true,
        },
      }),
    );

    const existing = chain.findIndex((c) => c.index === hit.index);
    if (ctx.isActive()) {
      // Deactivation shrinks the persistent chain; readding is forbidden
      // (re-completing re-enters via the activation path).
      if (existing >= 0) chain.splice(existing, 1);
    } else if (existing >= 0) {
      chain.splice(existing, 1);
      if (chain.length === 0) candidateId = null;
    } else {
      if (candidateId === null) candidateId = hit.star.constellationId;
      chain.push({ index: hit.index });
    }
    if (onCorrectHit) {
      onCorrectHit({
        star: hit.star,
        constellationId: hit.star.constellationId,
        chainLength: chain.length,
      });
    }
    emit();
    refreshForce();
  }

  return {
    start(_ctx) {
      ctx = _ctx;
      document.addEventListener("click", onClick, true);
    },
    stop() {
      document.removeEventListener("click", onClick, true);
    },
    /** Drop chain + locked ids and notify visualization layers.  Used by
     *  the theme's onDeactivate hook so an external toggle (HUD button,
     *  programmatic `toggleTheme`) leaves the trigger in the same clean
     *  state a full gesture-based deactivation would. */
    reset() {
      chain = [];
      candidateId = null;
      activatedConstellationId = null;
      emit();
    },
    /** Snapshot of current chain for visualization layers. */
    getState() {
      return {
        chain: chain.slice(),
        candidateId:
          ctx && ctx.isActive() ? activatedConstellationId : candidateId,
        isActive: ctx ? ctx.isActive() : false,
      };
    },
  };
}

// ── Overscroll trigger ──
// Wheel or touch-drag past the scroll boundary accumulates force.
// Cooldown ensures one trackpad swipe counts as one hit, not dozens.
// Accepts predicates for edge detection and force-per-hit (callers can
// e.g. apply a multiplier to one direction).  Calls `onHit` on each
// accepted hit so the theme can trigger warnings / track direction.
export function createOverscrollTrigger({
  forcePerHit,
  cooldownMs,
  edgeTolerance,
  touchDragThreshold,
  returnMultiplier = 1,
  canComplete,
  onHit,
  drainFn,
  fpsBaselineMs = 16.667,
}) {
  let force = 0;
  let lastHitTime = 0;
  let ctx = null;

  function acceptHit(direction) {
    const now = Date.now();
    if (now - lastHitTime < cooldownMs) return;
    lastHitTime = now;
    const bump = ctx.isActive() ? forcePerHit * returnMultiplier : forcePerHit;
    force = Math.min(1, force + bump);
    ctx.setForce(force);
    if (onHit) onHit({ force, direction, isActive: ctx.isActive() });
    if (force >= 1 && (!canComplete || canComplete({ force, direction }))) {
      force = 0;
      ctx.complete({ direction });
    }
  }

  return {
    start(_ctx) {
      ctx = _ctx;

      // Optional drain loop — callers supply drainFn for non-linear
      // drain shapes (e.g. fast at low force, slow at high force).
      if (drainFn) {
        let lastTick = performance.now();
        function drainTick() {
          const now = performance.now();
          const dt = (now - lastTick) / fpsBaselineMs;
          lastTick = now;
          if (force > 0 && !ctx.isTransitioning()) {
            const next = drainFn(force, dt, ctx.isActive());
            if (next !== force) {
              force = Math.max(0, Math.min(1, next));
              ctx.setForce(force);
            }
          }
          requestAnimationFrame(drainTick);
        }
        drainTick();
      }

      window.addEventListener(
        "wheel",
        (e) => {
          if (ctx.isTransitioning()) return;
          const scrollTop = window.scrollY;
          const maxScroll =
            document.documentElement.scrollHeight - window.innerHeight;
          const atBottom =
            scrollTop >= maxScroll - edgeTolerance && e.deltaY > 0;
          const atTop = scrollTop <= edgeTolerance && e.deltaY < 0;
          const atEdge = ctx.isActive() ? atBottom || atTop : atBottom;
          if (atEdge) acceptHit(atBottom ? "bottom" : "top");
        },
        { passive: true },
      );

      // Touch fallback — accumulate drag distance past the bottom edge only
      // (avoids conflicting with pull-to-refresh at the top).
      let touchStartY = 0;
      let touchAccum = 0;
      function resetTouch() {
        touchStartY = 0;
        touchAccum = 0;
      }
      window.addEventListener(
        "touchstart",
        (e) => {
          touchStartY = e.touches[0].clientY;
          touchAccum = 0;
        },
        { passive: true },
      );
      window.addEventListener(
        "touchmove",
        (e) => {
          if (ctx.isTransitioning()) return;
          const scrollTop = window.scrollY;
          const maxScroll =
            document.documentElement.scrollHeight - window.innerHeight;
          const atBottom = scrollTop >= maxScroll - edgeTolerance;
          if (!atBottom) {
            touchAccum = 0;
            return;
          }
          const touchY = e.touches[0].clientY;
          const delta = touchStartY - touchY;
          if (delta <= 0) {
            touchAccum = 0;
            return;
          }
          touchAccum += delta;
          touchStartY = touchY;
          if (touchAccum > touchDragThreshold) {
            touchAccum = 0;
            acceptHit("bottom");
          }
        },
        { passive: true },
      );
      // Drop in-flight accumulation on lift or interruption — otherwise a
      // half-finished swipe carries its progress into the next gesture and
      // can fire the trigger from a single subsequent move.
      window.addEventListener("touchend", resetTouch, { passive: true });
      window.addEventListener("touchcancel", resetTouch, { passive: true });
    },
  };
}
