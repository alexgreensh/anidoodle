// THE LATERAL FIGURE (spec 5.7, FABLE): wings closed or half open over the back, body in profile,
// six legs gripping. This is how most butterflies actually sip, and it is the figure a natural
// history plate draws BESIDE the dorsal one. It is used at stage R, where the creature is 350 to
// 430 px across and realism matters most.
//
// It uses the SAME control points as the dorsal figure, which is the project's rule and also the
// honest thing: a closed wing is not a different wing, it is the same wing stood up over the back
// and seen from the side. So the forewing and hindwing outlines are posed rather than redrawn, the
// venation code runs on them unchanged, and what is genuinely new here is the profile body, the
// legs and the head, none of which the blueprint ever drew.
//
// From the Alamy monarch (reference 3 in `anatomy.ts`): the hindwing sits BEHIND and its rounded
// margin projects below and behind the forewing; the forewing's inner margin tucks down out of
// sight; the underside is quieter than the upperside and its VENATION is the dominant mark; the
// margin carries a dark band with a double row of pale spots; the legs reach forward and down to
// grip; and the antennae splay into a shallow V with the clubs at the top.
import { Gfx, P, oval, rng, tube } from "../../core";
import { CX, CY, FW, FW_H, FW_T, HW, HW_H, HW_T, REST, Wing, cen, lerp, wingGeom } from "../geom";
import { PAPER_W } from "../finale/world";
const PEACH = "#ef9a5c", ROSE = "#d96e80";
import { lift } from "../finale/paint";
import { venation } from "./anatomy";
import { BAND, DUST, EYE, EYE_HI, FUR, FUR_D, LEG, SPOT, UMBER, damp, dilate, mixc, ps, rigger } from "./wingpaint";

// The UNDERSIDE is a different picture from the upperside, as it is in life. A butterfly with the
// same pattern on both faces reads as a cut-out, so this is quieter, cooler and more marbled.
// richer than a pale underside would be in life, because the brief wants pigment depth: still
// quieter than the upperside, but with real weight in the marbling and the margin
const U_GROUND = "#f0b389", U_MARBLE = "#a8734f", U_VEIN = "#6b3b2a", U_SHADE = "#d98a6d";

export type Perch = {
  at: P; // the thorax, on screen
  scale: number; // px per plate unit, as everywhere in this movement
  face: number; // -1 the head points left, +1 right
  lean: number; // radians: the body's tilt, nose down into the flower
  open: number; // 0 wings shut over the back, 1 held half open
  proboscis: number; probTo?: P;
  grip: P[]; // where the feet are, on the petal
  seed?: number;
};

// Wings closed over the back. A closed wing is not a folded wing: you see its whole FACE, the
// underside, standing up over the body. So the outline is used exactly as authored and simply
// ROTATED about its own hinge until its long axis points up and back, with a little cross-wing
// foreshortening because the pair is not quite edge on to us. Folding the outline about its own
// midline instead (which is what an `abs()` in here would do) turns one wing into a symmetrical
// moth and is why the first attempt looked like a mosquito.
const stand = (wg: Wing, at: P, scale: number, face: number, lean: number, tipUp: number, off: P): ((p: P) => P) => {
  const a = -Math.PI / 2 - tipUp + lean, c = Math.cos(a), s = Math.sin(a);
  return (p: P): P => {
    const dx = (p[0] - wg.h[0]) * scale, dy = (p[1] - wg.h[1]) * scale * 0.84;
    return [at[0] + face * (dx * c - dy * s) + face * off[0] * scale, at[1] + (dx * s + dy * c) + off[1] * scale];
  };
};

export const drawLateral = (g: Gfx, pe: Perch) => {
  const { at, scale, face, lean, open } = pe, seed = pe.seed ?? 900, sc = scale * 90, r = rng(seed + 31);
  const lod = scale * 780;
  const HW_G = wingGeom(1, HW, HW_H, HW_T, 2600, REST), FW_G = wingGeom(1, FW, FW_H, FW_T, 1600, REST);

  // ---- the shadow it throws on the petal, before anything else
  g.fill(oval(at[0] - sc * 0.5 * face, at[1] + sc * 0.9, sc * 1.1, sc * 0.26, 10), "#6d7f55", 0.2);

  // ---- the far legs, then the wings, then the body, then the near legs: the stacking order is
  // the whole reason a lateral figure reads as a solid animal and not a sticker
  perchLegs(g, pe, sc, false);
  profileBody(g, pe, sc, lod, r); /* the body goes UNDER the wings: a closed pair covers most of the abdomen, and an abdomen left sticking out behind is a mosquito */
  wingFace(g, HW_G, false, stand(HW_G, at, scale, face, lean, -0.72 - open * 0.26, [-104, 16]), sc, lod, seed + 7, 0.9); /* the hindwing sits BEHIND, and its rounded margin projects below and behind the forewing */
  wingFace(g, FW_G, true, stand(FW_G, at, scale, face, lean, -0.42 + open * 0.3, [-66, -10]), sc, lod, seed + 11, 1);
  perchLegs(g, pe, sc, true);
  profileHead(g, pe, sc, lod);
};

