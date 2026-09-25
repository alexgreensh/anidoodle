import { displace, fractal, Gfx, rng, type Ctx, type Env, type Medium, type P } from "./core";
import type { Film } from "./film";
import { clamp, lerp, mix, smooth } from "./gallery";
import { streakClip, streaks } from "./koiDrawKit";

// MID-CENTURY GOUACHE · a hillside village, and a girl flying a kite.
//
// MEDIUM, physically: designer's gouache on warm illustration board, the way 1950s-60s picture
// books were painted (the Provensens, Mary Blair, Sasek). Gouache is OPAQUE and dries MATTE: a
// shape is laid in flat with a loaded flat brush, strokes visible only at its ragged edge; a
// lighter colour can go straight over a darker one. Then a nearly dry brush is dragged across
// the flats, so the bristles skip the board's tooth and leave broken parallel streaks (grass,
// cloud edges, weather on walls). Last, a loose brush-and-ink line goes on top, printed on its
// own plate in the book, so it sits OFF REGISTER from the colour: the line wanders past the edge
// of the shape it describes, and leaves edges out where the colour already says it.
// MARKS: flat opaque shapes with brushed, slightly ragged edges; dry-brush bristle streaks that
// break up as the brush runs out; a loose, thin, slightly thick-thin ink line, open contours.
// ORDER: flat colour shapes BIG TO SMALL (sky and hills, the village, houses, trees, the kite,
// the girl's dress, skin, hair, the smallest things last), then the dry brush, then the line.
// PALETTE: limited and bold, one key: warm board, mustard, tomato, turquoise, olive, deep
// green-black, pink, cream.
// LIGHT: sun high on the left. Every house shows a darker right side, the girl throws a flat
// shadow down the hill to the right.
// SUBJECT & REFERENCE (from knowledge): an eight-year-old girl, six heads tall (head 54 px of
// 324): shoulders at 1.3 heads, crotch at 3.1, knees at 4.5, ankles at 5.8. Weight on the
// straight back leg, the front leg stepping forward with the knee bent FORWARD; the kite arm
// raised with the elbow flexed outward-down (upper arm ~1 head, forearm ~0.9), the fist closed
// round the string with the thumb over it; the balance arm back and down, hand open, palm down,
// four fingers and a thumb. Three-quarter view looking up-right at the kite; A-line dress with
// a Peter Pan collar and puff sleeves, white socks, Mary Janes (1950s children's clothing).
// Wind from the left: the hem, the bow tails and the kite tail all stream right. The village is
// an Italian/Provencal hill town stacked up a slope: tall narrow houses, a church and spire,
// cypresses.
// NOT ITS NEIGHBOUR (cut-paper fox): no torn fibres and no lifting pieces; painted edges, dry
// brush, and a line that floats off the colour.

const W = 1080, H = 1080, N = 540, HOLD = 30;
const T = { paint: [4, 262], dry: [268, 352], line: [358, N - HOLD - 2] } as const;
const C = { board: "#f1e1b8", cloud: "#fbf2dc", far2: "#98c1ad", far: "#4f8f86", vill: "#a6a340", villD: "#8b8a32", fore: "#4c8c52", foreD: "#356a3e", cream: "#f5e8c8", pink: "#e8a296", ochre: "#e2a73a", turq: "#56aba2", white: "#f7efdc", tomato: "#d2462a", teal: "#244e4a", brown: "#7a4a33", dark: "#2b2724", cyp: "#2d5a40", tree: "#6f8a2e", skin: "#eab28c", hair: "#2a201b", blush: "#e78578", red: "#cf3f27", mustard: "#e9ae34", ink: "#1d1a17" };
const BRUSH: Medium = { nib: 1.15, taper: 1, pressure: 0.85, retrace: false, wobble: 1.4, rough: 0.35 };
const REG: P = [5, -4]; // the line plate's misregistration against the colour

type Sh = { pts: P[]; col: string; ang: number };
type Dry = { path: P[]; w: number; col: string; seed: number };
type Ln = { pts: P[]; w: number; seed: number };
type Scene = { shapes: Sh[]; dry: Dry[]; lines: Ln[]; order: number[]; paintT: [number, number][]; dryT: [number, number][]; lineT: [number, number][] };

