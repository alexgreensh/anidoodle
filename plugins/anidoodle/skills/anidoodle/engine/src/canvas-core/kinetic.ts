// KINETIC. Illustrated, animated display lettering for the launch film: every word is written, a
// stroke at a time, by a visible tool in one of anidoodle's own media, and every letter lands with
// a little life (a pop as it completes, its own tilt and baseline). No font draws the display type:
// the skeletons are drafting.ts's single-stroke capitals (G), the medium is all here.
//
// All functions draw in SCREEN (logical) coordinates: they set the transform to env.scale themselves
// and leave it there. Pure functions of their arguments; randomness only from rng(seed).
//
//   writeOn(ctx, env, text, x, y, size, p, style, opts)   size = cap height, (x, y) = baseline anchor
//   sentence(ctx, env, words, frame, t0, opts)            the finale, one medium per word, one per beat
//   logo(ctx, env, x, y, em, p, opts)                     the anidoodle wordmark, written by a dip pen
//   logoBug(ctx, env, frame, x, y, scale, opts)           the wordmark as a corner mark that lives
//   caption(ctx, env, text, x, y, size, p, kind, opts)    a small hand-lettered callout, underline or arrow
import { fractal, probeRect, rng, sample, type Ctx, type Env, type Layer, type P } from "./core";
import { G, type Glyph } from "./drafting";
import { DOT, TAIL, WORD, inkStroke, outlineOf, type Nib } from "./lettering";
import { typeExit } from "./motionKit";

