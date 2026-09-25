// THEO'S CLOTHES AND SURFACE ANATOMY. Garments hang from the body with gravity and meet it at
// seams; the skin shows its landmarks where a figure-drawing teacher would point at them.
//
// Reference opened: Hogarth "Dynamic Wrinkles and Drapery" (1992): the sleeve hangs from the
// shoulder seam, pipes into a tube and breaks into a diagonal fold at the armpit; the tucked
// shirt blouses over the waistband in soft U-folds. Bammes "The Complete Guide to Anatomy for
// Artists": the sternocleidomastoid V into the pit of the neck, the S of the clavicle, the
// kneecap sitting ON the joint with the tendon running down to the shin's tuberosity.
import type { P } from "../../core";
import { Blob, Camera, Frame, M3, V3, add, apply, cross, dot, mul, mv, norm, project, sub } from "../../character/math3";
import type { BlobPart } from "../../character/build";
import type { Mark, Part } from "../../character/types";
import { type Rig, type Side, SIDES, sgn } from "../../character/human/skeleton";
import { type BodySpec, blob } from "../../character/human/mannequin";
import { cutChain } from "../../character/human/clothing";

// A line ON a body surface: points in a frame (head units), each seen or not by the outward normal
// (away from an axis through `axis`, horizontal in that frame). Returns the visible runs, screen px.
export const surfaceRuns = (r: Rig, cam: Camera, f: Frame, pts: V3[], o: { axis?: V3; min?: number; normal?: V3 } = {}): P[][] => {
  const hh = r.dims.hh, ax = o.axis ?? [0, 0, 0], out: P[][] = []; let cur: P[] = [];
  pts.forEach((l) => {
    const w = apply(f, mul(l, hh)), nl: V3 = o.normal ?? [l[0] - ax[0], 0, l[2] - ax[2]], n = norm(mv(f.R, nl)), vis = dot(n, norm(sub(cam.eye, w))) > (o.min ?? 0.08);
    if (vis) { const q = project(cam, w); cur.push([q.x, q.y]); } else { if (cur.length > 1) out.push(cur); cur = []; }
  });
  if (cur.length > 1) out.push(cur);
  return out;
};
const lines = (runs: P[][], role: string, w: number, alpha = 0.8): Mark[] => runs.map((pts) => ({ kind: "line", pts, role, w, alpha }));
const frameFrom = (y: V3, hintZ: V3): M3 => { const Y = norm(y), X = norm(cross(Y, hintZ)), Z = cross(X, Y); return [X[0], Y[0], Z[0], X[1], Y[1], Z[1], X[2], Y[2], Z[2]]; };

