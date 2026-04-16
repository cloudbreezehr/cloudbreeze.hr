// ── Service Card Interactions ──
// Shared utility for service card visual effects.
//
// Base tilt: 3D perspective rotation on hover, mode-aware.
// Mode effects: class toggling, CSS custom property mouse tracking,
// and optional click handlers — each mode opts in via enableCardEffects().
//
// Modes register their own tilt personality by passing a `tilt` config to
// enableCardEffects(). Only one mode's tilt is active at a time; cleanup
// restores the default.

const CARD_SELECTOR = ".service-card";
const PERCENT_SCALE = 100;

// ── Tilt Defaults ──
const TILT_PERSPECTIVE = 600;
const TILT_INTENSITY = 8;
const TILT_HOVER_SCALE = 1.02;
const TILT_TRANSITION = "background 0.4s, transform 0.4s ease";
const TILT_TRANSITION_ENTER = "background 0.4s";

// Active mode tilt config — set by enableCardEffects(), cleared on disable.
let activeTilt = null;

/**
 * Apply 3D tilt to all service cards on hover.
 * When a mode is active and has registered a tilt config via
 * enableCardEffects(), that config overrides the defaults.
 * Disabled on touch-only devices.
 */
export function initTilt() {
  if (matchMedia("(hover: none)").matches) return;

  document.querySelectorAll(CARD_SELECTOR).forEach((card) => {
    card.style.willChange = "transform";

    card.addEventListener("mouseenter", () => {
      const cfg = activeTilt;
      card.style.transition =
        (cfg && cfg.transitionEnter) || TILT_TRANSITION_ENTER;
    });

    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;

      const cfg = activeTilt;

      if (cfg && cfg.transformFn) {
        card.style.transform = cfg.transformFn(x, y);
        return;
      }

      const intensity = (cfg && cfg.intensity) || TILT_INTENSITY;
      const scale = (cfg && cfg.scale) || TILT_HOVER_SCALE;
      const flipY = cfg && cfg.invertY ? 1 : -1;
      card.style.transform = `perspective(${TILT_PERSPECTIVE}px) rotateX(${flipY * y * intensity}deg) rotateY(${x * intensity}deg) scale(${scale})`;
    });

    card.addEventListener("mouseleave", () => {
      const cfg = activeTilt;
      card.style.transition = (cfg && cfg.transition) || TILT_TRANSITION;
      card.style.transform = "";
    });
  });
}

// ── Mode-Specific Card Effects ──

/**
 * Enable mode-specific card effects on all service cards.
 * Returns a cleanup function that removes all added classes,
 * CSS custom properties, and event listeners.
 *
 * @param {object}   config
 * @param {string}   config.className        CSS class to add (e.g. "frost-card")
 * @param {string}   [config.trackingPrefix] CSS property prefix for mouse tracking
 *                                           (e.g. "frost" produces --frost-x / --frost-y)
 * @param {function} [config.onClick]        Click handler (receives the native event)
 * @param {object}   [config.tilt]           Tilt override for this mode. Supported fields:
 *                                           intensity, scale, invertY, transition,
 *                                           transitionEnter, transformFn(x, y)
 * @returns {function(...extraClasses: string[]): void} Cleanup function;
 *          pass additional class names to strip (e.g. "card-frozen")
 */
export function enableCardEffects({
  className,
  trackingPrefix,
  onClick,
  tilt,
}) {
  const cards = document.querySelectorAll(CARD_SELECTOR);

  if (tilt) activeTilt = tilt;

  const xProp = trackingPrefix ? `--${trackingPrefix}-x` : null;
  const yProp = trackingPrefix ? `--${trackingPrefix}-y` : null;

  let onMove = null;
  let onLeave = null;

  if (trackingPrefix) {
    onMove = (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const xPct = ((e.clientX - rect.left) / rect.width) * PERCENT_SCALE + "%";
      const yPct = ((e.clientY - rect.top) / rect.height) * PERCENT_SCALE + "%";
      e.currentTarget.style.setProperty(xProp, xPct);
      e.currentTarget.style.setProperty(yProp, yPct);
    };

    onLeave = (e) => {
      e.currentTarget.style.removeProperty(xProp);
      e.currentTarget.style.removeProperty(yProp);
    };
  }

  cards.forEach((card) => {
    card.classList.add(className);
    if (onMove) card.addEventListener("mousemove", onMove);
    if (onLeave) card.addEventListener("mouseleave", onLeave);
    if (onClick) card.addEventListener("click", onClick);
  });

  return function disable(...extraClasses) {
    if (activeTilt === tilt) activeTilt = null;
    cards.forEach((card) => {
      card.classList.remove(className, ...extraClasses);
      if (xProp) {
        card.style.removeProperty(xProp);
        card.style.removeProperty(yProp);
      }
      if (onMove) card.removeEventListener("mousemove", onMove);
      if (onLeave) card.removeEventListener("mouseleave", onLeave);
      if (onClick) card.removeEventListener("click", onClick);
    });
  };
}
