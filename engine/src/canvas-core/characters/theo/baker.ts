// THEO, THE BAKER. The adult proof of the drawing layer: a specific man, not a figure model.
// Mid-forties, 1.78 m, the realistic 7.5-head canon (the rig and every gate are Theo's), built
// solid: sloping shoulders, a softening middle, a baker's forearms. Short dark hair going grey at
// the temples, a close beard and moustache, a white shirt with the sleeves rolled to mid-forearm,
// a canvas apron from the chest to below the knee, dark work trousers, brown boots. He holds a
// round loaf out toward us, weight on his left leg, head tipped, pleased with it.
//
// Everything SEEN is designed here: cross-section tables swept along gesture curves through his
// joints (character/design.ts). The skeleton only says where the curves go.
import type { P } from "../../core";
import { Blob, Camera, I3, V3, add, apply, mix3, mul, mv, norm, project, sub } from "../../character/math3";
import { type Section, type Station, jointed, station, stationU, sweep } from "../../character/design";
import { type BlobPart, toPart } from "../../character/build";
import type { Character, Mark, Part, Pose, Scene } from "../../character/types";
import { type Rig, SIDES, sgn } from "../../character/human/skeleton";
import { assemble, build, checkPose, rigFor } from "../../character/human/figure";
import { hairCap } from "../../character/human/head";
import { viewOf } from "../../character/view25d";
import { contrapposto, reach, stand } from "../../character/human/balance";
import { THEO_SPEC } from "./index";
import { THEO_DIMS } from "./poses";

// ---- the designed masses (head units: lateral, medial, front, back)
const SHIRT: Section[] = [[0, 0.62, 0.62, 0.43, 0.46], [0.24, 0.6, 0.6, 0.47, 0.39], [0.5, 0.63, 0.63, 0.45, 0.4], [0.76, 0.68, 0.68, 0.39, 0.36], [0.86, 0.64, 0.64, 0.33, 0.31], [0.93, 0.46, 0.46, 0.27, 0.27], [1, 0.24, 0.24, 0.22, 0.22]];   // the top falls away: sloping shoulders, never a shelf
const SLEEVE: Section[] = [[0, 0.12, 0.1, 0.14, 0.14], [0.12, 0.2, 0.17, 0.2, 0.19], [0.3, 0.21, 0.18, 0.21, 0.2], [0.58, 0.175, 0.165, 0.18, 0.18], [0.84, 0.17, 0.165, 0.17, 0.17], [0.9, 0.21, 0.21, 0.21, 0.21], [1, 0.21, 0.21, 0.21, 0.21]];   // the roll bulges at the end
const FOREARM: Section[] = [[0, 0.165, 0.155, 0.16, 0.165], [0.2, 0.195, 0.16, 0.165, 0.16], [0.55, 0.145, 0.13, 0.125, 0.125], [1, 0.1, 0.09, 0.075, 0.075]];   // swell high on the thumb side, flat at the wrist
const TROUSER: Section[] = [[0, 0.35, 0.31, 0.34, 0.38], [0.3, 0.31, 0.27, 0.31, 0.31], [0.5, 0.23, 0.21, 0.23, 0.21], [0.66, 0.23, 0.21, 0.21, 0.24], [0.94, 0.19, 0.19, 0.19, 0.19], [1, 0.2, 0.2, 0.2, 0.2]];
const BOOT: Section[] = [[0, 0.14, 0.14, 0.14, 0.14], [0.45, 0.175, 0.175, 0.12, 0.12], [0.85, 0.17, 0.17, 0.1, 0.1], [1, 0.13, 0.13, 0.07, 0.07]];
const SHAFT: Section[] = [[0, 0.16, 0.16, 0.16, 0.16], [1, 0.155, 0.155, 0.155, 0.155]];
const APRON: Section[] = [[0, 0.27, 0.27, 0.02, 0.02], [0.18, 0.3, 0.3, 0.02, 0.02], [0.3, 0.5, 0.5, 0.02, 0.02], [0.7, 0.52, 0.52, 0.02, 0.02], [1, 0.54, 0.54, 0.02, 0.02]];   // a plate: wide, thin

