// THE FINALE FRAME. One sheet of cold-press, painted back to front: sky, hills, far field, the
// path, the grass planes with their flower drifts, the hero flowers, what it left behind, the
// creature, the fringe across the lens, and the signature in the corner. The camera is one
// number, so the same function paints the opening close-up and the last wide shot.
import { Ctx, Env, Gfx, P, PENCIL } from "../../core";
import { Cam, GRASS_LIT, GRASS_MID, GRASS_SHADE, projector } from "./world";
import { farField, footpath, grassBlades, grassWash, hills, sky } from "./scene";
import { Drift, drift, flower } from "./flora";
import { Flight, drawCreature } from "./creature";
import { blueprintSheet } from "./sheet";
import { clearCorner, signature } from "./signature";
import { clump } from "./paint";

export type FinaleState = { cam: Cam; creature: { at: P; scale: number; flight: Flight } | null; sig: number; lean: number };
export const PAPER_F = "#fbf7ee";

// hand-placed drifts: a centre, a radius, a species, and seeded scatter that thins outward.
// Three bare rests of plain grass are left on purpose, at world x 380-520 on P3, left of F3,
// and right of the path on P4.
const DRIFTS: [number, Drift][] = [
  [3.5, { sp: "buttercup", at: [470, 545], r: 150, n: 26, size: 5.5, seed: 7101 }],
  [3.5, { sp: "buttercup", at: [700, 560], r: 120, n: 16, size: 5, seed: 7102 }],
  [3.5, { sp: "daisy", at: [200, 560], r: 130, n: 12, size: 5, seed: 7103 }],
  [2.2, { sp: "poppy", at: [780, 655], r: 170, n: 20, size: 9, seed: 7201 }],
  [2.2, { sp: "cosmos", at: [640, 640], r: 90, n: 9, size: 11, seed: 7202 }],
  [2.2, { sp: "daisy", at: [250, 660], r: 120, n: 14, size: 8, seed: 7203 }],
  [1.0, { sp: "cornflower", at: [250, 690], r: 95, n: 13, size: 13, seed: 7301 }],
  [1.0, { sp: "daisy", at: [430, 720], r: 150, n: 16, size: 12, seed: 7302 }],
  [1.0, { sp: "cosmos", at: [760, 700], r: 110, n: 8, size: 13, seed: 7303 }],
];

export const drawFinale = (ctx: Ctx, env: Env, s: FinaleState) => {
  const W = env.W, H = env.H, g = new Gfx(ctx, env, 0, PENCIL), c = ctx, cam = s.cam;
  c.setTransform(env.scale, 0, 0, env.scale, 0, 0); c.fillStyle = PAPER_F; c.fillRect(0, 0, W, H);
  g.paper("coldpress", 0.16); /* the sheet, before anything is on it */
  g.group("plain", () => { sky(g, cam, W, H); }, { alpha: 1 }); /* a paint group softens and granulates every plane, which put a grey veil over the whole meadow: the washes carry their own edge */
  g.group("plain", () => { hills(g, cam); }, { alpha: 1 });
  g.group("plain", () => { farField(g, cam); }, { alpha: 1 });
  ([[3.5, 545, 61, 26, 0.06, 0.42], [2.2, 640, 67, 34, 0.08, 0.22], [1.0, 706, 71, 46, 0.1, 0]] as number[][]).forEach(([z, y0, seed, n, lean, fade]) => {
    g.group("plain", () => { grassWash(g, cam, z, y0, seed, { lean, fade, cool: z === 1 }); if (z === 3.5) footpath(g, cam); }, { alpha: 1 }); /* the path is worn INTO the plane it crosses */
    g.group("plain", () => grassBlades(g, cam, z, y0, seed, { blades: n, lean, fade }), { alpha: 0.95 }); /* blades on dry paint keep their edge */
    const pr = projector(cam, z);
    g.group("plain", () => DRIFTS.filter(([dz]) => dz === z).forEach(([, d]) => drift(g, d, pr.at, pr.k, s.lean)), { alpha: 0.97 });
  });
  /* the hero plane: what it left behind, and the two flowers it has already visited */
  const h0 = projector(cam, 0), h1 = projector(cam, 0.3);
  g.group("plain", () => {
    blueprintSheet(g, h0.at([150, 965]), 150 * h0.k);
    flower(g, "daisy", h0.at([330, 830]), 34 * h0.k, 7401, { variant: 0, lean: s.lean });
    flower(g, "daisy", h0.at([250, 880]), 26 * h0.k, 7402, { variant: 1, lean: s.lean });
    flower(g, "poppy", h1.at([560, 800]), 30 * h1.k, 7403, { variant: 0, lean: s.lean });
    flower(g, "poppy", h1.at([650, 840]), 22 * h1.k, 7404, { variant: 3, lean: s.lean });
  }, { alpha: 0.98 });
  if (s.creature) g.group("plain", () => drawCreature(g, s.creature!.at, s.creature!.scale, s.creature!.flight), { alpha: 0.98 });
  /* the fringe across the lens: huge, soft, no edge, and gone by the third second */
  const fr = projector(cam, -0.2);
  g.group("plain", () => { const roots: P[] = [[-40, 1120], [180, 1160], [900, 1150], [1120, 1090], [620, 1180]];
    roots.forEach((w0, i) => clump(g, fr.at(w0), (240 + i * 34) * fr.k, 60 * fr.k, [GRASS_SHADE, GRASS_MID, GRASS_LIT][i % 3], 7500 + i, 0.06 + i * 0.02, 6, 0.3)); }, { alpha: 0.5, blur: 2.2 });
  g.group("plain", () => { clearCorner(g, s.sig > 0 ? 1 : 0); signature(g, s.sig); }, { alpha: 1 });
  g.paper("washGran", 0.05); g.paper("coldpress", 0.07); /* the tooth of the sheet, over everything */
};
