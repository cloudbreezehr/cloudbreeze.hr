import { scrollFade, drawTrail } from "./canvas-utils.js";
import { defineConstants } from "./dev/registry.js";

// ── Stars ──
const STARS = defineConstants("sky.stars", {
  RADIUS_MIN: {
    value: 0.3,
    min: 0,
    max: 5,
    step: 0.1,
    description: "Minimum star radius in pixels",
  },
  RADIUS_RANGE: {
    value: 1,
    min: 0,
    max: 5,
    step: 0.1,
    description: "Random radius variation added to minimum",
  },
  OPACITY_MIN: {
    value: 0.1,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Minimum base opacity",
  },
  OPACITY_RANGE: {
    value: 0.4,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Random opacity variation",
  },
  TWINKLE_SPEED_MIN: {
    value: 0.008,
    min: 0,
    max: 0.1,
    step: 0.001,
    description: "Minimum twinkle animation speed",
  },
  TWINKLE_SPEED_RANGE: {
    value: 0.03,
    min: 0,
    max: 0.1,
    step: 0.001,
    description: "Twinkle speed variation",
  },
  DEPTH_MIN: {
    value: 0.1,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Minimum parallax depth",
  },
  DEPTH_RANGE: {
    value: 0.9,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Parallax depth variation",
  },
  FLASH_CHANCE: {
    value: 0.0003,
    min: 0,
    max: 0.01,
    step: 0.0001,
    description: "Per-frame chance of a bright flash",
  },
  FLASH_MIN: {
    value: 0.6,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Minimum flash brightness",
  },
  FLASH_RANGE: {
    value: 0.4,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Flash brightness variation",
  },
  FLASH_DECAY: {
    value: 0.92,
    min: 0.5,
    max: 1,
    step: 0.01,
    description: "Flash brightness decay rate per frame",
  },
  FLASH_THRESHOLD: {
    value: 0.01,
    min: 0,
    max: 0.1,
    step: 0.001,
    description: "Flash cutoff — below this, flash is zeroed",
  },
  TWINKLE_BASE: {
    value: 0.7,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Base brightness before twinkle sine wave",
  },
  TWINKLE_RANGE: {
    value: 0.3,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Twinkle sine wave amplitude",
  },
  PARALLAX_SCALE: {
    value: 0.4,
    min: 0,
    max: 2,
    step: 0.01,
    description: "Scroll parallax displacement multiplier",
  },
  FADE_START: {
    value: 0.2,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Scroll position where stars begin fading out",
  },
  TIME_STEP: {
    value: 0.008,
    min: 0,
    max: 0.05,
    step: 0.001,
    description: "Per-frame time increment for glare rotation",
  },
  GLOW_THRESHOLD: {
    value: 0.8,
    min: 0,
    max: 2,
    step: 0.1,
    description: "Minimum radius for radial glow halo",
  },
  GLOW_RADIUS: {
    value: 2.5,
    min: 1,
    max: 10,
    step: 0.1,
    description: "Glow halo radius multiplier",
  },
  GLOW_MID: {
    value: 0.35,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Gradient midpoint stop position",
  },
  GLOW_MID_ALPHA: {
    value: 0.4,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Gradient midpoint opacity multiplier",
  },
  GLARE_THRESHOLD: {
    value: 1.0,
    min: 0,
    max: 3,
    step: 0.1,
    description: "Minimum radius for cross-flare glare",
  },
  GLARE_CHANCE: {
    value: 0.15,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Chance a flashing star gets glare spikes",
  },
  GLARE_SPIKE_LENGTH: {
    value: 14,
    min: 1,
    max: 50,
    step: 1,
    description: "Glare spike length multiplier",
  },
  GLARE_WIDTH: {
    value: 0.6,
    min: 0.1,
    max: 5,
    step: 0.1,
    description: "Glare line width in pixels",
  },
  GLARE_ROTATION_SPEED: {
    value: 0.15,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Glare spike rotation speed",
  },
});

