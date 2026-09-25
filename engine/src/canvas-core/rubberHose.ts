import { Gfx, PENCIL, type Ctx, type Env, type Layer, type P } from "./core";
import type { Film } from "./film";
import { clamp, lerp, smooth } from "./gallery";
import { capsule, cb, ell, filmPrint, inkCel, INK, noodle, paintFills, place, qb, rect, schedule, wob, type Part } from "./rubberHoseKit";

// RUBBER HOSE · a coffee pot dances on the counter, 1930s studio cartoon.
//
// MEDIUM, physically: an animation drawing in non-photo-blue pencil on punched bond, traced in
// India ink with a crow-quill / brush held at ONE pressure onto a clear cel (the line is uniform,
// never thick-thin; it wobbles a little because it is a hand), painted on the BACK of the cel in
// flat opaque greys (so the ink always sits on top of the paint), photographed on black-and-white
// stock and printed: warm silver toning, grain that changes every frame, lamp flicker, dust,
// a sprocket scratch, gate weave, the rounded corners of the projector's aperture.
// MARKS: one-weight ink contours that stop where a nearer shape starts; solid black noodle limbs
// with NO elbow (one smooth arc shoulder to wrist); white four-digit gloves with three stitch
// lines and a flared cuff; pie-cut pupils (a wedge missing where the shine would be); flat grey
// fills with no modelling at all; cast shadows as translucent flat shapes, no ink.
// ORDER: blue pencil rough (line of action first, then masses, then parts) -> ink (character,
// then set) -> paint (flooded region by region, character first) -> the film pull-down: the
// drawing is threaded through the gate and comes back as a print -> motion-first: two seconds of
// the dance, on twos, that lands back on the key pose -> the hold, which IS the still.
// PALETTE: greys only, a 1930s black-and-white cartoon: ink #16130f, paper whites, five greys.
// LIGHT: one window, upper left. Shine on the pot's upper-left shoulder; the pot's and the cup's
// flat shadows thrown to the right on the tiles; contact shadows under the feet (the kicked foot's
// shadow is small and separate: it is in the air).
// SUBJECT & REFERENCE (from knowledge): a 1930s enamel stovetop coffee pot (tapered body,
// rolled rim, domed lid with a ball knob, gooseneck spout, C-handle), drawn with the conventions
// of Fleischer/Iwerks-era rubber-hose animation (Bimbo, early Mickey, "Swing You Sinners!"): the
// object IS the head and torso, a face on its body, noodle limbs from its sides, big oval shoes.
// Kitchen: 1930s tile backsplash with a dark border course, a scalloped window valance, a cup.
// NOT ITS NEIGHBOUR: the marker comic (koi) is modelled cel colour with a thick-thin contour;
// this is a one-weight line, no modelling, greys, and a film print.

const W = 1080, H = 1080;
const T = { pen: [4, 92], ink: [98, 232], fill: [238, 324], pull: [330, 345], dance: [345, 405] } as const;
const N = 435; // dance ends at 405; the last 30 frames are the still
const G = { wall: "#cbc5b8", glass: "#f1ede3", valance: "#8e887d", tile: "#e2ded3", border: "#55514b", top: "#8a857b", edge: "#4a4742", cab: "#b3ada1", panel: "#a39d91", pot: "#7f7a71", lid: "#5d5952", white: "#f6f3ea", tongue: "#8f897f", shine: "#ebe7dc", cup: "#ece8de", saucer: "#d3cec3", coffee: "#3a3631", paper: "#f5f2e8" };

