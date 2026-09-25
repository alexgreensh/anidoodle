// HANDS. A hand skeleton, not a mitten: 5 digits, 14 phalanges, the metacarpal knuckle ARC
// (middle knuckle most distal, little finger's far back), finger lengths in their true order
// (middle > ring >= index > little), and a thumb that leaves the wrist, not the palm, and
// OPPOSES by swinging in front of the palm while turning its pad toward the fingers.
//
// Reference opened: Gray's Anatomy fig. 219-220 (bones of the left hand, dorsal and palmar);
// Buchholz & Armstrong (1992) "A kinematic model of the human hand" for segment-length ratios
// (proximal : middle : distal about 1 : 0.65 : 0.48 for the middle finger); Hogarth "Drawing
// Dynamic Hands" for the wedge-and-block construction and the knuckle arc.
//
// Canonical frame: the LEFT hand, arm hanging. Distal = -y, palm normal = -x (toward the body),
// thumb side = +z (forward). The right hand is the mirror (x -> -x). Units: hand length Lh
// (wrist crease to middle fingertip).
import { Blob, DEG, Frame, M3, MIRROR_X, V3, add, apply, cross, mix3, mm, mv, norm, rx, ry, rz, I3 } from "../math3";

export type Digit = "thumb" | "index" | "middle" | "ring" | "little";
export const DIGITS: Digit[] = ["thumb", "index", "middle", "ring", "little"];
export type HandAngles = Record<Digit, [number, number, number, number]>; // fingers: [spread, mcp, pip, dip]; thumb: [abd, opp, mcp, ip]

type FingerSpec = { mcp: V3; len: [number, number, number]; r: number; spreadDir: number };
export const FINGERS: Record<Exclude<Digit, "thumb">, FingerSpec> = {
  // knuckle positions trace the arc: middle furthest out, little finger well back
  index: { mcp: [-0.012, -0.452, 0.128], len: [0.225, 0.14, 0.105], r: 0.05, spreadDir: -1 },
  middle: { mcp: [0.0, -0.47, 0.042], len: [0.245, 0.16, 0.12], r: 0.052, spreadDir: 0 },
  ring: { mcp: [-0.006, -0.456, -0.046], len: [0.232, 0.152, 0.11], r: 0.048, spreadDir: 1 },
  little: { mcp: [-0.02, -0.415, -0.128], len: [0.182, 0.112, 0.096], r: 0.041, spreadDir: 1.35 },
};
export const THUMB = { cmc: [-0.035, -0.07, 0.1] as V3, len: [0.225, 0.155, 0.13] as [number, number, number], r: 0.062 };

// finger-joint limits (degrees): MCP flexes 90 and hyperextends ~20; PIP 110; DIP 80
export const HAND_LIMITS = { spread: [-15, 25], mcp: [-20, 90], pip: [0, 110], dip: [-5, 80], abd: [0, 70], opp: [0, 80], tmcp: [-10, 60], ip: [-15, 80] };
export const handViolations = (a: HandAngles, tag: string): string[] => {
  const out: string[] = [], L = HAND_LIMITS;
  DIGITS.forEach((d) => {
    const v = a[d]; if (!v || v.length !== 4) { out.push(`${tag} ${d}: missing`); return; }
    const lims = d === "thumb" ? [L.abd, L.opp, L.tmcp, L.ip] : [L.spread, L.mcp, L.pip, L.dip], names = d === "thumb" ? ["abd", "opp", "mcp", "ip"] : ["spread", "mcp", "pip", "dip"];
    v.forEach((x, i) => { if (x < lims[i][0] || x > lims[i][1]) out.push(`${tag} ${d}.${names[i]} = ${x} outside ${lims[i][0]}..${lims[i][1]}`); });
  });
  return out;
};