// ── Shooting Stars ──
const SHOOTING = defineConstants("sky.shooting", {
  POOL_SIZE: {
    value: 3,
    min: 1,
    max: 20,
    step: 1,
    description: "Max simultaneous shooting stars",
  },
  SPAWN_CHANCE: {
    value: 0.003,
    min: 0,
    max: 0.05,
    step: 0.001,
    description: "Per-frame spawn probability",
  },
  Y_MAX: {
    value: 0.4,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Max spawn Y as fraction of canvas height",
  },
  ANGLE_RANGE: {
    value: 0.2,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Arc angle variation in radians/pi",
  },
  SPEED_MIN: {
    value: 6,
    min: 1,
    max: 30,
    step: 0.5,
    description: "Minimum travel speed in px/frame",
  },
  SPEED_RANGE: {
    value: 8,
    min: 0,
    max: 30,
    step: 0.5,
    description: "Speed variation",
  },
  LEN_MIN: {
    value: 40,
    min: 5,
    max: 200,
    step: 1,
    description: "Minimum tail length in pixels",
  },
  LEN_RANGE: {
    value: 60,
    min: 0,
    max: 200,
    step: 1,
    description: "Tail length variation",
  },
  OPACITY_MIN: {
    value: 0.3,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Minimum opacity",
  },
  OPACITY_RANGE: {
    value: 0.4,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Opacity variation",
  },
  LIFE_MIN: {
    value: 20,
    min: 5,
    max: 100,
    step: 1,
    description: "Minimum lifetime in frames",
  },
  LIFE_RANGE: {
    value: 20,
    min: 0,
    max: 100,
    step: 1,
    description: "Lifetime variation",
  },
  LINE_WIDTH: {
    value: 1.2,
    min: 0.2,
    max: 5,
    step: 0.1,
    description: "Trail stroke width in pixels",
  },
});

// Shared with fury.js for meteor spawning
export const SKY_SHARED = defineConstants("sky.shared", {
  FADE_END: {
    value: 0.5,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Scroll position where stars fully disappear",
  },
  X_SPREAD: {
    value: 0.8,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Horizontal spawn spread as fraction of canvas",
  },
  X_OFFSET: {
    value: 0.1,
    min: 0,
    max: 0.5,
    step: 0.01,
    description: "Horizontal spawn offset from left edge",
  },
  ANGLE_MIN: {
    value: 0.15,
    min: 0,
    max: 1,
    step: 0.01,
    description: "Minimum shooting angle in radians/pi",
  },
});

// ── Factory ──

