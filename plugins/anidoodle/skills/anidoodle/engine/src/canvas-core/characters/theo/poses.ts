// THEO'S POSES, built the way a figure-drawing teacher builds them: feet placed, legs solved,
// weight carried over the support, arms sent to a target. Nothing here is a hand-typed pile of
// angles where contact matters (a foot on the floor, a hand on a hip, fingers round a mug).
//
// Reference opened, per pose: contrapposto: Polykleitos' Doryphoros (Naples copy) and Loomis
// "Figure Drawing" p. 64 (the pelvis and shoulder lines tilting against each other); reaching:
// Hogarth "Dynamic Anatomy" p. 134 (the lengthened side, the ribcage lifting off the pelvis);
// sitting: Loomis p. 113 (thighs foreshorten, the pelvis rolls back on the sit bones); gripping:
// Hogarth "Drawing Dynamic Hands" pp. 70-75 (cylinder grip: four fingers stacked round the form,
// the thumb opposite); pointing at the lens: Hogarth "Dynamic Figure Drawing" ch. 3 (the hand
// overlaps and dwarfs the arm behind it).
import { Blob, Camera, DEG, I3, MIRROR_X, V3, add, apply, dist, mul, mv, norm, sub } from "../../character/math3";
import { order, toPart, type BlobPart } from "../../character/build";
import type { Pose, Scene } from "../../character/types";
import { dimsFromCanon, fk, type Rig } from "../../character/human/skeleton";
import { contrapposto, reach, stand } from "../../character/human/balance";
import { DIGITS, type HandAngles, HAND_POSES, handModel, handViolations } from "../../character/human/hands";
import { THEO_SPEC } from "./index";
import { rigFor } from "../../character/human/figure";
import type { Mark } from "../../character/types";
import type { P } from "../../core";
import { project } from "../../character/math3";

export const THEO_DIMS = dimsFromCanon(THEO_SPEC.canon, THEO_SPEC.height);
const D = THEO_DIMS, hh = D.hh, AH = D.ankleH;
const base = (yaw = 0, j: Record<string, number> = {}, ex: Record<string, number> = {}): Pose => ({ root: [0, D.root, 0], yaw, joints: { shoulderRaiseL: 7, shoulderRaiseR: 7, shoulderSwingL: 15, shoulderSwingR: 15, elbowL: 12, elbowR: 12, ...j }, expression: ex, hands: { L: "relaxed", R: "relaxed" }, plant: true });

// the turnaround stance: feet under the hips, weight even, arms easy
export const relaxed = (yaw: number): Pose => base(yaw);

// Contrapposto, weight on her LEFT leg (world +x at yaw 0): the free right foot steps forward and
// out, the pelvis drops on the right, the shoulders tilt the other way; right hand on the hip.
export const contra = (yaw: number): Pose => {
  const turn = (v: V3): V3 => mv([Math.cos(yaw * DEG), 0, Math.sin(yaw * DEG), 0, 1, 0, -Math.sin(yaw * DEG), 0, Math.cos(yaw * DEG)], v);
  let p = base(yaw, { ...contrapposto("L", 1), shoulderRaiseL: 9, elbowL: 16 }, { smile: 0.2, lookX: -0.2 });
  const feet = { L: turn([0.06, AH, 0.0]), R: turn([-0.14, AH, 0.12]) }; // weight foot near the midline, free foot out and forward
  const over = turn([0.06, 0, 0.055]); // the middle of the weight foot, heel to ball
  p = stand(D, p, feet, [over[0], over[2]], { R: 4 });
  // hand on the hip: the wrist to the side of the pelvis, elbow out
  // the arm swings out to the side and a touch back (swing held at -12), so the elbow points OUT
  const r = fk(D, p), hip = apply(r.pelvis, [-0.76 * hh, 0.24 * hh, -0.02 * hh]);
  p = reach(D, { ...p, joints: { ...p.joints, shoulderSwingR: -12, shoulderRaiseR: 40, elbowR: 95, wristFlexR: 10, pronationR: 40, shoulderTwistR: 20 } }, "R", hip, { shoulderSwingR: -12 });
  return { ...p, hands: { L: "relaxed", R: { relaxed: 0.4, open: 0.6 } } };
};

