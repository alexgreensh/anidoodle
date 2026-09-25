// MIRA'S POSES. Built from placed feet, solved legs, balance and reach targets, never from a
// pile of guessed angles where contact matters. Every pose here passes the joint-limit check at
// load (a pose outside the range of motion throws) and every standing pose is balance-checked by
// tools/character-check.mjs.
import { Blob, DEG, I3, V3, add, apply, mix3, mul, mv, norm, sub } from "../../character/math3";
import type { BlobPart } from "../../character/build";
import type { Pose } from "../../character/types";
import { dimsFromCanon } from "../../character/human/skeleton";
import { contrapposto, reach, stand } from "../../character/human/balance";
import { rigFor } from "../../character/human/figure";
import { planWalk, walkAt } from "../../character/human/walk";
import { MIRA_SPEC } from "./index";
import { handModel, resolveHand } from "../../character/human/hands";

export const MIRA_DIMS = dimsFromCanon(MIRA_SPEC.canon, MIRA_SPEC.height);
const D = MIRA_DIMS, hh = D.hh, AH = D.ankleH;
const ry = (yaw: number) => (v: V3): V3 => mv([Math.cos(yaw * DEG), 0, Math.sin(yaw * DEG), 0, 1, 0, -Math.sin(yaw * DEG), 0, Math.cos(yaw * DEG)], v);
export const base = (yaw = 0, j: Record<string, number> = {}, ex: Record<string, number> = {}): Pose => ({ root: [0, D.root, 0], yaw, joints: { shoulderRaiseL: 12, shoulderRaiseR: 12, shoulderSwingL: 22, shoulderSwingR: 22, elbowL: 16, elbowR: 16, ...j }, expression: ex, hands: { L: "relaxed", R: "relaxed" }, plant: true });

export const relaxed = (yaw: number, ex: Record<string, number> = {}): Pose => base(yaw, {}, ex);

// weight on her left leg, right hand holding the satchel strap across her chest
export const strapStand = (yaw: number): Pose => {
  const T = ry(yaw); let p = base(yaw, { ...contrapposto("L", 0.8), headTilt: 6 }, { smile: 0.5, cheek: 0.3, lookX: -0.2 });
  const feet = { L: T([0.04, AH, 0]), R: T([-0.11, AH, 0.08]) }, over = T([0.04, 0, 0.035]);
  p = stand(D, p, feet, [over[0], over[2]], { R: 3 });
  const r = rigFor(MIRA_SPEC, { ...p, plant: false }), strap = apply(r.chest, [-0.2 * hh, 0.5 * hh, 0.44 * hh]);
  p = reach(D, { ...p, joints: { ...p.joints, shoulderRaiseR: 30, shoulderSwingR: 80, elbowR: 110 } }, "R", strap);
  return { ...p, hands: { L: "relaxed", R: "fist" } };
};

// on her toes, right arm up to a high shelf, looking up
export const reachUp = (yaw: number): Pose => {
  const T = ry(yaw); let p = base(yaw, { spineSide: 7, spineBend: -5, neckBend: -12, headNod: -14, toeL: 18, toeR: 18, clavLiftR: 20, shoulderRaiseL: 16, elbowL: 30 }, { browRaise: 0.5, lookY: 0.9, mouthOpen: 0.2, mouthWide: -0.5 });
  p = { ...p, root: [p.root[0], p.root[1] + 0.04, p.root[2]] };
  const feet = { L: T([0.08, AH + 0.03, 0.0]), R: T([-0.08, AH + 0.03, -0.02]) }, fw = T([0, 0, 0.08]);
  p = stand(D, p, feet, [fw[0], fw[2]], { L: -18, R: -18 }, 14);
  // the raised arm moves the centre of mass, so settle the balance again with the arm up, then re-aim the hand
  for (let k = 0; k < 2; k++) { p = reach(D, { ...p, joints: { ...p.joints, shoulderRaiseR: p.joints.shoulderRaiseR ?? 160, shoulderSwingR: p.joints.shoulderSwingR ?? 60, elbowR: p.joints.elbowR ?? 12 } }, "R", T([-0.12, 1.5, 0.14])); p = stand(D, p, feet, [fw[0], fw[2]], { L: -18, R: -18 }, 10); }
  return { ...p, hands: { L: "relaxed", R: "open" } };
};

