// EMBROIDERY KIT. Thread on linen, as geometry. A stitch is a length of twisted floss laid from the
// hole where the needle came up to the hole where it went down: it pinches into both holes, it is
// rounded in section so it has a lit side and a shade side, its strands twist so the sheen breaks
// into short slanted glints, and it stands a hair proud of the cloth so it casts a tiny shadow.
// A French knot is thread wrapped round the needle and pulled down: a bead with wraps showing.
//
// Kit primitives written here (candidates for core): linenLayer (a per-pixel plain weave with
// slubs, over/under crossings and pin-hole gaps), drawStitches (shadow pass + thread pass for a
// run of stitches), and the stitch generators: stemStitch, splitStitch, runningStitch, satin
// (across an axis), fishbone (a leaf, from the edge to the midrib), longShort (rows shading one
// thread colour into another), knots (a packed French-knot fill).
import type { Env, Layer, P } from "./core";
import { clamp, lerp, lerpP, mix, polyLen, resample } from "./gallery";
import { rng } from "./core";

export const LIGHT: P = [-0.6, -0.8];                // toward the window, upper left
export type St = { k: "flat" | "knot"; a: P; b: P; w: number; c: string; t: number };   // knot: a = centre, w = radius

// ---------------------------------------------------------------- linen
// Plain weave: warp and weft alternate over/under at every crossing. Each thread is a rounded
// cord (bright on its crown, dark at its flanks), rising where it passes over and dipping where it
// goes under; thread thickness wanders (slubs) and every so often a thread is a shade darker.
// Between the cords, the pin-holes of the weave. Computed per device pixel once, cached by scale.
export const linenLayer = (env: Env, key: string, pitch: number, base: [number, number, number], inside: (x: number, y: number) => number): Layer => {
  const k = `emb:linen:${key}:${env.scale}:${env.W}x${env.H}:${pitch}`, hit = env.cache.get(k) as Layer | undefined; if (hit) return hit;
  const DW = Math.round(env.W * env.scale), DH = Math.round(env.H * env.scale), L = env.canvas(DW, DH), img = L.ctx.createImageData(DW, DH), d = img.data;
  const nT = Math.ceil(Math.max(env.W, env.H) / pitch) + 2, r = rng(4411), thick = Array.from({ length: nT * 2 }, () => 0.8 + r() * 0.22), tint = Array.from({ length: nT * 2 }, () => (r() < 0.08 ? 0.95 : 1) * (0.975 + r() * 0.05));
  const SEG = 9, slub = Array.from({ length: nT * 2 }, () => Array.from({ length: Math.ceil(Math.max(env.W, env.H) / SEG) + 2 }, () => (r() < 0.04 ? 0.28 : 0) + (r() - 0.5) * 0.12));
  const sl = (th: number, along: number) => { const s = along / SEG, i = Math.floor(s), f = s - i, row = slub[th]; return row[i] + (row[i + 1] - row[i]) * f; };
  for (let j = 0; j < DH; j++) {
    const y = j / env.scale, v = y / pitch, iv = Math.floor(v), fv = v - iv;
    for (let i = 0; i < DW; i++) {
      const x = i / env.scale, u = x / pitch, iu = Math.floor(u), fu = u - iu;
      const warpHW = 0.5 * clamp(thick[iu] + sl(iu, y), 0.5, 1.15) * 0.94, weftHW = 0.5 * clamp(thick[nT + iv] + sl(nT + iv, x), 0.5, 1.15) * 0.9;
      const dw = Math.abs(fu - 0.5), df = Math.abs(fv - 0.5), inWarp = dw < warpHW, inWeft = df < weftHW, warpTop = ((iu + iv) & 1) === 0;
      let b: number, t: number;
      if (inWarp && (warpTop || !inWeft)) { const cr = Math.cos((dw / warpHW) * Math.PI * 0.5), rise = warpTop ? 0.82 + 0.18 * Math.sin(Math.PI * fv) : 0.74; b = (0.62 + 0.42 * Math.pow(cr, 0.7)) * rise + 0.06 * ((fv * 7 + iu * 0.37) % 1); t = tint[iu]; }
      else if (inWeft) { const cr = Math.cos((df / weftHW) * Math.PI * 0.5), rise = !warpTop ? 0.84 + 0.16 * Math.sin(Math.PI * fu) : 0.74; b = (0.6 + 0.42 * Math.pow(cr, 0.7)) * rise + 0.05 * ((fu * 6 + iv * 0.53) % 1); t = tint[nT + iv]; }
      else { b = 0.5; t = 1; }                                                                      // a pin-hole: the dark behind the cloth
      const m = inside(x, y) * b * t, o = (j * DW + i) * 4;
      d[o] = clamp(base[0] * m, 0, 255); d[o + 1] = clamp(base[1] * m, 0, 255); d[o + 2] = clamp(base[2] * m, 0, 255); d[o + 3] = 255;
    }
  }
  L.ctx.putImageData(img, 0, 0); env.cache.set(k, L);
  return L;
};

