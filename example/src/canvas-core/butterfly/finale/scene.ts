// THE WORLD, PAINTED. Sky, hills, far field, the path, and the grass planes. Everything is laid
// as a wash first and worked into while it is wet; nothing is outlined. Farther planes are
// paler, bluer, softer and lower in contrast, which is the only way distance reads in paint.
import { Gfx, P, jitter, oval, rng } from "../../core";
import { Cam, CLOUD_SHADE, FIELD_COOL, FIELD_LIT, FIELD_MID, GRASS_LIT, GRASS_MID, GRASS_SHADE, HILL_FAR, HILL_NEAR, HORIZON, PATH, SKY_LOW, SKY_TOP, SUN, SUN_AT, TREE, projector } from "./world";
import { backrun, clump, dryBrush, graded, lift, mottle, sunBloom, wet } from "./paint";

// a band of ground: the top contour, then enough points down the sides and along the bottom that
// the wash's own smoothing cannot bulge the corners out into the sky
const slab = (top: P[], bottom: number): P[] => {
  const out = [...top], right = top[top.length - 1][0], left = top[0][0];
  for (let i = 1; i <= 6; i++) out.push([right, top[top.length - 1][1] + ((bottom - top[top.length - 1][1]) * i) / 6]);
  for (let i = 1; i <= 8; i++) out.push([right + ((left - right) * i) / 8, bottom]);
  for (let i = 1; i < 6; i++) out.push([left, bottom + ((top[0][1] - bottom) * i) / 6]);
  return out;
};
const ridge = (y: number, amp: number, seed: number, from = -200, to = 1300): P[] => {
  const r = rng(seed), out: P[] = [];
  for (let x = from; x <= to; x += 60) out.push([x, y + Math.sin(x * 0.0042 + seed) * amp + Math.sin(x * 0.0011 + seed * 2) * amp * 1.6 + (r() - 0.5) * 6]);
  return out;
};

export const sky = (g: Gfx, c: Cam, W: number, H: number) => {
  const { at } = projector(c, 1e6), hor = projector(c, 20).at([0, HORIZON])[1];
  graded(g, -20, -20, W + 20, hor + 40, SKY_TOP, SKY_LOW);
  sunBloom(g, SUN_AT, 330, "#f8e6bd", 0.34); /* the sun is where the paper was left lightest, never a disc of paint */
  sunBloom(g, SUN_AT, 150, "#fdf4de", 0.6); sunBloom(g, SUN_AT, 62, "#fffdf7", 0.9);
  /* three cumulus, lifted: white tops, a blue-violet wash underneath */
  ([[250, 150, 140, 46], [620, 96, 92, 30], [900, 250, 110, 34]] as number[][]).forEach(([x, y, rx, ry], i) => {
    const top = jitter([...Array(9)].map((_, k) => { const a = Math.PI + (k / 8) * Math.PI; return [x + Math.cos(a) * rx, y + Math.sin(a) * ry * (0.7 + 0.5 * Math.sin(k * 2.1 + i)) ] as P; }), 6, 5200 + i);
    const base: P[] = [...top, [x + rx, y + ry * 0.35], [x - rx, y + ry * 0.35]];
    wet(g, base, CLOUD_SHADE, { alpha: 0.3, seed: 5210 + i, shrink: 0.98, dx: 2, dy: 4 });
    lift(g, jitter([...Array(9)].map((_, k) => { const a = Math.PI + (k / 8) * Math.PI; return [x + Math.cos(a) * rx * 0.94, y - 4 + Math.sin(a) * ry * 0.9] as P; }), 5, 5220 + i), 5230 + i, 0.62);
  });
};

