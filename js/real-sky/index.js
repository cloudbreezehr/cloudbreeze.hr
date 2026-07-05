// ── Real Sky ──
// Makes the canvas agree with the actual sky: the page carries the visitor's
// real day phase (dawn warmth, night depth), and meteor-shower season raises
// the shooting-star rate. Two more details wait behind a click on the footer's
// "Systems online" badge — the live weather over the visitor's location (the
// company's home town until a coarse IP lookup upgrades it), and, when it's
// actually night there, the real moon overhead. An agency front page shouldn't
// open with a forecast or a moon, but the curious get answered. Deterministic
// parts work offline; the network calls degrade to silence.

import { moonPhase, activeMeteorShower, seasonalMoment } from "./astro.js";
import { localDayPhase } from "./local.js";
import { currentLocation } from "./geolocate.js";
import { fetchWeather } from "./weather.js";
import {
  createLocationPin,
  usePreciseLocationIfGranted,
} from "./location-pin.js";
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

// The badge reveals the real sky: the live conditions in its text and, on the
// canvas, the real moon (via the `sky-revealed` class the render loop reads).
// The moon is deterministic, so it reveals on the toggle even offline; the
// weather line is best-effort on top, fetched once on the first peek.
function initWeatherBadge(getLocation, badge, pin) {
  if (!badge) return null;

  // Badge text lives in its own span so the location pin (a sibling) survives
  // the text swap on reveal/fold, which only rewrites this span.
  const textEl = document.createElement("span");
  textEl.className = "footer-badge-text";
  textEl.textContent = badge.textContent;
  badge.textContent = "";
  badge.appendChild(textEl);
  const baseText = textEl.textContent;
  if (pin) badge.appendChild(pin.el);

  let weatherLine = null;
  let revealed = false;
  let fetching = false;

  // The pin belongs with the expanded, weather-showing badge — it refines that
  // very weather, so it only appears once there's weather to refine.
  function syncPin() {
    pin?.setVisible(revealed && weatherLine !== null);
  }

  async function loadWeather() {
    if (fetching) return;
    fetching = true;
    // Read once so the fetched coordinates and the displayed city agree
    // even if the location upgrades mid-flight.
    const location = getLocation();
    const weather = await fetchWeather(location);
    fetching = false;
    // Offline or blocked: the moon still hangs, the text just stays plain.
    if (!weather) return;
    weatherLine = `${baseText} · ${Math.round(weather.tempC)}°C ${
      weather.label
    } over ${location.label}`;
    emit("real-weather", { code: weather.code, raining: weather.raining });
    // Still the active view when the answer arrives? Paint it in.
    if (revealed) {
      textEl.textContent = weatherLine;
      syncPin();
    }
  }

  bindClickable(badge, () => {
    revealed = !revealed;
    document.body.classList.toggle("sky-revealed", revealed);
    textEl.textContent = revealed && weatherLine ? weatherLine : baseText;
    syncPin();
    if (revealed && weatherLine === null) loadWeather();
  });

  return {
    // A location upgrade invalidates the cached line — drop it and, if the
    // badge is open, re-fetch against the new coordinates so text and sky agree.
    refreshForNewLocation() {
      weatherLine = null;
      if (revealed) {
        textEl.textContent = baseText;
        loadWeather();
      }
    },
  };
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

  const badge = document.querySelector(".footer-badge");

  // Refresh the location-derived surfaces after an in-place upgrade. Phase is
  // the only one up before the badge is peeked; the moon reads the shared
  // location live when it renders, and the weather line reloads on demand.
  let weather = null;
  const onUpgrade = () => {
    weather?.refreshForNewLocation();
    applyPhase(getLocation);
  };

  const pin = badge ? createLocationPin({ onUpgrade }) : null;
  weather = initWeatherBadge(getLocation, badge, pin);

  // A returning granter's fix is used silently from load — no pin needed then.
  usePreciseLocationIfGranted(onUpgrade).then((upgraded) => {
    if (upgraded) pin?.retire();
  });

  return function cleanup() {
    clearInterval(phaseTimer);
    delete document.body.dataset.skyPhase;
    document.body.classList.remove("sky-revealed");
  };
}
