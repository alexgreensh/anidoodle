import { Gfx, PENCIL, type Ctx, type Env, type Layer } from "./core";
import { weave } from "./paintedOilKit";

// DREAM GLAZE KIT · the hand, with no subject in it.
//
// Resin-thinned oil glazes laid with a very small brush: no visible stroke, every edge hard, one low
// sun. This file is ONLY the technique: noise and colour, the sun, height-field forms and the two
// passes that turn them into paint, cast shadows walked across the heights, the linen surface, and
// the two film gestures (a ground laid in rows; a form laid in shadow and worked up to the light).
//
// It holds no face, no object and no prop. `dreamGlaze.ts` is one picture made with it: study how it
// uses the kit, then invent your own subject. Its mask, question marks, scroll and spark belong to
// that picture and are not vocabulary of the style.
//
// HOW A PICTURE IS BUILT WITH IT
// 1. Describe each standing thing as an `Obj`: for a point it returns its edge distance in px (+ inside),
//    its height toward the eye in px, two surface coordinates of your choosing, and a material number.
// 2. `raise()` turns the list, back to front, into heights, coverage and hollows.
// 3. `paintForms()` calls YOUR painter once per pixel with the surface normal. Your painter picks an
//    albedo per material and calls `light()`; `sunAt()` tells it whether the sun reaches that point.
// 4. Paint the sky and the ground yourself, per pixel, and read cast shadows off the same coverage.
// 5. `surface()` goes over everything.

