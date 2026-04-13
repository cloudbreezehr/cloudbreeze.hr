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

function rgbToHsl(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h * 360, s, l];
}

function hue2rgb(p, q, t) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1/6) return p + (q - p) * 6 * t;
  if (t < 1/2) return q;
  if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
  return p;
}

function hslToRgb(h, s, l) {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hNorm = h / 360;
  return [hue2rgb(p, q, hNorm + 1/3), hue2rgb(p, q, hNorm), hue2rgb(p, q, hNorm - 1/3)];
}

export function warmShift([r, g, b], hueShift = 200) {
  let [h, s, l] = rgbToHsl(r / 255, g / 255, b / 255);
  h = ((h - hueShift) % 360 + 360) % 360;
  return hslToRgb(h, s, l).map(v => Math.round(v * 255));
}

export const palettes = {
  dark: {
    skyTop: [[8,16,36,1], [10,22,48,1], [14,36,72,1], [18,50,90,1], [12,30,60,1]],
    skyBot: [[6,14,30,1], [10,25,50,1], [20,50,100,1], [16,40,80,1], [10,22,40,1]],
    cloudWhite: [220,235,255],
    cloudMid: [180,210,245],
    wispColor: [180,215,245],
    horizonColor: [20,60,120],
  },
  light: {
    skyTop: [[8,16,36,1], [30,60,110,1], [90,160,220,1], [135,195,240,1], [160,210,245,1]],
    skyBot: [[6,14,30,1], [50,90,150,1], [120,190,235,1], [170,215,245,1], [200,225,248,1]],
    cloudWhite: [255,255,255],
    cloudMid: [230,240,255],
    wispColor: [220,235,250],
    horizonColor: [80,150,210],
  }
};