// ---------------------------------------------------------------- the pose library (joint angles, never pixels)
const F = (s: number, m: number, p: number, d: number): [number, number, number, number] => [s, m, p, d];
export const HAND_POSES: Record<string, HandAngles> = {
  // hanging at rest: each finger a little more curled than the one before it (the cascade)
  relaxed: { thumb: F(10, 15, 10, 12), index: F(2, 14, 22, 10), middle: F(0, 20, 30, 14), ring: F(2, 26, 36, 18), little: F(4, 32, 40, 22) },
  open: { thumb: F(52, 8, 0, -5), index: F(10, 0, 2, 0), middle: F(0, 0, 2, 0), ring: F(8, 0, 3, 0), little: F(14, 0, 4, 2) },
  point: { thumb: F(12, 44, 30, 28), index: F(0, 0, 2, 0), middle: F(0, 86, 100, 55), ring: F(2, 88, 102, 58), little: F(3, 90, 100, 60) },
  fist: { thumb: F(10, 52, 30, 26), index: F(0, 86, 100, 62), middle: F(0, 88, 102, 62), ring: F(2, 90, 102, 62), little: F(3, 90, 100, 60) },
  // closed around a cylinder about 0.3 Lh across (a mug, a tool handle)
  grip: { thumb: F(30, 58, 20, 22), index: F(0, 52, 62, 32), middle: F(0, 56, 66, 34), ring: F(2, 60, 68, 36), little: F(4, 64, 70, 38) },
  // thumb pad meets index pad; the rest fall away in a cascade
  pinch: { thumb: F(34, 52, 20, 16), index: F(-2, 50, 56, 18), middle: F(2, 40, 50, 20), ring: F(4, 44, 56, 24), little: F(6, 50, 60, 28) },
  // a wave: open, fingers a touch back, fanned wider toward the little finger
  wave: { thumb: F(46, 10, 4, -2), index: F(8, -8, 4, 0), middle: F(0, -8, 4, 0), ring: F(10, -6, 5, 2), little: F(18, -4, 6, 2) },
};
export const resolveHand = (h: string | Record<string, number> | { angles: Record<string, [number, number, number, number]> } | undefined): HandAngles => {
  if (h && typeof h === "object" && "angles" in h) return h.angles as HandAngles;
  if (!h) return HAND_POSES.relaxed;
  if (typeof h === "string") { const p = HAND_POSES[h]; if (!p) throw new Error(`unknown hand pose '${h}' (have ${Object.keys(HAND_POSES).join(", ")})`); return p; }
  // an object: blend two named poses {a: "fist", b: "point", t: 0.5} is spelled {fist: 0.5, point: 0.5}
  const acc = { thumb: [0, 0, 0, 0], index: [0, 0, 0, 0], middle: [0, 0, 0, 0], ring: [0, 0, 0, 0], little: [0, 0, 0, 0] } as unknown as HandAngles; let tot = 0;
  for (const [name, w] of Object.entries(h as Record<string, number>)) { const p = HAND_POSES[name]; if (!p) throw new Error(`unknown hand pose '${name}'`); tot += w; DIGITS.forEach((d) => p[d].forEach((v, i) => (acc[d][i] += v * w))); }
  DIGITS.forEach((d) => acc[d].forEach((_, i) => (acc[d][i] /= tot || 1)));
  return acc;
};

// ---------------------------------------------------------------- forward kinematics of the hand
export type HandJoints = { digit: Digit; pts: V3[]; radii: number[]; frames: Frame[] }; // pts: base, joint, joint, tip
export type HandModel = { palm: Blob[]; digits: HandJoints[]; nails: { digit: Digit; c: V3; R: M3; w: number; l: number }[]; mcpArc: V3[] };

