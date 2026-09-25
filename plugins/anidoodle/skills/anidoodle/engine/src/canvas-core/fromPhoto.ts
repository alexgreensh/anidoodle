// FROM PHOTO. A kit for drawings made FROM a user's photograph: the photo steers the marks, it is
// never shown. It reads a user asset (Film.assets.images -> env.image(name), decoded by the adapter
// before frame 0) into analysis fields, once per environment, cached:
//   lum       luminance 0..1 (Rec. 709 weights on the stored sRGB values)
//   r, g, b   the colour, 0..1, for coarse segmentation and for tint decisions
//   J11/J12/J22  the smoothed structure tensor of lum: its minor eigenvector is the direction the
//             texture runs (fur strands, wood grain, leaf veins), its anisotropy is how sure it is
//   edge      gradient magnitude, lightly smoothed
// Pure and deterministic: the pixels come from a decoded PNG drawn 1:1 into an env.canvas (no
// resampling), and every number after that is plain arithmetic. The fields are in PHOTO pixels;
// the sampler maps logical film coordinates to photo coordinates with one scale factor k.
import type { Env, P } from "./core";

export type PhotoFields = { iw: number; ih: number; lum: Float32Array; r: Float32Array; g: Float32Array; b: Float32Array; J11: Float32Array; J12: Float32Array; J22: Float32Array; edge: Float32Array };

// separable box blur, `passes` times (3 passes ~ a gaussian of sigma ~ r)
export const boxBlur = (src: Float32Array, w: number, h: number, r: number, passes = 3): Float32Array => {
  let a = src.slice(); const t = new Float32Array(src.length), n = 2 * r + 1;
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) { const o = y * w; let s = 0; for (let i = -r; i <= r; i++) s += a[o + Math.min(w - 1, Math.max(0, i))]; for (let x = 0; x < w; x++) { t[o + x] = s / n; s += a[o + Math.min(w - 1, x + r + 1)] - a[o + Math.max(0, x - r)]; } }
    for (let x = 0; x < w; x++) { let s = 0; for (let i = -r; i <= r; i++) s += t[Math.min(h - 1, Math.max(0, i)) * w + x]; for (let y = 0; y < h; y++) { a[y * w + x] = s / n; s += t[Math.min(h - 1, y + r + 1) * w + x] - t[Math.max(0, y - r) * w + x]; } }
  }
  return a;
};

export const photoFields = (env: Env, name: string, o: { tensorR?: number } = {}): PhotoFields => {
  const tr = o.tensorR ?? 5, key = `photo:${name}:${tr}`; const hit = env.cache.get(key) as PhotoFields | undefined; if (hit) return hit;
  const img = env.image?.(name) as (CanvasImageSource & { width: number; height: number; naturalWidth?: number; naturalHeight?: number }) | undefined;
  if (!img) throw new Error(`fromPhoto: no image '${name}' (declare it in film.assets.images)`);
  const iw = img.naturalWidth ?? img.width, ih = img.naturalHeight ?? img.height, L = env.canvas(iw, ih);
  L.ctx.setTransform(1, 0, 0, 1, 0, 0); L.ctx.clearRect(0, 0, iw, ih); L.ctx.drawImage(img, 0, 0);
  const d = L.ctx.getImageData(0, 0, iw, ih).data, n = iw * ih;
  const r = new Float32Array(n), g = new Float32Array(n), b = new Float32Array(n), lum = new Float32Array(n);
  for (let i = 0; i < n; i++) { r[i] = d[i * 4] / 255; g[i] = d[i * 4 + 1] / 255; b[i] = d[i * 4 + 2] / 255; lum[i] = 0.2126 * r[i] + 0.7152 * g[i] + 0.0722 * b[i]; }
  const gx = new Float32Array(n), gy = new Float32Array(n), J11 = new Float32Array(n), J12 = new Float32Array(n), J22 = new Float32Array(n), e = new Float32Array(n);
  for (let y = 1; y < ih - 1; y++) for (let x = 1; x < iw - 1; x++) {
    const i = y * iw + x, a = lum[i - iw - 1], bb = lum[i - iw], c = lum[i - iw + 1], dd = lum[i - 1], f = lum[i + 1], gg = lum[i + iw - 1], hh = lum[i + iw], ii = lum[i + iw + 1];
    const sx = (c + 2 * f + ii - a - 2 * dd - gg) / 8, sy = (gg + 2 * hh + ii - a - 2 * bb - c) / 8;
    gx[i] = sx; gy[i] = sy; J11[i] = sx * sx; J12[i] = sx * sy; J22[i] = sy * sy; e[i] = Math.hypot(sx, sy);
  }
  const F: PhotoFields = { iw, ih, lum, r, g, b, J11: boxBlur(J11, iw, ih, tr), J12: boxBlur(J12, iw, ih, tr), J22: boxBlur(J22, iw, ih, tr), edge: boxBlur(e, iw, ih, 1, 2) };
  env.cache.set(key, F);
  return F;
};