// ---- the sleeve: a soft tube hung from the shoulder seam (never above the shoulder line),
// narrowing to its hem; when the arm lifts, the hem ring tips toward the floor and the underside sags
export const softSleeve = (r: Rig, spec: BodySpec, s: Side, o: { role: string; len: number; ease: number }): BlobPart => {
  const hh = r.dims.hh, k = sgn(s), U = r.upper[s], down: V3 = [0, -1, 0], bone = norm(mv(U.R, [0, -1, 0])), level = 1 - Math.abs(dot(bone, down));
  const seam: Blob = { c: apply(U, [-k * 0.07 * hh, -0.02 * hh, 0]), R: U.R, r: [0.15 * hh, 0.06 * hh, 0.2 * hh] }; // the seam sits ON the shoulder, never proud of it
  const arm = spec.upperArm.map((b) => blob(r, b, s, o.ease)), mid = cutChain(arm, 0.5).pop()!;
  const hemAt = add(apply(U, [0, -o.len * r.dims.upperArm, 0.01 * hh]), mul(down, 0.035 * hh * level));   // the underside sags as the arm lifts
  const hemR = frameFrom(add(bone, mul(down, 0.6 * level)), mv(U.R, [0, 0, 1]));
  const hem: Blob = { c: hemAt, R: hemR, r: [(0.2 + o.ease * 0.6) * hh, 0.02 * hh, (0.21 + o.ease * 0.6) * hh] };
  const marksFn = (cam: Camera): Mark[] => {
    const px = project(cam, U.p).s * hh, w = Math.max(0.8, px * 0.012);
    // the armpit fold: a diagonal from the pit onto the sleeve's front, and a shorter echo
    const f1 = surfaceRuns(r, cam, U, [[-k * 0.1, -0.1, 0.22], [-k * 0.04, -0.22, 0.25], [k * 0.04, -0.34, 0.25]], { min: 0.15 });
    const f2 = surfaceRuns(r, cam, U, [[-k * 0.13, -0.3, 0.18], [-k * 0.07, -0.42, 0.22]], { min: 0.15 });
    // the hem's stitching, just above the edge
    const ring = Array.from({ length: 19 }, (_, i) => { const a = (i / 18) * Math.PI * 2; return add(hemAt, mv(hemR, [Math.cos(a) * hem.r[0] * 0.98, 0.045 * hh, Math.sin(a) * hem.r[2] * 0.98])); });
    const vis = ring.map((q) => ({ q, v: dot(norm(sub(q, hemAt)), norm(sub(cam.eye, q))) > 0.05 }));
    const runs: P[][] = []; let cur: P[] = []; vis.forEach(({ q, v }) => { if (v) { const p = project(cam, q); cur.push([p.x, p.y]); } else { if (cur.length > 1) runs.push(cur); cur = []; } }); if (cur.length > 1) runs.push(cur);
    return [...lines(f1, "line", w, 0.55), ...lines(f2, "line", w * 0.8, 0.4), ...lines(runs, "line", w * 0.7, 0.35)];
  };
  return { id: "sleeve" + s, role: o.role, groups: [{ blobs: [seam, mid, hem], mode: "chain" }], over: ["upperArm" + s], seams: [{ at: apply(U, [-k * 0.05 * hh, 0.02 * hh, 0]), r: 0.3 * hh, with: "torso" }], depthBias: -0.065 * hh, marksFn };
};

// ---- the shorts: a waistband at the navel, the seat, a fly, pockets; the shirt tucks in under the band
export const shorts = (r: Rig, spec: BodySpec, o: { role: string; ease: number }): BlobPart => {
  const hh = r.dims.hh, band: Blob = blob(r, ["lumbar", [0, -0.05, 0.03], [0.5, 0.06, 0.36]], "L", o.ease);
  const seat = blob(r, spec.hips[1], "L", o.ease), sided = SIDES.flatMap((s) => spec.hipsSided.map((b) => blob(r, b, s, o.ease)));
  const marksFn = (cam: Camera): Mark[] => {
    const px = project(cam, r.joints.pelvis).s * hh, w = Math.max(0.8, px * 0.012), e = o.ease;
    const ring = (y: number, rx: number, rz: number) => Array.from({ length: 25 }, (_, i) => { const a = (i / 24) * Math.PI * 2; return [Math.sin(a) * (rx + e), y, 0.03 + Math.cos(a) * (rz + e)] as V3; });
    const L = r.lumbar, Pl = r.pelvis;
    const m: Mark[] = [...lines(surfaceRuns(r, cam, L, ring(-0.105, 0.5, 0.36), { axis: [0, 0, 0.03] }), "line", w * 1.1, 0.7)];
    // the fly: straight down from the band, hooking toward the crotch
    m.push(...lines(surfaceRuns(r, cam, Pl, [[0.03, -0.02, 0.41 + e], [0.035, -0.14, 0.41 + e], [0.03, -0.25, 0.38 + e], [-0.02, -0.31, 0.33 + e]], { min: 0.2 }), "line", w, 0.75));
    // slanted front pockets and belt loops
    SIDES.forEach((s) => { const k = sgn(s); m.push(...lines(surfaceRuns(r, cam, Pl, [[k * 0.22, -0.02, 0.37 + e], [k * 0.36, -0.14, 0.3 + e], [k * 0.44, -0.22, 0.2 + e]], { min: 0.15 }), "line", w * 0.9, 0.6)); [0.3, 0.52].forEach((x) => m.push(...lines(surfaceRuns(r, cam, L, [[k * x, -0.01, Math.sqrt(Math.max(0, 1 - (x / 0.55) ** 2)) * 0.4 + 0.03 + e], [k * x, -0.1, Math.sqrt(Math.max(0, 1 - (x / 0.55) ** 2)) * 0.4 + 0.03 + e]], { min: 0.15, axis: [0, 0, 0.03] }), "line", w * 1.2, 0.6))); });
    return m;
  };
  return { id: "shorts", role: o.role, groups: [{ blobs: [band, seat], mode: "chain" }, { blobs: sided, mode: "each" }], over: ["hips", "torso"], depthAt: r.joints.pelvis, marksFn };
};

