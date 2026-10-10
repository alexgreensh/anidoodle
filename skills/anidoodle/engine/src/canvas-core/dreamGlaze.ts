import { rng, type Ctx, type Env } from "./core";
import { Film } from "./film";
import { G, OUT, ball, cl, curve, fbm, hash2, hex, lin, near, NR, paintForms, raise, ramp, sm, sunlight, surface, tube, type Bufs, type C3, type Obj } from "./dreamGlazeKit";

// SOFT SELF-PORTRAIT HELD UP BY ITS QUESTIONS · resin-oil glazes, a very small brush.
//
// MEDIUM, physically: oil thinned with resin, laid in thin glazes with a tiny soft brush on a
// smooth white ground. THE MARK: none that shows. A form is turned by value steps too fine to
// see, so the unit here is the single pixel, each one lit by the one sun; nothing is a stroke.
// THE EDGE: hard, near and far alike. Depth is haze and scale, never blur.
// ORDER: sky and plain as smooth grounds; forms modelled dark to light; cast shadows; last the
// small sharp accents (lashes, the mouth line, the handwriting, the stars in the window).
// PALETTE: ultramarine falling through turquoise to lemon at the horizon; an ochre and umber
// plain; waxy flesh; violet-umber shadows; one orange, kept for the spark.
// LIGHT: one low sun, front-left and a little above. Everything is lit from it; every shadow
// falls right and away toward the horizon.
// SUBJECT and STRUCTURE: a hollow mask of a calm face, eyes closed, frontal, leaning five degrees.
// Proportions are the face's thirds (brow, nose base, chin), eyes one eye-width apart, the nose as
// wide as an eye, the mouth a third of the way down the lowest third. The crown is cut open. A
// window is cut in the forehead with a night sky and one spark inside. The right cheek runs out
// into a soft scroll of handwriting. Two question marks hold it up; their stems stop short of
// their dots. The same mask repeats to the horizon.
// THE HAND itself is in dreamGlazeKit.ts and has no subject in it. Everything below is this one
// picture: its face, its props and its painter. Build a new picture on the kit, never on this file.
// NOT: `paintedOil` shows its bristle and loses its edges; this hand hides the brush and keeps
// every edge. No composition, figure or prop from any existing painting is re-staged.

export const W = 1600, H = 2000;


const SKY: [number, C3][] = [[0, hex("#0d2450")], [0.26, hex("#1f4f8c")], [0.5, hex("#4a8dba")], [0.7, hex("#8fc2bd")], [0.86, hex("#dcd9a4")], [0.95, hex("#f1d491")], [1, hex("#f4c486")]];
export const GROUND: [number, C3][] = [[0, hex("#8f5f2c")], [0.3, hex("#b98646")], [0.62, hex("#d6b170")], [1, hex("#ecd7a4")]];

// ---------------------------------------------------------------- the space
// A pinhole camera 1.6 units above an endless plain. The horizon sits at 65 % of the height.
export const YH = 1300, F = 1800, CAMH = 1.6, CX = 800;
export const { LW, LS, sunAt, light } = sunlight([-0.6, 0.42, -0.68]); // one low sun, front-left and a little above
// the main group stands where its dots touch the plain
export const AX0 = 678, AY0 = 1570, Z0 = (F * CAMH) / (AY0 - YH);
// the same mask, further and further off: [depth, screen x of the dot]
export const COPIES: [number, number][] = [[430, 506], [215, 446], [104, 336], [50, 118]];

