import { Gfx, rng, fractal, type Medium, type P } from "./core";
import type { Film } from "./film";
import { clamp, lerpP, resample, smooth } from "./gallery";
import { brush, strokeDraw, timeline, runProcess, tone, JIAO, NONG, ZHONG, DAN, QING, type Brush, type Proc } from "./sumiEKit";

// BAMBOO IN WIND, A SPARROW · sumi-e (水墨, ink painting on xuan paper).
//
// MEDIUM, physically: one soft goat-and-wolf-hair brush, loaded once from an inkstone and
// reloaded rarely, on unsized xuan (rice) paper that drinks ink the instant it touches. Nothing
// can be corrected or covered: every mark is one gesture, laid once.
// THE MARK: a brush of real hairs. Each hair holds its own ink and spends it with travel, the
// edge hairs first, so a stroke starts wet and dense and ends in dry-brush: "flying white" (飞白),
// streaks of bare paper running WITH the stroke, and split hairs splaying at the lift. Where the
// brush slows (touch-down, the pause at a bamboo node, the lift) the ink bleeds into the paper
// fibres: a soft halo and fine feathers wicking outward. That halo is the tell of absorbent paper.
// THE EDGE: soft-feathered where wet, broken and bristled where dry. Never a clean outline.
// TONE: only by dilution, the five inks (墨分五色): scorched, thick, heavy, light, clear. The front
// stalk is thick ink, the stalk behind it light, the farthest clear: depth is dilution.
// ORDER (the Mustard Seed Garden manual's bamboo order): stalks first, each in single upward
// strokes one segment at a time, the brush pausing and lifting at every node; then the nodes in
// darker ink; then the branches from the nodes; then the leaves in pressed-lifted strokes, in
// groups (个 three, 介 four), front leaves thick, back leaves light; then the bird (beak, eye,
// head, back, wing, tail, belly, feet, the manual's own order for birds); then dry accents; the
// seal is stamped last.
// PAPER: warm unbleached xuan, long fibres and bark flecks in the sheet, no tooth to speak of.
// LIGHT: diffuse daylight from the upper left. Sumi-e carries light by leaving paper, not by
// cast shadow: the sparrow's lit crown and back are the brush's dry lift, its belly is bare paper
// with one clear-ink wash on the underside away from the light.
// SUBJECT: two stalks of bamboo (Phyllostachys, the painter's bamboo) and a third far behind,
// bowed right by a wind from the left, leaves streaming downwind. A Eurasian tree sparrow
// (Passer montanus, the sparrow of Chinese bird-and-flower painting) grips a side branch, facing
// INTO the wind, feathers sleeked: the one still thing in a moving picture.
// REFERENCE (from knowledge): the bamboo plates of the Mustard Seed Garden Manual (芥子园画传):
// segment proportions (short at the base, longest mid-stalk), node strokes, leaf groups and
// "wind bamboo" (风竹) leaf angles; Wu Zhen and Zheng Banqiao's wind bamboo for the bowing stalk;
// Qi Baishi's sparrows for the stroke economy: chestnut cap, black ear spot on a white cheek,
// black bib, streaked mantle, barred wing, belly left as paper.
// SEAL: cinnabar paste, a baiwen (white-line) seal: the characters are cut INTO the stone, so they
// print as paper inside red. The glyphs are an invented seal-script mark, deliberately not text.

const SUMI_M: Medium = { nib: 1, taper: 1, pressure: 1, retrace: false, wobble: 0, rough: 0 };
const PAPER = "#f3ede0";
const W = 1080, H = 1080; // the frame; everything below is authored in these units
const N = 510;            // 17 s at 30 fps; the last 30 frames are the finished painting

