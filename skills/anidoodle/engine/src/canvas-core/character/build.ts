// FROM VOLUMES TO A SCENE. Blobs are projected through the camera; a chain of blobs becomes
// the union of pairwise hulls (a swept, tapering limb that keeps its concave side), a group of
// blobs becomes one hull (a skull), and parts are put in paint order: far to near, with
// explicit "over" rules for what depth alone gets wrong (a coat over the thigh it contains).
import type { P } from "../core";
import { Blob, Camera, V3, blobPts, project } from "./math3";
import { ccw, hull } from "./shape2d";
import type { Mark, Part, Role } from "./types";

export type Group = { blobs: Blob[]; mode: "chain" | "hull" | "each" };
export type BlobPart = {
  id: string; role: Role; groups: Group[];
  seams?: { at: V3; r: number; with: string }[]; // r in metres
  marks?: Mark[]; over?: string[]; depthBias?: number; feature?: string; outline?: boolean; fill?: boolean;
  depthAt?: V3;                                    // measure depth here instead of the blob mean
  marksFn?: (cam: Camera) => Mark[];               // marks that need the camera (a nail seen or not)
  keepLineFn?: (cam: Camera) => ((p: P) => boolean) | undefined;
};

export const polysOf = (cam: Camera, groups: Group[]): P[][] => {
  const out: P[][] = [];
  for (const g of groups) {
    const pp = g.blobs.map((b) => blobPts(cam, b));
    if (g.mode === "hull") out.push(ccw(hull(pp.flat())));
    else if (g.mode === "each" || pp.length === 1) pp.forEach((p) => out.push(ccw(hull(p))));
    else for (let i = 0; i + 1 < pp.length; i++) out.push(ccw(hull([...pp[i], ...pp[i + 1]])));
  }
  return out;
};

export const toPart = (cam: Camera, bp: BlobPart): Part => {
  const all = bp.groups.flatMap((g) => g.blobs);
  const depth = bp.depthAt ? project(cam, bp.depthAt).z : all.reduce((a, b) => a + project(cam, b.c).z, 0) / Math.max(1, all.length);
  const size = all.reduce((a, b) => a + Math.max(b.r[0], b.r[2]) * project(cam, b.c).s, 0) / Math.max(1, all.length);
  return {
    id: bp.id, role: bp.role, depth: depth + (bp.depthBias ?? 0), polys: polysOf(cam, bp.groups), size,
    seams: (bp.seams ?? []).map((s) => { const q = project(cam, s.at); return { at: [q.x, q.y] as P, r: s.r * q.s, with: s.with }; }),
    marks: [...(bp.marks ?? []), ...(bp.marksFn ? bp.marksFn(cam) : [])], keepLine: bp.keepLineFn?.(cam), over: bp.over, feature: bp.feature, outline: bp.outline, fill: bp.fill,
  };
};

// far to near; then every "over" rule is enforced by moving the part just after what it covers
export const order = (parts: Part[]): Part[] => {
  const o = [...parts].sort((a, b) => b.depth - a.depth || a.id.localeCompare(b.id));
  for (let pass = 0; pass < 4; pass++) {
    let moved = false;
    for (const p of [...o]) for (const under of p.over ?? []) {
      const i = o.indexOf(p), j = o.findIndex((q) => q.id === under);
      if (j > i) { o.splice(i, 1); o.splice(o.findIndex((q) => q.id === under) + 1, 0, p); moved = true; }
    }
    if (!moved) break;
  }
  return o;
};
