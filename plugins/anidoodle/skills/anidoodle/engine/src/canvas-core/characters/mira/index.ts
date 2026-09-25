// MIRA, v1.0.0. The ONE source of truth for her: canon, rig, drawn views, palette roles,
// distinguishing features, toScene(pose). Every still, sheet and film imports this module and
// poses her; nothing anywhere else is allowed to draw her.
//
// Who: a nine-year-old inventor. Round red glasses; a short dark-auburn bob with a straight
// fringe and one cowlick that will not lie down; freckles across the nose; a yellow raincoat
// (hood down, three wooden toggles, two flap pockets); a tan leather satchel on her left hip,
// strap over her right shoulder, brass buckle, a spanner handle poking out; navy tights; teal
// wellies.
//
// Canon: CANON.storybookChild, 5.2 heads, 1.30 m (a declared storybook enlargement of a real
// 6.2-head nine-year-old). Hands, joints and limb ratios below the neck are the real child's.
//
// Parts that are volumes (body, coat, sleeves, boots, bag) turn in 3D. Parts that are drawings
// (the fringe, the cowlick) are 2.5D: authored in three views and blended (character/view25d).
import type { P } from "../../core";
import { Blob, Camera, DEG, Frame, I3, V3, add, apply, dot, mm, mv, norm, project, ry, rz, sub } from "../../character/math3";
import type { BlobPart } from "../../character/build";
import { ccw, hull, insidePoly } from "../../character/shape2d";
import { Views, checkViews, place25d, viewOf } from "../../character/view25d";
import type { Character, Mark, Part, Pose, Scene } from "../../character/types";
import { CANON } from "../../character/human/canon";
import { CHILD_BODY, blob } from "../../character/human/mannequin";
import { CHILD_HEAD, type HeadCtx } from "../../character/human/head";
import { type FigureSpec, assemble, build, checkPose } from "../../character/human/figure";
import { cutChain } from "../../character/human/clothing";
import { drawnMira } from "./drawn";
import { type Rig, type Side, SIDES, sgn } from "../../character/human/skeleton";

export const MIRA_VERSION = "1.0.0";
export const MIRA_SPEC: FigureSpec = {
  canon: CANON.storybookChild, height: 1.3, body: CHILD_BODY,
  head: { ...CHILD_HEAD, freckles: [[-0.07, 0.36], [-0.1, 0.33], [-0.05, 0.325], [-0.12, 0.365], [0.07, 0.36], [0.1, 0.33], [0.05, 0.325], [0.12, 0.365], [0.0, 0.385]] },
  roles: { skin: "skin", torso: "coat", hips: "coat", upperArm: "coat", thigh: "tights", shin: "tights", foot: "boots" },
};

// ---------------------------------------------------------------- palette ROLES (each hand maps them)
export const MIRA_ROLES = {
  skin: { family: "warm light skin", hue: [14, 36] as [number, number], note: "peach, never pink-grey" },
  hair: { family: "dark auburn", hue: [8, 30] as [number, number], note: "warm dark brown with red in it" },
  coat: { family: "yellow", hue: [40, 58] as [number, number], note: "THE identity colour: a raincoat yellow in every hand" },
  tights: { family: "navy", hue: [210, 240] as [number, number], note: "dark cool blue" },
  boots: { family: "teal", hue: [165, 195] as [number, number], note: "blue-green wellies" },
  satchel: { family: "tan leather", hue: [18, 34] as [number, number], note: "warm mid brown" },
  glasses: { family: "red", hue: [350, 12] as [number, number], note: "round red frames" },
  toggle: { family: "wood", hue: [18, 36] as [number, number], note: "" },
  buckle: { family: "brass", hue: [38, 52] as [number, number], note: "" },
};

// ---------------------------------------------------------------- distinguishing features
export const MIRA_FEATURES = [
  { id: "glasses", parts: ["glasses"], note: "round red frames, big for her face", visible: (y: number) => Math.abs(y) < 150 },
  { id: "fringe", parts: ["hairFront"], note: "straight fringe, bob to the jaw", visible: (y: number) => Math.abs(y) < 105 },
  { id: "cowlick", parts: ["tuft"], note: "one tuft at the crown that sticks up", visible: () => true },
  { id: "freckles", parts: ["head"], note: "nine freckles across the nose", visible: (y: number) => Math.abs(y) < 75 },
  { id: "raincoat", parts: ["coat", "sleeveL", "sleeveR"], note: "yellow, hood down, three toggles", visible: () => true },
  { id: "satchel", parts: ["satchel"], note: "tan, left hip, strap over the right shoulder", visible: () => true },
  { id: "wellies", parts: ["bootL", "bootR"], note: "teal, to mid-calf", visible: () => true },
];

