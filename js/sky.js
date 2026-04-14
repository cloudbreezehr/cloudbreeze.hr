import { scrollFade, drawTrail } from "./canvas-utils.js";

// ── Stars ──
const STAR_RADIUS_MIN = 0.3;
const STAR_RADIUS_RANGE = 1;
const STAR_OPACITY_MIN = 0.1;
const STAR_OPACITY_RANGE = 0.4;
const STAR_TWINKLE_SPEED_MIN = 0.008;
const STAR_TWINKLE_SPEED_RANGE = 0.03;
const STAR_DEPTH_MIN = 0.1;
const STAR_DEPTH_RANGE = 0.9;
const STAR_FLASH_CHANCE = 0.0003;
const STAR_FLASH_MIN = 0.6;
const STAR_FLASH_RANGE = 0.4;
const STAR_FLASH_DECAY = 0.92;
const STAR_FLASH_THRESHOLD = 0.01;
const STAR_TWINKLE_BASE = 0.7;
const STAR_TWINKLE_RANGE = 0.3;
const STAR_PARALLAX_SCALE = 0.4;
const STAR_FADE_START = 0.2;
const STAR_TIME_STEP = 0.008;
const STAR_GLOW_THRESHOLD = 0.8;
const STAR_GLOW_RADIUS = 2.5;
const STAR_GLOW_MID = 0.35;
const STAR_GLOW_MID_ALPHA = 0.4;
const STAR_GLARE_THRESHOLD = 1.0;
const STAR_GLARE_CHANCE = 0.15;
const STAR_GLARE_SPIKE_LENGTH = 14;
const STAR_GLARE_WIDTH = 0.6;
const STAR_GLARE_ROTATION_SPEED = 0.15;

// ── Shooting Stars ──
const SHOOTING_POOL_SIZE = 3;
const SHOOTING_SPAWN_CHANCE = 0.003;
const SHOOTING_Y_MAX = 0.4;
const SHOOTING_ANGLE_RANGE = 0.2;
const SHOOTING_SPEED_MIN = 6;
const SHOOTING_SPEED_RANGE = 8;
const SHOOTING_LEN_MIN = 40;
const SHOOTING_LEN_RANGE = 60;
const SHOOTING_OPACITY_MIN = 0.3;
const SHOOTING_OPACITY_RANGE = 0.4;
const SHOOTING_LIFE_MIN = 20;
const SHOOTING_LIFE_RANGE = 20;
const SHOOTING_LINE_WIDTH = 1.2;

// Exported for fury meteor spawner
export const STAR_FADE_END = 0.5;
export const SHOOTING_X_SPREAD = 0.8;
export const SHOOTING_X_OFFSET = 0.1;
export const SHOOTING_ANGLE_MIN = 0.15;

// ── Factory ──

export function createSky(starCount) {
  const stars = Array.from({ length: starCount }, () => {
    const r = STAR_RADIUS_MIN + Math.random() * STAR_RADIUS_RANGE;
    return {
      x: Math.random() * 1920,
      y: Math.random() * 1080,
      r,
      opacity: STAR_OPACITY_MIN + Math.random() * STAR_OPACITY_RANGE,
      twinkle: Math.random() * Math.PI * 2,
      twinkleSpeed:
        STAR_TWINKLE_SPEED_MIN + Math.random() * STAR_TWINKLE_SPEED_RANGE,
      flash: 0,
      depth: STAR_DEPTH_MIN + Math.random() * STAR_DEPTH_RANGE,
      glarePhase: Math.random() * Math.PI,
    };
  });

  const shootingStars = Array.from({ length: SHOOTING_POOL_SIZE }, () => ({
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
      const starVis = scrollFade(sp, 0, 0, STAR_FADE_START, STAR_FADE_END);
      if (starVis <= 0) return;

      t += STAR_TIME_STEP;
      stars.forEach((s) => {
        s.twinkle += s.twinkleSpeed;
        // Random bright flash — rare, brief spike
        if (s.flash > 0) {
          s.flash *= STAR_FLASH_DECAY;
          if (s.flash < STAR_FLASH_THRESHOLD) s.flash = 0;
        } else if (Math.random() < STAR_FLASH_CHANCE) {
          s.flash = STAR_FLASH_MIN + Math.random() * STAR_FLASH_RANGE;
          s.glare =
            s.r >= STAR_GLARE_THRESHOLD && Math.random() < STAR_GLARE_CHANCE;
        }
        const base =
          s.opacity *
          (STAR_TWINKLE_BASE + STAR_TWINKLE_RANGE * Math.sin(s.twinkle));
        const op = Math.min(1, base + s.flash) * starVis;
        // Parallax — closer stars (higher depth) shift more on scroll
        const shift = s.depth * sp * canvas.height * STAR_PARALLAX_SCALE;
        const py =
          (((s.y - shift) % canvas.height) + canvas.height) % canvas.height;
        const sx = s.x % canvas.width;
        const sc = pal.starColor;
        // Larger stars get a soft radial glow halo
        if (s.r >= STAR_GLOW_THRESHOLD) {
          const gr = s.r * STAR_GLOW_RADIUS;
          const grad = ctx.createRadialGradient(sx, py, 0, sx, py, gr);
          grad.addColorStop(0, `rgba(${sc},${op})`);
          grad.addColorStop(
            STAR_GLOW_MID,
            `rgba(${sc},${op * STAR_GLOW_MID_ALPHA})`,
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
        if (s.glare && s.flash > STAR_FLASH_THRESHOLD) {
          const glareLen = s.r * STAR_GLARE_SPIKE_LENGTH * s.flash;
          const angle = t * STAR_GLARE_ROTATION_SPEED + s.glarePhase;
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = s.flash * starVis;
          ctx.lineWidth = STAR_GLARE_WIDTH;
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
      if (Math.random() < SHOOTING_SPAWN_CHANCE) {
        const ss = shootingStars.find((s) => !s.active);
        if (ss) {
          ss.x =
            Math.random() * canvas.width * SHOOTING_X_SPREAD +
            canvas.width * SHOOTING_X_OFFSET;
          ss.y = Math.random() * canvas.height * SHOOTING_Y_MAX;
          ss.angle =
            Math.PI * SHOOTING_ANGLE_MIN +
            Math.random() * Math.PI * SHOOTING_ANGLE_RANGE;
          ss.speed = SHOOTING_SPEED_MIN + Math.random() * SHOOTING_SPEED_RANGE;
          ss.len = SHOOTING_LEN_MIN + Math.random() * SHOOTING_LEN_RANGE;
          ss.opacity =
            SHOOTING_OPACITY_MIN + Math.random() * SHOOTING_OPACITY_RANGE;
          ss.life = 0;
          ss.maxLife = SHOOTING_LIFE_MIN + Math.random() * SHOOTING_LIFE_RANGE;
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
          SHOOTING_LINE_WIDTH,
        );
      });
    },
  };
}
