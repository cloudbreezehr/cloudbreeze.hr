export function lerpColor(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
    a[3] + (b[3] - a[3]) * t,
  ];
}

export function multiLerp(stops, p) {
  const n = stops.length - 1;
  const i = Math.min(Math.floor(p * n), n - 1);
  return lerpColor(stops[i], stops[i + 1], p * n - i);
}

export function toRgba(c) {
  return `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${c[3].toFixed(4)})`;
}

export const palettes = {
  dark: {
    // Sky
    skyTop: [
      [8, 16, 36, 1],
      [10, 22, 48, 1],
      [14, 36, 72, 1],
      [18, 50, 90, 1],
      [12, 30, 60, 1],
    ],
    skyBot: [
      [6, 14, 30, 1],
      [10, 25, 50, 1],
      [20, 50, 100, 1],
      [16, 40, 80, 1],
      [10, 22, 40, 1],
    ],
    // Atmosphere
    cloudWhite: [220, 235, 255],
    cloudMid: [180, 210, 245],
    wispColor: [180, 215, 245],
    horizonColor: [20, 60, 120],
    // Effects
    starColor: [180, 210, 255],
    streakColor: [120, 190, 240],
    shootingColors: [
      [180, 210, 255],
      [200, 225, 255],
      [230, 240, 255],
    ],
    gustColor: [180, 220, 255],
    moteColor: [200, 230, 255],
    moteGlow: [130, 195, 255],
    clickColor: [150, 210, 255],
    orbitColor: [180, 220, 255],
    trailColor: [180, 220, 255],
    // Fury
    lightningColor: [200, 225, 255],
    lightningShadow: [180, 210, 255, 0.8],
    lightningFlash: [200, 220, 255],
    auroraHueBase: 120,
    auroraHueRange: 80,
    meteorColors: [
      [180, 210, 255],
      [200, 225, 255],
      [230, 240, 255],
    ],
  },
  light: {
    // Sky
    skyTop: [
      [8, 16, 36, 1],
      [30, 60, 110, 1],
      [90, 160, 220, 1],
      [135, 195, 240, 1],
      [160, 210, 245, 1],
    ],
    skyBot: [
      [6, 14, 30, 1],
      [50, 90, 150, 1],
      [120, 190, 235, 1],
      [170, 215, 245, 1],
      [200, 225, 248, 1],
    ],
    // Atmosphere
    cloudWhite: [255, 255, 255],
    cloudMid: [230, 240, 255],
    wispColor: [220, 235, 250],
    horizonColor: [80, 150, 210],
    // Effects
    starColor: [180, 210, 255],
    streakColor: [120, 190, 240],
    shootingColors: [
      [180, 210, 255],
      [200, 225, 255],
      [230, 240, 255],
    ],
    gustColor: [80, 150, 220],
    moteColor: [80, 150, 220],
    moteGlow: [55, 120, 200],
    clickColor: [55, 120, 200],
    orbitColor: [55, 130, 210],
    trailColor: [55, 120, 200],
    // Fury
    lightningColor: [200, 225, 255],
    lightningShadow: [180, 210, 255, 0.8],
    lightningFlash: [200, 220, 255],
    auroraHueBase: 120,
    auroraHueRange: 80,
    meteorColors: [
      [180, 210, 255],
      [200, 225, 255],
      [230, 240, 255],
    ],
  },
};

