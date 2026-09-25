// HALFTONE KIT. What a newspaper press needs that the core does not have: a continuous-tone
// ORIGINAL held as two float separations (black and spot), an AM screen that turns one of them
// into irregular, ink-spread dots, the newsprint sheet with its fibres, and the ink-starve mottle
// of a press still coming up to colour. Everything is geometry, seeded tiles or image data built
// once and cached under a key that names what its pixels depend on. No filters, no assets.
import { fractal, rng, type Ctx, type Env, type Layer, type P } from "./core";

export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const smoothstep = (a: number, b: number, v: number) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- the original: two separations
// k = black density 0..1, s = spot density 0..1, both at w x h over the logical frame W x H.
export type Tone = { w: number; h: number; W: number; H: number; k: Float32Array; s: Float32Array };
export const newTone = (w: number, h: number, W: number, H: number): Tone => ({ w, h, W, H, k: new Float32Array(w * h), s: new Float32Array(w * h) });
// bilinear read of one separation at a LOGICAL point
export const toneAt = (t: Tone, ch: Float32Array, x: number, y: number) => {
  const fx = clamp((x / t.W) * t.w - 0.5, 0, t.w - 1.001), fy = clamp((y / t.H) * t.h - 0.5, 0, t.h - 1.001), i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j, a = j * t.w + i;
  return (ch[a] * (1 - u) + ch[a + 1] * u) * (1 - v) + (ch[a + t.w] * (1 - u) + ch[a + t.w + 1] * u) * v;
};
// Composite a painted RGBA surface over the separations: R = black, G = spot, A = coverage.
// `tex(i, j, bChannel, k, s)` may alter the painted values per pixel (stone courses, weathering)
// and returns [k, s]. The B channel is a material id, read only where coverage is full.
export const over = (t: Tone, L: Layer, tex?: (x: number, y: number, mat: number, k: number, s: number) => [number, number]) => {
  const d = L.ctx.getImageData(0, 0, t.w, t.h).data, sx = t.W / t.w, sy = t.H / t.h;
  for (let j = 0; j < t.h; j++) for (let i = 0; i < t.w; i++) {
    const p = (j * t.w + i) * 4, a = d[p + 3] / 255; if (a <= 0) continue;
    let k = d[p] / 255, s = d[p + 1] / 255; if (tex) [k, s] = tex((i + 0.5) * sx, (j + 0.5) * sy, d[p + 2], k, s);
    const q = j * t.w + i; t.k[q] = t.k[q] * (1 - a) + k * a; t.s[q] = t.s[q] * (1 - a) + s * a;
  }
};
// a colour for painting a separation surface: black density k, spot density s, material m
export const ks = (k: number, s: number, m = 0, a = 1) => `rgba(${Math.round(clamp(k) * 255)},${Math.round(clamp(s) * 255)},${m},${a})`;

// ---------------------------------------------------------------- the screen
// A newspaper AM screen: dots on a rotated grid, area proportional to tone. On newsprint the
// finest highlight dots do not hold (they drop out below ~4%), and every dot GAINS as the ink
// soaks sideways into the fibres, so the shadows plug toward solid. `fan` is the paper's
// fan-out: the sheet stretches across its width between units, so the spot lands a little wider.
export type Dot = [number, number, number];
export const screenDots = (b: { x0: number; y0: number; x1: number; y1: number }, pitch: number, ang: number, tone: (x: number, y: number) => number, gain: number, fan = 0): Dot[] => {
  const a = (ang * Math.PI) / 180, c = Math.cos(a), sn = Math.sin(a), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, R = Math.hypot(b.x1 - b.x0, b.y1 - b.y0) / 2 + pitch, out: Dot[] = [];
  for (let u = -R; u <= R; u += pitch) for (let v = -R; v <= R; v += pitch) {
    const x = cx + u * c - v * sn, y = cy + u * sn + v * c; if (x < b.x0 - pitch || x > b.x1 + pitch || y < b.y0 - pitch || y > b.y1 + pitch) continue;
    const t = clamp(tone(x, y)); if (t < 0.045) continue;
    // area-true: a dot's area is the tone (sqrt(t / pi)), swelling past 70% so the dots join into a
    // solid with pinholes; then the gain, strongest in the midtones where the dot's edge is longest
    const r = pitch * (Math.sqrt(t / Math.PI) + 0.17 * t * t * t) + gain * (0.5 + 2 * t * (1 - t));
    out.push([x + (x - b.x0) * fan, y, r]);
  }
  return out;
};
// Ink the dots: each an irregular heptagon, its radius bitten by a fixed per-dot hash, so no two
// dots are the same shape and the pattern never looks like a vector grid.
export const inkDots = (c: Ctx, dots: Dot[], seed: number) => {
  c.beginPath();
  for (const [x, y, r] of dots) {
    if (r < 0.35) continue;
    const h = Math.abs(Math.sin(x * 12.9898 + y * 78.233 + seed) * 43758.5453), n = 7, a0 = (h % 1) * 6.283;
    for (let k = 0; k <= n; k++) { const a = a0 + (k / n) * 6.283, w = 1 + 0.14 * Math.sin(a * 2 + h) + 0.08 * Math.sin(a * 3 + h * 1.7), px = x + Math.cos(a) * r * w, py = y + Math.sin(a) * r * w; k ? c.lineTo(px, py) : c.moveTo(px, py); }
    c.closePath();
  }
  c.fill();
};

