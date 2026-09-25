import { Gfx, rng, type Ctx, type Env, type Layer, type Medium, type P } from "./core";
import type { Film } from "./film";
import { blob, bounds, clamp, clipped, inside, lerp, lerpP, polyLen, resample, smooth } from "./gallery";
import { COMP, ERASE, INK, STUMP, VINE, dab, dur, noiseAt, rubMark, runPass, sideMarks, spiral, stick, zigzag, type Mark, type Step } from "./charcoalErasureKit";

// ONE TREE, FOUR SEASONS · charcoal, erased and redrawn.
//
// MEDIUM, physically: willow vine charcoal (a soft grey stick that skates over the tooth and
// dusts off at a breath) and compressed charcoal (black, crisp, bites into the paper and barely
// erases), on one sheet of heavy cream rag paper with a strong tooth. A paper stump rubs tone
// into the valleys; a kneaded eraser lifts light back out, and never lifts all of it.
// MARKS: the stick's point for structure (vine first, compressed last), the SIDE of the stick for
// tone, the stump's rubbed zigzag for atmosphere, the eraser's drag for light.
// EDGE: vine edges are powdery and broken by the tooth; compressed edges are crisp; stumped tone
// has no edge at all; an erased edge is streaky, in the direction the eraser was dragged.
// ORDER: tone the sky, lift the sun, lay the tree in with vine, build the limbs, twigs in
// compressed, ground and shadow, lift snow. Then, every season, the erase-and-redraw cycle: rub
// out what changed with the kneaded eraser, re-tone, lift the new sun, redraw. Nothing is ever
// fully gone: each season is drawn on the grey residue of the one before.
// PALETTE: one warm black on cream paper. Value only.
// PAPER: heavy rag, felt-marked; its grain is multiplied over everything, charcoal included.
// LIGHT: the sun, low on the left, lifted out of the sky tone. It climbs from winter to summer
// and sinks again for autumn, and the shadow on the ground says where it is: long in winter, a
// pool at the foot in summer, long again in autumn. The ghosts of every sun and every shadow stay.
// SUBJECT: an open-grown English oak in a field, one sheet, winter -> spring -> summer -> autumn.
// STRUCTURE (from knowledge of parkland oaks and tree-identification winter silhouettes): a short
// thick bole with root flare, splitting low into five crooked limbs, the two lowest near
// horizontal (an oak's signature), the crown broader than tall; every fork conserves the limb's
// cross-section (child widths squared sum to the parent's), branches zigzag at each node, twigs
// are short and stiff; summer foliage sits in lobed clumps at the branch ends with dark
// undersides and sky holes; autumn thins it from the outside in and the wind leans the outer twigs.
// WHAT MAKES IT NOT ITS NEIGHBOUR (pocketWatch, ballpoint): tone here is rubbed and lifted, not
// hatched; the eraser is a drawing tool; and the drawing keeps its own history on the sheet.
// MOTION GRAMMAR: every change is made by a hand. A stroke grows from where the stick touched;
// tone arrives drag by drag; the stump and the eraser travel their zigzags; nothing fades.

const W = 1080, H = 1080, N = 540, HOLD = 30;
const HZ = 770;                                   // horizon
const FOOT: P = [540, 884];                       // where the trunk meets the ground
const CHAR_M: Medium = { nib: 1, taper: 1, pressure: 0.6, retrace: false, wobble: 1, rough: 1 };
// The sheet is authored in TREE SPACE and placed on the page by OFF: the oak left of centre, its
// foot on a ground line in the lower third, the canopy filling the upper centre.
const OFF: P = [-78, -46];
const SKY: P[] = [[-200, -200], [1300, -200], [1300, HZ + 4], [-200, HZ + 4]];
const FIELD: P[] = [[-200, HZ - 2], [1300, HZ - 2], [1300, 1200], [-200, 1200]];
// the sun climbs from a low winter sun to a high summer one and drops back for autumn, always to the upper right
const SUNS = { winter: [1080, 560, 28], spring: [1040, 360, 29], summer: [930, 150, 31], autumn: [1010, 262, 31] } as const;
const HAZE: P = [990, 290];                        // where the sky was toned for the sun to be lifted out of

