// CLOTHING is a second skin with thickness, not a recolour. A garment is built from the same
// blobs as the body under it, inflated, and cut to length along the bone; it paints OVER the
// part it covers whatever the depth sort says. So a sleeve always turns with its arm, and a coat
// hem swings with the thighs inside it.
import { Blob, M3, V3, cross, mix3, mv, norm, sub } from "../math3";
import type { BlobPart } from "../build";
import { type B, type BodySpec, blob } from "./mannequin";
import { type Rig, type Side, SIDES } from "./skeleton";

// blobs of a chain, cut at `t` (0 = first blob, 1 = last): the last blob is interpolated
export const cutChain = (bs: Blob[], t: number): Blob[] => {
  const f = t * (bs.length - 1), i = Math.floor(f), u = f - i, out = bs.slice(0, i + 1);
  if (u > 1e-3 && i + 1 < bs.length) { const a = bs[i], b = bs[i + 1]; out.push({ c: mix3(a.c, b.c, u), R: b.R, r: mix3(a.r, b.r, u) }); }
  return out;
};
// a cut edge: the last blob widened by the flare and squashed flat along the bone, so the garment ends in an opening, not a dome
const hemOf = (b: Blob, flare: number, hh: number): Blob => ({ ...b, r: [b.r[0] + flare, 0.025 * hh, b.r[2] + flare] as V3 });

// a sleeve from the shoulder down the arm to `to` (0..1 upper arm, 1..2 on into the forearm),
// with a cuff that stands off the arm by `flare`
export const sleeve = (r: Rig, spec: BodySpec, s: Side, o: { role: string; to: number; inflate: number; flare?: number; id?: string }): BlobPart => {
  const hh = r.dims.hh, up = spec.upperArm.map((b) => blob(r, b, s, o.inflate)), fore = spec.foreArm.slice(0, 2).map((b) => blob(r, b, s, o.inflate));
  const all = o.to <= 1 ? cutChain(up, o.to) : [...up, ...cutChain(fore, Math.min(1, o.to - 1))];
  const last = all.length - 1; all[last] = hemOf(all[last], (o.flare ?? 0) * hh, hh);
  return { id: o.id ?? "sleeve" + s, role: o.role, groups: [{ blobs: all, mode: "chain" }], over: ["upperArm" + s, ...(o.to > 1 ? ["foreArm" + s] : [])], seams: [{ at: r.joints["shoulder" + s], r: spec.seam.shoulder * hh * 1.1, with: "torso" }], depthBias: -0.065 * hh };
};

// a garment leg (shorts, trousers) over the thigh and on down the shin
export const trouserLeg = (r: Rig, spec: BodySpec, s: Side, o: { role: string; to: number; inflate: number; flare?: number }): BlobPart => {
  const hh = r.dims.hh, th = spec.thigh.map((b) => blob(r, b, s, o.inflate)), sh = spec.shin.map((b) => blob(r, b, s, o.inflate * 0.8));
  const all = o.to <= 1 ? cutChain(th, o.to) : [...th, ...cutChain(sh, Math.min(1, o.to - 1))];
  const last = all.length - 1; all[last] = hemOf(all[last], (o.flare ?? 0) * hh, hh);
  return { id: "leg" + s, role: o.role, groups: [{ blobs: all, mode: "chain" }], over: ["thigh" + s, ...(o.to > 1 ? ["shin" + s] : [])], seams: [{ at: r.joints["hip" + s], r: spec.seam.hip * hh, with: "hips" }], depthBias: -0.025 * hh };
};

// A coat body: chest, waist and hips inflated, then a hem ellipse at `hemY` (head heights above
// the floor at rest) that follows the thighs, so it swings with the stride.
export const coatBody = (r: Rig, spec: BodySpec, o: { role: string; inflate: number; hemBelowHip: number; hemFlare: number }): BlobPart => {
  const hh = r.dims.hh, P = r.pelvis;
  const torso = spec.torso.map((b) => blob(r, b, "L", o.inflate)).reverse(), hips = spec.hips.map((b) => blob(r, b, "L", o.inflate * 1.1));
  // the hem hangs from the hips, pulled toward wherever the knees have gone
  const knees = SIDES.map((s) => r.joints["knee" + s]), hipsJ = SIDES.map((s) => r.joints["hip" + s]);
  const mid = mix3(mix3(hipsJ[0], hipsJ[1], 0.5), mix3(knees[0], knees[1], 0.5), Math.min(0.95, o.hemBelowHip / (r.dims.thigh / hh)));
  const spread = Math.hypot(knees[0][0] - knees[1][0], knees[0][2] - knees[1][2]) / hh;
  // the hem ring lies square to the thighs: flat when she stands, upright across her knees when she sits
  const hm = mix3(hipsJ[0], hipsJ[1], 0.5), km = mix3(knees[0], knees[1], 0.5), dn = norm(sub(hm, km)), sideA = norm(cross(dn, mv(P.R, [0, 0, 1]))), fwdA = cross(sideA, dn);
  const hemR: M3 = [sideA[0], dn[0], fwdA[0], sideA[1], dn[1], fwdA[1], sideA[2], dn[2], fwdA[2]];
  const hem: Blob = { c: mid, R: hemR, r: [(0.62 + o.hemFlare + spread * 0.25) * hh, 0.05 * hh, (0.46 + o.hemFlare * 0.8 + spread * 0.18) * hh] };
  const sided: Blob[] = SIDES.flatMap((s) => spec.torsoSided.slice(0, 2).map((b: B) => blob(r, b, s, o.inflate)));
  return { id: "coat", role: o.role, groups: [{ blobs: [...torso, hips[1], hem], mode: "chain" }, { blobs: sided, mode: "each" }], over: ["torso", "hips", "thighL", "thighR"], depthAt: r.joints.lumbar };
};