// ---------------------------------------------------------------- the paper
const ground = (g: Gfx) => {
  const c = g.cur, e = g.env; c.setTransform(e.scale, 0, 0, e.scale, 0, 0); c.fillStyle = PAPER; c.fillRect(0, 0, e.W, e.H);
  // the sheet: long fibres laid in the vat, and flecks of bark that were never beaten out
  g.group("plain", () => {
    const k = g.cur, r = rng(501); k.lineCap = "round";
    for (let i = 0; i < 340; i++) {
      const x = r() * e.W, y = r() * e.H, a = (fractal(502, x, y, 0.004, 0.004, 2) - 0.5) * 5, L = 18 + r() * 70, bend = (r() - 0.5) * 0.5;
      k.strokeStyle = r() < 0.5 ? "#d9cfbc" : "#fbf7ee"; k.globalAlpha = 0.35 + r() * 0.35; k.lineWidth = 0.4 + r() * 0.6;
      k.beginPath(); k.moveTo(x, y); k.quadraticCurveTo(x + Math.cos(a + bend) * L * 0.5, y + Math.sin(a + bend) * L * 0.5, x + Math.cos(a) * L, y + Math.sin(a) * L); k.stroke();
    }
    for (let i = 0; i < 26; i++) { const x = r() * e.W, y = r() * e.H, a = r() * 6.28, L = 1.5 + r() * 4; k.strokeStyle = "#8f806b"; k.globalAlpha = 0.25 + r() * 0.3; k.lineWidth = 0.6 + r() * 0.5; k.beginPath(); k.moveTo(x, y); k.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L); k.stroke(); }
    k.globalAlpha = 1; g.touch(0, 0, e.W, e.H);
  });
};
const finish = (g: Gfx) => { g.paper("paper", 0.1); g.paper("coldpress", 0.045); };

// ---------------------------------------------------------------- stalks
type Stalk = { ctrl: P[]; w0: number; w1: number; ink: number; segs: number[]; gap: number; seed: number; load: number; dry: number };
// Wind from the left: every stalk bows right, more toward its top. Segments are shortest at the
// base, longest mid-stalk, shorter again near the crown, as the manual measures them.
const A: Stalk = { ctrl: [[708, 1100], [700, 900], [700, 700], [714, 500], [742, 300], [782, 120], [826, -30]], w0: 31, w1: 24, ink: NONG, segs: [62, 104, 138, 162, 176, 178, 170, 160, 150], gap: 9, seed: 10, load: 1.05, dry: 0.3 };
const B: Stalk = { ctrl: [[862, 1100], [864, 900], [876, 700], [900, 520], [940, 370], [992, 250], [1040, 170]], w0: 21, w1: 15, ink: DAN, segs: [58, 96, 130, 150, 160, 150, 132, 120], gap: 7, seed: 20, load: 1, dry: 0.3 };
const C: Stalk = { ctrl: [[990, 1100], [996, 950], [1012, 800], [1040, 660], [1080, 540], [1110, 470]], w0: 15, w1: 11, ink: QING, segs: [80, 120, 140, 150, 150], gap: 6, seed: 30, load: 1, dry: 0.22 };
const path = (s: Stalk) => { const p = resample(smooth(s.ctrl, false, 16), 900); const cum = [0]; for (let i = 1; i < p.length; i++) cum.push(cum[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1])); return { p, cum }; };
const at = (pp: { p: P[]; cum: number[] }, s: number): { pt: P; tan: P } => {
  const { p, cum } = pp; let i = 1; while (i < p.length - 1 && cum[i] < s) i++;
  const f = clamp((s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1)), pt = lerpP(p[i - 1], p[i], f), dx = p[i][0] - p[i - 1][0], dy = p[i][1] - p[i - 1][1], l = Math.hypot(dx, dy) || 1;
  return { pt, tan: [dx / l, dy / l] };
};
// one stalk as brush strokes: each segment one upward stroke, pressed flat at both ends (the
// knuckle), with a slow point at each end that bleeds; the brush drying as it climbs, reloaded
// halfway (the second breath of ink)
const stalkStrokes = (s: Stalk) => {
  const pp = path(s), out: { b: Brush; len: number }[] = [], nodes: { pt: P; tan: P; w: number }[] = [];
  let pos = 0; const total = pp.cum[pp.cum.length - 1];
  s.segs.forEach((L, i) => {
    if (pos >= total - 10) return;
    const s0 = pos, s1 = Math.min(total, pos + L), w = s.w0 + (s.w1 - s.w0) * (s0 / total), ctrl: P[] = [];
    for (let k = 0; k <= 4; k++) ctrl.push(at(pp, s0 + ((s1 - s0) * k) / 4).pt);
    const fresh = i === 0 || i === Math.ceil(s.segs.length / 2);
    out.push({ len: s1 - s0, b: { ctrl, w, ink: s.ink, press: [[0, 0.98], [0.04, 1.1], [0.14, 0.93], [0.5, 0.9], [0.86, 0.93], [0.965, 1.08], [1, 0.96]], load: s.load * (fresh ? 1.05 : 0.95 - 0.07 * (i % 3)), dry: s.dry * (0.8 + 0.3 * (i % 3)), edge: 0.45, split: 0.3, bleed: 0.7, slow: [[0.01, 0.45], [0.99, 0.3]], seed: s.seed * 100 + i } });
    pos = s1 + s.gap;
    if (pos < total - 10) nodes.push({ ...at(pp, s1 + s.gap / 2), w });
  });
  return { strokes: out, nodes };
};
// the node: a short dark stroke bridging the gap, like a shallow 乙, pressed at both ends
const nodeStroke = (n: { pt: P; tan: P; w: number }, ink: number, seed: number): Brush => {
  const [x, y] = n.pt, up: P = [n.tan[0] * -1, n.tan[1] * -1], nm: P = [-up[1], up[0]], h = n.w / 2 + 3, q = (a: number, b: number): P => [x + nm[0] * a + up[0] * b, y + nm[1] * a + up[1] * b];
  return { ctrl: [q(-h, -1.5), q(-h * 0.35, 2.5), q(h * 0.3, 2), q(h, -2)], w: Math.max(4, n.w * 0.22), ink, press: [[0, 0.8], [0.12, 1.05], [0.5, 0.55], [0.88, 1], [1, 0.6]], load: 1, dry: 0.1, edge: 0, split: 0.2, bleed: 0.8, slow: [[0.02, 0.4], [0.98, 0.4]], hairs: 12, seed };
};

