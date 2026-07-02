// ── Sky-Link Audio Bridge ──
// Sounds the moment a new window joins the linked sky — a discrete state
// change, like a theme toggle. The star handoff itself stays silent on
// purpose: shooting stars are passive ambience and ambience doesn't sound,
// however it entered the viewport.

import { eventVoiceBridge } from "./event-voice.js";

export const initSkyLinkAudioBridge = eventVoiceBridge({
  "sky-link": "shimmer",
});