export const cl = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const sm = (a: number, b: number, x: number) => { const t = cl((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const G = (du: number, dv: number, su: number, sv: number) => Math.exp(-(du * du) / (su * su) - (dv * dv) / (sv * sv));

// ---------------------------------------------------------------- noise (pure arithmetic)
export const hash2 = (ix: number, iy: number, seed: number) => { let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed + 1, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export const vnoise = (x: number, y: number, seed: number) => { const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); const a = hash2(x0, y0, seed), b = hash2(x0 + 1, y0, seed), c = hash2(x0, y0 + 1, seed), d = hash2(x0 + 1, y0 + 1, seed); return a + (b - a) * sx + (c - a + (a - b - c + d) * sx) * sy; };
export const fbm = (x: number, y: number, oct: number, seed: number) => { let s = 0, a = 0.5, n = 0; for (let o = 0; o < oct; o++) { s += vnoise(x, y, seed + o * 17) * a; n += a; a *= 0.5; x *= 2.03; y *= 2.03; } return s / n; };

// ---------------------------------------------------------------- colour
export type C3 = [number, number, number];
export const hex = (h: string): C3 => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const lin = (h: string): C3 => hex(h).map((v) => Math.pow(v / 255, 2.2)) as C3;
export const ramp = (stops: [number, C3][], t: number, out: C3) => { if (t <= stops[0][0]) { out[0] = stops[0][1][0]; out[1] = stops[0][1][1]; out[2] = stops[0][1][2]; return; } for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) { const [t0, a] = stops[i - 1], [t1, b] = stops[i], f = (t - t0) / (t1 - t0); out[0] = a[0] + (b[0] - a[0]) * f; out[1] = a[1] + (b[1] - a[1]) * f; out[2] = a[2] + (b[2] - a[2]) * f; return; } const l = stops[stops.length - 1][1]; out[0] = l[0]; out[1] = l[1]; out[2] = l[2]; };

// ---------------------------------------------------------------- heights, and the one sun
export type Bufs = { DW: number; DH: number; s: number; Hg: Float32Array; Ag: Float32Array; Hb: Float32Array };
export const hAt = (b: Bufs, x: number, y: number) => { const ix = (x * b.s) | 0, iy = (y * b.s) | 0; return ix < 0 || iy < 0 || ix >= b.DW || iy >= b.DH ? -1e9 : b.Hg[iy * b.DW + ix]; };
export const OUT: C3 = [0, 0, 0];
// One sun for the whole picture. `toSun` points at it in world space (x right, y up, z into the picture).
// Everything lit and every shadow cast must come from the same call.
export const sunlight = (toSun: number[], tint: { sun: number[]; sky: number[]; bounce: number[] } = { sun: [1.3, 1.1, 0.8], sky: [0.3, 0.44, 0.8], bounce: [0.85, 0.46, 0.18] }) => {
  const n3 = (v: number[]) => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
  const LW = n3(toSun);                           // to the sun, world
  const LS = [LW[0], -LW[1], -LW[2]];            // the same, screen: x right, y down, z toward the eye
  const LXY = Math.hypot(LS[0], LS[1]), LDX = LS[0] / LXY, LDY = LS[1] / LXY, RISE = LS[2] / LXY;
  const HV = n3([LS[0], LS[1], LS[2] + 1]);      // half vector, for the wet highlight
  const SUN = tint.sun, SKYL = tint.sky, BNC = tint.bounce;
  // is the sun hidden from this point by anything nearer the eye? walk toward it across the heights
  const sunAt = (b: Bufs, x: number, y: number, h: number) => { let occ = 0; for (let k = 1; k <= 70; k++) { const d = k * 2.6, hs = hAt(b, x + LDX * d, y + LDY * d); if (hs > -1e8) { const o = (hs - (h + RISE * d + 2)) / (d * 0.5 + 7); if (o > occ) { occ = o; if (occ >= 1) break; } } } return 1 - cl(occ); };
  const light = (al: C3, nx: number, ny: number, nz: number, sh: number, ao: number, spec: number, gloss: number) => {
    const dif = Math.max(0, nx * LS[0] + ny * LS[1] + nz * LS[2]) * sh, skyk = (0.5 - 0.5 * ny) * ao, bnc = (0.5 + 0.5 * ny) * ao;
    const sp = spec * Math.pow(Math.max(0, nx * HV[0] + ny * HV[1] + nz * HV[2]), gloss) * sh;
    for (let i = 0; i < 3; i++) OUT[i] = al[i] * (SUN[i] * dif + SKYL[i] * 0.36 * skyk + BNC[i] * 0.34 * bnc) + sp * SUN[i];
  };
  return { LW, LS, sunAt, light };
};

// ---------------------------------------------------------------- curves: a centre line with a radius, for anything long and round
export type Curve = { x: Float32Array; y: Float32Array; r: Float32Array; s: Float32Array; k: Float32Array; n: number };
export const curve = (cp: number[][], per = 14): Curve => {
  const xs: number[] = [], ys: number[] = [], rs: number[] = [], g = (i: number) => cp[Math.max(0, Math.min(cp.length - 1, i))];
  for (let i = 0; i < cp.length - 1; i++) for (let j = 0; j < per; j++) { const t = j / per, p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2), cr = (k: number) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t * t + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t * t * t); xs.push(cr(0)); ys.push(cr(1)); rs.push(cr(2)); }
  const e = cp[cp.length - 1]; xs.push(e[0]); ys.push(e[1]); rs.push(e[2]);
  const n = xs.length, s = new Float32Array(n), k = new Float32Array(n);
  for (let i = 1; i < n; i++) s[i] = s[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
  for (let i = 1; i < n - 1; i++) { const a1 = Math.atan2(ys[i] - ys[i - 1], xs[i] - xs[i - 1]), a2 = Math.atan2(ys[i + 1] - ys[i], xs[i + 1] - xs[i]); let d = a2 - a1; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; k[i] = d / Math.max(1e-3, (s[i + 1] - s[i - 1]) / 2); }
  return { x: Float32Array.from(xs), y: Float32Array.from(ys), r: Float32Array.from(rs), s, k, n };
};
// nearest point on a curve: distance, arc length, radius there, side (+ is right of travel), curvature
export const NR = { d: 0, s: 0, r: 0, side: 0, k: 0 };
export const near = (c: Curve, px: number, py: number) => {
  let best = 1e18, bi = 0, bt = 0;
  for (let i = 0; i < c.n - 1; i++) { const ax = c.x[i], ay = c.y[i], dx = c.x[i + 1] - ax, dy = c.y[i + 1] - ay, l2 = dx * dx + dy * dy; let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t; const ex = px - ax - dx * t, ey = py - ay - dy * t, d2 = ex * ex + ey * ey; if (d2 < best) { best = d2; bi = i; bt = t; } }
  const dx = c.x[bi + 1] - c.x[bi], dy = c.y[bi + 1] - c.y[bi];
  NR.d = Math.sqrt(best); NR.s = c.s[bi] + (c.s[bi + 1] - c.s[bi]) * bt; NR.r = c.r[bi] + (c.r[bi + 1] - c.r[bi]) * bt; NR.k = c.k[bi] + (c.k[bi + 1] - c.k[bi]) * bt;
  NR.side = dx * (py - c.y[bi]) - dy * (px - c.x[bi]) >= 0 ? 1 : -1;
};

// ---------------------------------------------------------------- forms
// A standing thing. `at` fills o: [edge distance px (+ inside), height toward the eye px, coordinate, coordinate, material].
export type Obj = { box: [number, number, number, number]; at: (x: number, y: number, o: Float32Array) => void };
export const tube = (c: Curve, pad: number, mat: number): Obj => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (let i = 0; i < c.n; i++) { x0 = Math.min(x0, c.x[i] - c.r[i]); x1 = Math.max(x1, c.x[i] + c.r[i]); y0 = Math.min(y0, c.y[i] - c.r[i]); y1 = Math.max(y1, c.y[i] + c.r[i]); } return { box: [x0 - pad, y0 - pad, x1 + pad, y1 + pad], at: (x, y, o) => { near(c, x, y); const r = NR.r, d = NR.d; o[0] = r - d; o[1] = d < r ? Math.sqrt(r * r - d * d) : 0; o[2] = NR.s; o[3] = d * NR.side; o[4] = mat; } }; };
export const ball = (b: number[], mat: number): Obj => ({ box: [b[0] - b[2] - 3, b[1] - b[2] - 3, b[0] + b[2] + 3, b[1] + b[2] + 3], at: (x, y, o) => { const d = Math.hypot(x - b[0], y - b[1]), r = b[2]; o[0] = r - d; o[1] = d < r ? Math.sqrt(r * r - d * d) : 0; o[2] = x * 0.6; o[3] = y - b[1]; o[4] = mat; } });