// ---------------------------------------------------------------- the tree
type Br = { c: P[]; w0: number; w1: number; d: number; limb: number };
const TRUNK: P[] = [[537, 896], [534, 840], [537, 780], [541, 730], [544, 700]];
const LIMBS: { c: P[]; w: number }[] = [
  { c: [[534, 716], [470, 676], [400, 657], [332, 643], [262, 614]], w: 25 },   // low left, near horizontal
  { c: [[536, 704], [504, 606], [446, 510], [408, 408], [376, 306]], w: 22 },
  { c: [[546, 700], [562, 594], [534, 474], [556, 346], [538, 214]], w: 25 },
  { c: [[553, 703], [612, 612], [672, 504], [736, 404], [782, 312]], w: 22 },
  { c: [[556, 716], [640, 686], [730, 668], [816, 650], [902, 626]], w: 22 },   // low right
];
const unit = (x: number, y: number): P => { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };
const tanAt = (c: P[], i: number): P => { const a = c[Math.max(0, i - 1)], b = c[Math.min(c.length - 1, i + 1)]; return unit(b[0] - a[0], b[1] - a[1]); };
const growTree = (): Br[] => {
  const out: Br[] = [], r = rng(7);
  const kids = (c: P[], w0: number, w1: number, d: number, limb: number) => {
    out.push({ c, w0, w1, d, limb });
    if (d >= 3) return;
    const n = d === 0 ? 6 : d === 1 ? 3 : 3, L = polyLen(c);
    let side = r() < 0.5 ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const t = (d === 0 ? 0.3 : 0.22) + ((i + 0.3 + r() * 0.5) / n) * (d === 0 ? 0.64 : 0.72), k = Math.round(t * (c.length - 1)), p = c[k], tg = tanAt(c, k);
      const spread = (d === 0 ? 0.62 : 0.55) + r() * 0.4, ca = Math.cos(side * spread), sa = Math.sin(side * spread);
      let dir = unit(tg[0] * ca - tg[1] * sa, tg[0] * sa + tg[1] * ca);
      dir = unit(dir[0] * 0.84, dir[1] * 0.84 - (d === 0 ? 0.22 : 0.3));      // branches reach for the light
      const len = (d === 0 ? L * (1 - t) * 0.62 + 42 : d === 1 ? L * (1 - t) * 0.7 + 22 : 14 + r() * 22) * (0.8 + r() * 0.4);
      const wp = lerp(w0, w1, t), cw = Math.max(0.9, wp * (d === 0 ? 0.52 : 0.6));
      const segs = d >= 2 ? 2 : 4, path: P[] = [p]; let a = Math.atan2(dir[1], dir[0]), q = p;
      for (let s = 0; s < segs; s++) { a += (r() - 0.5) * (d >= 2 ? 0.5 : 0.62); q = [q[0] + Math.cos(a) * len / segs, q[1] + Math.sin(a) * len / segs]; path.push(q); }   // an oak zigzags at every node
      kids(resample(smooth(path, false, 5), Math.max(4, Math.round(len / 4))), cw, d >= 2 ? 0.7 : Math.max(0.9, cw * 0.3), d + 1, limb);
      side = -side;
    }
  };
  LIMBS.forEach((l, i) => { const c = resample(smooth(l.c, false, 8), 90); kids(c, l.w, 4.2, 0, i); });
  return out;
};
// autumn wind from the left leans the crown: displacement grows with the square of height and reach
const bend = ([x, y]: P): P => { const h = clamp((700 - y) / 520, 0, 1.3), reach = Math.abs(x - 540) / 400, s = Math.max(0, h * 0.8 + reach * 0.5); return [x + 30 * s * s, y + 6 * s * s]; };

// summer clumps, hand-placed on the limb ends: [x, y, r]
const CLUMPS: [number, number, number][] = [
  [292, 596, 62], [360, 574, 70], [236, 560, 42],
  [372, 318, 82], [322, 410, 74], [430, 424, 82],
  [520, 232, 90], [610, 312, 84], [458, 300, 72],
  [778, 322, 84], [700, 408, 86], [812, 440, 66],
  [870, 590, 64], [790, 582, 70], [704, 548, 64],
  [540, 450, 92], [616, 520, 78], [440, 520, 78],
];
const clumpShape = (x: number, y: number, r: number, seed: number): P[] => {
  const b = blob(x, y, r, r * 0.82, seed, 0.2, 16);
  return b.map(([px, py]) => { const dy = py - y; return [px, dy > 0 ? y + dy * 0.72 : py] as P; });
};
// A foliage clump is a cauliflower: one core lobe and a crown of smaller lobes, most of them on
// the upper side (the leaves reach for the light), the underside flatter. Lobes are wobbly
// circles so a point test stays cheap; their outlines are the same function, for clipping.
type Lobe = { x: number; y: number; r: number; ph: number };
const lobeR = (l: Lobe, a: number) => l.r * (1 + 0.12 * Math.sin(5 * a + l.ph) + 0.06 * Math.sin(9 * a + 2 * l.ph));
const inLobe = (l: Lobe, x: number, y: number) => { const dx = x - l.x, dy = y - l.y; return dx * dx + dy * dy < (l.r * 1.18) ** 2 && Math.hypot(dx, dy) < lobeR(l, Math.atan2(dy, dx)); };
const lobePoly = (l: Lobe, k = 1): P[] => Array.from({ length: 28 }, (_, i) => { const a = (i / 28) * Math.PI * 2; return [l.x + Math.cos(a) * lobeR(l, a) * k, l.y + Math.sin(a) * lobeR(l, a) * k] as P; });
const lobesOf = (x: number, y: number, r: number, seed: number): Lobe[] => {
  const q = rng(seed), out: Lobe[] = [{ x, y: y + r * 0.08, r: r * 0.62, ph: q() * 6 }], n = 9;
  for (let k = 0; k < n; k++) { const a = -Math.PI - 0.35 + ((k + 0.2 + q() * 0.6) / n) * (Math.PI + 0.7), d = r * (0.5 + q() * 0.16); out.push({ x: x + Math.cos(a) * d * 1.08, y: y + Math.sin(a) * d * 0.9, r: r * (0.27 + q() * 0.14), ph: q() * 6 }); }
  for (let k = 0; k < 3; k++) { const a = 0.55 + k * 1.0 + q() * 0.3, d = r * 0.46; out.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.62, r: r * 0.3, ph: q() * 6 }); }
  return out;
};