// ---------------------------------------------------------------- drawing a run of stitches
type Tone = { base: string; hi: string; lo: string };
const tone = (c: string): Tone => ({ base: c, hi: mix(c, "#ffffff", 0.5), lo: mix(c, "#1a120c", 0.38) });   // a colour's lit and shade threads
export const headOf = (s: St, p: number): P => (s.k === "knot" ? s.a : p >= 1 ? s.b : lerpP(s.a, s.b, p));
// the shadow each stitch casts on the cloth: down and right, away from the window
export const drawShadows = (c: CanvasRenderingContext2D, sts: St[], lastP = 1) => {
  c.save(); c.lineCap = "round"; c.strokeStyle = "#3b2c1c"; c.fillStyle = "#3b2c1c";
  sts.forEach((s, i) => {
    const p = i === sts.length - 1 ? lastP : 1; if (p <= 0) return;
    if (s.k === "knot") { if (p < 0.5) return; c.globalAlpha = 0.42; c.beginPath(); c.arc(s.a[0] + s.w * 0.4, s.a[1] + s.w * 0.55, s.w * 1.05, 0, Math.PI * 2); c.fill(); return; }
    const b = headOf(s, p); c.globalAlpha = 0.34; c.lineWidth = s.w * 1.1; c.beginPath(); c.moveTo(s.a[0] + 0.9, s.a[1] + 1.3); c.lineTo(b[0] + 0.9, b[1] + 1.3); c.stroke();
  });
  c.restore();
};
export const drawThreads = (c: CanvasRenderingContext2D, sts: St[], lastP = 1) => {
  c.save(); c.lineCap = "round"; c.lineJoin = "round";
  sts.forEach((s, i) => {
    const p = i === sts.length - 1 ? lastP : 1; if (p <= 0) return;
    const T = tone(s.c);
    if (s.k === "knot") {                               // a French knot: the bead, its shaded side, the wraps, one glint
      if (p < 0.5) { c.globalAlpha = 1; c.strokeStyle = T.base; c.lineWidth = s.w * 0.7; c.beginPath(); c.arc(s.a[0], s.a[1], s.w * 0.55, 0, Math.PI * 2 * (p * 2)); c.stroke(); return; }   // the wraps going round the needle
      const [x, y] = s.a, r = s.w;
      c.globalAlpha = 1; c.fillStyle = T.lo; c.beginPath(); c.arc(x + r * 0.12, y + r * 0.16, r, 0, Math.PI * 2); c.fill();
      c.fillStyle = T.base; c.beginPath(); c.arc(x - r * 0.1, y - r * 0.12, r * 0.8, 0, Math.PI * 2); c.fill();
      c.strokeStyle = T.lo; c.globalAlpha = 0.55; c.lineWidth = Math.max(0.5, r * 0.22); const ph = (x * 0.37 + y * 0.61) % Math.PI;
      c.beginPath(); c.arc(x, y, r * 0.5, ph, ph + 2.2); c.stroke(); c.beginPath(); c.arc(x, y, r * 0.78, ph + 3, ph + 4.8); c.stroke();
      c.fillStyle = T.hi; c.globalAlpha = 0.8; c.beginPath(); c.arc(x - r * 0.38, y - r * 0.42, r * 0.26, 0, Math.PI * 2); c.fill();
      return;
    }
    const a = s.a, b = headOf(s, p), dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L; let nx = -uy, ny = ux;
    if (nx * LIGHT[0] + ny * LIGHT[1] < 0) { nx = -nx; ny = -ny; }          // n points to the lit side
    const w = s.w, sheen = 0.35 + 0.65 * Math.abs(ux * LIGHT[1] - uy * LIGHT[0]);   // stitches lying across the light catch it most
    const inset = Math.min(L * 0.3, w * 0.25), a1: P = [a[0] + ux * inset, a[1] + uy * inset], b1: P = [b[0] - ux * inset, b[1] - uy * inset];
    c.globalAlpha = 1; c.strokeStyle = T.base; c.lineWidth = w; c.beginPath(); c.moveTo(a1[0], a1[1]); c.lineTo(b1[0], b1[1]); c.stroke();
    c.strokeStyle = T.base; c.lineWidth = w * 0.55; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();          // pinched where it dives into the holes
    c.strokeStyle = T.lo; c.globalAlpha = 0.6; c.lineWidth = w * 0.32; c.beginPath(); c.moveTo(a1[0] - nx * w * 0.32, a1[1] - ny * w * 0.32); c.lineTo(b1[0] - nx * w * 0.32, b1[1] - ny * w * 0.32); c.stroke();
    // the twist: slanted grooves between the strands, and a glint on the crown of each twist
    const step = Math.max(1.6, w * 1.05), n = Math.floor(L / step);
    if (n > 0) {
      c.globalAlpha = 0.42; c.strokeStyle = T.lo; c.lineWidth = Math.max(0.45, w * 0.16); c.beginPath();
      for (let k = 1; k <= n; k++) { const m = k * step - step * 0.3, cx = a[0] + ux * m, cy = a[1] + uy * m, sx = (nx - ux * 0.7) * w * 0.42, sy = (ny - uy * 0.7) * w * 0.42; c.moveTo(cx - sx, cy - sy); c.lineTo(cx + sx, cy + sy); }
      c.stroke();
      c.globalAlpha = 0.28 + 0.5 * sheen; c.strokeStyle = T.hi; c.lineWidth = Math.max(0.45, w * 0.22); c.beginPath();
      for (let k = 0; k < n; k++) { const m = k * step + step * 0.25, cx = a[0] + ux * m + nx * w * 0.16, cy = a[1] + uy * m + ny * w * 0.16; c.moveTo(cx - ux * step * 0.22, cy - uy * step * 0.22); c.lineTo(cx + ux * step * 0.22, cy + uy * step * 0.22); }
      c.stroke();
    } else { c.globalAlpha = 0.3 + 0.5 * sheen; c.strokeStyle = T.hi; c.lineWidth = w * 0.25; c.beginPath(); c.moveTo(a1[0] + nx * w * 0.16, a1[1] + ny * w * 0.16); c.lineTo(b1[0] + nx * w * 0.16, b1[1] + ny * w * 0.16); c.stroke(); }
  });
  c.restore();
};

