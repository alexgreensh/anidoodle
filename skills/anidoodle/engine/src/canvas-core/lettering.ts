import { sample, type P } from "./core";
import { clamp, resample } from "./gallery";

// POINTED-PEN SCRIPT. The word is authored as a few continuous centrelines in em units, UPRIGHT
// (baseline y = 0, x-height 1, ascenders ~1.9, y pointing UP), the way a letterer pencils the
// skeleton before inking. The pen does the rest: a flexible pointed nib only spreads when it is
// pulled TOWARD the writer, so the width at every point comes from how much that stretch of the
// line travels downward. Ovals come out heavy on the left and hair-thin on the right, stems are
// shaded, every upstroke and join is a hairline. Then the whole word is slanted as a hand slants.

export type Stroke = P[];
// "anidoodle". LEGIBILITY FIRST: every o is its own clean closed oval (the pen lifts, as a real
// letterer's does), and the joins are hairlines that only TOUCH a bowl, never run through it. An
// o closed with a knotted turn and entered through its own bowl reads as an e or a c, and made
// the first "doo" read "dce".
const oval = (cx: number, a0 = 50, a1 = 420): P[] => { const out: P[] = []; for (let a = a0; a <= a1; a += 22) { const r = (a * Math.PI) / 180; out.push([cx + 0.29 * Math.cos(r), 0.5 + 0.5 * Math.sin(r)]); } return out; };
const on = (cx: number, deg: number): P => [cx + 0.29 * Math.cos((deg * Math.PI) / 180), 0.5 + 0.5 * Math.sin((deg * Math.PI) / 180)];
// a d: oval pulled counter-clockwise from its top right, a hairline up the back to the ascender,
// a rounded head where the nib turns, then the shaded stem down and out
const d = (x: number): P[] => [[x + 0.66, 0.84], [x + 0.44, 1.0], [x + 0.18, 0.94], [x, 0.64], [x - 0.03, 0.28], [x + 0.12, 0.02], [x + 0.34, 0.02], [x + 0.54, 0.3], [x + 0.66, 0.8],
  [x + 0.76, 1.45], [x + 0.84, 1.86], [x + 0.9, 1.95], [x + 0.84, 1.86], [x + 0.76, 1.3], [x + 0.7, 0.6], [x + 0.67, 0.12], [x + 0.75, 0.0], [x + 0.91, 0.08]];
const D1 = 2.5, O1 = 3.78, O2 = 4.52, X2 = 5.04;
const ANI: Stroke = [
  [0.8, 0.84], [0.58, 1.0], [0.3, 0.94], [0.08, 0.64], [0.04, 0.28], [0.2, 0.02], [0.44, 0.02], [0.66, 0.3], [0.8, 0.7], [0.86, 1.0],
  [0.83, 0.6], [0.79, 0.2], [0.84, 0.02], [0.98, 0.04], [1.12, 0.4], [1.2, 0.8], [1.24, 1.0],
  [1.22, 0.55], [1.19, 0.0], [1.23, 0.5], [1.36, 0.88], [1.54, 1.0], [1.7, 0.86], [1.72, 0.5], [1.68, 0.14], [1.76, 0.0], [1.9, 0.06], [2.02, 0.4], [2.1, 0.84], [2.13, 1.0],
  [2.1, 0.55], [2.06, 0.14], [2.12, 0.0], [2.28, 0.06], [D1 - 0.04, 0.3],              // the i's exit just touches the d's bowl
];
const D1S: Stroke = [...d(D1), [D1 + 1.06, 0.14], on(O1, 208)];                        // out of the d and up to kiss the first o
const OO: Stroke = oval(O1), BRIDGE: Stroke = [on(O1, 22), [(O1 + O2) / 2, 0.86], on(O2, 158)], OO2: Stroke = oval(O2);
const TO_D: Stroke = [on(O2, 20), [(O2 + X2) / 2 + 0.06, 0.84], [X2 + 0.02, 0.72]];
const at = (pts: P[]): P[] => pts.map(([x, y]) => [X2 + x, y]);                        // d-l-e is laid out from the second d
const DLE: Stroke = [
  ...d(X2), ...at([[1.11, 0.5], [1.31, 1.1], [1.47, 1.62], [1.49, 1.92], [1.37, 1.94], [1.27, 1.6], [1.21, 1.0], [1.17, 0.4], [1.21, 0.06], [1.35, 0.0], [1.51, 0.12],
  [1.67, 0.4], [1.87, 0.64], [1.95, 0.86], [1.87, 1.0], [1.71, 0.92], [1.63, 0.56], [1.65, 0.18], [1.81, 0.0], [2.07, 0.06], [2.37, 0.26],
  // the swash: up over a curl, a shaded fall, then one long hairline sweeping back under the word
  [2.72, 0.54], [3.06, 0.7], [3.28, 0.6], [3.3, 0.3], [3.16, -0.04], [2.86, -0.26], [2.26, -0.38], [1.26, -0.4], [0.16, -0.34], [-1.0, -0.24], [-1.8, -0.12]]),
];
// in writing order; the last one carries the swash, whose hairline tail runs long
export const WORD: Stroke[] = [ANI, D1S, OO, BRIDGE, OO2, TO_D, DLE];
export const TAIL = [0, 0, 0, 0, 0, 0, 0.3];
export const DOT: P = [2.2, 1.42];

