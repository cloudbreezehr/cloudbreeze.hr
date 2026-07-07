// ── Wanted cheat codes ──
// GTA-style cheat codes, typed while the Wanted theme is active. Deliberately
// unlike the theme trigger: no buildup, no progress meter — a rolling buffer of
// recent keystrokes fires the instant it ends with a known code (so a mistype
// just leaves stray letters in the buffer that never form a valid suffix, and
// you retype the whole code). Codes only listen while body.wanted is set.
//
// Effects reuse the shared one-shot effect modules (which each self-gate under
// reduced motion); the two that touch theme state — banking cash and lifting
// the halftone field — come in as deps from the theme. Each hit pops a pop-art
// sticker toast and reports the code so the tracker can reward cheating.

import { launchRocketFireworks } from "../effects/fireworks.js";
import { spawnRipple } from "../effects/ripple.js";
import { confettiBurst } from "../effects/confetti.js";
import { screenFlash } from "../effects/flash.js";
import { screenShake } from "../effects/screen-shake.js";
import { lightningStrike } from "../effects/lightning.js";
import { ICONS } from "../effects/effect-icons.js";
import { playSfx } from "../audio/sfx.js";
import { prefersReducedMotion } from "../motion.js";
import { defineConstants } from "../dev/registry.js";
import { letterFromKeyEvent } from "../keys.js";

// Confetti / flash colours — pop-art inks reused across the cheats.
const CASH_COLORS = ["#2fbf4e", "#7cfc00", "#f4ead3"]; // money green
const HEAT_COLOR = "#ff2b4a"; // siren red
const PINK_COLOR = "#ff4fa3"; // "pink cars"

const C = defineConstants("themes.wanted.cheats", {
  CASH: {
    value: 250000,
    min: 1000,
    max: 1000000,
    step: 1000,
    description: "HESOYAM payout",
  },
  CONFETTI: {
    value: 60,
    min: 10,
    max: 200,
    step: 5,
    description: "Full-pockets confetti count",
  },
  ROCKETS: {
    value: 6,
    min: 1,
    max: 30,
    step: 1,
    description: "Rockets launched by ROCKETMAN",
  },
  HEAT_PEAK: {
    value: 0.4,
    min: 0.1,
    max: 1,
    step: 0.05,
    description: "Max-heat red flash peak opacity",
  },
  HEAT_MS: {
    value: 600,
    min: 100,
    max: 2000,
    step: 50,
    description: "Max-heat flash duration (ms)",
  },
  TANK_SHAKE: {
    value: 14,
    min: 2,
    max: 30,
    step: 1,
    description: "Roll-out screen-shake amplitude",
  },
  RIOT_CONFETTI: {
    value: 70,
    min: 10,
    max: 200,
    step: 5,
    description: "Riot confetti count",
  },
  RIOT_SHAKE: {
    value: 8,
    min: 2,
    max: 30,
    step: 1,
    description: "Riot screen-shake amplitude",
  },
  RIOT_RINGS: {
    value: 2,
    min: 1,
    max: 6,
    step: 1,
    description: "Riot shockwave rings",
  },
  RIOT_RING_SCALE: {
    value: 16,
    min: 4,
    max: 40,
    step: 1,
    description: "Riot shockwave max scale",
  },
  RIOT_RING_MS: {
    value: 900,
    min: 300,
    max: 2000,
    step: 50,
    description: "Riot shockwave duration (ms)",
  },
  PINK_PEAK: {
    value: 0.4,
    min: 0.1,
    max: 1,
    step: 0.05,
    description: "Pink-slip flash peak opacity",
  },
  PINK_MS: {
    value: 1100,
    min: 200,
    max: 3000,
    step: 100,
    description: "Pink-slip flash duration (ms)",
  },
  STORM_SHAKE: {
    value: 7,
    min: 2,
    max: 30,
    step: 1,
    description: "Storm screen-shake amplitude",
  },
  TOAST_MS: {
    value: 1900,
    min: 600,
    max: 5000,
    step: 100,
    description: "Cheat toast lifetime (ms)",
  },
});

function center() {
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}