// one wing, seen from UNDERNEATH, standing over the back
const wingFace = (g: Gfx, wg: Wing, fore: boolean, T: (p: P) => P, sc: number, lod: number, seed: number, front: number) => {
  const A = venation(wg, fore, seed), c0 = cen(wg.out), out = A.out.map(T);
  g.fill(dilate(A.out, 2).map(T), PAPER_W, 0.7); /* the paper is kept lighter under it */
  ps(g, out, U_GROUND, 0.92, seed + 1, sc * 1.3);
  ps(g, out.map((q) => lerp(q, cen(out), 0.2)), mixc(U_GROUND, PEACH, 0.5), 0.7, seed + 2, sc, false);
  ps(g, out.map((q) => lerp(q, T(wg.h), 0.3)), ROSE, 0.36, seed + 3, sc * 0.8, false); /* the rose of the upperside bleeds through at the wing root: one animal, two faces */
  // soft grey-olive marbling: the underside's whole character, and nothing on it has a hard edge
  for (let k = 0; k < 5; k++) { const rr = rng(seed + 20 + k), kk = 0.3 + rr() * 0.45, off: P = [(rr() - 0.5) * sc * 0.5, (rr() - 0.5) * sc * 0.5]; ps(g, out.map((z) => [cen(out)[0] + (z[0] - cen(out)[0]) * kk + off[0], cen(out)[1] + (z[1] - cen(out)[1]) * kk + off[1]] as P), rr() > 0.55 ? U_MARBLE : U_SHADE, 0.3 + rr() * 0.24, seed + 30 + k, sc * 0.7, false); }
  if (fore) { const apex = A.ends[Math.min(1, A.ends.length - 1)]; damp(g, [apex, lerp(apex, A.ends[0], 0.5), lerp(apex, c0, 0.34)].map(T), mixc(UMBER, U_MARBLE, 0.5), 0.3, seed + 40, sc * 0.5); }
  // the dark margin and the DOUBLE row of pale spots the reference shows on the underside
  if (lod > 120) {
    const inner = A.out.map((q) => lerp(q, c0, 0.11));
    damp(g, [...A.out, ...inner.slice().reverse()].map(T), mixc(BAND, U_SHADE, 0.05), 0.74, seed + 50, sc * 1.1);
    [0.14, 0.26].forEach((d, row) => A.ends.forEach((e, k) => { const q = T(lerp(e, c0, d)); ps(g, oval(q[0], q[1], sc * (0.026 - row * 0.006), sc * (0.022 - row * 0.005), 8), SPOT, 0.7 - row * 0.16, seed + 60 + row * 9 + k, sc * 0.09, false); }));
  }
  // the venation, which on an underside is the loudest thing on the wing
  A.veins.forEach((v, k) => rigger(g, v.pts.map(T), sc * 0.026 * v.w, U_VEIN, v.main ? 0.95 : 0.7, seed + 80 + k));
  if (lod > 120) A.out.forEach((q, k) => { const nx = q[0] - c0[0], ny = q[1] - c0[1], L = Math.hypot(nx, ny) || 1; g.fill(tube([T(q), T([q[0] + (nx / L) * A.span * 0.02, q[1] + (ny / L) * A.span * 0.02])], sc * 0.007, sc * 0.003, false), k % 2 ? SPOT : BAND, 0.55); }); /* the fringe */
  if (front > 0.95) lift(g, tube(out.slice(0, Math.ceil(out.length * 0.3)), sc * 0.045, sc * 0.025, false), seed + 90, 0.5);
};

