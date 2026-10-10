import { type Ctx, type Env, type Layer } from "./core";
import { Film } from "./film";
import { AX0, AY0, CAMH, COPIES, CT, DOT1, DOT2, F, H, MX, MY, OBJS, Q1, Q2, RIMW, S, SCROLL, ST, W, WIN, YH, Z0, backRim, built, cl, copyLayer, crown, drawDreamGlaze, halfW, hash2, lashLine, mouthLine, ridge, scrollW, signature, sm, smallThings, surface, type Built, type Curve } from "./dreamGlaze";

// THE SOFT SELF-PORTRAIT, PAINTED · the same picture, in the order its hand works.
//
// ORDER (resin-oil glazes, a very small brush): a white primed panel; the drawing, in thin umber;
// the sky laid twice, a thin glaze and then the full one, in rows from the top; the plain the same
// way; then each form, furthest first, laid in its shadow tone; the cast shadows; the handwriting
// written along the scroll; the small things on the plain; the face worked up dark to light, last
// and slowest; the spark lit; the signature. The last second is the still, pixel for pixel.

const FPS = 30, N = 810, HOLD = 780;
// every frame number in the film lives here
const CUE = {
  draw: [6, 104], drawFar: [104, 122],
  sky1: [122, 188], sky2: [188, 252], plain1: [252, 300], plain2: [300, 346],
  far: [346, 392],
  // [underpaint from, to, worked up from, to], by owner: Q2, Q1, dot 2, dot 1, scroll, inside, mask, night
  form: [[392, 416, 410, 444], [402, 426, 420, 454], [426, 434, 434, 452], [430, 438, 438, 456], [440, 486, 474, 534], [486, 506, 500, 534], [520, 600, 640, 752], [752, 758, 756, 780]],
  shadows: [560, 650], write: [610, 710], stones: [660, 700], figure: [690, 716], sign: [750, 778],
};
// what the drawing's lines belong to, and the frame by which paint has covered them
const GONE: Record<string, number> = { rock: 252, horizon: 346, far: 392, q: 456, scroll: 486, mask: 600 };
for (const v of Object.values(CUE).flat(2) as number[]) if (!(v >= 0 && v <= HOLD)) throw new Error(`dreamGlazeDraw: cue ${v} is outside the film`);