// ---------------------------------------------------------------- geometry
const sm = (a: P[], closed = true, per = 6) => smooth(a, closed, per);
const area = (s: P[]) => Math.abs(s.reduce((a, p, i) => { const q = s[(i + 1) % s.length]; return a + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);
const ell = (cx: number, cy: number, rx: number, ry: number, rot = 0, n = 18): P[] => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2, x = Math.cos(a) * rx, y = Math.sin(a) * ry; return [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)] as P; });
const plen = (s: P[]) => s.reduce((a, p, i) => (i ? a + Math.hypot(p[0] - s[i - 1][0], p[1] - s[i - 1][1]) : 0), 0);
// a limb on a jointed centreline: radius per joint, a soft muscle bulge between
const limb = (c: P[], r: number[], bulge = 0): { poly: P[]; a: P[]; b: P[] } => {
  const s = sm(c, false, 10), n = s.length, A: P[] = [], B: P[] = [];
  s.forEach((p, i) => { const t = i / (n - 1), seg = Math.min(r.length - 2, Math.floor(t * (r.length - 1))), f = t * (r.length - 1) - seg, rr = lerp(r[seg], r[seg + 1], f) + bulge * Math.sin(Math.PI * clamp((t - 0.5) * 2)) , q = s[Math.min(n - 1, i + 1)], o = s[Math.max(0, i - 1)], dx = q[0] - o[0], dy = q[1] - o[1], l = Math.hypot(dx, dy) || 1; A.push([p[0] - (dy / l) * rr, p[1] + (dx / l) * rr]); B.push([p[0] + (dy / l) * rr, p[1] - (dx / l) * rr]); });
  return { poly: [...A, ...[...B].reverse()], a: A, b: B };
};
// a hand in its own frame: u along the forearm, v across it
const frame = (wrist: P, elbow: P) => { const dx = wrist[0] - elbow[0], dy = wrist[1] - elbow[1], l = Math.hypot(dx, dy); const a: P = [dx / l, dy / l], n: P = [-a[1], a[0]]; return (u: number, v: number): P => [wrist[0] + a[0] * u + n[0] * v, wrist[1] + a[1] * u + n[1] * v]; };
const capsuleUV = (F: (u: number, v: number) => P, u0: number, v0: number, u1: number, v1: number, r: number): P[] => { const a = F(u0, v0), b = F(u1, v1), ang = Math.atan2(b[1] - a[1], b[0] - a[0]), out: P[] = []; for (let i = 0; i <= 6; i++) { const t = ang + Math.PI / 2 + (i / 6) * Math.PI; out.push([a[0] + Math.cos(t) * r, a[1] + Math.sin(t) * r]); } for (let i = 0; i <= 6; i++) { const t = ang - Math.PI / 2 + (i / 6) * Math.PI; out.push([b[0] + Math.cos(t) * r, b[1] + Math.sin(t) * r]); } return out; };

