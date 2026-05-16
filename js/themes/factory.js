// ── Theme Factory ──
// Every theme shares the same skeleton: a force 0→1 accumulator, progressive
// indicators scaled by that force, a wipe transition at 1.0, a body-class
// toggle + achievement dispatch at the midpoint, and a reverse path. The only
// thing that varies is the input shape — clicks, holds, overscroll, key
// sequences — which is supplied as a `trigger` strategy.
//
// A theme file calls `createTheme({ id, trigger, indicators, wipe, onActivate,
// onDeactivate })` and gets back a live `ctx` exposing `{ force, isActive }`
// as getters, so callers that run their own animation loops can read current
// state without duplicating it. The factory wires everything up (listeners,
// RAF loops, wipe playback, achievement events, toggle registration).
//
// Trigger strategies are small objects: `{ start({setForce, complete, isActive}) }`.
// They own their own decay loop because decay shape is input-specific
// (a key-sequence timeout differs from a hold's continuous progress).
//
// The wipe slot accepts either a playWipe config (the common opacity-sweep
// case) or a custom async function for wipes whose effect persists past the
// midpoint.  A custom wipe may return a Promise; the factory awaits it to
// release `isTransitioning`, and logs any rejection so a broken wipe is
// observable instead of silent.
//
// `createTheme` returns a live `ctx` — `{ force, isActive }` as getters — so
// callers that run their own animation loops can read current state without
// duplicating it locally.

import { playWipe } from "../effects/wipe.js";
import { registerToggle } from "./registry.js";

/**
 * @typedef {Object} ThemeCtx
 * @property {number}  force     Current force (0–1). Live getter.
 * @property {boolean} isActive  Whether the theme is currently active. Live getter.
 */

/**
 * @typedef {Object} Indicator
 * @property {number} threshold  Force level at which this stage begins.
 * @property {(force: number, ctx: ThemeCtx) => void} apply
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
 * @typedef {Object} ThemeDefinition
 * @property {string} id
 * @property {Trigger} trigger
 * @property {Indicator[]} indicators
 * @property {WipeConfig | ((opts: {activating:boolean, runMidpoint:()=>void, payload:any}) => Promise<void>|void)} wipe
 * @property {(hookCtx: {payload: any}) => void} [onActivate]
 * @property {(hookCtx: {payload: any}) => void} [onDeactivate]
 */

/**
 * Create and wire up a theme.
 * @param {ThemeDefinition} def
 * @returns {ThemeCtx} Live ctx (getter-backed) for callers that need ongoing
 *   read access to force/isActive outside the indicator call path.
 */
export function createTheme(def) {
  const { id, trigger, indicators, wipe, onActivate, onDeactivate } = def;

  let force = 0;
  let isActive = false;
  let isTransitioning = false;

  // ── Buildup telemetry ──
  // Emit `theme-buildup` when force crosses each threshold (once per
  // phase per theme per session), and `theme-abandoned` when a partial
  // buildup decays back to zero without completing.  Together they let
  // listeners see how close a user got to triggering a theme even when
  // they bail out.
  const BUILDUP_THRESHOLDS = [0.25, 0.5, 0.75];
  let lastEmittedThreshold = 0;
  let peakForce = 0;
  let buildupStartedAt = 0;

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
    const prev = force;
    force = Math.max(0, Math.min(1, f));
    applyIndicators();

    const phase = isActive ? "deactivate" : "activate";
    if (prev === 0 && force > 0) buildupStartedAt = Date.now();
    if (force > peakForce) peakForce = force;

    for (const t of BUILDUP_THRESHOLDS) {
      if (prev < t && force >= t && lastEmittedThreshold < t) {
        lastEmittedThreshold = t;
        window.dispatchEvent(
          new CustomEvent("achievement", {
            detail: {
              type: "theme-buildup",
              theme: id,
              threshold: t,
              phase,
              peakForce,
            },
          }),
        );
      }
    }

    if (force === 0 && peakForce >= BUILDUP_THRESHOLDS[0]) {
      window.dispatchEvent(
        new CustomEvent("achievement", {
          detail: {
            type: "theme-abandoned",
            theme: id,
            peakForce,
            phase,
            buildupDurationMs: Date.now() - buildupStartedAt,
          },
        }),
      );
      peakForce = 0;
      lastEmittedThreshold = 0;
      buildupStartedAt = 0;
    }
  }

  function runMidpoint(activating, payload) {
    isActive = activating;
    document.body.classList.toggle(id, activating);
    if (activating) document.body.dataset.lastTheme = id;
    // `silent` distinguishes a programmatic toggle from one driven by
    // the user's gesture, so consequences reserved for organic
    // discovery can opt out.  The event still fires either way so
    // listeners stay in sync with the underlying state.
    window.dispatchEvent(
      new CustomEvent("achievement", {
        detail: {
          type: activating ? "theme-activate" : "theme-deactivate",
          theme: id,
          silent: !!(payload && payload.silent),
        },
      }),
    );
    clearIndicators();
    // Successful completion: reset the buildup tracker so the next
    // cycle (e.g. deactivation after activation) can emit thresholds
    // and abandonment freshly.
    peakForce = 0;
    lastEmittedThreshold = 0;
    buildupStartedAt = 0;
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