export const hills = (g: Gfx, c: Cam) => {
  const { at, k } = projector(c, 20);
  const far = ridge(HORIZON + 6, 16, 3.1).map(at), near = ridge(HORIZON + 34, 22, 5.7, -200, 1300).map(at);
  const floor = 540 + (760 - c.look[1]) * k + 900;
  wet(g, slab(far, floor), HILL_FAR, { alpha: 0.5, seed: 5300, shrink: 0.995, rim: false, dx: 1, dy: 3 });
  wet(g, slab(near, floor), HILL_NEAR, { alpha: 0.46, seed: 5310, shrink: 0.995, rim: false, dx: -2, dy: 3 });
  mottle(g, [...near.slice(6, 14), ...far.slice(6, 14).reverse()], HILL_NEAR, 5320, 3, 0.1);
  /* a hedgerow of six rounded trees on the right ridge, and one lone tree on the left */
  const r = rng(5330);
  for (let i = 0; i < 6; i++) { const x = 760 + i * 52 + r() * 14, p = at([x, HORIZON + 30 + Math.sin(x * 0.0042 + 5.7) * 22 + Math.sin(x * 0.0011 + 11.4) * 35]); wet(g, jitter(oval(p[0], p[1] - 9 * k, 15 * k * (0.8 + r() * 0.5), 11 * k * (0.8 + r() * 0.4), 11), 2.5, 5340 + i), TREE, { alpha: 0.42, seed: 5340 + i, shrink: 0.96, rim: false }); }
  const lone = at([210, HORIZON + 26 + Math.sin(210 * 0.0042 + 5.7) * 22 + Math.sin(210 * 0.0011 + 11.4) * 35]), th = 26 * k;
  g.fill([[lone[0] - 1.6, lone[1] + 2], [lone[0] + 1.6, lone[1] + 2], [lone[0] + 1.1, lone[1] - th], [lone[0] - 1.1, lone[1] - th]], TREE, 0.55);
  wet(g, jitter(oval(lone[0], lone[1] - th - 9 * k, 15 * k, 13 * k, 13), 2.5, 5360), TREE, { alpha: 0.52, seed: 5360, shrink: 0.94, rim: true }); /* one lone tree on the left ridge, the thing your eye goes to */
};

// the far field: colour only, no plants, and the cloud shadows that sell the sunlight
export const farField = (g: Gfx, c: Cam) => {
  const { at, k } = projector(c, 8), bottom = 540 + (900 - c.look[1]) * k;
  ([[HORIZON + 44, FIELD_COOL, 0.4, 5400], [HORIZON + 96, FIELD_MID, 0.42, 5410], [HORIZON + 168, FIELD_LIT, 0.44, 5420]] as [number, string, number, number][]).forEach(([y, col, a, seed], i) => {
    const band = ridge(y, 9, seed * 0.001 + i).map(at);
    wet(g, slab(band, bottom), col, { alpha: a, seed, shrink: 0.996, rim: i > 0, dx: i ? 3 : -3, dy: 2 });
  });
  const r = rng(5430); /* drifts of flower colour, as dabs of pure pigment, nothing drawn */
  ([["#e2452b", 700, HORIZON + 70, 150, 26], ["#f5c93f", 330, HORIZON + 110, 170, 30], ["#ef9ab8", 880, HORIZON + 140, 120, 18]] as [string, number, number, number, number][]).forEach(([col, cx, cy, rad, n], i) => {
    for (let j = 0; j < n; j++) { const a = r() * 6.283, d = Math.sqrt(r()) * rad, p = at([cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.45]); g.fill(oval(p[0], p[1], (1.6 + r() * 1.8) * k, (1.2 + r() * 1.1) * k, 7), col, 0.32 + r() * 0.3); }
  });
  ([[420, HORIZON + 120, 260, 60, 5440], [860, HORIZON + 190, 200, 44, 5450]] as number[][]).forEach(([cx, cy, rx, ry, seed]) => { const p = at([cx, cy]); wet(g, jitter(oval(p[0], p[1], rx * k, ry * k, 14), 8, seed), CLOUD_SHADE, { alpha: 0.1, seed, shrink: 0.98, rim: false }); }); /* cloud shadows crossing the field */
};

// the footpath: someone walked out here, and the eye follows them to the gap in the ridges
export const footpath = (g: Gfx, c: Cam) => {
  const { at, k } = projector(c, 3.5);
  const spine: P[] = [[980, 1140], [860, 980], [740, 830], [640, 690], [560, 560], [520, 470], [512, 424]];
  const w = (t: number) => (62 - 56 * t) * k;
  const L: P[] = [], R: P[] = [];
  spine.forEach((p, i) => { const t = i / (spine.length - 1), q = at(p); L.push([q[0] - w(t), q[1]]); R.push([q[0] + w(t), q[1]]); });
  wet(g, [...L, ...R.reverse()], PATH, { alpha: 0.42, seed: 5500, shrink: 0.985, rim: false, dx: 2, dy: 2 });
  mottle(g, [...L.slice(0, 4), ...R.slice(0, 4).reverse()], PATH, 5510, 3, 0.1);
};