const P2 = (cam: Camera, v: V3): P => { const q = project(cam, v); return [q.x, q.y]; };
const mk = (id: string, role: string, polys: P[][], cam: Camera, at: V3, bias: number, o: Partial<Part> = {}): Part => { const q = project(cam, at); return { id, role, depth: q.z + bias, polys, size: q.s * 0.14, marks: [], ...o }; };
const faces = (cam: Camera, at: V3, n: V3) => { const v = norm(sub(cam.eye, at)); return n[0] * v[0] + n[1] * v[1] + n[2] * v[2]; };

export const drawnBaker = (r: Rig, cam: Camera): Part[] => {
  const hh = r.dims.hh, out: Part[] = [], C = r.chest;
  const shirtSt: Station[] = [station(r.pelvis, [0, -0.02 * hh, 0]), station(r.lumbar), station(C, [0, 0.45 * hh, 0]), station(C, [0, 1.0 * hh, 0]), station(C, [0, 1.24 * hh, -0.05 * hh])];
  out.push(mk("shirt", "shirt", sweep(cam, shirtSt, SHIRT, { hh, side: 1, n: 12, caps: [false, false] }), cam, r.joints.chest, 0, { over: ["legL", "legR"] }));
  for (const s of SIDES) {
    const k = sgn(s) as 1 | -1;
    const sl: Station[] = [station(r.upper[s], [-k * 0.03 * hh, -0.02 * hh, 0]), station(r.fore[s]), station(r.fore[s], [0, -0.42 * r.dims.forearm, 0])];
    out.push(mk("sleeve" + s, "shirt", jointed(cam, sl, SLEEVE, { hh, side: k, n: 10, cuts: [stationU(sl, 1)] }), cam, r.joints["elbow" + s], -0.06 * hh, { seams: [{ at: P2(cam, r.joints["shoulder" + s]), r: 0.3 * hh * project(cam, r.joints["shoulder" + s]).s, with: "shirt" }] }));
    const fa: Station[] = [station(r.fore[s], [0, -0.05 * hh, 0]), station(r.hand[s], [0, 0.02 * hh, 0])];
    out.push(mk("forearm" + s, "skin", sweep(cam, fa, FOREARM, { hh, side: k, n: 10, caps: [false, true] }), cam, apply(r.fore[s], [0, -0.6 * r.dims.forearm, 0]), -0.055 * hh, { over: [] }));
    const lg: Station[] = [station(r.thigh[s]), station(r.shin[s]), station(r.foot[s], [0, 0.04 * hh, 0])];
    out.push(mk("leg" + s, "trousers", jointed(cam, lg, TROUSER, { hh, side: k, n: 10, cuts: [stationU(lg, 1)] }), cam, r.joints["knee" + s], -0.02 * hh));
    const sh: Station[] = [station(r.shin[s], [0, -0.82 * r.dims.shin, 0]), station(r.foot[s], [0, -0.05 * hh, 0])];
    const ft: Station[] = [station(r.foot[s], [0, -0.22 * hh, -0.18 * hh]), station(r.foot[s], [0, -0.22 * hh, 0.25 * hh]), station(r.toes[s], [0, -0.03 * hh, 0.14 * hh])];
    out.push(mk("boot" + s, "boots", [...sweep(cam, sh, SHAFT, { hh, side: k, n: 6, caps: [false, false] }), ...sweep(cam, ft, BOOT, { hh, side: k, n: 8 })], cam, apply(r.foot[s], [0, 0, 0.1 * hh]), -0.03 * hh, { over: ["leg" + s] }));
  }
  // the apron: hung from the chest, tied at the waist, falling past the knees; it lies ON his front
  const knees = mix3(r.joints.kneeL, r.joints.kneeR, 0.5), fwd = norm(mv(r.pelvis.R, [0, 0, 1]));
  const apSt: Station[] = [station(C, [0, 0.95 * hh, 0.42 * hh]), station(C, [0, 0.5 * hh, 0.5 * hh]), station(r.lumbar, [0, 0.1 * hh, 0.52 * hh]), station(r.pelvis, [0, -0.3 * hh, 0.46 * hh]), { at: add(add(knees, mul(fwd, 0.28 * hh)), [0, 0.1 * hh, 0]), frame: r.pelvis }];
  // it covers the shirt only from the front: seen from behind it is under him, not painted over his back
  const front = faces(cam, apply(r.lumbar, [0, 0, 0.6 * hh]), fwd) > 0;
  const apron = mk("apron", "apron", sweep(cam, apSt, APRON, { hh, side: 1, n: 10, caps: [false, false] }), cam, apply(r.lumbar, [0, 0, 0.6 * hh]), front ? -0.2 * hh : 0.4 * hh, { over: front ? ["shirt", "legL", "legR"] : [] });
  // the apron's hem stitching, the waist ties, the neck strap, a pocket
  const px = project(cam, r.joints.lumbar).s * hh, w = Math.max(0.8, px * 0.012);
  const onApron = (loc: [V3, V3][]) => loc.map(([f0, l]) => P2(cam, add(f0, l)));
  const waistL = apply(r.lumbar, [0.5 * hh, 0.1 * hh, 0.3 * hh]), waistR = apply(r.lumbar, [-0.5 * hh, 0.1 * hh, 0.3 * hh]), bow = apply(r.lumbar, [-0.62 * hh, 0.02 * hh, 0.1 * hh]);
  if (faces(cam, apply(r.lumbar, [0, 0, 0.6 * hh]), fwd) > 0.05) {
    apron.marks.push({ kind: "line", pts: onApron([[waistL, [0, 0, 0]], [waistR, [0, 0, 0]]]), role: "apronDark", w: w * 2.2, alpha: 0.9 });
    apron.marks.push({ kind: "line", pts: [P2(cam, waistR), P2(cam, bow), P2(cam, add(bow, [0, -0.35 * hh, 0.05 * hh]))], role: "apronDark", w: w * 1.8, alpha: 0.85 });
    const pk = [[-0.22, -0.02], [0.22, -0.02], [0.22, -0.34], [-0.22, -0.34]].map(([x, y]) => P2(cam, apply(r.pelvis, [x * hh, y * hh, 0.5 * hh])));
    apron.marks.push({ kind: "line", pts: [...pk, pk[0]], role: "apronDark", w, alpha: 0.7 });
    // canvas hangs from the tie in long soft folds that open toward the hem
    const hemMid = add(add(knees, mul(fwd, 0.29 * hh)), [0, 0.1 * hh, 0]), side = norm(mv(r.pelvis.R, [1, 0, 0]));
    [-0.34, -0.12, 0.16, 0.38].forEach((x, i) => { const top = apply(r.pelvis, [x * 0.55 * hh, -0.2 * hh, 0.5 * hh]), bot = add(hemMid, mul(side, x * hh * (1 + 0.1 * i))); apron.marks.push({ kind: "line", pts: [0, 0.35, 0.7, 0.95].map((t) => P2(cam, add(mix3(top, bot, t), mul(side, Math.sin(t * Math.PI) * 0.02 * hh * (i % 2 ? 1 : -1))))), role: "apronDark", w: w * 0.9, alpha: 0.45 }); });
  }
  out.push(apron);
  return out;
};

