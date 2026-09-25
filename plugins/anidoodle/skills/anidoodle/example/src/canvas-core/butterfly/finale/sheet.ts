// WHAT IT LEFT BEHIND. A sheet of blueprint lying in the grass with a butterfly-shaped BLANK in
// it, and the winding key on top of it. The plate is still here; the creature is not in it.
import { Gfx, P, jitter, oval, rng, tube } from "../../core";
import { CX, CY, FW, FW_H, FW_T, HW, HW_H, HW_T, REST, THORAX, cen, lerp, wingGeom } from "../geom";
import { PAPER_W } from "./world";
import { lift, mottle, wet } from "./paint";

const GROUND_BLUE = "#2e5f86";
export const blueprintSheet = (g: Gfx, at: P, w: number, seed = 6000) => {
  const c = g.cur, h = w * 0.72, r = rng(seed);
  /* the sheet lies in the grass, so it is a parallelogram with a lifted near corner */
  const quad: P[] = [[at[0] - w * 0.5, at[1] - h * 0.34], [at[0] + w * 0.52, at[1] - h * 0.46], [at[0] + w * 0.46, at[1] + h * 0.4], [at[0] - w * 0.56, at[1] + h * 0.5]];
  wet(g, jitter(quad, w * 0.012, seed), GROUND_BLUE, { alpha: 0.62, seed, shrink: 0.985, rim: true, dx: 2, dy: 2 });
  mottle(g, quad, GROUND_BLUE, seed + 3, 3, 0.12);
  const grid = 5; c.save(); g.path(c, quad); c.clip();
  for (let i = 1; i < grid; i++) { const a = lerp(quad[0], quad[3], i / grid), b = lerp(quad[1], quad[2], i / grid); g.fill(tube([a, b], w * 0.004, w * 0.004, false), "#9fc4dd", 0.3); const p = lerp(quad[0], quad[1], i / grid), q = lerp(quad[3], quad[2], i / grid); g.fill(tube([p, q], w * 0.004, w * 0.004, false), "#9fc4dd", 0.3); }
  c.restore();
  /* the blank: the creature's own silhouette, lifted clean out of the plate */
  const sc = (w / 1080) * 1.5, T = (p: P): P => [at[0] + (p[0] - CX) * sc * 0.92, at[1] + (p[1] - CY) * sc * 0.5];
  const wings = [wingGeom(-1, HW, HW_H, HW_T, 2000, REST), wingGeom(1, HW, HW_H, HW_T, 2600, REST), wingGeom(-1, FW, FW_H, FW_T, 1000, REST), wingGeom(1, FW, FW_H, FW_T, 1600, REST)];
  wings.forEach((wg, i) => lift(g, wg.out.map(T), seed + 20 + i, 0.92));
  lift(g, THORAX.map(T), seed + 30, 0.92);
  const abd: P[] = []; for (let i = 0; i <= 6; i++) { const t = i / 6, y = 70 + 170 * t, hw = 23 * (1 - t) ** 0.8 + 6.5; abd.push(T([CX + hw, CY + y])); } for (let i = 6; i >= 0; i--) { const t = i / 6, y = 70 + 170 * t, hw = 23 * (1 - t) ** 0.8 + 6.5; abd.push(T([CX - hw, CY + y])); }
  lift(g, abd, seed + 32, 0.92);
  /* the key, lying on top of it: it does not need winding any more */
  const k: P = [at[0] + w * 0.3, at[1] + h * 0.16], kw = w * 0.055;
  g.fill(tube([[k[0] - kw * 2.2, k[1] + kw * 0.6], [k[0] + kw * 1.4, k[1] - kw * 0.4]], kw * 0.42, kw * 0.42, false), "#d8dfe4", 0.9);
  [-1, 1].forEach((sd) => { const b = jitter(oval(k[0] + kw * (1.9 + sd * 0.9), k[1] - kw * (0.5 + sd * 0.25), kw * 0.8, kw * 0.58, 10), kw * 0.06, seed + 40 + sd); g.fill(b, "#d8dfe4", 0.9); g.fill(oval(k[0] + kw * (1.9 + sd * 0.9), k[1] - kw * (0.5 + sd * 0.25), kw * 0.34, kw * 0.24, 8), "#8fa8b8", 0.8); });
  g.fill(oval(k[0] - kw * 0.4, k[1] + kw * 1.1, kw * 2.4, kw * 0.5, 10), "#5e7f52", 0.2); /* its shadow in the grass */
};
