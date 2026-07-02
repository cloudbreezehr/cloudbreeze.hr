// ── Real Sky ──
// Makes the canvas agree with the actual sky: the page carries the
// visitor's real day phase (dawn warmth, night depth), the moon module
// draws the real moon, meteor-shower season raises the shooting-star rate,
// and the footer badge reports the live weather over Pula. Deterministic
// parts work offline; the one network call degrades to silence.

import { moonPhase, activeMeteorShower, seasonalMoment } from "./astro.js";
import { localDayPhase } from "./local.js";
import { fetchHomeWeather } from "./weather.js";

// Sky phases move on the scale of minutes.
const PHASE_REFRESH_MS = 60000;
// A shower only counts as "visited during the shower" near its peak.
const SHOWER_EVENT_MIN_INTENSITY = 0.5;

function emit(type, data = {}) {
  window.dispatchEvent(
    new CustomEvent("achievement", { detail: { type, ...data } }),
  );
}

function applyPhase() {
  document.body.dataset.skyPhase = localDayPhase();
}

async function applyWeather() {
  const weather = await fetchHomeWeather();
  if (!weather) return;
  const badge = document.querySelector(".footer-badge");
  if (badge) {
    badge.textContent = `Systems online · ${Math.round(weather.tempC)}°C ${
      weather.label
    } over Pula`;
  }
  emit("real-weather", { code: weather.code, raining: weather.raining });
}

export function initRealSky() {
  applyPhase();
  const phaseTimer = setInterval(applyPhase, PHASE_REFRESH_MS);

  const now = new Date();
  const shower = activeMeteorShower(now);
  emit("real-sky", {
    phase: localDayPhase(now),
    moonFull: moonPhase(now).isFull,
    shower:
      shower && shower.intensity >= SHOWER_EVENT_MIN_INTENSITY
        ? shower.id
        : null,
    moment: seasonalMoment(now),
  });

  applyWeather();

  return function cleanup() {
    clearInterval(phaseTimer);
    delete document.body.dataset.skyPhase;
  };
}
