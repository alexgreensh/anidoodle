// WATERCOLOUR, THE VERBS. Every mark in the finale is one of these: a graded wash, a wet band
// that spreads and pools, a lifted highlight (paper left, or pigment taken back off), dry-brush
// texture dragged over dry paint, and a backrun where clean water hit a drying wash.
import { Ctx, Gfx, P, displace, jitter, oval, rng, sample, tube } from "../../core";

export const wet = (g: Gfx, pts: P[], col: string, o: { alpha?: number; seed?: number; shrink?: number; rim?: boolean; dx?: number; dy?: number } = {}) =>
  g.wash(pts, col, { alpha: o.alpha ?? 0.42, seed: o.seed ?? 1, dx: o.dx ?? 2, dy: o.dy ?? 2, shrink: o.shrink ?? 0.97, rim: o.rim ?? true });

// pigment never dries flat: it pools where the water sat and lifts where it ran out
export const mottle = (g: Gfx, pts: P[], col: string, seed: number, n: number, a: number) => {
  const r = rng(seed), c = pts.reduce((s, p) => [s[0] + p[0] / pts.length, s[1] + p[1] / pts.length] as P, [0, 0] as P);
  for (let i = 0; i < n; i++) { const k = 0.3 + r() * 0.45, dx = (r() - 0.5) * 60, dy = (r() - 0.5) * 50; g.wash(pts.map((p) => [c[0] + (p[0] - c[0]) * k + dx, c[1] + (p[1] - c[1]) * k + dy] as P), col, { alpha: a * (0.5 + r() * 0.7), seed: seed + i * 3, dx: (r() - 0.5) * 8, dy: (r() - 0.5) * 8, shrink: 0.88 + r() * 0.2, rim: r() > 0.5 }); }
};
// a graded sky: cream at the horizon, blue at the top, and the sun is simply where the paper was left alone
export const graded = (g: Gfx, x0: number, y0: number, x1: number, y1: number, top: string, low: string) => {
  const c = g.cur, gr = c.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, top); gr.addColorStop(0.72, low); gr.addColorStop(1, low);
  g.touch(x0, y0, x1, y1); c.fillStyle = gr; c.fillRect(x0, y0, x1 - x0, y1 - y0);
};
export const sunBloom = (g: Gfx, at: P, r: number, col: string, a = 0.9) => {
  const c = g.cur, gr = c.createRadialGradient(at[0], at[1], 0, at[0], at[1], r);
  gr.addColorStop(0, col + "ff"); gr.addColorStop(0.45, col + "aa"); gr.addColorStop(0.8, col + "33"); gr.addColorStop(1, col + "00");
  g.touch(at[0] - r, at[1] - r, at[0] + r, at[1] + r); c.save(); c.globalAlpha = a; c.fillStyle = gr; c.fillRect(at[0] - r, at[1] - r, r * 2, r * 2); c.restore();
};
// clean water into a drying wash: it pushes pigment out and strands it in a hard ring
export const backrun = (g: Gfx, at: P, r: number, seed: number, col: string, strength = 0.55) => {
  const c = g.cur;
  c.globalCompositeOperation = "destination-out";
  g.wash(jitter(oval(at[0], at[1], r, r * 0.86, 18), r * 0.2, seed), "#000000", { alpha: strength, seed, dx: 0, dy: 0, shrink: 1, rim: false });
  c.globalCompositeOperation = "multiply";
  g.wash(jitter(oval(at[0], at[1], r * 1.06, r * 0.93, 18), r * 0.22, seed + 7), col, { alpha: 0.24, seed: seed + 7, dx: 0, dy: 0, shrink: 1.02, rim: true });
  c.globalCompositeOperation = "source-over";
};
// take pigment back off with a damp brush: the only way to get light back in watercolour
export const lift = (g: Gfx, pts: P[], seed: number, strength = 0.5) => { const c = g.cur; c.globalCompositeOperation = "destination-out"; g.wash(pts, "#000000", { alpha: strength, seed, dx: 0, dy: 0, shrink: 1, rim: false }); c.globalCompositeOperation = "source-over"; };
// dry brush: a loaded brush dragged over dry paper skips, and only the tooth takes colour
export const dryBrush = (g: Gfx, a: P, b: P, w: number, col: string, seed: number, alpha = 0.5) => {
  const r = rng(seed), n = 5 + Math.floor(r() * 4), c = g.cur;
  for (let i = 0; i < n; i++) { const t0 = r() * 0.5, t1 = t0 + 0.2 + r() * 0.5, p0: P = [a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0], p1: P = [a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1]; g.fill(tube([p0, p1], w * (0.5 + r() * 0.8), w * 0.3, false), col, alpha * (0.5 + r() * 0.6)); }
};
// a blade of grass: it leaves the ground thick and ends in a point, and it bends with the wind
export const blade = (g: Gfx, root: P, len: number, ang: number, lean: number, w: number, col: string, seed: number, alpha = 0.9) => {
  const pts: P[] = []; for (let i = 0; i <= 5; i++) { const t = i / 5, a = ang + lean * t * t, r = len * t; pts.push([root[0] + Math.sin(a) * r, root[1] - Math.cos(a) * r]); }
  g.fill(tube(pts, w, w * 0.12, false), col, alpha);
};
export const clump = (g: Gfx, root: P, h: number, spread: number, col: string, seed: number, lean = 0, n = 7, alpha = 0.9) => {
  const r = rng(seed);
  for (let i = 0; i < n; i++) { const t = n > 1 ? i / (n - 1) - 0.5 : 0; blade(g, [root[0] + t * spread * 0.4 + (r() - 0.5) * 4, root[1] + (r() - 0.5) * 3], h * (0.6 + r() * 0.65), t * spread * 0.014 + (r() - 0.5) * 0.12, lean * (0.7 + r() * 0.6), Math.max(0.8, h * 0.028), col, seed + i, alpha * (0.7 + r() * 0.35)); }
};
