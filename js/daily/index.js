// ── Daily Sky ──
// Boot hook for the sky-of-the-day: reports a time-traveling visit (a
// shared `#sky=` link from another day) to the achievement stream. The
// arrangement stream itself needs no init — its consumers pull it lazily.

import { skySeedKey, isTimeTraveling } from "./random.js";

export function initDailySky() {
  if (isTimeTraveling()) {
    window.dispatchEvent(
      new CustomEvent("achievement", {
        detail: { type: "time-travel", seed: skySeedKey() },
      }),
    );
  }
}
