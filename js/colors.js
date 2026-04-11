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
