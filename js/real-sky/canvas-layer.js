// ── Real-Sky Canvas Layer ──
// The actual moon, drawn with its actual phase, but only during the
// visitor's actual night or twilight — the point is that the canvas agrees
// with the sky outside the window. Rides the same scroll fade as the stars
// so it leaves the viewport with them.

import { moonPhase } from "./astro.js";
import { localDayPhase } from "./local.js";
import { getStarsFadeOpacity, getStarsParallaxScale } from "../sky.js";
import { defineConstants } from "../dev/registry.js";

const MOON = defineConstants("realSky.moon", {
  RADIUS: {
    value: 26,
    min: 6,
    max: 80,
    step: 1,
    description: "Moon disc radius (px)",
  },
  X_FRACTION: {
    value: 0.8,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Horizontal position as a fraction of canvas width",
  },
  Y_FRACTION: {
    value: 0.16,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Vertical position as a fraction of canvas height",
  },
  ALPHA: {
    value: 0.85,
    min: 0,
    max: 1,
    step: 0.05,
    description: "Disc opacity at full scroll visibility",
  },
  TWILIGHT_ALPHA_FACTOR: {
    value: 0.45,
    min: 0,
    max: 1,
    step: 0.05,
    description: "Opacity share kept during twilight vs full night",
  },
  GLOW_RADIUS_MULT: {
    value: 2.6,
    min: 1,
    max: 6,
    step: 0.1,
    description: "Halo radius as a multiple of the disc radius",
  },
  GLOW_ALPHA: {
    value: 0.35,
    min: 0,
    max: 1,
    step: 0.05,
    description: "Halo peak opacity relative to the disc's",
  },
  PARALLAX_DEPTH: {
    value: 0.25,
    min: 0,
    max: 1,
    step: 0.05,
    description: "Scroll-parallax depth (stars span 0.1–1)",
  },
  SHADOW_ALPHA: {
    value: 0.92,
    min: 0,
    max: 1,
    step: 0.02,
    description: "How fully the dark side swallows the disc",
  },
});

// Below this lit fraction the moon is effectively new — skip drawing.
const MIN_VISIBLE_ILLUMINATION = 0.04;
// Astronomy changes on the scale of minutes; recompute on a coarse clock.
const ASTRO_REFRESH_MS = 60000;

export function createRealSkyLayer() {
  let cachedAt = -Infinity;
  let phase = "day";
  let moon = null;

  function refresh(now) {
    if (now - cachedAt < ASTRO_REFRESH_MS) return;
    cachedAt = now;
    const date = new Date(now);
    phase = localDayPhase(date);
    moon = moonPhase(date);
  }

  // The lit limb is a half circle on the bright side; the terminator is a
  // half ellipse whose x-radius collapses at the quarters. Anticlockwise
  // choices put the terminator's bulge on the lit side for a crescent and
  // the dark side for a gibbous.
  function litPath(ctx, x, y, r) {
    const litRight = moon.waxing;
    const cosTerm = Math.cos(2 * Math.PI * moon.phase);
    const crescent = cosTerm > 0;
    ctx.beginPath();
    ctx.arc(x, y, r, -Math.PI / 2, Math.PI / 2, !litRight);
    ctx.ellipse(
      x,
      y,
      Math.abs(cosTerm) * r,
      r,
      0,
      Math.PI / 2,
      -Math.PI / 2,
      litRight ? crescent : !crescent,
    );
    ctx.closePath();
  }

  return {
    draw(ctx, canvas, sp, pal) {
      refresh(Date.now());
      if (phase === "day" || phase === "golden") return;
      if (!moon || moon.illumination < MIN_VISIBLE_ILLUMINATION) return;

      const starVis = getStarsFadeOpacity(sp);
      if (starVis <= 0) return;
      const phaseAlpha = phase === "night" ? 1 : MOON.TWILIGHT_ALPHA_FACTOR;
      const alpha = MOON.ALPHA * phaseAlpha * starVis;

      const r = MOON.RADIUS;
      const shift =
        MOON.PARALLAX_DEPTH * sp * canvas.height * getStarsParallaxScale();
      const x = canvas.width * MOON.X_FRACTION;
      const y = canvas.height * MOON.Y_FRACTION - shift;

      const sc = pal.starColor;

      // Halo behind the disc, scaled by how much of the moon is lit.
      const glowAlpha = alpha * MOON.GLOW_ALPHA * moon.illumination;
      const glowR = r * MOON.GLOW_RADIUS_MULT;
      const glow = ctx.createRadialGradient(x, y, r, x, y, glowR);
      glow.addColorStop(0, `rgba(${sc},${glowAlpha.toFixed(3)})`);
      glow.addColorStop(1, `rgba(${sc},0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, glowR, 0, Math.PI * 2);
      ctx.fill();

      // Faint full disc (earthshine), then the lit shape over it.
      ctx.save();
      ctx.globalAlpha = alpha * (1 - MOON.SHADOW_ALPHA);
      ctx.fillStyle = `rgba(${sc},1)`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = `rgba(${sc},1)`;
      litPath(ctx, x, y, r);
      ctx.fill();
      ctx.restore();
    },
  };
}
