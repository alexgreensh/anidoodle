// THE MANNEQUIN. Volumes hung on the skeleton: an egg of a ribcage, a bowl of a pelvis, a waist
// between them, and limbs as chains of ellipsoids whose widths follow the MUSCLE PROFILE, not a
// capsule: the calf bulges high and at the back while the shin stays straight in front; the
// forearm is widest just below the elbow and flattens to a wrist wider than it is deep; the
// thigh carries the quadriceps forward; the deltoid caps the shoulder. "Straights against curves."
//
// Reference opened: Bridgman "Constructive Anatomy" (the wedged masses of ribcage and pelvis);
// Hogarth "Dynamic Anatomy" pp. 40-120 (the offset bulges of calf, forearm, thigh); Winter
// (2009) table 4.1 for where segment masses sit (used by balance.ts).
//
// Units: head heights (hh). A blob is [frame, centre, radii]; x is LATERAL (mirrored per side:
// + is away from the body's midline), y along the bone, z forward.
import type { P } from "../../core";
import { Blob, Camera, Frame, MIRROR_X, V3, add, apply, dot, mm, mul, mv, norm, project, sub, I3 } from "../math3";
import type { Mark } from "../types";
import type { BlobPart } from "../build";
import { type Rig, type Side, SIDES, sgn } from "./skeleton";
import { FINGERS, type HandAngles, handModel } from "./hands";

type FrameName = "pelvis" | "lumbar" | "chest" | "neck" | "upper" | "fore" | "hand" | "thigh" | "shin" | "foot" | "toes";
export type B = [FrameName, V3, V3];
export type BodySpec = {
  torso: B[]; torsoSided: B[];   // waist to shoulders, chained; pecs, traps, lats mirrored
  hips: B[]; hipsSided: B[];     // the pelvis bowl chained up to the waist; glutes and hip flare mirrored
  neck: B[]; upperArm: B[]; foreArm: B[]; thigh: B[]; shin: B[]; shinExtra: B[]; foot: B[]; toes: B[];
  seam: { neck: number; waist: number; shoulder: number; elbow: number; wrist: number; hip: number; knee: number; ankle: number };
  handGirth: number;
  handDetail?: boolean;           // knuckle wrinkles, joint creases, palm lines (adult realism; storybook leaves them out)
  landmarks?: Partial<Record<"upperArm" | "foreArm" | "thigh" | "shin", B[]>>; // bony points and offset muscle heads that break the smooth sweep of a limb
};