const buildScene = (): Scene => {
  const shapes: Sh[] = [], dry: Dry[] = [], lines: Ln[] = [], r = rng(1957);
  const S = (pts: P[], col: string, ang = 0) => shapes.push({ pts, col, ang });
  const L = (pts: P[], w = 2, seed = lines.length + 1) => lines.push({ pts, w, seed: 300 + seed });
  const D = (path: P[], w: number, col: string) => dry.push({ path, w, col, seed: 700 + dry.length });
  const ridge = (top: P[], base: number): P[] => { const t = sm(top, false, 8); return [...t, [t[t.length - 1][0], base], [t[0][0], base]]; };

  // clouds and hills: the big flats
  const cloud = (x: number, y: number, s: number): P[] => [...sm([[x - 130 * s, y], [x - 100 * s, y - 22 * s], [x - 50 * s, y - 30 * s], [x - 20 * s, y - 52 * s], [x + 30 * s, y - 50 * s], [x + 60 * s, y - 26 * s], [x + 110 * s, y - 20 * s], [x + 140 * s, y]], false, 6), [x, y + 4]];
  S(cloud(240, 170, 1), C.cloud); S(cloud(600, 104, 0.7), C.cloud);
  S(ridge([[-20, 560], [180, 520], [420, 546], [640, 492], [860, 440], [1100, 420]], H), C.far2, 0.2);
  S(ridge([[-20, 616], [150, 584], [330, 600], [520, 566], [700, 528], [900, 480], [1100, 464]], H), C.far, 0.25);
  const ys = (x: number) => 735 - (x - 420) * 0.4;
  // a meadow between the far hills and her hill, with a hedgerow of round trees on its crest
  S(ridge([[-20, 690], [110, 684], [240, 700], [330, 730], [420, 780]], H), "#c7b24c", -0.1);
  S(ridge([[340, 790], [420, ys(420) - 40], [600, ys(600) - 40], [800, ys(800) - 40], [1000, ys(1000) - 40], [1100, ys(1100) - 40]], H), C.vill, -0.38);
  // the village, back row first, each house a front face, a darker right side, a roof, windows
  const house = (x: number, base: number, w: number, h: number, wall: string, roof: string, gable: boolean, k: number) => {
    const side = w * 0.3, lift = side * 0.5, top = base - h;
    S([[x + w, base], [x + w + side, base - lift], [x + w + side, top - lift], [x + w, top]], mix(wall, C.dark, 0.3), 1.57);
    S([[x, base], [x + w, base], [x + w, top], [x, top]], wall, 1.57);
    if (gable) { S([[x - 4, top + 1], [x + w / 2, top - w * 0.55], [x + w + 4, top + 1]], roof, 0.4); S([[x + w / 2, top - w * 0.55], [x + w + side + 3, top - lift - w * 0.5], [x + w + side + 4, top - lift + 1], [x + w + 4, top + 1]], mix(roof, C.dark, 0.3), 0.4); }
    else S([[x - 3, top + 2], [x + w + side + 3, top - lift + 2], [x + w + side + 3, top - lift - 9], [x - 3, top - 8]], roof, 0.1);
    const nw = 1 + (k % 3), rows = h > 70 ? 2 : 1;
    for (let j = 0; j < rows; j++) for (let i = 0; i < nw; i++) { const wx = x + (w * (i + 0.5)) / nw - 5 + 2, wy = top + 14 + j * 30 - 2; S([[wx, wy], [wx + 10, wy], [wx + 10, wy + 15], [wx, wy + 15]], C.dark, 1.57); }
    // the line: two or three sides only, never the whole box
    L([[x, top + 3], [x, base]], 1.5); L(gable ? [[x - 4, top + 1], [x + w / 2, top - w * 0.55], [x + w + side + 3, top - lift - w * 0.5]] : [[x - 3, top - 8], [x + w + side + 3, top - lift - 9]], 1.6);
    if (k % 2) L([[x + w, top], [x + w, base]], 1.3);
    D([[x + 4, top + 8], [x + 6, base - 4]], w * 0.5, mix(wall, "#ffffff", 0.35));
  };
  const walls = [C.cream, C.pink, C.ochre, C.turq, C.white], roofs = [C.tomato, C.teal, C.brown, C.tomato];
  const cyp = (x: number, base: number, h: number) => { S(sm([[x, base], [x - 9, base - h * 0.35], [x - 6, base - h * 0.75], [x, base - h], [x + 6, base - h * 0.75], [x + 9, base - h * 0.35]]), C.cyp, 1.57); L([[x + 2, base - h + 6], [x + 7, base - h * 0.5], [x + 6, base - 6]], 1.2); };
  [560, 624, 700, 770, 842, 908, 976, 1044].forEach((x, i) => { if (x === 700) return; house(x, ys(x) - 20, 46 + (i % 3) * 6, 70 + ((i * 7) % 4) * 8, walls[(i + 2) % 5], roofs[i % 4], i % 3 !== 1, i); });
  // the church: tall nave, a turquoise spire, one round window
  { const x = 692, base = ys(700) - 20, w = 46, h = 118, top = base - h; S([[x + w, base], [x + w + 14, base - 7], [x + w + 14, top - 7], [x + w, top]], mix(C.white, C.dark, 0.3), 1.57); S([[x, base], [x + w, base], [x + w, top], [x, top]], C.white, 1.57); S([[x - 2, top], [x + w / 2, top - 96], [x + w + 2, top]], C.turq, 0.3); S([[x + w / 2, top - 96], [x + w + 15, top - 7], [x + w + 2, top]], mix(C.turq, C.dark, 0.3), 0.3); S(ell(x + w / 2 + 2, top + 26, 8, 8), C.dark); S([[x + 16, base - 34], [x + 30, base - 34], [x + 30, base], [x + 16, base]], C.brown, 1.57); L([[x - 2, top], [x + w / 2, top - 96], [x + w + 15, top - 7]], 1.6); L([[x, top], [x, base]], 1.5); L([[x + w / 2 + 2, top - 108], [x + w / 2 + 2, top - 94]], 1.4); L([[x + w / 2 - 4, top - 102], [x + w / 2 + 8, top - 102]], 1.4); }
  [505, 646, 730, 870, 1006].forEach((x, i) => cyp(x, ys(x) + 36, 62 + (i % 2) * 20));
  [470, 530, 592, 656, 736, 806, 874, 944, 1018].forEach((x, i) => house(x, ys(x) + 36, 48 + (i % 2) * 8, 60 + ((i * 5) % 3) * 12, walls[i % 5], roofs[(i + 1) % 4], i % 4 !== 2, i + 3));
  [[118, 668, 20], [150, 676, 16], [236, 690, 18]].forEach(([x, y, rr]) => { S([[x - 2, y + rr], [x + 3, y + rr], [x + 3, y + rr + 16], [x - 2, y + rr + 16]], C.brown, 1.57); S(ell(x, y, rr, rr * 1.05), C.tree, 0.8); L([[x - rr * 0.6, y - rr * 0.5], [x, y - rr * 1.02], [x + rr * 0.8, y - rr * 0.4]], 1.3); });
  // the near hill, the girl's shadow down it
  S(ridge([[-20, 836], [120, 822], [260, 815], [350, 813], [460, 818], [640, 848], [860, 896], [1100, 948]], H), C.fore, -0.1);
  S(sm([[300, 815], [420, 815], [540, 836], [590, 848], [500, 850], [380, 830], [316, 820]]), C.foreD, 0.1);

  // the kite, a diamond of four gores, and its tail of bows
  const kc: P = [828, 206], ka = 0.36, K = (x: number, y: number): P => [kc[0] + x * Math.cos(ka) - y * Math.sin(ka), kc[1] + x * Math.sin(ka) + y * Math.cos(ka)];
  const kt = K(0, -72), kr = K(50, -8), kb = K(0, 86), kl = K(-50, -8), k0 = K(0, -8);
  S([kt, kr, k0], C.mustard, 0.4); S([kr, kb, k0], C.red, 0.4); S([kb, kl, k0], C.mustard, 0.4); S([kl, kt, k0], C.red, 0.4);
  const tail = sm([kb, [kb[0] + 20, kb[1] + 50], [kb[0] - 6, kb[1] + 100], [kb[0] + 26, kb[1] + 150], [kb[0] + 60, kb[1] + 186]], false, 8);
  [0.2, 0.4, 0.6, 0.8, 0.97].forEach((t, i) => { const p = tail[Math.round(t * (tail.length - 1))], c = i % 2 ? C.turq : C.red; S([[p[0], p[1]], [p[0] - 11, p[1] - 7], [p[0] - 11, p[1] + 7]], c, 0); S([[p[0], p[1]], [p[0] + 11, p[1] - 7], [p[0] + 11, p[1] + 7]], c, 0); });
  L([kt, kr, kb, kl, kt], 1.8); L([kt, kb], 1.4); L([kl, kr], 1.4); L(tail, 1.2);

  // THE GIRL. Hair and dress, skin, then the smallest things
  const armR = limb([[368, 570], [402, 534], [417, 489]], [6.3, 5.2, 4.3], 0.6), armL = limb([[306, 578], [285, 613], [266, 643]], [6.3, 5.2, 4.3], 0.5);
  const legB = limb([[322, 646], [316, 730], [308, 800]], [9.5, 6.8, 5], 1.4), legF = limb([[348, 646], [373, 726], [389, 800]], [9.5, 6.8, 5], 1.4);
  const sockB = limb([[312, 770], [308, 801]], [6.4, 5.8]), sockF = limb([[385, 771], [389, 801]], [6.4, 5.8]);
  S(legB.poly, C.skin, 1.5); S(legF.poly, C.skin, 1.4); S(sockB.poly, C.white, 0); S(sockF.poly, C.white, 0);
  const shoeB: P[] = sm([[300, 797], [316, 796], [331, 802], [338, 809], [334, 815], [306, 815], [299, 810]]), shoeF: P[] = sm([[381, 797], [397, 796], [413, 802], [420, 809], [416, 815], [387, 815], [380, 810]]);
  S(shoeB, C.dark, 0); S(shoeF, C.dark, 0);
  S(armL.poly, C.skin, 2.1); S(armR.poly, C.skin, -1.2);
  const dress: P[] = sm([[330, 555], [318, 558], [306, 565], [301, 580], [299, 600], [293, 630], [285, 662], [279, 687], [300, 692], [320, 687], [339, 692], [359, 685], [379, 688], [399, 679], [414, 672], [397, 652], [385, 624], [377, 598], [373, 577], [369, 565], [357, 557], [346, 554]]);
  S(dress, C.red, 1.45);
  S(ell(305, 576, 13, 14, 0.3), C.red, 0); S(ell(371, 571, 13, 12, -0.5), C.red, 0);
  S(sm([[328, 555], [319, 560], [321, 569], [333, 569], [338, 562], [343, 569], [355, 568], [357, 559], [348, 555]]), C.white, 0);
  S([[332, 538], [344, 538], [345, 557], [331, 557]], C.skin, 1.57);
  const head: P[] = sm([[318, 509], [322, 497], [334, 490], [349, 492], [359, 501], [363, 513], [362, 525], [356, 535], [346, 542], [334, 542], [324, 535], [318, 523]]);
  S(head, C.skin, 1.57);
  const hair: P[] = sm([[358, 496], [346, 488], [332, 487], [318, 493], [309, 505], [306, 520], [308, 536], [312, 547], [321, 550], [325, 541], [322, 528], [326, 516], [334, 508], [346, 504], [358, 506], [363, 503]]);
  S(hair, C.hair, 0.6);
  S(ell(326, 523, 4.2, 6.2, 0.1), C.skin, 0);
  // the bow at the back of her head, its tails streaming right in the wind
  S([[315, 494], [301, 484], [299, 499]], C.turq, 0); S([[315, 494], [306, 505], [318, 505]], C.turq, 0); S([[315, 493], [333, 482], [350, 478], [334, 488]], C.turq, 0);
  S(ell(350, 527, 6, 4.5), C.blush, 0);
  // hands: the kite hand a fist round the string, thumb over it; the balance hand open, palm down
  const fist: P[] = sm([[409, 489], [406, 477], [408, 466], [414, 459], [422, 458], [429, 462], [431, 471], [430, 481], [425, 489]]);
  S(fist, C.skin, 0);
  const F = frame([266, 643], [285, 613]), palm: P[] = sm([F(0, -6.2), F(3, -7.4), F(14, -7.8), F(16, 0), F(14, 7.4), F(3, 6.6), F(0, 5.6)]);
  const fingers = [[-5.9, 15, -0.14], [-2, 17, -0.05], [2, 16.5, 0.04], [5.8, 13.5, 0.12]].map(([v, len, sp]) => capsuleUV(F, 13, v, 13 + len, v + len * sp, 1.75));
  const thumb = capsuleUV(F, 4, 6.2, 12, 12.5, 2);
  S(palm, C.skin, 0); fingers.forEach((f) => S(f, C.skin, 0)); S(thumb, C.skin, 0);
  S(ell(351, 513, 2.3, 3, 0.2, 10), C.dark, 0);                               // the eye, looking up at the kite

  // wildflowers in two drifts on her hill, the last and smallest things painted
  const flower = (x: number, y: number, c: string, k: number) => { for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + k; S(ell(x + Math.cos(a) * 4.2, y + Math.sin(a) * 3.2, 3, 2.4, a, 8), c, 0); } S(ell(x, y, 2, 1.8, 0, 8), C.mustard, 0); };
  for (let i = 0; i < 16; i++) { const u = r(), cx = i < 9 ? 70 + u * 200 : 620 + u * 220, cy = i < 9 ? 900 + r() * 120 : 940 + r() * 90; flower(cx, cy, i % 3 ? C.white : C.pink, r() * 3); }
  // dry brush: sky, clouds, hills, grass, the dress's shade side
  [[60, 196, 250], [380, 132, 200], [720, 300, 220], [40, 420, 300], [460, 470, 160]].forEach(([x, y, l]) => D([[x, y], [x + l, y - 4]], 24, mix(C.board, "#ffffff", 0.5)));
  D([[130, 166], [330, 164]], 12, C.board); D([[540, 100], [650, 98]], 9, C.board);
  for (let i = 0; i < 6; i++) { const x = 20 + i * 120 + r() * 40, y = 600 + r() * 60 - i * 18; D([[x, y], [x + 120, y - 30]], 16, mix(C.far, C.dark, 0.25)); }
  for (let i = 0; i < 8; i++) { const x = 420 + i * 82, y = ys(x) - 30 + r() * 30; D([[x, y + 10], [x + 70, y - 18]], 14, C.villD); }
  // grass: flicks in drifts, dense along the crest and in the near corner, bare between
  const tuft = (cx: number, cy: number, n: number, sp: number) => { for (let i = 0; i < n; i++) { const x = cx + (r() - 0.5) * sp * 2, y = cy + (r() - 0.3) * sp * 0.5, l = 22 + r() * 18; D([[x, y + l * 0.5], [x + 4 + r() * 8, y - l * 0.5]], 12 + r() * 6, r() < 0.55 ? mix(C.fore, "#e2ecac", 0.45) : C.foreD); } };
  tuft(150, 850, 9, 110); tuft(560, 880, 6, 70); tuft(90, 990, 8, 90); tuft(820, 960, 7, 90); tuft(420, 1010, 5, 60); tuft(990, 1030, 5, 60);
  D([[380, 600], [398, 668]], 16, mix(C.red, C.dark, 0.3)); D([[365, 578], [372, 610]], 10, mix(C.red, C.dark, 0.3));

  // THE LINE, off register. The girl first, then the kite and its string, then the birds
  const hL = (pts: P[], w = 2.1) => L(pts, w);
  hL([[318, 509], [322, 497], [334, 490], [349, 492], [359, 501], [363, 513], [363, 519], [367, 523], [362, 527], [360, 532], [355, 538], [346, 542], [336, 542]], 2);  // face contour with the nose
  hL([[346, 505], [358, 506], [363, 503]], 1.6); hL([[309, 505], [306, 520], [308, 536], [313, 548], [321, 550], [325, 541]], 1.9);
  hL([[344, 507], [349, 504], [355, 505]], 1.4); hL([[347, 535], [351, 537], [355, 535]], 1.4); hL([[323, 518], [327, 516], [329, 522], [326, 528]], 1.3);
  hL([[318, 558], [306, 565], [301, 580], [299, 600], [293, 630], [285, 662], [279, 687]], 2); hL([[279, 687], [300, 692], [320, 687], [339, 692], [359, 685], [379, 688], [399, 679], [414, 672]], 2.1); hL([[369, 565], [373, 577], [377, 598], [385, 624], [397, 652], [414, 672]], 2);
  hL([[321, 569], [333, 569], [338, 562], [343, 569], [355, 568]], 1.5);
  hL(armR.a.filter((_, i) => i % 2 === 0), 1.6); hL(armR.b.filter((_, i) => i % 2 === 0).slice(3), 1.6); hL(armL.a.filter((_, i) => i % 2 === 0).slice(2), 1.6); hL(armL.b.filter((_, i) => i % 2 === 0), 1.6);
  hL([[408, 466], [414, 459], [422, 458], [429, 462], [431, 471], [430, 481], [425, 489]], 1.6); hL([[410, 468], [414, 462], [419, 465], [423, 460], [428, 463]], 1.2); hL([[425, 474], [430, 475]], 1.1); hL([[424, 480], [429, 481]], 1.1); hL([[427, 470], [436, 466], [438, 472], [431, 477]], 1.3);   // fist: knuckles, thumb over the string
  hL([F(0, -6.2), F(14, -7.8), F(28, -8.3)], 1.3); hL([F(3, 6.6), F(12, 12.5)], 1.2); hL([F(14, 6.8), F(27, 7.4)], 1.2);
  hL(legB.a.filter((_, i) => i % 2 === 0).slice(4), 1.7); hL(legB.b.filter((_, i) => i % 2 === 0).slice(3), 1.7); hL(legF.a.filter((_, i) => i % 2 === 0).slice(4), 1.7); hL(legF.b.filter((_, i) => i % 2 === 0).slice(3), 1.7);
  hL([[372, 721], [375, 726], [372, 731]], 1.2);                                  // the front knee
  hL([[303, 772], [320, 770]], 1.4); hL([[377, 772], [394, 770]], 1.4);             // sock tops
  hL([[316, 796], [331, 802], [338, 809], [334, 815], [306, 815], [299, 810]], 1.6); hL([[397, 796], [413, 802], [420, 809], [416, 815], [387, 815], [380, 810]], 1.6); hL([[304, 801], [318, 799]], 1.1); hL([[385, 801], [399, 799]], 1.1);
  hL([[301, 484], [315, 494], [299, 499]], 1.3); hL([[315, 493], [333, 482], [350, 478]], 1.2);
  L(sm([[423, 459], [520, 402], [640, 318], [770, 248], [826, 214]], false, 8), 1.1);   // the string, sagging a little
  [[600, 150, 1], [640, 128, 0.8], [668, 162, 0.9]].forEach(([x, y, s]) => L([[x - 12 * s, y - 5 * s], [x - 5 * s, y - 2 * s], [x, y + 3 * s], [x + 6 * s, y - 3 * s], [x + 13 * s, y - 6 * s]], 1.4));

  // TIME. Paint big to small; dry brush in the order listed; line in the order listed
  const order = shapes.map((_, i) => i).sort((a, b) => area(shapes[b].pts) - area(shapes[a].pts));
  const span = (ws: number[], a: number, b: number): [number, number][] => { const tot = ws.reduce((x, y) => x + y, 0); let t = 0; return ws.map((w) => { const s: [number, number] = [a + ((b - a) * t) / tot, a + ((b - a) * (t + w)) / tot]; t += w; return s; }); };
  const pw = order.map((i) => 1.4 + Math.sqrt(area(shapes[i].pts)) / 22), pt = span(pw, T.paint[0], T.paint[1]), paintT: [number, number][] = shapes.map(() => [0, 0]);
  order.forEach((i, k) => (paintT[i] = pt[k]));
  const dryT = span(dry.map((d) => 1 + plen(d.path) / 70), T.dry[0], T.dry[1]);
  const lineT = span(lines.map((l) => 1.6 + plen(l.pts) / 60 + (l.pts.length < 5 && plen(l.pts) < 30 ? 0.8 : 0)), T.line[0], T.line[1]);
  return { shapes, dry, lines, order, paintT, dryT, lineT };
};