// ---------------------------------------------------------------- the 2.5D fringe: three authored views
// Units: head heights, origin at the cranium centre, x right, y DOWN. Every view has 24 points in
// the same order: near hem outer, up the near side, over the top, down the far side, the far hem,
// the far lock's inner edge, the fringe from far to near, the near lock's inner edge.
const FRINGE: Views = {
  yaw: [0, 45, 90],
  shapes: [
    [[-0.49, 0.48], [-0.52, 0.2], [-0.5, -0.1], [-0.4, -0.34], [-0.2, -0.49], [0.02, -0.52], [0.24, -0.48], [0.42, -0.33], [0.5, -0.08], [0.52, 0.2], [0.49, 0.48], [0.38, 0.5], [0.355, 0.22], [0.335, 0.0],
      [0.3, -0.115], [0.2, -0.095], [0.1, -0.135], [0.0, -0.105], [-0.1, -0.14], [-0.2, -0.1], [-0.3, -0.13], [-0.335, 0.0], [-0.355, 0.22], [-0.38, 0.5]],
    [[-0.5, 0.48], [-0.55, 0.2], [-0.54, -0.1], [-0.44, -0.36], [-0.22, -0.5], [0.05, -0.53], [0.28, -0.47], [0.44, -0.32], [0.51, -0.12], [0.52, 0.1], [0.49, 0.38], [0.44, 0.4], [0.44, 0.18], [0.45, -0.02],
      [0.42, -0.1], [0.33, -0.085], [0.24, -0.12], [0.14, -0.09], [0.04, -0.125], [-0.06, -0.09], [-0.15, -0.11], [-0.17, 0.05], [-0.15, 0.26], [-0.12, 0.5]],
    [[-0.47, 0.5], [-0.56, 0.2], [-0.56, -0.12], [-0.44, -0.38], [-0.2, -0.52], [0.08, -0.53], [0.3, -0.45], [0.44, -0.3], [0.52, -0.12], [0.535, -0.04], [0.5, 0.0], [0.45, -0.01], [0.37, -0.06], [0.3, -0.08],
      [0.23, -0.05], [0.19, 0.05], [0.17, 0.15], [0.16, 0.25], [0.15, 0.35], [0.13, 0.44], [0.1, 0.5], [0.0, 0.52], [-0.2, 0.53], [-0.36, 0.52]],
  ],
};
// the cowlick: one tuft at the crown, drawn once and turned with the head
// two thin strands that spring up and curl over toward her left, like hair, not a horn
const TUFT: Views = { yaw: [0, 90], shapes: [
  [[-0.03, 0.03], [-0.035, -0.06], [-0.01, -0.14], [0.05, -0.18], [0.1, -0.165], [0.06, -0.15], [0.025, -0.11], [0.02, -0.07], [0.055, -0.1], [0.075, -0.085], [0.03, -0.04], [0.02, 0.03]],
  [[-0.05, 0.03], [-0.06, -0.06], [-0.04, -0.14], [0.01, -0.19], [0.07, -0.18], [0.03, -0.16], [0.0, -0.12], [-0.005, -0.07], [0.03, -0.1], [0.05, -0.085], [0.01, -0.04], [0.01, 0.03]],
] };
checkViews("fringe", FRINGE); checkViews("tuft", TUFT);

const CRANIUM: V3 = [0, 0.6, -0.04];

