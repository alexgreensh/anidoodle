// COLOURED PENCIL KIT. A picture is an ordered list of PASSES; a pass is an ordered list of
// MARKS; a mark is one pencil stroke (a centreline, a width, a colour, a pressure). The still is
// every pass complete. The film is the same list replayed in time: finished passes are cached as
// one composite bitmap, the pass in hand is redrawn up to the mark the hand has reached.
//
// Wax-based coloured pencil only deposits on the TOOTH of the sheet. Each pass is drawn on its
// own layer and then punched by one tooth field that belongs to the paper (the same valleys stay
// cream through every layer, which is what makes layered pencil read as pencil). Harder pressure
// fills more of the valleys, so passes pick a pressure level: 0 light, 1 medium, 2 burnished.
//
// Pure: marks are a function of constants and rng(seed). Caches are keyed by everything their
// pixels depend on (design size, logical size, device scale, pass index).
import { Gfx, PENCIL, fractal, rng, sample, type Ctx, type Env, type Layer, type P } from "./core";

export type Mark = { c: P[]; w: number; col: string; a: number; len: number; poly: Float32Array };
export type Pass = { id: string; tooth: 0 | 1 | 2; marks: Mark[] };
export type Region = { box: { x0: number; y0: number; x1: number; y1: number }; has: (x: number, y: number) => boolean };

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const smoothstep = (a: number, b: number, v: number) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- regions
export const inPoly = (pts: P[], x: number, y: number) => { let k = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) k = !k; } return k; };
const boxOf = (pts: P[]) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return { x0, y0, x1, y1 }; };
export const poly = (pts: P[]): Region => { const box = boxOf(pts); return { box, has: (x, y) => x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1 && inPoly(pts, x, y) }; };
export const union = (...rs: Region[]): Region => ({ box: { x0: Math.min(...rs.map((r) => r.box.x0)), y0: Math.min(...rs.map((r) => r.box.y0)), x1: Math.max(...rs.map((r) => r.box.x1)), y1: Math.max(...rs.map((r) => r.box.y1)) }, has: (x, y) => rs.some((r) => r.has(x, y)) });
export const minus = (a: Region, ...bs: Region[]): Region => ({ box: a.box, has: (x, y) => a.has(x, y) && !bs.some((b) => b.has(x, y)) });
export const ellipseR = (cx: number, cy: number, rx: number, ry: number): Region => ({ box: { x0: cx - rx, y0: cy - ry, x1: cx + rx, y1: cy + ry }, has: (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 });
// distance from a point to a closed polygon's boundary: tone that thickens toward the edge of a form
export const edgeDist = (pts: P[]) => (x: number, y: number) => {
  let d = 1e9;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [ax, ay] = pts[j], [bx, by] = pts[i], dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy || 1, t = clamp(((x - ax) * dx + (y - ay) * dy) / l); d = Math.min(d, Math.hypot(x - ax - t * dx, y - ay - t * dy)); }
  return d;
};

// ---------------------------------------------------------------- the stroke
// A pencil hatch stroke: pressure arrives fast, holds, lifts off in a long taper (the flick).
const profile = (t: number) => Math.max(0.22, Math.pow(clamp(t / 0.16), 0.6) * Math.pow(clamp((1 - t) / 0.42), 0.75));
const outline = (c: P[], w: number): Float32Array => {
  const n = c.length, L: number[] = [], R: number[] = [];
  for (let i = 0; i < n; i++) {
    const p = c[i], q = c[Math.min(n - 1, i + 1)], o = c[Math.max(0, i - 1)], dx = q[0] - o[0], dy = q[1] - o[1], l = Math.hypot(dx, dy) || 1, h = (w * profile(i / (n - 1))) / 2;
    L.push(p[0] - (dy / l) * h, p[1] + (dx / l) * h); R.unshift(p[0] + (dy / l) * h, p[1] - (dx / l) * h);
  }
  // R was built reversed pairwise: fix the pair order
  const out = new Float32Array(L.length + R.length); out.set(L, 0);
  for (let i = 0; i < R.length; i += 2) { out[L.length + i] = R[i]; out[L.length + i + 1] = R[i + 1]; }
  return out;
};
const lengthOf = (c: P[]) => { let s = 0; for (let i = 1; i < c.length; i++) s += Math.hypot(c[i][0] - c[i - 1][0], c[i][1] - c[i - 1][1]); return s; };
const stroke = (pts: P[], w: number, col: string, a: number): Mark => {
  const len = lengthOf(pts), per = Math.max(2, Math.min(10, Math.round(len / 6)));
  const c = pts.length > 2 ? sample(pts, false, Math.max(2, Math.round(per / (pts.length - 1)) + 1)) : Array.from({ length: per + 1 }, (_, i) => [pts[0][0] + ((pts[1][0] - pts[0][0]) * i) / per, pts[0][1] + ((pts[1][1] - pts[0][1]) * i) / per] as P);
  return { c, w, col, a, len, poly: outline(c, w) };
};