// ---------------------------------------------------------------- the character, posed
type Pose = { o: P; tilt: number; sq: number; hL: P; aL: number; bL: number; hR: P; aR: number; bR: number; fL: P; sL: number; lL: number; fR: P; sR: number; lR: number };
const K0: Pose = { o: [470, 735], tilt: -0.1, sq: 1, hL: [258, 468], aL: -0.62, bL: 46, hR: [712, 628], aR: 1.3, bR: -42, fL: [410, 783], sL: 0, lL: 16, fR: [642, 736], sR: -0.38, lR: -42 };
const K1: Pose = { o: [456, 735], tilt: 0.1, sq: 0.92, hL: [236, 652], aL: -1.62, bL: -34, hR: [688, 432], aR: 0.5, bR: 40, fL: [302, 740], sL: 0.36, lL: 44, fR: [522, 783], sR: 0, lR: -14 };
const K2: Pose = { o: [470, 735], tilt: -0.06, sq: 0.94, hL: [300, 440], aL: -0.22, bL: 32, hR: [660, 438], aR: 0.3, bR: -30, fL: [412, 783], sL: 0, lL: 14, fR: [656, 712], sR: -0.52, lR: -56 };
const K3: Pose = { o: [460, 735], tilt: 0.07, sq: 0.95, hL: [228, 598], aL: -1.32, bL: -26, hR: [724, 560], aR: 1.52, bR: 26, fL: [318, 744], sL: 0.26, lL: 40, fR: [526, 783], sR: 0, lR: -12 };
const KEYS = [K0, K1, K2, K3, K0];
const ease = (t: number) => t * t * (3 - 2 * t);
// dance frame d in 0..60 (animated on twos) -> pose; d = 0 and d = 60 are exactly K0
const danced = (d: number): Pose => {
  if (d <= 0 || d >= 60) return K0;
  const q = d - (d % 2), seg = Math.min(3, Math.floor(q / 15)), t = (q - seg * 15) / 15, a = KEYS[seg], b = KEYS[seg + 1], e = ease(t), hop = Math.sin(Math.PI * t);
  const L = (x: number, y: number) => lerp(x, y, e), LP = (x: P, y: P): P => [L(x[0], y[0]), L(x[1], y[1])];
  // the body leads, the limbs follow a couple of frames behind on the same arc (overlap, never unison)
  const f = ease(clamp((t - 0.12) / 0.88)), LF = (x: P, y: P): P => [lerp(x[0], y[0], f), lerp(x[1], y[1], f)], Lf = (x: number, y: number) => lerp(x, y, f);
  return { o: [L(a.o[0], b.o[0]), L(a.o[1], b.o[1]) - 26 * hop], tilt: L(a.tilt, b.tilt), sq: L(a.sq, b.sq) + 0.08 * hop, hL: LF(a.hL, b.hL), aL: Lf(a.aL, b.aL), bL: Lf(a.bL, b.bL), hR: LF(a.hR, b.hR), aR: Lf(a.aR, b.aR), bR: Lf(a.bR, b.bR), fL: LP(a.fL, b.fL), sL: L(a.sL, b.sL), lL: L(a.lL, b.lL), fR: LP(a.fR, b.fR), sR: L(a.sR, b.sR), lR: L(a.lR, b.lR) };
};

