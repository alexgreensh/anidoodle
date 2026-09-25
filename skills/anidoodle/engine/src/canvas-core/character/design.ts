// THE DRAWING LAYER. The skeleton is the invisible pose source; what is SEEN is designed.
//
// A designed mass is a SWEEP: a gesture curve through the joints (the line an illustrator draws
// first), carrying an authored cross-section table: at each station along the curve, four
// half-widths (lateral, medial, front, back) placed by hand, so one side can run straight while
// the other curves, a knee can notch, a calf can swell high at the back and a shin stay flat in
// front. The silhouette at any view is the support of that section in the direction square to
// the curve and the line of sight, so the contour is ONE designed curve per mass, never a chain
// of ellipsoid hulls. Long masses are split at their joints into overlapping sub-sweeps (so a
// bent elbow folds instead of self-intersecting); the union contour joins them into one line.
import type { P } from "../core";
import { Camera, Frame, V3, add, apply, cross, dot, mul, mv, norm, project, sub } from "./math3";
import { ccw } from "./shape2d";

// [station 0..1 along the curve, lateral, medial, front, back] half-widths in head units.
// "lateral" is the side away from the body's midline (+x of the frame times the side sign).
export type Section = [number, number, number, number, number];
export type Station = { at: V3; frame: Frame };           // a point the curve passes, and the body's axes there

