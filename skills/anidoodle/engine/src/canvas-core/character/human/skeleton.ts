// THE 3D SKELETON. Bone lengths come from the canon row; joint angles come from the pose; a pose
// outside the range of motion FAILS AT LOAD, which catches broken elbows before anyone looks.
//
// Ranges of motion: American Academy of Orthopaedic Surgeons "Joint Motion: Method of Measuring
// and Recording" (1965) / Norkin & White "Measurement of Joint Motion" (normal adult values),
// rounded. Elbow 0-150, knee 0-140, hip flexion 125 (90 with the knee straight: hamstrings),
// hyperextension never past 5-10. Wrist, neck and shoulder are CONES, not independent boxes.
import { DEG, Frame, M3, V3, add, apply, cross, mm, mv, norm, rotAxis, rx, ry, rz, I3 } from "../math3";
import type { Pose } from "../types";
import type { CanonRow } from "./canon";

export type Side = "L" | "R";
export const SIDES: Side[] = ["L", "R"];
export const sgn = (s: Side) => (s === "L" ? 1 : -1); // her left is +x

// ---------------------------------------------------------------- joint limits
type Lim = [number, number];
export const LIMITS: Record<string, Lim> = {
  pelvisTilt: [-20, 30], pelvisSide: [-15, 15], pelvisTwist: [-40, 40],
  spineBend: [-30, 70], spineSide: [-35, 35], spineTwist: [-45, 45],
  neckBend: [-40, 45], neckSide: [-35, 35], neckTwist: [-60, 60],
  headNod: [-30, 30], headTilt: [-20, 20], headTurn: [-30, 30],
  clavLift: [-10, 30], clavFwd: [-15, 25],
  shoulderRaise: [0, 180], shoulderSwing: [-90, 140], shoulderTwist: [-90, 90],
  elbow: [0, 150], pronation: [-90, 90],
  wristFlex: [-70, 80], wristDev: [-25, 35],
  hipFlex: [-20, 125], hipAbd: [-25, 45], hipRot: [-40, 45],
  knee: [0, 140], ankle: [-45, 25], toe: [0, 60],
};
export const JOINT_NAMES = [
  "pelvisTilt", "pelvisSide", "pelvisTwist", "spineBend", "spineSide", "spineTwist", "neckBend", "neckSide", "neckTwist", "headNod", "headTilt", "headTurn",
  ...["clavLift", "clavFwd", "shoulderRaise", "shoulderSwing", "shoulderTwist", "elbow", "pronation", "wristFlex", "wristDev", "hipFlex", "hipAbd", "hipRot", "knee", "ankle", "toe"].flatMap((j) => [j + "L", j + "R"]),
];
const baseName = (j: string) => (/[LR]$/.test(j) && LIMITS[j.slice(0, -1)] ? j.slice(0, -1) : j);

// Every violation, in words a human can act on. Empty means the pose is legal.
export const limitViolations = (j: Record<string, number>): string[] => {
  const out: string[] = [];
  for (const [k, v] of Object.entries(j)) {
    const b = baseName(k), L = LIMITS[b];
    if (!L) { out.push(`unknown joint '${k}'`); continue; }
    if (!Number.isFinite(v)) out.push(`${k} is not a number`);
    else if (v < L[0] - 1e-6 || v > L[1] + 1e-6) out.push(`${k} = ${v.toFixed(1)} outside ${L[0]}..${L[1]}`);
  }
  const g = (k: string) => j[k] ?? 0;
  // cones: combined motion is limited more than each axis alone
  for (const s of ["L", "R"]) {
    const f = g("wristFlex" + s), d = g("wristDev" + s), lf = f >= 0 ? 80 : 70, ld = d >= 0 ? 35 : 25;
    if ((f / lf) ** 2 + (d / ld) ** 2 > 1.0001) out.push(`wrist${s} cone: flex ${f} with deviation ${d} exceeds the wrist ellipse`);
    const r = g("shoulderRaise" + s), w = g("shoulderSwing" + s);
    if (w < 0 && r * Math.sin(-w * DEG) > 62) out.push(`shoulder${s} cone: ${(r * Math.sin(-w * DEG)).toFixed(0)} deg of extension behind the body (max ~60)`);
    if (w > 90 && r * Math.sin((w - 90) * DEG) > 55) out.push(`shoulder${s} cone: ${(r * Math.sin((w - 90) * DEG)).toFixed(0)} deg of cross-body adduction (max ~50)`);
    if (g("knee" + s) < 20 && g("hipFlex" + s) > 95) out.push(`hip${s}: flexion ${g("hipFlex" + s)} with a straight knee (hamstrings stop a straight leg near 90)`);
  }
  const nb = g("neckBend") + g("headNod"), ns = g("neckSide") + g("headTilt"), nt = g("neckTwist") + g("headTurn");
  if ((nb / (nb >= 0 ? 60 : 55)) ** 2 + (ns / 45) ** 2 > 1.0001) out.push(`neck cone: bend ${nb} with side ${ns} exceeds the cervical ellipse`);
  if (Math.abs(nt) > 80) out.push(`neck: total head rotation ${nt} (max ~80)`);
  return out;
};