// sitting on an upturned crate, elbows on her knees, chin propped
export const CRATE_H = 0.3;
export const sitCrate = (yaw: number): Pose => {
  const T = ry(yaw); let p: Pose = { ...base(yaw, { pelvisTilt: -6, spineBend: 26, neckBend: -6, headNod: -16 }, { smile: 0.3, lookY: 0.2, lookX: 0.3 }), root: T([0, CRATE_H + 0.085, -0.03]), plant: false };
  p = stand(D, p, { L: T([0.1, AH, 0.3]), R: T([-0.09, AH, 0.32]) }, null, {}, 1);
  const r = rigFor(MIRA_SPEC, p);
  p = reach(D, p, "R", add(r.joints.kneeR, T([0.02, 0.06, -0.02])));
  p = reach(D, p, "L", add(r.joints.kneeL, T([-0.03, 0.05, 0.0])));
  return { ...p, hands: { L: "relaxed", R: "relaxed" } };
};
export const crate = (yaw: number): BlobPart[] => {
  const T = ry(yaw), c: Blob[] = [];
  for (const x of [-1, 1]) for (const y of [0, 1]) for (const z of [-1, 1]) c.push({ c: T([x * 0.19, 0.02 + y * (CRATE_H - 0.04), -0.03 + z * 0.14]), R: I3, r: [0.02, 0.02, 0.02] });
  return [{ id: "crate", role: "crate", groups: [{ blobs: c, mode: "hull" }], depthBias: 0.05 }];
};

// crouched on her heels, tinkering: screwdriver in the right hand, a gear in the left
export const crouch = (yaw: number): Pose => {
  const T = ry(yaw); let p: Pose = { ...base(yaw, { spineBend: 20, neckBend: -2, headNod: -8, toeL: 36, toeR: 34 }, { browFurrow: 0.6, lidUpper: 0.2, smile: 0.1, mouthWide: -0.3, lookY: -0.8 }), root: T([0, 0.36, -0.02]), plant: false };
  const ov = T([0, 0, 0.13]); // a child crouches on the balls of her feet (the ankle cannot fold further), weight over them
  p = stand(D, p, { L: T([0.11, AH + 0.05, 0.12]), R: T([-0.1, AH + 0.05, 0.08]) }, [ov[0], ov[2]], { L: -36, R: -34 }, 10);
  const r = rigFor(MIRA_SPEC, p), work = add(mix3(r.joints.kneeL, r.joints.kneeR, 0.5), T([0, 0.03, 0.22]));
  p = reach(D, p, "R", add(work, T([-0.05, 0.02, 0])));
  p = reach(D, p, "L", add(work, T([0.07, 0.0, 0.0])));
  return { ...p, hands: { L: "pinch", R: "grip" } };
};

// the wave: arm up and out, the forearm rocking, head tipped, a big smile
export const wave = (yaw: number, t = 0, ex: Record<string, number> = { smile: 1, cheek: 0.8, lidLower: 0.3, browRaise: 0.4 }): Pose => {
  const rock = Math.sin(t);
  const p = base(yaw, { shoulderRaiseR: 128, shoulderSwingR: 20, shoulderTwistR: 30, elbowR: 58 + 14 * rock, pronationR: 25, wristDevR: -8 * rock, headTilt: -8, neckSide: -4, spineSide: -4, clavLiftR: 12 }, ex);
  return { ...p, hands: { L: "relaxed", R: "wave" } };
};

// a walking frame (the contact position) from the same walk the film uses
export const walkContact = (yaw: number): Pose => {
  const plan = planWalk({ t0: 0, s0: 0, step: 0.4, cycle: 30, n: 8, first: "L", lateral: 0.065 });
  const dir: V3 = [Math.sin(yaw * DEG), 0, Math.cos(yaw * DEG)];
  const f = walkAt(D, plan, 60, base(yaw, {}, { smile: 0.3 }), { origin: mul(dir, -plan.rootS(60)), dir }).pose;
  return f;
};

