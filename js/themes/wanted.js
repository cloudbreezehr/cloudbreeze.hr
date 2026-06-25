import { defineConstants } from "../dev/registry.js";
import { createWanted } from "../particles/wanted.js";
import { createTheme } from "./factory.js";
import { registerCanvasHooks } from "./canvas-hooks.js";
import { createKeySequenceTrigger } from "./triggers.js";
import { initWantedCheats } from "./wanted-cheats.js";
import { playSfx } from "../audio/sfx.js";
import { prefersReducedMotion } from "../motion.js";

// Theme metadata (id, label, color, icon) lives in themes/registry.js.
// This file is for behavior only.

// ── Force, HUD & Score ──
// Typing HESOYAM or BRINGITON raises the heat (lighting wanted stars 1→5);
// TURNDOWNTHEHEAT cools off. (Spelling the theme's name — WANTED — also toggles
// it via the speller.)
const WF = defineConstants(
  "themes.wanted",
  {
    STAR_COUNT: 5,
    SHOW_AT: 0.02, // buildup stars appear once the code starts landing
    HOT_AT: 0.6, // red/blue police flicker kicks in near the top
    HOLD_MS: 650, // all 5 stars flash for this long before the wipe
    WIPE_COVER_MS: 420,
    WIPE_REVEAL_MS: 620,
    BUSTED_MS: 3500, // how long the HUD stars flash after the level is obtained
    CASH_MIN: 250, // smallest score a single click banks
    CASH_RANGE: 750, // extra score range on top, per click
    CASH_TWEEN_RATE: 0.18, // fraction of the remaining gap the counter ticks per frame
  },
  { theme: "wanted" },
);

const STAR = "★";

// Append `n` star pips to a parent and return them.
function makeStars(parent, n) {
  const pips = [];
  for (let i = 0; i < n; i++) {
    const pip = document.createElement("span");
    pip.className = "wanted-pip";
    pip.textContent = STAR;
    parent.appendChild(pip);
    pips.push(pip);
  }
  return pips;
}

