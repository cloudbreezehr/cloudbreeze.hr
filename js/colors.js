export function lerpColor(a, b, t) {
  return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t, a[3]+(b[3]-a[3])*t];
}

export function multiLerp(stops, p) {
  const n = stops.length - 1;
  const i = Math.min(Math.floor(p * n), n - 1);
  return lerpColor(stops[i], stops[i + 1], (p * n) - i);
}

export function toRgba(c) {
  return `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${c[3].toFixed(4)})`;
}

export const palettes = {
  dark: {
    // Sky
    skyTop: [[8,16,36,1], [10,22,48,1], [14,36,72,1], [18,50,90,1], [12,30,60,1]],
    skyBot: [[6,14,30,1], [10,25,50,1], [20,50,100,1], [16,40,80,1], [10,22,40,1]],
    // Atmosphere
    cloudWhite: [220,235,255],
    cloudMid: [180,210,245],
    wispColor: [180,215,245],
    horizonColor: [20,60,120],
    // Effects
    starColor: [180, 210, 255],
    streakColor: [120, 190, 240],
    shootingColors: [[180, 210, 255], [200, 225, 255], [230, 240, 255]],
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
    meteorColors: [[180, 210, 255], [200, 225, 255], [230, 240, 255]],
  },
  light: {
    // Sky
    skyTop: [[8,16,36,1], [30,60,110,1], [90,160,220,1], [135,195,240,1], [160,210,245,1]],
    skyBot: [[6,14,30,1], [50,90,150,1], [120,190,235,1], [170,215,245,1], [200,225,248,1]],
    // Atmosphere
    cloudWhite: [255,255,255],
    cloudMid: [230,240,255],
    wispColor: [220,235,250],
    horizonColor: [80,150,210],
    // Effects
    starColor: [180, 210, 255],
    streakColor: [120, 190, 240],
    shootingColors: [[180, 210, 255], [200, 225, 255], [230, 240, 255]],
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
    meteorColors: [[180, 210, 255], [200, 225, 255], [230, 240, 255]],
  }
};

// Sub-mode overrides — only specify colors that differ from the base palette.
// The CSS filter on #bg-canvas handles the global tone shift; these overrides
// are for effects that need precise color control despite the filter.
const overrides = {
  'upside-down': {
    dark: {
      clickColor: [255, 130, 130],
      orbitColor: [255, 150, 150],
      lightningColor: [255, 120, 80],
      lightningShadow: [255, 80, 40, 0.8],
      lightningFlash: [255, 100, 50],
      auroraHueBase: 0,
      auroraHueRange: 30,
      meteorColors: [[255, 150, 100], [255, 180, 130], [255, 200, 160]],
    },
    light: {
      clickColor: [200, 60, 60],
      orbitColor: [200, 60, 60],
      lightningColor: [255, 120, 80],
      lightningShadow: [255, 80, 40, 0.8],
      lightningFlash: [255, 100, 50],
      auroraHueBase: 0,
      auroraHueRange: 30,
      meteorColors: [[255, 150, 100], [255, 180, 130], [255, 200, 160]],
    },
  },
  'frozen': {
    dark: {
      clickColor: [0, 220, 255],
      orbitColor: [50, 230, 255],
      trailColor: [100, 220, 255],
      lightningColor: [150, 240, 255],
      lightningShadow: [100, 220, 255, 0.8],
      lightningFlash: [200, 245, 255],
      auroraHueBase: 180,
      auroraHueRange: 40,
      meteorColors: [[180, 230, 255], [210, 240, 255], [240, 250, 255]],
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
      meteorColors: [[180, 230, 255], [210, 240, 255], [240, 250, 255]],
    },
  },
};

export function resolvePalette(theme, submode) {
  const base = palettes[theme] || palettes.dark;
  if (!submode || !overrides[submode]) return base;
  const over = overrides[submode][theme];
  return over ? { ...base, ...over } : base;
}