// ---------------------------------------------------------------- the face, a height field
// u across (half width 0.5 at the cheekbones), v down (brow -0.235, nose base 0.235, chin 0.70).
export const MX = 640, MY = 730, S = 600, TILT = (-5 * Math.PI) / 180, CT = Math.cos(TILT), ST = Math.sin(TILT);
const MBASE = 60;
export const halfW = (v: number) => { if (v < -0.05) { const t = (-v - 0.05) / 0.5; return 0.5 - 0.045 * t * t; } const t = cl((v + 0.05) / 0.75); return 0.5 * Math.pow(Math.max(0, 1 - Math.pow(t, 2.2)), 0.55); };
export const WIN = { u0: -0.1, u1: 0.1, v0: -0.485, v1: -0.345, wall: 0.017 };
export const mouthLine = (u: number) => 0.405 - 0.019 * (u / 0.16) * (u / 0.16) + 0.006 * Math.exp(-(u * u) / 0.0009);
export const lashLine = (au: number) => { const x = (au - 0.218) / 0.095; return -0.094 - 0.026 * x * x; };
const faceH = (u: number, v: number) => {
  const au = Math.abs(u), a = halfW(v);
  let q = a > 0.001 ? 1 - (u / a) * (u / a) : 0; if (q < 0) q = 0;
  const da = (halfW(v + 0.004) - a) / 0.004, dA = (a - Math.sqrt(u * u + 0.0049)) / Math.sqrt(1 + da * da), dB = (0.7 - v) * 0.9, hm = cl(0.5 + (0.5 * (dB - dA)) / 0.12), de = cl((dB + (dA - dB) * hm - 0.12 * hm * (1 - hm)) / 0.34), bev = Math.sqrt(1 - (1 - de) * (1 - de));
  let hb = 0.2 * bev + 0.17 * Math.pow(q, 0.5) * (1 - sm(0.22, 0.62, v));             // a shell rounded in from its edge, fuller across the cheekbones
  const tf = cl((-0.25 - v) / 0.45); hb *= 1 - 0.22 * tf * tf;                       // the forehead rolls back
  let f = 0;
  const bv = -0.255 + 0.55 * (au - 0.2) * (au - 0.2);
  f += 0.048 * G(au - 0.21, v - bv, 0.17, 0.048);                                       // brow ridge, arched
  f -= 0.082 * G(au - 0.215, v + 0.135, 0.115, 0.072);                                 // the orbit
  f -= 0.035 * G(au - 0.105, v + 0.125, 0.05, 0.065);                                 // deeper by the nose
  f += 0.062 * G(au - 0.218, v + 0.118, 0.088, 0.048);                                // the closed lid over the eyeball
  const lx = (au - 0.218) / 0.095;
  if (lx > -1.3 && lx < 1.3) { const fade = 1 - sm(0.95, 1.25, Math.abs(lx)); f -= 0.011 * Math.exp(-Math.pow((v - lashLine(au)) / 0.008, 2)) * fade; f -= 0.006 * Math.exp(-Math.pow((v - (-0.152 + 0.03 * lx * lx)) / 0.009, 2)) * fade; }
  const tn = (v + 0.22) / 0.44;                                                       // 0 at the root, 1 at the tip
  if (tn > -0.3 && tn < 1.2) { const t = cl(tn), nh = 0.03 + 0.15 * Math.pow(t, 1.4), sg = 0.029 + 0.027 * t; f += nh * Math.exp(-(u * u) / (sg * sg)) * sm(-0.3, 0.1, tn) * (1 - sm(0.97, 1.13, tn)); }
  f += 0.05 * G(u, v - 0.188, 0.05, 0.046);                                          // the ball of the tip
  f += 0.058 * G(au - 0.084, v - 0.203, 0.034, 0.034); f -= 0.014 * G(au - 0.125, v - 0.19, 0.02, 0.035);                                   // the wings
  f += 0.045 * G(au - 0.33, v - 0.02, 0.15, 0.13);                                    // cheekbones
  f += 0.035 * G(u, v - 0.41, 0.21, 0.13);                                            // the muzzle the mouth sits on
  f -= 0.01 * G(u, v - 0.305, 0.02, 0.045);                                           // philtrum
  f += 0.04 * G(u, v - 0.372, 0.125, 0.026) * (1 - 0.35 * Math.exp(-(u * u) / 0.0005)); // upper lip and its bow
  f += 0.052 * G(u, v - 0.438, 0.1, 0.034);                                           // lower lip
  f -= 0.035 * Math.exp(-Math.pow((v - mouthLine(u)) / 0.01, 2)) * (1 - sm(0.14, 0.175, au)); // the mouth line
  f -= 0.02 * G(au - 0.165, v - 0.395, 0.025, 0.025);                                 // its corners
  f -= 0.028 * G(u, v - 0.5, 0.11, 0.03);                                             // the fold above the chin
  f += 0.066 * G(u, v - 0.59, 0.14, 0.085);                                             // chin
  return hb + f * sm(0, 0.22, q);
};
export const RIMW = 0.4455;
export const crown = (u: number) => -0.6 + (0.03 * Math.sin(u * 9 + 1) + 0.018 * Math.sin(u * 23 + 2) + 0.01 * Math.sin(u * 51)) * Math.max(0, 1 - Math.pow(u / RIMW, 6));

// ---------------------------------------------------------------- curves: question marks and the scroll
// [x, y, radius]: a hook that cradles, a stem that stops short, a dot on the ground
export const Q1 = curve([[578, 1226, 8], [588, 1184, 13], [634, 1154, 19], [698, 1150, 22], [750, 1184, 22], [760, 1244, 20], [724, 1300, 17], [688, 1346, 14], [678, 1400, 12], [678, 1456, 9]]);
export const Q2 = curve([[1128, 1082, 7], [1138, 1036, 12], [1184, 1002, 17], [1240, 1002, 19], [1272, 1042, 19], [1268, 1102, 17], [1236, 1152, 15], [1212, 1204, 13], [1208, 1300, 11], [1208, 1446, 8]]);
export const DOT1 = [678, 1540, 30], DOT2 = [1208, 1538, 25];
// the scroll: [x, y, half width]. It leaves the cheek, lies along the second hook, and hangs.
export const SCROLL = curve([[800, 705, 118], [900, 742, 104], [1000, 806, 88], [1100, 868, 76], [1196, 908, 70], [1280, 926, 66], [1340, 976, 60], [1366, 1060, 54], [1366, 1160, 48], [1350, 1260, 42], [1352, 1350, 34], [1368, 1420, 26]], 16);
const SLEN = SCROLL.s[SCROLL.n - 1];