// the body in profile: a furred thorax, a tapering segmented abdomen tucked down behind the wings
const profileBody = (g: Gfx, pe: Perch, sc: number, lod: number, r: () => number) => {
  const { at, face, lean, scale } = pe, c = Math.cos(lean), s = Math.sin(lean);
  const L = (x: number, y: number): P => [at[0] + face * (x * c - y * s) * scale, at[1] + (x * s + y * c) * scale];
  const thorax = [L(-34, -40), L(6, -46), L(38, -26), L(46, 8), L(30, 36), L(-4, 46), L(-38, 32), L(-52, -8)];
  ps(g, thorax, mixc(UMBER, "#4a3a2c", 0.3), 0.9, 421, sc * 0.5);
  ps(g, thorax.map((q) => lerp(q, L(14, -22), 0.5)), mixc(DUST, SPOT, 0.34), 0.42, 423, sc * 0.35, false); /* lit from the upper right */
  ps(g, thorax.map((q) => lerp(q, L(-12, 28), 0.55)), "#3b2f24", 0.34, 425, sc * 0.35, false); /* core shadow */
  ps(g, thorax.map((q) => lerp(q, L(-14, 38), 0.66)), mixc(DUST, "#8c7a63", 0.5), 0.24, 427, sc * 0.3, false); /* light bounced back up off the petal */
  const abd: P[] = []; for (let i = 0; i <= 6; i++) { const t = i / 6; abd.push(L(-36 - t * 104, 4 + t * 56)); } for (let i = 6; i >= 0; i--) { const t = i / 6; abd.push(L(-36 - t * 104, 58 + t * 26)); }
  ps(g, abd, mixc(UMBER, DUST, 0.26), 0.86, 430, sc * 0.4);
  for (let i = 1; i < 7; i++) { const t = i / 7; g.fill(tube([L(-36 - t * 104, 5 + t * 56), L(-36 - t * 104, 57 + t * 26)], sc * 0.012, sc * 0.012, false), mixc(DUST, SPOT, 0.45), 0.42); } /* the paler band at each joint, wrapping round the cylinder */
  ps(g, abd.map((q) => lerp(q, L(-110, 60), 0.42)), "#463628", 0.26, 432, sc * 0.35, false);
  if (lod > 120) for (let i = 0; i < 26; i++) { const t = r(), a = -1.5 + (r() - 0.5) * 1.4, p = L(-10 + (r() - 0.5) * 80, -40 + t * 84), len = sc * (0.09 + r() * 0.11); g.fill(tube([p, [p[0] + Math.cos(a) * len, p[1] + Math.sin(a) * len] as P], sc * 0.011, sc * 0.003, false), r() > 0.45 ? FUR : FUR_D, 0.4 + r() * 0.3); }
};

