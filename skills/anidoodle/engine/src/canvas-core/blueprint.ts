import { type Ctx, type Env, Gfx, type P, sample } from "./core";
import type { Film } from "./film";
import { CYAN, DIM, DRAFT, GROUND, type Kit, WHITE, blit, border, cut, kit, sheet, slot, stagger, tooth } from "./blueprintKit";

// GOING TRAIN · cyanotype drafting sheet.
//
// MEDIUM, physically: a ruling pen and a spring-bow compass loaded with white ink (a white-print
// is the negative of a cyanotype: the draftsman's black line exposes as white on Prussian blue),
// on a sheet of blueprint stock that never exposed evenly (brighter where the arc lamp stood,
// mottled, two old fold lines, dust). The ink sits on the tooth of the sheet and breaks up on it,
// and white on blue always blooms a little, so every line has a faint halo.
// MARKS: ruled lines that are never dead straight, compass circles that are (the compass does
// not wobble, the freehand does), chain lines (long dash, short dash) for centres and pitch
// circles, section lining at 45 degrees that starts and stops just inside each part, arrowheads
// filled in, figures and notes in single-stroke inclined gothic capitals (drafting.ts).
// EDGE: a thin even pen line with a slight taper where the nib lifts; no tone except section
// lining and the solid fill a thin section gets by convention.
// LINE HIERARCHY: visible outlines heavy white; section lining, pitch circles, dimensions and
// leaders thin cyan; construction and projection lines thinner, dim, left on the sheet as real
// drafting leaves them.
// ORDER OF MARKS (the film): bare sheet; the border is ruled and zone-marked; the title block box
// ruled; construction (centre lines, pitch circles swung, projection lines dropped to where the
// section will go); ruling-pen outlines, the plate first, then each wheel from the top of the
// stack down, rim and teeth first and the crossings outside-in, each pinion before the wheel it
// sits on; the section outlines; section lining; the detail; dimensions (witness lines, the
// dimension line, arrows, figure); the train table; notes and balloons; the title block lettered
// last and the drawing's title the very last thing written.
// PALETTE: Prussian ground #123a63, white ink #f1f7fb, cyan #a7d8ec, dim cyan #7fbcd8.
// LIGHT: none. An orthographic engineering drawing has no light source and no cast shadow; its
// tone is section lining and nothing else, and that is the honest version of this medium.
// SUBJECT and REALISM: the going train of a small watch movement, top plate removed. A real
// train: centre wheel 64 T drives the third pinion of 8 leaves, third wheel 60 T drives the
// fourth pinion of 8, fourth wheel 60 T drives the escape pinion of 7, escape wheel 15 club
// teeth. 64/8 x 60/8 = 60, so the fourth wheel turns once a minute (the seconds arbor), which is
// the arithmetic every going train is designed around. Centre distance of every mesh = wheel
// pitch radius + pinion pitch radius (module x (Z1 + Z2) / 2), and that is how the arbors are
// placed. Wheels are crossed out (5 curved arms, 4 on the small wheels), pinions have deep roots
// and rounded (ogival) leaf tips, wheel teeth ogival, club teeth with the impulse face on the
// club. Section A-A is a stepped section through the pillars and the four arbors, projected
// straight down: plates and bushes section-lined in opposing directions, thin wheels solid (the
// convention for thin sections), arbors and pinions not sectioned (the convention for shafts),
// pivots running into bushes with oil sinks on the outer faces, the centre arbor running on
// through the pillar plate to the motion work.
// REFERENCE (from knowledge): the plan and section plates of watchmaking textbooks (Daniels,
// "Watchmaking"; de Carle, "Practical Watch Repairing"), the BS 308 / ISO 128 conventions for
// sections, chain lines and dimensioning, and a Swiss school drawing of a going train. The
// sheet's hand is ported from the worked film's PLATE I (example/, butterfly/kit.ts + parts.ts).

const N = 540, HOLD = 30;
// ---------------------------------------------------------------- THE CUE TABLE (frames)
// Every frame number in the film is here and nowhere else. Parts run one after another, as one
// hand does them; a part is 0 before its start and exactly 1 from its end.
const CUES: [string, number, number][] = [
  ["border", 0, 50],        /* the sheet is ruled stroke by stroke, then zone-marked */
  ["titleBox", 50, 80],    /* the title block is ruled early; it is lettered last */
  ["construct", 80, 150],  /* centre lines, pitch circles swung, projection lines dropped */
  ["plate", 150, 175],     /* the pillar plate's edge and its four pillars */
  ["w0", 175, 205],        /* centre wheel, the top of the stack */
  ["p1", 205, 215], ["w1", 215, 240],   /* third pinion, then the third wheel under it */
  ["p2", 240, 250], ["w2", 250, 270],   /* fourth pinion, fourth wheel */
  ["p3", 270, 280], ["w3", 280, 300],   /* escape pinion, escape wheel */
  ["section", 300, 345],   /* section A-A outlines */
  ["lining", 345, 375],    /* section lining */
  ["detail", 375, 395],    /* detail C, the club tooth */
  ["detailD", 395, 410],   /* detail D, the depthing of the first mesh */
  ["dims", 410, 440],      /* dimensions and the cutting plane */
  ["table", 440, 465],     /* the train table */
  ["notes", 465, 490],     /* balloons, callouts, notes */
  ["title", 490, 510],     /* the title block lettering; the title itself is the last word */
];
{ let t = 0; for (const [id, a, b] of CUES) { if (a % 5 || b % 5) throw new Error(`blueprint: cue ${id} off the 5-frame grid`); if (a < t) throw new Error(`blueprint: cue ${id} overlaps the one before`); t = b; } if (t > N - HOLD) throw new Error("blueprint: the hold is shorter than 30 frames"); if (N % 15) throw new Error("blueprint: duration off the beat"); }

// ---------------------------------------------------------------- the train (design units; 20 units = 1 mm)
const S = 1.22, OX = 248, OY = 268;                        // plan placement on the sheet
const PL = (x: number, y: number): P => [OX + x * S, OY + y * S];
const pol = (c: P, r: number, a: number): P => [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r];
const deg = Math.PI / 180;
const M1 = 3.2, M2 = 3.2, M3 = 2.4;                       // modules of the three meshes (0.16, 0.16, 0.12 mm)
const Z = { w0: 64, p1: 8, w1: 60, p2: 8, w2: 60, p3: 7, w3: 15 };
const D01 = (M1 * (Z.w0 + Z.p1)) / 2, D12 = (M2 * (Z.w1 + Z.p2)) / 2, D23 = (M3 * (Z.w2 + Z.p3)) / 2;
const A0: P = [0, 0], A1 = pol(A0, D01, -18 * deg), A2 = pol(A1, D12, 22 * deg), A3 = pol(A2, D23, -25 * deg);
const ARB = [A0, A1, A2, A3];
const R_ESC = 40;                                          // escape wheel tip radius
const PILLARS: P[] = [[-135, 40], [-95, -108], [232, 104], [338, 14]];
const CUTL = PILLARS[0], CUTR = PILLARS[3];               // the stepped cutting plane runs pillar, four arbors, pillar
const OUTLINE: P[] = [[-158, 48], [-152, -40], [-122, -112], [-52, -148], [40, -160], [120, -168], [205, -140], [292, -86], [352, -48], [368, 18], [338, 78], [262, 126], [160, 122], [60, 126], [-40, 124], [-118, 104]];

