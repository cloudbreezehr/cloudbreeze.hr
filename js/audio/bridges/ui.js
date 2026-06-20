// ── UI Audio Bridge ──
// Subtle interface cues, all played dry (ui: true) so they stay out of the
// themed world bus: a tonal tick when the appearance preference changes
// (pitched by where it sits on the dark→light axis) and a whoosh when the
// Cloudlog panel opens, both off the achievement stream; plus a faint feather
// when the cursor settles on a primary call to action. The panel's close
// whoosh is hooked in closePanel (there's no close event to ride).

import { playSfx } from "../sfx.js";

// Dark → low tick, light → high tick, auto → in between.
const APPEARANCE_PITCH = { dark: 0, auto: 0.5, light: 1 };

const HERO_CTA_SELECTOR = ".hero-actions a";

export function initUiAudioBridge() {
  function onAchievement(e) {
    const d = e.detail || {};
    if (d.type === "appearance-change") {
      playSfx("uiTick", {
        ui: true,
        progress: APPEARANCE_PITCH[d.appearance] ?? 0.5,
      });
    } else if (d.type === "panel-open") {
      playSfx("panelOpen", { ui: true });
    }
  }
  window.addEventListener("achievement", onAchievement);

  // Hover is a pointer affordance — skip touch, where a tap already plays the
  // world click and a pre-click feather would just double up.
  function onHover(e) {
    if (e.pointerType === "touch") return;
    playSfx("hoverShimmer", { ui: true });
  }
  const ctas = document.querySelectorAll(HERO_CTA_SELECTOR);
  ctas.forEach((el) => el.addEventListener("pointerenter", onHover));

  return () => {
    window.removeEventListener("achievement", onAchievement);
    ctas.forEach((el) => el.removeEventListener("pointerenter", onHover));
  };
}