// ---------------------------------------------------------------- the sheet being drawn
export class Sheet {
  passes: Pass[] = [];
  private cur!: Pass;
  pass(id: string, tooth: 0 | 1 | 2) { this.cur = { id, tooth, marks: [] }; this.passes.push(this.cur); return this; }
  // go back to an earlier pass and add to it (a subject worked in its own module, pass by pass)
  into(id: string) { const p = this.passes.find((q) => q.id === id); if (!p) throw new Error(`no pass ${id}`); this.cur = p; return this; }
  add(m: Mark) { this.cur.marks.push(m); }
  line(pts: P[], w: number, col: string, a: number) { this.add(stroke(pts, w, col, a)); }
}

export type HatchOpts = {
  ang: number; gap: number; len: number; w: number; col: string; a: number; seed: number;
  dens?: (x: number, y: number) => number; // 0..1: pressure and coverage at a point
  jit?: number;                            // angle wander per stroke, radians
  strip?: number;                          // how far along the stroke direction the hand works before moving on
  over?: number;                           // how far a stroke may overshoot the region's edge
};
// Hatch a region: parallel strokes at one angle, laid side by side in strips the way a hand
// works a patch, each stroke a slightly bowed, flicked line. Edges are where the strokes stop.
export const hatch = (S: Sheet, reg: Region, o: HatchOpts) => {
  const { ang, gap, len, w, col, a, seed, dens = () => 1, jit = 0.09, strip = 150, over = 1.2 } = o, r = rng(seed);
  const cs = Math.cos(ang), sn = Math.sin(ang), b = reg.box, cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, R = Math.hypot(b.x1 - b.x0, b.y1 - b.y0) / 2 + gap;
  const at = (u: number, v: number): P => [cx + u * cs - v * sn, cy + u * sn + v * cs];
  const found: { u: number; v: number; m: Mark }[] = [];
  for (let v = -R; v <= R; v += gap * (0.8 + r() * 0.4)) {
    let run0 = NaN;
    for (let u = -R; u <= R + 2; u += 2) {
      const [x, y] = at(u, v), ins = u <= R && x >= b.x0 - 1 && x <= b.x1 + 1 && y >= b.y0 - 1 && y <= b.y1 + 1 && reg.has(x, y);
      if (ins && isNaN(run0)) run0 = u;
      if (!ins && !isNaN(run0)) {
        const u0 = run0 - r() * over, u1 = u - 2 + r() * over; run0 = NaN;
        let s = u0 + (r() - 0.5) * len * 0.5;
        while (s < u1) {
          const L = len * (0.55 + r() * 0.8), e = Math.min(u1, s + L), s0 = Math.max(u0, s);
          if (e - s0 > 2) {
            const mu = (s0 + e) / 2, [mx, my] = at(mu, v), d = clamp(dens(mx, my));
            if (d > 0.02 && r() < Math.pow(d, 0.55)) {
              const tw = (r() - 0.5) * 2 * jit, dv = (e - s0) * Math.sin(tw) / 2, bow = (r() - 0.5) * 1.4;
              const p0 = at(s0, v - dv), p1 = at(e, v + dv), pm = at(mu, v + bow);
              found.push({ u: mu, v, m: stroke([p0, pm, p1], w * (0.8 + r() * 0.4) * (0.75 + 0.25 * d), col, a * (0.35 + 0.65 * d) * (0.75 + r() * 0.45)) });
            }
          }
          s = e + (r() - 0.45) * len * 0.3;
        }
      }
    }
  }
  // the hand works a strip at a time, back and forth across it
  found.sort((p, q) => { const sp = Math.floor((p.u + R) / strip), sq = Math.floor((q.u + R) / strip); return sp !== sq ? sp - sq : (sp % 2 ? q.v - p.v : p.v - q.v); });
  found.forEach((f) => S.add(f.m));
};