const catmull = (p0: V3, p1: V3, p2: V3, p3: V3, t: number): V3 => {
  const t2 = t * t, t3 = t2 * t;
  return [0, 1, 2].map((i) => 0.5 * (2 * p1[i] + (-p0[i] + p2[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3)) as V3;
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
// smooth interpolation of the table at u (cosine between stations: the curves are the designer's, not linear kinks)
export const sectionAt = (tab: Section[], u: number): [number, number, number, number] => {
  if (u <= tab[0][0]) return [tab[0][1], tab[0][2], tab[0][3], tab[0][4]];
  for (let i = 1; i < tab.length; i++) if (u <= tab[i][0]) { const a = tab[i - 1], b = tab[i], t = (u - a[0]) / (b[0] - a[0] || 1), s = (1 - Math.cos(t * Math.PI)) / 2; return [lerp(a[1], b[1], s), lerp(a[2], b[2], s), lerp(a[3], b[3], s), lerp(a[4], b[4], s)]; }
  const z = tab[tab.length - 1]; return [z[1], z[2], z[3], z[4]];
};

export type SweepOpts = { hh: number; side: 1 | -1; n?: number; from?: number; to?: number; caps?: [boolean, boolean]; inset?: [number, number] }; // inset: a span at each end where the section narrows a touch, to bury a cut inside the neighbouring sub-sweep
// the gesture curve through the stations, as samples with interpolated axes
export const curve = (st: Station[], n: number) => {
  const pts: V3[] = [], xs: V3[] = [], zs: V3[] = [], us: number[] = [];
  const P = (i: number) => st[Math.max(0, Math.min(st.length - 1, i))].at;
  for (let seg = 0; seg < st.length - 1; seg++) for (let k = 0; k < n; k++) {
    const t = k / n; pts.push(catmull(P(seg - 1), P(seg), P(seg + 1), P(seg + 2), t));
    const A = st[seg].frame.R, B = st[seg + 1].frame.R, s = (1 - Math.cos(t * Math.PI)) / 2;
    xs.push(norm(add(mul([A[0], A[3], A[6]], 1 - s), mul([B[0], B[3], B[6]], s)))); zs.push(norm(add(mul([A[2], A[5], A[8]], 1 - s), mul([B[2], B[5], B[8]], s))));
  }
  pts.push(st[st.length - 1].at); const Z = st[st.length - 1].frame.R; xs.push([Z[0], Z[3], Z[6]]); zs.push([Z[2], Z[5], Z[8]]);
  let L = 0; us.push(0); for (let i = 1; i < pts.length; i++) { L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]); us.push(L); }
  return { pts, xs, zs, us: us.map((u) => u / (L || 1)), len: L };
};

// One sweep's screen polygon (plus end caps). `from`/`to` cut a sub-range of the curve.
export const sweep = (cam: Camera, st: Station[], tab: Section[], o: SweepOpts): P[][] => {
  const n = o.n ?? 10, c = curve(st, n), side = o.side, hh = o.hh, from = o.from ?? 0, to = o.to ?? 1;
  const Lp: P[] = [], Rp: P[] = [], ends: { at: V3; X: V3; Z: V3; T: V3; w: [number, number, number, number] }[] = [];
  for (let i = 0; i < c.pts.length; i++) {
    const u = c.us[i]; if (u < from - 1e-6 || u > to + 1e-6) continue;
    const p = c.pts[i], T = norm(sub(c.pts[Math.min(c.pts.length - 1, i + 1)], c.pts[Math.max(0, i - 1)]));
    // the section's own axes, square to the curve
    const X = norm(sub(c.xs[i], mul(T, dot(c.xs[i], T)))), Z0 = norm(cross(X, T)), Z: V3 = dot(Z0, c.zs[i]) >= 0 ? Z0 : mul(Z0, -1);
    const inA = o.inset?.[0] ? Math.max(0, 1 - (u - from) / o.inset[0]) : 0, inB = o.inset?.[1] ? Math.max(0, 1 - (to - u) / o.inset[1]) : 0, shrink = 1 - 0.08 * Math.max(inA, inB);
    const [lat, med, fr, bk] = sectionAt(tab, u).map((v) => v * hh * shrink), view = norm(sub(p, cam.eye));
    let e = cross(T, view); if (Math.hypot(...e) < 1e-6) e = X; e = norm(e);
    const ex = dot(e, X) * side, ez = dot(e, Z);
    const sup = (a: number, b: number) => Math.sqrt((a * (a > 0 ? lat : med)) ** 2 + (b * (b > 0 ? fr : bk)) ** 2);   // support of the four-quadrant section along a direction
    const wp = sup(ex, ez), wm = sup(-ex, -ez);
    const qa = project(cam, add(p, mul(e, wp))), qb = project(cam, add(p, mul(e, -wm)));
    Lp.push([qa.x, qa.y]); Rp.push([qb.x, qb.y]);
    if (ends.length === 0 || i === c.pts.length - 1 || c.us[i + 1] > to + 1e-6) ends.push({ at: p, X, Z, T, w: [lat, med, fr, bk] });
  }
  if (Lp.length < 2) return [];
  const out: P[][] = [ccw([...Lp, ...Rp.reverse()])];
  // caps: the end sections themselves, for when the mass points at the lens (foreshortened to a round end)
  const [c0, c1] = o.caps ?? [true, true];
  [ends[0], ends[ends.length - 1]].forEach((E, k) => {
    if (!E || (k === 0 && !c0) || (k === 1 && !c1)) return;
    const ring: P[] = Array.from({ length: 16 }, (_, j) => { const a = (j / 16) * Math.PI * 2, cx = Math.cos(a), cz = Math.sin(a), r = add(mul(E.X, cx * side * (cx * side > 0 ? E.w[0] : E.w[1])), mul(E.Z, cz * (cz > 0 ? E.w[2] : E.w[3]))); const q = project(cam, add(E.at, r)); return [q.x, q.y]; });
    out.push(ccw(ring));
  });
  return out;
};

// a mass split at its joints into overlapping sub-sweeps (each nearly straight), unioned by the part
export const jointed = (cam: Camera, st: Station[], tab: Section[], o: SweepOpts & { cuts: number[]; overlap?: number }): P[][] => {
  const cuts = [0, ...o.cuts, 1], ov = o.overlap ?? 0.09, out: P[][] = [];   // the overlap must span several samples, or the pieces meet edge to edge and the seam draws
  for (let i = 0; i + 1 < cuts.length; i++) out.push(...sweep(cam, st, tab, { ...o, n: Math.max(o.n ?? 10, 18), from: Math.max(0, cuts[i] - ov), to: Math.min(1, cuts[i + 1] + ov), caps: [i === 0 && (o.caps?.[0] ?? true), i === cuts.length - 2 && (o.caps?.[1] ?? true)], inset: [i > 0 ? ov * 1.2 : 0, i < cuts.length - 2 ? ov * 1.2 : 0] }));
  return out;
};

// where along a jointed curve a given station sits (for putting cuts exactly at the joints)
export const stationU = (st: Station[], idx: number) => { let L = 0; const ds: number[] = [0]; for (let i = 1; i < st.length; i++) { L += Math.hypot(...sub(st[i].at, st[i - 1].at)); ds.push(L); } return ds[idx] / (L || 1); };
export const station = (f: Frame, local: V3 = [0, 0, 0]): Station => ({ at: apply(f, local), frame: f });
export const lineOn = (cam: Camera, pts: V3[]): P[] => pts.map((v) => { const q = project(cam, v); return [q.x, q.y] as P; });
export { mv };