// ---------------------------------------------------------------- branches and leaves
const twig = (ctrl: P[], w: number, ink: number, seed: number): Brush => ({ ctrl, w, ink, press: [[0, 0.9], [0.1, 1], [0.5, 0.8], [0.9, 0.55], [1, 0.3]], load: 0.95, dry: 0.12, edge: 0.1, split: 0.3, bleed: 0.6, slow: [[0.01, 0.6]], hairs: 10, seed });
// a leaf: the tip touches, presses to full width by a third of the way, lifts to a point. Wind
// leaves are long and flat, bent a little by the air; `bend` is how far they curve (px, signed).
const leaf = (base: P, deg: number, len: number, w: number, bend: number, ink: number, seed: number, load = 1): Brush => {
  const a = (deg * Math.PI) / 180, d: P = [Math.cos(a), Math.sin(a)], n: P = [-d[1], d[0]], q = (t: number, s: number): P => [base[0] + d[0] * len * t + n[0] * s, base[1] + d[1] * len * t + n[1] * s];
  return { ctrl: [q(0, 0), q(0.28, bend * 0.55), q(0.62, bend), q(0.86, bend * 0.8), q(1, bend * 0.45)], w, ink, press: [[0, 0.1], [0.08, 0.5], [0.28, 1], [0.55, 0.88], [0.82, 0.42], [1, 0.02]], load, dry: 0.1, edge: -0.35, split: 0.55, bleed: 0.55, slow: [[0.03, 0.55]], seed };
};
type Cluster = { twigs: { ctrl: P[]; w: number }[]; leaves: [P, number, number, number, number][]; ink: number; seed: number }; // leaf: base, angle, length, width, bend
const CLUSTERS: Cluster[] = [
  // crown of the front stalk: a 个 group and two more, streaming right over the empty sky
  { ink: NONG, seed: 400, twigs: [{ ctrl: [[770, 186], [812, 158], [858, 140], [902, 136]], w: 6 }, { ctrl: [[818, 154], [846, 118], [876, 96]], w: 4 }],
    leaves: [[[902, 136], -6, 176, 27, -10], [[900, 138], 12, 166, 26, 8], [[898, 140], 28, 146, 24, 12], [[876, 96], -16, 150, 22, -6], [[874, 98], 4, 132, 21, 6], [[846, 146], 44, 128, 22, 10]] },
  // upper middle: a 介 group off the node above the bird, the densest dark of the picture
  { ink: NONG, seed: 420, twigs: [{ ctrl: [[736, 356], [788, 334], [846, 322], [900, 322]], w: 6.5 }, { ctrl: [[790, 334], [820, 360], [844, 372]], w: 4 }],
    leaves: [[[900, 322], -10, 170, 28, -8], [[898, 324], 6, 180, 29, 6], [[896, 326], 20, 162, 27, 12], [[894, 328], 36, 140, 25, 14], [[844, 372], 30, 146, 24, 10], [[842, 374], 52, 120, 22, 12]] },
  // lower right on the front stalk: heavy ink, turned further down by the gust
  { ink: ZHONG, seed: 440, twigs: [{ ctrl: [[712, 472], [760, 468], [806, 474], [846, 486]], w: 5.5 }],
    leaves: [[[846, 486], 8, 150, 25, 8], [[844, 488], 26, 140, 24, 12], [[842, 490], 44, 124, 22, 12]] },
  // the stalk behind: light ink, its crown leaves and one branch reaching off the right edge
  { ink: DAN, seed: 460, twigs: [{ ctrl: [[1000, 214], [1030, 206], [1052, 208]], w: 4 }, { ctrl: [[892, 540], [936, 532], [980, 536]], w: 4.5 }],
    leaves: [[[1040, 172], -14, 130, 21, -6], [[1044, 176], 6, 124, 20, 6], [[1050, 210], 24, 118, 20, 8], [[980, 536], 6, 140, 22, 6], [[978, 538], 22, 130, 21, 10], [[976, 540], 40, 118, 20, 10], [[974, 542], 58, 100, 18, 8]] },
  // the farthest stalk: clear ink, two leaves, the air between us and it
  { ink: QING, seed: 480, twigs: [{ ctrl: [[1032, 690], [1060, 690], [1084, 700]], w: 3.5 }],
    leaves: [[[1030, 692], 20, 110, 18, 6], [[1028, 694], 40, 100, 17, 8]] },
];
// the sparrow's branch: out of the front stalk's node, reaching left into the empty half, its
// leaf group at the tip blown back downwind under the bird
const PERCH: P = [528, 586];
const BRANCH: P[] = [[703, 612], [652, 596], [590, 587], [520, 586], [456, 592], [420, 600]];
const BRANCH_LEAVES: [P, number, number, number, number][] = [[[424, 600], 22, 128, 23, 10], [[426, 602], 42, 118, 22, 12], [[428, 604], 62, 100, 20, 10]];
const LOW = { twig: [[702, 836], [744, 830], [786, 836]] as P[], leaves: [[[786, 836], 16, 136, 23, 8], [[784, 838], 36, 120, 22, 12]] as [P, number, number, number, number][] };