// body-local geometry: origin at the bottom centre of the pot, y up is negative
const BODY = smooth([[-92, -262], [-113, -200], [-125, -110], [-121, -30], [-104, -2], [0, 4], [104, -2], [121, -30], [125, -110], [113, -200], [92, -262], [0, -265]], true, 6);
const RIM = smooth([[-100, -262], [-97, -277], [0, -279], [97, -277], [100, -262], [0, -257]], true, 5);
const LID = smooth([[-84, -270], [-72, -298], [-38, -318], [0, -324], [38, -318], [72, -298], [84, -270], [0, -266]], true, 5);
const KNOB = ell(0, -338, 17, 15, 0, 20);
const SPOUT_C: P[] = [[92, -104], [148, -128], [176, -188], [198, -254], [228, -296]];
const tubeOf = (c: P[], r0: number, r1: number): P[] => { const s = smooth(c, false, 6), L: P[] = [], R: P[] = []; s.forEach((p, i) => { const q = s[Math.min(s.length - 1, i + 1)], o = s[Math.max(0, i - 1)], dx = q[0] - o[0], dy = q[1] - o[1], l = Math.hypot(dx, dy) || 1, r = lerp(r0, r1, i / (s.length - 1)); L.push([p[0] - (dy / l) * r, p[1] + (dx / l) * r]); R.push([p[0] + (dy / l) * r, p[1] - (dx / l) * r]); }); return [...L, ...R.reverse()]; };
const SPOUT = tubeOf(SPOUT_C, 31, 12);
const HANDLE = tubeOf([[-94, -238], [-150, -244], [-180, -192], [-172, -128], [-114, -94]], 13, 13);
const EYE = (x: number) => ell(x, -190, 24, 34, 0, 26);
// pie-cut pupil: an oval with a wedge taken out of its upper left, where the shine would be
const PUPIL = (x: number): P[] => { const cx = x + 6, cy = -181, out: P[] = [[cx, cy]]; for (let i = 0; i <= 22; i++) { const a = -1.85 + (i / 22) * (Math.PI * 2 - 0.8); out.push([cx + Math.cos(a) * 13, cy + Math.sin(a) * 21]); } return out; };
const MOUTH: P[] = [...cb([-60, -130], [-30, -124], [26, -124], [58, -134], 10), ...cb([58, -134], [50, -76], [-44, -72], [-60, -130], 14).slice(1)];
const TONGUE: P[] = [...cb([-30, -88], [-20, -110], [28, -112], [36, -90], 10), ...cb([36, -90], [20, -80], [-16, -78], [-30, -88], 8).slice(1)];
const SHINE: P[] = smooth([[-97, -222], [-88, -238], [-82, -206], [-86, -150], [-97, -138], [-104, -176]], true, 5);
// a white glove, wrist at the origin, digits pointing up: flared cuff, palm, three fingers, thumb
const GLOVE: P[][] = [smooth([[-17, -10], [-21, -28], [-15, -45], [0, -49], [15, -45], [20, -28], [17, -10]], true, 5), capsule([-12, -38], [-17, -72], 7.6), capsule([1, -40], [2, -81], 7.9), capsule([13, -38], [19, -69], 7.3), capsule([-15, -22], [-37, -40], 7.6), smooth([[-20, 4], [0, 7], [20, 4], [17, -13], [0, -10], [-17, -13]], true, 5)];
const STITCH: P[][] = [[[-7, -17], [-6, -33]], [[1, -17], [1, -35]], [[9, -17], [9, -32]]];
// a big oval shoe, ankle at the origin, toe pointing +x
const SHOE: P[] = smooth([[-18, -10], [-4, -15], [20, -14], [42, -20], [62, -10], [66, 7], [52, 21], [0, 22], [-22, 18], [-27, 4]], true, 6);

