// THE HEAD, Loomis construction. A ball (the cranium) with the sides planed off, a jaw hung
// under it, and the features placed ON the surface of the face, so turning the head moves and
// foreshortens them the way a real face does: the far eye narrows, the mouth corner on the far
// side slides round the curve and then disappears, the nose breaks the profile.
//
// Reference opened: Loomis, "Drawing the Head and Hands" (1956) pp. 22-39 (ball, side planes,
// brow / nose / chin thirds, the eye line at half the head in adults); the age chart on p. 29 for
// the child's lower eye line and bigger cranium; Hogarth "Drawing the Human Head" for the jaw
// angle and the ear sitting between the brow line and the base of the nose.
//
// Head-local units: head heights (hh). Origin at chin level, x = her left, y = up, z = forward;
// z = 0 is the column of the ear holes.
import type { P } from "../../core";
import { Blob, Camera, Frame, V3, add, apply, blobPts, dot, mul, mv, norm, project, sub } from "../math3";
import type { BlobPart } from "../build";
import { ccw, hull } from "../shape2d";
import type { Mark, Part } from "../types";

export type Ell = { c: V3; r: V3 };
export type HeadSpec = {
  pivot: V3;                   // the atlas joint in head-local units (where the neck carries the head)
  skull: Ell[];                // hulled together: cranium, cheeks, jaw, chin
  nose: Ell[];                 // chained: a separate poly so the nose breaks the profile
  ear: Ell;                    // her left ear; the right is mirrored
  face: Ell;                   // the surface the features sit on
  eyeStyle: "bead" | "almond";
  eyeY: number; eyeX: number; eyeW: number; eyeH: number;
  browY: number; noseY: number; mouthY: number; mouthW: number;
  blush?: boolean; freckles?: [number, number][];
};

export const CHILD_HEAD: HeadSpec = {
  pivot: [0, 0.26, -0.06],
  skull: [{ c: [0, 0.6, -0.04], r: [0.43, 0.43, 0.46] }, { c: [0.2, 0.3, 0.14], r: [0.2, 0.2, 0.21] }, { c: [-0.2, 0.3, 0.14], r: [0.2, 0.2, 0.21] }, { c: [0, 0.09, 0.2], r: [0.14, 0.09, 0.14] }, { c: [0.1, 0.13, 0.18], r: [0.12, 0.1, 0.14] }, { c: [-0.1, 0.13, 0.18], r: [0.12, 0.1, 0.14] }],
  nose: [{ c: [0, 0.37, 0.39], r: [0.045, 0.05, 0.04] }, { c: [0, 0.32, 0.44], r: [0.05, 0.045, 0.045] }],
  ear: { c: [0.43, 0.42, -0.02], r: [0.05, 0.11, 0.08] },
  face: { c: [0, 0.42, -0.02], r: [0.42, 0.56, 0.44] },
  eyeStyle: "bead", eyeY: 0.44, eyeX: 0.155, eyeW: 0.047, eyeH: 0.062,
  browY: 0.575, noseY: 0.31, mouthY: 0.19, mouthW: 0.075, blush: true,
};
export const ADULT_HEAD: HeadSpec = {
  pivot: [0, 0.27, -0.06],
  skull: [
    { c: [0, 0.63, -0.05], r: [0.36, 0.41, 0.46] },
    { c: [0.25, 0.44, 0.18], r: [0.11, 0.1, 0.14] }, { c: [-0.25, 0.44, 0.18], r: [0.11, 0.1, 0.14] },   // cheekbones
    { c: [0.27, 0.15, 0.0], r: [0.09, 0.1, 0.1] }, { c: [-0.27, 0.15, 0.0], r: [0.09, 0.1, 0.1] },     // jaw angles: wide and low, a man's jaw
    { c: [0, 0.61, 0.35], r: [0.27, 0.05, 0.08] },                                                        // the brow ridge, over the eyes
    { c: [0, 0.2, 0.28], r: [0.15, 0.12, 0.11] },                                                        // the muzzle over the teeth
    { c: [0.045, 0.04, 0.3], r: [0.07, 0.06, 0.08] }, { c: [-0.045, 0.04, 0.3], r: [0.07, 0.06, 0.08] },   // a squared chin, two eminences
  ],
  nose: [{ c: [0, 0.54, 0.4], r: [0.03, 0.04, 0.03] }, { c: [0, 0.45, 0.44], r: [0.034, 0.05, 0.034] }, { c: [0, 0.36, 0.47], r: [0.042, 0.034, 0.034] }],
  ear: { c: [0.36, 0.43, -0.03], r: [0.045, 0.14, 0.085] },
  face: { c: [0, 0.45, -0.05], r: [0.34, 0.56, 0.46] },
  eyeStyle: "almond", eyeY: 0.5, eyeX: 0.138, eyeW: 0.066, eyeH: 0.026,
  browY: 0.6, noseY: 0.33, mouthY: 0.2, mouthW: 0.1,
};