export type KStyle = "ink" | "crayon" | "thread" | "chalk" | "brick" | "marker";
// `out` 0..1 is a written line's exit, as setType's: the line sinks behind its own baseline on the same
// ease-in (motionKit.typeExit, 1.3x its size) and stops reporting itself to the frame probe while it leaves
export type WriteOpts = { color?: string; align?: "left" | "center" | "right"; slant?: number; track?: number; seed?: number; tool?: boolean; weight?: number; pop?: number; out?: number };

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => { const c = clamp(t); return c * c * (3 - 2 * c); };
const out3 = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
const hx = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const shade = (h: string, k: number) => { const c = hx(h).map((v) => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))); return `rgb(${c[0]},${c[1]},${c[2]})`; };
const rgba = (h: string, a: number) => { const c = hx(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
// a spring that settles to 0 from a kick of 1: the pop a letter makes as it lands
const pop = (t: number, omega = 0.55, zeta = 0.42) => (t <= 0 ? 0 : Math.exp(-zeta * omega * t) * Math.sin(omega * Math.sqrt(1 - zeta * zeta) * t));
const screen = (ctx: Ctx, env: Env) => ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0);

// ---------------------------------------------------------------- glyph geometry
// A line of text as strokes in screen space, in writing order, each densified to ~2 px steps and
// tagged with its glyph, plus the glyph boxes (for the pop) and the total width.
type KStroke = { pts: P[]; len: number[]; L: number; glyph: number };
type Layout = { strokes: KStroke[]; boxes: { c: P; w: number; firstS: number; lastS: number }[]; W: number; total: number };
const GAP = 14; // px of "pen lift" between strokes: the nib travels, nothing is drawn
const glyphOf = (ch: string): Glyph => G[ch.toUpperCase()] ?? G[ch] ?? G["-"];
const densify = (pts: P[], step: number): P[] => { const out: P[] = [pts[0]]; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)); for (let k = 1; k <= n; k++) out.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]); } return out; };
const cum = (pts: P[]) => { const l = [0]; for (let i = 1; i < pts.length; i++) l.push(l[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return l; };
// Optical spacing. Letters are spaced by their ink, not their boxes: between two letters the mean gap
// across the cap height is the same (the track plus AIR, room for the nib's weight), so an open side
// (C, the arms of T, the slopes of A) no longer leaves a hole and a narrow letter (I) no longer floats.
// A side's hollow counts at most CAP units deep, and ink never comes closer than MIN_GAP to its
// neighbour's. A space, or a mark with no ink, keeps its box.
export const SPACING = { BANDS: 12, CAP: 1, MIN_GAP: 1.25, AIR: 0.8 };
const { BANDS, CAP, MIN_GAP, AIR } = SPACING;
type Profile = { L: number[]; R: number[]; ink: boolean[]; mL: number; mR: number } | null;
const profiles = new Map<string, Profile>();
export const profileOf = (ch: string): Profile => {
  const key = ch.toUpperCase() in G ? ch.toUpperCase() : ch in G ? ch : "-";
  let pr = profiles.get(key);
  if (pr !== undefined) return pr;
  const gl = glyphOf(ch), pts = [...(gl.l ?? []).map((st) => densify(st, 0.05)), ...(gl.c ?? []).map((st) => densify(sample(st, false, 10), 0.05))].flat();
  if (!pts.length) { profiles.set(key, null); return null; }
  const L = Array(BANDS).fill(Infinity), R = Array(BANDS).fill(-Infinity);
  for (const [x, y] of pts) { const b = Math.max(0, Math.min(BANDS - 1, Math.floor((y / 6) * BANDS))); L[b] = Math.min(L[b], x); R[b] = Math.max(R[b], x); }
  const ink = L.map((v) => v < Infinity), lo = Math.min(...L.filter((_, i) => ink[i])), hi = Math.max(...R.filter((_, i) => ink[i]));
  const cl = L.map((v, i) => (ink[i] ? Math.min(v, lo + CAP) : lo + CAP)), cr = R.map((v, i) => (ink[i] ? Math.max(v, hi - CAP) : hi - CAP));
  pr = { L, R, ink, mL: cl.reduce((a, v) => a + v, 0) / BANDS, mR: cr.reduce((a, v) => a + v, 0) / BANDS };
  profiles.set(key, pr); return pr;
};
/** How far the next letter's origin sits from this one's, in glyph units. */
export const advance = (a: string, b: string, tr: number) => {
  const pa = profileOf(a), pb = profileOf(b);
  if (!pa || !pb) return (glyphOf(a).w ?? 4) + tr;
  let o = tr + AIR + pa.mR - pb.mL;
  for (let i = 0; i < BANDS; i++) if (pa.ink[i] && pb.ink[i]) o = Math.max(o, pa.R[i] - pb.L[i] + MIN_GAP);
  return o;
};
export const measure = (text: string, size: number, o: WriteOpts = {}) => { const s = size / 6, tr = o.track ?? 1.5, cs = [...text]; return (cs.reduce((a, ch, i) => a + (i < cs.length - 1 ? advance(ch, cs[i + 1], tr) : glyphOf(ch).w ?? 4), 0) + 6 * (o.slant ?? 0.12)) * s; }; // + the slant's overhang at the cap line
const layout = (env: Env, text: string, x: number, y: number, size: number, o: WriteOpts): Layout => {
  const key = `kin:${text}|${x}|${y}|${size}|${o.align}|${o.slant}|${o.track}|${o.seed}`; const hit = env.cache.get(key) as Layout | undefined; if (hit) return hit;
  const s = size / 6, tr = o.track ?? 1.5, sl = o.slant ?? 0.12, r = rng((o.seed ?? 1) * 977 + 3), W = measure(text, size, o);
  let cx = o.align === "center" ? x - W / 2 : o.align === "right" ? x - W : x;
  const strokes: KStroke[] = [], boxes: Layout["boxes"] = [];
  const cs = [...text];
  cs.forEach((ch, ci) => {
    const gl = glyphOf(ch), gw = (gl.w ?? 4) * s, dy = (r() - 0.5) * size * 0.06, rot = (r() - 0.5) * 0.07, k = 1 + (r() - 0.5) * 0.06, gc: P = [cx + gw / 2, y - size / 2 + dy];
    // glyph units -> screen: scale, the forward slant, a per-letter tilt and baseline wander about its centre
    const T = ([px, py]: P): P => { const X = cx + (px + (6 - py) * sl) * s * k, Y = y - size + dy + py * s * k, ax = X - gc[0], ay = Y - gc[1]; return [gc[0] + ax * Math.cos(rot) - ay * Math.sin(rot), gc[1] + ax * Math.sin(rot) + ay * Math.cos(rot)]; };
    const first = strokes.length;
    (gl.l ?? []).forEach((st) => { const pts = densify(st.map(T), 2); strokes.push({ pts, len: cum(pts), L: 0, glyph: boxes.length }); });
    (gl.c ?? []).forEach((st) => { const pts = densify(sample(st, false, 10).map(T), 2); strokes.push({ pts, len: cum(pts), L: 0, glyph: boxes.length }); });
    strokes.slice(first).forEach((k2) => (k2.L = k2.len[k2.len.length - 1]));
    boxes.push({ c: gc, w: gw, firstS: first, lastS: strokes.length - 1 });
    if (ci < cs.length - 1) cx += advance(ch, cs[ci + 1], tr) * s;
  });
  const total = strokes.reduce((a, k2) => a + k2.L + GAP, 0);
  const L: Layout = { strokes, boxes, W, total }; env.cache.set(key, L); return L;
};
/** Where a line written in the ink style starts and ends, in px from its left-aligned origin: [left, right]. measure()
 * is the advance width, which starts at the first letter's origin, not its first stroke, so a line centred
 * by measure() sits a side bearing off its axis (the end card's name, a fresh critic's d4-1). */
export const inkSpan = (text: string, size: number, o: WriteOpts = {}): [number, number] => {
  const lay = layout({ cache: new Map() } as unknown as Env, text, 0, size, size, { ...o, align: "left" });
  // (the strokes are the nib's centre line; the ink style's nib is up to 0.115 of the size wide, so its edge
  // reaches half that past them: drawInk's `sh`)
  const pen = size * (o.weight ?? 1) * 0.115 / 2;
  let lo = Infinity, hi = -Infinity; for (const k of lay.strokes) for (const [x] of k.pts) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
  return lo <= hi ? [lo - pen, hi + pen] : [0, lay.W];
};
// how much of each stroke is laid at progress p (a constant-speed hand, pen lifts between)
const reach = (lay: Layout, p: number) => { let d = clamp(p) * lay.total; return lay.strokes.map((k) => { const u = clamp(d / k.L); d -= k.L + GAP; return u; }); };
const cut = (k: KStroke, u: number): P[] => { if (u >= 1) return k.pts; const want = u * k.L, out: P[] = [k.pts[0]]; for (let i = 1; i < k.pts.length; i++) { if (k.len[i] <= want) out.push(k.pts[i]); else { const f = (want - k.len[i - 1]) / (k.len[i] - k.len[i - 1] || 1); out.push([k.pts[i - 1][0] + (k.pts[i][0] - k.pts[i - 1][0]) * f, k.pts[i - 1][1] + (k.pts[i][1] - k.pts[i - 1][1]) * f]); break; } } return out.length > 1 ? out : [k.pts[0], k.pts[0]]; };
const tipOf = (lay: Layout, us: number[]): { p: P; ang: number } | null => {
  for (let i = 0; i < lay.strokes.length; i++) if (us[i] > 0 && us[i] < 1) { const c = cut(lay.strokes[i], us[i]), a = c[Math.max(0, c.length - 4)], b = c[c.length - 1]; return { p: b, ang: Math.atan2(b[1] - a[1], b[0] - a[0]) }; }
  // between strokes: the tool hovers over the start of the next one
  for (let i = 0; i < lay.strokes.length; i++) if (us[i] <= 0) return { p: lay.strokes[i].pts[0], ang: 0 };
  return null;
};
// the pop: each glyph kicks a little bigger when its last stroke lands, then settles
const glyphScale = (lay: Layout, us: number[], g: number, p: number, strength: number) => {
  const b = lay.boxes[g], done = us[b.lastS] >= 1; if (!done) return 1;
  // time since completion, in "progress frames": estimate by how far the hand has gone past it
  let d = 0; for (let i = b.lastS + 1; i < lay.strokes.length; i++) d += lay.strokes[i].L * us[i];
  const since = p >= 1 ? 1e9 : d / 18 + 1; return 1 + strength * 0.18 * pop(since);
};
const withGlyph = (ctx: Ctx, lay: Layout, g: number, k: number, fn: () => void) => { if (k === 1) return fn(); const c = lay.boxes[g].c; ctx.save(); ctx.translate(c[0], c[1]); ctx.scale(k, k); ctx.translate(-c[0], -c[1]); fn(); ctx.restore(); };

// ---------------------------------------------------------------- textures (tiled, cached per scale)
const tile = (env: Env, key: string, n: number, fn: (x: number, y: number) => number): Layer => {
  const k = `kin:tile:${key}:${env.scale}`; let L = env.cache.get(k) as Layer | undefined; if (L) return L;
  const N = Math.round(n * env.scale); L = env.canvas(N, N); const img = L.ctx.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const a = clamp(fn(x / env.scale, y / env.scale)), i = (y * N + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = Math.round(a * 255); }
  L.ctx.putImageData(img, 0, 0); env.cache.set(k, L); return L;
};
// wax: holes where the crayon skipped the paper's tooth (alpha 1 = a hole)
const waxHoles = (env: Env) => tile(env, "wax", 96, (x, y) => { const t = fractal(71, x, y, 0.35, 0.12, 2, 96), g = fractal(72, x, y, 0.08, 0.08, 2, 96); return (t + 0.25 * g - 0.74) * 7; });
const chalkHoles = (env: Env) => tile(env, "chalk", 96, (x, y) => { const t = fractal(81, x, y, 0.5, 0.5, 2, 96), g = fractal(82, x, y, 0.06, 0.06, 2, 96); return (t * 0.8 + 0.35 * g - 0.6) * 5; });
// draw fn into a scratch layer, punch the texture out of it, composite it back: a textured medium
const textured = (ctx: Ctx, env: Env, key: string, holes: Layer | null, alpha: number, fn: (c: Ctx) => void) => {
  const DW = Math.round(env.W * env.scale), DH = Math.round(env.H * env.scale), k = `kin:scratch:${key}:${DW}`;
  let L = env.cache.get(k) as Layer | undefined; if (!L) { L = env.canvas(DW, DH); env.cache.set(k, L); }
  const c = L.ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = "source-over"; c.globalAlpha = 1; c.clearRect(0, 0, DW, DH);
  c.setTransform(env.scale, 0, 0, env.scale, 0, 0); fn(c);
  if (holes) { c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = "destination-out"; c.fillStyle = c.createPattern(holes.canvas as CanvasImageSource, "repeat")!; c.fillRect(0, 0, DW, DH); c.globalCompositeOperation = "source-over"; }
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = alpha; ctx.drawImage(L.canvas as CanvasImageSource, 0, 0); ctx.restore(); screen(ctx, env);
};

// ---------------------------------------------------------------- the tools (drawn at the nib)
const toolPen = (ctx: Ctx, tip: P, size: number) => {
  const a = -2.25, L = size * 2.6, back: P = [tip[0] - Math.cos(a) * -L, tip[1] - Math.sin(a) * -L], dx = Math.cos(a + Math.PI), dy = Math.sin(a + Math.PI);
  const at = (t: number, w: number): P => [tip[0] + dx * L * t - dy * w, tip[1] + dy * L * t + dx * w]; void back;
  ctx.save(); ctx.lineCap = "round";
  ctx.strokeStyle = "rgba(40,25,15,0.18)"; ctx.lineWidth = size * 0.09; ctx.beginPath(); ctx.moveTo(...at(0.3, size * 0.06)); ctx.lineTo(...at(1.05, size * 0.12)); ctx.stroke(); // its shadow
  ctx.strokeStyle = "#4a2f26"; ctx.lineWidth = size * 0.085; ctx.beginPath(); ctx.moveTo(...at(0.34, 0)); ctx.lineTo(...at(1, 0)); ctx.stroke();
  ctx.strokeStyle = "#c2a063"; ctx.lineWidth = size * 0.1; ctx.beginPath(); ctx.moveTo(...at(0.22, 0)); ctx.lineTo(...at(0.34, 0)); ctx.stroke();
  const nib: P[] = [at(0, 0), at(0.12, size * 0.035), at(0.23, size * 0.045), at(0.23, -size * 0.045), at(0.12, -size * 0.035)];
  const gr = ctx.createLinearGradient(...at(0.15, size * 0.05), ...at(0.15, -size * 0.05)); gr.addColorStop(0, "#f4f1ea"); gr.addColorStop(0.5, "#a6a098"); gr.addColorStop(1, "#5d5953");
  ctx.fillStyle = gr; ctx.beginPath(); nib.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p))); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#34302a"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(...at(0, 0)); ctx.lineTo(...at(0.13, 0)); ctx.stroke();
  ctx.fillStyle = "#34302a"; ctx.beginPath(); ctx.arc(...at(0.14, 0), size * 0.012, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
};
const toolStick = (ctx: Ctx, tip: P, size: number, body: string, wrap: string | null, len = 1.3, wid = 0.16) => {
  const a = -2.05, dx = Math.cos(a + Math.PI), dy = Math.sin(a + Math.PI), L = size * len, w = size * wid;
  const at = (t: number, s: number): P => [tip[0] + dx * L * t - dy * s, tip[1] + dy * L * t + dx * s];
  ctx.save();
  ctx.fillStyle = "rgba(40,25,15,0.14)"; ctx.beginPath(); [at(0.15, w * 0.7), at(1.05, w * 0.9), at(1.05, -w * 0.3), at(0.15, -w * 0.2)].forEach((p, i) => (i ? ctx.lineTo(p[0] + size * 0.05, p[1] + size * 0.07) : ctx.moveTo(p[0] + size * 0.05, p[1] + size * 0.07))); ctx.closePath(); ctx.fill();
  const g = ctx.createLinearGradient(...at(0.5, w / 2), ...at(0.5, -w / 2)); g.addColorStop(0, shade(body, 0.25)); g.addColorStop(0.5, body); g.addColorStop(1, shade(body, -0.35));
  ctx.fillStyle = g; ctx.beginPath(); [at(0.02, w * 0.12), at(0.16, w / 2), at(1, w / 2), at(1, -w / 2), at(0.16, -w / 2), at(0.02, -w * 0.12)].forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p))); ctx.closePath(); ctx.fill();
  if (wrap) { ctx.fillStyle = wrap; ctx.globalAlpha = 0.92; ctx.beginPath(); [at(0.34, w / 2 + 0.6), at(0.9, w / 2 + 0.6), at(0.9, -w / 2 - 0.6), at(0.34, -w / 2 - 0.6)].forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p))); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = shade(body, -0.3); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(...at(0.5, w / 2)); ctx.lineTo(...at(0.5, -w / 2)); ctx.moveTo(...at(0.74, w / 2)); ctx.lineTo(...at(0.74, -w / 2)); ctx.stroke(); }
  ctx.restore();
};
const toolMarker = (ctx: Ctx, tip: P, size: number, color: string) => {
  toolStick(ctx, tip, size, "#f3f1ec", null, 1.5, 0.22);
  const a = -2.05, dx = Math.cos(a + Math.PI), dy = Math.sin(a + Math.PI), L = size * 1.5, w = size * 0.22;
  const at = (t: number, s: number): P => [tip[0] + dx * L * t - dy * s, tip[1] + dy * L * t + dx * s];
  ctx.fillStyle = color; ctx.beginPath(); [at(0, -w * 0.18), at(0.02, w * 0.2), at(0.1, w * 0.28), at(0.1, -w * 0.28)].forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p))); ctx.closePath(); ctx.fill();
  ctx.fillStyle = color; ctx.fillRect(0, 0, 0, 0); ctx.beginPath(); [at(0.6, w / 2), at(0.72, w / 2), at(0.72, -w / 2), at(0.6, -w / 2)].forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p))); ctx.closePath(); ctx.fill();
};
const toolNeedle = (ctx: Ctx, tip: P, ang: number, size: number, thread: string, from: P | null) => {
  const L = size * 1.25, dx = Math.cos(ang), dy = Math.sin(ang), eye: P = [tip[0] - dx * L, tip[1] - dy * L];
  ctx.save(); ctx.lineCap = "round";
  if (from) { ctx.strokeStyle = thread; ctx.lineWidth = size * 0.022; ctx.beginPath(); ctx.moveTo(...eye); ctx.quadraticCurveTo(eye[0] - dx * size * 0.4 + size * 0.2, eye[1] - dy * size * 0.4 + size * 0.3, from[0], from[1]); ctx.stroke(); }
  ctx.strokeStyle = "rgba(40,25,15,0.2)"; ctx.lineWidth = size * 0.035; ctx.beginPath(); ctx.moveTo(tip[0] + 3, tip[1] + 4); ctx.lineTo(eye[0] + 3, eye[1] + 4); ctx.stroke();
  const g = ctx.createLinearGradient(tip[0], tip[1] - 3, tip[0], tip[1] + 3); g.addColorStop(0, "#fbfbfa"); g.addColorStop(1, "#8d918f");
  ctx.strokeStyle = g; ctx.lineWidth = size * 0.042; ctx.beginPath(); ctx.moveTo(...tip); ctx.lineTo(...eye); ctx.stroke();
  ctx.strokeStyle = "#6c706e"; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(eye[0] + dx * size * 0.06, eye[1] + dy * size * 0.06, size * 0.045, size * 0.012, ang, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
};

// ---------------------------------------------------------------- the media
const PALETTE: Record<KStyle, string> = { ink: "#1b1510", crayon: "#d9412f", thread: "#2f7f86", chalk: "#f3efe2", brick: "#B40000", marker: "#1f6fd1" };
// pointed-pen width along a stroke: only the downstrokes (the pen pulled toward the writer) swell
const penWidths = (pts: P[], hair: number, shadeW: number) => {
  const raw = pts.map((_, i) => { const a = pts[Math.max(0, i - 2)], b = pts[Math.min(pts.length - 1, i + 2)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return Math.pow(clamp(dy / l), 1.5); });
  const K = 4, n = pts.length; return raw.map((_, i) => { let t = 0, c = 0; for (let j = -K; j <= K; j++) { const v = raw[i + j]; if (v !== undefined) { t += v; c++; } } const taper = Math.min(1, i / 3, (n - 1 - i) / 4); return (hair + (shadeW - hair) * (t / c)) * (0.45 + 0.55 * clamp(taper)); });
};
const ribbon = (pts: P[], ws: number[]): P[] => { const L: P[] = [], R: P[] = []; for (let i = 0; i < pts.length; i++) { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l; L.push([pts[i][0] + nx * ws[i], pts[i][1] + ny * ws[i]]); R.push([pts[i][0] - nx * ws[i], pts[i][1] - ny * ws[i]]); } return [...L, ...R.reverse()]; };
const fillPoly = (c: Ctx, pts: P[]) => { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(...p) : c.moveTo(...p))); c.closePath(); c.fill(); };
const polyline = (c: Ctx, pts: P[]) => { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(...p) : c.moveTo(...p))); c.stroke(); };

