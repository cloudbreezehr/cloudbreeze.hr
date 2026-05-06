// ── Mode Factory ──
// Every sub-mode shares the same skeleton: a force 0→1 accumulator, progressive
// indicators scaled by that force, a wipe transition at 1.0, a body-class
// toggle + achievement dispatch at the midpoint, and a reverse path. The only
// thing that varies is the input shape — clicks, holds, overscroll, key
// sequences. This file extracts everything except that input shape.
//
// A mode file calls `createMode({ id, trigger, indicators, wipe, onActivate,
// onDeactivate })` and gets back nothing — the factory wires everything up
// (listeners, RAF loops, wipe playback, achievement events, toggle
// registration).
//
// Trigger strategies are small objects: `{ start({setForce, complete, isActive}) }`.
// They own their own decay loop because decay shape is input-specific
// (a key-sequence timeout differs from a hold's continuous progress).
//
// The wipe variation point accepts either a playWipe config (for the common
// opacity-sweep case) or a custom async function (for upside-down's
// translateY slide, which persists past the midpoint).  A custom wipe may
// return a Promise; the factory awaits it to release `isTransitioning`, and
// logs any rejection so a broken wipe is observable instead of silent.
//
// `createMode` returns a live `ctx` — `{ force, isActive }` as getters — so
// callers that run their own animation loops (blocky's jitter, paper's
// scroll page-turn) can read current state without duplicating it locally.
//
// See createClickCountTrigger / createHoldTrigger / createKeySequenceTrigger /
// createOverscrollTrigger for strategies.

import { playWipe } from "../effects/wipe.js";
import { registerToggle } from "./registry.js";

/**
 * @typedef {Object} ModeCtx
 * @property {number}  force     Current force (0–1). Live getter.
 * @property {boolean} isActive  Whether the mode is currently active. Live getter.
 */

/**
 * @typedef {Object} Indicator
 * @property {number} threshold  Force level at which this stage begins.
 * @property {(force: number, ctx: ModeCtx) => void} apply
 *   Called every force update. Must cleanly reset itself below threshold.
 *   `ctx.isActive` is true while buildup runs toward deactivation, false
 *   during buildup toward activation — use it to pick direction-dependent
 *   colors (e.g. thaw-warm vs freeze-cool).
 * @property {() => void} [clear]
 *   Optional: called on activation/deactivation midpoint to force-reset.
 */

/**
 * @typedef {Object} WipeConfig
 * @property {string}  className         CSS class(es) for playWipe.
 * @property {string}  [reverseModifier] Extra class appended for deactivation.
 * @property {number}  coverMs
 * @property {number}  revealMs
 */

/**
 * @typedef {Object} Trigger
 * @property {(tctx: {setForce:(f:number)=>void, complete:(payload?:any)=>void, isActive:()=>boolean, isTransitioning:()=>boolean}) => void} start
 */

/**
 * @typedef {Object} ModeDefinition
 * @property {string} id
 * @property {Trigger} trigger
 * @property {Indicator[]} indicators
 * @property {WipeConfig | ((opts: {activating:boolean, runMidpoint:()=>void, payload:any}) => Promise<void>|void)} wipe
 * @property {(hookCtx: {payload: any}) => void} [onActivate]
 * @property {(hookCtx: {payload: any}) => void} [onDeactivate]
 */

/**
 * Create and wire up a sub-mode.
 * @param {ModeDefinition} def
 * @returns {ModeCtx} Live ctx (getter-backed) for callers that need ongoing
 *   read access to force/isActive outside the indicator call path.
 */
export function createMode(def) {
  const { id, trigger, indicators, wipe, onActivate, onDeactivate } = def;

  let force = 0;
  let isActive = false;
  let isTransitioning = false;

  // Live ctx.  Getter-backed so callers that capture this object see current
  // values on every read — not a snapshot taken at capture time.
  const ctx = Object.freeze({
    get force() {
      return force;
    },
    get isActive() {
      return isActive;
    },
  });

  function applyIndicators() {
    for (const ind of indicators) {
      ind.apply(force, ctx);
    }
  }

  function clearIndicators() {
    force = 0;
    for (const ind of indicators) {
      if (ind.clear) ind.clear();
      else ind.apply(0, ctx);
    }
  }

  function setForce(f) {
    if (isTransitioning) return;
    force = Math.max(0, Math.min(1, f));
    applyIndicators();
  }

  function runMidpoint(activating, payload) {
    isActive = activating;
    document.body.classList.toggle(id, activating);
    if (activating) document.body.dataset.lastSubmode = id;
    // `silent` marks this as a programmatic toggle (HUD click) so the
    // tracker can skip the exit-achievement unlock on deactivation.
    // The event still fires so other listeners (HUD state) stay in sync.
    window.dispatchEvent(
      new CustomEvent("achievement", {
        detail: {
          type: activating ? "mode-activate" : "mode-deactivate",
          mode: id,
          silent: !!(payload && payload.silent),
        },
      }),
    );
    clearIndicators();
    const hook = activating ? onActivate : onDeactivate;
    if (hook) hook({ payload });
  }

  function complete(payload) {
    if (isTransitioning) return;
    isTransitioning = true;
    const activating = !isActive;

    if (typeof wipe === "function") {
      const result = wipe({
        activating,
        runMidpoint: () => runMidpoint(activating, payload),
        payload,
      });
      Promise.resolve(result)
        .catch((err) => {
          console.error(`[${id}] wipe failed:`, err);
        })
        .finally(() => {
          isTransitioning = false;
        });
      return;
    }

    const className =
      wipe.className +
      (!activating && wipe.reverseModifier ? " " + wipe.reverseModifier : "");
    playWipe({
      className,
      coverMs: wipe.coverMs,
      revealMs: wipe.revealMs,
      onMidpoint() {
        runMidpoint(activating, payload);
      },
      onComplete() {
        isTransitioning = false;
      },
    });
  }

  trigger.start({
    setForce,
    complete,
    isActive: () => isActive,
    isTransitioning: () => isTransitioning,
  });

  registerToggle(id, (opts) => complete(opts));

  return ctx;
}