// Each cheat: a recognizable SA code, a label for the toast, and an effect.
// `run` receives theme deps; standalone effects ignore them.
export const CHEATS = [
  {
    code: "HESOYAM",
    label: "FULL POCKETS",
    icon: ICONS.money,
    run(deps) {
      deps.addCash(C.CASH);
      confettiBurst({
        origin: center(),
        count: C.CONFETTI,
        colors: CASH_COLORS,
      });
    },
  },
  {
    code: "BRINGITON",
    label: "MAX HEAT",
    icon: ICONS.siren,
    run(deps) {
      deps.bustStars();
      screenFlash({
        color: HEAT_COLOR,
        peak: C.HEAT_PEAK,
        durationMs: C.HEAT_MS,
        sound: "siren",
      });
    },
  },
  {
    code: "ROCKETMAN",
    label: "TAKE OFF",
    icon: ICONS.jetpack,
    run() {
      launchRocketFireworks({ count: C.ROCKETS });
    },
  },
  {
    code: "TIMETOKICKASS",
    label: "ROLL OUT",
    icon: ICONS.tank,
    run() {
      screenShake({ amplitude: C.TANK_SHAKE, sound: "quake" });
    },
  },
  {
    code: "STATEOFEMERGENCY",
    label: "RIOT",
    icon: ICONS.riot,
    run() {
      confettiBurst({
        origin: center(),
        count: C.RIOT_CONFETTI,
        sound: "party",
      });
      screenShake({ amplitude: C.RIOT_SHAKE, sound: "quake" });
      const c = center();
      spawnRipple(c.x, c.y, {
        className: "incantation-ring",
        count: C.RIOT_RINGS,
        maxScale: C.RIOT_RING_SCALE,
        duration: C.RIOT_RING_MS,
        sound: "shockwave",
      });
    },
  },
  {
    code: "PINKISTHENEWCOOL",
    label: "PINK SLIP",
    icon: ICONS.car,
    run() {
      screenFlash({
        color: PINK_COLOR,
        peak: C.PINK_PEAK,
        durationMs: C.PINK_MS,
      });
    },
  },
  {
    code: "SCOTTISHSUMMER",
    label: "STORM ROLLS IN",
    icon: ICONS.downpour,
    run() {
      if (prefersReducedMotion()) return;
      const c = center();
      lightningStrike(c.x, c.y, { flash: true });
      screenShake({ amplitude: C.STORM_SHAKE, sound: "thunderclap" });
    },
  },
  {
    code: "BUBBLECARS",
    label: "LOW GRAVITY",
    icon: ICONS.float,
    run(deps) {
      if (prefersReducedMotion()) return;
      deps.floatDots();
      playSfx("rocket");
    },
  },
];

// The collectible set for the "enter them all" achievement.
export const CHEAT_CODES = CHEATS.map((c) => c.code);

// Pure detector: feed uppercase letters; returns the matched code once the
// rolling buffer ends with one, else null. Buffer is capped to the longest
// code so unrelated typing can't grow it unbounded.
export function createCheatMatcher(codes = CHEAT_CODES) {
  const maxLen = Math.max(...codes.map((code) => code.length));
  let buffer = "";
  return {
    feed(letter) {
      buffer = (buffer + letter).slice(-maxLen);
      for (const code of codes) {
        if (buffer.endsWith(code)) {
          buffer = "";
          return code;
        }
      }
      return null;
    },
    reset() {
      buffer = "";
    },
  };
}

// Pop-art sticker toast — one at a time, self-cleaning via the Web Animations
// API. Always shown (it's feedback, not gratuitous motion); the slide is small.
let toastEl = null;
function showToast(label) {
  if (toastEl) toastEl.remove();
  const el = document.createElement("div");
  el.className = "wanted-cheat-toast";
  el.setAttribute("aria-hidden", "true");
  const tag = document.createElement("span");
  tag.className = "wanted-cheat-tag";
  tag.textContent = "CHEAT ACTIVATED";
  const name = document.createElement("span");
  name.className = "wanted-cheat-name";
  name.textContent = label;
  el.append(tag, name);
  document.body.appendChild(el);
  toastEl = el;
  // Reduced motion: fade only, no slide. The -50% keeps it centred either way.
  const reduced = prefersReducedMotion();
  const enter = reduced ? "translate(-50%, 0)" : "translate(-50%, 8px)";
  const exit = reduced ? "translate(-50%, 0)" : "translate(-50%, -8px)";
  const anim = el.animate(
    [
      { opacity: 0, transform: enter },
      { opacity: 1, transform: "translate(-50%, 0)", offset: 0.12 },
      { opacity: 1, transform: "translate(-50%, 0)", offset: 0.8 },
      { opacity: 0, transform: exit },
    ],
    { duration: C.TOAST_MS, easing: "ease-out" },
  );
  anim.onfinish = () => {
    el.remove();
    if (toastEl === el) toastEl = null;
  };
}

/**
 * Arm the cheat listener. Fires a cheat only while the Wanted theme is active.
 * @param {{addCash:(n:number)=>void, bustStars:()=>void, floatDots:()=>void}} deps
 */
export function initWantedCheats(deps) {
  const matcher = createCheatMatcher();
  const byCode = new Map(CHEATS.map((c) => [c.code, c]));

  function onKeydown(e) {
    if (!document.body.classList.contains("wanted")) {
      matcher.reset();
      return;
    }
    const letter = letterFromKeyEvent(e);
    if (!letter) return;

    const code = matcher.feed(letter);
    if (!code) return;
    const cheat = byCode.get(code);
    cheat.run(deps);
    showToast(cheat.label);
    // Light up the weapon slot with this cheat's own icon.
    window.dispatchEvent(
      new CustomEvent("weapon-select", {
        detail: { icon: cheat.icon, label: cheat.label },
      }),
    );
    window.dispatchEvent(
      new CustomEvent("achievement", {
        detail: { type: "wanted-cheat", code },
      }),
    );
  }

  window.addEventListener("keydown", onKeydown);
  return {
    stop() {
      window.removeEventListener("keydown", onKeydown);
    },
  };
}
