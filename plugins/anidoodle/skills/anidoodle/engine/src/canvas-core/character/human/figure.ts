// A HUMAN FIGURE, assembled: canon -> skeleton -> pose (validated) -> mannequin + head + hands ->
// parts in paint order. Characters build on this and add what makes them themselves (hair,
// clothes, props); nothing here knows about any particular character or any hand of drawing.
import type { P } from "../../core";
import { Camera, V3, apply, project } from "../math3";
import { BlobPart, order, toPart } from "../build";
import { hull } from "../shape2d";
import type { Part, Pose, Scene } from "../types";
import type { CanonRow } from "./canon";
import { type Dims, type Rig, SIDES, dimsFromCanon, fk, limitViolations, lowestFoot } from "./skeleton";
import { type BodySpec, bodyParts } from "./mannequin";
import { type HeadCtx, type HeadSpec, faceMarks, headCtx, headParts } from "./head";
import { type HandAngles, handViolations, resolveHand } from "./hands";

export type FigureSpec = { canon: CanonRow; height: number; body: BodySpec; head: HeadSpec; roles?: Partial<Record<string, string>>; inflate?: Partial<Record<string, number>> };
export type Built = { rig: Rig; dims: Dims; hands: Record<"L" | "R", HandAngles>; head: HeadCtx; parts: BlobPart[]; extra: Part[] };

// A pose outside the range of motion fails HERE, at load, with every reason listed.
export const checkPose = (p: Pose, tag = "pose"): Record<"L" | "R", HandAngles> => {
  const bad = limitViolations(p.joints);
  const hands = { L: resolveHand(p.hands?.L), R: resolveHand(p.hands?.R) };
  bad.push(...handViolations(hands.L, "handL"), ...handViolations(hands.R, "handR"));
  if (bad.length) throw new Error(`${tag}: outside the range of motion:\n  ` + bad.join("\n  "));
  return hands;
};

export const rigFor = (spec: FigureSpec, p: Pose): Rig => {
  const dims = dimsFromCanon(spec.canon, spec.height);
  let rig = fk(dims, p);
  if (p.plant) { const dy = lowestFoot(rig); rig = fk(dims, { ...p, root: [p.root[0], p.root[1] - dy, p.root[2]] }); }
  return rig;
};

export const build = (spec: FigureSpec, p: Pose, cam: Camera): Built => {
  const hands = checkPose(p);
  const rig = rigFor(spec, p), dims = rig.dims;
  const head = headCtx(rig.head, dims.hh, spec.head, cam);
  const parts = [...bodyParts(rig, spec.body, { hands, roles: spec.roles, inflate: spec.inflate }), ...headParts(head, spec.roles?.head ?? spec.roles?.skin ?? "skin")];
  return { rig, dims, hands, head, parts, extra: [] };
};

// the contact shadow: the feet and the body's footprint, pushed away from the light
export const groundShadow = (cam: Camera, rig: Rig, away: [number, number] = [0.5, 0]): P[] => {
  const pts: V3[] = [];
  const hh = rig.dims.hh;
  SIDES.forEach((s) => { for (const loc of [[0, -rig.dims.ankleH, -rig.dims.heel], [0, -rig.dims.ankleH, 0]] as V3[]) { const w = apply(rig.foot[s], loc); pts.push([w[0], 0, w[2]]); } const t = apply(rig.toes[s], [0, 0, rig.dims.toe - rig.dims.ball]); pts.push([t[0], 0, t[2]]); });
  const pel = rig.joints.pelvis; pts.push([pel[0] + away[0] * hh, 0, pel[2] + away[1] * hh]);
  const ring: V3[] = []; pts.forEach((q) => { for (let a = 0; a < 8; a++) ring.push([q[0] + Math.cos(a * 0.785) * hh * 0.35, 0, q[2] + Math.sin(a * 0.785) * hh * 0.22]); });
  return hull(ring.map((q) => { const r = project(cam, q); return [r.x, r.y] as P; }));
};

export type FaceRoles = { line: string; pupil: string; white: string; blush: string; brow: string; mouth: string; lip: string };
// `post` sees the projected parts and returns more (hair, glasses: things placed against the head)
export const assemble = (cam: Camera, b: Built, p: Pose, faceRoles: FaceRoles, meta: Record<string, string | number> = {}, post?: (parts: Part[]) => Part[]): Scene => {
  const parts = b.parts.map((bp) => toPart(cam, bp));
  const head = parts.find((q) => q.id === "head");
  if (head) head.marks.push(...faceMarks(b.head, p.expression, faceRoles, head.size * 2));
  const all = order([...parts, ...b.extra, ...(post ? post(parts) : [])]);
  return { parts: all, light: [-0.62, -0.78], ground: { y: 0, shadow: groundShadow(cam, b.rig) }, px: project(cam, b.rig.joints.head).s * b.dims.hh, meta };
};