// 1. every form's height and edge, kept per form, the highest height at every pixel, and the hollows
export type Raised = ReturnType<typeof raise>;
export const raise = (env: Env, W: number, H: number, objs: Obj[]) => {
  const s = env.scale, DW = Math.round(W * s), DH = Math.round(H * s);
  const b: Bufs = { DW, DH, s, Hg: new Float32Array(DW * DH).fill(-1e9), Ag: new Float32Array(DW * DH), Hb: new Float32Array(DW * DH) };
  const o = new Float32Array(5);
  const local = objs.map((ob) => { const x0 = Math.max(0, Math.floor(ob.box[0] * s)), y0 = Math.max(0, Math.floor(ob.box[1] * s)), x1 = Math.min(DW, Math.ceil(ob.box[2] * s)), y1 = Math.min(DH, Math.ceil(ob.box[3] * s)), w = x1 - x0, h = y1 - y0; const E = new Float32Array(w * h), Hh = new Float32Array(w * h), A1 = new Float32Array(w * h), A2 = new Float32Array(w * h), Mt = new Uint8Array(w * h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { ob.at((x0 + i + 0.5) / s, (y0 + j + 0.5) / s, o); const k = j * w + i; E[k] = o[0]; Hh[k] = o[1]; A1[k] = o[2]; A2[k] = o[3]; Mt[k] = o[4]; if (o[0] > 0) { const g = (y0 + j) * DW + x0 + i; if (o[1] > b.Hg[g]) b.Hg[g] = o[1]; const a = cl(o[0] * s + 0.5); if (a > b.Ag[g]) b.Ag[g] = a; } }
    return { x0, y0, w, h, E, Hh, A1, A2, Mt }; });

  // the hollows: where a point sits below the average height round it, less sky reaches it
  { const R = Math.round(11 * s), tmp = new Float32Array(DW * DH), n = 2 * R + 1;
    for (let j = 0; j < DH; j++) { let acc = 0; const row = j * DW; for (let i = -R; i < DW; i++) { const a = i + R < DW ? Math.max(0, b.Hg[row + i + R]) : 0, d = i - R - 1 >= 0 ? Math.max(0, b.Hg[row + i - R - 1]) : 0; acc += a - d; if (i >= 0) tmp[row + i] = acc / n; } }
    for (let i = 0; i < DW; i++) { let acc = 0; for (let j = -R; j < DH; j++) { const a = j + R < DH ? tmp[(j + R) * DW + i] : 0, d = j - R - 1 >= 0 ? tmp[(j - R - 1) * DW + i] : 0; acc += a - d; if (j >= 0) b.Hb[j * DW + i] = acc / n; } } }
  return { s, DW, DH, b, local };
};

// 2. paint each form, back to front, into one layer. `paint` is YOURS: it reads the material and leaves a
// linear colour in OUT. `idOf` names the owner of each pixel (default: the form's place in the list + 1);
// `each` runs after a pixel is shaded, for a picture that needs a second reading of it.
export type Painter = (b: Bufs, mat: number, x: number, y: number, h: number, nx: number, ny: number, nz: number, a1: number, a2: number, e: number) => void;
export type Local = Raised["local"][number];
export const paintForms = (env: Env, R: Raised, paint: Painter, opts: { idOf?: (li: number, mat: number) => number; each?: (li: number, L: Local, k: number, x: number, y: number, h: number, nx: number, ny: number, nz: number, e: number, tone: (v: number) => number) => void } = {}) => {
  const { s, DW, DH, b, local } = R;
  const GAM = new Uint8ClampedArray(4097); for (let i = 0; i <= 4096; i++) GAM[i] = Math.round(255 * Math.pow(i / 4096, 1 / 2.2));
  const tone = (v: number) => GAM[Math.round(4096 * (1 - Math.exp(-1.35 * Math.max(0, v))))];
  const objL = env.canvas(DW, DH), img = objL.ctx.createImageData(DW, DH), px = img.data, oid = new Uint8Array(DW * DH);
  for (let li = 0; li < local.length; li++) { const L = local[li]; for (let j = 1; j < L.h - 1; j++) for (let i = 1; i < L.w - 1; i++) { const k = j * L.w + i, e = L.E[k]; if (e * s < -0.5) continue; const a = cl(e * s + 0.5), h = L.Hh[k];
    const m = L.Mt[k], ml = L.Mt[k - 1] === m, mr = L.Mt[k + 1] === m, mu = L.Mt[k - L.w] === m, md = L.Mt[k + L.w] === m;
    let nx = -s * (ml && mr ? (L.Hh[k + 1] - L.Hh[k - 1]) / 2 : mr ? L.Hh[k + 1] - h : ml ? h - L.Hh[k - 1] : 0), ny = -s * (mu && md ? (L.Hh[k + L.w] - L.Hh[k - L.w]) / 2 : md ? L.Hh[k + L.w] - h : mu ? h - L.Hh[k - L.w] : 0), nz = 1; const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
    const x = (L.x0 + i + 0.5) / s, y = (L.y0 + j + 0.5) / s; paint(b, m, x, y, h, nx, ny, nz, L.A1[k], L.A2[k], e);
    const g = ((L.y0 + j) * DW + L.x0 + i) * 4, r = tone(OUT[0]), gg = tone(OUT[1]), bb = tone(OUT[2]), a0 = px[g + 3] / 255, ao = a + a0 * (1 - a);
    if (a > 0.02) oid[g >> 2] = opts.idOf ? opts.idOf(li, m) : li + 1;
    if (opts.each) opts.each(li, L, k, x, y, h, nx, ny, nz, e, tone);
    px[g] = (r * a + px[g] * a0 * (1 - a)) / ao; px[g + 1] = (gg * a + px[g + 1] * a0 * (1 - a)) / ao; px[g + 2] = (bb * a + px[g + 2] * a0 * (1 - a)) / ao; px[g + 3] = ao * 255; } }
  objL.ctx.putImageData(img, 0, 0);
  return { objL, px, oid };
};

// ---------------------------------------------------------------- the surface
// the surface: a fine linen under thin paint, and the corners a little sunk, as old varnish does
export const surface = (ctx: Ctx, env: Env, W = 1600, H = 2000) => { const s = env.scale, g = new Gfx(ctx, env, 0, PENCIL); weave(g, 0.04); g.paper("paper", 0.05);
  ctx.setTransform(s, 0, 0, s, 0, 0); ctx.globalCompositeOperation = "multiply"; const vg = ctx.createRadialGradient(W * 0.46, H * 0.44, H * 0.34, W * 0.5, H * 0.5, H * 0.76); vg.addColorStop(0, "rgba(255,255,255,1)"); vg.addColorStop(1, "rgba(150,128,112,1)"); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H); ctx.globalCompositeOperation = "source-over"; ctx.setTransform(1, 0, 0, 1, 0, 0); };