// ---------------------------------------------------------------- tooth forms (display coordinates)
// wheel: radial flanks from a deep root, ogival addendum; pinion: deep root, rounded leaves
const toothed = (c: P, n: number, R: number, add: number, ded: number, half: number, ph: number, parallel = false): P[] => {
  const out: P[] = [], fl = (r: number) => (parallel ? (half * R) / r : half); /* a pinion leaf has PARALLEL flanks; a wheel tooth's flanks are radial */
  for (let i = 0; i < n; i++) {
    const t = ph + (i / n) * Math.PI * 2, g = Math.PI / n, rr = R - ded, rf = R - add * 0.1;
    ([[rr, -fl(rr) * 1.02], [rf, -fl(rf)], [R + add * 0.55, -half * 0.82], [R + add * 0.9, -half * 0.46], [R + add, 0], [R + add * 0.9, half * 0.46], [R + add * 0.55, half * 0.82], [rf, fl(rf)], [rr, fl(rr) * 1.02], [rr * 0.985, g]] as [number, number][]).forEach(([r, a]) => out.push(pol(c, r * S, t + a)));
  }
  return out;
};
const wheelTeeth = (c: P, n: number, m: number, ph: number) => toothed(PL(...c), n, (m * n) / 2, 1.35 * m, 1.55 * m, (Math.PI / n) * 0.5, ph);
const pinionLeaves = (c: P, n: number, m: number, ph: number) => toothed(PL(...c), n, (m * n) / 2, 0.85 * m, 1.9 * m, (Math.PI / n) * 0.34, ph, true);
// club teeth: the back rises to the locking corner, the club carries the impulse face, the front drops to the root
// a Swiss club tooth, [radius / tip radius, fraction of the tooth pitch]: slim stem, heel, impulse face
// rising across the club to the locking corner, locking face raked back about 24 degrees (draw)
export const CLUB: [number, number][] = [[0.64, 0.12], [0.72, 0.2], [0.8, 0.25], [0.87, 0.28], [0.935, 0.3], [0.97, 0.48], [1, 0.66], [0.95, 0.6], [0.9, 0.545], [0.84, 0.52], [0.76, 0.52], [0.68, 0.55], [0.64, 0.6], [0.62, 0.75], [0.615, 0.9], [0.62, 1.0], [0.64, 1.12]];
const HEEL = 4, CORNER = 6, FACE = 8; // indices in CLUB where the straight faces start and stop
// club teeth: a slender back rising to the heel, the impulse face across the club to the locking
// corner, the locking face undercut back down, the front flank to a wide root
const clubTeeth = (c0: P, ph: number): P[] => {
  const c = PL(...c0), out: P[] = [], R = R_ESC, st = (Math.PI * 2) / Z.w3;
  for (let i = 0; i < Z.w3; i++) { const t = ph + i * st; CLUB.slice(0, 16).forEach(([r, a]) => out.push(pol(c, r * R * S, t + a * st))); }
  return out;
};
// the crossings: windows between the arms, bounded by the rim, the hub and each arm's edges
const windows = (c0: P, Ri: number, Rh: number, arms: number, twist: number, armW: number, ph: number): P[][] => {
  const c = PL(...c0), out: P[][] = [];
  for (let k = 0; k < arms; k++) {
    const a0 = ph + (k / arms) * Math.PI * 2, a1 = ph + ((k + 1) / arms) * Math.PI * 2, tw = (r: number) => twist * ((r - Rh) / (Ri - Rh)) ** 1.3;
    const L = (r: number) => a0 + armW / 2 / r + tw(r), R = (r: number) => a1 - armW / 2 / r + tw(r), pts: P[] = [], n = 6;
    for (let j = 0; j <= n; j++) { const r = Rh + ((Ri - Rh) * j) / n; pts.push(pol(c, r * S, L(r))); }
    for (let j = 1; j < 9; j++) { const a = L(Ri) + ((R(Ri) - L(Ri)) * j) / 9; pts.push(pol(c, Ri * S, a)); }
    for (let j = n; j >= 0; j--) { const r = Rh + ((Ri - Rh) * j) / n; pts.push(pol(c, r * S, R(r))); }
    for (let j = 8; j > 0; j--) { const a = L(Rh) + ((R(Rh) - L(Rh)) * j) / 9; pts.push(pol(c, Rh * S, a)); }
    out.push(pts);
  }
  return out;
};
type Wheel = { c: P; teeth: P[]; win: P[][]; hub: number; arbor: number; R: number };
const WHEELS: Wheel[] = [
  { c: A0, teeth: wheelTeeth(A0, Z.w0, M1, -18 * deg), win: windows(A0, (M1 * Z.w0) / 2 - 1.55 * M1 - 9, 21, 5, 0.34, 7, 0.3), hub: 21, arbor: 4.5, R: (M1 * Z.w0) / 2 },
  { c: A1, teeth: wheelTeeth(A1, Z.w1, M2, 22 * deg), win: windows(A1, (M2 * Z.w1) / 2 - 1.55 * M2 - 8.5, 19, 5, 0.34, 6.5, 0.9), hub: 19, arbor: 4, R: (M2 * Z.w1) / 2 },
  { c: A2, teeth: wheelTeeth(A2, Z.w2, M3, -25 * deg), win: windows(A2, (M3 * Z.w2) / 2 - 1.55 * M3 - 7, 15, 4, 0.3, 5.5, 0.5), hub: 15, arbor: 3.5, R: (M3 * Z.w2) / 2 },
  { c: A3, teeth: clubTeeth(A3, 0.1), win: windows(A3, R_ESC * 0.7 - 5, 9, 4, 0, 4, 0.2), hub: 9, arbor: 3, R: R_ESC },
];
const PINIONS = [null, { c: A1, pts: pinionLeaves(A1, Z.p1, M1, (162 - 180 / Z.p1) * deg), r: (M1 * Z.p1) / 2 }, { c: A2, pts: pinionLeaves(A2, Z.p2, M2, (202 - 180 / Z.p2) * deg), r: (M2 * Z.p2) / 2 }, { c: A3, pts: pinionLeaves(A3, Z.p3, M3, (155 - 180 / Z.p3) * deg), r: (M3 * Z.p3) / 2 }];

// a wheel lower in the stack is hidden under the METAL of every wheel above it, never under its
// crossings: the clip is the sheet minus each upper wheel's outline plus its windows (even-odd)
const hideUnder = (c: Ctx, above: { teeth: P[]; win: P[][] }[]) => above.forEach((w) => { c.beginPath(); c.rect(-10, -10, 2000, 2000); [w.teeth, ...w.win].forEach((pts) => { pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); }); c.clip("evenodd"); });

// ---------------------------------------------------------------- the section A-A
const SY0 = 500;                                         // the top face of the top plate
const SX = (x: number) => OX + x * S, SZ = (z: number) => SY0 + z * S;
const TP = 12, GAP = 96, BP = 12;                        // top plate, frame height, pillar plate (design)
const Z_WHEEL = [24, 46, 70, 92], PIN_Z: ([number, number] | null)[] = [[80, 100], [18, 32], [40, 54], [64, 78]]; // wheel planes; each arbor's pinion span
const X0 = -150, X1 = 356;                               // where the cut leaves the plate outline
const rect = (x0: number, z0: number, x1: number, z1: number): P[] => [[SX(x0), SZ(z0)], [SX(x1), SZ(z0)], [SX(x1), SZ(z1)], [SX(x0), SZ(z1)]];
const BUSH = 6.5, PIV = 1.4;                             // bush half-width, pivot half-width (design)

