// ── White Noise ──
// A shared white-noise buffer, generated once per audio context and reused by
// every noise-based voice — SFX bursts that play a slice and beds that loop it.
// Buffers aren't consumed by playback (a fresh BufferSource points at this each
// time), so one suffices for the whole graph.

const NOISE_SECONDS = 3;

let buffer = null;
let bufferCtx = null;

export function whiteNoise(ctx) {
  if (buffer && bufferCtx === ctx) return buffer;
  const frames = Math.floor(ctx.sampleRate * NOISE_SECONDS);
  const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  buffer = buf;
  bufferCtx = ctx;
  return buf;
}

// Test hook — drop the cached buffer so a fresh stub context rebuilds it.
export function _resetForTests() {
  buffer = null;
  bufferCtx = null;
}