// ---------------------------------------------------------------- objects, back to front
// Each returns: edge distance in px (+ inside), height toward the eye in px, two coordinates the
// painter needs, and which material it is.
export const M_FLESH = 1, M_NIGHT = 2, M_WALL = 3, M_WOOD = 4, M_SCROLL = 5;
export const scrollW = (s: number, r: number) => { const e = SLEN - s; return e < 40 ? r * Math.sqrt(Math.max(0, 1 - Math.pow(1 - e / 40, 2))) : r; };
const scroll: Obj = { box: [680, 560, 1440, 1460], at: (x, y, o) => {
  near(SCROLL, x, y); const w = scrollW(NR.s, NR.r), d = NR.d, q = Math.max(0, 1 - (d / Math.max(1, w)) * (d / Math.max(1, w)));
  // where it bends it wrinkles on the inside of the bend, as soft matter does
  const bend = cl(Math.abs(NR.k) * 90), inner = 0.5 + 0.5 * cl((NR.side * Math.sign(NR.k) * d) / Math.max(1, w), -1, 1);
  o[0] = NR.s <= 0.5 || NR.s >= SLEN - 0.01 ? Math.min(w - d, -1) + (NR.s >= SLEN - 0.01 && d < 1 ? 1 : 0) : w - d;
  o[1] = 22 + 15 * Math.pow(q, 0.5) + 3.2 * Math.sin(NR.s * 0.19) * bend * inner + 2 * Math.sin(NR.s * 0.021 + 1) * q;
  o[2] = NR.s; o[3] = d * NR.side; o[4] = M_SCROLL;
} };
const mask: Obj = { box: [MX - 0.56 * S, MY - 0.76 * S, MX + 0.56 * S, MY + 0.76 * S], at: (x, y, o) => {
  const X = (x - MX) / S, Y = (y - MY) / S, u = X * CT + Y * ST, v = -X * ST + Y * CT, a = halfW(v), da = (halfW(v + 0.004) - a) / 0.004;
  let e = ((a - Math.abs(u)) * S) / Math.sqrt(1 + da * da);
  const front = (v - crown(u)) * S * 0.92;
  e = Math.min(e, front, (0.699 - v) * S);
  const h = MBASE + faceH(u, v) * S;
  o[1] = h; o[2] = u; o[3] = v; o[4] = M_FLESH;
  if (u > WIN.u0 && u < WIN.u1 && v > WIN.v0 && v < WIN.v1) {                         // the window in the forehead
    const open = u > WIN.u0 + WIN.wall && v > WIN.v0 + WIN.wall;                      // we look up into it from the right: left and top walls show
    o[4] = open ? M_NIGHT : M_WALL; o[1] = h - (open ? 26 : 12);
  }
  o[0] = e;
} };
export const M_INSIDE = 6;
export const backRim = (u: number) => -0.6 - 0.085 * Math.sqrt(Math.max(0, 1 - (u / RIMW) * (u / RIMW)));
// above the cut we look down into the shell and see its far wall from inside
const inside: Obj = { box: [MX - 0.56 * S, MY - 0.76 * S, MX + 0.56 * S, MY - 0.5 * S], at: (x, y, o) => {
  const X = (x - MX) / S, Y = (y - MY) / S, u = X * CT + Y * ST, v = -X * ST + Y * CT, cu = Math.sqrt(Math.max(0, 1 - (u / RIMW) * (u / RIMW)));
  o[0] = Math.min((v - backRim(u)) * S, (RIMW - Math.abs(u)) * S, (crown(u) + 0.02 - v) * S); o[1] = MBASE - 30 - 60 * cu; o[2] = u; o[3] = v; o[4] = M_INSIDE;
} };
export const OBJS: Obj[] = [tube(Q2, 3, M_WOOD), tube(Q1, 3, M_WOOD), ball(DOT2, M_WOOD), ball(DOT1, M_WOOD), scroll, inside, mask];

// ---------------------------------------------------------------- the painter
const FLESH = lin("#ecd0ac"), LIP = lin("#c9836c"), PAPERC = lin("#efe2c4"), INK = lin("#3a2414"), WOOD = lin("#6b3c1c"), WOODD = lin("#3a1e0e");
// faux handwriting: arches for the small letters, the odd ascender and descender, gaps for words
export const script = (s: number, d: number, w: number) => {
  let ink = 0;
  for (let j = -5; j <= 5; j++) { const base = j * 19 + 5; if (Math.abs(base) > w - 11) continue; const cw = 7.6, cell = Math.floor(s / cw), word = hash2(Math.floor(s / 47 + j * 3.7), j, 5); if (hash2(cell, j, 9) < 0.12 || word < 0.1) continue;
    const lx = s / cw - cell, hh = hash2(cell, j, 3), yy = d - base, X = (lx - 0.5) * cw, amp = 3.6 + 2 * hash2(cell, j, 4);
    let dist = Math.abs(yy) + (lx > 0.8 || lx < 0.2 ? 0 : 3);                                       // the thread that joins letter to letter
    if (hh < 0.12) dist = Math.min(dist, Math.max(Math.abs(X + 1), yy < 0 ? -yy : yy - 8.5));       // a descender
    else if (hh < 0.34) dist = Math.min(dist, Math.abs(Math.hypot(X, (yy + 2.8) * 1.15) - 2.6));    // a round letter
    else if (hh < 0.52) dist = Math.min(dist, Math.abs(yy + amp * (1 - Math.sin(Math.PI * lx))));   // a cup
    else if (hh < 0.82) dist = Math.min(dist, Math.abs(yy + amp * Math.sin(Math.PI * lx)));         // an arch
    else dist = Math.min(dist, Math.max(Math.abs(X - 0.6 + (yy + 7) * 0.12), yy > 0 ? yy : -yy - 14.5), Math.abs(yy + amp * Math.sin(Math.PI * lx))); // an ascender, leaning
    const k = 1 - sm(0.5, 1.35, dist); if (k > ink) ink = k; }
  return ink;
};
// the spark in the window: a many-rayed burst, each ray a blunt petal
const RAYS = (() => { const r = rng(41), n = 12, out: number[][] = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + (r() - 0.5) * 0.22, l = 0.62 + r() * 0.38; out.push([Math.cos(a), Math.sin(a), l]); } return out; })();
export const spark = (x: number, y: number) => { let best = 1e9; const rr = Math.hypot(x, y); for (const [cx, sy, l] of RAYS) { const t = cl(x * cx + y * sy, 0.1, l), d = Math.hypot(x - cx * t, y - sy * t) - (0.05 + 0.055 * (t / l)); if (d < best) best = d; } return Math.min(best, rr - 0.16); };

