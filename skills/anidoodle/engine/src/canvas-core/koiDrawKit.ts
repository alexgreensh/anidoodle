// KOI DRAW KIT. Process primitives for plates that are seen being MADE: a marker laying a flat in
// parallel chisel strokes, a line growing along its centreline, and a cue table that turns a frame
// into per-(element, pass) progress. Pure geometry; randomness only from rng(seed).
import { rng, type Ctx, type P } from "./core";
import { clamp } from "./gallery";

// k-th of n sequential sub-steps inside a pass whose progress is p. Exactly 1 once p is 1.
export const part = (p: number, k: number, n: number) => (p >= 1 ? 1 : clamp(p * n - k));
// an item that starts at `start` (0..1 of its pass) and takes `dur` of it
export const stagger = (p: number, start: number, dur: number) => (p >= 1 ? 1 : clamp((p - start) / dur));

// the first q of a polyline, by arc length. q >= 1 returns the very same array.
export const cut = (s: P[], q: number): P[] => {
  if (q >= 1) return s;
  const cum = [0]; for (let i = 1; i < s.length; i++) cum.push(cum[i - 1] + Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]));
  const want = cum[cum.length - 1] * Math.max(0, q), out: P[] = [s[0]];
  for (let i = 1; i < s.length; i++) {
    if (cum[i] <= want) { out.push(s[i]); continue; }
    const f = (want - cum[i - 1]) / (cum[i] - cum[i - 1] || 1); out.push([s[i - 1][0] + (s[i][0] - s[i - 1][0]) * f, s[i - 1][1] + (s[i][1] - s[i - 1][1]) * f]); break;
  }
  return out.length > 1 ? out : [s[0], s[0]];
};

// ---------------------------------------------------------------- a marker laying a flat
// A chisel marker fills a shape in parallel passes, back and forth, each one starting just outside
// one edge and running out just past the other (the contour, inked last, hides the overshoot).
export type Streak = { v0: number; v1: number; u0: number; u1: number; dir: 1 | -1 };
export type Streaks = { c: number; s: number; w: number; list: Streak[]; len: number[]; total: number };
// `reach` caps a pass at what a wrist covers: a wide area is filled as blocks of short passes,
// block after block, and the leading edge is the ragged line of stroke ends, never a straight wipe.
export const streaks = (shapes: P[][], width: number, angle: number, seed: number, reach = 1e9): Streaks => {
  const c = Math.cos(angle), s = Math.sin(angle), r = rng(seed), gap = width * 0.74, rows: Streak[] = [];
  const uv = shapes.map((sh) => sh.map(([x, y]) => [x * c + y * s, -x * s + y * c] as P));
  let vmin = 1e9, vmax = -1e9; uv.forEach((sh) => sh.forEach(([, v]) => { vmin = Math.min(vmin, v); vmax = Math.max(vmax, v); }));
  let k = 0;
  for (let v = vmin + gap * 0.45; v < vmax + gap * 0.5; v += gap) {
    let lo = 1e9, hi = -1e9;
    const probe = (vv: number) => uv.forEach((sh) => { for (let i = 0; i < sh.length; i++) { const a = sh[i], b = sh[(i + 1) % sh.length]; if ((a[1] - vv) * (b[1] - vv) > 0 || a[1] === b[1]) continue; const u = a[0] + ((b[0] - a[0]) * (vv - a[1])) / (b[1] - a[1]); lo = Math.min(lo, u); hi = Math.max(hi, u); } });
    probe(Math.min(v, vmax - 0.5)); probe(Math.max(vmin + 0.5, v - gap * 0.45)); probe(Math.min(vmax - 0.5, v + gap * 0.45));
    if (lo > hi) continue;
    const tilt = (r() - 0.5) * gap * 0.22, over = width * 0.35;
    rows.push({ v0: v - tilt, v1: v + tilt, u0: lo - over * (0.6 + r() * 0.6), u1: hi + over * (0.6 + r() * 0.6), dir: k % 2 ? -1 : 1 }); k++;
  }
  let list = rows;
  if (reach < 1e9) {
    let u0 = 1e9, u1 = -1e9; rows.forEach((t) => { u0 = Math.min(u0, t.u0); u1 = Math.max(u1, t.u1); });
    const nb = Math.max(1, Math.ceil((u1 - u0) / reach)), bw = (u1 - u0) / nb, cuts = rows.map(() => Array.from({ length: nb + 1 }, (_, b) => (b === 0 ? -1e9 : b === nb ? 1e9 : u0 + b * bw + (r() - 0.5) * bw * 0.35)));
    list = [];
    for (let b = 0; b < nb; b++) rows.forEach((t, i) => { const a = Math.max(t.u0, cuts[i][b] - width * 0.3), e = Math.min(t.u1, cuts[i][b + 1] + width * 0.3); if (e - a > width * 0.3) list.push({ ...t, u0: a, u1: e, dir: (i + b) % 2 ? -1 : 1 }); });
  }
  const len = list.map((t) => (t.u1 - t.u0) + width * 1.6); // a lift and a return between passes
  return { c, s, w: width, list, len, total: len.reduce((a, b) => a + b, 0) };
};
// Clip the current surface to the part of the flat the marker has laid by progress p. Every
// ribbon is wound the same way, so the union is a nonzero fill with no holes where passes overlap.
export const streakClip = (cx: Ctx, st: Streaks, p: number) => {
  const { c, s, w } = st, xy = (u: number, v: number): P => [u * c - v * s, u * s + v * c];
  let t = clamp(p) * st.total; cx.beginPath();
  for (let i = 0; i < st.list.length && t > 0; i++) {
    const k = st.list[i], L = st.len[i], f = clamp(t / (L - w * 1.6)); t -= L;
    const a = k.dir > 0 ? k.u0 : k.u1, b = a + (k.dir > 0 ? 1 : -1) * (k.u1 - k.u0) * f, lo = Math.min(a, b), hi = Math.max(a, b);
    const vAt = (u: number) => k.v0 + ((k.v1 - k.v0) * (u - k.u0)) / (k.u1 - k.u0 || 1), sk = w * 0.28; // the chisel's slanted end
    const n = 6, top: P[] = [], bot: P[] = [];
    for (let j = 0; j <= n; j++) { const u = lo + ((hi - lo) * j) / n, v = vAt(u); top.push(xy(u + sk * 0.5, v - w / 2)); bot.push(xy(u - sk * 0.5, v + w / 2)); }
    const ring = [...top, ...bot.reverse()];
    ring.forEach(([x, y], j) => (j ? cx.lineTo(x, y) : cx.moveTo(x, y))); cx.closePath();
  }
  cx.clip();
};