// ---------------------------------------------------------------- the sparrow
// Authored in its own frame: origin where the toes grip the branch, x to its tail, y up is
// negative, facing LEFT into the wind. Body tilted ~25 degrees, tail down behind the branch.
const S = 1.62;
const LOWER = 6; // the body settles onto the branch: everything but the toes sits this much lower than authored
const sp = (pts: [number, number][], dy = LOWER): P[] => pts.map(([x, y]) => [PERCH[0] + x * S, PERCH[1] + (y + dy) * S]);
const bird = (ink: number, ctrl: [number, number][], w: number, press: [number, number][], seed: number, o: Partial<Brush> = {}): Brush => ({ ctrl: sp(ctrl), w: w * S, ink, press, load: 1, dry: 0.16, edge: 0, split: 0.4, bleed: 0.5, slow: [[0.02, 0.4]], hairs: Math.max(8, Math.round(w * 1.3)), seed, ...o });
const TAPER: [number, number][] = [[0, 0.5], [0.25, 1], [0.7, 0.8], [1, 0.1]];
const DAB: [number, number][] = [[0, 0.7], [0.3, 1], [0.7, 1], [1, 0.6]];
const SWELL: [number, number][] = [[0, 0.35], [0.22, 1], [0.75, 0.92], [1, 0.3]];
// Qi Baishi's economy: every part of the bird is a single stroke of the loaded brush, and none of
// it is laid into wet paper, so nothing melts into a smooth gradient. Where the brush ran dry the
// paper shows through in streaks; where it paused the ink bled a halo into the fibres; that is all.
const SPARROW: Brush[] = [
  // beak: two hairlines of scorched ink, the upper longer, flicked from the face outward
  bird(JIAO, [[-59, -73], [-66, -71.5], [-73, -68.5]], 4, [[0, 1], [0.6, 0.7], [1, 0.1]], 700, { dry: 0.05, bleed: 0.25, slow: [], hairs: 8 }),
  bird(JIAO, [[-59, -66.5], [-65, -66.8], [-70, -67.5]], 2.8, [[0, 1], [1, 0.1]], 701, { dry: 0.05, bleed: 0.25, slow: [], hairs: 6 }),
  // the head: ONE loaded dab of thick ink, pressed down over the crown and dragged back to the
  // nape, where the brush is already starting to run dry
  bird(NONG, [[-46.5, -84.0], [-42.2, -86.7], [-37.1, -86.5], [-33.0, -83.4], [-31.5, -78.5], [-32.3, -74.9]], 17, [[0, 0.5], [0.2, 1], [0.7, 1], [1, 0.5]], 703, { load: 1.1, dry: 0.45, streak: true, edge: 0.2, split: 0.7, bleed: 0.9, slow: [[0.05, 0.7]] }),
  // the eye: one tiny scorched dot at the edge of the cap
  bird(JIAO, [[-51, -73.8], [-52.2, -73], [-51.8, -71.6], [-50.4, -72], [-50.6, -73.4]], 2.4, [[0, 1], [1, 1]], 702, { dry: 0, bleed: 0.2, slow: [], hairs: 6 }),
  // the black ear spot and the bib: two small touches of the tip
  bird(ZHONG, [[-40, -68], [-35.5, -67], [-31.5, -69.5]], 3.6, [[0, 0.5], [0.4, 1], [1, 0.1]], 704, { dry: 0.2, bleed: 0.5, slow: [[0.1, 0.4]], hairs: 6 }),
  bird(NONG, [[-59.5, -62.5], [-57, -57], [-54, -52]], 6, [[0, 0.7], [0.35, 1], [1, 0.15]], 705, { dry: 0.1, bleed: 0.6, hairs: 8 }),
  // the back: the brush laid on its side and pressed, dragged from nape to rump; it breaks into
  // dry-brush streaks halfway, which is the streaked mantle
  bird(ZHONG, [[-30, -80], [-10, -79], [10, -73], [27, -62]], 20, [[0, 0.45], [0.18, 1], [0.8, 0.9], [1, 0.35]], 706, { load: 1, dry: 0.7, streak: true, edge: 0.4, split: 0.9, bleed: 0.7 }),
  // two quick dark dashes into the mantle for the black streaks
  bird(NONG, [[-16, -79], [-8, -77.5], [0, -75]], 2.2, [[0, 0.4], [0.3, 1], [1, 0.1]], 707, { dry: 0.5, bleed: 0.3, hairs: 5 }), bird(NONG, [[3, -74.5], [11, -70.5], [17, -66]], 2, [[0, 0.4], [0.3, 1], [1, 0.1]], 708, { dry: 0.5, bleed: 0.3, hairs: 5 }),
  // the wing: two pressed side-brush strokes, a sliver of bare paper left between them for the
  // white wing bar, the lower one paler and drier
  bird(ZHONG, [[-27, -66], [-9, -61], [11, -55], [28, -48]], 17, [[0, 0.5], [0.2, 1], [0.8, 0.85], [1, 0.3]], 710, { load: 1, dry: 0.6, streak: true, edge: 0.35, split: 0.9, bleed: 0.6 }),
  bird(0.48, [[-17, -50], [3, -45.5], [23, -40.5], [38, -36.5]], 13, [[0, 0.45], [0.25, 1], [1, 0.25]], 711, { load: 0.95, dry: 0.8, streak: true, edge: 0.3, split: 0.95, bleed: 0.5 }),
  // the flight feathers: two hairlines of thick ink to the wingtip
  bird(NONG, [[6, -54], [28, -45], [50, -35.5]], 3, [[0, 0.6], [0.3, 1], [1, 0.1]], 712, { dry: 0.25, bleed: 0.3, hairs: 6 }), bird(NONG, [[11, -48.5], [31, -40.5], [49, -32.5]], 2.6, [[0, 0.6], [0.3, 1], [1, 0.1]], 713, { dry: 0.3, bleed: 0.3, hairs: 6 }),
  // tail: two strokes from the rump down behind the branch, the second nearly dry
  bird(NONG, [[31, -50], [46, -41], [60, -31], [72, -21]], 8.5, [[0, 0.8], [0.3, 1], [1, 0.2]], 715, { dry: 0.6, streak: true, split: 0.9, bleed: 0.4 }),
  bird(ZHONG, [[29, -45], [43, -35], [56, -25], [66, -15]], 7.5, [[0, 0.8], [0.3, 1], [1, 0.15]], 716, { load: 0.95, dry: 0.8, streak: true, split: 0.95, bleed: 0.3 }),
  // the breast: one light hairline down the front, open where the light falls
  bird(DAN, [[-58.5, -58], [-57.5, -47], [-51.5, -36]], 2, [[0, 0.3], [0.5, 1], [1, 0.2]], 717, { dry: 0.1, bleed: 0.3, slow: [], hairs: 5 }),
  // the belly: one pale, well-diluted stroke along the underside, away from the light; laid on
  // dry paper, so its body stays a brushmark and only its slow ends bleed into the fibres
  bird(QING, [[-48, -34], [-34, -25.5], [-14, -21.5], [8, -23.5], [24, -30]], 10, [[0, 0.35], [0.2, 1], [0.75, 0.8], [1, 0.2]], 719, { load: 1, dry: 0.5, streak: true, edge: -0.2, split: 0.8, bleed: 1.2, slow: [[0.04, 1]] }),
];
// legs and toes in scorched ink, authored on the branch itself (not lowered): the short legs
// come out of the belly feathers, the front toes wrap over the branch, the hind toe grips behind
const toe = (ctrl: [number, number][], w: number, seed: number): Brush => ({ ...bird(JIAO, ctrl, w, [[0, 0.9], [0.7, 1], [1, 0.35]], seed, { dry: 0.05, bleed: 0.2, slow: [] }), ctrl: sp(ctrl, 0) });
const FEET: Brush[] = [
  toe([[-9, -13], [-8, -6], [-7, -0.5]], 1.6, 730), toe([[4, -13], [5, -6], [6, -0.5]], 1.6, 731),
  toe([[-7, -0.5], [-13, 0.6], [-17.5, 3.5]], 1.4, 732), toe([[6, -0.5], [0, 0.8], [-3.5, 4]], 1.4, 733), toe([[-7, -0.5], [-1.5, 2], [1.5, 5.5]], 1.3, 734), toe([[6, -0.5], [10, 1.5], [12, 5]], 1.2, 735),
];