const scene = (ps: Pose, phase: number, boil: number): Part[] => {
  const sx = 1 / Math.sqrt(ps.sq), sy = ps.sq, B = (pts: P[]) => place(pts, ps.o, ps.tilt, sx, sy), w = (pts: P[], k: number) => wob(pts, 2.2, boil * 31 + k);
  const bodyW = B(BODY), tip = B([[228, -296]])[0], shL = B([[-116, -66]])[0], shR = B([[116, -66]])[0], hipL = B([[-50, -6]])[0], hipR = B([[50, -6]])[0];
  const glove = (h: P, a: number, mir: boolean) => GLOVE.map((s) => place(s, h, a, 1, 1, mir)), stitch = (h: P, a: number, mir: boolean) => STITCH.map((s) => place(s, h, a, 1, 1, mir));
  const shoe = (f: P, a: number, mir: boolean) => place(SHOE, f, mir ? -a : a, 1, 1, mir);
  // steam: three tapered wisps rising and curling off the spout; periodic in `phase`
  const wisp = (k: number): P[] => {
    // each wisp leaves the spout's mouth, rises in a lazy S that fans away from its neighbours, and
    // rolls into a curl at the top; the S travels up the wisp as `phase` runs 0..1 (periodic)
    const o: P = [tip[0] + 6 + k * 7, tip[1] - 10 - k * 3], c: P[] = [], hgt = 120 + k * 46, dir = k === 1 ? -1 : 1;
    for (let i = 0; i <= 16; i++) { const s = i / 16; c.push([o[0] + s * 22 + s * s * (k - 1) * 58 + Math.sin((s * 1.25 - phase) * Math.PI * 2 + k * 1.9) * (4 + 17 * s), o[1] - s * hgt]); }
    const e = c[c.length - 1], e0 = c[c.length - 2], a0 = Math.atan2(e[1] - e0[1], e[0] - e0[0]);
    for (let i = 1; i <= 10; i++) { const a = a0 + dir * (i / 10) * 4.4, r = 17 - i * 1.2; const cx = e[0] + Math.cos(a0 + dir * Math.PI / 2) * 17, cy = e[1] + Math.sin(a0 + dir * Math.PI / 2) * 17; c.push([cx + Math.cos(a - dir * Math.PI / 2) * r, cy + Math.sin(a - dir * Math.PI / 2) * r]); }
    const s = smooth(c, false, 3), Lp: P[] = [], Rp: P[] = [];
    s.forEach((p, i) => { const q = s[Math.min(s.length - 1, i + 1)], o2 = s[Math.max(0, i - 1)], dx = q[0] - o2[0], dy = q[1] - o2[1], l = Math.hypot(dx, dy) || 1, t = i / (s.length - 1), r = 2.5 + (10 - k * 1.5) * Math.sin(Math.PI * Math.min(1, t * 1.05)) * (1 - 0.25 * t); Lp.push([p[0] - (dy / l) * r, p[1] + (dx / l) * r]); Rp.push([p[0] + (dy / l) * r, p[1] - (dx / l) * r]); });
    return [...Lp, ...Rp.reverse()];
  };
  // flat shadows, thrown right by the window: the pot's on the tiles, the cup's, the feet on the counter
  const potShadow = place(BODY, [ps.o[0] + 78, ps.o[1] + 6], ps.tilt + 0.05, sx * 1.02, sy * 0.96);
  const footShadow = (f: P) => { const h = clamp((783 - f[1]) / 60); return ell(f[0] + (f === ps.fL ? -14 : 22) + h * 16, 806, 52 * (1 - 0.45 * h), 9 * (1 - 0.4 * h), 0, 20); };
  const tiles: P[][] = []; for (let x = 66; x < W; x += 66) tiles.push([[x, 585], [x, 780]]); [650, 715].forEach((y) => tiles.push([[0, y], [W, y]]));
  const scal: P[] = [[92, 96], [320, 96], [320, 128]]; for (let i = 0; i <= 6; i++) { const x0 = 320 - (i * 228) / 7, x1 = 320 - ((i + 1) * 228) / 7; scal.push(...qb([x0, 128], [(x0 + x1) / 2, 150], [x1, 128], 6).slice(1)); }
  const cupBody: P[] = [...cb([806, 724], [806, 772], [826, 800], [866, 800], 10), ...cb([866, 800], [906, 800], [926, 772], [926, 724], 10).slice(1), ...ell(866, 724, 60, 13, 0, 24).filter(([, y]) => y < 724).reverse()];
  const cupHandle = tubeOf([[922, 740], [956, 740], [956, 770], [916, 786]], 7, 6);
  const parts: Part[] = [
    // the set
    { fills: [{ pts: rect(0, 0, W, 562), col: G.wall, rank: 5 }], outline: [], ow: 0, orank: 0, details: [] },
    { fills: [{ pts: rect(92, 96, 320, 392), col: G.glass, rank: 4 }], outline: [rect(92, 96, 320, 392)], ow: 4.5, orank: 4, details: [{ pts: [[206, 128], [206, 392]], w: 7, rank: 4 }, { pts: [[92, 250], [320, 250]], w: 7, rank: 4 }, { pts: [[80, 392], [332, 392], [332, 404], [80, 404]], w: 4.5, closed: true, rank: 4 }] },
    { fills: [{ pts: scal, col: G.valance, rank: 4 }], outline: [scal], ow: 4.5, orank: 4, details: [] },
    { fills: [{ pts: rect(0, 562, W, 586), col: G.border, rank: 5 }, { pts: rect(0, 586, W, 780), col: G.tile, rank: 5 }], outline: [], ow: 0, orank: 4, details: [{ pts: [[0, 562], [W, 562]], w: 4.5, rank: 4 }, { pts: [[0, 586], [W, 586]], w: 4, rank: 4 }, ...tiles.map((t) => ({ pts: t, w: 3, rank: 4 }))] },
    { fills: [{ pts: potShadow, col: "#000000", alpha: 0.24, rank: 6 }, { pts: [[926, 726], [990, 734], [990, 800], [930, 800]], col: "#000000", alpha: 0.2, rank: 6 }], outline: [], ow: 0, orank: 0, details: [], knock: false },
    { fills: [{ pts: rect(0, 780, W, 826), col: G.top, rank: 5 }, { pts: rect(0, 826, W, 850), col: G.edge, rank: 5 }], outline: [rect(-10, 780, W + 10, 850)], ow: 4.5, orank: 4, details: [{ pts: [[0, 826], [W, 826]], w: 4, rank: 4 }] },
    { fills: [{ pts: rect(0, 850, W, H), col: G.cab, rank: 5 }, { pts: rect(70, 886, 500, 1080), col: G.panel, rank: 5 }, { pts: rect(580, 886, 1010, 1080), col: G.panel, rank: 5 }, { pts: ell(470, 968, 11, 11), col: INK, rank: 5 }, { pts: ell(610, 968, 11, 11), col: INK, rank: 5 }], outline: [], ow: 0, orank: 4, details: [{ pts: rect(70, 886, 500, 1100), w: 4.5, closed: true, rank: 4 }, { pts: rect(580, 886, 1010, 1100), w: 4.5, closed: true, rank: 4 }, { pts: [[540, 850], [540, 1080]], w: 4.5, rank: 4 }, { pts: ell(470, 968, 11, 11), w: 3.5, closed: true, rank: 4 }, { pts: ell(610, 968, 11, 11), w: 3.5, closed: true, rank: 4 }] },
    // the cup the pot is dancing for: a saucer, a cup, its handle, the empty dark inside
    { fills: [{ pts: ell(866, 804, 84, 15, 0, 30), col: G.saucer, rank: 3 }], outline: [ell(866, 804, 84, 15, 0, 30)], ow: 4.5, orank: 3, details: [] },
    { fills: [{ pts: cupHandle, col: G.cup, rank: 3 }], outline: [cupHandle], ow: 4.5, orank: 3, details: [] },
    { fills: [{ pts: cupBody, col: G.cup, rank: 3 }, { pts: ell(866, 724, 60, 13, 0, 28), col: G.coffee, rank: 3 }], outline: [cupBody, ell(866, 724, 60, 13, 0, 28)], ow: 4.5, orank: 3, details: [] },
    { fills: [{ pts: footShadow(ps.fL), col: "#000000", alpha: 0.3, rank: 2 }, { pts: footShadow(ps.fR), col: "#000000", alpha: 0.3, rank: 2 }], outline: [], ow: 0, orank: 0, details: [], knock: false },
    // the character, back to front
    { fills: [{ pts: B(HANDLE), col: G.pot, rank: 1 }], outline: [w(B(HANDLE), 1)], ow: 7, orank: 1, details: [] },
    { fills: [{ pts: B(SPOUT), col: G.pot, rank: 1 }], outline: [w(B(SPOUT), 2)], ow: 7, orank: 1, details: [{ pts: w(B(ell(229, -297, 9, 15, 0.62, 16)), 3), w: 5, closed: true, rank: 1 }] },
    { fills: [], outline: [], ow: 0, orank: 2, details: [{ pts: w(noodle(hipL, ps.fL, ps.lL), 4), w: 20, rank: 2 }, { pts: w(noodle(hipR, ps.fR, ps.lR), 5), w: 20, rank: 2 }] },
    { fills: [{ pts: shoe(ps.fL, ps.sL, true), col: INK, rank: 1 }, { pts: place(ell(44, -6, 10, 5, -0.3, 14), ps.fL, -ps.sL, 1, 1, true), col: G.white, rank: 1 }], outline: [w(shoe(ps.fL, ps.sL, true), 6)], ow: 7, orank: 2, details: [] },
    { fills: [{ pts: shoe(ps.fR, ps.sR, false), col: INK, rank: 1 }, { pts: place(ell(44, -6, 10, 5, -0.3, 14), ps.fR, ps.sR), col: G.white, rank: 1 }], outline: [w(shoe(ps.fR, ps.sR, false), 7)], ow: 7, orank: 2, details: [] },
    { fills: [], outline: [], ow: 0, orank: 2, details: [{ pts: w(noodle(shL, ps.hL, ps.bL), 8), w: 19, rank: 2 }, { pts: w(noodle(shR, ps.hR, ps.bR), 9), w: 19, rank: 2 }] },
    { fills: glove(ps.hL, ps.aL, true).map((s) => ({ pts: s, col: G.white, rank: 1 })), outline: glove(ps.hL, ps.aL, true).map((s, k) => w(s, 10 + k)), ow: 6, orank: 2, details: [...stitch(ps.hL, ps.aL, true).map((s) => ({ pts: s, w: 4, rank: 2 })), { pts: place([[-17, -13], [0, -10], [17, -13]], ps.hL, ps.aL, 1, 1, true), w: 4, rank: 2 }] },
    { fills: glove(ps.hR, ps.aR, false).map((s) => ({ pts: s, col: G.white, rank: 1 })), outline: glove(ps.hR, ps.aR, false).map((s, k) => w(s, 20 + k)), ow: 6, orank: 2, details: [...stitch(ps.hR, ps.aR, false).map((s) => ({ pts: s, w: 4, rank: 2 })), { pts: place([[-17, -13], [0, -10], [17, -13]], ps.hR, ps.aR), w: 4, rank: 2 }] },
    { fills: [{ pts: B(LID), col: G.lid, rank: 1 }], outline: [w(B(LID), 30)], ow: 7, orank: 1, details: [] },
    { fills: [{ pts: bodyW, col: G.pot, touch: B([[-20, -150]])[0], rank: 1 }, { pts: B(SHINE), col: G.shine, rank: 1 }], outline: [w(bodyW, 31)], ow: 7, orank: 1, details: [] },
    { fills: [{ pts: B(RIM), col: G.lid, rank: 1 }], outline: [w(B(RIM), 32)], ow: 7, orank: 1, details: [] },
    { fills: [{ pts: B(KNOB), col: INK, rank: 1 }, { pts: B(ell(-5, -343, 5, 4, 0, 10)), col: G.white, rank: 1 }], outline: [w(B(KNOB), 33)], ow: 7, orank: 1, details: [] },
    { fills: [{ pts: B(EYE(-33)), col: G.white, rank: 1 }, { pts: B(EYE(31)), col: G.white, rank: 1 }, { pts: B(PUPIL(-33)), col: INK, rank: 1 }, { pts: B(PUPIL(31)), col: INK, rank: 1 }], outline: [w(B(EYE(-33)), 34), w(B(EYE(31)), 35)], ow: 6, orank: 1, details: [{ pts: w(B(PUPIL(-33)), 36), w: 3, closed: true, rank: 1 }, { pts: w(B(PUPIL(31)), 37), w: 3, closed: true, rank: 1 }, { pts: w(B(qb([-58, -236], [-38, -256], [-14, -240])), 38), w: 6, rank: 1 }, { pts: w(B(qb([12, -240], [34, -258], [56, -238])), 39), w: 6, rank: 1 }] },
    { fills: [{ pts: B(MOUTH), col: INK, rank: 1 }, { pts: B(TONGUE), col: G.tongue, rank: 1 }], outline: [w(B(MOUTH), 40)], ow: 6, orank: 1, details: [{ pts: w(B(qb([-70, -142], [-72, -128], [-62, -118])), 42), w: 5, rank: 1 }, { pts: w(B(qb([68, -146], [72, -132], [62, -122])), 43), w: 5, rank: 1 }] },
    ...[0, 1, 2].map((k): Part => ({ fills: [{ pts: wisp(k), col: G.white, rank: 2 }], outline: [w(wisp(k), 50 + k)], ow: 4.5, orank: 2, details: [] })),
  ];
  return parts;
};