export type Nib = { em: number; slant: number; origin: P; hair: number; shade: number };
export type Inked = { spine: P[]; w: number[]; len: number[] };   // screen centreline, half-width, cumulative length

// upright em -> screen: scale, slant (forward, as a hand slants), y flipped
export const place = (n: Nib, [x, y]: P): P => [n.origin[0] + (x + y * Math.tan(n.slant)) * n.em, n.origin[1] - y * n.em];

export const inkStroke = (n: Nib, s: Stroke, tail = 0): Inked => {
  const up = sample(s, false, 18), L = up.reduce((a, p, i) => (i ? a + Math.hypot(p[0] - up[i - 1][0], p[1] - up[i - 1][1]) : 0), 0);
  const u = resample(up, Math.max(24, Math.round(L * 90)));
  // raw pressure: the downward share of the direction, sharpened so only true downstrokes swell
  const raw = u.map((_, i) => { const a = u[Math.max(0, i - 1)], b = u[Math.min(u.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return Math.pow(clamp(-dy / l), 1.7); });
  // the nib's tines open and close over a short distance, never instantly
  const K = 5, sm = raw.map((_, i) => { let t = 0, c = 0; for (let j = -K; j <= K; j++) { const v = raw[i + j]; if (v !== undefined) { const wgt = K + 1 - Math.abs(j); t += v * wgt; c += wgt; } } return t / c; });
  const N = u.length;
  const w = sm.map((v, i) => { const t = i / (N - 1), taper = Math.min(1, t / 0.03, (1 - t) / (0.08 + tail)); return (n.hair + (n.shade - n.hair) * v) * (0.35 + 0.65 * clamp(taper)); });
  const spine = u.map((p) => place(n, p)), len = [0];
  for (let i = 1; i < N; i++) len.push(len[i - 1] + Math.hypot(spine[i][0] - spine[i - 1][0], spine[i][1] - spine[i - 1][1]));
  return { spine, w, len };
};

// the filled outline of the first `upto` px of an inked stroke (Infinity = all of it)
export const outlineOf = (k: Inked, upto = Infinity): P[] => {
  const s = k.spine, n = s.length, Lft: P[] = [], Rgt: P[] = [];
  for (let i = 0; i < n; i++) {
    if (k.len[i] > upto) break;
    const a = s[Math.max(0, i - 1)], b = s[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    Lft.push([s[i][0] + nx * k.w[i], s[i][1] + ny * k.w[i]]); Rgt.push([s[i][0] - nx * k.w[i], s[i][1] - ny * k.w[i]]);
  }
  return [...Lft, ...Rgt.reverse()];
};