// ---------------------------------------------------------------- the passes
type Pass = { id: string; a: number; b: number; steps: (env: Env) => Step[] };
const drawBranch = (b: Br, c: P[], alpha: number, seed: number, rough = 0.6): Mark => ({ t: dur(polyLen(c), b.d >= 2 ? 0.28 : 0.4, b.d >= 2 ? 260 : 420), d: (g, p) => stick(g, c, b.w0, b.w1, alpha, seed, p, { rough }) });
// the shade side of a limb: a strip offset away from the sun, in compressed
const shadeSide = (b: Br, seed: number): Mark => {
  const off = b.c.map((p, i) => { const tg = tanAt(b.c, i); let nx = -tg[1], ny = tg[0]; if (-nx * 0.72 + ny * 0.62 < 0) { nx = -nx; ny = -ny; } const w = lerp(b.w0, b.w1, i / (b.c.length - 1)); return [p[0] + nx * w * 0.26, p[1] + ny * w * 0.26] as P; });
  return { t: dur(polyLen(off), 0.3, 520), d: (g, p) => stick(g, off, b.w0 * 0.5, b.w1 * 0.5, 0.88, seed, p, { rough: 0.9 }) };
};
const trunkPoly = (): P[] => {  // the bole with its root flare
  const c = resample(smooth(TRUNK, false, 8), 40), L: P[] = [], R: P[] = [];
  c.forEach((p, i) => { const t = i / 39, tg = tanAt(c, i), w = 34 - 8 * t + 44 * Math.pow(clamp(1 - t / 0.3), 2.6); L.push([p[0] + tg[1] * w, p[1] - tg[0] * w]); R.push([p[0] - tg[1] * w * 1.04, p[1] + tg[0] * w * 1.04]); });
  return [...L, ...R.reverse()];
};
// a shadow on the ground: project a point of height h along the sun's (kx, ky) per unit height
const project = (kx: number, ky: number) => ([x, y]: P): P => { const h = FOOT[1] - y; return [x + h * kx, FOOT[1] + h * ky]; };
const sunLift = (s: readonly number[], seed: number): Step[] => [
  { o: ERASE(0.18, 10), m: [rubMark(spiral(s[0], s[1], 4, s[2] * 1.4, 3, seed + 1), 22, 1)] },       // the glow: a wide light rub
  { o: ERASE(0.88, 2.2), m: [rubMark(spiral(s[0], s[1], 2, s[2] - 6, 3.6, seed), 13, 1)] },          // the disc: pressed and turned
];
const retone = (s: readonly number[], seed: number): Step[] => [
  { o: VINE, m: sideMarks(clumpShape(s[0], s[1], s[2] * 2.2, seed), { angle: -0.22, gap: 7, w: 14, alpha: 0.05, seed, per: 900 }) },
  { o: STUMP(10), m: zigzag(bounds(clumpShape(s[0], s[1], s[2] * 2.2, seed)), 22, 24, seed + 3).map((row) => rubMark(row, 40, 0.04, INK, SKY)) },
];

