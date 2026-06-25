// ── Weapon HUD ──
// A GTA-style weapon slot in the top-right corner. Whenever a cheat or
// incantation is cast, the source dispatches `weapon-select` with the effect's
// own icon (the same glyph it carries everywhere) and a label; the slot pops in
// showing "the last selected weapon", holds, then fades — like cycling weapons
// in the game. One persistent element, refreshed per cast (no per-cast churn).

import { prefersReducedMotion } from "../motion.js";
import { defineConstants } from "../dev/registry.js";

export const WHUD = defineConstants("effects.weaponHud", {
  HOLD_MS: {
    value: 2600,
    min: 800,
    max: 8000,
    step: 100,
    description: "How long the weapon slot lingers after a cast (ms)",
  },
  POP_MS: {
    value: 320,
    min: 100,
    max: 1000,
    step: 20,
    description: "Weapon-select pop animation duration (ms)",
  },
});

/**
 * Mount the weapon HUD and listen for `weapon-select` events.
 * Event detail: `{ icon: <svg string>, label?: <string> }`.
 */
export function initWeaponHud() {
  const slot = document.createElement("div");
  slot.className = "weapon-hud";
  slot.setAttribute("aria-hidden", "true");
  const iconWrap = document.createElement("div");
  iconWrap.className = "weapon-hud-icon";
  const name = document.createElement("div");
  name.className = "weapon-hud-name";
  slot.append(iconWrap, name);
  document.body.appendChild(slot);

  let hideTimer = null;

  function select(icon, label) {
    if (!icon) return;
    // Trusted static markup from our own icon set — no user input.
    iconWrap.innerHTML = icon;
    name.textContent = label || "";
    slot.classList.add("show");

    // A quick "weapon select" pop on the icon — skipped under reduced motion
    // (the slot still appears; it's information, not gratuitous motion).
    if (!prefersReducedMotion() && typeof iconWrap.animate === "function") {
      iconWrap.animate(
        [
          { transform: "scale(0.55)", opacity: 0.3 },
          { transform: "scale(1.14)", opacity: 1, offset: 0.6 },
          { transform: "scale(1)" },
        ],
        { duration: WHUD.POP_MS, easing: "cubic-bezier(0.2, 0.8, 0.3, 1.2)" },
      );
    }

    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      slot.classList.remove("show");
      hideTimer = null;
    }, WHUD.HOLD_MS);
  }

  function onSelect(e) {
    if (!e.detail || !e.detail.icon) return;
    select(e.detail.icon, e.detail.label);
  }
  window.addEventListener("weapon-select", onSelect);

  return {
    select, // exposed for tests / direct use
    stop() {
      window.removeEventListener("weapon-select", onSelect);
      slot.remove();
    },
  };
}