// the bob as a 3D shell round the cranium: its hull IS the hair's silhouette from any side
const bobShell = (h: HeadCtx): P[] => {
  const pts: P[] = [], C = CRANIUM;
  for (let i = 0; i <= 10; i++) for (let j = 0; j < 20; j++) {
    const v = i / 10, yl = C[1] + 0.52 - v * 1.0, th = (j / 20) * Math.PI * 2, front = Math.cos(th) > 0.55 && yl < 0.66; // leave the face open
    if (front) continue;
    const flare = 1 + 0.12 * v * v, lat = Math.sqrt(Math.max(0, 1 - ((yl - C[1]) / 0.56) ** 2)) * 0.5 * flare + (v > 0.55 ? 0.03 * v : 0);
    const r = Math.max(lat, v > 0.5 ? 0.46 * flare : 0);
    const q = h.M([C[0] + Math.sin(th) * r, yl, C[2] + Math.cos(th) * r * 1.02]), pq = project(h.cam, q); pts.push([pq.x, pq.y]);
  }
  return ccw(hull(pts));
};

// ---------------------------------------------------------------- glasses: real 3D rims, occluded by the head
const glassesParts = (h: HeadCtx, head: Part, tuftAt: number, hair: P[]): Part[] => {
  const S = h.spec, marks: Mark[] = [], hd = project(h.cam, h.M([0, 0.5, 0])).z, px = project(h.cam, h.M([0, 0.44, 0])).s * h.hh;
  const hidden = (w: V3) => { const q = project(h.cam, w); return q.z > hd - 0.02 * h.hh && (head.polys.some((pl) => insidePoly(pl, q.x, q.y)) || insidePoly(hair, q.x, q.y)); }; // behind the head or the bob
  const temples: Mark[] = [];
  const run = (pts: V3[], w: number, role = "glasses", into = marks) => { let cur: P[] = []; const flush = () => { if (cur.length > 1) into.push({ kind: "line", pts: cur, role, w }); cur = []; }; pts.forEach((p) => { if (hidden(p)) flush(); else { const q = project(h.cam, p); cur.push([q.x, q.y]); } }); flush(); };
  const R = 0.088, zf = 0.47, w = Math.max(1.1, px * 0.022);
  [-1, 1].forEach((s) => {
    const cx = s * S.eyeX, cy = S.eyeY + 0.005;
    const ring: V3[] = Array.from({ length: 29 }, (_, i) => { const a = (i / 28) * Math.PI * 2, x = cx + Math.cos(a) * R; return h.M([x, cy + Math.sin(a) * R, zf - Math.abs(x) * 0.28]); });
    // lens glint: a pale crescent on the side toward the light, only when the lens faces us
    const n = mv(h.f.R, [0, 0, 1]), f = dot(n, norm(sub(h.cam.eye, h.M([cx, cy, zf]))));
    if (f > 0.3) { const g: V3[] = Array.from({ length: 7 }, (_, i) => { const a = Math.PI * (1.05 + i * 0.07); return h.M([cx + Math.cos(a) * R * 0.72, cy - Math.sin(a) * R * 0.72, zf - Math.abs(cx) * 0.28 + 0.005]); }); run(g, w * 0.9, "white"); }
    run(ring, w * 1.25);
    // the temple arm, back over the ear
    run(Array.from({ length: 8 }, (_, i) => { const t = i / 7; return h.M([s * (S.eyeX + R + t * (0.44 - S.eyeX - R)), cy + 0.01 + t * 0.02, zf - 0.08 - t * (zf - 0.02)]); }), w, "glasses", temples);
  });
  // the bridge, arching over the nose
  run(Array.from({ length: 7 }, (_, i) => { const a = Math.PI * (i / 6); return h.M([-Math.cos(a) * (S.eyeX - R), S.eyeY + 0.03 + Math.sin(a) * 0.025, zf + 0.005]); }), w * 1.1);
  // the temple arms go back UNDER the hair; the rims sit over the fringe
  return [{ id: "glasses", role: "glasses", depth: tuftAt - 0.001, polys: [], size: px * 0.1, marks, outline: false, fill: false, over: ["head", "hairFront", "earL", "earR", "temples"], feature: "glasses" },
    { id: "temples", role: "glasses", depth: tuftAt + 0.02 * h.hh, polys: [], size: px * 0.1, marks: temples, outline: false, fill: false, over: ["head", "earL", "earR"] }];
};