// his head: the beard and moustache as volumes on the jaw, the hair short and greying at the sides
const beardParts = (r: Rig, cam: Camera, headM: (q: V3) => V3, headR: import("../../character/math3").M3): Part[] => {
  const hh = r.dims.hh, B = (c: V3, rr: V3): Blob => ({ c: headM(c), R: headR, r: mul(rr, hh) });
  // a CLOSE beard: it follows the jaw and chin, stops under the mouth, thins up the cheek to the sideburn
  const beard: BlobPart = { id: "beard", role: "beard", groups: [{ blobs: [B([0.265, 0.17, 0.03], [0.08, 0.1, 0.1]), B([-0.265, 0.17, 0.03], [0.08, 0.1, 0.1]), B([0.06, 0.035, 0.3], [0.08, 0.065, 0.09]), B([-0.06, 0.035, 0.3], [0.08, 0.065, 0.09]), B([0, 0.105, 0.31], [0.13, 0.055, 0.09]), B([0.21, 0.25, 0.15], [0.055, 0.075, 0.08]), B([-0.21, 0.25, 0.15], [0.055, 0.075, 0.08])], mode: "hull" }], over: ["head"], depthAt: headM([0, 0.25, 0.1]) };
  const stache: BlobPart = { id: "moustache", role: "beard", groups: [{ blobs: [B([-0.075, 0.245, 0.43], [0.05, 0.022, 0.03]), B([0, 0.262, 0.46], [0.045, 0.02, 0.03]), B([0.075, 0.245, 0.43], [0.05, 0.022, 0.03])], mode: "chain" }], over: ["head", "beard", "nose"], depthAt: headM([0, 0.26, 0.5]) };
  return [toPart(cam, beard), toPart(cam, stache)];
};