const PASSES = (env: Env): Pass[] => {
  const tree = cached(env, "ce:tree", growTree), limbs = tree.filter((b) => b.d <= 1), fine = tree.filter((b) => b.d >= 2);
  const clumps = CLUMPS.map(([x, y, r], i) => { const lobes = lobesOf(x, y, r, 300 + i * 7), polys = lobes.map((l) => lobePoly(l)); return { x, y, r, i, lobes, polys, s: [[x - r * 1.25, y - r * 1.2], [x + r * 1.25, y - r * 1.2], [x + r * 1.25, y + r * 0.95], [x - r * 1.25, y + r * 0.95]] as P[], test: (px: number, py: number) => lobes.some((l) => inLobe(l, px, py)) }; });
  const canopy = (x: number, y: number) => clumps.some((k) => Math.hypot(x - k.x, (y - k.y) * 1.1) < k.r * 1.08);
  const shadowOf = (kx: number, ky: number, set: Br[], k: number, seed: number): Mark[] => { const pr = project(kx, ky); return set.map((b, i) => { const c = b.c.map(pr); return { t: dur(polyLen(c), 0.12, 900), d: (g, p) => stick(g, c, b.w0 * k, b.w1 * k, 0.36, seed + i, p, { rough: 1.4 }) }; }); };
  const trunkShadow = (kx: number, ky: number, seed: number): Mark => { const pr = project(kx, ky), c = resample(smooth(TRUNK, false, 6), 20).map(pr); return { t: 1, d: (g, p) => stick(g, c, 56, 30, 0.4, seed, p, { rough: 2 }) }; };
  const hedge: P[] = (() => { const top: P[] = []; for (let x = -10; x <= W + 10; x += 12) { const gap = x > 612 && x < 772, bump = HEDGE_TREES.reduce((a, [bx, bw, bh]) => Math.max(a, bh * Math.sqrt(clamp(1 - ((x - bx) / bw) ** 2))), 0), h = gap ? 0 : 5 + 7 * noiseAt(90, x, 0, 0.03) + bump * (0.85 + 0.3 * noiseAt(91, x, 0, 0.06)); top.push([x, HZ - h]); } return [...top, [W + 10, HZ + 6], [-10, HZ + 6]]; })();
  const fieldTone = (seed: number, alpha: number, near: number): Mark[] => sideMarks(FIELD, { angle: 0.04, gap: 7, w: 9, alpha, seed, keep: (x, y) => Math.hypot((x - FOOT[0]) * 0.55, (y - FOOT[1]) * 1.6) < 110 + 90 * near * (noiseAt(seed, x, y, 0.01) - 0.3), per: 1200 });
  const twigTips = fine.filter((b) => b.d === 3);

  return [
    // WINTER ------------------------------------------------------------------------------
    { id: "w_tone", a: 0, b: 40, steps: () => [
      { o: STUMP(9), m: sideMarks(SKY, { angle: -0.22, gap: 7, w: 18, alpha: 0.075, seed: 11, keep: (x, y) => Math.hypot(x - HAZE[0], (y - HAZE[1]) * 0.8) < 200 + 120 * (noiseAt(12, x, y, 0.01) - 0.5) * 2, per: 1800 }) },
      // (the drags were rubbed in as they went: the stump group softens them, so the haze has no edge)
    ] },
    { id: "w_sun", a: 40, b: 55, steps: () => sunLift(SUNS.winter, 20) },
    { id: "w_lay", a: 55, b: 80, steps: () => [
      { o: VINE, m: [
        { t: 0.8, d: (g, p) => stick(g, [[0, HZ + 1], [W * 0.5, HZ - 1], [W, HZ + 2]], 2.2, 2.2, 0.35, 30, p, { ends: 0.05 }) },
        ...[trunkPoly().slice(0, 40), trunkPoly().slice(40)].map((c, i): Mark => ({ t: 0.6, d: (g, p) => stick(g, c, 3, 2.4, 0.45, 31 + i, p, { ends: 0.1 }) })),
        ...LIMBS.map((l, i): Mark => { const c = smooth(l.c, false, 8); return { t: dur(polyLen(c), 0.2, 700), d: (g, p) => stick(g, c, 3.2, 2, 0.4, 40 + i, p, { ends: 0.08 }) }; }),
      ] },
    ] },
    { id: "w_limbs", a: 80, b: 120, steps: () => [
      { o: VINE, m: [...sideMarks(trunkPoly(), { angle: Math.PI / 2 - 0.06, gap: 3.2, w: 7, alpha: 0.6, seed: 99, per: 300 }), ...limbs.map((b, i) => drawBranch(b, b.c, 0.8, 100 + i))] },
      { o: COMP, m: [...limbs.filter((b) => b.w0 > 6).map((b, i) => shadeSide(b, 200 + i)), { t: 1, d: (g, p) => stick(g, resample(smooth(TRUNK, false, 6), 30).map(([x, y]) => [x - 14, y] as P).reverse().slice(0, 28).reverse(), 34, 20, 0.92, 97, p, { rough: 1.6 }) }, ...bark()] },
    ] },
    { id: "w_twigs", a: 120, b: 150, steps: () => [{ o: COMP, m: fine.map((b, i) => drawBranch(b, b.c, 0.84, 400 + i, 0.3)) }] },
    { id: "w_ground", a: 150, b: 175, steps: () => [
      { o: VINE, m: [...sideMarks(hedge, { angle: -1.2, gap: 3.6, w: 5, alpha: 0.17, seed: 50, per: 500 })] },
      { o: STUMP(4), m: [...zigzag(bounds(hedge), 9, 12, 51).map((row) => rubMark(row, 12, 0.2, INK, hedge))] },
      { o: { ...VINE, blur: 1.6 }, m: [...shadowOf(-1.25, 0.3, limbs, 0.8, 60), trunkShadow(-1.25, 0.3, 58)] },
      { o: COMP, m: [contact(0.9, 70), ...tufts(71, 26)] },
    ] },
    { id: "w_snow", a: 175, b: 190, steps: () => [
      { o: ERASE(0.8, 1), m: limbs.filter((b) => b.w0 > 3).map((b, i) => snowCap(b, 80 + i)).filter((m): m is Mark => !!m) },
      { o: ERASE(0.55, 1.2), m: [rimLight(81)] },
    ] },
    // SPRING ------------------------------------------------------------------------------
    { id: "s_erase", a: 190, b: 210, steps: () => [
      { o: ERASE(0.8, 4), m: zigzag({ x0: -120, y0: 902, x1: 470, y1: 1150 }, 26, 30, 110, -0.25).map((row) => rubMark(row, 36, 1, INK, FIELD)) },
    ] },
    { id: "s_retone", a: 210, b: 225, steps: () => retone(SUNS.winter, 120) },
    { id: "s_sun", a: 225, b: 235, steps: () => sunLift(SUNS.spring, 130) },
    { id: "s_ground", a: 235, b: 265, steps: () => [
      { o: STUMP(5), m: fieldTone(140, 0.11, 0.35) },
      { o: { ...VINE, blur: 1.6 }, m: [...shadowOf(-0.85, 0.24, limbs, 0.7, 141), trunkShadow(-0.85, 0.24, 142)] },
      // (the field is stumped only where it was toned, round the foot)
      { o: COMP, m: tufts(144, 60) },
    ] },
    { id: "s_buds", a: 265, b: 290, steps: () => [{ o: VINE, m: twigTips.map((b, i) => budMark(b, 500 + i)) }] },
    // SUMMER ------------------------------------------------------------------------------
    { id: "u_erase", a: 290, b: 305, steps: () => [
      { o: ERASE(0.8, 4), m: zigzag({ x0: -60, y0: 884, x1: 400, y1: 1120 }, 26, 30, 210, -0.2).map((row) => rubMark(row, 36, 1, INK, FIELD)) },
    ] },
    { id: "u_retone", a: 305, b: 315, steps: () => retone(SUNS.spring, 220) },
    { id: "u_sun", a: 315, b: 325, steps: () => sunLift(SUNS.summer, 230) },
    { id: "u_mass", a: 325, b: 355, steps: () => [{ o: VINE, m: clumps.flatMap((k) => [
      ...sideMarks(k.s, { angle: -0.55 + (k.i % 4) * 0.28, gap: 3.4, w: 7, alpha: 0.2, seed: 600 + k.i, per: 700, test: k.test }),
      ...sideMarks(k.s, { angle: 0.75 - (k.i % 3) * 0.2, gap: 3.8, w: 7, alpha: 0.24, seed: 640 + k.i, test: k.test, keep: (x, y) => -(x - k.x) * 0.55 + (y - k.y) > -k.r * 0.2 + (noiseAt(641 + k.i, x, y, 0.04) - 0.5) * k.r * 0.6, per: 700 }),  // the shade side, worked again
      ...sideMarks(k.s, { angle: 1.3, gap: 4.2, w: 6, alpha: 0.26, seed: 680 + k.i, test: k.test, keep: (x, y) => -(x - k.x) * 0.4 + (y - k.y) > k.r * 0.2, per: 700 }),                                       // the underside, a third time
    ]) }] },
    { id: "u_blend", a: 355, b: 370, steps: () => [{ o: STUMP(5), m: clumps.flatMap((k) => zigzag(bounds(k.s), 18, 18, 700 + k.i, -0.5 + k.i * 0.3).map((row) => rubMark(row, 22, 0.16, INK, k.polys, 2400))) }] },
    { id: "u_lift", a: 370, b: 385, steps: () => [
      { o: ERASE(0.58, 2), m: clumps.flatMap((k) => k.lobes.filter((l) => -(l.x - k.x) * 0.7 + (l.y - k.y) < -k.r * 0.25).map((l, j) => rubMark(spiral(l.x + l.r * 0.28, l.y - l.r * 0.32, 1, l.r * 0.5, 1.6, 720 + k.i * 13 + j), 8, 1, INK, lobePoly(l, 0.92), 900))) },
      { o: ERASE(0.8, 1.2), m: SKYHOLES.map(([x, y, r], i) => rubMark(spiral(x, y, 1, r, 2, 740 + i), 6, 1)) },
    ] },
    { id: "u_dark", a: 385, b: 400, steps: () => [
      { o: COMP, m: clumps.flatMap((k) => k.lobes.filter((l) => l.y > k.y + k.r * 0.05).map((l, j): Mark => { const arc: P[] = Array.from({ length: 9 }, (_, q) => { const a = 0.35 + (q / 8) * 2.4; return [l.x + Math.cos(a) * lobeR(l, a) * 0.9, l.y + Math.sin(a) * lobeR(l, a) * 0.9] as P; }); return { t: 0.16, d: (g, p) => stick(g, arc, 5.5, 2, 0.5, 760 + k.i * 7 + j, p, { ends: 0.25, rough: 1.4 }) }; })) },
      { o: VINE, m: clumps.map((k, i): Mark => { const pr = project(-0.22, 0.07), [sx, sy] = pr([k.x, k.y]); const s = blob(sx, sy, k.r * 0.95, k.r * 0.2, 780 + i, 0.2, 12); return { t: 0.25, d: (g, p) => { if (p > 0) fillSolid(g, s, 0.2 * p); } }; }) },
      { o: COMP, m: [contact(0.95, 790)] },
    ] },
    // AUTUMN ------------------------------------------------------------------------------
    { id: "a_erase", a: 400, b: 425, steps: () => [
      { o: RUB(0.93), m: clumps.filter((k) => !KEEP.includes(k.i)).flatMap((k) => zigzag(bounds(k.s), 16, 24, 800 + k.i, 0.3 + k.i * 0.4).map((row) => rubMark(row, 30, 1, INK, k.lobes.map((l) => lobePoly(l, 1.12)), 2400))) },
      { o: RUB(0.8), m: clumps.filter((k) => KEEP.includes(k.i)).flatMap((k) => zigzag(bounds(k.s), 16, 24, 850 + k.i, -0.3).map((row) => rubMark(row, 30, 1, INK, k.lobes.map((l) => lobePoly(l, 1.12)), 2400))) },
      { o: ERASE(0.8, 5), m: [...zigzag({ x0: 300, y0: 904, x1: 900, y1: 960 }, 22, 26, 820, 0), ...zigzag({ x0: 612, y0: 868, x1: 900, y1: 904 }, 22, 26, 821, 0)].map((row) => rubMark(row, 30, 1, INK, FIELD)) },   // round the bole, never through it
    ] },
    { id: "a_retone", a: 425, b: 435, steps: () => retone(SUNS.summer, 830) },
    { id: "a_sun", a: 435, b: 445, steps: () => sunLift(SUNS.autumn, 840) },
    { id: "a_branch", a: 445, b: 470, steps: () => [{ o: COMP, m: tree.filter((b) => b.d >= 1 && b.c.some(([x, y]) => canopy(x, y))).map((b, i) => drawBranch({ ...b, w0: b.w0 * 0.8 }, b.c.map(bend), 0.9, 900 + i, 0.4)) }] },
    { id: "a_leaves", a: 470, b: 490, steps: () => [
      { o: VINE, m: clumps.filter((k) => KEEP.includes(k.i)).flatMap((k) => autumnClump(k.x, k.y, k.r, 1000 + k.i * 13)) },
      { o: { ...VINE, blur: 1.6 }, m: [...shadowOf(-1.3, 0.3, limbs, 0.85, 1050), trunkShadow(-1.3, 0.3, 1051)] },
      { o: COMP, m: clumps.filter((k) => KEEP.includes(k.i)).flatMap((k) => autumnClump(k.x, k.y, k.r * 0.6, 1100 + k.i * 13, 0.72)) },
    ] },
    { id: "a_fall", a: 490, b: 510, steps: () => [{ o: COMP, m: [contact(0.7, 1190), ...FALLING.map(([x, y, a], i) => leafMark(x, y, a, 1.45, 1200 + i, 1, 0.82)), ...drift(1300)] }] },
  ];
};
const HEDGE_TREES: [number, number, number][] = [[46, 44, 26], [128, 58, 40], [262, 36, 18], [338, 52, 30], [428, 30, 14], [846, 40, 22], [952, 70, 42], [1052, 44, 24]];   // distant field trees in the hedge line, a gateway gap to the right of the oak
// a big kneaded-eraser rub, worked over twice: lifts almost everything, evenly
const RUB = (alpha: number) => ({ blend: "destination-out" as GlobalCompositeOperation, alpha, textures: ["ce_blend"], blur: 7 });
const KEEP = [1, 5, 7, 8, 10, 13, 15, 16, 17];                          // the clumps that hold on longest: sheltered, low, leeward
const SKYHOLES: [number, number, number][] = [[478, 378, 11], [652, 440, 9], [566, 300, 8], [402, 486, 8], [742, 478, 10]];
const FALLING: [number, number, number][] = [[866, 690, 0.6], [934, 742, -0.9], [812, 752, 2.1], [980, 668, 1.2], [760, 812, -0.3], [904, 822, 0.9], [1010, 790, -1.6], [700, 700, 2.6], [996, 520, 0.4], [946, 610, -2.2], [1040, 880, 1.7]];