// ---------------------------------------------------------------- marks
// gouache edge: the flat brush leaves a slightly ragged boundary, sized to the shape
// (a polygon keeps its corners: a house is cut with a flat brush, not rounded into a pebble)
const dens = (s: P[]): P[] => s.flatMap((a, i) => { const b = s[(i + 1) % s.length], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 4)); return Array.from({ length: n }, (_, k) => [a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n] as P); });
const edge = (s: Sh, i: number): P[] => { const a = Math.sqrt(area(s.pts)), amp = clamp(a * 0.011, 0.3, 2.6); return displace(dens(s.pts), amp, 0.11, 2, 40 + i); };
const trace = (c: Ctx, pts: P[]) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); };
// dry brush: bristles side by side, each broken where it skips the board's tooth, more and more
// as the brush runs out toward the end of the stroke
const dryBrush = (c: Ctx, d: Dry, q: number) => {
  const [a, b] = [d.path[0], d.path[d.path.length - 1]], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, nb = Math.max(5, Math.round(d.w / 2.2)), steps = Math.max(6, Math.round(l / 3)), r = rng(d.seed);
  c.strokeStyle = d.col; c.lineWidth = 1.7; c.lineCap = "round"; c.globalAlpha = 0.85; c.beginPath();
  for (let k = 0; k < nb; k++) {
    const v = (k / (nb - 1) - 0.5) * d.w + (r() - 0.5) * 1.2, start = r() * 0.08, dens = 0.2 + r() * 0.14; let on = false;
    for (let j = 0; j <= steps * q; j++) {
      const t = j / steps; if (t < start) continue;
      const skip = fractal(d.seed + k, t * l * 0.35, k * 3.1, 1, 1, 2) < dens + t * 0.35, x = a[0] + dx * t + nx * v, y = a[1] + dy * t + ny * v;
      if (skip) { on = false; continue; } if (!on) { c.moveTo(x, y); on = true; } else c.lineTo(x, y);
    }
  }
  c.stroke(); c.globalAlpha = 1;
};