// ---------------------------------------------------------------- dry accents
// moss dots (点苔) at the stalk foot and a dry scrub of ground: an almost empty brush dragged flat
const ACCENTS: Brush[] = [
  // a tuft of dry grass at the front stalk's foot: three quick upward flicks from an almost empty brush
  ...([[[654, 1090], [646, 1060], [630, 1034]], [[668, 1090], [666, 1062], [672, 1040]], [[742, 1090], [752, 1066], [770, 1048]], [[756, 1092], [770, 1074], [792, 1066]]] as P[][]).map((ctrl, i): Brush => ({ ctrl, w: 6, ink: NONG, press: [[0, 1], [0.5, 0.7], [1, 0.05]], load: 0.55, dry: 0.3, edge: 0.3, split: 0.9, bleed: 0.1, slow: [], hairs: 9, seed: 800 + i })),
  // moss dots (点苔): scorched, pressed and lifted, where the stalks leave the ground
  ...([[684, 1052], [700, 1064], [728, 1058], [846, 1066], [884, 1062], [870, 1078]] as P[]).map(([x, y], i): Brush => ({ ctrl: [[x, y], [x + 2.5, y + 1.8]], w: 6 + (i % 3) * 2, ink: JIAO, press: [[0, 0.9], [1, 0.8]], load: 1, dry: 0, edge: 0, split: 0, bleed: 0.8, slow: [[0.5, 0.5]], hairs: 10, seed: 810 + i })),
];