// ---------------------------------------------------------------- the parts, each drawn at a progress
const rule = (k: Kit, pts: P[], w: number, seed: number, q: number, o: { color?: string; opacity?: number } = {}) => { const n = pts.length, st = stagger(q, n, Math.min(1, 1.6 / n)); pts.forEach((a, i) => k.ln(a, pts[(i + 1) % n], w, { seed: seed + i, taper: 0.15, progress: st(i), ...o })); };

const titleBox = (k: Kit, q: number) => { if (q <= 0) return; k.ink(() => {
  const x0 = 650, x1 = 1026, y0 = 890, y1 = 1026, bq = cut(q, 0, 0.6), lq = cut(q, 0.5, 1);
  [[0, 2.6], [5, 1.1]].forEach(([m, w], j) => rule(k, [[x0 + m, y0 + m], [x1 - m, y0 + m], [x1 - m, y1 - m], [x0 + m, y1 - m]], w, 800 + j * 4, stagger(bq, 2, 0.8)(j)));
  k.ln([x0 + 5, y0 + 62], [x1 - 5, y0 + 62], 1.2, { seed: 812, progress: cut(lq, 0, 0.5) }); k.ln([x0 + 5, y0 + 99], [x1 - 5, y0 + 99], 1, { seed: 813, color: CYAN, progress: cut(lq, 0.3, 0.8) }); [x0 + 128, x0 + 252].forEach((x, i) => k.ln([x, y0 + 62], [x, y1 - 5], 1, { seed: 814 + i, color: CYAN, progress: cut(lq, 0.5, 1) }));
}); };

const construct = (k: Kit, q: number) => { if (q <= 0) return; k.ink(() => {
  const s = stagger(q, 4, 0.4), o = { color: DIM, opacity: 0.85 };
  // 1. centre lines through every arbor, and the line of centres
  const c1 = s(0), cs = stagger(c1, 4, 0.55);
  ARB.forEach((a, i) => { const p = PL(...a), L = (WHEELS[i].R + 12) * S; k.chain([p[0] - L, p[1]], [p[0] + L, p[1]], 0.75, { ...o, seed: 1000 + i * 4, progress: cut(cs(i), 0, 0.5) }); k.chain([p[0], p[1] - L], [p[0], p[1] + L], 0.75, { ...o, seed: 1002 + i * 4, progress: cut(cs(i), 0.5, 1) }); });
  // 2. the line of centres, then the pitch circles swung on it (a mesh is two pitch circles touching)
  const c2 = s(1); [0, 1, 2].forEach((i) => k.ln(PL(...ARB[i]), PL(...ARB[i + 1]), 0.7, { ...o, opacity: 0.55, seed: 1020 + i, progress: stagger(cut(c2, 0, 0.3), 3, 0.5)(i) }));
  const ps = stagger(cut(c2, 0.25, 1), 7, 0.35), pr: [P, number][] = [[A0, (M1 * Z.w0) / 2], [A1, (M1 * Z.p1) / 2], [A1, (M2 * Z.w1) / 2], [A2, (M2 * Z.p2) / 2], [A2, (M3 * Z.w2) / 2], [A3, (M3 * Z.p3) / 2], [A3, R_ESC * 0.92]];
  pr.forEach(([c, r], i) => { const p = PL(...c); k.chainRing(p[0], p[1], r * S, 0.75, { color: CYAN, opacity: 0.6, seed: 1040 + i * 40, progress: ps(i), a0: -2.4 + i }); });
  // 3. projection lines dropped from the plan to where the section will stand
  const c3 = s(2); [CUTL, ...ARB, CUTR].forEach((a, i) => { const p = PL(...a); k.ln([p[0], p[1] + 6], [p[0], SZ(-6)], 0.6, { ...o, opacity: 0.45, seed: 1080 + i, progress: stagger(c3, 6, 0.5)(i) }); });
  // 4. the section's datum lines: the plate faces, projected across
  const c4 = s(3); [0, TP, TP + GAP, TP + GAP + BP].forEach((z, i) => k.ln([SX(X0 - 20), SZ(z)], [SX(X1 + 20), SZ(z)], 0.6, { ...o, opacity: 0.45, seed: 1090 + i, progress: stagger(c4, 4, 0.55)(i) }));
}); };

const pillarPlan = (k: Kit, c0: P, seed: number, q: number) => { const c = PL(...c0); k.circle(c[0], c[1], 9 * S, 1.5, { seed, progress: cut(q, 0, 0.45), a0: seed }); k.circle(c[0], c[1], 5.2 * S, 1.1, { seed: seed + 1, progress: cut(q, 0.4, 0.75), a0: seed + 2 }); const sq = cut(q, 0.7, 1), a = 0.6 + seed * 0.3; k.ln(pol(c, 5.2 * S, a), pol(c, 5.2 * S, a + Math.PI), 1.3, { seed: seed + 2, progress: sq }); };
const plate = (k: Kit, q: number) => { if (q <= 0) return; k.ink(() => {
  const pq = cut(q, 0, 0.55), o = k.g.cur; void o;
  k.pen(OUTLINE.map(([x, y]) => PL(x, y)), 1.9, { seed: 1100, closed: true, wobble: 0.3, taper: 0.2, progress: pq });
  const st = stagger(cut(q, 0.5, 1), 4, 0.45); PILLARS.forEach((p, i) => pillarPlan(k, p, 1110 + i * 5, st(i)));
}); };

const wheelPart = (k: Kit, i: number, q: number) => { if (q <= 0) return; k.ink(() => {
  const w = WHEELS[i], c = k.raw(), above = [...WHEELS.slice(0, i).map((u) => ({ teeth: u.teeth, win: u.win })), ...PINIONS.slice(1, i + 1).filter((p) => p).map((p) => ({ teeth: p!.pts, win: [] }))];
  c.save(); hideUnder(c, above); const p = PL(...w.c); k.g.touch(p[0] - w.R * S - 8, p[1] - w.R * S - 8, p[0] + w.R * S + 8, p[1] + w.R * S + 8);
  k.pen(w.teeth, i === 3 ? 1.5 : 1.45, { seed: 1200 + i * 50, closed: true, wobble: 0.05, taper: 0.1, progress: cut(q, 0, 0.45) }); /* rim and teeth first, round the wheel in one go */
  const ws = stagger(cut(q, 0.4, PINIONS[i] ? 1 : 0.9), w.win.length, 0.45); /* with a pinion over the hub, the last window is the last thing seen */ w.win.forEach((pts, j) => k.pen(pts, 1.45, { seed: 1210 + i * 50 + j, closed: true, wobble: 0.1, taper: 0.1, progress: ws(j) })); /* the crossings, window by window */
  const hq = cut(q, 0.85, 1); if (!PINIONS[i]) k.circle(p[0], p[1], w.hub * 0.72 * S, 1.3, { seed: 1230 + i, progress: hq }); k.circle(p[0], p[1], w.arbor * S, 1.2, { seed: 1231 + i, progress: hq, a0: 1 }); if (!PINIONS[i]) k.circle(p[0], p[1], 1.6 * S, 1, { seed: 1232 + i, progress: hq });
  c.restore();
}); };
const pinionPart = (k: Kit, i: number, q: number) => { if (q <= 0) return; const pn = PINIONS[i]!; k.ink(() => {
  const c = k.raw(), p = PL(...pn.c); c.save(); hideUnder(c, WHEELS.slice(0, i - 1).map((u) => ({ teeth: u.teeth, win: u.win }))); k.g.touch(p[0] - 30, p[1] - 30, p[0] + 30, p[1] + 30);
  k.pen(pn.pts, 1.2, { seed: 1300 + i * 10, closed: true, wobble: 0.04, taper: 0.1, progress: cut(q, 0, 0.75) });
  k.circle(p[0], p[1], 2.2 * S, 1.1, { seed: 1305 + i, progress: cut(q, 0.7, 1) }); /* the pivot, seen end on */
  c.restore();
}); };

