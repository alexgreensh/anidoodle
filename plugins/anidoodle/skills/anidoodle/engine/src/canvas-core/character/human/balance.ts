// BALANCE and REACH. A standing figure is checked, not trusted: its centre of mass (from standard
// segment-mass tables) must fall inside the polygon its feet (and any seat) make on the floor.
// Contrapposto is built, not drawn: the weight leg is carried under the centre, the pelvis
// drops on the free side, the shoulders tilt against it.
//
// Segment masses and centre-of-mass positions: Winter (2009) table 4.1 / Dempster (1955):
// head+neck 8.1%, thorax 21.6%, abdomen 13.9%, pelvis 14.2%, upper arm 2.8% (COM 43.6% from
// the shoulder), forearm 1.6% (43%), hand 0.6%, thigh 10% (43.3%), shank 4.65% (43.3%), foot 1.45%.
import { DEG, V3, add, apply, dist, mix3, mul, mv, sub, tr } from "../math3";
import type { Pose } from "../types";
import { hull, insidePoly, edgeDist } from "../shape2d";
import type { P } from "../../core";
import { type Dims, type Rig, type Side, SIDES, fk, limitViolations, lowestFoot, sgn } from "./skeleton";

export const centreOfMass = (r: Rig): V3 => {
  const J = r.joints, d = r.dims, acc: [V3, number][] = [];
  acc.push([apply(r.head, [0, (0.5 - 0.25) * d.hh, 0.05 * d.hh]), 0.081], [apply(r.chest, [0, 0.55 * d.hh, 0]), 0.216], [J.lumbar, 0.139], [J.pelvis, 0.142]);
  for (const s of SIDES) {
    acc.push([mix3(J["shoulder" + s], J["elbow" + s], 0.436), 0.028], [mix3(J["elbow" + s], J["wrist" + s], 0.43), 0.016], [apply(r.hand[s], [0, -d.hand * 0.4, 0]), 0.006]);
    acc.push([mix3(J["hip" + s], J["knee" + s], 0.433), 0.1], [mix3(J["knee" + s], J["ankle" + s], 0.433), 0.0465], [mix3(J["heel" + s], J["toeTip" + s], 0.45), 0.0145]);
  }
  const tot = acc.reduce((a, [, m]) => a + m, 0);
  return mul(acc.reduce((a, [p, m]) => add(a, mul(p, m)), [0, 0, 0] as V3), 1 / tot);
};

// the support polygon on the floor (x, z): every foot point within `eps` of the floor, plus extras (a seat)
export const supportPolygon = (r: Rig, eps = 0.012, extra: V3[] = []): P[] => {
  const pts: P[] = [], d = r.dims;
  for (const s of SIDES) {
    const cand: V3[] = [[0, -d.ankleH, -d.heel * 0.9], [d.ankleH * 0.35, -d.ankleH, -d.heel * 0.6], [-d.ankleH * 0.35, -d.ankleH, -d.heel * 0.6]].map((l) => apply(r.foot[s], l as V3));
    cand.push(...([[0.035 * d.height, 0, 0], [-0.035 * d.height, 0, 0], [0, 0, d.toe - d.ball]] as V3[]).map((l) => apply(r.toes[s], [l[0], -d.ankleH * 0.15, l[2]])));
    cand.forEach((q) => { if (q[1] < eps) pts.push([q[0], q[2]]); });
  }
  extra.forEach((q) => pts.push([q[0], q[2]]));
  return pts.length >= 3 ? hull(pts) : pts;
};

export type Balance = { com: V3; support: P[]; inside: boolean; margin: number };
export const balance = (r: Rig, extra: V3[] = []): Balance => {
  const com = centreOfMass(r), sup = supportPolygon(r, 0.012, extra);
  const inside = sup.length >= 3 && insidePoly(sup, com[0], com[2]);
  return { com, support: sup, inside, margin: sup.length >= 3 ? (inside ? 1 : -1) * edgeDist(sup, [com[0], com[2]]) : -1 };
};

// ---------------------------------------------------------------- inverse kinematics
// Legs are analytic (two bones, knee in the leg's own sagittal plane): given where the ankle
// must be, return hipFlex, hipAbd, knee. The foot is then set flat unless a pitch is given.
export const legIK = (r: Rig, s: Side, ankle: V3, footPitch = 0): Record<string, number> => {
  const d = r.dims, k = sgn(s), H = r.joints["hip" + s], a = d.thigh, b = d.shin;
  const dl = mv(tr(r.pelvis.R), sub(ankle, H)), L = Math.min(a + b - 1e-4, Math.max(Math.abs(a - b) + 1e-3, Math.hypot(...dl)));
  const inner = Math.acos(Math.max(-1, Math.min(1, (a * a + b * b - L * L) / (2 * a * b)))), knee = Math.PI - inner;
  const y0 = -a - b * Math.cos(knee), z0 = -b * Math.sin(knee);
  const sinT = Math.max(-1, Math.min(1, dl[0] / -y0)), th = Math.asin(sinT), y1 = Math.cos(th) * y0, z1 = z0;
  const phi = Math.atan2(dl[2], dl[1]) - Math.atan2(z1, y1);
  let flex = -phi / DEG; while (flex > 180) flex -= 360; while (flex < -180) flex += 360;
  return { ["hipFlex" + s]: flex, ["hipAbd" + s]: (th / DEG) * k, ["knee" + s]: knee / DEG, ["ankle" + s]: 0, _pitch: footPitch };
};
// after legIK, the ankle angle that puts the sole at `pitch` degrees (toes up +) to the floor
export const flatFoot = (dims: Dims, pose: Pose, s: Side, pitch = 0): number => {
  const r = fk(dims, { ...pose, joints: { ...pose.joints, ["ankle" + s]: 0 } }), R = r.shin[s].R;
  // foot forward in the world = shinR * (0, sin a, cos a); want its elevation = pitch
  const target = Math.sin(pitch * DEG), A = R[4], B = R[5], m = Math.hypot(A, B), base = Math.atan2(B, A);
  const a = Math.asin(Math.max(-1, Math.min(1, target / (m || 1)))) - base;
  let deg = a / DEG; while (deg > 180) deg -= 360; while (deg < -180) deg += 360;
  return deg;
};