// A contour drawn the way a pencil draws one: a chain of overlapping strokes, each a little
// off the last, pressure lifting between them. `keep` loses the edge where the light eats it.
export const contour = (S: Sheet, pts: P[], o: { w: number; col: string; a: number; seed: number; seg?: number; keep?: (x: number, y: number) => boolean; closed?: boolean; smooth?: boolean; skip?: number }) => {
  const { w, col, a, seed, seg = 60, keep = () => true, closed = false, smooth: sm = true, skip = 0 } = o, r = rng(seed);
  const base = sm ? sample(closed ? pts : pts, closed, 8) : densify(closed ? [...pts, pts[0]] : pts, 3);
  const path = densify(base, 2.5), n = path.length;
  let i = 0;
  while (i < n - 1) {
    const segLen = seg * (0.6 + r() * 0.8), start = Math.max(0, i - Math.round(1 + r() * 2)); let j = start, acc = 0;
    while (j < n - 1 && acc < segLen) { acc += Math.hypot(path[j + 1][0] - path[j][0], path[j + 1][1] - path[j][1]); j++; }
    const piece = path.slice(start, j + 1), mid = piece[piece.length >> 1];
    if (piece.length > 1 && keep(mid[0], mid[1]) && r() >= skip) {
      const off = (r() - 0.5) * 0.9, jj = rng(seed * 13 + i);
      S.line(piece.filter((_, k) => k % 2 === 0 || k === piece.length - 1).map(([x, y]) => [x + off + (jj() - 0.5) * 0.5, y + (jj() - 0.5) * 0.5] as P), w * (0.8 + r() * 0.4), col, a * (0.75 + r() * 0.3));
    }
    i = j;
  }
};
const densify = (s: P[], step: number): P[] => { const out: P[] = [s[0]]; for (let i = 1; i < s.length; i++) { const a = s[i - 1], b = s[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)); for (let k = 1; k <= n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]); } return out; };

// a construction line: ruled freehand, running past both corners the way a lay-in does
export const layLine = (S: Sheet, a: P, b: P, col: string, seed: number, w = 1.0, al = 0.42) => {
  const r = rng(seed), dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, e0 = 5 + r() * 12, e1 = 5 + r() * 12;
  S.line([[a[0] - (dx / l) * e0, a[1] - (dy / l) * e0], [(a[0] + b[0]) / 2 + (r() - 0.5) * 2, (a[1] + b[1]) / 2 + (r() - 0.5) * 2], [b[0] + (dx / l) * e1, b[1] + (dy / l) * e1]], w, col, al);
};
// a tiny dark dot (a rivet, a pin, a pupil): a pencil twisted in a small spiral
export const dot = (S: Sheet, x: number, y: number, rad: number, col: string, a: number, w = 1.2) => {
  const pts: P[] = []; for (let k = 0; k <= 14; k++) { const t = k / 14, an = t * Math.PI * 3.2, rr = rad * (1 - t * 0.8); pts.push([x + Math.cos(an) * rr, y + Math.sin(an) * rr]); }
  S.line(pts, w, col, a);
};