// Reaching up to a high shelf with the right hand, weight rolling onto the balls of the feet.
export const reachUp = (yaw: number): Pose => {
  const turn = (v: V3): V3 => mv([Math.cos(yaw * DEG), 0, Math.sin(yaw * DEG), 0, 1, 0, -Math.sin(yaw * DEG), 0, Math.cos(yaw * DEG)], v);
  let p = base(yaw, { spineSide: 8, spineBend: -6, neckBend: -14, headNod: -16, shoulderRaiseL: 14, elbowL: 20, clavLiftR: 22, toeL: 18, toeR: 18 }, { browRaise: 0.3, lookY: 0.8 });
  p = { ...p, root: [p.root[0], p.root[1] + 0.05, p.root[2]] }; // up on the toes: the toes bend flat to the floor, the heels lift
  const feet = { L: turn([0.13, AH + 0.04, 0.02]), R: turn([-0.12, AH + 0.04, -0.02]) };
  const fw = turn([0, 0, 0.165]); // over the balls of the feet, where the weight goes when the heels lift
  p = stand(D, p, feet, [(feet.L[0] + feet.R[0]) / 2 + fw[0], (feet.L[2] + feet.R[2]) / 2 + fw[2]], { L: -18, R: -18 });
  const target = turn([-0.18, 2.13, 0.2]);
  p = reach(D, { ...p, joints: { ...p.joints, shoulderRaiseR: 160, shoulderSwingR: 60, elbowR: 15 } }, "R", target);
  return { ...p, hands: { L: "relaxed", R: "open" } };
};

// Sitting on a stool: sit bones on the seat, thighs forward, feet flat, forearms on the thighs.
export const STOOL_H = 0.5;
export const sit = (yaw: number): Pose => {
  const turn = (v: V3): V3 => mv([Math.cos(yaw * DEG), 0, Math.sin(yaw * DEG), 0, 1, 0, -Math.sin(yaw * DEG), 0, Math.cos(yaw * DEG)], v);
  let p: Pose = { ...base(yaw, { pelvisTilt: -8, spineBend: 16, neckBend: 4, headNod: -8 }, { smile: 0.35 }), root: turn([0, STOOL_H + 0.11, -0.02]), plant: false };
  const feet = { L: turn([0.16, AH, 0.44]), R: turn([-0.15, AH, 0.5]) };
  p = stand(D, p, feet, null, {}, 1);
  const r = fk(D, p);
  p = reach(D, p, "L", add(r.joints.kneeL, turn([-0.02, 0.08, -0.08])));
  p = reach(D, p, "R", add(r.joints.kneeR, turn([0.03, 0.09, -0.1])));
  return { ...p, hands: { L: "relaxed", R: { relaxed: 0.6, open: 0.4 } } };
};
export const stool = (yaw: number): BlobPart[] => {
  const turn = (v: V3): V3 => mv([Math.cos(yaw * DEG), 0, Math.sin(yaw * DEG), 0, 1, 0, -Math.sin(yaw * DEG), 0, Math.cos(yaw * DEG)], v), s = STOOL_H;
  const seat: Blob = { c: turn([0, s - 0.03, -0.03]), R: I3, r: [0.19, 0.03, 0.19] };
  const legs: BlobPart[] = [0, 1, 2].map((i) => { const a = (i / 3) * Math.PI * 2 + 0.5, top = turn([Math.cos(a) * 0.12, s - 0.05, -0.03 + Math.sin(a) * 0.12]), foot = turn([Math.cos(a) * 0.2, 0.012, -0.03 + Math.sin(a) * 0.2]); return { id: `stoolLeg${i}`, role: "stool", groups: [{ blobs: [{ c: top, R: I3, r: [0.018, 0.018, 0.018] }, { c: foot, R: I3, r: [0.015, 0.015, 0.015] }], mode: "chain" }] }; });
  return [{ id: "stoolSeat", role: "stool", groups: [{ blobs: [seat], mode: "each" }], depthBias: 0.02 }, ...legs];
};