const FACE = { line: "line", pupil: "pupil", white: "white", blush: "blush", brow: "hair", mouth: "mouth", lip: "lip" };
export const bakerScene = (p: Pose, cam: Camera): Scene => {
  const b = build(THEO_SPEC, p, cam), r = b.rig, hh = r.dims.hh, h = b.head;
  const hidden = new Set(["torso", "hips", "upperArmL", "upperArmR", "foreArmL", "foreArmR", "thighL", "thighR", "shinL", "shinR", "footL", "footR"]);
  b.parts = b.parts.filter((q) => !hidden.has(q.id));
  const sc = assemble(cam, b, p, FACE, { character: "theo-baker", version: "2.0.0" }, (parts) => {
    const head = parts.find((q) => q.id === "head")!, out: Part[] = [...drawnBaker(r, cam), ...beardParts(r, cam, h.M, h.f.R)];
    // turned away, the beard is behind the head: it must not paint over the back of it
    if (Math.abs(viewOf(cam, h.f).yaw) > 100) out.filter((q) => q.id === "beard" || q.id === "moustache").forEach((q) => { q.over = []; q.depth = head.depth + 0.2 * hh; });
    // the mouth line and lips sit between the moustache and the beard: move them onto the moustache so they paint last
    const lipMarks = head.marks.filter((m) => m.kind !== "dot" && m.tag === "mouth");
    head.marks = head.marks.filter((m) => !lipMarks.includes(m)); out.find((q) => q.id === "moustache")!.marks.push(...lipMarks);
    const hair = hairCap(h, "hair", { front: 0.84, side: 0.58, back: 0.28, lift: 0.035, sideburn: 0.2 });
    // grey at the temples: short strokes where the sides turn toward us
    [-1, 1].forEach((s) => { const pts: P[] = [0, 1, 2, 3].map((i) => P2(cam, h.M([s * 0.37, 0.55 + i * 0.05, 0.12 - i * 0.02]))); const n = mv(h.f.R, [s, 0, 0.2]); if (faces(cam, h.M([s * 0.37, 0.6, 0.1]), n) > 0.15) hair.marks.push({ kind: "line", pts, role: "grey", w: Math.max(1, head.size * 0.03), alpha: 0.9 }); });
    out.push(hair);
    return out;
  });
  // the gesture the drawing was built on: spine, weight leg, arms
  const G = (pts: V3[]) => pts.map((v) => P2(cam, v));
  sc.gesture = [G([r.joints.crown, r.joints.head, r.joints.neck, r.joints.chest, r.joints.lumbar, r.joints.pelvis, r.joints.hipL, r.joints.kneeL, r.joints.ankleL]), G([r.joints.shoulderL, r.joints.elbowL, r.joints.wristL]), G([r.joints.shoulderR, r.joints.elbowR, r.joints.wristR]), G([r.joints.hipR, r.joints.kneeR, r.joints.ankleR])];
  return sc;
};