// ---------------------------------------------------------------- the seal
// cinnabar paste pressed from a carved stone: a red block with a worn, chipped border; the
// glyph strokes are cut into the stone, so they print as paper. Pressed once, at the end.
const SEAL = { x: 118, y: 896, s: 70 };
const GLYPHS: [number, number][][][] = [
  [[[0.12, 0.16], [0.88, 0.16]], [[0.5, 0.16], [0.5, 0.88]], [[0.16, 0.46], [0.84, 0.46]], [[0.2, 0.62], [0.2, 0.86], [0.8, 0.86], [0.8, 0.62]]],
  [[[0.16, 0.1], [0.16, 0.9]], [[0.16, 0.3], [0.86, 0.3], [0.86, 0.9]], [[0.44, 0.3], [0.44, 0.7], [0.68, 0.7]], [[0.16, 0.9], [0.62, 0.9]]],
  [[[0.1, 0.2], [0.9, 0.2]], [[0.3, 0.2], [0.3, 0.55], [0.7, 0.55], [0.7, 0.2]], [[0.5, 0.55], [0.5, 0.9]], [[0.14, 0.76], [0.86, 0.76]]],
  [[[0.18, 0.14], [0.82, 0.14], [0.82, 0.86], [0.18, 0.86], [0.18, 0.4], [0.6, 0.4], [0.6, 0.64], [0.4, 0.64]]],
];
const seal = (g: Gfx, press: number) => {
  if (press <= 0) return;
  const { x, y, s } = SEAL, r = rng(900);
  g.group("plain", () => {
    const k = g.cur; g.touch(x - 4, y - 4, x + s + 4, y + s + 4);
    // the block, its edge worn uneven by years of pressing
    k.fillStyle = "#b8352b"; k.globalAlpha = 0.92; k.beginPath();
    const edge: P[] = []; for (let i = 0; i < 40; i++) { const t = i / 10, side = Math.floor(t), f = t - side, j = (fractal(901, i, 0, 0.7, 0.7, 2) - 0.5) * 2.2; edge.push(side === 0 ? [x + s * f, y + j] : side === 1 ? [x + s + j, y + s * f] : side === 2 ? [x + s * (1 - f), y + s + j] : [x + j, y + s * (1 - f)]); }
    edge.forEach(([a, b], i) => (i ? k.lineTo(a, b) : k.moveTo(a, b))); k.closePath(); k.fill();
    // the carving: cut into the stone, knife-square ends, prints as paper
    k.globalCompositeOperation = "destination-out"; k.globalAlpha = 1; k.lineCap = "square"; k.lineJoin = "miter";
    const cell = (s - 12) / 2, order = [[1, 0], [1, 1], [0, 0], [0, 1]]; // seals read right column first, top to bottom
    GLYPHS.forEach((gl, gi) => { const [cx, cy] = order[gi], ox = x + 6 + cx * cell, oy = y + 6 + cy * cell; gl.forEach((line) => { k.lineWidth = cell * 0.13 * (0.9 + r() * 0.25); k.beginPath(); line.forEach(([u, v], i) => { const px = ox + cell * (0.08 + u * 0.84) + (r() - 0.5) * 0.8, py = oy + cell * (0.08 + v * 0.84) + (r() - 0.5) * 0.8; i ? k.lineTo(px, py) : k.moveTo(px, py); }); k.stroke(); }); });
    // the border line inside the block, and where it chipped
    k.lineWidth = 1.6; k.strokeRect(x + 3.2, y + 3.2, s - 6.4, s - 6.4);
    k.lineWidth = 1; for (let i = 0; i < 3; i++) { const a = r() * 4, px = a < 1 ? x + a * s : a < 2 ? x + s : a < 3 ? x + (a - 2) * s : x, py = a < 1 ? y : a < 2 ? y + (a - 1) * s : a < 3 ? y + s : y + (a - 3) * s; k.beginPath(); k.arc(px, py, 1.6 + r() * 2.2, 0, 6.28); k.fill(); }
    // paste pressed unevenly: where the stamp met the paper hardest the red is solid, elsewhere it breaks
    for (let i = 0; i < 90; i++) { const px = x + r() * s, py = y + r() * s, lighter = fractal(902, px, py, 0.06, 0.06, 2); if (lighter < 0.52) continue; k.globalAlpha = (lighter - 0.5) * 1.4; k.beginPath(); k.arc(px, py, 0.5 + r() * 1.3, 0, 6.28); k.fill(); }
    k.globalCompositeOperation = "source-over"; k.globalAlpha = 1;
  }, { blend: "multiply", alpha: clamp(0.35 + 0.65 * press), textures: ["risoSpeck"] });
};