let NOINK = false;
export const paint = (b: Bufs, mat: number, x: number, y: number, h: number, nx: number, ny: number, nz: number, a1: number, a2: number, e: number) => {
  if (mat === M_NIGHT) {
    const wu = (a1 - (WIN.u0 + WIN.u1) / 2) / ((WIN.u1 - WIN.u0) / 2), wv = (a2 - (WIN.v0 + WIN.v1) / 2) / ((WIN.v1 - WIN.v0) / 2), X = wu * 1.42, Y = wv;
    const d = spark(X / 0.62, Y / 0.62) * 0.62, glow = Math.exp(-(X * X + Y * Y) / 0.5), k = 1 - sm(-0.012, 0.012, d);
    const star = hash2(Math.floor(a1 * 520), Math.floor(a2 * 520), 77) > 0.985 ? 0.5 : 0;
    const dusk = 0.5 + 0.5 * wv;
    OUT[0] = 0.006 + 0.02 * dusk + 0.5 * glow * glow + star; OUT[1] = 0.012 + 0.035 * dusk + 0.14 * glow * glow + star; OUT[2] = 0.06 + 0.1 * dusk + 0.03 * glow + star;
    const body = 0.75 + 0.35 * (0.5 - 0.5 * (X * 0.6 + Y * 0.6)); // the spark is a lit, solid thing
    OUT[0] = OUT[0] * (1 - k) + 0.86 * body * k; OUT[1] = OUT[1] * (1 - k) + 0.3 * body * k; OUT[2] = OUT[2] * (1 - k) + 0.13 * body * k;
    const recess = 0.45 + 0.55 * sm(0, 0.22, Math.min(wu + 1 - 0.17, wv + 1 - 0.24)); // the lintel's shadow inside
    OUT[0] *= recess; OUT[1] *= recess; OUT[2] *= recess; return;
  }
  const sh = sunAt(b, x, y, h), ix = (x * b.s) | 0, iy = (y * b.s) | 0, ao = 1 - 0.6 * cl((b.Hb[iy * b.DW + ix] - h) / 26);
  if (mat === M_INSIDE) { // concave: the sun comes over the left rim and lands on the right of the far wall
    const t = sm(-0.3, 0.42, a1), depth = cl((a2 - backRim(a1)) / 0.085), k = (0.1 + 0.7 * t * sh) * (0.55 + 0.45 * depth) ;
    OUT[0] = FLESH[0] * (0.1 + 1.0 * k) ; OUT[1] = FLESH[1] * (0.085 + 0.92 * k); OUT[2] = FLESH[2] * (0.12 + 0.8 * k); return; }
  if (mat === M_WALL) { light(FLESH, 0.75, 0.55, 0.36, 0, 1, 0, 1); OUT[0] = OUT[0] * 0.55 + 0.05; OUT[1] = OUT[1] * 0.5 + 0.018; OUT[2] *= 0.5; return; }
  if (mat === M_WOOD) { const grain = fbm(a1 * 0.03, a2 * 0.5, 3, 21), g = 0.35 + 0.65 * grain; light([WOODD[0] + (WOOD[0] - WOODD[0]) * g, WOODD[1] + (WOOD[1] - WOODD[1]) * g, WOODD[2] + (WOOD[2] - WOODD[2]) * g], nx, ny, nz, sh, 1, 0.5, 46); return; }
  if (mat === M_SCROLL) {
    const w = scrollW(a1, 200) < 200 ? 60 : 200; near(SCROLL, x, y); const ww = scrollW(NR.s, NR.r);
    const toPaper = sm(40, 330, a1), al: C3 = [FLESH[0] + (PAPERC[0] - FLESH[0]) * toPaper, FLESH[1] + (PAPERC[1] - FLESH[1]) * toPaper, FLESH[2] + (PAPERC[2] - FLESH[2]) * toPaper];
    const foxing = 1 - 0.1 * fbm(x * 0.012, y * 0.012, 3, 31); al[0] *= foxing; al[1] *= foxing * foxing; al[2] *= foxing * foxing * foxing;
    const ink = NOINK ? 0 : script(a1, a2, ww) * sm(150, 340, a1) * 0.8 * (w > 0 ? 1 : 1);
    al[0] += (INK[0] - al[0]) * ink; al[1] += (INK[1] - al[1]) * ink; al[2] += (INK[2] - al[2]) * ink;
    light(al, nx, ny, nz, sh, ao, 0.05, 18); return;
  }
  // flesh: wax-pale, a rose at the lips and lids, the few dark lines a face cannot do without
  const u = a1, v = a2, au = Math.abs(u), al: C3 = [FLESH[0], FLESH[1], FLESH[2]];
  const rose = 0.85 * G(u, v - 0.405, 0.13, 0.04) * (1 - sm(0.13, 0.17, au)) + 0.16 * G(au - 0.3, v - 0.08, 0.13, 0.1) + 0.12 * G(au - 0.218, v + 0.12, 0.09, 0.04);
  for (let i = 0; i < 3; i++) al[i] += (LIP[i] - al[i]) * cl(rose);
  let dark = 0;
  dark = Math.max(dark, 0.78 * Math.exp(-Math.pow((v - mouthLine(u)) / 0.0048, 2)) * (1 - sm(0.135, 0.172, au)));               // the mouth line
  const lx = (au - 0.218) / 0.095;
  if (lx > -1.4 && lx < 1.4) { const fade = 1 - sm(0.92, 1.18, Math.abs(lx)), lv = lashLine(au); dark = Math.max(dark, 0.9 * Math.exp(-Math.pow((v - lv) / 0.0068, 2)) * fade);
    const lash = v - lv; if (lash > 0 && lash < 0.03) { const comb = Math.pow(0.5 + 0.5 * Math.sin((u + lash * 0.9 * Math.sign(u)) * 520), 6); dark = Math.max(dark, 0.66 * comb * (1 - lash / 0.03) * fade); } } // lashes, combed outward
  dark = Math.max(dark, 0.7 * G(au - 0.052, v - 0.228, 0.026, 0.012));                                                              // nostrils
  const bx = (au - 0.215) / 0.15; if (bx > -1.1 && bx < 1.15) { const bv = -0.262 + 0.06 * bx * bx - 0.012 * bx, th = 0.02 * (1 - 0.55 * sm(-0.2, 1.1, bx)), hairs = 0.55 + 0.45 * Math.pow(0.5 + 0.5 * Math.sin((u * Math.sign(u) * 1.0 + (v - bv) * 1.6) * 700), 2); dark = Math.max(dark, 0.78 * Math.exp(-Math.pow((v - bv) / th, 2)) * (1 - sm(0.85, 1.12, Math.abs(bx))) * hairs); } // brows
  al[0] *= 1 - dark * 0.82; al[1] *= 1 - dark * 0.9; al[2] *= 1 - dark * 0.93;
  // the cut crown shows the thickness of the shell
  const rim = (v - crown(u)) * S; if (rim < 7) { al[0] = al[0] * 0.8 + 0.2; al[1] = al[1] * 0.8 + 0.17; al[2] = al[2] * 0.8 + 0.12; }
  const mottle = fbm(u * 5, v * 5, 3, 51) - 0.5; al[0] *= 1 + 0.05 * mottle; al[1] *= 1 - 0.03 * mottle; al[2] *= 1 - 0.09 * mottle;                       // thin glazes never lie quite even
  light(al, nx, ny, nz, sh * (0.8 + 0.2 * ao), ao, 0.16, 36);
  const dif = Math.max(0, nx * LS[0] + ny * LS[1] + nz * LS[2]) * sh, sss = 0.07 * Math.exp(-Math.pow((dif - 0.14) / 0.13, 2));   // blood-warm where light turns to shadow
  OUT[0] += sss; OUT[1] += sss * 0.3; OUT[2] += sss * 0.14;
  const wd = Math.hypot((u - 0) * S, (v + 0.415) * S), spill = 0.07 * Math.exp(-(wd * wd) / (95 * 95));                              // the spark warms the brow round its window
  OUT[0] += spill; OUT[1] += spill * 0.42; OUT[2] += spill * 0.12;
  void e;
};

