// THEO, the realistic-canon adult (7.5 heads, 1.78 m). He exists to prove the human rig on the
// hard cases (turning, reaching, sitting, gripping, a hand pointed at the lens), so he wears as
// little as a figure-class model would: a T-shirt, shorts to just above the knee and plimsolls, which leave
// shoulders, elbows, knees, calves and hands to be judged.
import type { Camera } from "../../character/math3";
import type { Character, Pose, Scene } from "../../character/types";
import { CANON } from "../../character/human/canon";
import { ADULT_BODY } from "../../character/human/mannequin";
import { ADULT_HEAD, type Ell, type HeadCtx, hairCap } from "../../character/human/head";
import { blouse, elbowMarks, kneeMarks, neckMarks, neckline, shorts, softSleeve } from "./wardrobe";
import type { P } from "../../core";
import type { Mark } from "../../character/types";
import { dot, mv, norm, project, sub } from "../../character/math3";
import { type FigureSpec, assemble, build, checkPose } from "../../character/human/figure";
import { trouserLeg } from "../../character/human/clothing";
import { SIDES } from "../../character/human/skeleton";
import type { Palette } from "../../character/render/storybook";

export const THEO_SPEC: FigureSpec = {
  canon: CANON.adult, height: 1.78, body: ADULT_BODY, head: ADULT_HEAD,
  roles: { skin: "skin", torso: "shirt", hips: "shirt", foot: "shoe" },
  inflate: { torso: 0.025, hips: 0.035, foot: 0.03 },
};
export const THEO_PALETTE: Palette = {
  skin: { base: "#e9b996", shade: "#c98e72" }, shirt: { base: "#d9dfe6", shade: "#a9b4c2" }, shorts: { base: "#5e7fa8", shade: "#3f5a80" },
  shoe: { base: "#f2efe8", shade: "#bdb6aa" }, hair: { base: "#4a3a33", shade: "#2f2521" }, hairLine: { base: "#2a201c", shade: "#1c1512" }, pupil: { base: "#5b4636", shade: "#3a2c22" },
  white: { base: "#fffaf3", shade: "#e8e0d4" }, blush: { base: "#e39a8e", shade: "#c77c70" }, mouth: { base: "#6e3434", shade: "#4d2222" }, lip: { base: "#c46e6a", shade: "#a0524e" },
  nail: { base: "#f6dccb", shade: "#e2b9a4" }, cup: { base: "#e9eff4", shade: "#9fb0c0" }, coffee: { base: "#6b4430", shade: "#4b2e20" }, stool: { base: "#c9955e", shade: "#94683d" },
};
// HIS HAIR: short at the back and sides with sideburns, longer on top, parted on his left and
// swept up and over to his right in a soft quiff. The volume is three masses above the cap; the
// strands are drawn ON the cap's surface in the direction the hair grows, so they turn with him.
export const QUIFF: Ell[] = [
  { c: [-0.02, 0.96, 0.17], r: [0.33, 0.1, 0.24] },
];
const STRANDS: [number, number][][] = [
  ...[0.3, 0.2, 0.1, 0.0, -0.1, -0.2].map((z) => [[0.15, z - 0.02], [0.05, z + 0.03], [-0.08, z + 0.07], [-0.22, z + 0.05]] as [number, number][]), // from the part, over to his right
  ...[0.28, 0.14].map((z) => [[0.16, z], [0.26, z - 0.02], [0.33, z - 0.06]] as [number, number][]),                                             // the short side of the part
  [[0.15, 0.36], [0.15, 0.1], [0.15, -0.15], [0.14, -0.32]],                                                                                   // the part itself
];
const hairStrands = (h: HeadCtx, cam: Camera): Mark[] => {
  const c = h.spec.skull[0], R = [c.r[0] + 0.045, c.r[1] + 0.045, c.r[2] + 0.045], px = project(cam, h.M(c.c)).s * h.hh, w = Math.max(0.7, px * 0.009), out: Mark[] = [];
  STRANDS.forEach((st, i) => {
    let cur: P[] = []; const flush = () => { if (cur.length > 1) out.push({ kind: "line", pts: cur, role: i === STRANDS.length - 1 ? "line" : "hairLine", w: i === STRANDS.length - 1 ? w * 0.9 : w, alpha: i === STRANDS.length - 1 ? 0.55 : 0.7 }); cur = []; };
    st.forEach(([x, z]) => {
      const u = x / R[0], v = z / R[2], y = c.c[1] + R[1] * Math.sqrt(Math.max(0, 1 - u * u - v * v)) + 0.012, q = h.M([x, y, c.c[2] + z]), n = norm(mv(h.f.R, [u / R[0], (y - c.c[1]) / R[1] / R[1], v / R[2]]));
      if (dot(n, norm(sub(cam.eye, q))) > 0.12) { const p = project(cam, q); cur.push([p.x, p.y]); } else flush();
    });
    flush();
  });
  return out;
};
const FACE = { line: "line", pupil: "pupil", white: "white", blush: "blush", brow: "hair", mouth: "mouth", lip: "lip" };

export const theo: Character = {
  id: "theo", name: "Theo", version: "1.0.0", canonId: "adult",
  description: "Adult figure model, 7.5 heads, 1.78 m: short dark hair, athletic build, grey vest, blue shorts, white plimsolls.",
  roles: {
    skin: { family: "warm skin", hue: [10, 40], note: "one warm skin tone" }, shirt: { family: "cool grey", hue: [190, 230], note: "" },
    shorts: { family: "blue", hue: [200, 230], note: "" }, shoe: { family: "off-white", hue: [20, 60], note: "" }, hair: { family: "dark brown", hue: [0, 40], note: "" },
  },
  features: [{ id: "shortHair", parts: ["hair"], note: "cropped dark hair", visible: () => true }],
  pose: (p: Pose) => { checkPose(p, "theo"); return p; },
  toScene: (p: Pose, cam: Camera): Scene => {
    const b = build(THEO_SPEC, p, cam), r = b.rig, B = THEO_SPEC.body;
    // the shirt: the body's torso and hips in shirt colour, blousing over the band of the shorts
    const bl = blouse(r, { role: "shirt", ease: 0.03 }), torso = b.parts.find((q) => q.id === "torso")!;
    torso.groups.push({ blobs: [bl.ring], mode: "each" }); torso.marksFn = bl.marksFn;
    SIDES.forEach((s) => {
      b.parts.push(softSleeve(r, B, s, { role: "shirt", len: 0.46, ease: 0.03 }), trouserLeg(r, B, s, { role: "shorts", to: 0.72, inflate: 0.045, flare: 0.02 }));
      const shin = b.parts.find((q) => q.id === "shin" + s)!, fore = b.parts.find((q) => q.id === "foreArm" + s)!;
      shin.marksFn = (c) => kneeMarks(r, s, c); fore.marksFn = (c) => elbowMarks(r, s, c);
    });
    b.parts.push(shorts(r, B, { role: "shorts", ease: 0.04 }));
    const neck = b.parts.find((q) => q.id === "neck")!; neck.marksFn = (c) => neckMarks(r, b.head.M, c);
    return assemble(cam, b, p, FACE, { character: "theo", version: "1.1.0" }, () => {
      const out = [hairCap(b.head, "hair", { front: 0.86, side: 0.6, back: 0.28, lift: 0.04, sideburn: 0.14, volume: QUIFF })];
      out[0].marks.push(...hairStrands(b.head, cam));
      const nl = neckline(r, cam, { skin: "skin", spec: B, ease: 0.025 }); if (nl) out.push(nl);
      return out;
    });
  },
};