// ---------------------------------------------------------------- film: a brush laying a ground in rows
// The region painted so far: whole rows above, and the row in hand as far as the brush has got.
// Rows run left to right, then right to left; their lower edge wavers as a hand's does.
export const wav = (x: number, row: number) => 6 * Math.sin(x * 0.011 + row * 1.7) + 3 * Math.sin(x * 0.037 + row);
export const rows = (ctx: Ctx, x0: number, y0: number, x1: number, y1: number, band: number, p: number) => {
  const n = Math.ceil((y1 - y0) / band), q = cl(p) * n, k = Math.min(n, Math.floor(q)), fr = q - k;
  ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip(); ctx.beginPath();
  if (k > 0) { const yb = y0 + k * band; ctx.moveTo(x0, y0 - 20); ctx.lineTo(x1, y0 - 20); for (let x = x1; x >= x0 - 40; x -= 40) ctx.lineTo(x, k >= n ? y1 + 20 : yb + wav(x, k)); ctx.closePath(); }
  if (k < n && fr > 0) { const yt = y0 + k * band - 12, yb = y0 + (k + 1) * band, ltr = k % 2 === 0, xf = ltr ? x0 + fr * (x1 - x0 + 60) : x1 - fr * (x1 - x0 + 60), xs = ltr ? x0 - 10 : x1 + 10, dir = ltr ? 1 : -1;
    ctx.moveTo(xs, yt); ctx.lineTo(xf, yt); ctx.quadraticCurveTo(xf + dir * 26, (yt + yb) / 2, xf - dir * 6, yb + wav(xf, k + 1)); for (let x = xf - dir * 6; dir * (x - xs) > 0; x -= dir * 40) ctx.lineTo(x, yb + wav(x, k + 1)); ctx.lineTo(xs, yb + wav(xs, k + 1)); ctx.closePath(); }
  ctx.clip();
};
export const laid = (ctx: Ctx, s: number, src: Layer, f: number, cue: number[], region: number[], band: number, alpha: number) => { if (f <= cue[0]) return; ctx.save(); ctx.setTransform(s, 0, 0, s, 0, 0); rows(ctx, region[0], region[1], region[2], region[3], band, (f - cue[0]) / (cue[1] - cue[0])); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = alpha; ctx.drawImage(src.canvas, 0, 0); ctx.restore(); };