const fillSolid = (g: Gfx, s: P[], a: number) => { const c = g.cur, b = bounds(s); g.touch(b.x0 - 2, b.y0 - 2, b.x1 + 2, b.y1 + 2); c.globalAlpha = a; c.fillStyle = INK; c.beginPath(); s.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill(); c.globalAlpha = 1; };
// oak bark: deep vertical fissures, broken, darker on the shade side of the bole
const bark = (): Mark[] => { const r = rng(300), out: Mark[] = []; for (let i = 0; i < 26; i++) { const u = r(), x0 = 514 + u * 52 + (r() - 0.5) * 4, y0 = 712 + r() * 120, len = Math.min(24 + r() * 50, 868 - y0), c: P[] = [[x0, y0], [x0 + (r() - 0.5) * 5, y0 + len * 0.5], [x0 + (r() - 0.5) * 6, y0 + len]]; out.push({ t: 0.18, d: (g, p) => stick(g, c, 2.4 + u * 1.6, 1.2, 0.5 + u * 0.4, 310 + i, p, { ends: 0.25, rough: 1 }) }); } return out; };
const contact = (a: number, seed: number): Mark => { const c: P[] = [[470, 892], [510, 898], [560, 899], [604, 893]]; return { t: 0.5, d: (g, p) => stick(g, c, 7, 4, a, seed, p, { ends: 0.2, rough: 1.2 }) }; };
const tufts = (seed: number, n: number): Mark[] => { const r = rng(seed), out: Mark[] = [], cl: P[] = Array.from({ length: Math.max(3, Math.round(n / 6)) }, () => [60 + r() * 960, HZ + 60 + Math.pow(r(), 0.6) * (H - HZ - 80)] as P); for (let i = 0; i < n; i++) { const c0 = cl[i % cl.length], x = c0[0] + (r() - 0.5) * 70, y = c0[1] + (r() - 0.5) * 30; if (Math.abs(x - 540) < 90 && y < 900) continue; const s = 0.4 + (y - HZ) / (H - HZ), bl = 3 + Math.floor(r() * 4); for (let k = 0; k < bl; k++) { const lean = (r() - 0.45) * 0.9, h = (7 + r() * 18) * s, x0 = x + (r() - 0.5) * 9 * s, al = 0.45 + r() * 0.3, c: P[] = [[x0, y + r() * 2], [x0 + lean * h * 0.35, y - h * 0.55], [x0 + lean * h, y - h]]; out.push({ t: 0.08, d: (g, p) => stick(g, c, 1.4 * s, 0.3, al, seed * 7 + i * 5 + k, p, { rough: 0.25 }) }); } } return out; };
const snowCap = (b: Br, seed: number): Mark | null => {
  const top = b.c.map((p, i) => { const tg = tanAt(b.c, i), w = lerp(b.w0, b.w1, i / (b.c.length - 1)); let nx = -tg[1], ny = tg[0]; if (ny > 0) { nx = -nx; ny = -ny; } return { p: [p[0] + nx * w * 0.36, p[1] + ny * w * 0.36] as P, flat: Math.abs(tg[1]) < 0.55 }; });
  const run = top.filter((q) => q.flat).map((q) => q.p); if (run.length < 4) return null;
  return { t: dur(polyLen(run), 0.2, 600), d: (g, p) => stick(g, run, Math.max(1.4, b.w0 * 0.32), 1, 1, seed, p, { ends: 0.15, rough: 0.8 }) };
};
const rimLight = (seed: number): Mark => { const t = trunkPoly(); const tt = t.slice(t.length - 36, t.length - 4).map(([x, y]) => [x - 4, y] as P); return { t: 0.6, d: (g, p) => stick(g, tt, 3, 2, 1, seed, p, { ends: 0.2 }) }; };
const budMark = (b: Br, seed: number): Mark => { const e = b.c[b.c.length - 1], r = rng(seed), n = 2 + Math.floor(r() * 3), pts: [number, number, number][] = []; for (let k = 0; k < n; k++) pts.push([e[0] + (r() - 0.5) * 9, e[1] + (r() - 0.6) * 8, r() * 3]); return { t: 0.09, d: (g, p) => pts.slice(0, Math.ceil(p * n)).forEach(([x, y, a], k) => dab(g, x, y, 2.6, 1.5, a, 0.5, seed * 3 + k)) }; };
// autumn foliage: no mass any more, separate leaves dabbed in, drifted downwind, holes everywhere
const autumnClump = (cx: number, cy: number, r: number, seed: number, a = 0.5): Mark[] => {
  const rr = rng(seed), out: Mark[] = [], [bx, by] = bend([cx, cy]);
  for (let i = 0; i < Math.round(r * 1.3); i++) { const ang = rr() * Math.PI * 2, d = Math.sqrt(rr()) * r * 0.85, x = bx + Math.cos(ang) * d, y = by + Math.sin(ang) * d * 0.75; if (noiseAt(seed, x, y, 0.03) > 0.58) continue; const shade = -(x - bx) * 0.5 + (y - by) > 0 ? 1 : 0.6; const sz = 0.8 + rr() * 0.6; out.push({ t: 0.035, d: (g, p) => { if (p > 0) dab(g, x, y, 5.2 * sz, 3 * sz, ang, a * shade, seed + i); } }); }
  return out;
};
const leafMark = (x: number, y: number, a: number, k: number, seed: number, flat = 1, alpha = 0.78): Mark => {
  // an oak leaf, seen tumbling: a lobed outline (five rounded lobes a side) and a stalk
  const L = 13 * k, pts: P[] = []; for (let i = 0; i <= 20; i++) { const t = i / 20, u = Math.sin(t * Math.PI), lobe = 0.72 + 0.28 * Math.abs(Math.sin(t * Math.PI * 5)); pts.push([t * L - L / 2, -u * L * 0.32 * lobe]); } for (let i = 20; i >= 0; i--) { const t = i / 20, u = Math.sin(t * Math.PI), lobe = 0.72 + 0.28 * Math.abs(Math.sin(t * Math.PI * 5 + 0.6)); pts.push([t * L - L / 2, u * L * 0.3 * lobe]); }
  const ca = Math.cos(a), sa = Math.sin(a), sq = 0.55 + 0.45 * Math.abs(Math.sin(seed)), T = ([px, py]: P): P => [x + px * ca - py * sq * sa, y + (px * sa + py * sq * ca) * flat];
  const shape = pts.map(T), stalk = [T([-L / 2, 0]), T([-L / 2 - 4 * k, 1])];
  return { t: 0.22, d: (g, p) => { if (p <= 0) return; fillSolid(g, shape.slice(0, Math.max(3, Math.round(shape.length * p))), alpha); if (p > 0.8) stick(g, stalk, 1.2, 0.6, 0.8, seed, 1); } };
};
// fallen leaves: a drift on the leeward side of the bole, thick at the roots, thinning out, with bare rests
const drift = (seed: number): Mark[] => { const r = rng(seed), out: Mark[] = []; for (let i = 0; i < 90; i++) { const u = Math.pow(r(), 1.8), ang = -0.3 + r() * 3.6, d = 34 + u * 300, x = 548 + Math.cos(ang) * d, y = 890 + Math.sin(ang) * d * 0.34 + (r() - 0.5) * 16; if (y < 882 || y > H - 8 || noiseAt(seed, x, y, 0.018) > 0.56) continue; const k = 0.6 + (y - 870) / 260; out.push(leafMark(x, y, r() * 6.28, k, seed + i, 0.5, 0.45 + r() * 0.4)); } return out; };

