// THE CAMERA, spec section 4. A true dolly over depth planes: camera distance D, plane depth z,
// plane scale 1/(D + z). The hero plane is z = 0, so the hero scale S is 1/D, and S is SCREEN
// PIXELS PER SHEET UNIT: at S = 1 the creature (wingspan 780 units) is 780 px across.
//
// NOTE, one engine item, does not block the stills: the finale world's projector
// (butterfly/finale/world.ts) normalises every plane by (1 + z) so that all planes are 1:1 on the
// last frame. That convention inverts parallax for D > 1, and movement 2 spends almost all of its
// time there (D runs 0.25 to 8.7). This movement uses the spec's model instead. The two have to
// be reconciled once, at the wide end, by choosing world positions for the last bars; that is
// G-W work, not stills work.
import { P } from "../../core";
import { S_KEYS } from "./cues";

export type Cam = { S: number; look: P };
export const distance = (S: number) => 1 / S;
export const scaleAt = (c: Cam, z: number) => 1 / (distance(c.S) + z);
export const projector = (c: Cam, z: number) => { const k = scaleAt(c, z); return { k, at: (p: P): P => [540 + (p[0] - c.look[0]) * k, 540 + (p[1] - c.look[1]) * k] }; };
// A close shot must not fatten the line by the zoom: w = w_authored * S^0.35 (spec 4).
export const weight = (S: number) => Math.pow(S, 0.35);

// Monotone cubic (Fritsch-Carlson) so the dolly never overshoots into a scale it was not given,
// and never reverses: S is interpolated in log2, which is what "one stop of zoom" means.
const mono = (xs: number[], ys: number[], x: number): number => {
  const n = xs.length;
  if (x <= xs[0]) return ys[0];
  if (x >= xs[n - 1]) return ys[n - 1];
  const d: number[] = []; for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  const m: number[] = [d[0]]; for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2); m.push(d[n - 2]);
  for (let i = 0; i < n - 1; i++) { if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; } const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b; if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; } }
  let i = 0; while (x > xs[i + 1]) i++;
  const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
  return ys[i] * (2 * t3 - 3 * t2 + 1) + h * m[i] * (t3 - 2 * t2 + t) + ys[i + 1] * (-2 * t3 + 3 * t2) + h * m[i + 1] * (t3 - t2);
};
const SX = S_KEYS.map((k) => k[0]), SY = S_KEYS.map((k) => Math.log2(k[1]));
export const scaleOf = (local: number): number => Math.pow(2, mono(SX, SY, local));
