// ── Dev Console Dock Audio Bridge ──
// Sounds the dev console's edge docking: a sparkly shiver when the magnet grabs
// it near an edge, a crisp snap when it docks, and a peel when it's pulled off.
// These ride dedicated window events (not the achievement stream) the console
// already dispatches, so the console stays unaware of audio.

import { playSfx } from "../sfx.js";

const EVENT_VOICE = {
  "dock-magnet": "shimmer",
  "dock-snap": "snap",
  "dock-release": "unsnap",
};

export function initDockAudioBridge() {
  const bound = Object.entries(EVENT_VOICE).map(([type, voice]) => {
    const handler = () => playSfx(voice);
    window.addEventListener(type, handler);
    return [type, handler];
  });
  return () =>
    bound.forEach(([type, handler]) =>
      window.removeEventListener(type, handler),
    );
}