// Theme overrides — only specify colors that differ from the base palette.
// The CSS filter on #bg-canvas handles the global tone shift; these overrides
// are for effects that need precise color control despite the filter.
const overrides = {
  "upside-down": {
    dark: {
      clickColor: [255, 130, 130],
      orbitColor: [255, 150, 150],
      lightningColor: [255, 120, 80],
      lightningShadow: [255, 80, 40, 0.8],
      lightningFlash: [255, 100, 50],
      auroraHueBase: 0,
      auroraHueRange: 30,
      meteorColors: [
        [255, 150, 100],
        [255, 180, 130],
        [255, 200, 160],
      ],
    },
    light: {
      clickColor: [200, 60, 60],
      orbitColor: [200, 60, 60],
      lightningColor: [255, 120, 80],
      lightningShadow: [255, 80, 40, 0.8],
      lightningFlash: [255, 100, 50],
      auroraHueBase: 0,
      auroraHueRange: 30,
      meteorColors: [
        [255, 150, 100],
        [255, 180, 130],
        [255, 200, 160],
      ],
    },
  },
  frozen: {
    dark: {
      clickColor: [0, 220, 255],
      orbitColor: [50, 230, 255],
      trailColor: [100, 220, 255],
      lightningColor: [150, 240, 255],
      lightningShadow: [100, 220, 255, 0.8],
      lightningFlash: [200, 245, 255],
      auroraHueBase: 180,
      auroraHueRange: 40,
      meteorColors: [
        [180, 230, 255],
        [210, 240, 255],
        [240, 250, 255],
      ],
    },
    light: {
      clickColor: [0, 160, 220],
      orbitColor: [30, 170, 230],
      trailColor: [60, 160, 220],
      lightningColor: [150, 240, 255],
      lightningShadow: [100, 220, 255, 0.8],
      lightningFlash: [200, 245, 255],
      auroraHueBase: 180,
      auroraHueRange: 40,
      meteorColors: [
        [180, 230, 255],
        [210, 240, 255],
        [240, 250, 255],
      ],
    },
  },
  "deep-sea": {
    dark: {
      clickColor: [0, 255, 180],
      orbitColor: [0, 230, 200],
      trailColor: [0, 200, 180],
      lightningColor: [100, 200, 255],
      lightningShadow: [0, 150, 255, 0.8],
      lightningFlash: [80, 180, 255],
      auroraHueBase: 160,
      auroraHueRange: 60,
      meteorColors: [
        [100, 200, 220],
        [150, 220, 230],
        [200, 240, 245],
      ],
      streakColor: [0, 180, 200],
      moteColor: [0, 255, 180],
      moteGlow: [0, 200, 150],
      bubbleRim: [180, 255, 230],
      bubbleFill: [0, 255, 200],
      bubbleSpecular: [255, 255, 255],
    },
    light: {
      clickColor: [0, 200, 150],
      orbitColor: [0, 200, 170],
      trailColor: [0, 170, 150],
      lightningColor: [100, 200, 255],
      lightningShadow: [0, 150, 255, 0.8],
      lightningFlash: [80, 180, 255],
      auroraHueBase: 160,
      auroraHueRange: 60,
      meteorColors: [
        [100, 200, 220],
        [150, 220, 230],
        [200, 240, 245],
      ],
      streakColor: [0, 180, 200],
      moteColor: [0, 200, 150],
      moteGlow: [0, 170, 130],
      bubbleRim: [140, 220, 200],
      bubbleFill: [0, 200, 170],
      bubbleSpecular: [240, 250, 248],
    },
  },
  rainy: {
    dark: {
      clickColor: [200, 220, 255],
      orbitColor: [160, 180, 210],
      trailColor: [180, 200, 230],
      lightningColor: [230, 240, 255],
      lightningShadow: [180, 210, 255, 0.9],
      lightningFlash: [220, 235, 255],
      auroraHueBase: 210,
      auroraHueRange: 30,
      meteorColors: [
        [180, 200, 230],
        [200, 215, 240],
        [220, 230, 250],
      ],
      streakColor: [180, 200, 220],
      moteColor: [200, 210, 230],
      moteGlow: [170, 185, 210],
      glassBody: [200, 220, 240],
      glassRim: [220, 235, 250],
      glassSpecular: [255, 255, 255],
    },
    light: {
      clickColor: [150, 170, 200],
      orbitColor: [130, 150, 185],
      trailColor: [140, 165, 195],
      lightningColor: [200, 220, 245],
      lightningShadow: [160, 190, 235, 0.9],
      lightningFlash: [200, 215, 240],
      auroraHueBase: 210,
      auroraHueRange: 30,
      meteorColors: [
        [150, 170, 200],
        [170, 190, 215],
        [190, 205, 230],
      ],
      streakColor: [140, 165, 195],
      moteColor: [150, 170, 200],
      moteGlow: [120, 145, 180],
      glassBody: [170, 195, 220],
      glassRim: [195, 215, 235],
      glassSpecular: [240, 248, 255],
    },
  },
  paper: {
    dark: {
      clickColor: [40, 28, 22],
      orbitColor: [70, 55, 45],
      trailColor: [40, 28, 22],
      lightningColor: [20, 14, 10],
      lightningShadow: [40, 28, 22, 0.7],
      lightningFlash: [245, 232, 210],
      auroraHueBase: 30,
      auroraHueRange: 15,
      meteorColors: [
        [40, 28, 22],
        [60, 45, 35],
        [80, 60, 45],
      ],
      shootingColors: [
        [40, 28, 22],
        [60, 45, 35],
        [80, 60, 45],
      ],
      streakColor: [50, 38, 30],
      moteColor: [40, 28, 22],
      moteGlow: [60, 45, 35],
      inkColor: [26, 21, 18],
    },
    light: {
      clickColor: [30, 22, 18],
      orbitColor: [50, 38, 30],
      trailColor: [30, 22, 18],
      lightningColor: [14, 10, 8],
      lightningShadow: [30, 22, 18, 0.7],
      lightningFlash: [251, 242, 221],
      auroraHueBase: 30,
      auroraHueRange: 15,
      meteorColors: [
        [30, 22, 18],
        [50, 38, 30],
        [70, 55, 45],
      ],
      shootingColors: [
        [30, 22, 18],
        [50, 38, 30],
        [70, 55, 45],
      ],
      streakColor: [40, 28, 22],
      moteColor: [30, 22, 18],
      moteGlow: [50, 38, 30],
      inkColor: [20, 14, 10],
    },
  },
  vhs: {
    dark: {
      clickColor: [180, 240, 180],
      orbitColor: [140, 200, 140],
      trailColor: [180, 220, 240],
      lightningColor: [220, 230, 240],
      lightningShadow: [180, 200, 220, 0.7],
      lightningFlash: [230, 250, 220],
      auroraHueBase: 120,
      auroraHueRange: 40,
      meteorColors: [
        [255, 80, 220],
        [80, 255, 220],
        [220, 255, 80],
      ],
      shootingColors: [
        [255, 80, 220],
        [80, 255, 220],
        [220, 255, 80],
      ],
      streakColor: [160, 180, 200],
      moteColor: [180, 220, 180],
      moteGlow: [140, 200, 140],
      gustColor: [120, 140, 160],
      cloudWhite: [200, 215, 225],
      cloudMid: [160, 180, 200],
      cursorPhosphor: [220, 245, 220],
      cursorPhosphorMagenta: [255, 80, 220],
      cursorPhosphorCyan: [80, 255, 220],
    },
    light: {
      clickColor: [100, 180, 100],
      orbitColor: [80, 160, 80],
      trailColor: [100, 160, 200],
      lightningColor: [160, 180, 200],
      lightningShadow: [120, 150, 180, 0.7],
      lightningFlash: [180, 210, 180],
      auroraHueBase: 120,
      auroraHueRange: 40,
      meteorColors: [
        [200, 60, 170],
        [60, 200, 170],
        [170, 200, 60],
      ],
      shootingColors: [
        [200, 60, 170],
        [60, 200, 170],
        [170, 200, 60],
      ],
      streakColor: [120, 140, 160],
      moteColor: [120, 180, 120],
      moteGlow: [90, 150, 90],
      gustColor: [90, 110, 130],
      cloudWhite: [230, 240, 235],
      cloudMid: [200, 215, 220],
      cursorPhosphor: [180, 220, 180],
      cursorPhosphorMagenta: [200, 60, 170],
      cursorPhosphorCyan: [60, 200, 170],
    },
  },
  constellation: {
    dark: {
      starColor: [220, 230, 255],
      shootingColors: [
        [220, 230, 255],
        [200, 215, 250],
        [180, 200, 245],
      ],
      clickColor: [230, 232, 255],
      orbitColor: [200, 215, 250],
      trailColor: [200, 215, 250],
      lightningColor: [200, 215, 250],
      lightningShadow: [180, 200, 245, 0.8],
      lightningFlash: [220, 230, 255],
      auroraHueBase: 240,
      auroraHueRange: 50,
      meteorColors: [
        [220, 230, 255],
        [200, 215, 250],
        [180, 200, 245],
      ],
      streakColor: [160, 180, 230],
      moteColor: [200, 215, 250],
      moteGlow: [160, 180, 230],
      gustColor: [160, 180, 230],
      cloudWhite: [180, 195, 235],
      cloudMid: [140, 160, 210],
      wispColor: [160, 180, 230],
      horizonColor: [40, 50, 100],
      constellationLine: [220, 230, 255],
      constellationGlow: [180, 200, 245],
      cosmicDust: [200, 215, 250],
    },
    light: {
      starColor: [120, 140, 220],
      shootingColors: [
        [120, 140, 220],
        [140, 160, 230],
        [170, 190, 240],
      ],
      clickColor: [100, 120, 210],
      orbitColor: [110, 130, 215],
      trailColor: [110, 130, 215],
      lightningColor: [120, 140, 220],
      lightningShadow: [100, 120, 210, 0.8],
      lightningFlash: [140, 160, 230],
      auroraHueBase: 240,
      auroraHueRange: 50,
      meteorColors: [
        [120, 140, 220],
        [140, 160, 230],
        [170, 190, 240],
      ],
      streakColor: [100, 120, 200],
      moteColor: [110, 130, 215],
      moteGlow: [80, 100, 190],
      gustColor: [100, 120, 200],
      cloudWhite: [180, 195, 235],
      cloudMid: [140, 160, 210],
      wispColor: [160, 180, 220],
      horizonColor: [80, 100, 180],
      constellationLine: [80, 100, 190],
      constellationGlow: [100, 120, 210],
      cosmicDust: [110, 130, 215],
    },
  },
  blocky: {
    dark: {
      clickColor: [100, 255, 100],
      orbitColor: [150, 255, 150],
      trailColor: [50, 200, 100],
      lightningColor: [255, 255, 100],
      lightningShadow: [200, 200, 50, 0.8],
      lightningFlash: [255, 255, 150],
      auroraHueBase: 90,
      auroraHueRange: 60,
      meteorColors: [
        [255, 220, 100],
        [255, 235, 150],
        [255, 245, 200],
      ],
      shootingColors: [
        [255, 220, 100],
        [255, 235, 150],
        [255, 245, 200],
      ],
      streakColor: [40, 60, 140],
      moteColor: [220, 255, 100],
      moteGlow: [180, 220, 80],
      horizonColor: [80, 50, 120],
      wispColor: [150, 170, 220],
      gustColor: [120, 150, 200],
    },
    light: {
      clickColor: [60, 200, 60],
      orbitColor: [80, 200, 80],
      trailColor: [40, 160, 80],
      lightningColor: [255, 255, 100],
      lightningShadow: [200, 200, 50, 0.8],
      lightningFlash: [255, 255, 150],
      auroraHueBase: 90,
      auroraHueRange: 60,
      meteorColors: [
        [255, 200, 60],
        [255, 220, 100],
        [255, 235, 150],
      ],
      shootingColors: [
        [255, 200, 60],
        [255, 220, 100],
        [255, 235, 150],
      ],
      streakColor: [80, 120, 220],
      moteColor: [160, 220, 60],
      moteGlow: [120, 180, 40],
      horizonColor: [120, 100, 180],
      wispColor: [180, 200, 240],
      gustColor: [100, 140, 220],
    },
  },
  // Wanted suppresses the sky and atmosphere and paints its own pop-art
  // backdrop, so only the click/drag interaction visuals (which draw on top)
  // are pal-driven — recolour those to the pop-art inks instead of the base
  // blue. Identical for both appearances; the theme reads the same either way.
  wanted: {
    dark: {
      clickColor: [244, 234, 211], // cream
      orbitColor: [255, 210, 63], // gold
      trailColor: [255, 106, 0], // orange
    },
    light: {
      clickColor: [244, 234, 211],
      orbitColor: [255, 210, 63],
      trailColor: [255, 106, 0],
    },
  },
};

export function resolvePalette(appearance, theme) {
  const base = palettes[appearance] || palettes.dark;
  if (!theme || !overrides[theme]) return base;
  const over = overrides[theme][appearance];
  return over ? { ...base, ...over } : base;
}