export const CHILD_BODY: BodySpec = {
  torso: [["lumbar", [0, 0.14, 0.035], [0.39, 0.3, 0.31]], ["chest", [0, 0.36, 0.0], [0.42, 0.44, 0.31]], ["chest", [0, 0.66, -0.02], [0.46, 0.16, 0.27]]],
  torsoSided: [["chest", [0.2, 0.74, -0.05], [0.24, 0.1, 0.14]], ["chest", [0.42, 0.72, -0.02], [0.2, 0.11, 0.16]]],
  hips: [["lumbar", [0, 0.1, 0.03], [0.38, 0.2, 0.3]], ["pelvis", [0, -0.04, -0.01], [0.42, 0.28, 0.3]]],
  hipsSided: [["pelvis", [0.16, -0.14, -0.12], [0.2, 0.22, 0.17]]],
  neck: [["neck", [0, 0.0, 0.02], [0.17, 0.1, 0.16]], ["neck", [0, 0.44, 0.0], [0.155, 0.08, 0.15]]],
  upperArm: [["upper", [0.02, -0.13, 0], [0.13, 0.15, 0.14]], ["upper", [0, -0.45, 0.005], [0.112, 0.28, 0.118]], ["upper", [0, -0.87, -0.01], [0.092, 0.08, 0.088]]],
  foreArm: [["fore", [0.005, -0.2, 0.0], [0.105, 0.2, 0.098]], ["fore", [0, -0.5, 0], [0.082, 0.16, 0.08]], ["hand", [0, 0.03, 0], [0.058, 0.05, 0.08]]],
  thigh: [["thigh", [0.05, -0.18, 0], [0.24, 0.26, 0.24]], ["thigh", [0, -0.6, 0.03], [0.185, 0.38, 0.19]], ["thigh", [0, -1.18, 0.01], [0.13, 0.1, 0.13]]],
  shin: [["shin", [0, -0.04, 0.01], [0.125, 0.1, 0.13]], ["shin", [0.005, -0.38, -0.045], [0.125, 0.3, 0.13]], ["shin", [0, -1.13, 0], [0.074, 0.06, 0.074]]],
  shinExtra: [],
  foot: [["foot", [0, -0.03, 0], [0.085, 0.07, 0.085]], ["foot", [0, -0.14, -0.08], [0.08, 0.08, 0.09]], ["foot", [0, -0.14, 0.16], [0.1, 0.075, 0.16]]],
  toes: [["toes", [0, 0.01, 0.08], [0.1, 0.05, 0.09]]],
  seam: { neck: 0.2, waist: 0.45, shoulder: 0.2, elbow: 0.12, wrist: 0.09, hip: 0.3, knee: 0.14, ankle: 0.1 },
  handGirth: 1.12,
};
// Adult, 7.5 heads. Front half-widths (hh): deltoids ~0.98, chest at the armpit ~0.7, waist
// ~0.52, hips ~0.66. Depths: chest 0.44, waist 0.36, buttocks reach 0.46 behind the hip joint.
export const ADULT_BODY: BodySpec = {
  torso: [["lumbar", [0, 0.16, 0.04], [0.5, 0.34, 0.35]], ["chest", [0, 0.52, 0.0], [0.6, 0.62, 0.43]], ["chest", [0, 0.9, -0.01], [0.66, 0.26, 0.38]]],
  torsoSided: [
    ["chest", [0.25, 0.86, 0.22], [0.27, 0.2, 0.18]],     // pectorals: their lower edge squares the chest
    ["chest", [0.22, 1.2, -0.08], [0.26, 0.16, 0.17]],    // trapezius: the slope from the neck down to the acromion
    ["chest", [0.44, 0.62, -0.08], [0.17, 0.36, 0.3]],    // latissimus: the V under the arm
    ["chest", [0.56, 1.0, -0.03], [0.23, 0.15, 0.22]],   // the shoulder girdle: clavicle and scapula carry the torso out to the acromion
  ],
  hips: [["lumbar", [0, 0.1, 0.03], [0.5, 0.22, 0.35]], ["pelvis", [0, -0.08, -0.02], [0.6, 0.34, 0.38]]],
  hipsSided: [["pelvis", [0.23, -0.24, -0.2], [0.27, 0.3, 0.25]], ["pelvis", [0.44, -0.22, 0.0], [0.19, 0.24, 0.25]]], // glutes; the flare over the trochanter
  neck: [["neck", [0, 0.02, 0.04], [0.215, 0.14, 0.21]], ["neck", [0, 0.5, 0.02], [0.19, 0.1, 0.19]]],
  upperArm: [["upper", [0.02, -0.26, 0], [0.18, 0.3, 0.22]], ["upper", [0, -0.66, 0.03], [0.19, 0.42, 0.21]], ["upper", [0, -1.36, -0.02], [0.15, 0.12, 0.14]]],
  foreArm: [["fore", [0.02, -0.28, 0.01], [0.19, 0.3, 0.17]], ["fore", [0, -0.72, 0], [0.13, 0.22, 0.12]], ["hand", [0, 0.04, 0], [0.085, 0.07, 0.13]]],
  thigh: [["thigh", [0.04, -0.25, 0.0], [0.31, 0.38, 0.33]], ["thigh", [0, -0.88, 0.05], [0.3, 0.51, 0.3]], ["thigh", [0, -1.77, 0.02], [0.19, 0.16, 0.2]]],
  shin: [["shin", [0, -0.05, 0.02], [0.18, 0.14, 0.19]], ["shin", [0.01, -0.49, -0.09], [0.2, 0.46, 0.21]], ["shin", [0, -1.66, 0], [0.12, 0.08, 0.12]]],
  shinExtra: [["shin", [-0.06, -0.54, -0.11], [0.16, 0.32, 0.17]]], // gastrocnemius: the inner head sits lower than the outer
  foot: [["foot", [0, -0.1, 0], [0.12, 0.08, 0.12]], ["foot", [0, -0.24, -0.14], [0.12, 0.12, 0.14]], ["foot", [0, -0.22, 0.25], [0.16, 0.11, 0.26]]],
  toes: [["toes", [0, -0.01, 0.1], [0.17, 0.05, 0.13]]],
  seam: { neck: 0.3, waist: 0.62, shoulder: 0.28, elbow: 0.17, wrist: 0.13, hip: 0.42, knee: 0.2, ankle: 0.15 },
  handGirth: 1, handDetail: true,
  landmarks: {
    upperArm: [["upper", [0, -0.62, 0.1], [0.16, 0.3, 0.14]], ["upper", [0, -0.72, -0.1], [0.15, 0.36, 0.13]]],   // biceps in front, triceps behind: two masses, not a tube
    foreArm: [["fore", [0, 0.02, -0.12], [0.08, 0.08, 0.07]], ["fore", [0.02, -0.2, 0.1], [0.14, 0.22, 0.11]], ["fore", [-0.06, -0.3, -0.03], [0.13, 0.26, 0.12]], ["hand", [0.05, 0.06, -0.1], [0.035, 0.035, 0.035]]], // elbow point; brachioradialis swell high on the thumb side; the flexor mass lower on the inside; the ulnar head at the wrist
    thigh: [["thigh", [-0.12, -1.52, 0.08], [0.14, 0.22, 0.13]]],   // vastus medialis: the teardrop above the inner knee
    shin: [["shin", [0, 0.02, 0.19], [0.1, 0.11, 0.06]], ["shin", [-0.1, -0.03, 0.0], [0.12, 0.12, 0.14]], ["shin", [0.07, -0.38, -0.1], [0.15, 0.28, 0.16]], ["shin", [-0.1, -1.6, 0.0], [0.055, 0.055, 0.055]], ["shin", [0.1, -1.68, -0.02], [0.05, 0.05, 0.05]], ["shin", [0, -1.32, -0.12], [0.07, 0.2, 0.05]]], // kneecap; the inner condyle; outer calf head HIGHER than the inner; inner ankle bone higher than the outer; Achilles
  },
};