const drawInk = (c: Ctx, lay: Layout, us: number[], size: number, color: string, p: number, popK: number) => {
  const hair = size * 0.024, sh = size * 0.115;
  lay.strokes.forEach((k, i) => {
    if (us[i] <= 0) return;
    withGlyph(c, lay, k.glyph, glyphScale(lay, us, k.glyph, p, popK), () => {
      const full = penWidths(k.pts, hair, sh), pts = cut(k, us[i]), ws = full.slice(0, pts.length);
      c.fillStyle = color; fillPoly(c, ribbon(pts, ws));
      // a bead where the nib stopped and the ink pooled, and the wet sheen on the fresh stroke
      if (us[i] >= 1) { const e = k.pts[k.pts.length - 1]; c.beginPath(); c.arc(e[0], e[1], Math.max(hair * 1.4, ws[ws.length - 1] * 1.05), 0, Math.PI * 2); c.fill(); }
      else { c.fillStyle = "rgba(255,255,255,0.18)"; fillPoly(c, ribbon(pts.slice(-Math.min(pts.length, 14)), ws.slice(-Math.min(pts.length, 14)).map((w) => w * 0.35))); }
    });
  });
};
const drawMarker = (c: Ctx, lay: Layout, us: number[], size: number, color: string, p: number, popK: number) => {
  const W = size * 0.16, chisel = -0.78;
  lay.strokes.forEach((k, i) => {
    if (us[i] <= 0) return;
    withGlyph(c, lay, k.glyph, glyphScale(lay, us, k.glyph, p, popK), () => {
      const pts = cut(k, us[i]), ws = pts.map((_, j) => { const a = pts[Math.max(0, j - 2)], b = pts[Math.min(pts.length - 1, j + 2)], ang = Math.atan2(b[1] - a[1], b[0] - a[0]); return (W / 2) * (0.4 + 0.6 * Math.abs(Math.sin(ang - chisel))); });
      c.globalAlpha = 0.86; c.fillStyle = color; fillPoly(c, ribbon(pts, ws)); // translucent alcohol ink: overlaps go darker
      c.globalAlpha = 0.35; c.fillStyle = shade(color, 0.35); fillPoly(c, ribbon(pts.map(([x, y]) => [x - W * 0.08, y - W * 0.1] as P), ws.map((w) => w * 0.3))); // the streak of the chisel's lighter edge
      c.globalAlpha = 1;
    });
  });
};
const drawCrayon = (c: Ctx, lay: Layout, us: number[], size: number, color: string, p: number, popK: number, seed: number) => {
  const W = size * 0.13, r = rng(seed);
  lay.strokes.forEach((k, i) => {
    if (us[i] <= 0) return;
    withGlyph(c, lay, k.glyph, glyphScale(lay, us, k.glyph, p, popK), () => {
      const pts = cut(k, us[i]);
      c.lineCap = "round"; c.lineJoin = "round";
      // the wax goes down in a few passes: a body stroke, then the crayon gone over again a hair off
      for (let pass = 0; pass < 3; pass++) {
        const ox = (r() - 0.5) * W * (pass ? 0.22 : 0), oy = (r() - 0.5) * W * (pass ? 0.22 : 0);
        c.strokeStyle = pass === 2 ? shade(color, -0.2) : color; c.globalAlpha = pass === 0 ? 0.95 : 0.55; c.lineWidth = W * (pass === 0 ? 1.15 : 0.6);
        polyline(c, pts.map(([x, y], j) => [x + ox + Math.sin(j * 0.7 + pass) * W * 0.06, y + oy + Math.cos(j * 0.5 + pass) * W * 0.06] as P));
      }
      c.globalAlpha = 1;
    });
  });
};
const drawChalk = (c: Ctx, lay: Layout, us: number[], size: number, color: string, p: number, popK: number, seed: number) => {
  const W = size * 0.11, r = rng(seed);
  lay.strokes.forEach((k, i) => {
    if (us[i] <= 0) return;
    withGlyph(c, lay, k.glyph, glyphScale(lay, us, k.glyph, p, popK), () => {
      const pts = cut(k, us[i]); c.lineCap = "round"; c.lineJoin = "round";
      c.strokeStyle = color; c.globalAlpha = 0.85; c.lineWidth = W; polyline(c, pts);
      c.globalAlpha = 0.5; c.lineWidth = W * 0.45; polyline(c, pts.map(([x, y]) => [x + W * 0.25, y - W * 0.2] as P));
      // dust: fine grains knocked off either side of the line
      c.fillStyle = color; for (let j = 0; j < pts.length; j += 3) { const [x, y] = pts[j]; for (let q = 0; q < 2; q++) { const a = r() * Math.PI * 2, d = W * (0.6 + r() * 1.1); c.globalAlpha = 0.25 * r(); c.fillRect(x + Math.cos(a) * d, y + Math.sin(a) * d, 1.4, 1.4); } }
      c.globalAlpha = 1;
    });
  });
};
// satin stitch laid ACROSS the stroke: each stitch a short twisted thread with a lit side and a shade side
const drawThread = (c: Ctx, lay: Layout, us: number[], size: number, color: string, p: number, popK: number) => {
  const W = size * 0.075, step = size * 0.022, lit = shade(color, 0.35), dark = shade(color, -0.35);
  lay.strokes.forEach((k, i) => {
    if (us[i] <= 0) return;
    withGlyph(c, lay, k.glyph, glyphScale(lay, us, k.glyph, p, popK), () => {
      const pts = cut(k, us[i]), lens = cum(pts), Lh = lens[lens.length - 1]; c.lineCap = "round";
      for (let d = 0, j = 0; d <= Lh; d += step) {
        while (j < lens.length - 2 && lens[j + 1] < d) j++;
        const a = pts[j], b = pts[Math.min(pts.length - 1, j + 1)], tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1, ux = tx / l, uy = ty / l, f = (d - lens[j]) / ((lens[j + 1] ?? lens[j]) - lens[j] || 1);
        const m: P = [a[0] + tx * f, a[1] + ty * f], nx = -uy, ny = ux, sl = 0.45; // stitches slant across the line
        const p0: P = [m[0] + (nx - ux * sl) * W, m[1] + (ny - uy * sl) * W], p1: P = [m[0] - (nx - ux * sl) * W, m[1] - (ny - uy * sl) * W];
        c.strokeStyle = "rgba(40,30,20,0.22)"; c.lineWidth = step * 1.25; c.beginPath(); c.moveTo(p0[0] + 1.5, p0[1] + 2); c.lineTo(p1[0] + 1.5, p1[1] + 2); c.stroke();
        const g = c.createLinearGradient(p0[0], p0[1], p1[0], p1[1]); g.addColorStop(0, lit); g.addColorStop(0.45, color); g.addColorStop(1, dark);
        c.strokeStyle = g; c.lineWidth = step * 1.15; c.beginPath(); c.moveTo(...p0); c.lineTo(...p1); c.stroke();
      }
    });
  });
};
// toy bricks: the letter rasterised onto a stud grid, each 1x1 plate popping in as the "nib" passes
type Cell = { x: number; y: number; t: number; g: number; col: string };
const BRICK_COLS = ["#B40000", "#FAC80A", "#1E5AA8", "#00852B", "#D67923"];
const cellsOf = (env: Env, lay: Layout, size: number, key: string): { cells: Cell[]; s: number } => {
  const k = `kin:cells:${key}`; const hit = env.cache.get(k) as { cells: Cell[]; s: number } | undefined; if (hit) return hit;
  const s = size / 6.5, cells: Cell[] = [];
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; lay.strokes.forEach((st) => st.pts.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }));
  let acc = 0; const starts = lay.strokes.map((st) => { const a = acc; acc += st.L + GAP; return a; });
  for (let gy = Math.floor((y0 - s) / s); gy <= Math.ceil((y1 + s) / s); gy++) for (let gx = Math.floor((x0 - s) / s); gx <= Math.ceil((x1 + s) / s); gx++) {
    const cx = (gx + 0.5) * s, cy = (gy + 0.5) * s; let best = 1e9, bt = 0, bg = 0;
    lay.strokes.forEach((st, si) => { for (let j = 0; j < st.pts.length; j += 2) { const d = Math.hypot(st.pts[j][0] - cx, st.pts[j][1] - cy); if (d < best) { best = d; bt = (starts[si] + st.len[j]) / lay.total; bg = st.glyph; } } });
    if (best < s * 0.7) cells.push({ x: gx * s, y: gy * s, t: bt, g: bg, col: BRICK_COLS[bg % BRICK_COLS.length] });
  }
  const out = { cells: cells.sort((a, b) => a.t - b.t), s }; env.cache.set(k, out); return out;
};
const drawBricks = (c: Ctx, env: Env, lay: Layout, p: number, size: number, key: string, fixed?: string) => {
  const { cells, s } = cellsOf(env, lay, size, key), span = 0.06; // a plate takes 6% of the write to fall and seat
  for (const cl of cells) {
    const u = clamp((p - cl.t + span) / span); if (u <= 0) continue;
    const fall = 1 - out3(u), seat = u >= 1 ? 0 : 0, lift = fall * s * 1.4; void seat;
    const col = fixed ?? cl.col, x = cl.x, y = cl.y - lift, a = u < 1 ? 0.45 + 0.55 * u : 1;
    c.globalAlpha = a * 0.25 * (1 - fall); c.fillStyle = "#000"; c.fillRect(x + s * 0.12, cl.y + s * 0.16, s, s); // its shadow on the ground, sharper as it seats
    c.globalAlpha = a; c.fillStyle = shade(col, -0.22); c.fillRect(x, y, s, s);
    c.fillStyle = col; c.fillRect(x + 1, y + 1, s - 3, s - 3.5);
    c.fillStyle = shade(col, 0.28); c.fillRect(x + 1, y + 1, s - 3, 1.4); c.fillRect(x + 1, y + 1, 1.4, s - 3.5);
    const r = s * 0.3, sx = x + s / 2 - 0.8, sy = y + s / 2 - 1; // the stud: a cylinder seen from above, lit upper left
    c.fillStyle = shade(col, -0.28); c.beginPath(); c.arc(sx + 1, sy + 1.4, r, 0, Math.PI * 2); c.fill();
    c.fillStyle = col; c.beginPath(); c.arc(sx, sy, r, 0, Math.PI * 2); c.fill();
    c.strokeStyle = shade(col, 0.45); c.lineWidth = 1.1; c.beginPath(); c.arc(sx, sy, r * 0.8, Math.PI * 0.95, Math.PI * 1.6); c.stroke();
  }
  c.globalAlpha = 1;
};