// the expression parameters, all 0 at rest
export const EXPRESSION_KEYS = ["browRaise", "browFurrow", "browSad", "lidUpper", "lidLower", "cheek", "smile", "mouthOpen", "mouthWide", "lookX", "lookY"] as const;
export const EXPRESSIONS: Record<string, Record<string, number>> = {
  neutral: {},
  happy: { smile: 0.9, cheek: 0.6, lidLower: 0.25, browRaise: 0.2 },
  laughing: { smile: 1, cheek: 1, lidUpper: 1, mouthOpen: 0.75, mouthWide: 0.3, browRaise: 0.35 },
  surprised: { browRaise: 1, mouthOpen: 0.7, mouthWide: -0.5, lidUpper: -0.3 },
  worried: { browSad: 1, smile: -0.5, lookX: -0.5, lookY: -0.3, mouthWide: -0.2 },
  determined: { browFurrow: 1, lidUpper: 0.25, smile: -0.1, mouthWide: -0.3, lookX: 0.4 },
  curious: { browRaise: 0.6, browFurrow: 0.0, smile: 0.25, lookX: 0.6, lookY: 0.4, lidUpper: -0.1 },
};

export type HeadCtx = { f: Frame; hh: number; spec: HeadSpec; cam: Camera; M: (q: V3) => V3 };
export const headCtx = (head: Frame, hh: number, spec: HeadSpec, cam: Camera): HeadCtx => ({ f: head, hh, spec, cam, M: (q) => apply(head, mul(sub(q, spec.pivot), hh)) });

// head-local ellipsoid -> world blob
const toBlob = (h: HeadCtx, e: Ell, mirror = false): Blob => ({ c: h.M(mirror ? [-e.c[0], e.c[1], e.c[2]] : e.c), R: h.f.R, r: mul(e.r, h.hh) });

// a point ON the face at (x, y), its outward normal, and whether the camera can see it
export const onFace = (h: HeadCtx, x: number, y: number, lift = 0.004) => {
  const F = h.spec.face, u = (x - F.c[0]) / F.r[0], v = (y - F.c[1]) / F.r[1], w = Math.sqrt(Math.max(0, 1 - u * u - v * v));
  const local: V3 = [x, y, F.c[2] + F.r[2] * w], n0 = norm([u / F.r[0], v / F.r[1], w / F.r[2]]);
  const world = h.M(add(local, mul(n0, lift))), n = mv(h.f.R, n0), facing = dot(n, norm(sub(h.cam.eye, world)));
  const q = project(h.cam, world);
  return { p: [q.x, q.y] as P, facing, world };
};
// a polyline in face coordinates, split into the runs the camera can see
const faceRuns = (h: HeadCtx, pts: [number, number][], min = 0.05): P[][] => {
  const out: P[][] = []; let cur: P[] = [];
  pts.forEach(([x, y]) => { const f = onFace(h, x, y); if (f.facing > min) cur.push(f.p); else { if (cur.length > 1) out.push(cur); cur = []; } });
  if (cur.length > 1) out.push(cur);
  return out;
};
const ring = (cx: number, cy: number, rx: number, ry: number, n = 14, a0 = 0, a1 = Math.PI * 2): [number, number][] => Array.from({ length: n }, (_, i) => { const a = a0 + ((a1 - a0) * i) / (n - (a1 - a0 >= Math.PI * 2 - 1e-6 ? 0 : 1)); return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]; });
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clampE = (v: number) => Math.max(-1, Math.min(1, v));