// Holding a mug in front of the chest. The fingers are SOLVED onto the cylinder: every
// joint and fingertip pulled to the mug's surface, none allowed inside it.
export const MUG_R = 0.042, MUG_H = 0.1;
export const mugFrame = (r: Rig) => { const f = r.hand.R, Lh = D.hand, c = apply(f, mv(MIRROR_X, [-(0.075 * Lh + MUG_R), -0.45 * Lh, 0.02 * Lh])), axis = norm(mv(f.R, [0, 0, 1])); return { c, axis }; };
export const holdCup = (): Pose => {
  let p: Pose = base(-20, { shoulderRaiseR: 22, shoulderSwingR: 75, elbowR: 112, shoulderTwistR: -18, wristFlexR: 8, wristDevR: 6, pronationR: 4, neckBend: 10, headNod: 8 }, { smile: 0.45, cheek: 0.3, lookX: 0.5, lookY: -0.6 });
  const r = rigFor(THEO_SPEC, p), { c, axis } = mugFrame(r);
  const fingers = gripCylinder(r, c, axis, MUG_R);
  return { ...p, hands: { L: "relaxed", R: { angles: fingers } } };
};
// the mug: a cylinder with a rim, coffee in it when we can see in, and a handle on the far side
export const mug = (p: Pose): BlobPart[] => {
  const r = rigFor(THEO_SPEC, p), { c, axis: up } = mugFrame(r), palm = norm(sub(c, r.joints.wristR));
  const out = norm(sub(palm, mul(up, dot3(palm, up))));                 // from the palm through the mug, square to its axis
  const bot = add(c, mul(up, -MUG_H * 0.55)), top = add(c, mul(up, MUG_H * 0.45));
  const disc = (at: V3, rad: number): Blob => ({ c: at, R: frameFromUp(up), r: [rad, 0.003, rad] });
  const handle: Blob[] = Array.from({ length: 6 }, (_, i) => { const a = -Math.PI / 2 + (i / 5) * Math.PI; return { c: add(add(c, mul(up, Math.sin(a) * MUG_H * 0.3)), mul(out, MUG_R + Math.cos(a) * MUG_H * 0.22)), R: I3, r: [0.008, 0.008, 0.008] }; });
  const rimMarks = (cam: Camera): Mark[] => {
    const side = norm(cross3(up, out)), ring = Array.from({ length: 20 }, (_, i) => { const a = (i / 20) * Math.PI * 2, q = project(cam, add(top, add(mul(out, Math.cos(a) * MUG_R), mul(side, Math.sin(a) * MUG_R)))); return [q.x, q.y] as P; });
    const seeIn = dot3(up, norm(sub(cam.eye, top))) > 0.05, m: Mark[] = [];
    if (seeIn) { m.push({ kind: "fill", pts: ring, role: "coffee", line: 1.4 }); }
    return m;
  };
  return [
    { id: "mug", role: "cup", groups: [{ blobs: [disc(bot, MUG_R), disc(top, MUG_R * 1.03)], mode: "chain" }], depthAt: c, marksFn: rimMarks },
    { id: "mugHandle", role: "cup", groups: [{ blobs: handle, mode: "chain" }], depthAt: add(c, mul(out, MUG_R + 0.02)) },
  ];
};
const dot3 = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const frameFromUp = (up: V3) => { const x = norm(cross3(up, Math.abs(up[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0])), z = cross3(x, up); return [x[0], up[0], z[0], x[1], up[1], z[1], x[2], up[2], z[2]] as import("../../character/math3").M3; };

// finger angles that wrap a cylinder (centre c, axis a, radius R): coordinate descent, deterministic
export const gripCylinder = (r: Rig, c: V3, a: V3, R: number): HandAngles => {
  const ang: HandAngles = JSON.parse(JSON.stringify(HAND_POSES.grip));
  const radial = (p: V3) => { const v = sub(p, c), t = v[0] * a[0] + v[1] * a[1] + v[2] * a[2]; return dist(v, mul(a, t)); };
  const cost = (h: HandAngles) => {
    const hm = handModel(r.hand.R, "R", D.hand, h); let e = 0;
    hm.digits.forEach((d) => d.pts.slice(1).forEach((p, i) => { const gap = radial(p) - (R + d.radii[i + 1] * 0.9); e += gap < 0 ? gap * gap * 40 : gap * gap * (i === 2 ? 3 : 1); }));
    return e + handViolations(h, "").length * 10;
  };
  let e = cost(ang), step = 8;
  for (let it = 0; it < 40 && step > 0.25; it++) {
    let imp = false;
    for (const d of DIGITS) for (let i = 1; i < 4; i++) for (const s of [1, -1]) { const t: HandAngles = JSON.parse(JSON.stringify(ang)); t[d][i] += s * step; const et = cost(t); if (et < e) { e = et; Object.assign(ang, t); imp = true; } }
    if (!imp) step *= 0.5;
  }
  return ang;
};

// Pointing straight at the lens: the right arm raised forward, the index finger toward the camera.
export const pointAtCamera = (target: V3): Pose => {
  let p: Pose = base(-8, { shoulderRaiseR: 86, shoulderSwingR: 86, elbowR: 8, pronationR: 55, wristDevR: -4, spineTwist: 12, neckTwist: 10, headTurn: 6, shoulderRaiseL: 10, elbowL: 18 }, { browFurrow: 0.35, smile: 0.3, lookX: 0.3 });
  p = reach(D, p, "R", sub(target, [0, 0, 0.001]), { elbowR: 8 });
  return { ...p, hands: { L: "relaxed", R: "point" } };
};

export const withProps = (s: Scene, cam: Camera, props: BlobPart[]): Scene => ({ ...s, parts: order([...s.parts, ...props.map((b) => toPart(cam, b))]) });

