// ── Trigger Strategies ──
// Each strategy accumulates force 0→1 from user input, owns its own decay
// loop (because decay shape differs per input type), and calls the factory-
// provided `complete()` when force reaches 1.  Strategies do not know about
// wipes, body classes, or achievements — they only report force.
//
// Strategies:
//   createClickCountTrigger — N clicks on an element (frozen, rainy, blocky).
//   createHoldTrigger       — hold pointer down inside a region for N ms (deep-sea).
//   createKeySequenceTrigger— type a word within per-letter gap (paper).
//   createOverscrollTrigger — N overscroll events at the scroll edge (upside-down).

import { bindPointer } from "../pointer.js";

// ── Shared decay primitive ──
// Most strategies share the same "idle decay" shape: after N ms of no input,
// force drains at R per second relative to an activation target.  The
// decay loop runs on rAF and self-gates on isActive/isTransitioning.
function createDecayLoop(getForce, setForce, getTargetSize, getIdleMs, {
  idleThresholdMs,
  ratePerSec,
  isBlocked,
}) {
  let lastTick = performance.now();
  function tick() {
    const now = performance.now();
    const dt = (now - lastTick) / 1000;
    lastTick = now;
    const f = getForce();
    if (f > 0 && !isBlocked()) {
      const idleMs = getIdleMs();
      if (idleMs > idleThresholdMs) {
        const targetSize = Math.max(1, getTargetSize());
        const decay = (ratePerSec / targetSize) * dt;
        setForce(Math.max(0, f - decay));
      }
    }
    requestAnimationFrame(tick);
  }
  tick();
}

// ── Click-count trigger ──
// Used by frozen (logo, 25/13), rainy (hero-tag, 15/8), blocky (toggle, 20/10).
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
  let force = 0;
  let lastClickTime = 0;
  let ctx = null;

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
        force = Math.min(1, force + 1 / target);
        ctx.setForce(force);
        if (onClick) onClick(e, { force, isActive: ctx.isActive() });
        if (force >= 1) {
          force = 0;
          ctx.complete();
        }
      });

      createDecayLoop(
        () => force,
        (f) => {
          force = f;
          ctx.setForce(force);
        },
        () => (ctx.isActive() ? deactivateCount : activateCount),
        () => Date.now() - lastClickTime,
        {
          idleThresholdMs: timeoutMs,
          ratePerSec: decayRate,
          isBlocked: () => ctx.isTransitioning(),
        },
      );
    },
  };
}

// ── Hold trigger ──
// Used by deep-sea (hold inside footer, 10s/5s).  While holding, force grows
// linearly to 1 over the target ms.  On release, force decays at a slow
// constant rate (not target-relative — once you let go, the system forgets).
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

      // Release-decay loop — only decays when not holding
      let lastTick = performance.now();
      function decayTick() {
        const now = performance.now();
        const dt = (now - lastTick) / 1000;
        lastTick = now;
        if (!isHolding && force > 0 && !ctx.isTransitioning()) {
          force = Math.max(0, force - decayRate * dt);
          ctx.setForce(force);
        }
        requestAnimationFrame(decayTick);
      }
      decayTick();
    },
  };
}

// ── Key-sequence trigger ──
// Used by paper (SKETCH/DRAW → ERASE).  Tracks parallel word prefixes; a wrong
// letter resets all prefixes (but the running force lingers until decay).
// Force is max(currentPrefix/wordLength) across all tracked words.
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
  let ctx = null;

  return {
    start(_ctx) {
      ctx = _ctx;
      accumulator = createSequenceAccumulator(activationWords, maxGapMs);

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
          // Swap tracked words for the opposite direction
          accumulator = createSequenceAccumulator(
            ctx.isActive() ? activationWords : deactivationWords,
            maxGapMs,
          );
        }
      }
      window.addEventListener("keydown", onKeydown);

      let lastTick = performance.now();
      function tick() {
        const now = performance.now();
        const dt = (now - lastTick) / 1000;
        lastTick = now;
        if (force > 0 && !ctx.isTransitioning()) {
          const idle = Date.now() - lastAdvanceTime;
          if (idle > decayTimeoutMs) {
            force = Math.max(0, force - decayRate * dt);
            ctx.setForce(force);
            if (force === 0) accumulator.reset();
          }
        }
        requestAnimationFrame(tick);
      }
      tick();
    },
  };
}

// ── Overscroll trigger ──
// Used by upside-down: wheel or touch-drag past the scroll boundary accumulates
// force. Cooldown ensures one trackpad swipe counts as one hit, not dozens.
// Accepts predicates for edge detection and force-per-hit (upside-down's
// deactivation path uses a 2x multiplier).  Calls `onHit` on each accepted
// hit so the mode can trigger warnings / track direction.
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

      // Optional drain loop — used by upside-down for its dynamic drain
      // shape (fast at low force, slow at high force).
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
    },
  };
}