// ---------------------------------------------------------------- the rough, in blue pencil
const BLUE = "#6d9bd2";
const pencil = (g: Gfx, p: number) => {
  const ps = K0, B = (pts: P[]) => place(pts, ps.o, ps.tilt);
  const strokes: P[][] = [
    qb(ps.fL, [468, 560], ps.hL, 10),                                    // the line of action, foot to waving hand
    B(ell(0, -140, 124, 142, 0, 16)).concat([B(ell(0, -140, 124, 142, 0, 16))[0]]), B(qb([-92, -268], [0, -330], [92, -268], 8)),
    B([[-96, -104], [-176, -180], [-100, -238]]), B(SPOUT_C),
    B(ell(-33, -196, 26, 36, 0, 12)).concat([B(ell(-33, -196, 26, 36, 0, 12))[0]]), B(ell(31, -196, 26, 36, 0, 12)).concat([B(ell(31, -196, 26, 36, 0, 12))[0]]), B(qb([-60, -130], [0, -40], [58, -134], 8)),
    noodle(B([[-116, -66]])[0], ps.hL, ps.bL, 8), ell(ps.hL[0] - 10, ps.hL[1] - 34, 30, 30, 0, 12).concat([ell(ps.hL[0] - 10, ps.hL[1] - 34, 30, 30, 0, 12)[0]]),
    noodle(B([[116, -66]])[0], ps.hR, ps.bR, 8), ell(ps.hR[0] + 30, ps.hR[1] - 10, 30, 30, 0, 12).concat([ell(ps.hR[0] + 30, ps.hR[1] - 10, 30, 30, 0, 12)[0]]),
    noodle(B([[-50, -6]])[0], ps.fL, ps.lL, 8), noodle(B([[50, -6]])[0], ps.fR, ps.lR, 8),
    ell(ps.fL[0] - 22, ps.fL[1] + 4, 42, 20, 0, 12).concat([ell(ps.fL[0] - 22, ps.fL[1] + 4, 42, 20, 0, 12)[0]]), ell(ps.fR[0] + 22, ps.fR[1] - 6, 42, 20, -0.38, 12).concat([ell(ps.fR[0] + 22, ps.fR[1] - 6, 42, 20, -0.38, 12)[0]]),
    [[664, 400], [650, 330], [690, 280], [660, 220]],                   // steam, where it will curl
    [[0, 781], [W, 781]], [[0, 826], [W, 826]], [[0, 586], [W, 586]], rect(92, 96, 320, 392).concat([[92, 96]]),
    ell(866, 760, 64, 44, 0, 12).concat([ell(866, 760, 64, 44, 0, 12)[0]]),
  ];
  g.group("ink", () => strokes.forEach((s, i) => { const q = p >= 1 ? 1 : clamp(p * strokes.length * 1.15 - i * 1.15); if (q > 0) g.pen(s, { w: 1.3, color: BLUE, seed: 900 + i, wobble: 2.2, opacity: 0.85, progress: q }); }));
};

