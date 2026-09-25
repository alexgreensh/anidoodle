// FIVE SPECIES, FOUR VARIANTS EACH, and a level of detail that follows the painter's own rule:
// close up you draw the flower, further off you put down the petals as single strokes, further
// still it is two dabs, colour and shadow, and at the back of the field it is one dab.
// Every species is a colour the film has already used.
import { Gfx, P, oval, rng, tube } from "../../core";
import { BUTTERCUP, CORNFLOWER, COSMOS, DAISY, DAISY_SHADE, GRASS_SHADE, POPPY, POPPY_DARK, PAPER_W, STEM } from "./world";

export type Sp = "daisy" | "poppy" | "cornflower" | "cosmos" | "buttercup";
const COL: Record<Sp, [string, string]> = { daisy: [DAISY, DAISY_SHADE], poppy: [POPPY, POPPY_DARK], cornflower: [CORNFLOWER, "#3f5e9e"], cosmos: [COSMOS, "#d druck"], buttercup: [BUTTERCUP, "#d9a323"] };
COL.cosmos = [COSMOS, "#d2789a"];

const stem = (g: Gfx, root: P, head: P, w: number, seed: number, lean: number) => {
  const r = rng(seed), mid: P = [(root[0] + head[0]) / 2 + (r() - 0.5) * 8 * w + lean * 10, (root[1] + head[1]) / 2];
  g.fill(tube([root, mid, head], w * 1.25, w * 0.6, false), STEM, 0.8);
  if (w > 1.2) { const lp = 0.45 + r() * 0.25, at: P = [root[0] + (head[0] - root[0]) * lp, root[1] + (head[1] - root[1]) * lp], dir = r() < 0.5 ? -1 : 1; g.fill(tube([at, [at[0] + dir * w * 7, at[1] - w * 3], [at[0] + dir * w * 11, at[1] - w * 9]], w * 1.1, w * 0.4, false), STEM, 0.75); }
};
// one flower. `size` is its head radius on screen; everything else follows from that.
export const flower = (g: Gfx, sp: Sp, at: P, size: number, seed: number, o: { variant?: number; lean?: number; dip?: number; light?: number } = {}) => {
  const r = rng(seed), v = o.variant ?? Math.floor(r() * 4), [col, dark] = COL[sp], lean = (o.lean ?? 0) + (o.dip ?? 0) * 0.5;
  const head: P = [at[0] + lean * size * 1.6, at[1] - size * (sp === "daisy" ? 2.6 : sp === "poppy" ? 2.4 : sp === "cosmos" ? 3 : 2.2) * (1 - (o.dip ?? 0) * 0.12)];
  if (size < 3) { g.fill(oval(head[0], head[1], size * 1.2, size, 7), col, 0.75); return; }
  if (size < 7) { g.fill(oval(head[0] + size * 0.3, head[1] + size * 0.3, size * 1.1, size * 0.9, 8), dark, 0.4); g.fill(oval(head[0], head[1], size * 1.15, size * 0.95, 8), col, 0.85); return; } /* two dabs: colour and its shadow */
  stem(g, at, head, Math.max(0.7, size * 0.11), seed + 1, lean);
  const petals = sp === "daisy" ? 13 : sp === "poppy" ? 4 : sp === "cornflower" ? 11 : sp === "cosmos" ? 8 : 5;
  const bud = v === 3, profile = v === 2, tilt = v === 1 ? 0.55 : 1;
  if (bud) { g.fill(oval(head[0], head[1], size * 0.5, size * 0.78, 9), col, 0.85); g.fill(tube([[head[0], head[1] + size * 0.6], [head[0], head[1] - size * 0.2]], size * 0.36, size * 0.2, false), STEM, 0.8); return; }
  const open = profile ? Math.PI * 0.55 : Math.PI * 2, a0 = profile ? -Math.PI * 0.78 : 0;
  if (size < 16) { for (let i = 0; i < petals; i++) { const a = a0 + (i / petals) * open, e: P = [head[0] + Math.cos(a) * size * (profile ? 0.8 : 1), head[1] + Math.sin(a) * size * tilt]; g.fill(tube([head, e], size * 0.3, size * 0.14, false), i % 3 === 0 ? dark : col, 0.85); } g.fill(oval(head[0], head[1], size * 0.3, size * 0.3 * tilt, 8), sp === "daisy" ? BUTTERCUP : dark, 0.9); return; } /* petals as single strokes */
  for (let i = 0; i < petals; i++) {
    const a = a0 + (i / petals) * open + (r() - 0.5) * 0.12, L = size * (0.85 + r() * 0.3), lit = Math.cos(a + 0.9) * 0.5 + 0.5; /* the sun is upper right, so petals facing it are paler */
    const tip: P = [head[0] + Math.cos(a) * L, head[1] + Math.sin(a) * L * tilt], mid: P = [head[0] + Math.cos(a + 0.18) * L * 0.55, head[1] + Math.sin(a + 0.18) * L * 0.55 * tilt];
    const pet = [head, mid, tip, [head[0] + Math.cos(a - 0.2) * L * 0.5, head[1] + Math.sin(a - 0.2) * L * 0.5 * tilt] as P];
    g.wash(pet, lit > 0.55 ? col : dark, { alpha: sp === "daisy" ? 0.5 : 0.62, seed: seed + i * 3, dx: 1, dy: 1, shrink: 0.94, rim: r() > 0.5 });
    if (sp === "daisy" && lit > 0.6) g.fill(tube([head, tip], L * 0.16, L * 0.1, false), PAPER_W, 0.5); /* paper white left for the lit petals */
  }
  const cr = size * (sp === "poppy" ? 0.34 : 0.28);
  g.wash(oval(head[0], head[1], cr, cr * tilt, 10), sp === "daisy" || sp === "cosmos" ? BUTTERCUP : sp === "poppy" ? POPPY_DARK : dark, { alpha: 0.85, seed: seed + 40, dx: 0, dy: 0, shrink: 0.95, rim: true });
  if (sp === "poppy") { const r2 = rng(seed + 9); for (let i = 0; i < 7; i++) { const a = r2() * 6.283; g.fill(oval(head[0] + Math.cos(a) * cr * 1.5, head[1] + Math.sin(a) * cr * 1.5 * tilt, size * 0.05, size * 0.05, 6), POPPY_DARK, 0.7); } }
  g.fill(oval(at[0] - size * 0.5, at[1] + size * 0.12, size * 0.85, size * 0.22, 9), GRASS_SHADE, 0.18); /* the dab of shadow it throws on the grass */
};

// a DRIFT: a hand-placed centre, a radius, a species, and seeded scatter that thins toward its
// edge. No even scatter anywhere, and no variant more than a quarter of the drift.
export type Drift = { sp: Sp; at: P; r: number; n: number; size: number; seed: number };
export const drift = (g: Gfx, d: Drift, project: (p: P) => P, k: number, lean = 0, lod = 1) => {
  const r = rng(d.seed);
  const items: { p: P; s: number; v: number; seed: number }[] = [];
  for (let i = 0; i < d.n; i++) {
    const a = r() * 6.283, rad = Math.pow(r(), 0.7) * d.r, w: P = [d.at[0] + Math.cos(a) * rad, d.at[1] + Math.sin(a) * rad * 0.42];
    items.push({ p: project(w), s: d.size * k * (0.75 + r() * 0.5), v: Math.floor(r() * 4), seed: d.seed + i * 17 });
  }
  items.sort((a, b) => a.p[1] - b.p[1]); /* back to front, so nearer flowers overlap the ones behind */
  items.forEach((it) => { if (it.s * lod < 1.4) return; flower(g, d.sp, it.p, it.s, it.seed, { variant: it.v, lean }); });
};