// ---- the shirt, tucked: it blouses over the band in soft folds, and a scoop neck shows the
// pit of the neck, the heads of the collarbones and the V of the neck muscles
export const blouse = (r: Rig, o: { role: string; ease: number }): { ring: Blob; marksFn: (cam: Camera) => Mark[] } => {
  const hh = r.dims.hh, ring = blob(r, ["lumbar", [0, 0.06, 0.035], [0.53, 0.07, 0.38]], "L", o.ease);
  const marksFn = (cam: Camera): Mark[] => {
    const px = project(cam, r.joints.lumbar).s * hh, w = Math.max(0.8, px * 0.011), e = o.ease, L = r.lumbar;
    const m: Mark[] = [];
    // U-folds where the fabric bags over the band
    [-0.3, -0.08, 0.16, 0.34].forEach((x, i) => { const z = (xx: number) => Math.sqrt(Math.max(0, 1 - (xx / 0.56) ** 2)) * 0.41 + 0.035 + e; m.push(...lines(surfaceRuns(r, cam, L, [[x - 0.05, 0.1 + (i % 2) * 0.02, z(x - 0.05)], [x, 0.03, z(x)], [x + 0.06, 0.09, z(x + 0.06)]], { min: 0.2, axis: [0, 0, 0.035] }), "line", w, 0.5)); });
    return m;
  };
  return { ring, marksFn };
};
export const neckline = (r: Rig, cam: Camera, o: { skin: string; spec: BodySpec; ease: number }): Part | null => {
  // the FRONT surface of the shirt at (x, y) in the chest frame: the largest z over every chest-frame volume
  const vols = [...o.spec.torso.filter((b) => b[0] === "chest"), ...o.spec.torsoSided.flatMap((b) => (b[0] === "chest" ? [b, ["chest", [-b[1][0], b[1][1], b[1][2]], b[2]] as typeof b] : []))];
  const front = (x: number, y: number) => vols.reduce((z, [, c, rr]) => { const u = (x - c[0]) / (rr[0] + o.ease), v = (y - c[1]) / (rr[1] + o.ease * 0.6), q = 1 - u * u - v * v; return q > 0 ? Math.max(z, c[2] + (rr[2] + o.ease) * Math.sqrt(q)) : z; }, -1);
  const hh = r.dims.hh, C = r.chest;
  // the scoop: from the back of the neck round the trapezius and down in front to a little below the pit
  // the front half of the scoop only: its back half runs behind the neck and is never seen from the front
  const loop: V3[] = Array.from({ length: 17 }, (_, i) => { const a = (-Math.PI / 2 + (i / 16) * Math.PI) * 0.8, fr = Math.max(0, Math.cos(a)), x = Math.sin(a) * 0.25, y = 1.21 - 0.13 * fr ** 2.2; return [x, y, Math.max(front(x, y), 0.02 + Math.cos(a) * 0.2) + 0.004] as V3; });
  // closed along the base of the neck (its front half), not a straight chord: the scoop's upper edge IS the neck
  const neckArc: V3[] = Array.from({ length: 9 }, (_, i) => { const a = (Math.PI / 2 - (i / 8) * Math.PI) * 0.8; return [Math.sin(a) * 0.21, 1.27, -0.08 + Math.cos(a) * 0.22] as V3; });
  const pts = [...loop, ...neckArc].map((l) => { const q = project(cam, apply(C, mul(l, hh))); return [q.x, q.y] as P; });
  const facing = dot(norm(mv(C.R, [0, 0, 1])), norm(sub(cam.eye, C.p)));
  if (facing < 0.25) return null;
  const px = project(cam, C.p).s * hh, w = Math.max(0.8, px * 0.012), marks: Mark[] = [];
  // the collarbones' inner ends, running out from the pit under the neckline, a gentle S
  SIDES.forEach((s) => { const k = sgn(s); marks.push(...lines(surfaceRuns(r, cam, C, [[k * 0.05, 1.12, 0.36], [k * 0.12, 1.135, 0.35], [k * 0.19, 1.15, 0.32], [k * 0.24, 1.17, 0.29]], { min: 0.25, normal: [0, 0.3, 1] }), "line", w, 0.55)); });
  marks.push(...lines(surfaceRuns(r, cam, C, [[-0.03, 1.13, 0.37], [0, 1.105, 0.375], [0.03, 1.13, 0.37]], { min: 0.25, normal: [0, 0.3, 1] }), "line", w * 0.9, 0.5));
  const arc2 = pts.slice(loop.length), nearArc = (p: P) => arc2.some((q, i) => i > 0 && segD(p, arc2[i - 1], q) < 3);
  return { id: "neckSkin", role: o.skin, depth: project(cam, apply(C, [0, 1.15 * hh, 0.35 * hh])).z, polys: [pts], size: px * 0.04, marks, outline: true, keepLine: (p) => !nearArc(p), clipTo: "torso", over: ["torso", "neck", "sleeveL", "sleeveR"] };
};