// ---------------------------------------------------------------- frames
type Surf = { X: Layer; F: Layer; K: Layer; Y: Layer };
const surfaces = (env: Env): Surf => {
  const key = `rubberHose:surf:${env.scale}`; let s = env.cache.get(key) as Surf | undefined; if (s) return s;
  const mk = () => env.canvas(Math.round(W * env.scale), Math.round(H * env.scale)); s = { X: mk(), F: mk(), K: mk(), Y: mk() }; env.cache.set(key, s); return s;
};
const fresh = (L: Layer, env: Env) => { const c = L.ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = "source-over"; c.clearRect(0, 0, L.canvas.width, L.canvas.height); c.setTransform(env.scale, 0, 0, env.scale, 0, 0); return c; };
const blit = (c: Ctx, L: Layer, env: Env, dx = 0, dy = 0) => { c.save(); c.setTransform(1, 0, 0, 1, Math.round(dx * env.scale), Math.round(dy * env.scale)); c.drawImage(L.canvas as CanvasImageSource, 0, 0); c.restore(); };
const k = (f: number, w: readonly [number, number]) => clamp((f - w[0]) / (w[1] - w[0]));

// the cel on its paper: rough, ink, paint, at the given stage progress
const drawCel = (env: Env, pose: Pose, phase: number, boil: number, penP: number, inkP: number, fillP: number): Layer => {
  const S = surfaces(env), parts = scene(pose, phase, boil), sch = schedule(scene(K0, 0, 0));
  const x = fresh(S.X, env); x.fillStyle = G.paper; x.fillRect(0, 0, W, H);
  if (penP > 0 && fillP < 1) pencil(new Gfx(x, env, 0, PENCIL), penP);
  if (fillP > 0) paintFills(fresh(S.F, env), parts, sch.fill, fillP), blit(x, S.F, env);
  if (inkP > 0) inkCel(fresh(S.K, env), parts, sch.ink, inkP), blit(x, S.K, env);
  return S.X;
};
const pegHoles = (c: Ctx) => { c.save(); c.fillStyle = "#2a2622"; [[540, 30, 12, 12], [410, 30, 30, 8], [670, 30, 30, 8]].forEach(([x, y, rx, ry]) => { c.beginPath(); ell(x, y, rx, ry, 0, 20).forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.fill(); }); c.restore(); };
const printed = (env: Env, cel: Layer, seed: number): Layer => { const S = surfaces(env), y = fresh(S.Y, env); blit(y, cel, env); filmPrint(y, env, seed); return S.Y; };