// ---------------------------------------------------------------- the drawing under the paint
type Line = { pts: number[][]; len: number; grp: string; t0: number; t1: number };
const uv = (u: number, v: number) => { const X = u * CT - v * ST, Y = u * ST + v * CT; return [MX + X * S, MY + Y * S]; };
const hull = (c: Curve, wOf: (s: number, r: number) => number) => { const a: number[][] = [], b: number[][] = []; for (let i = 0; i < c.n; i++) { const j = Math.min(c.n - 1, i + 1), k = Math.max(0, i - 1), dx = c.x[j] - c.x[k], dy = c.y[j] - c.y[k], l = Math.hypot(dx, dy) || 1, w = wOf(c.s[i], c.r[i]); a.push([c.x[i] - (dy / l) * w, c.y[i] + (dx / l) * w]); b.push([c.x[i] + (dy / l) * w, c.y[i] - (dx / l) * w]); } return [...a, ...b.reverse(), a[0]]; };
const ring = (d: number[]) => Array.from({ length: 25 }, (_, i) => [d[0] + Math.cos((i / 24) * Math.PI * 2) * d[2], d[1] + Math.sin((i / 24) * Math.PI * 2) * d[2]]);
const span = (n: number, f: (t: number) => number[]) => Array.from({ length: n + 1 }, (_, i) => f(i / n));
const GROUP: [string, number[][]][] = (() => {
  const out: [string, number[][]][] = [];
  out.push(["mask", [...span(40, (t) => uv(-halfW(-0.6 + 1.299 * t), -0.6 + 1.299 * t)), ...span(40, (t) => uv(halfW(0.699 - 1.299 * t), 0.699 - 1.299 * t))]]);
  out.push(["mask", span(48, (t) => uv(RIMW - 2 * RIMW * t, crown(RIMW - 2 * RIMW * t)))]);
  out.push(["mask", span(32, (t) => uv(-RIMW + 2 * RIMW * t, backRim(-RIMW + 2 * RIMW * t)))]);
  out.push(["mask", [uv(WIN.u0, WIN.v0), uv(WIN.u1, WIN.v0), uv(WIN.u1, WIN.v1), uv(WIN.u0, WIN.v1), uv(WIN.u0, WIN.v0)]]);
  for (const sg of [-1, 1]) { out.push(["mask", span(14, (t) => { const bx = -1.05 + 2.15 * t; return uv(sg * (0.215 + 0.15 * bx), -0.262 + 0.06 * bx * bx - 0.012 * bx); })]); out.push(["mask", span(14, (t) => { const au = 0.218 + 0.095 * (-1.1 + 2.2 * t); return uv(sg * au, lashLine(au)); })]); }
  out.push(["mask", [uv(0.03, -0.2), uv(0.04, 0), uv(0.06, 0.14), uv(0.11, 0.2), uv(0.08, 0.235), uv(0, 0.245), uv(-0.08, 0.235), uv(-0.11, 0.2), uv(-0.085, 0.16)]]);
  out.push(["mask", span(16, (t) => { const u = -0.165 + 0.33 * t; return uv(u, mouthLine(u)); })]);
  out.push(["mask", span(10, (t) => { const u = -0.1 + 0.2 * t; return uv(u, 0.476 - 2 * u * u); })]);
  out.push(["q", hull(Q1, (_s, r) => r)], ["q", ring(DOT1)], ["scroll", hull(SCROLL, scrollW)], ["q", hull(Q2, (_s, r) => r)], ["q", ring(DOT2)]);
  return out;
})();
const LINES: Line[] = (() => {
  const near: [string, number[][]][] = [["horizon", [[0, YH], [W, YH]]], ["rock", span(70, (t) => { const x = 905 + 695 * t; return [x, YH - ridge(x)]; })], ["rock", span(24, (t) => { const x = 0 + 345 * t; return [x, YH - ridge(x)]; })], ...GROUP];
  const far: [string, number[][]][] = []; for (const [z, ax] of [...COPIES].reverse()) { const k = Z0 / z, ay = YH + (F * CAMH) / z; for (const [, p] of GROUP) far.push(["far", p.map(([x, y]) => [ax + (x - AX0) * k, ay + (y - AY0) * k])]); }
  const lay = (set: [string, number[][]][], a: number, b: number) => { const L = set.map(([grp, pts]) => { let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return { pts, len, grp, t0: 0, t1: 0 }; }), cost = L.map((l) => 1.5 + Math.pow(l.len, 0.55)), sum = cost.reduce((p, c) => p + c, 0); let t = a; L.forEach((l, i) => { l.t0 = t; t += ((b - a) * cost[i]) / sum; l.t1 = t; }); return L; }; // a long line is drawn fast, a short one slowly
  return [...lay(near, CUE.draw[0], CUE.draw[1]), ...lay(far, CUE.drawFar[0], CUE.drawFar[1])];
})();
const drawing = (ctx: Ctx, s: number, f: number) => {
  ctx.setTransform(s, 0, 0, s, 0, 0); ctx.strokeStyle = "rgba(104,64,36,0.88)"; ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (const l of LINES) { if (f <= l.t0 || f >= GONE[l.grp]) continue; const p = f >= l.t1 ? 1 : (f - l.t0) / (l.t1 - l.t0); let left = p * l.len; ctx.lineWidth = l.grp === "far" ? 0.9 : 1.7; ctx.beginPath(); ctx.moveTo(l.pts[0][0], l.pts[0][1]);
    for (let i = 1; i < l.pts.length && left > 0; i++) { const a = l.pts[i - 1], b = l.pts[i], d = Math.hypot(b[0] - a[0], b[1] - a[1]), k = d <= left ? 1 : left / d; ctx.lineTo(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k); left -= d; } ctx.stroke(); }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
};