// ---------------------------------------------------------------- the process
const build = (k: number): Proc => {
  const tl = timeline(8, k);
  const dur = (len: number, speed: number, min = 3) => Math.max(min, len / speed);
  // 1. the stalks, front first, each climbing segment by segment with a pause at every node
  const sA = stalkStrokes(A), sB = stalkStrokes(B), sC = stalkStrokes(C);
  [sA, sB, sC].forEach((st, si) => { st.strokes.forEach(({ b, len }) => { tl.add(dur(len, [24, 30, 34][si]) + 2, strokeDraw(b)); tl.wait(1); }); tl.wait(6); });
  // 2. the nodes, darker, bottom up, one flick each
  [[sA, JIAO], [sB, ZHONG], [sC, DAN]].forEach(([st, ink], si) => { (st as typeof sA).nodes.forEach((n, i) => tl.add(2.4, strokeDraw(nodeStroke(n, ink as number, 600 + si * 20 + i)))); });
  tl.wait(6);
  // 3. branches out of the nodes, quick and thin
  const twigs: Brush[] = [...CLUSTERS.flatMap((c, ci) => c.twigs.map((t, i) => twig(t.ctrl, t.w, Math.min(1, c.ink + 0.12), c.seed + 50 + i))), twig(BRANCH, 7, NONG, 650), twig(LOW.twig, 5, ZHONG, 651)];
  twigs.forEach((b) => tl.add(4, strokeDraw(b)));
  tl.wait(6);
  // 4. leaves: front groups in thick ink, then the heavy, then the light and clear ones behind
  const leafOps = (lv: [P, number, number, number, number][], ink: number, seed: number) => lv.map(([p, a, l, w, bd], i) => { const r = rng(seed * 3 + i); return leaf([p[0] - 6 + r() * 12, p[1] - 4 + r() * 8], a + (r() - 0.5) * 6, l * (0.9 + r() * 0.2), w, bd + (r() - 0.5) * 14, clamp(ink + (r() - 0.5) * 0.1), seed + i, 1 - (i % 3) * 0.06); });
  const groups: Brush[][] = [...CLUSTERS.map((c) => leafOps(c.leaves, c.ink, c.seed)), leafOps(BRANCH_LEAVES, ZHONG, 660), leafOps(LOW.leaves, ZHONG, 670)];
  groups.forEach((gr) => { gr.forEach((b) => tl.add(4.2, strokeDraw(b))); tl.wait(3); });
  tl.wait(6);
  // 5. the sparrow, in the manual's order, fiddly strokes slower than the leaves
  [...SPARROW, ...FEET].forEach((b) => tl.add(5, strokeDraw(b)));
  tl.wait(6);
  // 6. dry accents
  ACCENTS.forEach((b, i) => tl.add(i < 2 ? 7 : 2.5, strokeDraw(b)));
  tl.wait(8);
  // 7. the seal, pressed: the paste takes in the moment of pressure, then sits
  tl.add(6, (g, p) => seal(g, p));
  return { id: "sumiE", medium: SUMI_M, ground, ops: tl.ops, finish };
};
// author at a hand's pace, then fit: the whole process must finish 30 frames before the end
const RAW = build(1), RAW_END = RAW.ops[RAW.ops.length - 1].t1;
const PROC = build(Math.min(1, (N - 31 - 8) / (RAW_END - 8)));
const END = PROC.ops[PROC.ops.length - 1].t1;
if (END > N - 30) throw new Error(`sumiE: process ends at frame ${END}, needs to end by ${N - 30}`);

export const STYLE = { id: "sumiE", name: "Sumi-e ink painting", family: "ink", medium: "one loaded soft brush of sumi ink, five dilutions, on unsized absorbent xuan paper, with a cinnabar seal", nearest: "wren", hero: "bamboo in wind with a tree sparrow" };

export const sumiE: Film = {
  meta: { title: "Bamboo in wind · sumi-e", W, H, fps: 30, bpm: 120, durationFrames: N, raster: "cpu" },
  assets: { images: {} },
  shots: [{ id: "paint", start: 0, end: N, draw: (ctx, f, env) => runProcess(PROC, ctx, Math.min(f, END), env) }],
};
export { brush, tone };
