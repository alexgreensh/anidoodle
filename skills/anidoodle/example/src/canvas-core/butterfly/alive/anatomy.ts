// LEPIDOPTERAN ANATOMY, built on the plate's own control points. Spec 5.7:
// the stained-glass direction is withdrawn. A spar is no longer a ruled line between two panels,
// it is a VEIN, and the panel between two veins is a wing CELL covered in scales. The spars keep
// their positions, so Act 1's silhouette and rhythm carry over exactly; what changes is that the
// structure hanging off them is now true.
//
// REFERENCE ACTUALLY OPENED before a point was moved (5.7 asks which; these are the four):
//   1. "Veinspaces1" (butterfly-ID venation plate, forewing above, hindwing below, CELL labelled,
//      veins v1a-v12 and spaces s1a-s12). It settles the topology this file implements: a closed
//      DISCAL CELL running from the base to about half the wing; veins leaving the END of that
//      cell and fanning to the outer margin; further veins branching off the cell's LOWER edge at
//      intervals rather than from its end; above the cell a costal trunk that forks two or three
//      times toward the apex; and one unbranched anal vein along the inner margin. Around twelve
//      veins reach the forewing margin and around eight the hindwing.
//   2. bobs-bugs "Wing venation" (generic insect wing, trunks coloured by system). It settles the
//      two rules that matter more than the count: veins BRANCH outward and NEVER cross, and every
//      vein is thickest at the base and thins toward the margin.
//   3. Alamy monarch on a crown flower, lateral, wings closed. It settles what the underside does
//      graphically: the venation is the dominant mark, the margin carries a dark band with a
//      DOUBLE row of pale spots, and a fine alternating fringe sits outside that.
//   4. Shutterstock macro of a butterfly's head at a flower. It settles the head: the compound eye
//      is a large dark dome with one soft highlight, the head and thorax are densely furred, the
//      antenna is thick and finely ringed at its base, the PALPS are two furry forward projections
//      below the eyes, and the proboscis leaves from BELOW the palps as a fine dark tube.
import { P, jitter, rng } from "../../core";
import { Wing, cen, lerp } from "../geom";

export type Vein = { pts: P[]; w: number; main: boolean }; // w is relative weight at the base; every vein thins to a point at the margin
export type Anatomy = { out: P[]; veins: Vein[]; cell: P[]; ends: P[]; span: number };

const push = (p: P, c: P, k: number): P => [p[0] + (p[0] - c[0]) * k, p[1] + (p[1] - c[1]) * k];
const bow = (a: P, b: P, k: number): P[] => { const nx = -(b[1] - a[1]), ny = b[0] - a[0], l = Math.hypot(nx, ny) || 1; return [a, [a[0] + (b[0] - a[0]) * 0.34 + (nx / l) * k * 0.7, a[1] + (b[1] - a[1]) * 0.34 + (ny / l) * k * 0.7], [a[0] + (b[0] - a[0]) * 0.7 + (nx / l) * k, a[1] + (b[1] - a[1]) * 0.7 + (ny / l) * k], b]; };

// The margin between two vein ends is gently SCALLOPED: the veins hold the margin out and the
// membrane between them falls away. A ruled or a smoothly swept margin is the tell.
export const scallop = (out: P[], ends: P[], c: P, depth: number): P[] => {
  const near = (q: P) => ends.reduce((best, e) => (Math.hypot(e[0] - q[0], e[1] - q[1]) < Math.hypot(best[0] - q[0], best[1] - q[1]) ? e : best), ends[0]);
  return out.map((q) => { const e = near(q), d = Math.hypot(e[0] - q[0], e[1] - q[1]), sp = Math.hypot(q[0] - c[0], q[1] - c[1]); return d < sp * 0.34 ? push(q, c, -depth * Math.sin((d / (sp * 0.34)) * Math.PI) ) : q; });
};