// ---------------------------------------------------------------- the ink on the paper
// A plate: its dots inked once onto a full-size transparent layer, with the soft wet halo of ink
// spreading into newsprint (a blurred copy of the same dots, never the dots drawn twice).
export const plateLayer = (env: Env, key: string, dots: Dot[], color: string, spread: number, seed: number): Layer => {
  let L = env.cache.get(key) as Layer | undefined; if (L) return L;
  const DW = Math.round(env.W * env.scale), DH = Math.round(env.H * env.scale), k = env.scale;
  L = env.canvas(DW, DH); const c = L.ctx; c.setTransform(k, 0, 0, k, 0, 0); c.fillStyle = color; inkDots(c, dots, seed);
  // spread: the same dots drawn small and back up (a portable blur), laid UNDER the crisp dots
  const q = Math.max(1, Math.round(DW / (spread * k * 2.2))), qh = Math.max(1, Math.round((q * DH) / DW)), S = env.canvas(q, qh);
  S.ctx.imageSmoothingEnabled = true; S.ctx.drawImage(L.canvas, 0, 0, q, qh);
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = "destination-over"; c.globalAlpha = 0.5; c.imageSmoothingEnabled = true; c.drawImage(S.canvas, 0, 0, DW, DH); c.globalAlpha = 1; c.globalCompositeOperation = "source-over";
  env.cache.set(key, L); return L;
};

// ---------------------------------------------------------------- the sheet
// Newsprint: groundwood pulp, unbleached, so it is grey-cream and full of short dark fibres and
// the odd longer pale one lying on the surface. Built once per size.
export const NEWSPRINT = "#e6dfcc";
export const newsprint = (env: Env, key: string): Layer => {
  let L = env.cache.get(key) as Layer | undefined; if (L) return L;
  const W = env.W, H = env.H, k = env.scale; L = env.canvas(Math.round(W * k), Math.round(H * k)); const c = L.ctx;
  c.setTransform(k, 0, 0, k, 0, 0); c.fillStyle = NEWSPRINT; c.fillRect(0, 0, W, H);
  // a slow cloud in the pulp: newsprint is never one flat colour
  const img = c.getImageData(0, 0, L.canvas.width, L.canvas.height), d = img.data, n = L.canvas.width;
  for (let y = 0; y < L.canvas.height; y += 1) for (let x = 0; x < n; x += 1) { const v = fractal(301, x / k, y / k, 0.006, 0.006, 3) - 0.5, g = fractal(302, x / k, y / k, 0.35, 0.35, 1) - 0.5, p = (y * n + x) * 4, o = v * 16 + g * 7; d[p] += o; d[p + 1] += o; d[p + 2] += o * 1.2; }
  c.putImageData(img, 0, 0); c.setTransform(k, 0, 0, k, 0, 0);
  const r = rng(303), area = W * H;
  for (let i = 0; i < area / 900; i++) { // short dark groundwood fibres, most tiny, a few longer
    const x = r() * W, y = r() * H, len = 1.5 + Math.pow(r(), 3) * 12, a = r() * 6.283, bend = (r() - 0.5) * 0.9, dark = r() < 0.8;
    c.strokeStyle = dark ? `rgba(92,78,58,${0.1 + r() * 0.22})` : `rgba(250,246,236,${0.3 + r() * 0.4})`; c.lineWidth = 0.35 + r() * 0.5;
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a + bend) * len * 0.5, y + Math.sin(a + bend) * len * 0.5, x + Math.cos(a) * len, y + Math.sin(a) * len); c.stroke();
  }
  for (let i = 0; i < area / 60000; i++) { const x = r() * W, y = r() * H, s = 0.6 + r() * 1.1; c.fillStyle = `rgba(70,55,40,${0.25 + r() * 0.3})`; c.beginPath(); c.ellipse(x, y, s, s * (0.4 + r() * 0.5), r() * 3, 0, 6.283); c.fill(); } // shives: bark flecks
  env.cache.set(key, L); return L;
};

// ---------------------------------------------------------------- starve mottle
// A press coming up to colour lays ink unevenly: streaks running with the feed where the ink train
// has not wetted the rollers yet, and a broken speckle where the film is too thin to transfer. An alpha tile of that blotch, built once; knocked OUT of a plate by how starved it is.
export const mottleTile = (env: Env): Layer => {
  const key = `halftone:mottle:${env.scale}`; let L = env.cache.get(key) as Layer | undefined; if (L) return L;
  const n = 256; L = env.canvas(n, n); const img = L.ctx.createImageData(n, n), d = img.data;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const v = fractal(311, x, y, 0.09, 0.012, 3, n) * 0.7 + fractal(312, x, y, 0.5, 0.5, 1, n) * 0.3, p = (y * n + x) * 4; d[p] = d[p + 1] = d[p + 2] = 0; d[p + 3] = 255 * clamp((v - 0.38) * 3.5); /* streaks along the feed, and a fine broken speckle */ }
  L.ctx.putImageData(img, 0, 0); env.cache.set(key, L); return L;
};
export const starve = (c: Ctx, env: Env, rect: [number, number, number, number], amount: number, shift: P) => {
  if (amount <= 0.001) return; const t = mottleTile(env), k = env.scale;
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.beginPath(); c.rect(rect[0] * k, rect[1] * k, (rect[2] - rect[0]) * k, (rect[3] - rect[1]) * k); c.clip();
  c.setTransform(k * 1.6, 0, 0, k * 1.6, shift[0] * k, shift[1] * k); c.globalCompositeOperation = "destination-out"; c.globalAlpha = clamp(amount);
  c.fillStyle = c.createPattern(t.canvas, "repeat")!; c.fillRect(-shift[0] / 1.6 - 10, -shift[1] / 1.6 - 10, env.W / 1.6 + 20, env.H / 1.6 + 20); c.restore();
};