export const drawMidCentury = (ctx: Ctx, f: number, env: Env) => {
  const key = "midCentury:scene"; let sc = env.cache.get(key) as Scene | undefined; if (!sc) { sc = buildScene(); env.cache.set(key, sc); }
  const ek = "midCentury:edges"; let edges = env.cache.get(ek) as P[][] | undefined; if (!edges) { edges = sc.shapes.map((s, i) => edge(s, i)); env.cache.set(ek, edges); }
  const fin = f >= N - HOLD, at = (w: [number, number]) => (fin || f >= w[1] ? 1 : f <= w[0] ? 0 : (f - w[0]) / (w[1] - w[0]));
  const g = new Gfx(ctx, env, 0, BRUSH);
  ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0);
  ctx.fillStyle = C.board; ctx.fillRect(0, 0, W, H);                          // the bare board
  // flats, drawn in stacking order, each laid by the brush where it has been
  sc.shapes.forEach((s, i) => {
    const q = at(sc!.paintT[i]); if (q <= 0) return;
    ctx.save(); ctx.fillStyle = s.col;
    if (q < 1) { const a = Math.sqrt(area(s.pts)); streakClip(ctx, streaks([edges![i]], clamp(a / 5, 5, 58), s.ang, 60 + i, clamp(a * 0.9, 60, 340)), q); }
    trace(ctx, edges![i]); ctx.fill(); ctx.restore();
  });
  sc.dry.forEach((d, i) => { const q = at(sc!.dryT[i]); if (q > 0) dryBrush(ctx, d, q); });
  // the line plate, off register
  const lq = sc.lines.map((l, i) => at(sc!.lineT[i]));
  if (lq.some((q) => q > 0)) { g.push(REG[0], REG[1], 1); g.group("plain", () => sc!.lines.forEach((l, i) => { if (lq[i] > 0) g.pen(l.pts, { w: l.w, color: C.ink, seed: l.seed, wobble: 0.9, opacity: 0.92, progress: lq[i] >= 1 ? 1 : lq[i] }); })); g.pop(); }
  g.paper("coldpress", 0.16);                                                   // the board's tooth, under everything and through it
};

export const STYLE = { id: "midCentury", name: "Mid-century gouache", family: "1950s-60s storybook", medium: "opaque matte designer's gouache on warm illustration board, a dry brush dragged over the flats, a loose brush-and-ink line printed off register", nearest: "fox", hero: "a hillside village where a girl flies a kite" };

export const midCentury: Film = {
  meta: { title: "Mid-century gouache · the kite", W, H, fps: 30, bpm: 120, durationFrames: N },
  assets: { images: {} },
  shots: [{ id: "board", start: 0, end: N, draw: drawMidCentury }],
};