// ---------------------------------------------------------------- writeOn
export const writeOn = (ctx: Ctx, env: Env, text: string, x: number, y: number, size: number, p: number, style: KStyle, o: WriteOpts = {}) => {
  const out = Math.max(0, Math.min(1, o.out ?? 0));
  if (p <= 0 || out >= 1) return;
  screen(ctx, env);
  if (style === "brick" && o.track === undefined) o = { ...o, track: 2.6, slant: o.slant ?? 0 };
  // a leaving line is laid out lower by its sink and drawn inside its own window (cap height plus the
  // ink's reach under the baseline), so every style, textured ones included, sinks out of it the same way
  const sink = out > 0 ? typeExit(out) * size * 1.4 : 0;
  const lay = layout(env, text, x, y + sink, size, o), us = reach(lay, p), color = o.color ?? PALETTE[style], popK = o.pop ?? 1, seed = o.seed ?? 1;
  if (out > 0) { const xs = lay.boxes.map((b) => b.c[0]), x0 = Math.min(...xs) - size, x1 = Math.max(...xs) + size; ctx.save(); ctx.beginPath(); ctx.rect(x0, y - size * 1.15, x1 - x0, size * 1.4); ctx.clip(); }
  if (out <= 0 && env.root && lay.boxes.length) { const bx = lay.boxes; probeRect(ctx, env, Math.min(...bx.map((b) => b.c[0] - b.w / 2)), y - size * 1.05, Math.max(...bx.map((b) => b.c[0] + b.w / 2)) - Math.min(...bx.map((b) => b.c[0] - b.w / 2)), size * 1.3, text, "text"); }
  ctx.save();
  if (style === "ink") drawInk(ctx, lay, us, size * (o.weight ?? 1), color, p, popK);
  else if (style === "marker") drawMarker(ctx, lay, us, size * (o.weight ?? 1), color, p, popK);
  else if (style === "crayon") textured(ctx, env, "crayon", waxHoles(env), 1, (c) => drawCrayon(c, lay, us, size * (o.weight ?? 1), color, p, popK, seed));
  else if (style === "chalk") textured(ctx, env, "chalk", chalkHoles(env), 1, (c) => drawChalk(c, lay, us, size * (o.weight ?? 1), color, p, popK, seed));
  else if (style === "thread") drawThread(ctx, lay, us, size * (o.weight ?? 1), color, p, popK);
  else if (style === "brick") drawBricks(ctx, env, lay, p, size, `${text}|${x}|${y + sink}|${size}|${o.seed}|${o.align}|${o.track}`, o.color);
  ctx.restore();
  if (out > 0) { ctx.restore(); return; } // the line's window; a leaving line has no tool
  // the tool, while the hand is still writing
  if (o.tool === false || p >= 1 || style === "brick") return;
  const tp = tipOf(lay, us); if (!tp) return;
  if (style === "ink") toolPen(ctx, tp.p, size);
  else if (style === "marker") toolMarker(ctx, tp.p, size, color);
  else if (style === "crayon") toolStick(ctx, tp.p, size, color, "#efe6cf", 1.15, 0.24);
  else if (style === "chalk") toolStick(ctx, tp.p, size, "#f6f3ea", null, 0.8, 0.12);
  else if (style === "thread") { const lastDone = [...us.keys()].reverse().find((i) => us[i] > 0); const from = lastDone !== undefined ? cut(lay.strokes[lastDone], us[lastDone]).slice(-1)[0] : null; toolNeedle(ctx, [tp.p[0] + 6, tp.p[1] - 6], -0.9, size, color, from); }
};