// ---------------------------------------------------------------- the clock and the sheet
const PASS_KEYS = (env: Env) => cached(env, "ce:passes", () => PASSES(env));
function cached<T>(env: Env, key: string, fn: () => T): T { let v = env.cache.get(key) as T | undefined; if (v === undefined) { v = fn(); env.cache.set(key, v); } return v; }
const check = () => { const p = PASSES({ W, H, scale: 1, cache: new Map(), canvas: () => { throw new Error("no canvas at load"); } } as unknown as Env); let t = 0; for (const s of p) { if (s.a !== t || s.b <= s.a || s.a % 5 || s.b % 5) throw new Error(`charcoalErasure: pass ${s.id} off grid (${s.a}-${s.b}, expected start ${t})`); t = s.b; } if (t !== N - HOLD) throw new Error(`charcoalErasure: passes end at ${t}, expected ${N - HOLD}`); };
check();

const sheetGfx = (L: Layer, env: Env) => { const g = new Gfx(L.ctx, env, 0, CHAR_M); g.push(OFF[0], OFF[1], 1); return g; };
const blobOf = (c: P, r: number): P[] => blob(c[0], c[1], r, r * 0.8, 17, 0.25, 18);
const DW = (env: Env) => Math.round(env.W * env.scale), DH = (env: Env) => Math.round(env.H * env.scale);
const copyInto = (dst: Layer, src: Layer | null) => { const c = dst.ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; if (src) { c.globalCompositeOperation = "copy"; c.drawImage(src.canvas as CanvasImageSource, 0, 0); c.globalCompositeOperation = "source-over"; } else c.clearRect(0, 0, dst.canvas.width, dst.canvas.height); };
// the charcoal on the sheet after pass i is finished: a pure function of (i, scale, size)
const stateAt = (env: Env, i: number): Layer | null => {
  if (i < 0) return null;
  const key = `ce:state:${i}:${env.scale}:${env.W}x${env.H}`, hit = env.cache.get(key) as Layer | undefined; if (hit) return hit;
  const prev = stateAt(env, i - 1), L = env.canvas(DW(env), DH(env)); copyInto(L, prev);
  const g = sheetGfx(L, env); runPass(g, PASS_KEYS(env)[i].steps(env), 1);
  env.cache.set(key, L); env.cache.delete(`ce:state:${i - 3}:${env.scale}:${env.W}x${env.H}`);   // sequential renders only ever look one pass back
  return L;
};
const passProgress = (f: number, a: number, b: number) => clamp((f - a) / ((b - a) * 0.88));   // a breath between passes