// A small deterministic numeric solver: coordinate descent on named joints, inside their limits.
// Used for reaching (an arm to a point), pinching (thumb pad to finger pad), anything with a goal.
export const solve = (pose: Pose, keys: string[], cost: (p: Pose) => number, iters = 60, step0 = 16): Pose => {
  let p = { ...pose, joints: { ...pose.joints } }, c = cost(p), step = step0;
  for (let it = 0; it < iters && step > 0.05; it++) {
    let improved = false;
    for (const k of keys) for (const sgnv of [1, -1]) {
      const q = { ...p, joints: { ...p.joints, [k]: (p.joints[k] ?? 0) + sgnv * step } };
      if (limitViolations(q.joints).length) continue;
      const cq = cost(q); if (cq < c - 1e-9) { p = q; c = cq; improved = true; }
    }
    if (!improved) step *= 0.5;
  }
  return p;
};
export const reach = (dims: Dims, pose: Pose, s: Side, target: V3, keep: Partial<Record<string, number>> = {}): Pose => {
  const keys = ["shoulderRaise", "shoulderSwing", "elbow", "shoulderTwist"].map((k) => k + s).filter((k) => keep[k] === undefined);
  return solve(pose, keys, (p) => { const r = fk(dims, p); return dist(r.joints["wrist" + s], target) + 0.0005 * Math.abs(p.joints["shoulderTwist" + s] ?? 0); });
};

// Contrapposto: weight on one leg. The pelvis drops on the FREE side, the shoulders tilt the
// other way, the free knee relaxes forward and a little out.
export const contrapposto = (weight: Side, amount = 1): Record<string, number> => {
  const w = sgn(weight), free: Side = weight === "L" ? "R" : "L", a = amount;
  return {
    pelvisSide: -7 * a * w, spineSide: 14 * a * w, pelvisTwist: -5 * a * w, spineTwist: 4 * a * w,
    ["hipAbd" + weight]: -3 * a, ["hipAbd" + free]: 5 * a, ["hipFlex" + free]: 12 * a, ["knee" + free]: 20 * a, ["ankle" + free]: -4 * a, ["hipRot" + free]: 10 * a,
    neckSide: -4 * a * w,
  };
};

// Put the feet where they are asked (ankle targets on the floor), solve both legs, set the soles
// flat (or at a pitch), and slide the pelvis until the centre of mass sits over `over` (a point
// on the floor: the weight foot for contrapposto, between the feet for an even stance).
export const stand = (dims: Dims, pose: Pose, feet: Record<Side, V3>, over: [number, number] | null, pitch: Partial<Record<Side, number>> = {}, iters = 8, floor = 0): Pose => {
  let p: Pose = { ...pose, plant: false, joints: { ...pose.joints } };
  const legs = () => { for (let pass = 0; pass < 2; pass++) {
    // a leg cannot stretch: if a foot is out of reach, the pelvis sinks until it is not
    for (let k = 0; k < 3; k++) { const r0 = fk(dims, p), over = Math.max(...SIDES.map((s) => dist(r0.joints["hip" + s], feet[s]) - (dims.thigh + dims.shin) * 0.998)); if (over <= 0) break; p = { ...p, root: [p.root[0], p.root[1] - over * 1.05, p.root[2]] }; }
    const r = fk(dims, p); for (const s of SIDES) { const ik = legIK(r, s, feet[s]); delete ik._pitch; Object.assign(p.joints, ik); } for (const s of SIDES) p.joints["ankle" + s] = Math.max(-44, Math.min(24, flatFoot(dims, p, s, pitch[s] ?? 0))); } }; // an ankle at its limit lifts the heel instead of folding further
  for (let it = 0; it < iters; it++) {
    legs();
    if (!over) break;
    const com = centreOfMass(fk(dims, p)), k = 0.9;
    p = { ...p, root: [p.root[0] + (over[0] - com[0]) * k, p.root[1], p.root[2] + (over[1] - com[2]) * k] };
  }
  legs(); // the last pelvis move must be followed by a leg solve, or the feet leave the floor
  // a pitched foot rests on its ball, not its ankle target: settle the whole figure onto the floor
  const low = lowestFoot(fk(dims, p));
  return { ...p, root: [p.root[0], p.root[1] - (low - floor), p.root[2]] };
};
export { SIDES, dist };