// the head in profile: one big compound eye, the palps in front of it, the antenna and the tube
const profileHead = (g: Gfx, pe: Perch, sc: number, lod: number) => {
  const { at, face, lean, scale } = pe, c = Math.cos(lean), s = Math.sin(lean);
  const L = (x: number, y: number): P => [at[0] + face * (x * c - y * s) * scale, at[1] + (x * s + y * c) * scale];
  ps(g, [L(40, -44), L(76, -34), L(86, -8), L(76, 16), L(46, 20), L(34, -14)], mixc(UMBER, "#493928", 0.35), 0.9, 440, sc * 0.3);
  if (lod > 120) {
    const e = L(66, -16);
    ps(g, oval(e[0], e[1], sc * 0.105, sc * 0.115, 13), EYE, 0.92, 442, sc * 0.22, false); /* one large compound eye, filling most of the head */
    ps(g, oval(e[0] - sc * 0.02, e[1] + sc * 0.025, sc * 0.072, sc * 0.078, 11), mixc(EYE, "#6a5a45", 0.42), 0.42, 444, sc * 0.16, false);
    g.fill(oval(e[0] + sc * 0.035, e[1] - sc * 0.04, sc * 0.024, sc * 0.02, 8), EYE_HI, 0.88);
    g.fill(tube([L(58, 14), L(84, 30), L(98, 50)], sc * 0.036, sc * 0.012, false), FUR, 0.9); /* the palps, forward and down, furry */
    g.fill(tube([L(74, 30), L(94, 46)], sc * 0.02, sc * 0.008, false), FUR_D, 0.7);
  }
  [0, 1].forEach((k) => { /* the antennae splay into a shallow V, finely ringed, clubbed */
    const a0 = L(64, -44), a1 = L(122, -116 - k * 18), a2 = L(196, -160 - k * 34);
    const pts = Array.from({ length: 9 }, (_, i) => { const t = i / 8; return lerp(lerp(a0, a1, t), lerp(a1, a2, t), t); });
    g.fill(tube(pts, sc * 0.024, sc * 0.01, false), mixc(EYE, UMBER, 0.3), 0.84);
    if (lod > 120) for (let i = 1; i < 8; i++) g.fill(tube([pts[i], lerp(pts[i], pts[i + 1], 0.45)], sc * 0.015, sc * 0.013, false), FUR, 0.4);
    const cl = pts[8], cb = pts[7];
    ps(g, oval(cl[0] + (cl[0] - cb[0]) * 0.3, cl[1] + (cl[1] - cb[1]) * 0.3, sc * 0.044, sc * 0.028, 9), mixc(EYE, UMBER, 0.2), 0.9, 450 + k, sc * 0.1, false);
  });
  // the proboscis: it leaves from BELOW the palps, and when it is out it is a fine curved tube
  const base = L(88, 38), tip: P = pe.probTo ?? [base[0], base[1] + sc * 0.9], p = pe.proboscis, spir: P[] = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24, a = 1.2 + t * 2.4 * Math.PI * 2, rr = sc * (0.016 + 0.07 * t);
    const coiled: P = [base[0] + Math.cos(a) * rr, base[1] + Math.sin(a) * rr];
    const bw = Math.sin(t * Math.PI) * sc * 0.26;
    const straight: P = [base[0] + (tip[0] - base[0]) * t + face * bw * 0.5, base[1] + (tip[1] - base[1]) * t + bw * 0.5];
    spir.push([coiled[0] + (straight[0] - coiled[0]) * p, coiled[1] + (straight[1] - coiled[1]) * p]);
  }
  g.fill(tube(spir, sc * 0.02, sc * 0.01, false), mixc(EYE, UMBER, 0.25), 0.78);
  if (p > 0.4) g.fill(tube(spir.map((q) => [q[0] + sc * 0.011, q[1] + sc * 0.005] as P), sc * 0.008, sc * 0.004, false), FUR, 0.3 * p);
};

// Six legs, reaching forward and down to GRIP. The far three are drawn before the wings and the
// near three after, which is what makes the figure sit on the flower rather than in front of it.
const perchLegs = (g: Gfx, pe: Perch, sc: number, near: boolean) => {
  const { at, face, lean, grip, scale } = pe, c = Math.cos(lean), s = Math.sin(lean), r = rng((pe.seed ?? 900) + (near ? 3 : 5));
  const L = (x: number, y: number): P => [at[0] + face * (x * c - y * s) * scale, at[1] + (x * s + y * c) * scale];
  ([[34, 30], [2, 42], [-34, 46]] as number[][]).forEach(([hx, hy], k) => {
    const hip = L(hx, hy), foot = grip[k % grip.length] ?? [hip[0] + sc * 0.3, hip[1] + sc * 0.7];
    const off = near ? sc * 0.06 : -sc * 0.08, fo: P = [foot[0] + off + (r() - 0.5) * sc * 0.12, foot[1] + (r() - 0.5) * sc * 0.08];
    const knee: P = [lerp(hip, fo, 0.45)[0] + face * sc * 0.16, lerp(hip, fo, 0.45)[1] - sc * 0.2]; /* the femur goes forward and UP, the tibia comes back down: that kink is the leg */
    const col = near ? LEG : mixc(LEG, "#3b2f24", 0.45);
    g.fill(tube([hip, knee], sc * 0.021, sc * 0.014, false), col, near ? 0.84 : 0.6);
    g.fill(tube([knee, fo], sc * 0.015, sc * 0.008, false), col, near ? 0.82 : 0.58);
    g.fill(tube([fo, [fo[0] + face * sc * 0.07, fo[1] + sc * 0.03] as P], sc * 0.009, sc * 0.004, false), mixc(col, EYE, 0.5), near ? 0.85 : 0.6); /* tarsus and its claw, bent over the petal */
    for (let i = 0; i < 3; i++) { const p = lerp(hip, knee, 0.3 + i * 0.25); g.fill(tube([p, [p[0] + (r() - 0.5) * sc * 0.05, p[1] - sc * 0.028] as P], sc * 0.0045, sc * 0.002, false), FUR_D, near ? 0.5 : 0.3); }
  });
};