export const drawCharcoal = (ctx: Ctx, f: number, env: Env) => {
  const passes = PASS_KEYS(env), last = passes.length - 1;
  let sheet: Layer | null;
  if (f >= N - HOLD) sheet = stateAt(env, last);
  else {
    const i = passes.findIndex((p) => f >= p.a && f < p.b), p = passProgress(f, passes[i].a, passes[i].b);
    const wkey = `ce:work:${env.scale}:${env.W}x${env.H}`; let work = env.cache.get(wkey) as Layer | undefined; if (!work) { work = env.canvas(DW(env), DH(env)); env.cache.set(wkey, work); }
    copyInto(work, stateAt(env, i - 1));
    if (p > 0) runPass(sheetGfx(work, env), passes[i].steps(env), p);
    sheet = work;
  }
  // the sheet: cream rag, its felt texture, then the charcoal, then the tooth over all of it
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#ece5d5"; ctx.fillRect(0, 0, DW(env), DH(env));
  const g = new Gfx(ctx, env, 0, CHAR_M);
  g.paper("ce_sheet", 0.22);
  if (sheet) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(sheet.canvas as CanvasImageSource, 0, 0); ctx.restore(); }   // device to device: Gfx leaves ctx at env.scale
  g.paper("paper", 0.16);
  g.vignette("rgba(120,100,80,0.10)");
  void inside; void lerpP;
};

export const charcoalErasure: Film = {
  meta: { title: "One tree, four seasons · charcoal", W, H, fps: 30, bpm: 120, durationFrames: N },
  assets: { images: {} },
  shots: [{ id: "seasons", start: 0, end: N, draw: drawCharcoal }],
};

export const STYLE = { id: "charcoalErasure", name: "Charcoal, erased and redrawn", family: "dry media", medium: "vine and compressed charcoal on heavy rag paper, stumped, lifted with a kneaded eraser, redrawn over its own residue", nearest: "pocketWatch", hero: "one oak through four seasons on one sheet" };