// One wing's venation. `fore` picks the forewing plan (a long cell, a forked costal trunk, twelve
// veins) from the hindwing's (a short cell near the base, eight veins, no apical fork).
export const venation = (wg: Wing, fore: boolean, seed: number): Anatomy => {
  const r = rng(seed), E = wg.ends, n = E.length, h = wg.h, c = cen(wg.out);
  const span = Math.max(...wg.out.map((q) => Math.hypot(q[0] - h[0], q[1] - h[1])));
  const veins: Vein[] = [];
  // a margin target: along the chord between two tips, pushed out onto the margin itself
  const M = (i: number, f: number): P => push(lerp(E[Math.min(i, n - 1)], E[Math.min(i + 1, n - 1)], f), c, 0.03);

  // ---- the CELL. Closed, from the base to about half the wing, bounded above by the subcostal
  // trunk and below by the cubital, and shut at its outer end by the DISCOCELLULAR vein.
  const up = fore ? 1 : 1, lo = fore ? 4 : Math.max(2, n - 3), tU = fore ? 0.5 : 0.42, tL = fore ? 0.43 : 0.36;
  const cellU = [0, 0.25, 0.5, 0.75, 1].map((t) => wg.spar(up, t * tU)), cellL = [0, 0.25, 0.5, 0.75, 1].map((t) => wg.spar(lo, t * tL));
  const C1 = cellU[4], C2 = cellL[4];
  const disco = bow(C1, C2, span * 0.012); /* the discocellular is a little concave: it was pulled in when the wing dried */
  const cell = [...cellU, ...disco.slice(1, 3), ...cellL.slice().reverse()];
  veins.push({ pts: cellU, w: 1, main: true }, { pts: cellL, w: 0.95, main: true }, { pts: disco, w: 0.5, main: false });

  // ---- above the cell: the costal trunk to the leading margin, forking toward the apex
  const costa = [0, 0.3, 0.62, 1].map((t) => wg.spar(0, 0.04 + t * 0.94));
  veins.push({ pts: costa, w: 1, main: true });
  if (fore) [0.5, 0.72].forEach((t, k) => { const from = wg.spar(0, t), to = lerp(wg.spar(0, 1), wg.spar(1, 1), 0.3 + k * 0.45); veins.push({ pts: bow(from, to, span * 0.008 * (r() - 0.5)), w: 0.58 - k * 0.1, main: false }); }); /* radial branches: they leave one trunk in sequence, toward the apex, and never cross */ /* radial branches: they leave one trunk in sequence and never cross */

  // ---- the fan that fills the outer half of the wing. These veins ARE the plate's spars, which
  // is what "they keep their positions" has to mean: a vein that leaves the cell and then strikes
  // off on a bearing of its own is a ruled line with a new colour. Each one starts where the cell
  // ends and runs out to the margin the spar already reaches.
  for (let k = 1; k < n - 1; k++) {
    if (k === up || k === lo) continue;
    const inCell = k > up && k < lo, t0 = inCell ? (tU + tL) / 2 : 0.05;
    veins.push({ pts: [0, 0.26, 0.56, 0.8, 1].map((t) => wg.spar(k, t0 + t * (0.99 - t0))), w: 0.9 - Math.abs(k - (up + lo) / 2) * 0.06, main: true });
  }
  // ---- and off the cell's LOWER edge, at intervals: the one piece of structure the blueprint
  // never had, and the detail that separates a real plan from a fan of spokes, because these
  // start part way along a trunk instead of at its end
  [0.58, 0.88].forEach((t, k) => { const from = wg.spar(lo, t * tL), to = M(n - 3 + k, 0.35 + r() * 0.3); veins.push({ pts: bow(from, to, span * 0.012), w: 0.6 - k * 0.08, main: false }); });
  // ---- the anal vein: unbranched, along the inner margin
  veins.push({ pts: [0, 0.4, 0.75, 1].map((t) => wg.spar(n - 1, 0.04 + t * 0.86)), w: 0.66, main: true });
  if (!fore) veins.push({ pts: bow(wg.spar(n - 1, 0.3), M(n - 2, 0.7), span * 0.01), w: 0.5, main: false }); /* the hindwing carries a second anal vein */

  const ends = veins.filter((v) => v.main).map((v) => v.pts[v.pts.length - 1]);
  return { out: scallop(jitter(wg.out, span * 0.004, seed + 3), ends, c, 0.018), veins, cell, ends, span };
};

// The membrane between two adjacent veins: a wing CELL. These are what carry the scales, the
// ground colour and the markings, and they are bounded by real veins rather than ruled apart.
export const cells = (a: Anatomy): P[][] => {
  const main = a.veins.filter((v) => v.main), c = cen(a.out), out: P[][] = [];
  const byAngle = main.slice().sort((p, q) => Math.atan2(p.pts[p.pts.length - 1][1] - c[1], p.pts[p.pts.length - 1][0] - c[0]) - Math.atan2(q.pts[q.pts.length - 1][1] - c[1], q.pts[q.pts.length - 1][0] - c[0]));
  for (let i = 0; i < byAngle.length - 1; i++) {
    const A = byAngle[i].pts, B = byAngle[i + 1].pts;
    const mid = lerp(A[A.length - 1], B[B.length - 1], 0.5);
    out.push([...A, push(mid, c, 0.015), ...B.slice().reverse()]);
  }
  return out;
};