// ---------------------------------------------------------------- the finale sentence
// Each word in its own medium, one per beat, then the claim in pen with a swash that swings in.
export type SentenceOpts = { beat?: number; styles?: KStyle[]; colors?: string[]; cx?: number; top?: number; size?: number; claim?: string; claimSize?: number };
export const SENTENCE_STYLES: KStyle[] = ["marker", "ink", "thread", "crayon", "brick"];
export const sentence = (ctx: Ctx, env: Env, words: string[], frame: number, t0: number, o: SentenceOpts = {}) => {
  const beat = o.beat ?? 20, cx = o.cx ?? env.W / 2, size = o.size ?? 74, top = o.top ?? env.H * 0.3, styles = o.styles ?? SENTENCE_STYLES;
  const colors = o.colors ?? ["#1f6fd1", "#1b1510", "#2f7f86", "#d9412f", ""];
  const labels = words.map((w, i) => w + (i < words.length - 1 ? "," : "."));
  // two lines, balanced by measured width
  const wAt = (i: number) => measure(labels[i], size) + size * 0.55, split = Math.ceil(words.length / 2) - (words.length % 2 ? 1 : 0) || 1;
  const lines = [labels.map((_, i) => i).slice(0, split), labels.map((_, i) => i).slice(split)];
  lines.forEach((ids, li) => {
    const total = ids.reduce((a, i) => a + wAt(i), 0) - size * 0.55; let x = cx - total / 2; const y = top + li * size * 1.75;
    ids.forEach((i) => {
      const p = ease((frame - t0 - i * beat) / (beat * 1.35));
      writeOn(ctx, env, labels[i], x, y, size, p, styles[i % styles.length], { color: colors[i] || undefined, seed: 40 + i });
      x += wAt(i);
    });
  });
  const claim = o.claim ?? "All in pure code.", cs = o.claimSize ?? 118, cy = top + 2 * size * 1.75 + cs * 1.25, c0 = t0 + words.length * beat + beat * 0.5;
  const pc = ease((frame - c0) / (beat * 2.2)), W = measure(claim, cs);
  writeOn(ctx, env, claim, cx, cy, cs, pc, "ink", { align: "center", seed: 90, color: o.colors?.[5] ?? "#1b1510" });
  // the swash: one long pointed-pen hairline swelling through its middle, swung in under the claim
  const ps = out3((frame - c0 - beat * 2) / (beat * 0.9)); if (ps > 0) {
    screen(ctx, env); const x0 = cx - W / 2 - cs * 0.1, x1 = cx + W / 2 + cs * 0.2, yy = cy + cs * 0.3, n = 60, pts: P[] = [], ws: number[] = [];
    for (let i = 0; i <= n * ps; i++) { const t = i / n; pts.push([lerp(x0, x1, t), yy + Math.sin(t * Math.PI * 1.1 - 0.2) * cs * 0.12 - t * cs * 0.05]); ws.push(cs * (0.008 + 0.045 * Math.sin(Math.PI * t) ** 2)); }
    if (pts.length > 1) { ctx.fillStyle = "#d4622b"; fillPoly(ctx, ribbon(pts, ws)); }
  }
};