// where the marker (or brush) is at progress p: for a visible tool cursor
export const streakTip = (st: Streaks, p: number): P => {
  const { c, s, w } = st; let t = clamp(p) * st.total;
  for (let i = 0; i < st.list.length; i++) { const k = st.list[i], L = st.len[i], f = clamp(t / (L - w * 1.6)); if (t <= L || i === st.list.length - 1) { const u = k.dir > 0 ? k.u0 + (k.u1 - k.u0) * f : k.u1 - (k.u1 - k.u0) * f, v = k.v0 + (k.v1 - k.v0) * ((u - k.u0) / (k.u1 - k.u0 || 1)); return [u * c - v * s, u * s + v * c]; } t -= L; }
  return [0, 0];
};

// ---------------------------------------------------------------- a cue table
// [element, pass, start, end] in frames. Progress is 0 before start, exactly 1 from end on, and
// eased like a hand in between (a quick attack, a settle into the last stroke).
export type Cue = [string, string, number, number];
export const cueClock = (cues: Cue[], frame: number) => {
  const map = new Map<string, [number, number]>(); cues.forEach(([e, p, a, b]) => map.set(`${e}|${p}`, [a, b]));
  return (el: string, pass: string): number => {
    const w = map.get(`${el}|${pass}`); if (!w) throw new Error(`cue table has no ${el}|${pass}`); // a missing cue would draw that mark finished at frame 0
    if (frame >= w[1]) return 1; if (frame <= w[0]) return 0;
    const t = (frame - w[0]) / (w[1] - w[0]); return t < 1 ? t * t * (3 - 2 * t) * 0.35 + t * 0.65 : 1;
  };
};
// lay out a sequence of [element, pass, frames] (or a numeric pause) back to back from `from`
export const sequence = (from: number, steps: ([string, string, number] | number)[]): { cues: Cue[]; end: number } => {
  let t = from; const cues: Cue[] = [];
  steps.forEach((s) => { if (typeof s === "number") { t += s; return; } cues.push([s[0], s[1], t, t + s[2]]); t += s[2]; });
  return { cues, end: t };
};
