// ── Pointer Audio Bridge ──
// A soft tap on every world click, off the click-burst event canvas.js already
// dispatches (it fires only for clicks that aren't on UI controls). Routed
// through the effects bus, so the active theme tints it for free.

import { eventVoiceBridge } from "./event-voice.js";

export const initPointerAudioBridge = eventVoiceBridge({
  "click-burst": "click",
});