export const ridge = (x: number) => { const t1 = (x - 1340) / 430, m1 = t1 > -1 && t1 < 1 ? Math.pow(1 - t1 * t1, 1.2) * 92 * (0.62 + 0.76 * fbm(x * 0.011, 0.3, 4, 7)) : 0, t2 = (x - 170) / 190, m2 = t2 > -1 && t2 < 1 ? Math.pow(1 - t2 * t2, 1.4) * 26 * (0.6 + 0.8 * fbm(x * 0.02, 0.7, 3, 8)) : 0; return Math.max(m1, m2); };
const STONES = [[236, 1694, 26], [1016, 1772, 30], [1338, 1672, 17], [524, 1626, 14], [140, 1536, 10], [1470, 1600, 10], [770, 1700, 11], [330, 1454, 6], [1096, 1616, 6], [566, 1404, 4], [1268, 1838, 22], [404, 1848, 18]];

// ---------------------------------------------------------------- the picture
export const build = (env: Env) => {
  // 1 and 2. raise the forms and paint them (dreamGlazeKit). The scroll is read twice: once with its writing, once bare, for the film.
  const R = raise(env, W, H, OBJS), { s, DW, DH, b, local } = R, SL = local[4], bare = new Uint8ClampedArray(SL.w * SL.h * 3);
  const { objL, px, oid } = paintForms(env, R, paint, { idOf: (li, m) => (m === M_NIGHT ? 8 : li + 1), each: (_li, L, k, x, y, h, nx, ny, nz, e, tone) => { if (L.Mt[k] === M_SCROLL) { NOINK = true; paint(b, L.Mt[k], x, y, h, nx, ny, nz, L.A1[k], L.A2[k], e); NOINK = false; bare[k * 3] = tone(OUT[0]); bare[k * 3 + 1] = tone(OUT[1]); bare[k * 3 + 2] = tone(OUT[2]); } } });

  // 3. sky, far rocks and the plain, with every cast shadow
  const bgL = env.canvas(DW, DH), bimg = bgL.ctx.createImageData(DW, DH), bp = bimg.data, c: C3 = [0, 0, 0], hz: C3 = [0, 0, 0];
  const bgN = env.canvas(DW, DH), nimg = bgN.ctx.createImageData(DW, DH), np = nimg.data; let n0 = 0, n1 = 0, n2 = 0;
  const boards: number[][] = [[Z0, AX0, 1], ...COPIES.map(([z, ax]) => [z, ax, Z0 / z])];
  const alphaAt = (mx: number, my: number) => { const ix = (mx * s) | 0, iy = (my * s) | 0; return ix < 0 || iy < 0 || ix >= DW || iy >= DH ? 0 : b.Ag[iy * DW + ix]; };
  const TAPS = [[0, 0], [0.7, 0.2], [-0.7, -0.2], [0.2, -0.7], [-0.2, 0.7], [0.5, 0.6], [-0.5, -0.6], [0.6, -0.5], [-0.6, 0.5]];
  for (let j = 0; j < DH; j++) { const y = (j + 0.5) / s;
    for (let i = 0; i < DW; i++) { const x = (i + 0.5) / s, g = (j * DW + i) * 4;
      if (y < YH) {
        const t = y / YH; ramp(SKY, t, c);
        const sunward = 1 - x / W; c[0] += 14 * sunward * t * t; c[1] += 8 * sunward * t * t; c[2] -= 10 * sunward * t * t;
        const cloud = sm(0.52, 0.74, fbm(x * 0.0016 + 2, y * 0.013, 4, 5)) * sm(380, 760, y) * (1 - sm(1010, 1190, y)) * 0.5;
        c[0] += (246 - c[0]) * cloud; c[1] += (226 - c[1]) * cloud; c[2] += (190 - c[2]) * cloud;
        const rh = ridge(x), top = YH - rh;
        if (rh > 1 && y > top - 1) { const cov = cl((y - top + 0.5) * s), slope = ridge(x + 3) - ridge(x - 3), facet = fbm(x * 0.07, y * 0.028, 4, 9), lit = sm(0.4, 0.6, 0.5 + slope * 0.06 + (facet - 0.5) * 1.5), depth = (y - top) / Math.max(1, rh); const rr = 126 + (228 - 126) * lit, rg = 118 + (196 - 118) * lit, rb = 146 + (150 - 146) * lit; ramp(SKY, 1, hz); const haze = 0.3 + 0.3 * depth; c[0] += (rr + (hz[0] - rr) * haze - c[0]) * cov; c[1] += (rg + (hz[1] - rg) * haze - c[1]) * cov; c[2] += (rb + (hz[2] - rb) * haze - c[2]) * cov; }
      } else {
        const z = (F * CAMH) / Math.max(0.5, y - YH), wx = ((x - CX) * z) / F, fog = 1 - Math.exp(-z / 55);
        ramp(GROUND, Math.pow(fog, 0.8), c);
        const tn = (fbm(wx * 0.22, z * 0.22, 4, 11) - 0.5) * 0.2 * (1 - fog) + (fbm(wx * 7, z * 7, 2, 12) - 0.5) * 0.12 * cl(1 - z / 22) + (fbm(wx * 0.9, z * 0.05, 3, 13) - 0.5) * 0.07, k = (1 + tn) * (1 + 0.1 * (1 - x / W));
        c[0] *= k; c[1] *= k; c[2] *= k;
        // shadows: from this point of the plain, walk toward the sun and see which standing thing is in the way
        let shd = 0;
        for (const [zb, ax, kb] of boards) { const far = kb < 0.6, ay = YH + (F * CAMH) / zb; if (y > ay + 0.5 || y < YH + (F * CAMH) / (zb + 17) - 1) continue;
          // far off, one pixel row of plain spans many paces, so a far shadow is the average of four depths inside the pixel
          let acc = 0; const sub = far ? 4 : 1;
          for (let q = 0; q < sub; q++) { const yq = far ? y + ((q + 0.5) / sub - 0.5) / s : y, zq = (F * CAMH) / Math.max(0.05, yq - YH); if (zq <= zb) continue; const wq = ((x - CX) * zq) / F, t = (zb - zq) / LW[2], Yb = t * LW[1]; if (Yb > 9.5) continue; const Xb = wq + t * LW[0], sx = CX + (F * Xb) / zb, sy = YH + (F * (CAMH - Yb)) / zb, mx = AX0 + (sx - ax) / kb, my = AY0 + (sy - ay) / kb; if (mx < 300 || mx > 1460 || my < 300) continue; const rad = 0.7 + 0.9 * t; let a = 0; for (const [tx, ty] of TAPS) a += alphaAt(mx + tx * rad, my + ty * rad); acc += a / TAPS.length; }
          acc /= sub; if (acc > shd) shd = acc; }
        // a dot rests on the plain: the dark where it touches
        for (const [zb, ax, kb] of boards) for (const d of [DOT1, DOT2]) { const dx = (x - (ax + (d[0] - AX0) * kb)) / (d[2] * kb * 1.25), dy = (y - (YH + (F * CAMH) / zb - 4 * kb)) / (d[2] * kb * 0.3), q = dx * dx + dy * dy; if (q < 4) shd = Math.max(shd, 0.9 * Math.exp(-q * 1.2)); }
        n0 = c[0]; n1 = c[1]; n2 = c[2];
        const sk = shd * 0.8; c[0] *= 1 - sk * 0.74; c[1] *= 1 - sk * 0.7; c[2] *= 1 - sk * 0.5;
        const fore = sm(1790, 1985, y + 70 * (fbm(x * 0.004, 0.5, 3, 14) - 0.5)) * 0.72; c[0] *= 1 - fore * 0.8; c[1] *= 1 - fore * 0.8; c[2] *= 1 - fore * 0.66; n0 *= 1 - fore * 0.8; n1 *= 1 - fore * 0.8; n2 *= 1 - fore * 0.66; // something out of frame throws its shadow across the foot of the picture
      }
      const dn = (hash2(i, j, 3) - 0.5) * 1.6; bp[g] = c[0] + dn; bp[g + 1] = c[1] + dn; bp[g + 2] = c[2] + dn; bp[g + 3] = 255;
      if (y < YH) { n0 = c[0]; n1 = c[1]; n2 = c[2]; } np[g] = n0 + dn; np[g + 1] = n1 + dn; np[g + 2] = n2 + dn; np[g + 3] = 255; } }
  bgL.ctx.putImageData(bimg, 0, 0); bgN.ctx.putImageData(nimg, 0, 0);
  return { objL, bgL, bgN, DW, DH, px, oid, bare, SL };
};