const segD = (p: P, a: P, b: P) => { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };

// ---- surface anatomy on the skin
export const neckMarks = (r: Rig, headPt: (q: V3) => V3, cam: Camera): Mark[] => {
  const hh = r.dims.hh, px = project(cam, r.joints.neck).s * hh, w = Math.max(0.8, px * 0.011), m: Mark[] = [];
  // sternocleidomastoid: from behind the ear, down and forward to the pit of the neck: the neck's V
  SIDES.forEach((s) => {
    const k = sgn(s), a = headPt([k * 0.3, 0.34, -0.06]), b = apply(r.neck, [k * 0.035 * hh, 0.02 * hh, 0.2 * hh]), mid = add(mul(add(a, b), 0.5), mv(r.neck.R, [k * 0.04 * hh, 0, 0.06 * hh]));
    const pts = [a, mid, b].map((q) => q), n = norm(mv(r.neck.R, [k * 0.6, 0, 0.8]));
    if (dot(n, norm(sub(cam.eye, mid))) > 0.1) m.push({ kind: "line", pts: pts.map((q) => { const p = project(cam, q); return [p.x, p.y] as P; }), role: "line", w: w * 0.9, alpha: 0.45 });
  });
  return m;
};
export const kneeMarks = (r: Rig, s: Side, cam: Camera): Mark[] => {
  const hh = r.dims.hh, S = r.shin[s], k = sgn(s), px = project(cam, S.p).s * hh, w = Math.max(0.8, px * 0.012);
  // the kneecap's lower rim and the tendon down to the shin's tuberosity
  const cap = surfaceRuns(r, cam, S, [[k * 0.075, 0.06, 0.2], [k * 0.06, -0.04, 0.22], [0, -0.08, 0.23], [-k * 0.06, -0.04, 0.22], [-k * 0.075, 0.06, 0.2]], { min: 0.2 });
  const ten = surfaceRuns(r, cam, S, [[-k * 0.04, -0.1, 0.2], [-k * 0.035, -0.22, 0.19]], { min: 0.25 });
  const inner = surfaceRuns(r, cam, S, [[-k * 0.2, 0.1, 0.02], [-k * 0.21, -0.05, 0.02], [-k * 0.17, -0.18, 0.0]], { min: 0.1 });
  return [...lines(cap, "line", w, 0.55), ...lines(ten, "line", w * 0.8, 0.35), ...lines(inner, "line", w * 0.8, 0.35)];
};
export const elbowMarks = (r: Rig, s: Side, cam: Camera): Mark[] => {
  const hh = r.dims.hh, F = r.fore[s], px = project(cam, F.p).s * hh, w = Math.max(0.8, px * 0.011);
  // the crease in the crook of the arm, and the bony point behind when the arm bends
  return [...lines(surfaceRuns(r, cam, F, [[-0.08, -0.02, 0.13], [0, -0.03, 0.16], [0.08, -0.01, 0.13]], { min: 0.25 }), "line", w, 0.4)];
};