// ---------------------------------------------------------------- bone lengths
export type Dims = {
  hh: number; height: number;
  root: number; hipDrop: number; hipX: number; thigh: number; shin: number; ankleH: number; heel: number; toe: number; ball: number;
  lumbar: number; chest: number; neckBase: number; neckBaseZ: number; neck: number; pivotToChin: number;
  shoulderX: number; shoulderY: number; upperArm: number; forearm: number; hand: number;
};
export const dimsFromCanon = (c: CanonRow, heightM: number): Dims => {
  const hh = heightM / c.heads, k = (v: number) => v * hh;
  return {
    hh, height: heightM, root: k(c.root), hipDrop: k(c.root - c.hip), hipX: k(c.hipX), thigh: k(c.hip - c.knee), shin: k(c.knee - c.ankle), ankleH: k(c.ankle),
    heel: k(c.heel), toe: k(c.foot - c.heel), ball: k((c.foot - c.heel) * 0.72),
    lumbar: k(c.lumbar - c.root), chest: k(c.chest - c.lumbar), neckBase: k(c.neckBase - c.chest), neckBaseZ: -k(0.1), neck: k(c.pivot - c.neckBase), pivotToChin: k(c.pivot - (c.heads - 1)),
    shoulderX: k(c.shoulderX), shoulderY: k(c.shoulder - c.chest), upperArm: k(c.upperArm), forearm: k(c.forearm), hand: k(c.hand),
  };
};

// ---------------------------------------------------------------- forward kinematics
export type Rig = {
  dims: Dims; j: Record<string, number>;
  pelvis: Frame; lumbar: Frame; chest: Frame; neck: Frame; head: Frame;
  shoulder: Record<Side, Frame>; upper: Record<Side, Frame>; fore: Record<Side, Frame>; hand: Record<Side, Frame>;
  hip: Record<Side, Frame>; thigh: Record<Side, Frame>; shin: Record<Side, Frame>; foot: Record<Side, Frame>; toes: Record<Side, Frame>;
  joints: Record<string, V3>; // named joint centres, world
};
const child = (f: Frame, off: V3, R: M3 = I3): Frame => ({ p: apply(f, off), R: mm(f.R, R) });
// anatomical rotations in a parent frame whose x = her left, y = up, z = forward
const flexFwd = (a: number) => rx(a * DEG);           // +y (or +z) toward the front
const sideTo = (a: number) => rz(-a * DEG);          // +y toward her left (+x)
const twist = (a: number) => ry(a * DEG);            // face turns to her left

