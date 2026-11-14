// Procedural planet textures drawn on a canvas. No downloads needed.
import * as THREE from 'three';

function hash(x, y, seed) {
  const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
}
function smooth(t) { return t * t * (3 - 2 * t); }
function noise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const a = hash(xi, yi, seed), b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed), d = hash(xi + 1, yi + 1, seed);
  const u = smooth(xf), v = smooth(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
// Tileable-in-x fbm: sample on a cylinder so the texture wraps around the sphere.
function fbm(u, v, seed, octaves = 5, scale = 4) {
  let sum = 0, amp = 0.5, freq = scale;
  for (let o = 0; o < octaves; o++) {
    const ang = u * Math.PI * 2;
    const r = freq / (Math.PI * 2);
    const x = Math.cos(ang) * r, z = Math.sin(ang) * r;
    sum += amp * (noise(x + 31.7 * o, v * freq + z, seed) * 0.5 + noise(z + 17.3 * o, v * freq - x, seed + 9) * 0.5);
    amp *= 0.5; freq *= 2;
  }
  return sum;
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
function ramp(cols, t) {
  t = Math.min(0.9999, Math.max(0, t));
  const f = t * (cols.length - 1);
  const i = Math.floor(f), k = f - i;
  const a = cols[i], b = cols[i + 1];
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

export function planetTexture(planet, seed = 1, w = 512, h = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  const cols = planet.colors.map(hex);
  for (let y = 0; y < h; y++) {
    const v = y / h;
    for (let x = 0; x < w; x++) {
      const u = x / w;
      let t;
      if (planet.kind === 'gas') {
        const warp = fbm(u, v, seed, 4, 3) * 0.6;
        t = 0.5 + 0.5 * Math.sin((v + warp * 0.12) * Math.PI * 18 + fbm(u, v * 3, seed + 3, 3, 2) * 2);
        t = t * 0.75 + fbm(u, v, seed + 7, 3, 8) * 0.25;
      } else if (planet.kind === 'cloud') {
        t = fbm(u, v * 1.4 + fbm(u, v, seed, 3, 2) * 0.3, seed + 2, 5, 3);
      } else {
        t = fbm(u, v, seed, 6, 5);
        // craters: darken small round pits
        const c = noise(u * 40, v * 20, seed + 11);
        if (c > 0.82) t *= 0.78;
      }
      const [r, g, b] = ramp(cols, t);
      const i = (y * w + x) * 4;
      img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // Jupiter's Great Red Spot
  if (planet.id === 'jupiter') {
    ctx.fillStyle = 'rgba(176, 82, 52, 0.85)';
    ctx.beginPath();
    ctx.ellipse(w * 0.62, h * 0.64, w * 0.035, h * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

export function ringTexture() {
  const w = 512, h = 8;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  for (let x = 0; x < w; x++) {
    const t = x / w;
    const gap = t > 0.62 && t < 0.67 ? 0.08 : 1; // Cassini division
    const a = (0.25 + 0.6 * noise(t * 60, 0, 5)) * gap * (t < 0.06 ? t / 0.06 : 1);
    ctx.fillStyle = `rgba(${220 - t * 40}, ${200 - t * 50}, ${160 - t * 50}, ${a})`;
    ctx.fillRect(x, 0, 1, h);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function glowTexture(inner = 'rgba(255,214,140,1)', outer = 'rgba(255,140,40,0)') {
  const s = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = s;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.25, 'rgba(255,190,90,0.55)');
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
