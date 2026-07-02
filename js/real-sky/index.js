// ── Real Sky ──
// Makes the canvas agree with the actual sky: the page carries the
// visitor's real day phase (dawn warmth, night depth), the moon module
// draws the real moon, and meteor-shower season raises the shooting-star
// rate. The live weather over the visitor's location (the company's home town
// until a coarse IP lookup upgrades it) stays behind a click on the footer's
// "Systems online" badge — an agency front page shouldn't open with a
// forecast, but the curious get answered. Deterministic parts work offline;
// the network calls degrade to silence.

import { moonPhase, activeMeteorShower, seasonalMoment } from "./astro.js";
import { localDayPhase } from "./local.js";
import { currentLocation } from "./geolocate.js";
import { fetchWeather } from "./weather.js";
import { bindClickable } from "../clickable.js";

// Sky phases move on the scale of minutes.
const PHASE_REFRESH_MS = 60000;
// A shower only counts as "visited during the shower" near its peak.
const SHOWER_EVENT_MIN_INTENSITY = 0.5;

function emit(type, data = {}) {
  window.dispatchEvent(
    new CustomEvent("achievement", { detail: { type, ...data } }),
  );
}

function applyPhase(getLocation) {
  document.body.dataset.skyPhase = localDayPhase(new Date(), getLocation());
}

// The badge toggles between its plain text and the live conditions;
// the network is asked once, on the first peek.
function initWeatherBadge(getLocation) {
  const badge = document.querySelector(".footer-badge");
  if (!badge) return;
  const baseText = badge.textContent;
  let weatherLine = null;
  let shown = false;
  let fetching = false;

  bindClickable(badge, async () => {
    if (weatherLine === null) {
      if (fetching) return;
      fetching = true;
      // Read once so the fetched coordinates and the displayed city agree
      // even if the location upgrades mid-flight.
      const location = getLocation();
      const weather = await fetchWeather(location);
      fetching = false;
      // Offline or blocked: the badge simply stays what it was.
      if (!weather) return;
      weatherLine = `${baseText} · ${Math.round(weather.tempC)}°C ${
        weather.label
      } over ${location.label}`;
      emit("real-weather", { code: weather.code, raining: weather.raining });
    }
    shown = !shown;
    badge.textContent = shown ? weatherLine : baseText;
  });
}

export function initRealSky(getLocation = currentLocation) {
  applyPhase(getLocation);
  const phaseTimer = setInterval(
    () => applyPhase(getLocation),
    PHASE_REFRESH_MS,
  );

  const now = new Date();
  const shower = activeMeteorShower(now);
  emit("real-sky", {
    phase: localDayPhase(now, getLocation()),
    moonFull: moonPhase(now).isFull,
    shower:
      shower && shower.intensity >= SHOWER_EVENT_MIN_INTENSITY
        ? shower.id
        : null,
    moment: seasonalMoment(now),
  });

  initWeatherBadge(getLocation);

  return function cleanup() {
    clearInterval(phaseTimer);
    delete document.body.dataset.skyPhase;
  };
}