export function createSky(starCount) {
  const stars = Array.from({ length: starCount }, () => {
    const r = STARS.RADIUS_MIN + Math.random() * STARS.RADIUS_RANGE;
    return {
      x: Math.random() * 1920,
      y: Math.random() * 1080,
      r,
      opacity: STARS.OPACITY_MIN + Math.random() * STARS.OPACITY_RANGE,
      twinkle: Math.random() * Math.PI * 2,
      twinkleSpeed:
        STARS.TWINKLE_SPEED_MIN + Math.random() * STARS.TWINKLE_SPEED_RANGE,
      flash: 0,
      depth: STARS.DEPTH_MIN + Math.random() * STARS.DEPTH_RANGE,
      glarePhase: Math.random() * Math.PI,
    };
  });

  const shootingStars = Array.from({ length: SHOOTING.POOL_SIZE }, () => ({
    active: false,
    x: 0,
    y: 0,
    angle: 0,
    speed: 0,
    len: 0,
    life: 0,
    maxLife: 0,
    opacity: 0,
  }));

  let t = 0;

  return {
    draw(ctx, canvas, sp, pal) {
      const starVis = scrollFade(
        sp,
        0,
        0,
        STARS.FADE_START,
        SKY_SHARED.FADE_END,
      );
      if (starVis <= 0) return;

      t += STARS.TIME_STEP;
      stars.forEach((s) => {
        s.twinkle += s.twinkleSpeed;
        // Random bright flash — rare, brief spike
        if (s.flash > 0) {
          s.flash *= STARS.FLASH_DECAY;
          if (s.flash < STARS.FLASH_THRESHOLD) s.flash = 0;
        } else if (Math.random() < STARS.FLASH_CHANCE) {
          s.flash = STARS.FLASH_MIN + Math.random() * STARS.FLASH_RANGE;
          s.glare =
            s.r >= STARS.GLARE_THRESHOLD && Math.random() < STARS.GLARE_CHANCE;
        }
        const base =
          s.opacity *
          (STARS.TWINKLE_BASE + STARS.TWINKLE_RANGE * Math.sin(s.twinkle));
        const op = Math.min(1, base + s.flash) * starVis;
        // Parallax — closer stars (higher depth) shift more on scroll
        const shift = s.depth * sp * canvas.height * STARS.PARALLAX_SCALE;
        const py =
          (((s.y - shift) % canvas.height) + canvas.height) % canvas.height;
        const sx = s.x % canvas.width;
        const sc = pal.starColor;
        // Larger stars get a soft radial glow halo
        if (s.r >= STARS.GLOW_THRESHOLD) {
          const gr = s.r * STARS.GLOW_RADIUS;
          const grad = ctx.createRadialGradient(sx, py, 0, sx, py, gr);
          grad.addColorStop(0, `rgba(${sc},${op})`);
          grad.addColorStop(
            STARS.GLOW_MID,
            `rgba(${sc},${op * STARS.GLOW_MID_ALPHA})`,
          );
          grad.addColorStop(1, `rgba(${sc},0)`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(sx, py, gr, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = `rgba(${sc},${op})`;
          ctx.beginPath();
          ctx.arc(sx, py, s.r, 0, Math.PI * 2);
          ctx.fill();
        }
        // Cross-flare glare on rare bright flashing stars
        if (s.glare && s.flash > STARS.FLASH_THRESHOLD) {
          const glareLen = s.r * STARS.GLARE_SPIKE_LENGTH * s.flash;
          const angle = t * STARS.GLARE_ROTATION_SPEED + s.glarePhase;
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = s.flash * starVis;
          ctx.lineWidth = STARS.GLARE_WIDTH;
          ctx.lineCap = "round";
          for (let i = 0; i < 2; i++) {
            const a = angle + i * Math.PI * 0.5;
            const dx = Math.cos(a) * glareLen;
            const dy = Math.sin(a) * glareLen;
            const grad = ctx.createLinearGradient(
              sx - dx,
              py - dy,
              sx + dx,
              py + dy,
            );
            grad.addColorStop(0, `rgba(${sc},0)`);
            grad.addColorStop(0.5, `rgba(${sc},1)`);
            grad.addColorStop(1, `rgba(${sc},0)`);
            ctx.strokeStyle = grad;
            ctx.beginPath();
            ctx.moveTo(sx - dx, py - dy);
            ctx.lineTo(sx + dx, py + dy);
            ctx.stroke();
          }
          ctx.restore();
        }
      });

      // Shooting stars — rare fast arcs across the sky
      if (Math.random() < SHOOTING.SPAWN_CHANCE) {
        const ss = shootingStars.find((s) => !s.active);
        if (ss) {
          ss.x =
            Math.random() * canvas.width * SKY_SHARED.X_SPREAD +
            canvas.width * SKY_SHARED.X_OFFSET;
          ss.y = Math.random() * canvas.height * SHOOTING.Y_MAX;
          ss.angle =
            Math.PI * SKY_SHARED.ANGLE_MIN +
            Math.random() * Math.PI * SHOOTING.ANGLE_RANGE;
          ss.speed = SHOOTING.SPEED_MIN + Math.random() * SHOOTING.SPEED_RANGE;
          ss.len = SHOOTING.LEN_MIN + Math.random() * SHOOTING.LEN_RANGE;
          ss.opacity =
            SHOOTING.OPACITY_MIN + Math.random() * SHOOTING.OPACITY_RANGE;
          ss.life = 0;
          ss.maxLife = SHOOTING.LIFE_MIN + Math.random() * SHOOTING.LIFE_RANGE;
          ss.active = true;
        }
      }
      shootingStars.forEach((ss) => {
        if (!ss.active) return;
        ss.life++;
        if (ss.life > ss.maxLife) {
          ss.active = false;
          return;
        }
        const p = ss.life / ss.maxLife;
        ss.x += Math.cos(ss.angle) * ss.speed;
        ss.y += Math.sin(ss.angle) * ss.speed;
        // Fade in quickly, fade out slowly
        const fade = p < 0.1 ? p / 0.1 : (1 - p) / 0.9;
        const op = ss.opacity * fade * starVis;
        const tailX = ss.x - Math.cos(ss.angle) * ss.len * Math.min(1, p * 3);
        const tailY = ss.y - Math.sin(ss.angle) * ss.len * Math.min(1, p * 3);
        drawTrail(
          ctx,
          ss.x,
          ss.y,
          tailX,
          tailY,
          pal.shootingColors,
          op,
          SHOOTING.LINE_WIDTH,
        );
      });
    },
  };
}