// convex clip (Sutherland-Hodgman): the iris inside the lids
const clipConvex = (subject: P[], clip: P[]): P[] => {
  let out = subject; const n = clip.length, sgnA = Math.sign(clip.reduce((a, p, i) => { const q = clip[(i + 1) % n]; return a + p[0] * q[1] - q[0] * p[1]; }, 0)) || 1;
  for (let i = 0; i < n && out.length; i++) {
    const a = clip[i], b = clip[(i + 1) % n], inn = (p: P) => sgnA * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])) >= 0, inp = out; out = [];
    inp.forEach((p, k) => { const q = inp[(k + inp.length - 1) % inp.length], pi = inn(p), qi = inn(q); if (pi !== qi) { const d1 = (b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]), d2 = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]), t = d1 / (d1 - d2); out.push([q[0] + (p[0] - q[0]) * t, q[1] + (p[1] - q[1]) * t]); } if (pi) out.push(p); });
  }
  return out;
};

// every mark of the face, for this expression
export const faceMarks = (h: HeadCtx, ex: Record<string, number>, roles: { line: string; pupil: string; white: string; blush: string; brow: string; mouth: string; lip: string }, px: number): Mark[] => {
  const S = h.spec, E = (k: string) => ex[k] ?? 0, marks: Mark[] = [], w = Math.max(0.9, px * 0.018);
  const lookX = clampE(E("lookX")), lookY = clampE(E("lookY"));
  const vis = (x: number, y: number, k = 0.12) => onFace(h, x, y).facing > k;
  // --- brows: raise lifts them, furrow pulls the inner ends down and together, sad lifts the inner ends
  [-1, 1].forEach((s) => {
    const inner = s * S.eyeX * 0.42, outer = s * (S.eyeX + S.eyeW * 1.35), y0 = S.browY + E("browRaise") * 0.035;
    const pts: [number, number][] = Array.from({ length: 7 }, (_, i) => { const t = i / 6, x = lerp(inner - s * E("browFurrow") * 0.012, outer, t), arch = Math.sin(t * Math.PI * 0.9) * 0.018; return [x, y0 + arch + (1 - t) * (-E("browFurrow") * 0.03 + E("browSad") * 0.035) - t * E("browSad") * 0.01]; });
    if (S.eyeStyle === "bead") faceRuns(h, pts, 0.12).forEach((r) => marks.push({ kind: "line", pts: r, role: roles.brow, w: w * 1.5 }));
    else if (vis((inner + outer) / 2, y0, 0.15)) {
      // an adult brow has MASS: a band thick at its head by the nose, tapering to a fine tail
      const band = [...pts.map(([x, y], i) => [x, y + 0.013 * (1 - i / 7)] as [number, number]), ...pts.slice().reverse().map(([x, y], i) => [x, y - 0.009 * (i / 7) - 0.002] as [number, number])];
      marks.push({ kind: "fill", pts: band.map(([x, y]) => onFace(h, x, y).p), role: roles.brow, alpha: 0.85 });
    }
  });
  // --- eyes
  [-1, 1].forEach((s) => {
    const cx = s * S.eyeX, cy = S.eyeY, c = onFace(h, cx, cy);
    if (c.facing < 0.12) return;
    const lid = Math.max(-0.4, Math.min(1, E("lidUpper"))), low = Math.max(0, Math.min(1, E("lidLower") + E("cheek") * 0.35));
    if (S.eyeStyle === "bead") {
      if (lid > 0.85) { // closed: a happy arch if smiling, a flat lash line if not
        const up = E("smile") > 0.2 ? 1 : 0;
        faceRuns(h, ring(cx, cy - S.eyeH * 0.1, S.eyeW * 1.15, S.eyeH * (up ? 0.55 : 0.12), 9, Math.PI * 1.02, Math.PI * 1.98).map(([x, y]) => [x, cy - (y - cy) * (up ? 1 : -1)] as [number, number]), 0.1).forEach((r) => marks.push({ kind: "line", pts: r, role: roles.line, w: w * 2 }));
        return;
      }
      const ry = S.eyeH * (1 - Math.max(0, lid) * 0.75) * (1 - low * 0.35) * (1 + Math.max(0, -lid) * 0.25), ox = lookX * S.eyeW * 0.25, oy = lookY * S.eyeH * 0.18;
      const shape = ring(cx + ox, cy + oy - (S.eyeH - ry) * 0.5 * Math.sign(lid), S.eyeW, ry, 16).map(([x, y]) => onFace(h, x, y).p);
      marks.push({ kind: "fill", pts: shape, role: roles.pupil });
      const hi = onFace(h, cx + ox - S.eyeW * 0.32, cy + oy + ry * 0.36), hi2 = onFace(h, cx + ox + S.eyeW * 0.38, cy + oy - ry * 0.4);
      const k = project(h.cam, c.world).s * h.hh;
      marks.push({ kind: "dot", at: hi.p, rx: S.eyeW * 0.36 * k * Math.max(0.5, c.facing), ry: S.eyeW * 0.36 * k, rot: 0, role: roles.white });
      marks.push({ kind: "dot", at: hi2.p, rx: S.eyeW * 0.16 * k * Math.max(0.5, c.facing), ry: S.eyeW * 0.16 * k, rot: 0, role: roles.white, alpha: 0.85 });
      // the upper lid, a short lash stroke over the eye (children's eyes read bigger with it)
      faceRuns(h, ring(cx, cy + ry * 0.2, S.eyeW * 1.28, ry * 1.25, 7, Math.PI * 0.18, Math.PI * 0.82).map(([x, y]) => [x, 2 * cy - y + ry * 0.4] as [number, number]), 0.12).forEach((r) => marks.push({ kind: "line", pts: r, role: roles.line, w: w * 1.2, alpha: 0.7 }));
    } else {
      // almond: inner corner low and round, the upper lid peaks a third of the way out, the lower lid is flatter and peaks further out
      const inner = cx - s * S.eyeW * 0.95, outer = cx + s * S.eyeW * 1.0, open = S.eyeH * (1 - Math.max(0, lid) * 0.9) * (1 + Math.max(0, -lid) * 0.35);
      const up: [number, number][] = Array.from({ length: 9 }, (_, i) => { const t = i / 8, x = lerp(inner, outer, t), b = Math.sin(Math.pow(t, 0.8) * Math.PI); return [x, cy + 0.002 + open * b * 0.95 - t * 0.004]; });
      const lo: [number, number][] = Array.from({ length: 9 }, (_, i) => { const t = 1 - i / 8, x = lerp(inner, outer, t), b = Math.sin(Math.pow(t, 1.25) * Math.PI); return [x, cy - open * b * (0.62 - low * 0.35) - t * 0.004 + low * 0.006]; });
      const open2D = [...up, ...lo].map(([x, y]) => onFace(h, x, y).p);
      marks.push({ kind: "fill", pts: open2D, role: roles.white, alpha: 0.9 });
      const ir = S.eyeH * 0.95, ix = cx + lookX * S.eyeW * 0.35, iy = cy + open * 0.35 + lookY * open * 0.3;
      const iris = clipConvex(ring(ix, iy, ir, ir, 16).map(([x, y]) => onFace(h, x, y).p), open2D.length > 2 ? convexify(open2D) : open2D);
      if (iris.length > 2) marks.push({ kind: "fill", pts: iris, role: roles.pupil, alpha: 0.85 });
      const pup = clipConvex(ring(ix, iy, ir * 0.42, ir * 0.42, 10).map(([x, y]) => onFace(h, x, y).p), convexify(open2D));
      if (pup.length > 2) marks.push({ kind: "fill", pts: pup, role: roles.line });
      faceRuns(h, up, 0.1).forEach((r) => marks.push({ kind: "line", pts: r, role: roles.line, w: w * 1.5 }));
      faceRuns(h, lo, 0.1).forEach((r) => marks.push({ kind: "line", pts: r, role: roles.line, w: w * 0.7, alpha: 0.6 }));
      // the lid crease, following the upper lid a little higher
      faceRuns(h, up.slice(1, 8).map(([x, y]) => [x, y + 0.016 + E("browRaise") * 0.006] as [number, number]), 0.12).forEach((r) => marks.push({ kind: "line", pts: r, role: roles.line, w: w * 0.8, alpha: 0.55 }));
    }
  });
  // --- nose
  if (S.eyeStyle === "bead") {
    faceRuns(h, ring(0, S.noseY + 0.02, 0.028, 0.022, 7, Math.PI * 0.15, Math.PI * 0.85).map(([x, y]) => [x, 2 * (S.noseY + 0.02) - y] as [number, number]), 0.2).forEach((r) => marks.push({ kind: "line", pts: r, role: roles.line, w: w * 1.2, alpha: 0.75 }));
  } else {
    [-1, 1].forEach((s) => faceRuns(h, ring(s * 0.036, S.noseY + 0.006, 0.02, 0.016, 7, s > 0 ? -0.6 : Math.PI - 1.9, s > 0 ? 1.9 : Math.PI + 0.6), 0.15).forEach((r) => marks.push({ kind: "line", pts: r, role: roles.line, w: w * 1.1, alpha: 0.8 })));
    // the bridge, on the side turned from the light
    faceRuns(h, [[-0.035, 0.53], [-0.038, 0.46], [-0.04, 0.4], [-0.036, 0.355]], 0.15).forEach((r) => marks.push({ kind: "line", pts: r, role: roles.line, w: w * 0.7, alpha: 0.4 }));
  }
  // --- mouth
  const mw = S.mouthW * (1 + E("mouthWide") * 0.35 + Math.max(0, E("smile")) * 0.15), sm = E("smile"), op = Math.max(0, E("mouthOpen"));
  const upper: [number, number][] = Array.from({ length: 11 }, (_, i) => { const t = -1 + (2 * i) / 10; return [t * mw, S.mouthY + sm * 0.032 * t * t - (S.eyeStyle === "almond" ? 0.004 * Math.cos(t * Math.PI * 1.5) * (1 - Math.abs(t)) : 0) + op * 0.012]; });
  if (op > 0.05) {
    const lower = [...upper].reverse().map(([x, y]) => { const t = x / mw; return [x, y - op * 0.085 * (1 - t * t) * (sm > 0.3 ? 1.1 : 1) - op * 0.012] as [number, number]; });
    const shape = [...upper, ...lower].map(([x, y]) => onFace(h, x, y).p);
    if (vis(0, S.mouthY, 0.1)) {
      marks.push({ kind: "fill", pts: shape, role: roles.mouth, line: w * 1.4, tag: "mouth" });
      const tongue = lower.slice(2, 9).map(([x, y]) => [x * 0.8, y + 0.012] as [number, number]);
      marks.push({ kind: "fill", pts: [...tongue, ...tongue.slice().reverse().map(([x, y]) => [x, y + op * 0.022] as [number, number])].map(([x, y]) => onFace(h, x, y).p), role: roles.lip, alpha: 0.9, tag: "mouth" });
    }
  } else {
    faceRuns(h, upper, 0.12).forEach((r) => marks.push({ kind: "line", pts: r, role: roles.line, w: w * (S.eyeStyle === "bead" ? 1.7 : 1.3), tag: "mouth" }));
    if (S.eyeStyle === "almond" && vis(0, S.mouthY, 0.12)) {
      // the lips: an upper lip with a cupid's bow and two peaks under the philtrum, a fuller lower lip, the shadow under it
      const top = Array.from({ length: 13 }, (_, i) => { const t = -1 + (2 * i) / 12; return [t * mw * 1.02, S.mouthY + sm * 0.032 * t * t + 0.02 * Math.pow(1 - t * t, 0.55) - 0.008 * Math.exp(-((t / 0.13) ** 2))] as [number, number]; });
      const bot = Array.from({ length: 13 }, (_, i) => { const t = 1 - (2 * i) / 12; return [t * mw * 0.96, S.mouthY + sm * 0.03 * t * t - 0.028 * Math.pow(1 - t * t, 0.7)] as [number, number]; });
      marks.push({ kind: "fill", pts: [...top, ...upper.slice().reverse()].map(([x, y]) => onFace(h, x, y).p), role: roles.lip, alpha: 0.55, tag: "mouth" });
      marks.push({ kind: "fill", pts: [...upper, ...bot].map(([x, y]) => onFace(h, x, y).p), role: roles.lip, alpha: 0.32, tag: "mouth" });
      faceRuns(h, top.slice(2, 11), 0.12).forEach((r) => marks.push({ kind: "line", pts: r, role: roles.line, w: w * 0.6, alpha: 0.35 }));
      faceRuns(h, Array.from({ length: 5 }, (_, i) => [(-0.5 + i / 4) * mw * 0.7, S.mouthY - 0.042] as [number, number]), 0.12).forEach((r) => marks.push({ kind: "line", pts: r, role: roles.line, w: w * 0.9, alpha: 0.4 }));
      [-1, 1].forEach((s) => faceRuns(h, [[s * 0.018, S.noseY - 0.035], [s * 0.022, S.mouthY + 0.03]], 0.2).forEach((r) => marks.push({ kind: "line", pts: r, role: roles.line, w: w * 0.5, alpha: 0.25 })));
    }
  }
  // dimples at the corners when she smiles
  if (sm > 0.4 && S.eyeStyle === "bead") [-1, 1].forEach((s) => faceRuns(h, [[s * (mw + 0.012), S.mouthY + sm * 0.04], [s * (mw + 0.02), S.mouthY + sm * 0.022]], 0.15).forEach((r) => marks.push({ kind: "line", pts: r, role: roles.line, w: w * 1.1, alpha: 0.7 })));
  // --- cheeks and freckles
  if (S.blush) [-1, 1].forEach((s) => { const c = onFace(h, s * 0.235, 0.3 + E("cheek") * 0.02); if (c.facing > 0.2) { const k = project(h.cam, c.world).s * h.hh; marks.push({ kind: "dot", at: c.p, rx: 0.075 * k * Math.max(0.35, c.facing), ry: 0.045 * k, rot: 0, role: roles.blush, alpha: 0.55 }); } });
  (S.freckles ?? []).forEach(([x, y]) => { const c = onFace(h, x, y); if (c.facing > 0.25) { const k = project(h.cam, c.world).s * h.hh; marks.push({ kind: "dot", at: c.p, rx: 0.008 * k * c.facing, ry: 0.008 * k, rot: 0, role: roles.brow, alpha: 0.7 }); } });
  return marks;
};
const convexify = (pts: P[]): P[] => { // the hull, in the same winding as the input
  const s = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]), x = (o: P, a: P, b: P) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo: P[] = [], hi: P[] = [];
  for (const p of s) { while (lo.length >= 2 && x(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = s.length - 1; i >= 0; i--) { const p = s[i]; while (hi.length >= 2 && x(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
  return [...lo.slice(0, -1), ...hi.slice(0, -1)];
};

// the head's volumes as parts: skull + nose (one part), and the two ears
export const headParts = (h: HeadCtx, skinRole: string, id = "head"): BlobPart[] => {
  const S = h.spec;
  const adult = S.eyeStyle === "almond";
  // the ear's rim (helix) and bowl (concha), drawn when the ear turns toward us
  const earMarks = (s: 1 | -1) => (cam: Camera): Mark[] => {
    const e = S.ear, c: V3 = [s * e.c[0], e.c[1], e.c[2]], n = mv(h.f.R, [s, 0, 0.3]), w = h.M(c);
    if (!adult || dot(norm(n), norm(sub(cam.eye, w))) < 0.2) return [];
    const P = (q: V3): P => { const r = project(cam, h.M(q)); return [r.x, r.y]; }, px = project(cam, w).s * h.hh, lw = Math.max(0.7, px * 0.012);
    const helix = Array.from({ length: 9 }, (_, i) => { const a = -0.3 + (i / 8) * Math.PI * 1.15; return P([s * (e.c[0] + e.r[0] * 0.9), e.c[1] + Math.sin(a) * e.r[1] * 0.72, e.c[2] - Math.cos(a) * e.r[2] * 0.7]); });
    const concha = Array.from({ length: 7 }, (_, i) => { const a = Math.PI * 0.2 + (i / 6) * Math.PI * 1.1; return P([s * (e.c[0] + e.r[0] * 0.9), e.c[1] - 0.02 + Math.sin(a) * e.r[1] * 0.3, e.c[2] - Math.cos(a) * e.r[2] * 0.3 + 0.01]); });
    return [{ kind: "line", pts: helix, role: "line", w: lw, alpha: 0.5 }, { kind: "line", pts: concha, role: "line", w: lw, alpha: 0.4 }];
  };
  const ear = (s: 1 | -1): BlobPart => ({ id: s > 0 ? "earL" : "earR", role: skinRole, groups: [{ blobs: [toBlob(h, S.ear, s < 0)], mode: "each" }], depthBias: 0.004 * h.hh / 0.25, seams: [], marksFn: earMarks(s) });
  const skull: BlobPart = { id, role: skinRole, over: ["neck", "neckSkin"], groups: [{ blobs: S.skull.map((e) => toBlob(h, e)), mode: "hull" }, ...(adult ? [] : [{ blobs: S.nose.map((e) => toBlob(h, e)), mode: "chain" as const }])], depthAt: h.M([0, 0.5, 0]) };
  if (!adult) return [skull, ear(1), ear(-1)];
  // An adult nose is its own form: a bridge, a ball, wings. It is drawn as a draftsman draws it,
  // by its FAR edge only (the line against the far cheek); in profile that edge is the whole nose.
  const nose: BlobPart = {
    id: "nose", role: skinRole, groups: [{ blobs: S.nose.map((e) => toBlob(h, e)), mode: "chain" }, { blobs: [-1, 1].map((s) => toBlob(h, { c: [s * 0.033, 0.345, 0.43], r: [0.022, 0.02, 0.024] })), mode: "each" }],
    over: [id], depthAt: h.M([0, 0.42, 0.3]),
    keepLineFn: (cam) => {
      const tip = project(cam, h.M([0, 0.36, 0.48])), root = project(cam, h.M([0, 0.4, 0])), dx = tip.x - root.x, dy = tip.y - root.y, L = Math.hypot(dx, dy), hs = project(cam, h.M([0, 0.4, 0])).s * h.hh;
      if (L < hs * 0.12) return () => false;       // straight on: the nose is its tip and wings, no contour
      const ux = dx / L, uy = dy / L; return (p: P) => (p[0] - tip.x) * ux + (p[1] - tip.y) * uy > -hs * 0.05 - (L / hs) * hs * 0.1;
    },
  };
  return [skull, nose, ear(1), ear(-1)];
};
// A SHORT-HAIR CAP with no authored drawing. The cranium, inflated by the hair's thickness,
// projected to its silhouette; then clipped to the region above the VISIBLE stretch of the
// hairline (a loop from the brow, over the ear, to the nape). A convex hull of the hair would be
// wrong: from the front, the nape projects over the mouth.
export const hairCap = (h: HeadCtx, role: string, o: { lift?: number; front?: number; side?: number; back?: number; sideburn?: number; volume?: Ell[] } = {}): Part => {
  const c = h.spec.skull[0], lift = o.lift ?? 0.03, front = o.front ?? 0.82, side = o.side ?? 0.6, back = o.back ?? 0.3;
  const R: V3 = [c.r[0] + lift, c.r[1] + lift, c.r[2] + lift];
  const sil = hull(blobPts(h.cam, { c: h.M(c.c), R: h.f.R, r: mul(R, h.hh) }));
  const N = 72, loop = Array.from({ length: N }, (_, j) => {
    const th = (j / N) * Math.PI * 2, zf = Math.cos(th), yl0 = zf > 0 ? lerp(side, front, zf ** 1.6) : lerp(side, back, (-zf) ** 0.45), yl = yl0 - (o.sideburn ?? 0) * Math.exp(-(((Math.abs(Math.sin(th)) - 0.97) / 0.05) ** 2)) * (zf > 0 ? 1 : 0); // a sideburn dips in front of the ear
    const v = Math.max(-0.999, Math.min(0.999, (yl - c.c[1]) / R[1])), rr = Math.sqrt(1 - v * v);
    const q: V3 = [c.c[0] + Math.sin(th) * R[0] * rr, yl, c.c[2] + Math.cos(th) * R[2] * rr], n0 = norm([(q[0] - c.c[0]) / R[0] ** 2, (q[1] - c.c[1]) / R[1] ** 2, (q[2] - c.c[2]) / R[2] ** 2]);
    const w = h.M(q), f = dot(mv(h.f.R, n0), norm(sub(h.cam.eye, w))), pq = project(h.cam, w);
    return { p: [pq.x, pq.y] as P, f };
  });
  // the longest run of visible loop points (it wraps)
  let best: number[] = [], cur: number[] = [];
  for (let k = 0; k < N * 2; k++) { const j = k % N; if (loop[j].f > 0) { cur.push(j); if (cur.length > best.length && cur.length <= N) best = [...cur]; } else cur = []; }
  const b = sil.reduce((a, p) => ({ x0: Math.min(a.x0, p[0]), y0: Math.min(a.y0, p[1]), x1: Math.max(a.x1, p[0]), y1: Math.max(a.y1, p[1]) }), { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 });
  let poly: P[] = sil;
  if (best.length > 1 && best.length < N) {
    // close the region over the top of the head, outward from each end of the visible arc
    const arc = best.map((j) => loop[j].p), a0 = arc[0], a1 = arc[arc.length - 1], big = (b.x1 - b.x0) * 2, s0 = a0[0] < a1[0] ? -1 : 1;
    const region: P[] = [...arc, [a1[0] - s0 * big, a1[1]], [a1[0] - s0 * big, b.y0 - big], [a0[0] + s0 * big, b.y0 - big], [a0[0] + s0 * big, a0[1]]];
    poly = clipConvex(region, ccw(sil));
  }
  const d = project(h.cam, h.M([0, 0.62, -0.02]));
  return { id: "hair", role, depth: d.z - h.hh * 0.02, polys: [...(poly.length > 2 ? [ccw(poly)] : []), ...(o.volume ?? []).map((e) => ccw(hull(blobPts(h.cam, { c: h.M(e.c), R: h.f.R, r: mul(e.r, h.hh) }))))], size: h.hh * 0.2 * d.s, marks: [], over: ["head", "earL", "earR"], feature: "hair" };
};