// ---------------------------------------------------------------- film: forms, laid in shadow and worked up to the light
// For every pixel a form owns: when the small brush reaches it (its place in the rows) and whose it is.
// A form is first laid in its shadow tone; then a ceiling on lightness rises across it, so shadows
// finish first and highlights last. Nothing fades.
export type Plan = { idx: Uint32Array; ord: Float32Array; who: Uint8Array; img: ImageData; L: Layer };
export const workPlan = (env: Env, key: string, DW: number, DH: number, src: Uint8ClampedArray, idOf: (g: number) => number, boxOf: (id: number) => number[], bandOf: (id: number) => number): Plan => {
  const ck = `${key}@${env.scale}`; let P = env.cache.get(ck) as Plan | undefined; if (P) return P;
  const s = env.scale; let n = 0; for (let g = 0; g < DW * DH; g++) if (src[g * 4 + 3] > 0 && idOf(g)) n++;
  const idx = new Uint32Array(n), ord = new Float32Array(n), who = new Uint8Array(n); let m = 0;
  for (let j = 0; j < DH; j++) for (let i = 0; i < DW; i++) { const g = j * DW + i, id = idOf(g); if (!(src[g * 4 + 3] > 0 && id)) continue; const x = (i + 0.5) / s, y = (j + 0.5) / s;
    const box = boxOf(id), band = bandOf(id), nr = Math.max(1, Math.ceil((box[3] - box[1]) / band)), yy = y - box[1] + 0.45 * wav(x * 3, id), row = cl(Math.floor(yy / band), 0, nr - 1), fx = cl((x - box[0]) / (box[2] - box[0]));
    idx[m] = g; who[m] = id; ord[m] = band >= 100 ? 0 : (row + (row % 2 ? 1 - fx : fx)) / nr; m++; } // a band of 100 or more: the whole form at one touch
  const L = env.canvas(DW, DH); P = { idx, ord, who, img: L.ctx.createImageData(DW, DH), L }; env.cache.set(ck, P); return P;
};
export const SHADE = 0.4; // the shadow tone a form is laid in with, as a ceiling on its lightness
// cueOf(id) gives [laid in from, to, worked up from, to] in frames. `swap` may hand back another colour for a pixel (m is its index in the plan).
export const workUp = (ctx: Ctx, P: Plan, src: Uint8ClampedArray, f: number, cueOf: (id: number) => number[] | undefined, swap?: (m: number) => ArrayLike<number> | null) => {
  const d = P.img.data, pu = new Float32Array(256).fill(-1), pm = new Float32Array(256); let any = false;
  for (let id = 0; id < 256; id++) { const c = cueOf(id); if (!c) continue; pu[id] = cl((f - c[0]) / (c[1] - c[0])); pm[id] = cl((f - c[2]) / (c[3] - c[2])); if (pu[id] > 0) any = true; }
  if (!any) return;
  for (let m = 0; m < P.idx.length; m++) { const g = P.idx[m] * 4, id = P.who[m], o = P.ord[m], u = pu[id];
    if (u <= 0 || (u < 1 && u * 1.0001 <= o)) { d[g + 3] = 0; continue; }
    let r = src[g], gg = src[g + 1], b = src[g + 2];
    if (swap) { const q = swap(m); if (q) { r = q[0]; gg = q[1]; b = q[2]; } }
    if (pm[id] < 1) { const t = cl((pm[id] * 1.4 - o) / 0.4), cap = SHADE + (1 - SHADE) * t * t * (3 - 2 * t), l = Math.max(r, gg, b) / 255, q = l > cap ? cap / l : 1; r *= q; gg *= q; b *= q; }
    d[g] = r; d[g + 1] = gg; d[g + 2] = b; d[g + 3] = src[g + 3]; }
  P.L.ctx.putImageData(P.img, 0, 0); ctx.drawImage(P.L.canvas, 0, 0);
};