export type Built = ReturnType<typeof build>;
export const built = (env: Env): Built => { const key = `dreamGlaze@${env.scale}`; let B = env.cache.get(key) as Built | undefined; if (!B) { B = build(env); env.cache.set(key, B); } return B; };
// one of the further masks, a little more lost in the evening air the further off it stands
export const copyLayer = (B: Built, env: Env, z: number, ax: number) => { const s = env.scale, k = Z0 / z, ay = YH + (F * CAMH) / z, T = env.canvas(B.DW, B.DH), t = T.ctx; t.setTransform(1, 0, 0, 1, 0, 0); t.clearRect(0, 0, B.DW, B.DH); t.imageSmoothingEnabled = true; t.imageSmoothingQuality = "high"; t.drawImage(B.objL.canvas, (ax - AX0 * k) * s, (ay - AY0 * k) * s, B.DW * k, B.DH * k); t.globalCompositeOperation = "source-atop"; t.globalAlpha = cl(0.1 + 0.5 * (1 - Math.exp(-z / 160))); t.fillStyle = "#ecd9ae"; t.fillRect(0, 0, B.DW, B.DH); t.globalAlpha = 1; t.globalCompositeOperation = "source-over"; return T; };
// small things standing on the plain: stones, and the one who asks. Each throws the same shadow.
export const smallThings = (ctx: Ctx, env: Env, nStones = 99, figure = 1) => {
  const s = env.scale; ctx.setTransform(s, 0, 0, s, 0, 0);
  const poly = (pts: number[][], fill: string | CanvasGradient) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); };
  const SX = -LW[0] / LW[1], SZ = -LW[2] / LW[1];
  const cast = (pts: number[][], gy: number) => { const z = (F * CAMH) / (gy - YH), ky = (CAMH / z) * SZ; return pts.map(([x, y]) => [x + (gy - y) * SX, gy - (gy - y) * ky]); };
  STONES.slice(0, nStones).forEach(([cx, cy, r], n) => { const rr = rng(700 + n), m = 9, pts: number[][] = []; for (let i = 0; i < m; i++) { const a = (i / m) * Math.PI * 2 + (rr() - 0.5) * 0.4, k = 0.72 + rr() * 0.42; pts.push([cx + Math.cos(a) * r * k, cy - r * 0.5 + Math.sin(a) * r * 0.5 * k]); }
    poly(cast(pts, cy), "rgba(46,30,48,0.6)");
    const g = ctx.createLinearGradient(cx - r, cy - r, cx + r * 0.8, cy + r * 0.2); g.addColorStop(0, "#f0d9a8"); g.addColorStop(0.42, "#b98e58"); g.addColorStop(0.62, "#6e4c30"); g.addColorStop(1, "#3c2a22"); poly(pts, g); });
  if (figure > 0) { if (figure < 1) { ctx.save(); ctx.beginPath(); ctx.rect(1380, 1366 - 74 * figure, 220, 74 * figure + 4); ctx.clip(); }
  { const fx = 1478, fy = 1366, k = 0.7, T = (pts: number[][]) => pts.map(([x, y]) => [fx + (x - 50) * k, fy + (y - 100) * k]);
    const LEGB = [[51, 74], [57, 74], [57.5, 96], [59.5, 100], [51, 100], [53, 96]], LEGF = [[44, 74], [50.5, 74], [50, 96], [51.5, 100], [42.5, 100], [45.5, 96]];
    const COAT = [[43, 17], [50, 15], [57, 18], [59.5, 30], [60, 52], [62.5, 79], [41, 79], [42.5, 52], [42, 30]], COATL = [[43, 17], [45.5, 17.5], [44.6, 30], [45, 52], [44, 79], [41, 79], [42.5, 52], [42, 30]];
    const HEAD = [[44.6, 6], [46, 2.2], [50, 0.4], [54.4, 1.6], [56.4, 5.6], [55.8, 10.6], [53, 14.6], [49, 15.2], [46.2, 13.2], [44.4, 11], [45.2, 9]], HAIR = [[49.4, 0.4], [54.4, 1.6], [56.4, 5.6], [55.8, 10.6], [53.6, 13.4], [52.2, 8], [50, 4.4]];
    const ARM = [[46, 20.5], [38, 31], [31.5, 21.5]], PAGE = [[23.5, 11.5], [31.4, 9.8], [33, 20.2], [25, 22]];
    const armPoly = [[44.5, 19], [47.6, 21.6], [39, 33.4], [36.4, 32.6], [30, 22.4], [32.6, 20.4], [38, 28]];
    for (const p of [LEGB, LEGF, COAT, HEAD, armPoly, PAGE]) poly(cast(T(p), fy), "rgba(46,30,48,0.62)");
    poly(T(LEGB), "#17141f"); poly(T(LEGF), "#221d2c"); poly(T(COAT), "#2c2a4a"); poly(T(COATL), "#a98660");
    poly(T(HEAD), "#c79a72"); poly(T(HAIR), "#241815");
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = "#35335a"; ctx.lineWidth = 3.4 * k; ctx.beginPath(); T(ARM).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    poly(T(PAGE), "#f4ead0"); poly(T([[31.4, 9.8], [33, 20.2], [31.6, 20.5], [30, 10.1]]), "#cdbd98"); }
    if (figure < 1) ctx.restore(); }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
};
// signed by the sitter, small, in the shadow at the foot of the picture
const SIG = (() => { const raw = [[[10, -16], [6, -19], [1, -15], [0, -8], [2, -2], [7, 0], [11, -3]], [[14, -6], [18, -14], [18, -20], [16, -20], [15.5, -10], [16, -2], [18, 0], [20, -3]], [[27, -8], [24, -10], [21, -7], [21, -2], [24, 0], [27, -3], [27.5, -9], [27.5, -2], [29, 0], [31, -3], [32, -9], [32, -3], [34, 0], [37, -3], [38, -9], [38, -2], [40, 0], [42, -3]], [[48, -8], [45, -10], [42, -7], [42, -2], [45, 0], [48, -3], [48.5, -20], [48.5, -2], [50, 0], [52, -3], [55, -5], [57, -8], [55, -10], [52.5, -7], [53, -2], [56, 0], [61, -4]]];
  // each stroke flattened to a fine polyline, so the pen can stop anywhere along it
  return raw.map((st) => { const q = st.map(([x, y]) => [1404 + x * 1.7 + y * -0.25, 1950 + y * 1.7]), out: number[][] = [q[0]]; let cur = q[0]; for (let i = 1; i < q.length - 1; i++) { const c = q[i], e = [(q[i][0] + q[i + 1][0]) / 2, (q[i][1] + q[i + 1][1]) / 2]; for (let k = 1; k <= 8; k++) { const u = k / 8; out.push([(1 - u) * (1 - u) * cur[0] + 2 * (1 - u) * u * c[0] + u * u * e[0], (1 - u) * (1 - u) * cur[1] + 2 * (1 - u) * u * c[1] + u * u * e[1]]); } cur = e; } out.push(q[q.length - 1]); return out; }); })();