export function initWanted() {
  const wanted = createWanted();

  // Buildup star strip — lights up as the activation code is typed (DOM,
  // opacity 0 at rest), like the other themes' indicator overlays.
  const buildup = document.createElement("div");
  buildup.className = "wanted-buildup";
  buildup.setAttribute("aria-hidden", "true");
  const buildupPips = makeStars(buildup, WF.STAR_COUNT);
  document.body.appendChild(buildup);

  // Persistent HUD — a full wanted level plus a score counter, shown while the
  // theme is active.
  const hud = document.createElement("div");
  hud.className = "wanted-hud";
  hud.setAttribute("aria-hidden", "true");
  const hudStars = document.createElement("div");
  hudStars.className = "wanted-hud-stars";
  makeStars(hudStars, WF.STAR_COUNT);
  const cashEl = document.createElement("div");
  cashEl.className = "wanted-hud-cash";
  hud.append(hudStars, cashEl);
  document.body.appendChild(hud);

  let cash = 0; // true banked total
  let shownCash = 0; // value on screen, counting up toward `cash`
  let cashRaf = null;
  let bustedTimer = null;

  function renderCash(v) {
    cashEl.textContent = "$" + Math.floor(v).toLocaleString("en-US");
  }

  // Count the displayed total up toward the true total, GTA-style: a quick
  // ease-out tick each frame (at least one unit so it always lands). The single
  // place the score animates, whatever raised it.
  function tickCash() {
    const diff = cash - shownCash;
    if (diff <= 0) {
      shownCash = cash;
      renderCash(shownCash);
      cashRaf = null;
      return;
    }
    shownCash = Math.min(
      cash,
      shownCash + Math.ceil(diff * WF.CASH_TWEEN_RATE),
    );
    renderCash(shownCash);
    cashRaf = requestAnimationFrame(tickCash);
  }
  function animateCash() {
    if (prefersReducedMotion()) {
      shownCash = cash;
      renderCash(shownCash);
      return;
    }
    if (cashRaf === null) cashRaf = requestAnimationFrame(tickCash);
  }
  function resetCash() {
    if (cashRaf !== null) {
      cancelAnimationFrame(cashRaf);
      cashRaf = null;
    }
    cash = 0;
    shownCash = 0;
    renderCash(0);
  }

  // Flash the HUD stars like a freshly-raised wanted level, then settle them to
  // a steady glow. Used on activation and by the max-heat cheat.
  function bustStars() {
    if (bustedTimer) clearTimeout(bustedTimer);
    hud.classList.add("busted");
    bustedTimer = setTimeout(() => {
      hud.classList.remove("busted");
      bustedTimer = null;
    }, WF.BUSTED_MS);
  }

  // Reusable entry for any cash gain: bumps the total, cha-chings, reports the
  // running total, and counts the HUD up to it.
  function addCash(amount) {
    cash += amount;
    playSfx("cash", { ui: true });
    window.dispatchEvent(
      new CustomEvent("achievement", {
        detail: { type: "wanted-cash", total: cash },
      }),
    );
    animateCash();
  }

  renderCash(0);

  registerCanvasHooks("wanted", {
    suppressSky: true,
    suppressAtmosphere: true,
    drawAmbient({ ctx, canvas, forces }) {
      wanted.draw(ctx, canvas, forces);
    },
    onClick() {
      addCash(WF.CASH_MIN + Math.floor(Math.random() * WF.CASH_RANGE));
    },
  });

  createTheme({
    id: "wanted",
    trigger: createKeySequenceTrigger({
      // Real SA codes whose meaning matches the gesture: BRINGITON (max wanted)
      // and HESOYAM raise the heat; TURNDOWNTHEHEAT (remove wanted) cools off.
      // BRINGITON and HESOYAM each also double as an in-theme cheat, firing only
      // once the theme is active.
      activationWords: ["HESOYAM", "BRINGITON"],
      deactivationWords: ["TURNDOWNTHEHEAT"],
      completionHoldMs: WF.HOLD_MS,
    }),
    indicators: [
      // Wanted-level meter. Activation raises the heat — stars light 1→5 as the
      // code lands; deactivation sheds it — TURNDOWNTHEHEAT empties 5→0. Both run the
      // force 0→1, so the displayed level is inverted while the theme is active.
      // The strip flashes red/blue whenever the level is near the top.
      {
        threshold: WF.SHOW_AT,
        apply(force, ctx) {
          if (force < WF.SHOW_AT) {
            buildup.style.opacity = "0";
            buildup.classList.remove("hot");
            buildupPips.forEach((p) => p.classList.remove("lit"));
            return;
          }
          const level = ctx.isActive ? 1 - force : force;
          buildup.style.opacity = "1";
          buildup.classList.toggle("hot", level >= WF.HOT_AT);
          const lit = Math.round(level * WF.STAR_COUNT);
          buildupPips.forEach((p, i) => p.classList.toggle("lit", i < lit));
        },
        clear() {
          buildup.style.opacity = "0";
          buildup.classList.remove("hot");
          buildupPips.forEach((p) => p.classList.remove("lit"));
        },
      },
    ],
    wipe: {
      className: "wanted-wipe",
      coverMs: WF.WIPE_COVER_MS,
      revealMs: WF.WIPE_REVEAL_MS,
    },
    onActivate() {
      resetCash();
      hud.classList.add("show");
      bustStars();
    },
    onDeactivate() {
      hud.classList.remove("show", "busted");
      resetCash();
      if (bustedTimer) {
        clearTimeout(bustedTimer);
        bustedTimer = null;
      }
    },
  });

  // Cheat codes — typed while the theme is active. The two effects that touch
  // theme state get wired in; the rest are self-contained.
  initWantedCheats({ addCash, bustStars, floatDots: wanted.float });
}