// ---------------------------------------------------------------- satchel and strap
const bagFrame = (r: Rig, swing: number): Frame => {
  // hangs from the strap at her left hip, broad face turned out and forward, swinging on the strap
  const P0 = r.pelvis, hh = r.dims.hh, hang = apply(P0, [0.52 * hh, 0.2 * hh, 0.16 * hh]);
  const R = mm(P0.R, mm(ry(-42 * DEG), rz(swing * DEG * 0.35)));
  return { p: add(hang, mv(R, [0, -0.32 * hh, 0])), R };
};
const satchel = (r: Rig, cam: Camera, swing: number): { part: BlobPart; spanner: BlobPart } => {
  const hh = r.dims.hh, F = bagFrame(r, swing), c = 0.055 * hh, W = 0.3 * hh, H = 0.22 * hh, T = 0.075 * hh;
  const corners: Blob[] = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) corners.push({ c: apply(F, [x * (T - c * 0.3), y * (H - c), z * (W - c)]), R: F.R, r: [c, c, c] });
  const marks: Mark[] = [], face = mv(F.R, [1, 0, 0]), faceOn = dot(face, norm(sub(cam.eye, F.p)));
  const P = (l: V3): P => { const q = project(cam, apply(F, l)); return [q.x, q.y]; };
  if (faceOn > 0.05) {
    // the flap: over the top two thirds of the front, curved at the bottom, and its brass buckle
    const flap: P[] = [P([T + 0.004 * hh, H * 0.98, -W * 0.96]), P([T + 0.004 * hh, H * 0.98, W * 0.96]), P([T + 0.004 * hh, -H * 0.1, W * 0.94]), P([T + 0.004 * hh, -H * 0.28, W * 0.6]), P([T + 0.004 * hh, -H * 0.36, 0]), P([T + 0.004 * hh, -H * 0.28, -W * 0.6]), P([T + 0.004 * hh, -H * 0.1, -W * 0.94])];
    marks.push({ kind: "fill", pts: flap, role: "satchelDark", alpha: 0.9, line: 1.2 });
    const b = (y: number, z: number): P => P([T + 0.01 * hh, y, z]);
    marks.push({ kind: "fill", pts: [b(-H * 0.2, -0.05 * hh), b(-H * 0.2, 0.05 * hh), b(-H * 0.48, 0.05 * hh), b(-H * 0.48, -0.05 * hh)], role: "buckle", line: 1.1 });
    marks.push({ kind: "line", pts: [b(-H * 0.5, 0), b(-H * 0.75, 0)], role: "satchelDark", w: 2 });
  }
  // a spanner handle out of the top, the inventor's tell
  const sp0 = apply(F, [0, H * 0.9, W * 0.55]), sp1 = apply(F, [0.01 * hh, H + 0.2 * hh, W * 0.75]);
  const spanner: BlobPart = { id: "spanner", role: "metal", groups: [{ blobs: [{ c: sp0, R: I3, r: [0.022 * hh, 0.022 * hh, 0.022 * hh] }, { c: sp1, R: I3, r: [0.024 * hh, 0.024 * hh, 0.024 * hh] }], mode: "chain" }, { blobs: [{ c: add(sp1, mv(F.R, [0, 0.03 * hh, 0.02 * hh])), R: F.R, r: [0.02 * hh, 0.045 * hh, 0.05 * hh] }], mode: "each" }], depthBias: 0.02 * hh };
  return { part: { id: "satchel", role: "satchel", groups: [{ blobs: corners, mode: "hull" }], marks, over: ["coat", "hips", "spanner"], feature: "satchel", depthBias: -0.05 * hh }, spanner };
};

// surface marks on the coat: a line of torso-local points, kept where the coat faces the camera
const coatSurf = (r: Rig, cam: Camera, pts: [keyof Rig & ("chest" | "lumbar" | "pelvis"), V3][], lift: number) => {
  const hh = r.dims.hh, out: { p: P; vis: boolean }[] = [];
  pts.forEach(([fn, l]) => {
    const f = r[fn] as Frame, rad = Math.hypot(l[0], l[2]) || 1, local: V3 = [l[0] * hh * (1 + lift / rad), l[1] * hh, l[2] * hh * (1 + lift / rad)];
    const w = apply(f, local), n = norm(mv(f.R, [l[0], 0, l[2]])), vis = dot(n, norm(sub(cam.eye, w))) > 0.08, q = project(cam, w);
    out.push({ p: [q.x, q.y], vis });
  });
  return out;
};
const runsOf = (s: { p: P; vis: boolean }[]): P[][] => { const o: P[][] = []; let c: P[] = []; s.forEach((q) => { if (q.vis) c.push(q.p); else { if (c.length > 1) o.push(c); c = []; } }); if (c.length > 1) o.push(c); return o; };