export const handModel = (wrist: Frame, side: "L" | "R", Lh: number, ang: HandAngles, girth = 1): HandModel => {
  const M = side === "L" ? I3 : MIRROR_X;
  // express a canonical-left local point/rotation in the world
  const W = (p: V3): V3 => apply(wrist, mv(M, p.map((v) => v * Lh) as V3));
  const WR = (R: M3): M3 => mm(wrist.R, mm(M, mm(R, M)));
  const digits: HandJoints[] = [], nails: HandModel["nails"] = [];
  (Object.keys(FINGERS) as Exclude<Digit, "thumb">[]).forEach((d) => {
    const s = FINGERS[d], [sp, m, p, q] = ang[d];
    // flexed fingers converge toward the middle finger (their tips point at the scaphoid)
    const conv = -Math.sign(s.spreadDir) * Math.min(m, 80) * 0.06;
    // spread: index toward +z (radial), ring/little toward -z (ulnar); flexing pulls them together
    const R: M3 = mm(rx(((s.spreadDir < 0 ? -sp : s.spreadDir > 0 ? sp : 0) + conv) * DEG), rz(-m * DEG));
    let pos: V3 = s.mcp; const pts: V3[] = [W(pos)], frames: Frame[] = [], radii = [s.r * girth, s.r * 0.9 * girth, s.r * 0.8 * girth, s.r * 0.72 * girth];
    const bends = [0, p, q];
    let Rc: M3 = R;
    for (let k = 0; k < 3; k++) {
      if (k) Rc = mm(Rc, rz(-bends[k] * DEG));
      frames.push({ p: W(pos), R: WR(Rc) });
      pos = add(pos, mv(Rc, [0, -s.len[k], 0]));
      pts.push(W(pos));
    }
    // the fingertip pad sits a hair short of the bone end: pull the last point back by the radius
    digits.push({ digit: d, pts, radii: radii.map((r) => r * Lh), frames });
    // the nail: on the dorsal (+x) face of the distal phalanx, toward its tip
    const last = frames[2];
    nails.push({ digit: d, c: apply(last, mv(M, [s.r * 0.8 * Lh, -s.len[2] * 0.6 * Lh, 0])), R: last.R, w: s.r * 1.25 * Lh, l: s.len[2] * 0.55 * Lh });
  });
  // the thumb: a rest frame pointing distal, radial and a little palmar; abduction swings it off
  // the index, opposition carries it round in FRONT of the palm (toward -x) and turns the pad
  // f0 = the way the thumb curls: toward the palm (-x) and across it (-z), square to d0
  const [abd, opp, tm, ip] = ang.thumb, d0 = norm([-0.22, -0.8, 0.52]), f0 = norm(cross(cross(d0, norm([-0.8, 0, -0.6])), d0) as V3);
  // a frame whose -y is d0 and whose -x is f0, so the same rz(-bend) curls it as it curls a finger
  const colX: V3 = [-f0[0], -f0[1], -f0[2]], colY: V3 = [-d0[0], -d0[1], -d0[2]], colZ = norm(cross(colX, colY));
  const B: M3 = [colX[0], colY[0], colZ[0], colX[1], colY[1], colZ[1], colX[2], colY[2], colZ[2]];
  let R: M3 = mm(ry(-opp * DEG), mm(rx(-abd * DEG), B));
  let pos: V3 = THUMB.cmc; const tp: V3[] = [W(pos)], tf: Frame[] = [], tl: V3[] = [pos];
  const tb = [0, tm, ip];
  for (let k = 0; k < 3; k++) {
    if (k) R = mm(R, rz(-tb[k] * DEG));
    tf.push({ p: W(pos), R: WR(R) });
    pos = add(pos, mv(R, [0, -THUMB.len[k], 0]));
    tp.push(W(pos)); tl.push(pos);
  }
  const tr0 = THUMB.r * girth;
  digits.unshift({ digit: "thumb", pts: tp, radii: [tr0 * 1.35, tr0 * 1.02, tr0 * 0.97, tr0 * 0.9].map((r) => r * Lh), frames: tf });
  nails.unshift({ digit: "thumb", c: apply(tf[2], mv(M, [0.05 * Lh, -THUMB.len[2] * 0.62 * Lh, 0])), R: tf[2].R, w: THUMB.r * 1.2 * Lh, l: THUMB.len[2] * 0.55 * Lh });
  const blob = (c: V3, r: V3): Blob => ({ c: W(c), R: WR(I3), r: r.map((v) => v * Lh * girth) as V3 });
  const palm = [
    blob([0.004, -0.05, 0.0], [0.07, 0.07, 0.17]),       // heel of the hand, over the carpals
    blob([0.0, -0.25, -0.005], [0.07, 0.2, 0.215]),          // the palm block
    blob([0.006, -0.44, -0.005], [0.06, 0.085, 0.205]),  // the knuckle row, and the web of skin that runs a third of the way up the fingers
    blob([-0.022, -0.22, -0.12], [0.06, 0.17, 0.075]),   // hypothenar pad, little-finger side
    blob(mix3(tl[0], tl[1], 0.45), [0.085, 0.085, 0.085]),  // the thenar eminence: the thumb's metacarpal is buried in it, the thumb only leaves the palm at its MCP
    blob(mix3(tl[0], tl[1], 0.8), [0.066, 0.066, 0.066]),
  ];
  return { palm, digits, nails, mcpArc: (["index", "middle", "ring", "little"] as const).map((d) => W(FINGERS[d].mcp)) };
};

// The pinch is SOLVED, not typed: thumb pad pulled onto index pad (tips meet, radii touching),
// inside every joint limit. Deterministic coordinate descent, once, at load.
const solvePinch = (start: HandAngles): HandAngles => {
  const id: Frame = { p: [0, 0, 0], R: I3 }, a: HandAngles = JSON.parse(JSON.stringify(start));
  const cost = (h: HandAngles) => { const m = handModel(id, "L", 1, h), t = m.digits[0], i = m.digits[1], d = Math.hypot(t.pts[3][0] - i.pts[3][0], t.pts[3][1] - i.pts[3][1], t.pts[3][2] - i.pts[3][2]) - (t.radii[3] + i.radii[3]) * 0.85; return d * d + handViolations(h, "").length; };
  let e = cost(a), step = 8;
  for (let it = 0; it < 80 && step > 0.1; it++) {
    let imp = false;
    for (const [dg, k] of [["thumb", 0], ["thumb", 1], ["thumb", 2], ["thumb", 3], ["index", 1], ["index", 2], ["index", 3]] as [Digit, number][]) for (const s of [1, -1]) { const t: HandAngles = JSON.parse(JSON.stringify(a)); t[dg][k] += s * step; const et = cost(t); if (et < e) { e = et; Object.assign(a, t); imp = true; } }
    if (!imp) step *= 0.5;
  }
  return a;
};
HAND_POSES.pinch = solvePinch(HAND_POSES.pinch);