// ---------------------------------------------------------------- a brush laying a ground in rows
// The region painted so far: whole rows above, and the row in hand as far as the brush has got.
// Rows run left to right, then right to left; their lower edge wavers as a hand's does.
const wav = (x: number, row: number) => 6 * Math.sin(x * 0.011 + row * 1.7) + 3 * Math.sin(x * 0.037 + row);
const rows = (ctx: Ctx, x0: number, y0: number, x1: number, y1: number, band: number, p: number) => {
  const n = Math.ceil((y1 - y0) / band), q = cl(p) * n, k = Math.min(n, Math.floor(q)), fr = q - k;
  ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip(); ctx.beginPath();
  if (k > 0) { const yb = y0 + k * band; ctx.moveTo(x0, y0 - 20); ctx.lineTo(x1, y0 - 20); for (let x = x1; x >= x0 - 40; x -= 40) ctx.lineTo(x, k >= n ? y1 + 20 : yb + wav(x, k)); ctx.closePath(); }
  if (k < n && fr > 0) { const yt = y0 + k * band - 12, yb = y0 + (k + 1) * band, ltr = k % 2 === 0, xf = ltr ? x0 + fr * (x1 - x0 + 60) : x1 - fr * (x1 - x0 + 60), xs = ltr ? x0 - 10 : x1 + 10, dir = ltr ? 1 : -1;
    ctx.moveTo(xs, yt); ctx.lineTo(xf, yt); ctx.quadraticCurveTo(xf + dir * 26, (yt + yb) / 2, xf - dir * 6, yb + wav(xf, k + 1)); for (let x = xf - dir * 6; dir * (x - xs) > 0; x -= dir * 40) ctx.lineTo(x, yb + wav(x, k + 1)); ctx.lineTo(xs, yb + wav(xs, k + 1)); ctx.closePath(); }
  ctx.clip();
};
const laid = (ctx: Ctx, s: number, src: Layer, f: number, cue: number[], region: number[], band: number, alpha: number) => { if (f <= cue[0]) return; ctx.save(); ctx.setTransform(s, 0, 0, s, 0, 0); rows(ctx, region[0], region[1], region[2], region[3], band, (f - cue[0]) / (cue[1] - cue[0])); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = alpha; ctx.drawImage(src.canvas, 0, 0); ctx.restore(); };

// ---------------------------------------------------------------- the forms, dark to light
// For every pixel a form owns: when the small brush reaches it (its place in the rows), and how
// light it is. A form is first laid in its shadow tone; then the lights are worked up across it.
type Plan = { idx: Uint32Array; ord: Float32Array; lum: Float32Array; who: Uint8Array; sIdx: Int32Array; img: ImageData; L: Layer };
const BAND = [9, 9, 5, 5, 15, 12, 19, 100];
const plan = (B: Built, env: Env): Plan => {
  const key = `dreamGlazeDraw:plan@${env.scale}`; let P = env.cache.get(key) as Plan | undefined; if (P) return P;
  const s = env.scale, { DW, DH, px, oid, SL } = B; let n = 0; for (let i = 0; i < DW * DH; i++) if (px[i * 4 + 3] > 0 && oid[i]) n++;
  const idx = new Uint32Array(n), ord = new Float32Array(n), lum = new Float32Array(n), who = new Uint8Array(n), sIdx = new Int32Array(n); let m = 0;
  for (let j = 0; j < DH; j++) for (let i = 0; i < DW; i++) { const g = j * DW + i, id = oid[g]; if (!(px[g * 4 + 3] > 0 && id)) continue; const x = (i + 0.5) / s, y = (j + 0.5) / s;
    const box = id === 8 ? [0, 0, W, H] : OBJS[id - 1].box, band = BAND[id - 1], nr = Math.max(1, Math.ceil((box[3] - box[1]) / band)), yy = y - box[1] + 0.45 * wav(x * 3, id), row = cl(Math.floor(yy / band), 0, nr - 1), fx = cl((x - box[0]) / (box[2] - box[0]));
    idx[m] = g; who[m] = id; ord[m] = id === 8 ? 0 : (row + (row % 2 ? 1 - fx : fx)) / nr; lum[m] = Math.max(px[g * 4], px[g * 4 + 1], px[g * 4 + 2]) / 255;
    sIdx[m] = id === 5 && i >= SL.x0 && i < SL.x0 + SL.w && j >= SL.y0 && j < SL.y0 + SL.h ? (j - SL.y0) * SL.w + (i - SL.x0) : -1; m++; }
  const L = env.canvas(DW, DH); P = { idx, ord, lum, who, sIdx, img: L.ctx.createImageData(DW, DH), L }; env.cache.set(key, P); return P;
};
const SHADE = 0.4; // the shadow tone a form is laid in with, as a ceiling on its lightness
const forms = (ctx: Ctx, B: Built, env: Env, f: number) => {
  if (f <= CUE.form[0][0]) return; const P = plan(B, env), d = P.img.data, { px, bare, SL } = B;
  const pu = CUE.form.map((c) => cl((f - c[0]) / (c[1] - c[0]))), pm = CUE.form.map((c) => cl((f - c[2]) / (c[3] - c[2])));
  // the writing: line after line down the scroll, each one running out along its length
  const SLEN = SCROLL.s[SCROLL.n - 1], penAt = (j: number) => cl((f - (CUE.write[0] + (j + 5) * 7.4)) / 26) * (SLEN + 20);
  for (let m = 0; m < P.idx.length; m++) { const g = P.idx[m] * 4, id = P.who[m] - 1, o = P.ord[m];
    if (pu[id] < 1 && pu[id] * 1.0001 <= o) { d[g + 3] = 0; continue; }
    let r = px[g], gg = px[g + 1], b = px[g + 2];
    const k = P.sIdx[m]; if (k >= 0) { const line = cl(Math.round((SL.A2[k] - 5) / 19), -5, 5); if (SL.A1[k] > penAt(line)) { r = bare[k * 3]; gg = bare[k * 3 + 1]; b = bare[k * 3 + 2]; } }
    if (pm[id] < 1) { const t = cl((pm[id] * 1.4 - o) / 0.4), cap = SHADE + (1 - SHADE) * t * t * (3 - 2 * t), l = Math.max(r, gg, b) / 255, q = l > cap ? cap / l : 1; r *= q; gg *= q; b *= q; }
    d[g] = r; d[g + 1] = gg; d[g + 2] = b; d[g + 3] = px[g + 3]; }
  P.L.ctx.putImageData(P.img, 0, 0); ctx.drawImage(P.L.canvas, 0, 0);
};