const coatMarks = (r: Rig, cam: Camera, px: number): Mark[] => {
  const m: Mark[] = [], w = Math.max(1, px * 0.02);
  // the front opening, chin to hem, and the three toggles across it
  const placket = coatSurf(r, cam, [["chest", [0.035, 0.74, 0.3]], ["chest", [0.04, 0.5, 0.36]], ["chest", [0.04, 0.25, 0.37]], ["lumbar", [0.04, 0.16, 0.38]], ["pelvis", [0.04, 0.02, 0.37]], ["pelvis", [0.045, -0.2, 0.38]], ["pelvis", [0.05, -0.42, 0.39]]], 0.05);
  runsOf(placket).forEach((p) => m.push({ kind: "line", pts: p, role: "line", w: w * 1.1, alpha: 0.85 }));
  [["chest", 0.55, 0.36], ["chest", 0.2, 0.38], ["lumbar", 0.1, 0.39]].forEach(([fn, y, z]) => {
    const s = coatSurf(r, cam, [[fn as "chest", [-0.03, y as number, z as number]], [fn as "chest", [0.09, y as number, (z as number) - 0.005]]], 0.07);
    if (s[0].vis && s[1].vis) m.push({ kind: "line", pts: [s[0].p, s[1].p], role: "toggle", w: w * 3.2 });
  });
  // flap pockets on the hips
  SIDES.forEach((sd) => { const k = sgn(sd); const s = coatSurf(r, cam, [["pelvis", [k * 0.12, -0.12, 0.36]], ["pelvis", [k * 0.24, -0.13, 0.31]], ["pelvis", [k * 0.33, -0.11, 0.22]]], 0.06); runsOf(s).forEach((p) => m.push({ kind: "line", pts: p, role: "line", w: w * 0.9, alpha: 0.75 })); });
  // the satchel strap: over the right shoulder, across the chest to the left hip, and round the back
  const front = coatSurf(r, cam, [["chest", [-0.42, 0.78, 0.08]], ["chest", [-0.3, 0.62, 0.3]], ["chest", [-0.1, 0.44, 0.37]], ["chest", [0.12, 0.26, 0.37]], ["lumbar", [0.28, 0.14, 0.33]], ["pelvis", [0.4, 0.06, 0.24]]], 0.07);
  const back = coatSurf(r, cam, [["chest", [-0.42, 0.78, -0.02]], ["chest", [-0.28, 0.62, -0.27]], ["chest", [-0.05, 0.44, -0.33]], ["chest", [0.16, 0.26, -0.33]], ["lumbar", [0.32, 0.14, -0.26]], ["pelvis", [0.44, 0.06, -0.14]]], 0.07);
  [...runsOf(front), ...runsOf(back)].forEach((p) => m.push({ kind: "line", pts: p, role: "satchel", w: w * 3.6 }));
  return m;
};

// ---------------------------------------------------------------- boots
const boot = (r: Rig, s: Side): BlobPart => {
  const hh = r.dims.hh, sh = CHILD_BODY.shin.map((b) => blob(r, b, s, 0.035));
  const shaft = cutChain(sh.slice().reverse(), 0.55).reverse(); // the boot shaft: the lower 55% of the shin, from the ankle up
  const rim = shaft[0]; shaft[0] = { ...rim, r: [rim.r[0] + 0.025 * hh, 0.025 * hh, rim.r[2] + 0.025 * hh] };
  const ft = CHILD_BODY.foot.map((b) => blob(r, b, s, 0.03)), toe = CHILD_BODY.toes.map((b) => blob(r, b, s, 0.035));
  return { id: "boot" + s, role: "boots", groups: [{ blobs: shaft, mode: "chain" }, { blobs: [ft[0], ft[1]], mode: "chain" }, { blobs: [ft[1], ft[2], ...toe], mode: "chain" }], over: ["shin" + s, "foot" + s], feature: "wellies", depthBias: -0.025 * hh };
};

const FACE = { line: "line", pupil: "pupil", white: "white", blush: "blush", brow: "hair", mouth: "mouth", lip: "lip" };