// ---------------------------------------------------------------- stitch generators
const flat = (a: P, b: P, w: number, c: string, t = 1): St => ({ k: "flat", a, b, w, c, t });
export const knot = (a: P, r: number, c: string): St => ({ k: "knot", a, b: a, w: r, c, t: 2.2 });
// STEM STITCH: each stitch goes forward a length and comes back up half a length behind, beside
// the last, so the line twists like a rope. The slant is the tell.
export const stemStitch = (path: P[], len: number, w: number, c: string, seed: number): St[] => {
  const L = polyLen(path), n = Math.max(2, Math.round(L / (len * 0.5))), s = resample(path, n + 2), r = rng(seed), out: St[] = [];
  for (let i = 0; i + 2 < s.length; i++) { const a = s[i], b = s[i + 2], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, o = w * 0.28; out.push(flat([a[0] - (dy / l) * o, a[1] + (dx / l) * o], [b[0] + (dy / l) * o * 0.6 + (r() - 0.5) * 0.4, b[1] - (dx / l) * o * 0.6 + (r() - 0.5) * 0.4], w, c, 0.9)); }
  return out;
};
// SPLIT STITCH: each stitch comes up through the middle of the last one, splitting its strands.
export const splitStitch = (path: P[], len: number, w: number, c: string, closed = false): St[] => {
  const pts = closed ? [...path, path[0]] : path, L = polyLen(pts), n = Math.max(2, Math.round(L / (len * 0.7))), s = resample(pts, n + 1), out: St[] = [];
  for (let i = 0; i + 1 < s.length; i++) { const a = i ? lerpP(s[i - 1], s[i], 0.62) : s[0]; out.push(flat(a, s[i + 1], w, c, 0.9)); }
  return out;
};
export const runningStitch = (path: P[], dash: number, gap: number, w: number, c: string): St[] => {
  const L = polyLen(path), n = Math.max(2, Math.round(L / 1.5)), s = resample(path, n), out: St[] = []; let acc = 0, on = true, start = s[0];
  for (let i = 1; i < s.length; i++) { acc += Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]); if (on && acc >= dash) { out.push(flat(start, s[i], w, c, 0.8)); on = false; acc = 0; } else if (!on && acc >= gap) { start = s[i]; on = true; acc = 0; } }
  return out;
};
export const straight = (a: P, b: P, w: number, c: string): St => flat(a, b, w, c, 1);
// SATIN along an axis: stitches laid ACROSS the axis, side by side, each from edge to edge.
// `half(t)` is the half-width at t; `colour(t, side)` picks the thread. Long spans are split at
// the axis the way an embroiderer would (a stitch longer than ~9 mm snags).
export const satin = (axis: P[], half: (t: number) => number, gap: number, w: number, colour: (t: number, side: number) => string, o: { skew?: number; split?: number } = {}): St[] => {
  const { skew = 0, split = 26 } = o, L = polyLen(axis), n = Math.max(2, Math.round(L / gap)), s = resample(axis, n), out: St[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), p = s[i], q = s[Math.min(n - 1, i + 1)], pr = s[Math.max(0, i - 1)], dx = q[0] - pr[0], dy = q[1] - pr[1], l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, h = half(t); if (h < 0.6) continue;
    const e1: P = [p[0] - uy * h + ux * skew * h, p[1] + ux * h + uy * skew * h], e2: P = [p[0] + uy * h - ux * skew * h, p[1] - ux * h - uy * skew * h];
    if (2 * h > split) { out.push(flat(e1, lerpP(e1, e2, 0.5 + (i % 2 ? 0.04 : -0.04)), w, colour(t, -1))); out.push(flat(lerpP(e1, e2, 0.5 + (i % 2 ? 0.04 : -0.04)), e2, w, colour(t, 1))); }
    else out.push(flat(e1, e2, w, colour(t, 0)));
  }
  return out;
};
// FISHBONE / angled satin for a leaf: from the edge down to the midrib, slanting toward the tip,
// alternating sides, so the leaf's two halves catch the light differently.
export const fishbone = (mid: P[], half: (t: number) => number, gap: number, w: number, colour: (side: number, t: number) => string): St[] => {
  const L = polyLen(mid), n = Math.max(4, Math.round(L / gap)), s = resample(mid, n + 1), out: St[] = [];
  const edge = (i: number, side: number): P => { const j = Math.min(n, i), p = s[j], q = s[Math.min(n, j + 1)], pr = s[Math.max(0, j - 1)], dx = q[0] - pr[0], dy = q[1] - pr[1], l = Math.hypot(dx, dy) || 1, h = half(j / n); return [p[0] - (dy / l) * h * side, p[1] + (dx / l) * h * side]; };
  for (let i = 0; i < n; i++) for (const side of [-1, 1]) { const t = i / n, a = edge(i + Math.max(1, Math.round(n * 0.14)), side); if (half(Math.min(1, t + 0.14)) < 0.8) continue; out.push(flat(a, s[i], w, colour(side, t))); }
  return out;
};
// LONG AND SHORT: rows from an edge toward a target, the first row alternating long and short,
// later rows filling in between; each row's thread steps from colour A toward colour B.
export const longShort = (edge: P[], target: (p: P) => P, rows: number, gap: number, w: number, ramp: string[], seed: number): St[] => {
  const L = polyLen(edge), n = Math.max(3, Math.round(L / gap)), s = resample(edge, n), r = rng(seed), out: St[] = [];
  for (let row = 0; row < rows; row++) for (let i = 0; i < n; i++) {
    const e = s[i], tgt = target(e), jitter = (r() - 0.5) * 0.12, longOne = (i + row) % 2 === 0;
    const f0 = row === 0 ? 0 : (row - (longOne ? 0.35 : 0.1)) / rows + jitter * 0.3, f1 = row === rows - 1 ? 1 : (row + 1 + (longOne ? 0.2 : -0.15)) / rows + jitter;
    const pick = clamp((row + (r() - 0.5) * 1.1) / Math.max(1, rows - 1), 0, 1), c = ramp[Math.round(pick * (ramp.length - 1))];
    out.push(flat(lerpP(e, tgt, clamp(f0)), lerpP(e, tgt, clamp(f1)), w, c));
  }
  return out;
};
// a packed French-knot fill of a disc (or ellipse), colour by position
export const knots = (cx: number, cy: number, rx: number, ry: number, r0: number, colour: (u: number, v: number) => string, seed: number): St[] => {
  const r = rng(seed), out: St[] = [], step = r0 * 1.7;
  for (let y = -ry; y <= ry; y += step * 0.87) for (let x = -rx; x <= rx; x += step) { const px = x + ((Math.round((y + ry) / (step * 0.87)) % 2) * step) / 2 + (r() - 0.5) * r0 * 0.5, py = y + (r() - 0.5) * r0 * 0.5; if ((px / rx) ** 2 + (py / ry) ** 2 > 1) continue; out.push(knot([cx + px, cy + py], r0 * (0.9 + r() * 0.2), colour(px / rx, py / ry))); }
  return out;
};
export { flat, lerp };
