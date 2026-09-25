// THE SIGNATURE, REDRAWN FOR READABILITY (spec 7: "LEGIBLE FIRST: it is a URL, the dot must read
// as a dot"). The approved still's signature is a run of control points that reads as a scribble
// at any size, which the spec itself flags as not passing. This is a proper hand: every letter is
// authored from its own strokes, in em units with the x-height at 1, so it can be set at whatever
// size the frame needs and still be a word rather than a gesture.
//
// It stays a SIGNATURE and not a caption: one warm grey-brown rigger line, a forward slant, a
// baseline that rises the couple of degrees a hand rises, uneven letter widths, real descenders on
// g and p. It is just large enough to read, which at 1080 means about 410 px across.
//
// `finale/signature.ts` is left exactly as it was, so the approved finale still keeps re-rendering
// byte for byte. This is the one the film uses.
import { Gfx, P, jitter, rng, tube } from "../../core";

const SIG = "#574d43";
type Glyph = { w: number; s: P[][] };
const arc = (cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 11): P[] =>
  Array.from({ length: n }, (_, i) => { const a = a0 + ((a1 - a0) * i) / (n - 1); return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry] as P; });

// x-height 1, ascenders to about 1.75, descenders to about -0.55. Widths are deliberately uneven.
const G: Record<string, Glyph> = {
  a: { w: 0.94, s: [arc(0.46, 0.47, 0.4, 0.45, -0.35, 4.3), [[0.86, 0.9], [0.84, 0.14], [0.97, 0.03]]] },
  l: { w: 0.5, s: [[[0.2, 1.72], [0.23, 0.2], [0.38, 0.03]]] },
  e: { w: 0.88, s: [[[0.08, 0.5], [0.78, 0.54]], arc(0.44, 0.47, 0.38, 0.45, -0.12, 4.0)] },
  x: { w: 0.92, s: [[[0.07, 0.9], [0.82, 0.05]], [[0.09, 0.05], [0.84, 0.9]]] },
  g: { w: 0.98, s: [arc(0.46, 0.55, 0.4, 0.4, -0.35, 4.3), [[0.86, 0.94], [0.85, 0.1], [0.74, -0.42], [0.36, -0.54], [0.18, -0.34]]] },
  r: { w: 0.7, s: [[[0.17, 0.9], [0.2, 0.04]], [[0.2, 0.58], [0.42, 0.92], [0.68, 0.84]]] },
  n: { w: 0.9, s: [[[0.14, 0.9], [0.17, 0.04]], [[0.17, 0.56], [0.44, 0.93], [0.76, 0.72], [0.79, 0.04]]] },
  s: { w: 0.82, s: [[[0.76, 0.82], [0.42, 0.95], [0.16, 0.74], [0.48, 0.52], [0.76, 0.36], [0.58, 0.04], [0.16, 0.14]]] },
  h: { w: 0.9, s: [[[0.14, 1.74], [0.17, 0.04]], [[0.17, 0.56], [0.44, 0.93], [0.76, 0.72], [0.79, 0.04]]] },
  p: { w: 0.94, s: [[[0.15, 0.92], [0.11, -0.52]], [[0.14, 0.78], [0.48, 0.92], [0.78, 0.62], [0.64, 0.24], [0.17, 0.18]]] },
  u: { w: 0.94, s: [[[0.14, 0.9], [0.16, 0.28], [0.4, 0.03], [0.68, 0.2], [0.78, 0.64], [0.8, 0.08], [0.95, 0.04]]] },
  c: { w: 0.86, s: [arc(0.52, 0.47, 0.4, 0.45, 0.85, 5.45)] }, /* a c has to be OPEN on the right or it is an o */
  o: { w: 0.9, s: [arc(0.46, 0.47, 0.4, 0.45, 0, 6.35, 13)] },
  m: { w: 1.24, s: [[[0.1, 0.9], [0.13, 0.04]], [[0.13, 0.56], [0.35, 0.93], [0.58, 0.72], [0.6, 0.04]], [[0.6, 0.56], [0.84, 0.93], [1.08, 0.72], [1.11, 0.04]]] },
  ".": { w: 0.4, s: [] },
};
const WORD = "alexgreenshpun.com";

// `p` writes it on, stroke by stroke, in the order a hand would. `alpha` is the ink drying.
export const signature = (g: Gfx, p = 1, alpha = 0.8) => {
  if (p <= 0) return;
  const em = 27, right = 1042, base = 1032, slant = 0.1, rise = Math.tan((-2 * Math.PI) / 180);
  const total = [...WORD].reduce((a, ch) => a + (G[ch]?.w ?? 0.5) + 0.045, 0);
  const x0 = right - total * em;
  const strokes: { pts: P[]; dot?: boolean }[] = [];
  let pen = 0;
  for (const ch of WORD) {
    const gl = G[ch]; if (!gl) { pen += 0.5; continue; }
    const T = ([gx, gy]: P): P => { const X = x0 + (pen + gx + gy * slant) * em; return [X, base - gy * em + (X - x0) * rise]; };
    if (ch === ".") strokes.push({ pts: [T([0.16, 0.05])], dot: true });
    else gl.s.forEach((st) => strokes.push({ pts: st.map(T) }));
    pen += gl.w + 0.045;
  }
  const r = rng(5901), each = 1 / strokes.length;
  strokes.forEach((st, i) => {
    const q = Math.max(0, Math.min(1, (p - i * each) / each)); if (q <= 0) return;
    if (st.dot) { const [x, y] = st.pts[0], d = em * 0.1; g.fill([[x - d, y - d], [x + d * 1.1, y - d * 0.85], [x + d * 0.95, y + d * 1.1], [x - d * 1.05, y + d * 0.95]], SIG, alpha); return; } /* the dot reads as a dot, which is the whole point of a URL */
    const n = Math.max(2, Math.ceil(st.pts.length * q)), s = jitter(st.pts.slice(0, n), em * 0.016, 5910 + i);
    const w = em * (0.1 + r() * 0.03); /* a rigger: loaded at the start of a stroke, thinner as it runs */
    g.fill(tube(s, w, w * 0.62, false), SIG, alpha);
    if (q >= 1) { const e = s[s.length - 1], d = w * 0.85; g.fill([[e[0] - d, e[1] - d], [e[0] + d, e[1] - d * 0.8], [e[0] + d * 0.9, e[1] + d], [e[0] - d * 0.95, e[1] + d * 0.9]], SIG, alpha * 0.9); } /* pigment pools where the brush left the paper */
  });
};
// a clean damp brush lifts the corner before anyone signs over a dark passage
export const clearCorner = (g: Gfx, p = 1) => {
  if (p <= 0) return;
  const c = g.cur;
  c.globalCompositeOperation = "destination-out";
  g.wash([[560, 992], [1062, 986], [1066, 1058], [556, 1064]], "#000000", { alpha: 0.5 * p, seed: 5900, dx: 0, dy: 0, shrink: 1, rim: false });
  c.globalCompositeOperation = "source-over";
};