// ---------------------------------------------------------------- the logo
// The anidoodle wordmark from lettering.ts, inked stroke by stroke with thick-thin pressure, the
// i's dot last, and a dip pen riding the nib. Idle: a glint travels the dot and the word breathes.
export type LogoOpts = { color?: string; pen?: boolean; seed?: number; glint?: number };
const inkedWord = (env: Env, em: number, x: number, y: number) => {
  const k = `kin:logo:${em}:${x}:${y}`; const hit = env.cache.get(k) as ReturnType<typeof build> | undefined; if (hit) return hit;
  const b = build(em, x, y); env.cache.set(k, b); return b;
};
const build = (em: number, x: number, y: number) => {
  const nib: Nib = { em, slant: 0.28, origin: [x, y], hair: em * 0.012, shade: em * 0.085 };
  const strokes = WORD.map((s, i) => inkStroke(nib, s, TAIL[i])), total = strokes.reduce((a, k) => a + k.len[k.len.length - 1], 0);
  const dot: P = [x + (DOT[0] + DOT[1] * Math.tan(nib.slant)) * em, y - DOT[1] * em];
  return { strokes, total, dot, nib };
};
export const logoBox = (env: Env, em: number) => {
  const k = `kin:logobox:${em}`; const hit = env.cache.get(k) as { x0: number; x1: number; y0: number; y1: number } | undefined; if (hit) return hit;
  const W = inkedWord(env, em, 0, 0); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  W.strokes.forEach((st) => st.spine.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }));
  const b = { x0, x1, y0, y1 }; env.cache.set(k, b); return b;
};
export const logoWidth = (em: number) => em * 5.9; // the letters only; logoBox() includes the swash
// the wordmark centred on (cx, cy), swash and all
export const logoCentred = (ctx: Ctx, env: Env, cx: number, cy: number, em: number, p: number, o: LogoOpts = {}) => { const b = logoBox(env, em); logo(ctx, env, cx - (b.x0 + b.x1) / 2, cy - (b.y0 + b.y1) / 2, em, p, o); };
export const logo = (ctx: Ctx, env: Env, x: number, y: number, em: number, p: number, o: LogoOpts = {}) => {
  if (p <= 0) return;
  screen(ctx, env);
  const W = inkedWord(env, em, x, y), color = o.color ?? "#1b1510", pw = clamp(p / 0.9), pd = clamp((p - 0.9) / 0.1);
  let d = pw * W.total, tip: P | null = null;
  ctx.fillStyle = color;
  for (const k of W.strokes) {
    const L = k.len[k.len.length - 1]; if (d <= 0) break;
    const upto = Math.min(L, d), poly = outlineOf(k, upto); fillPoly(ctx, poly);
    if (d < L) { const i = k.len.findIndex((v) => v >= upto); tip = k.spine[Math.max(0, i)]; }
    d -= L;
  }
  if (pd > 0) { ctx.beginPath(); ctx.arc(W.dot[0], W.dot[1], em * 0.07 * out3(pd), 0, Math.PI * 2); ctx.fill(); }
  if (o.glint && o.glint > 0) { const g = ctx.createRadialGradient(W.dot[0] - em * 0.02, W.dot[1] - em * 0.02, 0, W.dot[0], W.dot[1], em * 0.16); g.addColorStop(0, `rgba(255,253,245,${0.85 * o.glint})`); g.addColorStop(1, "rgba(255,253,245,0)"); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(W.dot[0], W.dot[1], em * 0.16, 0, Math.PI * 2); ctx.fill(); }
  if (o.pen !== false && p < 1) toolPen(ctx, tip ?? W.dot, em * 1.25);
};
// the corner mark: writes on in ~1 s from t0, then lives (a glint every 4 s, a slow breath)
export type BugOpts = { t0?: number; color?: string; fps?: number; pen?: boolean; alpha?: number };
export const logoBug = (ctx: Ctx, env: Env, frame: number, x: number, y: number, scale: number, o: BugOpts = {}) => {
  const fps = o.fps ?? 30, t = frame - (o.t0 ?? 0); if (t < 0) return;
  const p = ease(t / fps), em = 26 * scale, breath = 1 + 0.006 * Math.sin((2 * Math.PI * t) / (fps * 3.2)), gl = (t % (fps * 4)) / (fps * 4), glint = t > fps ? Math.max(0, Math.sin(Math.PI * clamp((gl - 0.8) / 0.2))) : 0;
  // the breath scales the word about its baseline origin: logo() draws in screen space from (x, y), so a scaled em is the whole move
  ctx.save(); ctx.globalAlpha = o.alpha ?? 1;
  logo(ctx, env, x, y, em * breath, p, { color: o.color, pen: o.pen ?? p < 1, glint });
  ctx.restore();
};