// standing on the crate, reaching up with the screwdriver: the comic panel
export const reachOnCrate = (yaw: number, target: V3): Pose => {
  const T = ry(yaw), fl = CRATE_H; let p = base(yaw, { spineSide: 6, spineBend: -4, neckBend: -14, headNod: -16, toeL: 10, toeR: 10, clavLiftR: 18, shoulderRaiseL: 62, shoulderSwingL: -5, elbowL: 28, wristFlexL: -20 }, { browFurrow: 0.8, lidUpper: 0.15, mouthOpen: 0.25, mouthWide: -0.2, lookY: 0.9, smile: 0.15 });
  p = { ...p, root: [p.root[0], p.root[1] + fl + 0.03, p.root[2]] };
  const feet = { L: T([0.09, fl + AH + 0.015, 0.0]), R: T([-0.08, fl + AH + 0.015, -0.03]) }, fw = T([0, 0, 0.06]);
  for (let k = 0; k < 2; k++) { p = reach(D, { ...p, joints: { ...p.joints, shoulderRaiseR: p.joints.shoulderRaiseR ?? 150, shoulderSwingR: p.joints.shoulderSwingR ?? 60, elbowR: p.joints.elbowR ?? 30 } }, "R", target); p = stand(D, p, feet, [fw[0], fw[2]], { L: -10, R: -10 }, 10, fl); }
  return { ...p, hands: { L: { open: 0.6, relaxed: 0.4 }, R: "grip" } };
};
// sitting on the crate, holding a gear up to her eye: the riso poster
export const gearToEye = (yaw: number): Pose => {
  let p = sitCrate(yaw); p = { ...p, expression: { browRaise: 0.7, smile: 0.35, lookX: 0.55, lookY: 0.1, mouthWide: -0.2 }, joints: { ...p.joints, neckTwist: 18, headTilt: 8, headNod: -6, spineBend: 14 } };
  // at arm's length, out to her right and a little below her eyes, so the hand never covers the face
  const r = rigFor(MIRA_SPEC, p), eye = apply(r.head, [-0.55 * hh, 0.3 * hh, 1.05 * hh]);
  p = reach(D, { ...p, joints: { ...p.joints, shoulderRaiseR: 70, shoulderSwingR: 80, elbowR: 120 } }, "R", eye);
  return { ...p, hands: { L: "relaxed", R: "pinch" } };
};
export const gearAt = (c: V3, n: V3, R = 0.03, id = "gear"): BlobPart => {
  const u = norm(Math.abs(n[1]) < 0.9 ? [n[2], 0, -n[0]] as V3 : [1, 0, 0] as V3), v: V3 = [n[1] * u[2] - n[2] * u[1], n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
  const teeth: Blob[] = Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return { c: add(c, add(mul(u, Math.cos(a) * R), mul(v, Math.sin(a) * R))), R: I3, r: [R * 0.2, R * 0.2, R * 0.2] }; });
  const disc: Blob = { c, R: [u[0], n[0], v[0], u[1], n[1], v[1], u[2], n[2], v[2]], r: [R * 0.92, R * 0.14, R * 0.92] };
  return { id, role: "buckle", groups: [{ blobs: [disc], mode: "each" }, { blobs: teeth, mode: "each" }], depthAt: c };
};
export const gearInPinch = (p: Pose, side: "L" | "R" = "R"): BlobPart => {
  // held edge-on between the thumb pad and the index pad: its rim sits where they meet
  const r = rigFor(MIRA_SPEC, p), hm = handModel(r.hand[side], side, D.hand, resolveHand("pinch")), th = hm.digits.find((d) => d.digit === "thumb")!.pts[3], ix = hm.digits.find((d) => d.digit === "index")!.pts[3];
  const grip = mix3(th, ix, 0.5), out = norm(sub(grip, r.joints["wrist" + side])), n = norm(sub(ix, th));
  return gearAt(add(grip, mul(out, 0.03)), n, 0.03);
};

// props
export const screwdriver = (p: Pose): BlobPart[] => {
  const r = rigFor(MIRA_SPEC, p), h = r.hand.R, Lh = D.hand, grip = apply(h, [0.075 * Lh + 0.013, -0.46 * Lh, 0]), ax = norm(mv(h.R, [0, 0, 1]));
  const a = add(grip, mul(ax, 0.05)), b = add(grip, mul(ax, -0.045)), tip = add(grip, mul(ax, -0.13));
  return [{ id: "driverHandle", role: "toolRed", groups: [{ blobs: [{ c: a, R: I3, r: [0.014, 0.014, 0.014] }, { c: b, R: I3, r: [0.016, 0.016, 0.016] }], mode: "chain" }], depthAt: grip },
    { id: "driverShaft", role: "metal", groups: [{ blobs: [{ c: b, R: I3, r: [0.004, 0.004, 0.004] }, { c: tip, R: I3, r: [0.003, 0.003, 0.003] }], mode: "chain" }], depthAt: mix3(b, tip, 0.5) }];
};
export const gear = (p: Pose): BlobPart[] => {
  const r = rigFor(MIRA_SPEC, p), hm = r.hand.L, c = apply(hm, [-0.02, -0.55 * D.hand, 0.1 * D.hand]), n = norm(mv(hm.R, [1, 0, 0]));
  const teeth: Blob[] = Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * Math.PI * 2, u = norm(sub(mv(hm.R, [0, Math.cos(a), Math.sin(a)]), mul(n, 0))); return { c: add(c, mul(u, 0.026)), R: I3, r: [0.006, 0.006, 0.006] }; });
  return [{ id: "gear", role: "buckle", groups: [{ blobs: [{ c, R: hm.R, r: [0.004, 0.024, 0.024] }], mode: "each" }, { blobs: teeth, mode: "each" }], depthAt: c }];
};