// ---------------------------------------------------------------- sampling in logical coordinates
export type PhotoSampler = ReturnType<typeof sampler>;
export const sampler = (F: PhotoFields, k: number) => {
  const { iw, ih } = F;
  const bil = (a: Float32Array, x: number, y: number) => { const fx = Math.min(iw - 1.001, Math.max(0, x / k - 0.5)), fy = Math.min(ih - 1.001, Math.max(0, y / k - 0.5)), i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j, q = j * iw + i; return (a[q] * (1 - u) + a[q + 1] * u) * (1 - v) + (a[q + iw] * (1 - u) + a[q + iw + 1] * u) * v; };
  return {
    k,
    lum: (x: number, y: number) => bil(F.lum, x, y),
    rgb: (x: number, y: number): [number, number, number] => [bil(F.r, x, y), bil(F.g, x, y), bil(F.b, x, y)],
    edge: (x: number, y: number) => bil(F.edge, x, y),
    // the texture's running direction (unit, sign-free) and how coherent it is (0..1)
    flow: (x: number, y: number): [number, number, number] => {
      const a = bil(F.J11, x, y), b = bil(F.J12, x, y), c = bil(F.J22, x, y), tr = a + c, det = Math.sqrt((a - c) * (a - c) + 4 * b * b), th = 0.5 * Math.atan2(2 * b, a - c) + Math.PI / 2;
      return [Math.cos(th), Math.sin(th), tr > 1e-9 ? det / tr : 0];
    },
  };
};
// grey-scale opening (min filter, then max filter, square window 2r+1): removes bright lines thinner
// than the window (whiskers, stray hairs) while keeping broad tone
export const openThinBright = (a: Float32Array, w: number, h: number, r: number): Float32Array => {
  const pass = (src: Float32Array, f: (x: number, y: number) => number) => { const out = new Float32Array(src.length), t = new Float32Array(src.length); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = src[y * w + x]; for (let i = Math.max(0, x - r); i <= Math.min(w - 1, x + r); i++) v = f(v, src[y * w + i]); t[y * w + x] = v; } for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = t[y * w + x]; for (let j = Math.max(0, y - r); j <= Math.min(h - 1, y + r); j++) v = f(v, t[j * w + x]); out[y * w + x] = v; } return out; };
  return pass(pass(a, Math.min), Math.max);
};
// orient a sign-free direction to agree with a hint, then lean on the hint where the photo is unsure
export const orient = (f: [number, number, number], hint: P, trust = 1): P => {
  let [dx, dy] = f; const c = Math.min(1, f[2] * trust); if (dx * hint[0] + dy * hint[1] < 0) { dx = -dx; dy = -dy; }
  const x = dx * c + hint[0] * (1 - c), y = dy * c + hint[1] * (1 - c), l = Math.hypot(x, y) || 1; return [x / l, y / l];
};

// ---------------------------------------------------------------- coarse segmentation helpers
// rasterise a closed outline (photo coordinates) into a byte mask at photo resolution
export const polyMask = (w: number, h: number, pts: P[], into?: Uint8Array, val = 1): Uint8Array => {
  const m = into ?? new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const yy = y + 0.5, xs: number[] = [];
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a[1] > yy) !== (b[1] > yy)) xs.push(a[0] + ((yy - a[1]) * (b[0] - a[0])) / (b[1] - a[1])); }
    xs.sort((a, b) => a - b);
    for (let q = 0; q + 1 < xs.length; q += 2) for (let x = Math.max(0, Math.ceil(xs[q] - 0.5)); x <= Math.min(w - 1, Math.floor(xs[q + 1] - 0.5)); x++) m[y * w + x] = val;
  }
  return m;
};
// label each pixel of a box by its nearest reference colour (squared RGB distance); -1 outside the box
export const classify = (F: PhotoFields, box: [number, number, number, number], refs: [number, number, number][], maxDist = 1): Int8Array => {
  const out = new Int8Array(F.iw * F.ih).fill(-1);
  for (let y = Math.max(0, box[1]); y < Math.min(F.ih, box[3]); y++) for (let x = Math.max(0, box[0]); x < Math.min(F.iw, box[2]); x++) {
    const i = y * F.iw + x; let best = -1, bd = maxDist;
    refs.forEach((c, k) => { const d = (F.r[i] - c[0]) ** 2 + (F.g[i] - c[1]) ** 2 + (F.b[i] - c[2]) ** 2; if (d < bd) { bd = d; best = k; } });
    out[i] = best;
  }
  return out;
};
// chamfer distance (photo px) from the nearest pixel NOT in the mask
export const distInside = (m: Uint8Array, w: number, h: number): Float32Array => {
  const d = new Float32Array(w * h); for (let i = 0; i < d.length; i++) d[i] = m[i] ? 1e6 : 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const k = y * w + x; if (!d[k]) continue; let v = d[k]; if (x) v = Math.min(v, d[k - 1] + 1); if (y) v = Math.min(v, d[k - w] + 1); if (x && y) v = Math.min(v, d[k - w - 1] + 1.414); if (y && x < w - 1) v = Math.min(v, d[k - w + 1] + 1.414); d[k] = v; }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { const k = y * w + x; if (!d[k]) continue; let v = d[k]; if (x < w - 1) v = Math.min(v, d[k + 1] + 1); if (y < h - 1) v = Math.min(v, d[k + w] + 1); if (x < w - 1 && y < h - 1) v = Math.min(v, d[k + w + 1] + 1.414); if (y < h - 1 && x) v = Math.min(v, d[k + w - 1] + 1.414); d[k] = v; }
  return d;
};