export const drawDreamGlazeDraw = (ctx: Ctx, f: number, env: Env) => {
  if (f >= HOLD) { drawDreamGlaze(ctx, 0, env); return; }
  const B = built(env), s = env.scale, sky = [0, 0, W, YH], plain = [0, YH, W, H];
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#f7f2e7"; ctx.fillRect(0, 0, B.DW, B.DH);                                     // the primed panel
  if (f < CUE.sky1[1]) drawing(ctx, s, f);                                                        // under the first thin glaze the drawing still shows
  laid(ctx, s, B.bgN, f, CUE.sky1, sky, 84, 0.6); laid(ctx, s, B.bgN, f, CUE.sky2, sky, 84, 1);
  laid(ctx, s, B.bgN, f, CUE.plain1, plain, 62, 0.6); laid(ctx, s, B.bgN, f, CUE.plain2, plain, 62, 1);
  // cast shadows: painted outward from the things that throw them, the way the light runs
  if (f > CUE.shadows[0]) { const p = (f - CUE.shadows[0]) / (CUE.shadows[1] - CUE.shadows[0]), xf = -200 + p * (W + 260); ctx.save(); ctx.setTransform(s, 0, 0, s, 0, 0); ctx.beginPath(); ctx.moveTo(-10, YH); ctx.lineTo(xf + 200, YH); ctx.quadraticCurveTo(xf + 40, (YH + H) / 2, xf - 60, H + 10); ctx.lineTo(-10, H + 10); ctx.closePath(); ctx.clip(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(B.bgL.canvas, 0, 0); ctx.restore(); }
  if (f >= CUE.sky1[1]) drawing(ctx, s, f);
  // the further masks, furthest first, each laid in rows
  if (f > CUE.far[0]) { const each = (CUE.far[1] - CUE.far[0]) / COPIES.length; COPIES.forEach(([z, ax], i) => { const a = CUE.far[0] + i * each; if (f <= a) return; const k = Z0 / z, ay = YH + (F * CAMH) / z, T = copyLayer(B, env, z, ax); ctx.save(); ctx.setTransform(s, 0, 0, s, 0, 0); rows(ctx, ax + (330 - AX0) * k, ay + (300 - AY0) * k, ax + (1460 - AX0) * k, ay + 4, Math.max(5, 46 * k), (f - a) / each); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(T.canvas, 0, 0); ctx.restore(); }); }
  if (f > CUE.stones[0]) smallThings(ctx, env, Math.ceil(((f - CUE.stones[0]) / (CUE.stones[1] - CUE.stones[0])) * 12), cl((f - CUE.figure[0]) / (CUE.figure[1] - CUE.figure[0])));
  if (f > CUE.sign[0]) signature(ctx, env, (f - CUE.sign[0]) / (CUE.sign[1] - CUE.sign[0]));
  forms(ctx, B, env, f);
  surface(ctx, env);
};

export const dreamGlazeDraw: Film = {
  meta: { title: "dreamGlazeDraw", W, H, fps: FPS, bpm: 60, durationFrames: N, raster: "cpu", kind: "drawing", holds: [[CUE.form[7][2], N, "only the spark and the signature are still being finished, both too small to measure; then the painting rests"]] },
  assets: { images: {} },
  shots: [{ id: "dreamGlazeDraw", start: 0, end: N, draw: drawDreamGlazeDraw }],
};