export const signature = (ctx: Ctx, env: Env, prog = 1, dx = 0, dy = 0) => { const s = env.scale, total = SIG.reduce((a, st) => a + st.length - 1, 0); let left = prog >= 1 ? total : prog * total;
  ctx.setTransform(s, 0, 0, s, dx * s, dy * s); ctx.strokeStyle = "rgba(214,160,74,0.9)"; ctx.lineWidth = 1.5; ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (const st of SIG) { if (left <= 0) break; const n = Math.min(st.length - 1, left), whole = Math.floor(n), fr = n - whole; ctx.beginPath(); ctx.moveTo(st[0][0], st[0][1]); for (let i = 1; i <= whole; i++) ctx.lineTo(st[i][0], st[i][1]); if (fr > 0) ctx.lineTo(st[whole][0] + (st[whole + 1][0] - st[whole][0]) * fr, st[whole][1] + (st[whole + 1][1] - st[whole][1]) * fr); ctx.stroke(); left -= st.length - 1; }
  ctx.setTransform(1, 0, 0, 1, 0, 0); };

export const drawDreamGlaze = (ctx: Ctx, _frame: number, env: Env) => {
  const B = built(env);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(B.bgL.canvas, 0, 0);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  for (const [z, ax] of COPIES) ctx.drawImage(copyLayer(B, env, z, ax).canvas, 0, 0); // furthest first
  smallThings(ctx, env);
  signature(ctx, env);
  ctx.drawImage(B.objL.canvas, 0, 0);
  surface(ctx, env);
};

export const dreamGlaze: Film = {
  meta: { title: "dreamGlaze", W, H, fps: 30, bpm: 60, durationFrames: 1, raster: "cpu" },
  assets: { images: {} },
  shots: [{ id: "dreamGlaze", start: 0, end: 1, draw: drawDreamGlaze }],
};
export const STYLE = { id: "dreamGlaze", name: "Dream glaze", family: "paint", medium: "resin-thinned oil glazes laid with a very small soft brush on a smooth white ground: no visible stroke, every form turned pixel by pixel under one low sun, every edge hard", nearest: "paintedOil", hero: "a hollow mask of a calm face held up by question marks in an empty desert, its cheek running out into a scroll of handwriting" };