export const fk = (dims: Dims, pose: Pose): Rig => {
  const j = pose.joints, g = (k: string) => j[k] ?? 0, d = dims;
  const body = mm(ry(pose.yaw * DEG), mm(rx((pose.pitch ?? 0) * DEG), rz(-(pose.roll ?? 0) * DEG)));
  const pelvis: Frame = { p: pose.root, R: mm(body, mm(twist(g("pelvisTwist")), mm(flexFwd(g("pelvisTilt")), sideTo(g("pelvisSide"))))) };
  const spine = (k: number) => mm(twist(g("spineTwist") * k), mm(flexFwd(g("spineBend") * k), sideTo(g("spineSide") * k)));
  const lumbar = child(pelvis, [0, d.lumbar, -0.01 * d.hh], spine(0.5));
  const chest = child(lumbar, [0, d.chest, 0], spine(0.5));
  const neck = child(chest, [0, d.neckBase, d.neckBaseZ], mm(twist(g("neckTwist")), mm(flexFwd(g("neckBend") + 12), sideTo(g("neckSide"))))); // the neck leans forward ~12 deg at rest
  const head = child(neck, [0, d.neck, 0], mm(twist(g("headTurn")), mm(flexFwd(g("headNod") - 12), sideTo(g("headTilt")))));
  const rig = { dims, j, pelvis, lumbar, chest, neck, head, shoulder: {}, upper: {}, fore: {}, hand: {}, hip: {}, thigh: {}, shin: {}, foot: {}, toes: {}, joints: {} } as unknown as Rig;
  for (const s of SIDES) {
    const k = sgn(s), G = (n: string) => g(n + s);
    // shoulder girdle: the clavicle lifts and protracts the joint
    const sh = child(chest, [k * d.shoulderX, d.shoulderY + Math.sin(G("clavLift") * DEG) * d.shoulderX * 0.55, -0.02 * d.hh + Math.sin(G("clavFwd") * DEG) * d.shoulderX * 0.5]);
    // raise the arm from hanging, toward a direction `swing` (0 = out to the side, 90 = forward)
    const out: V3 = [k, 0, 0], fwd: V3 = [0, 0, 1], down: V3 = [0, -1, 0], w = G("shoulderSwing") * DEG;
    const h = norm(add(out.map((v) => v * Math.cos(w)) as V3, fwd.map((v) => v * Math.sin(w)) as V3));
    const Rr = rotAxis(cross(down, h), G("shoulderRaise") * DEG), dir = mv(Rr, down);
    const Rup = mm(rotAxis(dir, -k * G("shoulderTwist") * DEG), Rr);
    const upper: Frame = { p: sh.p, R: mm(chest.R, Rup) };
    const fore = child(upper, [0, -d.upperArm, 0], rx(-G("elbow") * DEG));
    const wrist = child(fore, [0, -d.forearm, 0], mm(ry(-k * G("pronation") * DEG), mm(rz(-k * G("wristFlex") * DEG), rx(-G("wristDev") * DEG))));
    rig.shoulder[s] = sh; rig.upper[s] = upper; rig.fore[s] = fore; rig.hand[s] = wrist;
    const hip = child(pelvis, [k * d.hipX, -d.hipDrop, 0]);
    const thigh: Frame = { p: hip.p, R: mm(pelvis.R, mm(rx(-G("hipFlex") * DEG), mm(rz(k * G("hipAbd") * DEG), ry(k * G("hipRot") * DEG)))) };
    const shin = child(thigh, [0, -d.thigh, 0], rx(G("knee") * DEG));
    const foot = child(shin, [0, -d.shin, 0], rx(-G("ankle") * DEG));
    const toes = child(foot, [0, -d.ankleH * 0.85, d.ball], rx(-G("toe") * DEG));
    rig.hip[s] = hip; rig.thigh[s] = thigh; rig.shin[s] = shin; rig.foot[s] = foot; rig.toes[s] = toes;
    Object.assign(rig.joints, { ["shoulder" + s]: sh.p, ["elbow" + s]: fore.p, ["wrist" + s]: wrist.p, ["hip" + s]: hip.p, ["knee" + s]: shin.p, ["ankle" + s]: foot.p, ["ball" + s]: toes.p, ["heel" + s]: apply(foot, [0, -d.ankleH * 0.9, -d.heel]), ["toeTip" + s]: apply(toes, [0, 0, d.toe - d.ball]) });
  }
  Object.assign(rig.joints, { pelvis: pelvis.p, lumbar: lumbar.p, chest: chest.p, neck: neck.p, head: head.p, crown: apply(head, [0, d.hh - d.pivotToChin, 0]) });
  return rig;
};

// Drop (or lift) the root so the lowest point of either foot rests on the floor.
export const lowestFoot = (r: Rig) => Math.min(...SIDES.flatMap((s) => [apply(r.foot[s], [0, -r.dims.ankleH, -r.dims.heel * 0.9])[1], apply(r.toes[s], [0, -r.dims.ankleH * 0.15, r.dims.toe - r.dims.ball])[1], apply(r.foot[s], [0, -r.dims.ankleH, 0])[1]]));

// bone lengths measured back OUT of the posed rig: the gate compares them with the rest pose
export const boneLengths = (r: Rig): Record<string, number> => {
  const J = r.joints, D = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]), o: Record<string, number> = {};
  for (const s of SIDES) { o["upperArm" + s] = D(J["shoulder" + s], J["elbow" + s]); o["forearm" + s] = D(J["elbow" + s], J["wrist" + s]); o["thigh" + s] = D(J["hip" + s], J["knee" + s]); o["shin" + s] = D(J["knee" + s], J["ankle" + s]); o["hipWidth" + s] = D(J.pelvis, J["hip" + s]); }
  o.neck = D(J.neck, J.head); o.lumbarSeg = D(J.pelvis, J.lumbar); o.thoracicSeg = D(J.lumbar, J.chest); // the spine is two segments: its end-to-end span changes when it bends, each segment does not
  return o;
};