// ---------------------------------------------------------------- captions
// A small hand-lettered callout in pen, with a hand-drawn underline or an arrow that swings toward
// `to` (screen point) once the words are down.
export type CaptionOpts = { color?: string; to?: P; align?: "left" | "center" | "right"; style?: KStyle; accent?: string };
export const caption = (ctx: Ctx, env: Env, text: string, x: number, y: number, size: number, p: number, kind: "plain" | "underline" | "arrow" = "underline", o: CaptionOpts = {}) => {
  if (p <= 0) return;
  const pw = clamp(p / 0.75), pl = out3((p - 0.7) / 0.3), W = measure(text, size), color = o.color ?? "#1b1510", accent = o.accent ?? "#d4622b";
  const x0 = o.align === "center" ? x - W / 2 : o.align === "right" ? x - W : x;
  writeOn(ctx, env, text, x, y, size, pw, o.style ?? "ink", { color, align: o.align, seed: 7, weight: 1.15, pop: 0.7 });
  if (kind === "plain" || pl <= 0) return;
  screen(ctx, env); ctx.save(); ctx.lineCap = "round"; ctx.strokeStyle = accent; ctx.fillStyle = accent;
  if (kind === "underline") {
    const n = 40, pts: P[] = [], ws: number[] = [];
    for (let i = 0; i <= n * pl; i++) { const t = i / n; pts.push([x0 - size * 0.1 + (W + size * 0.3) * t, y + size * 0.32 + Math.sin(t * 5.2) * size * 0.035 - t * size * 0.05]); ws.push(size * (0.02 + 0.03 * Math.sin(Math.PI * t))); }
    if (pts.length > 1) fillPoly(ctx, ribbon(pts, ws));
  } else if (o.to) {
    const e = o.to, s: P = e[1] < y - size * 1.2 ? [x0 + W * 0.75, y - size * 1.35] : e[1] > y + size * 0.3 ? [x0 + W * 0.75, y + size * 0.55] : e[0] < x0 ? [x0 - size * 0.4, y - size * 0.5] : [x0 + W + size * 0.4, y - size * 0.5], m: P = [(s[0] + e[0]) / 2 + (e[1] - s[1]) * 0.25, (s[1] + e[1]) / 2 - (e[0] - s[0]) * 0.25];
    const n = 40, pts: P[] = []; for (let i = 0; i <= n * pl; i++) { const t = i / n; pts.push([(1 - t) ** 2 * s[0] + 2 * (1 - t) * t * m[0] + t * t * e[0], (1 - t) ** 2 * s[1] + 2 * (1 - t) * t * m[1] + t * t * e[1]]); }
    if (pts.length > 1) { ctx.lineWidth = size * 0.06; polyline(ctx, pts); }
    if (pl >= 1) { const a = pts[pts.length - 4], b = pts[pts.length - 1], ang = Math.atan2(b[1] - a[1], b[0] - a[0]), h = size * 0.3; ctx.lineWidth = size * 0.06; polyline(ctx, [[b[0] - Math.cos(ang - 0.5) * h, b[1] - Math.sin(ang - 0.5) * h], b, [b[0] - Math.cos(ang + 0.5) * h, b[1] - Math.sin(ang + 0.5) * h]]); }
  }
  ctx.restore();
};