// a grass plane: three wash bands on an S contour, then dry-brush and blades on top of dry paint
export const grassWash = (g: Gfx, c: Cam, z: number, y0: number, seed: number, o: { blades?: number; lean?: number; cool?: boolean; fade?: number } = {}) => {
  const { at, k } = projector(c, z), bottom = 540 + (1500 - c.look[1]) * k, r = rng(seed), fade = o.fade ?? 0;
  const mix = (a: string, b: string, t: number) => { const h = (x: string) => [parseInt(x.slice(1, 3), 16), parseInt(x.slice(3, 5), 16), parseInt(x.slice(5, 7), 16)]; const A = h(a), B = h(b); return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join(""); };
  const air = (col: string) => mix(col, "#cfd9dd", fade); /* farther is paler, bluer, lower in contrast: that is all distance is */
  const cols = (o.cool ? [GRASS_SHADE, GRASS_MID, GRASS_LIT] : [GRASS_MID, GRASS_LIT, GRASS_MID]).map(air);
  cols.forEach((col, i) => {
    const band = ridge(y0 + i * 44, 13, seed * 0.01 + i * 3).map(at);
    wet(g, slab(band, bottom), col, { alpha: (0.34 + i * 0.05) * (1 + (1 - fade) * 1.1), seed: seed + i, shrink: 0.996, rim: i === 1, dx: i % 2 ? 3 : -3, dy: 2 }); /* the near planes carry enough pigment to hide what is behind them, or the picture goes milky */
    const hollow = ridge(y0 + i * 44 + 6, 13, seed * 0.01 + i * 3).map(at), lipY = 540 + (y0 + i * 44 + 30 - c.look[1]) * k;
    wet(g, slab(hollow, lipY), air(GRASS_SHADE), { alpha: 0.16 + (1 - fade) * 0.1, seed: seed + 40 + i, shrink: 0.995, rim: false, dx: -2, dy: 1 }); /* the shaded lip where the ground dips away */
  });
  mottle(g, [[-300, 540 + (y0 - c.look[1]) * k] as P, [1400, 540 + (y0 - c.look[1]) * k] as P, [1400, bottom] as P, [-300, bottom] as P], air(GRASS_MID), seed + 90, 4, 0.05);
};

// the blades go on DRY paint, so they are their own pass and they keep their edges
export const grassBlades = (g: Gfx, c: Cam, z: number, y0: number, seed: number, o: { blades?: number; lean?: number; fade?: number } = {}) => {
  const { at, k } = projector(c, z), r = rng(seed + 7), fade = o.fade ?? 0;
  const mix = (a: string, b: string, t: number) => { const h = (x: string) => [parseInt(x.slice(1, 3), 16), parseInt(x.slice(3, 5), 16), parseInt(x.slice(5, 7), 16)]; const A = h(a), B = h(b); return "#" + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join(""); };
  const air = (col: string) => mix(col, "#cfd9dd", fade), n = o.blades ?? 26, palette = [GRASS_SHADE, GRASS_MID, GRASS_LIT].map(air);
  for (let i = 0; i < n; i++) {
    const wx = -260 + r() * 1620, wy = y0 + 16 + r() * 200, p = at([wx, wy]), h = (30 + r() * 62) * k, lean = (o.lean ?? 0) + (r() - 0.5) * 0.12;
    g.fill(oval(p[0] - h * 0.22, p[1] + 2 * k, h * 0.3, h * 0.09, 9), air(GRASS_SHADE), 0.2 * (1 - fade)); /* the shadow the clump throws to its lower left: this is what says SUN */
    clump(g, p, h, 22 * k, palette[Math.floor(r() * 3)], seed * 7 + i * 13, lean, 5 + Math.floor(r() * 5), (0.62 + r() * 0.33) * (1 - fade * 0.45));
    if (r() < 0.24) { const tip: P = [p[0] + Math.sin(lean * 1.6) * h * 0.6, p[1] - h * 0.95]; g.fill(oval(tip[0], tip[1], 2.6 * k, 5.6 * k, 9), air(GRASS_SHADE), 0.5 * (1 - fade)); }
  }
  for (let i = 0; i < n * 0.7; i++) { const wx = -260 + r() * 1620, wy = y0 + 50 + r() * 170, p = at([wx, wy]); dryBrush(g, p, [p[0] + (r() - 0.5) * 80 * k, p[1] - (18 + r() * 34) * k], 2.6 * k, air(GRASS_SHADE), seed * 11 + i, 0.3 * (1 - fade * 0.6)); }
};
