// ── Event → Voice Bridge ──
// Most audio bridges are the same shape: listen to the achievement event
// stream and play a mapped voice when a known effect fires. This builds one
// from an `{ eventType: voiceName }` map, so each bridge is just its mapping
// plus a sentence of intent. Returns an init function that wires the listener
// and hands back a cleanup, matching the other bridges.

import { playSfx } from "../sfx.js";

export function eventVoiceBridge(eventVoice) {
  return function init() {
    function onAchievement(e) {
      const voice = eventVoice[(e.detail || {}).type];
      if (voice) playSfx(voice);
    }
    window.addEventListener("achievement", onAchievement);
    return () => window.removeEventListener("achievement", onAchievement);
  };
}