// ---- the pose: presenting a round loaf, weight on the left leg, head tipped toward it
export const LOAF_R = 0.1;
export const bakerPose = (yaw: number): { pose: Pose; loaf: V3 } => {
  const D = THEO_DIMS, AH = D.ankleH, T = (v: V3): V3 => mv([Math.cos((yaw * Math.PI) / 180), 0, Math.sin((yaw * Math.PI) / 180), 0, 1, 0, -Math.sin((yaw * Math.PI) / 180), 0, Math.cos((yaw * Math.PI) / 180)], v);
  // a gentle contrapposto, the spine bending back exactly as far as the pelvis tips, so the shoulders sit over the feet
  const cp = contrapposto("L", 0.55); cp.spineSide = -(cp.pelvisSide ?? 0) * 1.1;
  let p: Pose = { root: [0, D.root, 0], yaw, joints: { ...cp, spineBend: -3, neckBend: 6, headNod: 6, headTilt: 8, neckTwist: -6 }, expression: { smile: 0.7, cheek: 0.5, lidLower: 0.25, browRaise: 0.25, lookY: -0.2 }, hands: { L: "grip", R: "grip" }, plant: false };
  const feet = { L: T([0.06, AH, 0]), R: T([-0.09, AH, 0.15]) }, over = T([0.06, 0, 0.06]);   // the free foot a short step forward, not out: the legs stay near plumb
  p = stand(D, p, feet, [over[0], over[2]], { R: 3 });
  const loaf = add(T([0.0, 0, 0.42]), [p.root[0], 1.12, p.root[2]]);
  for (let k = 0; k < 2; k++) {
    p = reach(D, { ...p, joints: { ...p.joints, shoulderSwingL: p.joints.shoulderSwingL ?? 75, shoulderRaiseL: p.joints.shoulderRaiseL ?? 30, elbowL: p.joints.elbowL ?? 90 } }, "L", add(loaf, T([0.12, -0.05, -0.03])));
    p = reach(D, { ...p, joints: { ...p.joints, shoulderSwingR: p.joints.shoulderSwingR ?? 75, shoulderRaiseR: p.joints.shoulderRaiseR ?? 30, elbowR: p.joints.elbowR ?? 90 } }, "R", add(loaf, T([-0.12, -0.05, -0.03])));
    p = stand(D, p, feet, [over[0], over[2]], { R: 3 }, 6);
  }
  return { pose: p, loaf };
};
// the loaf: a round boule, crust scored in a cross, flour dusted on top
export const loafPart = (cam: Camera, at: V3): Part => {
  const b: BlobPart = { id: "loaf", role: "crust", groups: [{ blobs: [{ c: at, R: I3, r: [LOAF_R * 1.12, LOAF_R * 0.72, LOAF_R * 1.05] }], mode: "each" }], depthAt: add(at, [0, 0, -0.02]) };
  const part = toPart(cam, b), marks: Mark[] = [], s = project(cam, at).s;
  [[-1, 1], [1, 1]].forEach(([a, c]) => marks.push({ kind: "line", pts: [-0.7, -0.35, 0, 0.35, 0.7].map((t) => P2(cam, add(at, [t * LOAF_R * a * 0.8, LOAF_R * 0.66 * Math.sqrt(1 - t * t * 0.6), t * LOAF_R * c * 0.8 + 0.01]))), role: "crustDark", w: Math.max(1.2, s * 0.012), alpha: 0.9 }));
  for (let i = 0; i < 26; i++) { const a = i * 2.39996, rr = Math.sqrt(i / 26) * LOAF_R * 0.7; marks.push({ kind: "dot", at: P2(cam, add(at, [Math.cos(a) * rr, LOAF_R * 0.7, Math.sin(a) * rr])), rx: 1.2, ry: 1.2, rot: 0, role: "flour", alpha: 0.9 }); }
  part.marks = marks; return part;
};

export const theoBaker: Character = {
  id: "theo-baker", name: "Theo the baker", version: "2.0.0", canonId: "adult",
  description: "Baker in his forties, 7.5 heads, 1.78 m: close beard, short hair greying at the temples, white shirt with rolled sleeves, canvas apron, dark trousers, brown boots.",
  roles: {
    skin: { family: "warm skin", hue: [10, 40], note: "" }, shirt: { family: "white", hue: [0, 360], note: "" }, apron: { family: "canvas ochre", hue: [30, 55], note: "" },
    trousers: { family: "warm dark grey", hue: [0, 60], note: "" }, boots: { family: "brown", hue: [15, 35], note: "" }, hair: { family: "dark brown", hue: [0, 40], note: "" },
  },
  features: [{ id: "beard", parts: ["beard", "moustache"], note: "close beard and moustache", visible: (y) => Math.abs(y) < 150 }, { id: "apron", parts: ["apron"], note: "canvas apron", visible: (y) => Math.abs(y) < 100 }],
  pose: (p: Pose) => { checkPose(p, "theo-baker"); return p; },
  toScene: (p: Pose, cam: Camera) => bakerScene(p, cam),
};
export { rigFor };