// ---------------------------------------------------------------- the paper's tooth
// One field per sheet: slightly streaked along the dominant hatch diagonal (the pencil drags
// across the ridges), plus a fine isotropic grain. Computed at design resolution, once.
const LEVELS = [0.53, 0.575, 0.645];
const toothField = (env: Env, D: number, ang: number): Float32Array => {
  const key = `cp:toothField:${D}:${ang}`; let f = env.cache.get(key) as Float32Array | undefined;
  if (f) return f;
  f = new Float32Array(D * D); const c = Math.cos(ang), s = Math.sin(ang);
  for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) { const u = x * c + y * s, v = -x * s + y * c; f[y * D + x] = 0.62 * fractal(71, u, v, 0.12, 0.62, 2) + 0.38 * fractal(73, x, y, 0.8, 0.8, 1); }
  env.cache.set(key, f); return f;
};
const toothMask = (env: Env, D: number, ang: number, lvl: number): Layer => {
  const DW = Math.round(env.W * env.scale), DH = Math.round(env.H * env.scale), key = `cp:tooth:${lvl}:${D}:${ang}:${DW}x${DH}`;
  let L = env.cache.get(key) as Layer | undefined; if (L) return L;
  const f = toothField(env, D, ang), small = env.canvas(D, D), img = small.ctx.createImageData(D, D), d = img.data, T = LEVELS[lvl];
  for (let i = 0; i < D * D; i++) { d[i * 4 + 3] = 255 * clamp((T - f[i]) * 11 + 0.5); }
  small.ctx.putImageData(img, 0, 0);
  L = env.canvas(DW, DH); L.ctx.imageSmoothingEnabled = true; L.ctx.drawImage(small.canvas as CanvasImageSource, 0, 0, D, D, 0, 0, DW, DH);
  env.cache.set(key, L); return L;
};

// ---------------------------------------------------------------- replaying the sheet
export type Cue = { pass: string; start: number; end: number };
const fillMark = (c: Ctx, m: Mark, poly = m.poly) => { c.globalAlpha = m.a; c.fillStyle = m.col; c.beginPath(); c.moveTo(poly[0], poly[1]); for (let i = 2; i < poly.length; i += 2) c.lineTo(poly[i], poly[i + 1]); c.closePath(); c.fill(); };
const cutMark = (m: Mark, p: number): Float32Array => { const n = (m.c.length - 1) * p, i = Math.floor(n), f = n - i, head = m.c.slice(0, i + 1); if (f > 1e-6 && i + 1 < m.c.length) head.push([m.c[i][0] + (m.c[i + 1][0] - m.c[i][0]) * f, m.c[i][1] + (m.c[i + 1][1] - m.c[i][1]) * f]); return outline(head.length > 1 ? head : m.c.slice(0, 2), m.w); };

// per-pass cumulative cost: long strokes go fast per unit length, every lift of the pencil costs time
const costs = (p: Pass) => { const out = new Float64Array(p.marks.length + 1); p.marks.forEach((m, i) => (out[i + 1] = out[i] + m.len + 7)); return out; };