export const drawRubberHose = (ctx: Ctx, f: number, env: Env) => {
  ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0);
  if (f >= T.dance[1]) { blit(ctx, printed(env, drawCel(env, K0, 0, 0, 1, 1, 1), 0), env); return; }  // the still
  if (f >= T.pull[1]) {                                                                                  // the dance, on twos, projected
    const d = f - T.dance[0], q = d - (d % 2), r = (n: number) => { const x = Math.sin((q + 1) * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x); };
    ctx.fillStyle = "#0b0907"; ctx.fillRect(0, 0, W, H);
    blit(ctx, printed(env, drawCel(env, danced(d), q / 60, q > 0 ? 1 + q / 2 : 0, 1, 1, 1), 1 + d), env, (r(1) - 0.5) * 3, (r(2) - 0.5) * 3.4);
    return;
  }
  const cel = drawCel(env, K0, 0, 0, k(f, T.pen), k(f, T.ink), k(f, T.fill));
  if (f < T.pull[0]) { blit(ctx, cel, env); pegHoles(ctx); return; }
  // the pull-down: the drawing is threaded through the gate and comes back down as a print
  const t = k(f, T.pull), e = t >= 1 ? 1 : 1 - Math.pow(1 - t, 3) * (1 - 2.2 * t * (1 - t)), BAR = 56, y0 = -(H + BAR) * (1 - e);
  ctx.fillStyle = "#0b0907"; ctx.fillRect(0, 0, W, H);
  blit(ctx, printed(env, cel, 1 + (f - T.pull[0])), env, 0, y0);
  ctx.save(); ctx.translate(0, y0 + H + BAR); blit(ctx, cel, env, 0, y0 + H + BAR); pegHoles(ctx); ctx.restore();
};

export const STYLE = { id: "rubberHose", name: "Rubber hose", family: "1930s cartoon", medium: "India ink at one pressure on a clear cel over a blue-pencil rough, flat grey paint on the back, photographed and printed on black-and-white film", nearest: "koi", hero: "a coffee pot mid-dance-step on a kitchen counter, steam curling" };

export const rubberHose: Film = {
  meta: { title: "Rubber hose · the dancing coffee pot", W, H, fps: 30, bpm: 120, durationFrames: N },
  assets: { images: {} },
  shots: [{ id: "cel", start: 0, end: N, draw: drawRubberHose }],
};
// line of action and still pose are the same drawing: a render of the pose table is its own check
void INK;