// SECTION A-A: outlines
const sectionOut = (k: Kit, q: number) => { if (q <= 0) return; k.ink(() => {
  const s = stagger(q, 6, 0.3);
  // plates: each face ruled across, ends closed
  const pq = s(0); rule(k, rect(X0, 0, X1, TP), 1.8, 1400, cut(pq, 0, 0.5)); rule(k, rect(X0, TP + GAP, X1, TP + GAP + BP), 1.8, 1410, cut(pq, 0.5, 1));
  // bushes through both plates, with their pivot holes and the oil sink on the outer face
  const bq = stagger(s(1), 4, 0.5);
  ARB.forEach((a, i) => { const x = a[0], q2 = bq(i); if (q2 <= 0) return; [[0, TP], [TP + GAP, TP + GAP + BP]].forEach(([z0, z1], j) => { const qq = stagger(q2, 2, 0.7)(j); k.ln([SX(x - BUSH), SZ(z0)], [SX(x - BUSH), SZ(z1)], 1.2, { seed: 1420 + i * 8 + j * 4, progress: qq }); k.ln([SX(x + BUSH), SZ(z0)], [SX(x + BUSH), SZ(z1)], 1.2, { seed: 1421 + i * 8 + j * 4, progress: qq }); const zo = j ? z1 : z0, dz = j ? -1 : 1; k.pen([[SX(x - 3.2), SZ(zo)], [SX(x - PIV), SZ(zo + dz * 2.2)], [SX(x + PIV), SZ(zo + dz * 2.2)], [SX(x + 3.2), SZ(zo)]], 1, { seed: 1422 + i * 8 + j * 4, taper: 0.2, wobble: 0.05, progress: cut(qq, 0.5, 1) }); }); });
  // pillars and their screws
  const lq = stagger(s(2), 2, 0.7); [CUTL, CUTR].forEach(([x], i) => { const q2 = lq(i); rule(k, [[SX(x - 7), SZ(TP)], [SX(x - 7), SZ(TP + GAP)]], 1.6, 1460 + i * 6, cut(q2, 0, 0.4)); k.ln([SX(x + 7), SZ(TP)], [SX(x + 7), SZ(TP + GAP)], 1.6, { seed: 1462 + i * 6, progress: cut(q2, 0.2, 0.6) }); rule(k, [[SX(x - 6), SZ(-4.5)], [SX(x + 6), SZ(-4.5)], [SX(x + 6), SZ(0)], [SX(x - 6), SZ(0)]], 1.3, 1464 + i * 6, cut(q2, 0.6, 1)); if (q2 >= 1) k.ln([SX(x), SZ(-4.5)], [SX(x), SZ(-1.8)], 1.3, { seed: 1469 + i * 6 }); });
  // arbors (not sectioned): body between shoulders, pivots into the bushes
  const aq = stagger(s(3), 4, 0.5);
  ARB.forEach((a, i) => { const x = a[0], w = WHEELS[i].arbor * 0.55, q2 = aq(i); if (q2 <= 0) return; const zb = i === 0 ? TP + GAP + BP + 26 : TP + GAP - 2; k.ln([SX(x - w), SZ(TP + 2)], [SX(x - w), SZ(zb)], 1.35, { seed: 1480 + i * 6, progress: cut(q2, 0, 0.6) }); k.ln([SX(x + w), SZ(TP + 2)], [SX(x + w), SZ(zb)], 1.35, { seed: 1481 + i * 6, progress: cut(q2, 0.1, 0.7) }); const pv = cut(q2, 0.6, 1); k.pen([[SX(x - PIV), SZ(TP + 2)], [SX(x - PIV), SZ(3)], [SX(x + PIV), SZ(3)], [SX(x + PIV), SZ(TP + 2)]], 1.1, { seed: 1482 + i * 6, taper: 0.1, wobble: 0.03, progress: pv }); if (i) k.pen([[SX(x - PIV), SZ(TP + GAP - 2)], [SX(x - PIV), SZ(TP + GAP + BP - 3)], [SX(x + PIV), SZ(TP + GAP + BP - 3)], [SX(x + PIV), SZ(TP + GAP - 2)]], 1.1, { seed: 1483 + i * 6, taper: 0.1, wobble: 0.03, progress: pv }); else k.ln([SX(x - w), SZ(zb)], [SX(x + w), SZ(zb)], 1.2, { seed: 1484, progress: pv }); });
  // pinions (not sectioned): the leaves seen side on, their tips and roots as lines
  const nq = stagger(s(4), 4, 0.5);
  PIN_Z.forEach((zz, i) => { if (!zz) return; const x = ARB[i][0], r = i === 0 ? (M1 * 12) / 2 : PINIONS[i]!.r, q2 = nq(i); if (q2 <= 0) return; rule(k, rect(x - r - 1, zz[0], x + r + 1, zz[1]), 1.4, 1500 + i * 8, cut(q2, 0, 0.7)); [-0.45, 0.45].forEach((f, j) => k.ln([SX(x + r * f), SZ(zz[0] + 1)], [SX(x + r * f), SZ(zz[1] - 1)], 0.9, { seed: 1505 + i * 8 + j, color: CYAN, progress: cut(q2, 0.6, 1) })); });
  // wheels seen edge on, and each wheel's collet on its arbor
  const wq = stagger(s(5), 4, 0.5);
  WHEELS.forEach((w, i) => { const x = w.c[0], z = Z_WHEEL[i], R = w.R + (i === 3 ? 0 : 1.35 * (i === 2 ? M3 : M1)), q2 = wq(i); if (q2 <= 0) return; rule(k, rect(x - R, z - 1.6, x + R, z + 1.6), 1.3, 1540 + i * 8, cut(q2, 0, 0.6)); const cz = z < (PIN_Z[i]?.[0] ?? 999) ? [z + 1.6, z + 7] : [z - 7, z - 1.6], h = w.hub * 0.72; if (i > 0 || true) rule(k, rect(x - h, cz[0], x + h, cz[1]), 1.2, 1546 + i * 8, cut(q2, 0.6, 1)); });
}); };
// SECTION A-A: lining. Plates one way, bushes and collets the other; thin wheels solid.
const lining = (k: Kit, q: number) => { if (q <= 0) return; k.ink(() => {
  const s = stagger(q, 4, 0.4), xs = ARB.map((a) => a[0]).sort((a, b) => a - b), pil = [CUTL[0], CUTR[0]];
  const cuts = [X0, ...xs.flatMap((x) => [x - BUSH, x + BUSH]), X1];
  [[0, TP, 0.785, 0], [TP + GAP, TP + GAP + BP, -0.785, 1]].forEach(([z0, z1, ang, j]) => { const segs: P[][] = []; for (let i = 0; i + 1 < cuts.length; i += 2) segs.push(rect(cuts[i] + 0.4, z0 + 0.4, cuts[i + 1] - 0.4, z1 - 0.4)); const hs = stagger(s(j), segs.length, 0.5); segs.forEach((r, i) => k.hatch(r, ang, 3.4, 0.75, 1600 + j * 40 + i * 5, { opacity: 0.85, progress: hs(i) })); void pil; });
  const bs = stagger(s(2), 8, 0.4); let n = 0;
  ARB.forEach((a) => [[0, TP, -0.785], [TP + GAP, TP + GAP + BP, 0.785]].forEach(([z0, z1, ang]) => { const x = a[0]; [[x - BUSH, x - PIV], [x + PIV, x + BUSH]].forEach(([u0, u1], h) => k.hatch(rect(u0 + 0.3, z0 + 0.3, u1 - 0.3, z1 - 0.3), ang, 2.4, 0.7, 1700 + n * 3 + h, { opacity: 0.85, progress: bs(n) })); n++; }));
  const ws = stagger(s(3), 8, 0.4);
  WHEELS.forEach((w, i) => { const x = w.c[0], z = Z_WHEEL[i], R = w.R + (i === 3 ? 0 : 1.35 * (i === 2 ? M3 : M1)), q2 = ws(i * 2 + 1); if (q2 > 0) { const len = (x + R - (x - R)) * cut(q2, 0, 1); k.fill(rect(x - R + 0.8, z - 1.2, x - R + 0.8 + Math.max(0.1, len - 1.6), z + 1.2), WHITE, 0.9); } const cz = z < (PIN_Z[i]?.[0] ?? 999) ? [z + 1.6, z + 7] : [z - 7, z - 1.6], h = w.hub * 0.72, aw = w.arbor * 0.55; [[x - h, x - aw], [x + aw, x + h]].forEach(([u0, u1], j) => k.hatch(rect(u0 + 0.3, cz[0] + 0.3, u1 - 0.3, cz[1] - 0.3), -0.785, 2.2, 0.7, 1760 + i * 4 + j, { opacity: 0.85, progress: ws(i * 2) })); });
}); };