// view: the camera on the design sheet (zoom about a design point, which lands at the frame centre)
export type Replay = { D: number; ang: number; paper: string; sheet: () => Sheet; cues: Cue[]; key: string; view?: { zoom: number; cx: number; cy: number } };
export const replay = (R: Replay) => {
  const sheetOf = (env: Env) => { const k = `cp:sheet:${R.key}`; let s = env.cache.get(k) as { S: Sheet; cost: Float64Array[] } | undefined; if (!s) { const S = R.sheet(); s = { S, cost: S.passes.map(costs) }; env.cache.set(k, s); } return s; };
  const order = (S: Sheet) => R.cues.map((c) => { const i = S.passes.findIndex((p) => p.id === c.pass); if (i < 0) throw new Error(`cue for unknown pass ${c.pass}`); return i; });
  const surface = (env: Env, name: string): Layer => { const DW = Math.round(env.W * env.scale), DH = Math.round(env.H * env.scale), k = `cp:surf:${name}:${DW}x${DH}`; let L = env.cache.get(k) as Layer | undefined; if (!L) { L = env.canvas(DW, DH); env.cache.set(k, L); } return L; };
  const design = (env: Env, c: Ctx) => { const v = R.view ?? { zoom: 1, cx: R.D / 2, cy: R.D / 2 }, kx = (env.scale * env.W * v.zoom) / R.D, ky = (env.scale * env.H * v.zoom) / R.D; c.setTransform(kx, 0, 0, ky, (env.scale * env.W) / 2 - v.cx * kx, (env.scale * env.H) / 2 - v.cy * ky); };
  // draw marks [0, n) of a pass, the n-th one partly, onto a scratch layer, punch it by the tooth, lay it on `dst`
  const lay = (env: Env, dst: Ctx, pass: Pass, n: number, part: number) => {
    const L = surface(env, "scratch"), c = L.ctx, DW = Math.round(env.W * env.scale), DH = Math.round(env.H * env.scale);
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = "source-over"; c.globalAlpha = 1; c.clearRect(0, 0, DW, DH);
    design(env, c);
    for (let i = 0; i < n; i++) fillMark(c, pass.marks[i]);
    if (part > 0 && n < pass.marks.length) fillMark(c, pass.marks[n], cutMark(pass.marks[n], part));
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = "destination-in"; c.drawImage(toothMask(env, R.D, R.ang, pass.tooth).canvas as CanvasImageSource, 0, 0); c.globalCompositeOperation = "source-over";
    dst.save(); dst.setTransform(1, 0, 0, 1, 0, 0); dst.globalAlpha = 1; dst.globalCompositeOperation = "source-over"; dst.drawImage(L.canvas as CanvasImageSource, 0, 0); dst.restore();
  };
  // the sheet with the first k cued passes complete. Pure in k: built from the nearest cached one below it.
  const cum = (env: Env, k: number): Layer => {
    const DW = Math.round(env.W * env.scale), DH = Math.round(env.H * env.scale), keyOf = (j: number) => `cp:cum:${R.key}:${j}:${DW}x${DH}`;
    const hit = env.cache.get(keyOf(k)) as Layer | undefined; if (hit) return hit;
    let j = k - 1; while (j >= 0 && !env.cache.has(keyOf(j))) j--;
    const { S } = sheetOf(env), ord = order(S), L = env.canvas(DW, DH), c = L.ctx;
    if (j >= 0) { c.drawImage((env.cache.get(keyOf(j)) as Layer).canvas as CanvasImageSource, 0, 0); }
    else { c.fillStyle = R.paper; c.fillRect(0, 0, DW, DH); j = 0; }
    for (let i = j >= 0 && env.cache.has(keyOf(j)) ? j : 0; i < k; i++) { const p = S.passes[ord[i]]; lay(env, c, p, p.marks.length, 0); }
    // keep only a few composites alive: each is a whole sheet of pixels
    const lk = `cp:cumkeys:${R.key}:${DW}x${DH}`, keys = (env.cache.get(lk) as string[] | undefined) ?? []; keys.push(keyOf(k)); while (keys.length > 3) env.cache.delete(keys.shift()!); env.cache.set(lk, keys);
    env.cache.set(keyOf(k), L); return L;
  };
  const finish = (ctx: Ctx, env: Env) => new Gfx(ctx, env, 0, PENCIL).paper("paper", 0.05);
  return {
    total: () => R.cues[R.cues.length - 1].end,
    draw: (ctx: Ctx, frame: number, env: Env) => {
      const { S, cost } = sheetOf(env), ord = order(S);
      let done = 0; while (done < R.cues.length && frame >= R.cues[done].end) done++;
      const base = cum(env, done);
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(base.canvas as CanvasImageSource, 0, 0); ctx.restore();
      if (done < R.cues.length && frame >= R.cues[done].start) {
        const cue = R.cues[done], pi = ord[done], pass = S.passes[pi], cc = cost[pi], t = (frame - cue.start) / (cue.end - cue.start);
        const want = cc[cc.length - 1] * clamp(t * 0.85 + smoothstep(0, 1, t) * 0.15);
        let lo = 0, hi = pass.marks.length; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (cc[m] <= want) lo = m; else hi = m - 1; }
        const part = lo < pass.marks.length ? clamp((want - cc[lo]) / (pass.marks[lo].len + 7)) : 0;
        lay(env, ctx, pass, lo, part);
      }
      finish(ctx, env);
    },
    stats: (env: Env) => { const { S } = sheetOf(env); return S.passes.map((p) => `${p.id}:${p.marks.length}`).join(" "); },
  };
};