// ---------------------------------------------------------------- set type (the clean register)
// Type as the design: a line SET in a heavy sans, not written. Each word rises into place from
// behind its own baseline (a mask the size of the line), one after another, on an out-cubic: a
// gentle move with no bounce and no fade-in. `p` 0..1 is the line's progress. Screen space.
// `out` 0..1 is its exit: the words sink back behind the baseline, last word first, on an EASE-IN over
// 1.3x the size (motionKit.typeExit), so they accelerate away and clear the clip whole. The ease-out,
// 1.0x exit left letter tops at the clip edge for half a second on a brand launch film.
// `space: "world"` draws in the CURRENT transform (inside a camera, a world region) instead of
// resetting to the screen: x, y and size are then world units.
export type SetOpts = { color?: string; align?: "left" | "center" | "right"; weight?: number; font?: (w: number, px: number) => string; track?: number; out?: number; space?: "screen" | "world" };
const SET_FONT = (w: number, px: number) => `${w} ${px}px "Avenir Next", "Helvetica Neue", Helvetica, Arial, sans-serif`;
export const setWidth = (ctx: Ctx, text: string, size: number, o: SetOpts = {}) => { ctx.font = (o.font ?? SET_FONT)(o.weight ?? 700, size); return ctx.measureText(text).width + Math.max(0, text.length - 1) * (o.track ?? -0.02) * size; };
export const setType = (ctx: Ctx, env: Env, text: string, x: number, y: number, size: number, p: number, o: SetOpts = {}) => {
  const out = Math.max(0, Math.min(1, o.out ?? 0));
  if (p <= 0 || out >= 1) return;
  if (o.space !== "world") screen(ctx, env);
  // a standing line reports its box to the frame probe; a line on its way out does not, because its
  // glyphs speak for what is still showing (the whole-line box let a one-frame "read" through on the exit)
  if (out <= 0) { const w = setWidth(ctx, text, size, o), x0 = o.align === "center" ? x - w / 2 : o.align === "right" ? x - w : x; probeRect(ctx, env, x0, y - size * 0.8, w, size, text, "text"); }
  ctx.save();
  ctx.font = (o.font ?? SET_FONT)(o.weight ?? 700, size); ctx.textBaseline = "alphabetic"; ctx.fillStyle = o.color ?? "#111214";
  const tr = (o.track ?? -0.02) * size, words = text.split(" "), space = ctx.measureText(" ").width;
  const wOf = (w: string) => ctx.measureText(w).width + Math.max(0, w.length - 1) * tr, total = words.reduce((a, w) => a + wOf(w), 0) + space * (words.length - 1);
  let cx = o.align === "center" ? x - total / 2 : o.align === "right" ? x - total : x;
  ctx.beginPath(); ctx.rect(cx - size, y - size * 1.05, total + 2 * size, size * 1.35); ctx.clip(); // the line's own window: words rise into it
  words.forEach((w, i) => {
    const q = Math.max(0, Math.min(1, p * (1 + 0.35 * (words.length - 1)) - 0.35 * i)), e = 1 - Math.pow(1 - q, 3);
    const qo = Math.max(0, Math.min(1, out * (1 + 0.3 * (words.length - 1)) - 0.3 * (words.length - 1 - i))), sink = typeExit(qo) * size; // last word leaves first
    if (q > 0 && qo < 1) { const dy = (1 - e) * size * 0.9 + sink; let wx = cx; for (const ch of w) { ctx.fillText(ch, wx, y + dy); wx += ctx.measureText(ch).width + tr; } }
    cx += wOf(w) + space;
  });
  ctx.restore();
};
