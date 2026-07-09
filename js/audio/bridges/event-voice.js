// ── Event → Voice Bridge ──
// Most audio bridges are the same shape: listen to the achievement event
// stream and play a mapped voice when a known effect fires. This builds one
// from an `{ eventType: voiceName }` map, so each bridge is just its mapping
// plus a sentence of intent. A map value may also be a function of the event
// detail returning `[voiceName, opts]` (or a falsy value to stay silent), for
// voices that read the event's data — a pitch, a pan. Returns an init
// function that wires the listener and hands back a cleanup, matching the
// other bridges.

import { playSfx } from "../sfx.js";

export function eventVoiceBridge(eventVoice) {
  return function init() {
    function onAchievement(e) {
      const detail = e.detail || {};
      const entry = eventVoice[detail.type];
      if (!entry) return;
      if (typeof entry === "function") {
        const spec = entry(detail);
        if (spec) playSfx(spec[0], spec[1]);
      } else {
        playSfx(entry);
      }
    }
    window.addEventListener("achievement", onAchievement);
    return () => window.removeEventListener("achievement", onAchievement);
  };
}
