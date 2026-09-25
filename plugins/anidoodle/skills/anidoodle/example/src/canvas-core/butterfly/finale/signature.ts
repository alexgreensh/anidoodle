// THE SIGNATURE. `alexgreenshpun.com`, written the way a watercolourist signs a corner: a rigger
// brush in a dilute warm grey, five connected strokes and two marks, not a font and not the
// drafting capitals. Control points only. It is a URL first, so it has to stay legible.
import { Gfx, P, tube } from "../../core";
import { SIG } from "./world";
import { backrun, lift } from "./paint";

// authored in em units: baseline y = 0, x-height = 1, ascenders about 1.7, descenders about -0.8
const ALEX: P[] = [[0.62, 0.02], [0.34, 0.06], [0.12, 0.42], [0.2, 0.86], [0.46, 0.95], [0.63, 0.62], [0.6, 0.06], [0.72, 0.02], [0.86, 0.3],
  [0.98, 1.05], [1.06, 1.62], [1.12, 0.9], [1.1, 0.24], [1.22, 0.04], [1.4, 0.22],
  [1.52, 0.5], [1.72, 0.66], [1.78, 0.48], [1.62, 0.3], [1.46, 0.36], [1.44, 0.14], [1.6, 0.02], [1.8, 0.16],
  [2.02, 0.06], [2.38, 0.82], [2.5, 0.96], [2.62, 0.72], [2.78, 0.12]];
const XBAR: P[] = [[2.06, 0.78], [2.3, 0.5], [2.56, 0.2], [2.8, 0.04]];
const GREEN: P[] = [[3.0, 0.72], [2.88, 0.36], [3.0, 0.06], [3.22, 0.1], [3.3, 0.5], [3.28, 0.02], [3.24, -0.5], [3.06, -0.74], [2.92, -0.6],
  [3.42, 0.08], [3.5, 0.6], [3.54, 0.26], [3.7, 0.52], [3.86, 0.44],
  [3.98, 0.52], [4.14, 0.62], [4.2, 0.4], [4.04, 0.24], [3.94, 0.36], [3.98, 0.08], [4.2, 0.04], [4.36, 0.2],
  [4.46, 0.56], [4.62, 0.64], [4.68, 0.42], [4.52, 0.26], [4.42, 0.38], [4.46, 0.08], [4.68, 0.04], [4.86, 0.22],
  [4.94, 0.66], [4.96, 0.1], [5.02, 0.48], [5.2, 0.66], [5.36, 0.5], [5.38, 0.06]];
const SHPUN: P[] = [[5.66, 0.58], [5.56, 0.7], [5.4, 0.6], [5.5, 0.4], [5.7, 0.3], [5.76, 0.12], [5.6, 0.02], [5.46, 0.12],
  [5.96, 0.1], [6.0, 0.9], [6.04, 1.66], [6.06, 0.72], [6.1, 0.1], [6.22, 0.5], [6.4, 0.66], [6.54, 0.48], [6.56, 0.06],
  [6.86, 0.66], [6.8, 0.1], [6.76, -0.46], [6.72, -0.76], [6.88, 0.52], [7.06, 0.66], [7.22, 0.5], [7.24, 0.2], [7.1, 0.04], [6.94, 0.14],
  [7.5, 0.64], [7.46, 0.2], [7.56, 0.06], [7.74, 0.16], [7.82, 0.62], [7.86, 0.08],
  [8.02, 0.62], [8.04, 0.08], [8.1, 0.46], [8.28, 0.64], [8.44, 0.48], [8.46, 0.06]];
const COM: P[] = [[9.06, 0.54], [8.92, 0.66], [8.74, 0.56], [8.7, 0.26], [8.82, 0.06], [9.0, 0.12],
  [9.2, 0.5], [9.36, 0.64], [9.52, 0.5], [9.54, 0.22], [9.4, 0.06], [9.22, 0.16], [9.2, 0.46],
  [9.72, 0.62], [9.74, 0.08], [9.8, 0.46], [9.96, 0.62], [10.08, 0.46], [10.1, 0.08], [10.16, 0.46], [10.32, 0.62], [10.44, 0.46], [10.46, 0.06]];
const DOT: P = [8.62, 0.06];
const STROKES: [P[], number][] = [[ALEX, 0], [XBAR, 1], [GREEN, 2], [SHPUN, 3], [COM, 4]];

// right edge of the last letter at x = 1036, baseline at y = 1034, x-height 12 px, and the
// baseline rises two degrees to the right the way a hand does
export const signature = (g: Gfx, p = 1, alpha = 0.75) => {
  if (p <= 0) return;
  const em = 15.5, W = 212, k = W / 10.5, x0 = 1036 - W, y0 = 1032, rise = Math.tan((-2 * Math.PI) / 180);
  const T = ([x, y]: P): P => [x0 + x * k, y0 - y * em + (x * k) * rise];
  const each = 1 / STROKES.length;
  STROKES.forEach(([pts, i]) => {
    const q = Math.max(0, Math.min(1, (p - i * each) / each)); if (q <= 0) return;
    const n = Math.max(2, Math.round(pts.length * q)), s = pts.slice(0, n).map(T);
    g.fill(tube(s, 2.7, 1.5, false), SIG, alpha); /* a rigger: it starts loaded and runs thin */
    if (q >= 1) g.fill([[s[s.length - 1][0] - 1.4, s[s.length - 1][1] - 1.4], [s[s.length - 1][0] + 1.6, s[s.length - 1][1] - 1], [s[s.length - 1][0] + 1.2, s[s.length - 1][1] + 1.6], [s[s.length - 1][0] - 1.6, s[s.length - 1][1] + 1.2]], SIG, alpha * 0.9); /* pigment pools where the brush leaves the paper */
  });
  if (p > 0.72) { const d = T(DOT); g.fill([[d[0] - 1.6, d[1] - 1.6], [d[0] + 1.8, d[1] - 1.3], [d[0] + 1.5, d[1] + 1.7], [d[0] - 1.7, d[1] + 1.4]], SIG, alpha); }
};
// before signing over a dark passage a painter lifts the corner with a clean damp brush
export const clearCorner = (g: Gfx, p = 1) => {
  if (p <= 0) return;
  const pts: P[] = [[836, 1000], [1060, 994], [1064, 1052], [832, 1058]];
  lift(g, pts, 5900, 0.45 * p);
  if (p >= 1) backrun(g, [1046, 1044], 26, 5910, "#b8ab96", 0.16);
};