export const miraScene = (p: Pose, cam: Camera): Scene => {
  const b = build(MIRA_SPEC, p, cam), r = b.rig, hh = r.dims.hh, h = b.head, aux = p.aux ?? {};
  // The body under the clothes is the invisible pose source: what is SEEN of her coat, sleeves,
  // legs and wellies is DRAWN (drawn.ts): designed masses swept along her gesture curves.
  const hidden = new Set(["torso", "hips", "upperArmL", "upperArmR", "foreArmL", "foreArmR", "thighL", "thighR", "shinL", "shinR", "footL", "footR"]);
  b.parts = b.parts.filter((q) => !hidden.has(q.id));
  // a stand-up collar round the neck: a ring of blobs, closed
  const ring: Blob[] = Array.from({ length: 11 }, (_, i) => { const a = (i / 10) * Math.PI * 2; return blob(r, ["chest", [Math.sin(a) * 0.19, 0.86 + Math.cos(a) * 0.015, -0.03 + Math.cos(a) * 0.15], [0.055, 0.065, 0.055]], "L"); });
  b.parts.push({ id: "collar", role: "coat", groups: [{ blobs: ring, mode: "chain" }], over: ["neck", "coat"], depthAt: apply(r.chest, [0, 0.8 * hh, 0.1 * hh]) });
  // the hood, lying down between the shoulder blades
  b.parts.push({ id: "hood", role: "coat", groups: [{ blobs: [blob(r, ["chest", [0, 0.74, -0.3], [0.3, 0.14, 0.13]], "L"), blob(r, ["chest", [0, 0.56, -0.36], [0.24, 0.14, 0.1]], "L")], mode: "chain" }], depthBias: 0.02 * hh });
  const bag = satchel(r, cam, aux.bagSwing ?? 0);
  b.parts.push(bag.part, bag.spanner);
  const px = project(cam, r.joints.chest).s * hh;
  return assemble(cam, b, p, FACE, { character: "mira", version: MIRA_VERSION }, (parts) => {
    const drawn = drawnMira(r, cam), head = parts.find((q) => q.id === "head")!, coat = drawn.find((q) => q.id === "coat")!, vw = viewOf(cam, h.f);
    coat.marks.push(...coatMarks(r, cam, px));
    const face = Math.abs(vw.yaw) < 105, hd = head.depth, out: Part[] = [];
    out.push({ id: "hairBack", role: "hair", depth: face ? hd + 0.35 * hh : hd - 0.06 * hh, polys: [bobShell(h)], size: head.size * 1.1, marks: [], over: face ? [] : ["head", "earL", "earR", "neck"], feature: "fringe" });
    if (face) { const fr = place25d(cam, h.f, [0, CRANIUM[1] - MIRA_SPEC.head.pivot[1], CRANIUM[2] - MIRA_SPEC.head.pivot[2]].map((v) => v * hh) as V3, hh, FRINGE, { pitchShift: 0.12 }); out.push({ id: "hairFront", role: "hair", depth: hd - 0.02 * hh, polys: [ccw(fr.pts)], size: head.size, marks: [], over: ["head", "earL", "earR", "temples"], feature: "fringe" }); }
    const tf = place25d(cam, h.f, [0, (1.02 - MIRA_SPEC.head.pivot[1]) * hh, (-0.12 - MIRA_SPEC.head.pivot[2]) * hh], hh, TUFT);
    out.push({ id: "tuft", role: "hair", depth: hd - 0.03 * hh, polys: [ccw(tf.pts)], size: head.size * 0.4, marks: [], over: ["hairBack", "hairFront", "head"], feature: "cowlick" });
    out.push(...glassesParts(h, head, hd - 0.04 * hh, out[0].polys[0]));
    out.push(...drawn);
    return out;
  });
};

export const mira: Character = {
  id: "mira", name: "Mira", version: MIRA_VERSION, canonId: "storybookChild",
  description: "Nine-year-old inventor, 5.2 heads (storybook), 1.30 m: round red glasses, dark auburn bob with fringe and cowlick, freckles, yellow raincoat, tan satchel, navy tights, teal wellies.",
  roles: MIRA_ROLES, features: MIRA_FEATURES,
  pose: (p: Pose) => { checkPose(p, "mira"); return p; },
  toScene: (p: Pose, cam: Camera) => miraScene(p, cam),
};