const frameOf = (r: Rig, n: FrameName, s: Side): Frame => (n === "pelvis" || n === "lumbar" || n === "chest" || n === "neck" ? r[n] : r[n][s]);
export const blob = (r: Rig, [fn, c, rad]: B, s: Side, inflate = 0): Blob => {
  const hh = r.dims.hh, k = sgn(s), f = frameOf(r, fn, s);
  return { c: apply(f, [c[0] * k * hh, c[1] * hh, c[2] * hh]), R: mm(f.R, I3), r: [(rad[0] + inflate) * hh, (rad[1] + inflate * 0.6) * hh, (rad[2] + inflate) * hh] };
};

export type BodyOpts = { roles?: Partial<Record<string, string>>; inflate?: Partial<Record<string, number>>; hands: Record<Side, HandAngles> };
// every body part as blobs, with the seams that hide where one part grows out of another
export const bodyParts = (r: Rig, spec: BodySpec, o: BodyOpts): BlobPart[] => {
  const hh = r.dims.hh, J = r.joints, role = (id: string) => o.roles?.[id] ?? o.roles?.skin ?? "skin", inf = (id: string) => o.inflate?.[id] ?? 0;
  const chain = (bs: B[], s: Side, id: string) => bs.map((b) => blob(r, b, s, inf(id)));
  const sided = (bs: B[], id: string) => SIDES.flatMap((s) => bs.map((b) => blob(r, b, s, inf(id))));
  const parts: BlobPart[] = [
    { id: "torso", role: role("torso"), groups: [{ blobs: chain(spec.torso, "L", "torso"), mode: "chain" }, { blobs: sided(spec.torsoSided, "torso"), mode: "each" }], depthAt: J.chest },
    { id: "hips", role: role("hips"), groups: [{ blobs: chain(spec.hips, "L", "hips"), mode: "chain" }, { blobs: sided(spec.hipsSided, "hips"), mode: "each" }], seams: [{ at: J.lumbar, r: spec.seam.waist * hh, with: "torso" }], depthAt: J.pelvis },
    { id: "neck", role: role("neck"), groups: [{ blobs: chain(spec.neck, "L", "neck"), mode: "chain" }], seams: [{ at: J.neck, r: spec.seam.neck * hh, with: "torso" }, { at: J.head, r: 0.3 * hh, with: "head" }], depthBias: 0.03 * hh, over: ["torso"] }, // the neck stands IN FRONT of the trapezius: seen from the front it paints over the shoulders
  ];
  for (const s of SIDES) {
    parts.push(
      { id: "upperArm" + s, role: role("upperArm"), groups: [{ blobs: chain(spec.upperArm, s, "upperArm"), mode: "chain" }], seams: [{ at: J["shoulder" + s], r: spec.seam.shoulder * hh, with: "torso" }, { at: J["elbow" + s], r: spec.seam.elbow * hh, with: "foreArm" + s }], depthBias: -0.06 * hh },
      { id: "foreArm" + s, role: role("foreArm"), groups: [{ blobs: chain(spec.foreArm, s, "foreArm"), mode: "chain" }], seams: [{ at: J["elbow" + s], r: spec.seam.elbow * hh, with: "upperArm" + s }, { at: J["wrist" + s], r: spec.seam.wrist * hh, with: "palm" + s }], depthBias: -0.07 * hh },
      { id: "thigh" + s, role: role("thigh"), groups: [{ blobs: chain(spec.thigh, s, "thigh"), mode: "chain" }], seams: [{ at: J["hip" + s], r: spec.seam.hip * hh, with: "hips" }, { at: J["knee" + s], r: spec.seam.knee * hh, with: "shin" + s }], depthBias: -0.02 * hh },
      { id: "shin" + s, role: role("shin"), groups: [{ blobs: chain(spec.shin, s, "shin"), mode: "chain" }, ...(spec.shinExtra.length ? [{ blobs: spec.shinExtra.map((b) => blob(r, b, s, inf("shin"))), mode: "each" as const }] : [])], seams: [{ at: J["knee" + s], r: spec.seam.knee * hh, with: "thigh" + s }, { at: J["ankle" + s], r: spec.seam.ankle * hh, with: "foot" + s }], depthBias: -0.02 * hh },
      { id: "foot" + s, role: role("foot"), groups: [{ blobs: chain(spec.foot, s, "foot"), mode: "chain" }, { blobs: [blob(r, spec.foot[2], s, inf("foot")), ...spec.toes.map((b) => blob(r, b, s, inf("foot")))], mode: "chain" }], seams: [{ at: J["ankle" + s], r: spec.seam.ankle * hh, with: "shin" + s }], depthBias: -0.03 * hh },
    );
    for (const [pid, bs] of Object.entries(spec.landmarks ?? {})) { const part = parts.find((q) => q.id === pid + s); if (part && bs?.length) part.groups.push({ blobs: bs.map((b) => blob(r, b, s, inf(pid))), mode: "each" }); }
    // the hand: palm block, then each digit its own part so fingers overlap each other correctly
    const hm = handModel(r.hand[s], s, r.dims.hand, o.hands[s], spec.handGirth);
    const Lh = r.dims.hand, Mh = s === "L" ? I3 : MIRROR_X, H = r.hand[s];
    const palmMarks = (cam: Camera): Mark[] => {
      const px = project(cam, H.p).s * Lh; if (!spec.handDetail || px < 70) return [];
      const L = (v: V3): V3 => apply(H, mv(Mh, mul(v, Lh))), P2 = (vs: V3[]): P[] => vs.map((v) => { const p = project(cam, L(v)); return [p.x, p.y]; });
      const back = mv(H.R, mv(Mh, [1, 0, 0])), toCam = norm(sub(cam.eye, H.p)), out: Mark[] = [], w = Math.max(0.6, px * 0.006);
      if (dot(back, toCam) > 0.2) hm.mcpArc.forEach((_, i) => { const m = (["index", "middle", "ring", "little"] as const)[i], c = FINGERS[m].mcp; out.push({ kind: "line", pts: P2([[0.07, c[1] - 0.005, c[2] - 0.035], [0.078, c[1] + 0.012, c[2]], [0.07, c[1] - 0.005, c[2] + 0.035]]), role: "line", w, alpha: 0.35 }); });
      if (dot(back, toCam) < -0.2) {
        // the palm's three great creases: heart line, head line, and the thenar crease round the ball of the thumb
        out.push({ kind: "line", pts: P2([[-0.074, -0.37, -0.19], [-0.076, -0.385, -0.08], [-0.075, -0.39, 0.03], [-0.072, -0.4, 0.1]]), role: "line", w, alpha: 0.4 });
        out.push({ kind: "line", pts: P2([[-0.074, -0.3, 0.15], [-0.076, -0.31, 0.04], [-0.075, -0.33, -0.08], [-0.072, -0.35, -0.15]]), role: "line", w, alpha: 0.35 });
        out.push({ kind: "line", pts: P2([[-0.074, -0.3, 0.14], [-0.078, -0.22, 0.08], [-0.078, -0.12, 0.05], [-0.074, -0.05, 0.03]]), role: "line", w, alpha: 0.35 });
      }
      return out;
    };
    parts.push({ id: "palm" + s, role: role("hand"), groups: [{ blobs: hm.palm, mode: "hull" }], seams: [{ at: J["wrist" + s], r: spec.seam.wrist * hh * 1.2, with: "foreArm" + s }], depthBias: -0.08 * hh, marksFn: palmMarks });
    hm.digits.forEach((d) => {
      // the thumb leaves the palm at its MCP: its metacarpal is inside the thenar, in the palm part
      const from = d.digit === "thumb" ? 1 : 0, bl: Blob[] = d.pts.slice(from).map((p, i) => ({ c: p, R: I3, r: [d.radii[i + from], d.radii[i + from], d.radii[i + from]] }));
      const nail = hm.nails.find((n) => n.digit === d.digit)!, k = sgn(s);
      const marksFn = (cam: Camera): Mark[] => {
        const out: Mark[] = [], rpx = project(cam, d.pts[2]).s * d.radii[2];
        // joint creases, only where the hand is big enough on screen to carry them: wrinkles over the
        // back of each finger joint, a single fold line on the palm side
        if (spec.handDetail && rpx > 2.2) d.frames.forEach((f, j) => {
          if (j === 0 || (d.digit === "thumb" && j === 0)) return;
          const at = d.pts[j], rad = d.radii[j], dn = mv(f.R, [k, 0, 0]), la = mv(f.R, [0, 0, 1]), al = mv(f.R, [0, -1, 0]);
          const arc = (side: number, off: number, span: number) => Array.from({ length: 5 }, (_, i) => { const u = -1 + i / 2; return add(add(at, mul(dn, side * rad * Math.sqrt(1 - (u * span) ** 2) * 0.98)), add(mul(la, u * span * rad), mul(al, off * rad + side * 0.12 * rad * u * u))); });
          const seen = (side: number) => dot(mul(dn, side), norm(sub(cam.eye, at))) > 0.2;
          const P2 = (q: V3[]): P[] => q.map((v) => { const p = project(cam, v); return [p.x, p.y]; });
          if (seen(1)) (j === 1 ? [-0.25, 0.05, 0.3] : [0.0]).forEach((off, i) => out.push({ kind: "line", pts: P2(arc(1, off, 0.62 - Math.abs(off) * 0.4)), role: "line", w: Math.max(0.5, rpx * 0.12), alpha: 0.32 - i * 0.04 }));
          if (seen(-1)) out.push({ kind: "line", pts: P2(arc(-1, 0.05, 0.75)), role: "line", w: Math.max(0.5, rpx * 0.14), alpha: 0.4 });
        });
        const nrm = mv(nail.R, [k, 0, 0]), dist = mv(nail.R, [0, -1, 0]), lat = mv(nail.R, [0, 0, 1]);
        if (dot(nrm, norm(sub(cam.eye, nail.c))) < 0.15) return out;
        const pts = Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2, u = Math.cos(a), v = Math.sin(a), sq = (t: number) => Math.sign(t) * Math.abs(t) ** 0.7; return project(cam, add(nail.c, add(mul(lat, sq(u) * nail.w * 0.5), mul(dist, sq(v) * nail.l * 0.5)))); }).map((q) => [q.x, q.y] as P);
        out.push({ kind: "fill", pts, role: "nail", alpha: 0.55, line: 0.5 });
        // the moon-shaped free edge of the nail catches light: a lighter crescent at its tip
        if (spec.handDetail && rpx > 3) out.push({ kind: "line", pts: Array.from({ length: 5 }, (_, i) => { const u = -0.8 + (i / 4) * 1.6; const q = project(cam, add(nail.c, add(mul(lat, u * nail.w * 0.45), mul(dist, nail.l * (0.42 - 0.08 * u * u))))); return [q.x, q.y] as P; }), role: "white", w: Math.max(0.5, rpx * 0.15), alpha: 0.6 });
        return out;
      };
      parts.push({ id: `${d.digit}${s}`, role: role("hand"), groups: [{ blobs: bl, mode: "chain" }], seams: [{ at: d.pts[from], r: d.radii[from] * (d.digit === "thumb" ? 1.3 : 1.5), with: "palm" + s }], depthBias: -0.085 * hh, depthAt: d.pts[2], marksFn });
    });
  }
  return parts;
};
export { handModel };