const straight = (a: P, b: P, step = 1.5): P[] => { const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)); return Array.from({ length: n }, (_, i) => [a[0] + ((b[0] - a[0]) * (i + 1)) / n, a[1] + ((b[1] - a[1]) * (i + 1)) / n] as P); };
const arcPts = (c: P, r: number, a0: number, a1: number, step = 1.2): P[] => { const n = Math.max(2, Math.ceil((Math.abs(a1 - a0) * r) / step)); return Array.from({ length: n + 1 }, (_, i) => pol(c, r, a0 + ((a1 - a0) * i) / n)); };
const lerp2 = (a: P, b: P, t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
// DETAIL C: two club teeth enlarged, set symmetric about the vertical so the tooth's own rake reads,
// not the wheel's curvature. Curved stem and root smoothed; the impulse and locking faces RULED.
const DC: P = [884, 572], DK = 8.6;
const detail = (k: Kit, q: number) => { if (q <= 0) return; k.ink(() => {
  const s = stagger(q, 5, 0.35), st = (Math.PI * 2) / Z.w3, base = -Math.PI / 2 - st * 1.08, cc: P = [DC[0], DC[1] + R_ESC * DK];
  const T = (r: number, a: number): P => pol(cc, r * DK, a), at = (i: number, j: number): P => T(CLUB[j][0] * R_ESC, base + (i + CLUB[j][1]) * st);
  const prof: P[] = [T(0.62 * R_ESC, base - st * 0.12)];
  for (let i = 0; i < 2; i++) {
    prof.push(...sample([prof[prof.length - 1], ...Array.from({ length: HEEL + 1 }, (_, j) => at(i, j))], false, 8).slice(1)); /* the back of the stem, a curve, up to the heel */
    prof.push(...straight(at(i, HEEL), at(i, CORNER))); /* the impulse face, ruled */
    prof.push(...straight(at(i, CORNER), at(i, FACE))); /* the locking face, ruled, raked back */
    const tail = Array.from({ length: CLUB.length - FACE - (i ? 0 : 1) }, (_, j) => at(i, FACE + j)); prof.push(...sample(tail, false, 8).slice(1)); /* front of the stem and the root */
  }
  k.pen(prof, 1.8, { seed: 1800, wobble: 0.1, taper: 0.15, progress: s(0) });
  k.pen(Array.from({ length: 15 }, (_, i) => T(R_ESC * 0.92, base - 0.02 + ((2.2 * st) * i) / 14)), 0.8, { seed: 1801, color: CYAN, opacity: 0.8, progress: s(1) }); /* the pitch circle */
  const a1 = base + st * CLUB[CORNER][1], a2 = a1 + st;
  [a1, a2].forEach((a, i) => k.chain(T(R_ESC * 0.5, a), T(R_ESC * 1.1, a), 0.8, { seed: 1802 + i * 4, color: CYAN, progress: stagger(s(2), 2, 0.7)(i) }));
  const aq = s(3); k.pen(Array.from({ length: 9 }, (_, i) => T(R_ESC * 1.07, a1 + (st * i) / 8)), 0.9, { seed: 1810, color: CYAN, progress: cut(aq, 0, 0.6) }); if (aq >= 1) { k.arrow(T(R_ESC * 1.07, a1), a1 - Math.PI / 2, 9, CYAN); k.arrow(T(R_ESC * 1.07, a2), a2 + Math.PI / 2, 9, CYAN); } const tp = T(R_ESC * 1.1, a1 + st / 2); k.text("24o", tp[0], tp[1] - 14, { cap: 9.5, align: "center", seed: 1811, progress: cut(aq, 0.6, 1) });
  /* the rake of the locking face, dimensioned against the radial through the corner */
  const cr = at(1, CORNER), fb = at(1, FACE), d = [fb[0] - cr[0], fb[1] - cr[1]], L = Math.hypot(d[0], d[1]) || 1, ext: P = [cr[0] + (d[0] / L) * 70, cr[1] + (d[1] / L) * 70];
  k.ln(fb, ext, 0.8, { seed: 1813, color: CYAN, progress: cut(s(4), 0, 0.3) });
  k.callout("IMPULSE FACE", [752, 516], lerp2(at(1, HEEL), at(1, CORNER), 0.5), 1812, "left", cut(s(4), 0, 0.45), 8.5);
  k.callout("LOCKING FACE, DRAW 24o", [1012, 752], lerp2(at(1, CORNER), at(1, FACE), 0.5), 1815, "right", cut(s(4), 0.2, 0.65), 8.5);
  k.text("DETAIL C", 760, 780, { cap: 12, seed: 1820, progress: cut(s(4), 0.6, 0.85) }); k.text("ESCAPE WHEEL, CLUB TOOTH, 7 : 1 OF PLAN", 760, 800, { cap: 7.5, seed: 1821, color: CYAN, progress: cut(s(4), 0.8, 1) });
}); };
// DETAIL D: the depthing of the first mesh, drawn fresh at the detail's own size (never a magnified
// plan): ogival wheel teeth whose tip arcs are swung from the opposite flank's pitch point (radius =
// tooth thickness), radial flanks, a root arc; pinion leaves with parallel flanks and a round tip.
// Every outline is ruled segments and compass arcs. A wheel tooth sits in a leaf gap on the line
// of centres, and the two pitch circles are chain lines tangent at the pitch point.
const DD: P = [178, 902], DDR = 104, DDK = 3.6;
const detailD = (k: Kit, q: number) => { if (q <= 0) return; k.ink(() => {
  const s = stagger(q, 5, 0.35), c = k.raw(), K = DDK * S, u: P = [Math.cos(-18 * deg), Math.sin(-18 * deg)], th = Math.atan2(u[1], u[0]);
  const Rw = ((M1 * Z.w0) / 2) * K, rp = ((M1 * Z.p1) / 2) * K, m = M1 * K, Cw: P = [DD[0] - u[0] * Rw, DD[1] - u[1] * Rw], Cp: P = [DD[0] + u[0] * rp, DD[1] + u[1] * rp];
  k.circle(DD[0], DD[1], DDR, 1.5, { seed: 1850, progress: s(0), a0: -2.6 });
  c.save(); c.beginPath(); c.arc(DD[0], DD[1], DDR - 2, 0, Math.PI * 2); c.clip(); k.g.touch(DD[0] - DDR, DD[1] - DDR, DD[0] + DDR, DD[1] + DDR);
  // the wheel: seven teeth either side of the line of centres, one continuous outline
  const tw = (Math.PI * m) / 2, hw = tw / 2 / Rw, gw = (Math.PI * 2) / Z.w0, Rr = Rw - 1.55 * m, wheel: P[] = [];
  for (let j = -4; j <= 4; j++) {
    const a = th + j * gw, L = pol(Cw, Rw, a - hw), R = pol(Cw, Rw, a + hw), tipH = Math.sqrt(tw * tw - (tw / 2) ** 2);
    if (j === -4) wheel.push(...arcPts(Cw, Rr, a - gw / 2, a - hw * 1.08)); else wheel.push(...arcPts(Cw, Rr, a - gw + hw * 1.08, a - hw * 1.08).slice(1));
    wheel.push(...straight(pol(Cw, Rr, a - hw * 1.08), L)); /* radial flank */
    const aL = Math.atan2(L[1] - R[1], L[0] - R[0]), aTip = Math.atan2(pol(Cw, Rw + tipH, a)[1] - R[1], pol(Cw, Rw + tipH, a)[0] - R[0]); wheel.push(...arcPts(R, tw, aL, aTip).slice(1)); /* ogive, swung from the right flank's pitch point */
    const bT = Math.atan2(pol(Cw, Rw + tipH, a)[1] - L[1], pol(Cw, Rw + tipH, a)[0] - L[0]), bR = Math.atan2(R[1] - L[1], R[0] - L[0]); wheel.push(...arcPts(L, tw, bT, bR).slice(1)); /* and from the left's */
    wheel.push(...straight(R, pol(Cw, Rr, a + hw * 1.08)));
    if (j === 4) wheel.push(...arcPts(Cw, Rr, a + hw * 1.08, a + gw / 2).slice(1));
  }
  k.pen(wheel, 1.6, { seed: 1851, wobble: 0.1, taper: 0.1, progress: s(1) });
  // the pinion: eight leaves, a GAP facing the wheel, parallel flanks, round tips
  const lw = rp * (Math.PI / Z.p1) * 0.34, rr = rp - 1.9 * m, tipC = rp + 0.85 * m - lw, pin: P[] = [], back = th + Math.PI;
  for (let j = 0; j < Z.p1; j++) {
    const a = back + Math.PI / Z.p1 + (j * Math.PI * 2) / Z.p1, n: P = [Math.cos(a), Math.sin(a)], t: P = [-n[1], n[0]], at = (r: number, w: number): P => [Cp[0] + n[0] * r + t[0] * w, Cp[1] + n[1] * r + t[1] * w];
    const rootA = (w: number) => Math.sqrt(Math.max(0, rr * rr - w * w)), aNext = a + (Math.PI * 2) / Z.p1;
    pin.push(...straight(at(rootA(lw), -lw), at(tipC, -lw)).slice(j ? 0 : 0)); /* flank */
    pin.push(...arcPts(at(tipC, 0), lw, a - Math.PI / 2, a + Math.PI / 2).slice(1)); /* the round tip */
    pin.push(...straight(at(tipC, lw), at(rootA(lw), lw)).slice(1));
    const g0 = Math.atan2(at(rootA(lw), lw)[1] - Cp[1], at(rootA(lw), lw)[0] - Cp[0]), nn: P = [Math.cos(aNext), Math.sin(aNext)], tt: P = [-nn[1], nn[0]], nx: P = [Cp[0] + nn[0] * rootA(lw) - tt[0] * lw, Cp[1] + nn[1] * rootA(lw) - tt[1] * lw], g1 = Math.atan2(nx[1] - Cp[1], nx[0] - Cp[0]);
    pin.push(...arcPts(Cp, rr, g0, g1 < g0 ? g1 + Math.PI * 2 : g1).slice(1)); /* root */
  }
  k.pen(pin, 1.6, { seed: 1852, closed: true, wobble: 0.1, taper: 0.1, progress: s(2) });
  k.circle(Cp[0], Cp[1], 2.2 * K, 1.2, { seed: 1853, progress: s(2) }); /* the arbor */
  // both pitch circles, chain lines, tangent at the pitch point; and the line of centres
  const chainArc = (cc: P, r: number, a0: number, a1: number, seed: number, qq: number) => { const L = Math.abs(a1 - a0) * r, n = Math.floor(L / 30); for (let i = 0; i < n && i < qq * n; i++) { const d0 = a0 + ((a1 - a0) * (i * 30)) / L, d1 = a0 + ((a1 - a0) * (i * 30 + 19)) / L, e0 = a0 + ((a1 - a0) * (i * 30 + 23)) / L, e1 = a0 + ((a1 - a0) * (i * 30 + 26)) / L; k.pen(arcPts(cc, r, d0, d1, 2), 0.8, { color: CYAN, seed: seed + i * 2, wobble: 0.05, taper: 0.3, opacity: 0.85 }); k.pen(arcPts(cc, r, e0, e1, 1), 0.8, { color: CYAN, seed: seed + i * 2 + 1, wobble: 0.05, taper: 0.3, opacity: 0.85 }); } };
  const pq = s(3), span = (DDR * 1.1) / Rw; chainArc(Cw, Rw, th - span, th + span, 1860, pq); chainArc(Cp, rp, back - Math.PI, back + Math.PI, 1900, pq);
  k.chain([DD[0] - u[0] * 110, DD[1] - u[1] * 110], [DD[0] + u[0] * 110, DD[1] + u[1] * 110], 0.8, { seed: 1870, color: DIM, progress: pq });
  if (pq >= 1) k.fill(k.oval(DD[0], DD[1], 2.4, 2.4, 8), WHITE, 0.95); /* the pitch point */
  c.restore();
  const tq = s(4); k.text("DETAIL D", 302, 832, { cap: 12, seed: 1880, progress: cut(tq, 0, 0.3) }); k.text("DEPTHING, CENTRE WHEEL TO THIRD PINION, 4.4 : 1", 302, 852, { cap: 7.5, seed: 1881, color: CYAN, progress: cut(tq, 0.25, 0.6) });
  k.callout("PITCH CIRCLES TANGENT", [302, 930], DD, 1882, "left", cut(tq, 0.55, 1), 8.5);
}); };
// the ring on the plan that says where Detail C is taken from
const detailRing = (k: Kit, q: number) => {
  const st = (Math.PI * 2) / Z.w3, a = -Math.PI / 2 - st * 0.62, c = pol(PL(...A3), R_ESC * S * 0.9, a); k.circle(c[0], c[1], 19, 1.1, { color: CYAN, seed: 1830, progress: cut(q, 0, 0.4) }); k.text("C", c[0] + 14, c[1] - 32, { cap: 11, seed: 1831, w: 1.5, progress: cut(q, 0.35, 0.5) });
  const d = PL(...pol(A0, (M1 * Z.w0) / 2, -18 * deg)); k.circle(d[0], d[1], 22, 1.1, { color: CYAN, seed: 1832, progress: cut(q, 0.5, 0.9) }); k.text("D", d[0] - 24, d[1] + 18, { cap: 11, seed: 1833, w: 1.5, progress: cut(q, 0.85, 1) });
};
const mm = (d: number) => (d * 0.05).toFixed(2);
const dims = (k: Kit, q: number) => { if (q <= 0) return; k.ink(() => {
  const s = stagger(q, 6, 0.3);
  // the cutting plane: thick at the ends and the steps, chain between, arrows for the direction of view
  const cq = s(0), pts = [CUTL, ...ARB, CUTR].map(([x, y]) => PL(x, y));
  const cs = stagger(cut(cq, 0, 0.7), pts.length - 1, 0.4); for (let i = 0; i + 1 < pts.length; i++) k.chain(pts[i], pts[i + 1], 0.9, { seed: 1900 + i * 10, color: CYAN, progress: cs(i) });
  [[pts[0], [pts[0][0] - 22, pts[0][1]]], [pts[pts.length - 1], [pts[pts.length - 1][0] + 22, pts[pts.length - 1][1]]]].forEach(([a, b], i) => { const qq = cut(cq, 0.65, 0.9); k.ln(a as P, b as P, 2.6, { seed: 1960 + i, taper: 0.1, progress: qq }); if (qq >= 1) { k.ln(b as P, [(b as P)[0], (b as P)[1] + 20], 1.2, { seed: 1962 + i }); k.arrow([(b as P)[0], (b as P)[1] + 24], Math.PI / 2, 11); } k.text("A", (b as P)[0] + (i ? 6 : -16), (b as P)[1] - 20, { cap: 13, seed: 1964 + i, w: 1.7, progress: cut(cq, 0.85, 1) }); });
  // centre distances along the line of centres
  // the section: arbor spacing along the foot, overall length, plate and frame heights
  const fy = TP + GAP + BP, xq = stagger(s(2), 3, 0.5); for (let i = 0; i < 3; i++) k.dim([SX(ARB[i][0]), SZ(fy + 4)], [SX(ARB[i + 1][0]), SZ(fy + 4)], -36, mm(ARB[i + 1][0] - ARB[i][0]), 1930 + i * 6, xq(i), { cap: 8.5, gap: 0, ext: 3 });
  k.dim([SX(X0), SZ(fy)], [SX(X1), SZ(fy)], -62, mm(X1 - X0), 1950, s(3), { cap: 9, gap: 3, ext: 4 });
  const vq = stagger(s(4), 3, 0.5), xl = SX(X1); k.dim([xl, SZ(0)], [xl, SZ(TP)], 18, mm(TP), 1970, vq(0), { cap: 8, gap: 3, ext: 3 }); k.dim([xl, SZ(TP)], [xl, SZ(TP + GAP)], 18, mm(GAP), 1976, vq(1), { cap: 8.5, gap: 3, ext: 3 }); k.dim([xl, SZ(0)], [xl, SZ(fy)], 62, mm(fy), 1982, vq(2), { cap: 8.5, gap: 3, ext: 3 });
  const lq = s(5); k.text("SECTION A-A", SX((X0 + X1) / 2), SZ(fy) + 84, { cap: 13, align: "center", seed: 1990, w: 1.7, progress: cut(lq, 0, 0.6) }); k.ln([SX((X0 + X1) / 2) - 58, SZ(fy) + 104], [SX((X0 + X1) / 2) + 58, SZ(fy) + 104], 1.1, { seed: 1991, progress: cut(lq, 0.55, 0.8) });
  detailRing(k, cut(lq, 0.6, 1));
}); };

const ROWS: [string, string, string, string, string][] = [["1", "CENTRE WHEEL", "64", "0.16", "-"], ["2", "THIRD PINION", "8", "0.16", mm(D01)], ["3", "THIRD WHEEL", "60", "0.16", "-"], ["4", "FOURTH PINION", "8", "0.16", mm(D12)], ["5", "FOURTH WHEEL", "60", "0.12", "-"], ["6", "ESCAPE PINION", "7", "0.12", mm(D23)], ["7", "ESCAPE WHEEL", "15", "CLUB", "-"]];
const table = (k: Kit, q: number) => { if (q <= 0) return; k.ink(() => {
  const x0 = 722, x1 = 1026, y0 = 84, rh = 16.5, yb = y0 + rh * (ROWS.length + 1), fq = cut(q, 0, 0.2), hq = cut(q, 0.15, 0.35), rq = cut(q, 0.3, 0.85), cx = [x0 + 26, x1 - 118, x1 - 86, x1 - 46];
  rule(k, [[x0, y0], [x1, y0], [x1, yb], [x0, yb]], 1.6, 2000, fq); k.ln([x0, y0 + rh], [x1, y0 + rh], 1.4, { seed: 2005, progress: hq }); cx.forEach((x, i) => k.ln([x, y0], [x, yb], 0.95, { seed: 2006 + i, color: CYAN, progress: hq }));
  const mid = [(x0 + cx[0]) / 2, (cx[0] + cx[1]) / 2, (cx[1] + cx[2]) / 2, (cx[2] + cx[3]) / 2, (cx[3] + x1) / 2];
  ["NO.", "PART", "T", "MOD.", "C.D."].forEach((t, i) => k.text(t, mid[i], y0 + 4, { cap: 8, align: "center", seed: 2010 + i, color: CYAN, w: 1.05, progress: stagger(hq, 5, 0.5)(i) }));
  const rs = stagger(rq, ROWS.length, 0.35); ROWS.forEach((row, i) => { const y = y0 + rh * (i + 1), qq = rs(i); if (qq <= 0) return; if (i) k.ln([x0, y], [x1, y], 0.75, { seed: 2020 + i, color: DIM, opacity: 0.7, progress: cut(qq, 0, 0.25) }); const ws = stagger(cut(qq, 0.2, 1), 5, 0.45); row.forEach((t, j) => k.text(t, j === 1 ? cx[0] + 6 : mid[j], y + 4, { cap: 8, align: j === 1 ? "left" : "center", seed: 2030 + i * 7 + j, w: 1.05, progress: ws(j) })); });
  k.text("GOING TRAIN", x0, y0 - 22, { cap: 11, seed: 2070, w: 1.5, progress: cut(q, 0.85, 1) });
  /* the scale bar: millimetres at the scale of the drawing */
  const u = 20 * S, bx = x0, by = 272, sq = stagger(cut(q, 0.6, 1), 6, 0.4);
  for (let i = 0; i < 5; i++) { const a: P = [bx + i * u, by], b: P = [bx + (i + 1) * u, by], qq = sq(i); if (qq <= 0) continue; if (i % 2 === 0 && qq >= 1) k.fill([[a[0], by - 6], [b[0], by - 6], [b[0], by], [a[0], by]], WHITE, 0.9); k.ln([a[0], by - 6], [b[0], by - 6], 1.1, { seed: 2080 + i, progress: qq }); k.ln(a, b, 1.1, { seed: 2086 + i, progress: qq }); k.ln([b[0], by - 10], [b[0], by], 1.1, { seed: 2092 + i, progress: qq }); }
  k.ln([bx, by - 10], [bx, by], 1.1, { seed: 2098, progress: sq(0) }); ["0", "1", "2", "3", "4", "5 MM"].forEach((t, i) => k.text(t, bx + i * u, by - 24, { cap: 7, align: i === 5 ? "left" : "center", seed: 2100 + i, color: CYAN, w: 1, progress: sq(5) }));
}); };
const NOTE_LINES = ["NOTES", "1. 64/8 x 60/8 GIVES 60: THE FOURTH", "   WHEEL TURNS ONCE A MINUTE", "2. WHEELS HARD BRASS, CROSSED OUT", "3. PINIONS & ARBORS STEEL,", "   PIVOTS HARDENED & BURNISHED", "4. OIL SINKS ON OUTER FACES", "5. CENTRE PINION DRIVEN FROM", "   THE BARREL, NOT SHOWN"];
const notes = (k: Kit, q: number) => { if (q <= 0) return; k.ink(() => {
  const s = stagger(q, 3, 0.45);
  // balloons, in number order, each ringed then numbered then led to its part
  const bs = stagger(s(0), 7, 0.35), tgt: [P, P][] = [[[54, 96], pol(PL(...A0), ((M1 * Z.w0) / 2 - 6) * S, -2.35)], [[234, 52], pol(PL(...A1), 8, -2.0)], [[424, 46], pol(PL(...A1), 70 * S, -0.9)], [[520, 458], pol(PL(...A2), 7, 1.6)], [[410, 458], pol(PL(...A2), 48 * S, 2.1)], [[648, 116], pol(PL(...A3), 6, -1.3)], [[612, 458], pol(PL(...A3), 36 * S, 1.2)]];
  tgt.forEach(([at, to], i) => k.balloon(String(i + 1), at, to, 2100 + i * 3, bs(i)));
  // section callouts
  const cs = stagger(s(1), 3, 0.5), fy = TP + GAP + BP;
  k.callout("BUSH, OIL SINK", [SX(ARB[1][0]) - 40, SZ(-30)], [SX(ARB[1][0]), SZ(-1)], 2130, "right", cs(0), 8.5);
  k.callout("PILLAR", [SX(CUTR[0]) + 10, SZ(-30)], [SX(CUTR[0]) + 2, SZ(TP + 30)], 2133, "left", cs(1), 8.5);
  k.callout("TO MOTION WORK", [SX(A0[0]) - 34, SZ(fy) + 22], [SX(A0[0]) - 3, SZ(fy + 18)], 2136, "right", cs(2), 8.5);
  // the notes block, a line at a time
  const ns = stagger(s(2), NOTE_LINES.length, 0.3); NOTE_LINES.forEach((t, i) => k.text(t, 722, 322 + i * 17 + (i ? 6 : 0), { cap: i ? 8.5 : 11, seed: 2150 + i * 3, w: i ? 1.05 : 1.5, color: i ? "#eef6fb" : WHITE, progress: ns(i) }));
}); };

const title = (k: Kit, q: number) => { if (q <= 0) return; k.ink(() => {
  const x0 = 650, x1 = 1026, y0 = 890, f1 = cut(q, 0, 0.3), f2 = cut(q, 0.25, 0.5), sq = cut(q, 0.5, 0.68), tq = cut(q, 0.66, 1);
  ([["PLATE", "IV", x0 + 66], ["SCALE", "10 : 1", x0 + 190], ["SHEET", "1 OF 1", x0 + 314]] as [string, string, number][]).forEach(([a, v, x], i) => { const qq = stagger(f1, 3, 0.55)(i); k.text(a, x, y0 + 67, { cap: 7, align: "center", seed: 2200 + i, color: CYAN, w: 0.95, progress: cut(qq, 0, 0.5) }); k.text(v, x, y0 + 79, { cap: 12.5, align: "center", seed: 2203 + i, w: 1.6, progress: cut(qq, 0.4, 1) }); });
  ([["DRAWN", "F.B.", x0 + 66], ["DIMENSIONS", "MILLIMETRES", x0 + 190], ["DATE", "25 IX 2026", x0 + 314]] as [string, string, number][]).forEach(([a, v, x], i) => { const qq = stagger(f2, 3, 0.55)(i); k.text(a, x, y0 + 104, { cap: 7, align: "center", seed: 2210 + i, color: CYAN, w: 0.95, progress: cut(qq, 0, 0.5) }); k.text(v, x, y0 + 116, { cap: 9.5, align: "center", seed: 2213 + i, w: 1.2, progress: cut(qq, 0.4, 1) }); });
  k.text("WATCH MOVEMENT - PLAN & SECTION A-A", (x0 + x1) / 2, y0 + 45, { cap: 8.6, align: "center", seed: 2220, color: CYAN, w: 1.05, progress: sq });
  k.text("GOING TRAIN", (x0 + x1) / 2, y0 + 14, { cap: 20, align: "center", seed: 2221, w: 2.3, progress: tq });
}); };

// ---------------------------------------------------------------- composition
type Part = (k: Kit, q: number) => void;
const PART: Record<string, Part> = {
  border: (k, q) => border(k, q), titleBox, construct, plate,
  w0: (k, q) => wheelPart(k, 0, q), p1: (k, q) => pinionPart(k, 1, q), w1: (k, q) => wheelPart(k, 1, q), p2: (k, q) => pinionPart(k, 2, q), w2: (k, q) => wheelPart(k, 2, q), p3: (k, q) => pinionPart(k, 3, q), w3: (k, q) => wheelPart(k, 3, q),
  section: sectionOut, lining, detail, detailD, dims, table, notes, title,
};
const progressAt = (f: number, a: number, b: number) => (f >= b ? 1 : f <= a ? 0 : (f - a) / (b - a));

// Everything finished is flattened onto ONE cached surface: the sheet plus the first `n` parts,
// in cue order. Its key is n (and the surface's size), which is everything its pixels depend on;
// going forward it is extended in place (drawing parts n0..n-1 on top of stack(n0) gives exactly
// the pixels of drawing 0..n-1 from scratch), going backward it is rebuilt from the bare sheet.
const stack = (env: Env, n: number) => {
  const s = slot(env, "stack"), have = s.key === null ? -1 : Number(s.key);
  if (have === n) return s.L;
  const g = new Gfx(s.L.ctx, env, 0, DRAFT), k = kit(g);
  let from = have;
  if (have < 0 || have > n) { s.L.ctx.setTransform(1, 0, 0, 1, 0, 0); s.L.ctx.clearRect(0, 0, s.L.canvas.width, s.L.canvas.height); g.cur = s.L.ctx; sheet(k); from = 0; }
  for (let i = from; i < n; i++) PART[CUES[i][0]](k, 1);
  s.key = String(n); return s.L;
};

export const drawBlueprint = (ctx: Ctx, frame: number, env: Env) => {
  const f = Math.max(0, Math.min(N - 1, frame)), n = CUES.filter(([, , b]) => f >= b).length;
  blit(ctx, stack(env, n));
  const g = new Gfx(ctx, env, 0, DRAFT), k = kit(g);
  CUES.forEach(([id, a, b], i) => { if (i < n) return; const q = progressAt(f, a, b); if (q > 0) PART[id](k, q); });
  tooth(g); /* the sheet's tooth is over the whole frame, ink and all */
};

export const blueprint: Film = {
  meta: { title: "Going train · cyanotype drafting sheet", W: 1080, H: 1080, fps: 30, bpm: 120, durationFrames: N },
  assets: { images: {} },
  shots: [{ id: "blueprint", start: 0, end: N, draw: (ctx, f, env) => drawBlueprint(ctx, f, env) }],
};

export const STYLE = { id: "blueprint", name: "Cyanotype blueprint", family: "technical drawing", medium: "ruling pen and spring-bow compass in white ink on Prussian-blue cyanotype stock", nearest: "pocketWatch", hero: "a watch movement's going train, plan and section A-A" };
void GROUND;
