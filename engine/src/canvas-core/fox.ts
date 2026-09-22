import { Gfx, PENCIL, fractal, rng, type Ctx, type Env, type P } from "./core";
import type { Film } from "./film";
import { blob, bounds, clipped, fillShape, inside, lerpP, mix, resample, smooth } from "./gallery";

// FOX AT DUSK · cut-paper collage. There is not one drawn line in this picture. Every form is a
// piece of coloured paper: TORN pieces show the white fibrous core of the sheet along their edge,
// SCISSOR-cut pieces are crisp; every piece lifts a little off whatever is under it and throws a
// soft shadow; every paper has its own fibres and its own uneven dye. Form is made the way a
// collage artist makes it, by laying a darker paper into the shade and a lighter one where the
// light lands, and fur is made by the torn edge itself.
//
// A red fox sits in a meadow at dusk with its brush curled round its feet: black stockings,
// a cream bib and cheek ruff, black-backed ears, an amber eye with a slit pupil. Pines on the
// hill, the moon rising to the upper left where the light comes from.

const PAPER_CORE = "#fbf5e6", SHADOW = "#3c2814";
type Piece = { shape: P[]; color: string; torn?: number; seed: number; fibre?: number; lift?: number };

// ---------------------------------------------------------------- paper
const normals = (s: P[]): P[] => s.map((_, i) => { const a = s[(i - 1 + s.length) % s.length], b = s[(i + 1) % s.length], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [dy / l, -dx / l]; });
const ringLen = (s: P[]) => s.reduce((a, p, i) => a + Math.hypot(p[0] - s[(i + 1) % s.length][0], p[1] - s[(i + 1) % s.length][1]), 0);
// a torn edge: the outline resampled finely and bitten in and out by high-frequency noise.
// `grow` pushes it outward: the white core of a torn sheet sticks out past its dyed face.
const tear = (shape: P[], amp: number, seed: number, grow = 0): P[] => {
  const closed = [...shape, shape[0]], n = Math.max(24, Math.round(ringLen(shape) / 2.6)), s = resample(closed, n).slice(0, -1), nr = normals(s), r = rng(seed);
  return s.map(([x, y], i) => { const d = (fractal(seed, x, y, 0.09, 0.09, 3) - 0.5) * amp * 2.2 + (r() - 0.5) * amp * 0.6 + grow; return [x + nr[i][0] * d, y + nr[i][1] * d]; });
};
const cut = (shape: P[], seed: number): P[] => { const s = resample([...shape, shape[0]], Math.max(24, Math.round(ringLen(shape) / 4))).slice(0, -1), r = rng(seed); return s.map(([x, y]) => [x + (r() - 0.5) * 0.7, y + (r() - 0.5) * 0.7]); };

// fibres and uneven dye, clipped to the piece
const fibres = (g: Gfx, shape: P[], color: string, seed: number, density: number) => {
  const b = bounds(shape), r = rng(seed), area = (b.x1 - b.x0) * (b.y1 - b.y0), c = g.cur;
  clipped(g, shape, () => {
    for (let i = 0; i < 5; i++) fillShape(g, blob(b.x0 + r() * (b.x1 - b.x0), b.y0 + r() * (b.y1 - b.y0), 30 + r() * 90, 20 + r() * 60, seed + i, 0.4, 12, r() * 3), r() < 0.5 ? mix(color, "#ffffff", 0.18) : mix(color, "#000000", 0.12), 0.25);
    c.lineCap = "round";
    const n = Math.round((area / 900) * density);
    for (let i = 0; i < n; i++) { const x = b.x0 + r() * (b.x1 - b.x0), y = b.y0 + r() * (b.y1 - b.y0), a = r() * Math.PI, l = 3 + r() * 9; c.strokeStyle = r() < 0.55 ? mix(color, "#fff8e8", 0.45) : mix(color, "#1a0e06", 0.3); c.globalAlpha = 0.25 + r() * 0.3; c.lineWidth = 0.6 + r() * 0.7; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (r() - 0.5) * 3, y + Math.sin(a) * l * 0.5 + (r() - 0.5) * 3, x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); }
    c.globalAlpha = 1;
  });
};

// one layer of paper: every piece's shadow first (soft, down and right), then the pieces
const layer = (g: Gfx, pieces: Piece[]) => {
  const shapes = pieces.map((p) => (p.torn ? tear(p.shape, p.torn, p.seed) : cut(p.shape, p.seed)));
  g.group("plain", () => pieces.forEach((p, i) => { const l = p.lift ?? 1; fillShape(g, shapes[i].map(([x, y]) => [x + 3 * l, y + 5 * l] as P), SHADOW, 0.5); }), { blur: 4, alpha: 0.55 });
  g.group("plain", () => pieces.forEach((p, i) => {
    if (p.torn) fillShape(g, tear(p.shape, p.torn * 0.8, p.seed + 1, p.torn * 0.7), PAPER_CORE);     // the white core where the sheet tore
    fillShape(g, shapes[i], p.color);
    fibres(g, shapes[i], p.color, p.seed + 2, p.fibre ?? 1);
  }));
};
const P0 = (pts: P[], per = 6) => smooth(pts, true, per);

// ---------------------------------------------------------------- the dusk
const sky = (g: Gfx) => {
  layer(g, [{ shape: [[-20, -20], [1100, -20], [1100, 1100], [-20, 1100]], color: "#23485a", seed: 1, fibre: 0.6 }]);
  layer(g, [
    { shape: P0([[-30, 300], [300, 280], [700, 300], [1110, 270], [1110, 1100], [-30, 1100]]), color: "#3d6b74", torn: 3, seed: 2, fibre: 0.5 },
  ]);
  layer(g, [{ shape: P0([[-30, 440], [260, 420], [620, 446], [1110, 418], [1110, 1100], [-30, 1100]]), color: "#b98276", torn: 3.2, seed: 3, fibre: 0.5 }]);
  layer(g, [{ shape: P0([[-30, 520], [400, 506], [800, 526], [1110, 508], [1110, 1100], [-30, 1100]]), color: "#eab58e", torn: 3, seed: 4, fibre: 0.5 }]);
  // the moon, scissor-cut, with two paler scraps laid on it for the seas
  layer(g, [{ shape: Array.from({ length: 40 }, (_, i) => [214 + Math.cos((i / 40) * Math.PI * 2) * 84, 206 + Math.sin((i / 40) * Math.PI * 2) * 84] as P), color: "#f3e3bd", seed: 5, lift: 0.6 }]);
  layer(g, [{ shape: blob(190, 190, 26, 18, 6, 0.2, 10, 0.4), color: "#e2cfa3", torn: 1.2, seed: 6, lift: 0.3 }, { shape: blob(238, 232, 20, 14, 7, 0.25, 10, -0.3), color: "#e2cfa3", torn: 1.2, seed: 7, lift: 0.3 }]);
  // three small stars punched out of gold paper
  layer(g, [[420, 120], [860, 180], [700, 90], [980, 330], [560, 210]].map(([x, y], i) => ({ shape: Array.from({ length: 10 }, (_, k) => { const a = -Math.PI / 2 + (k / 10) * Math.PI * 2, rr = k % 2 ? 4.5 : 11; return [x + Math.cos(a) * rr, y + Math.sin(a) * rr] as P; }), color: "#f2cf6e", seed: 20 + i, lift: 0.3 })));
};

const hills = (g: Gfx) => {
  layer(g, [{ shape: P0([[-30, 600], [170, 548], [380, 574], [600, 540], [820, 566], [1110, 530], [1110, 1100], [-30, 1100]]), color: "#5f7f76", torn: 3.4, seed: 30 }]);
  // pines along the ridge: tiers of torn dark-green paper, each tier its own scrap
  const pine = (x: number, base: number, h: number, seed: number): Piece[] => {
    const out: Piece[] = [{ shape: [[x - 3, base], [x + 3, base], [x + 3, base - h * 0.25], [x - 3, base - h * 0.25]], color: "#3b2a1f", seed: seed + 9 }];
    for (let t = 0; t < 4; t++) { const y0 = base - h * (0.18 + t * 0.2), w = h * (0.34 - t * 0.07); out.push({ shape: [[x - w, y0], [x + w, y0 - 3], [x + w * 0.1, y0 - h * 0.34], [x - w * 0.15, y0 - h * 0.33]], color: t % 2 ? "#23473f" : "#1d3d37", torn: 1.6, seed: seed + t, lift: 0.5 }); }
    return out;
  };
  layer(g, [...pine(96, 580, 150, 40), ...pine(160, 566, 118, 50), ...pine(880, 560, 160, 60), ...pine(950, 548, 128, 70), ...pine(1024, 550, 176, 80)]);
  layer(g, [{ shape: P0([[-30, 700], [240, 670], [520, 690], [800, 664], [1110, 684], [1110, 1100], [-30, 1100]]), color: "#8b8d58", torn: 3.4, seed: 90 }]);
  layer(g, [{ shape: P0([[-30, 820], [300, 800], [620, 816], [900, 796], [1110, 812], [1110, 1100], [-30, 1100]]), color: "#c89140", torn: 3.6, seed: 91, fibre: 1.4 }]);
  layer(g, [{ shape: P0([[-30, 930], [260, 910], [560, 928], [860, 906], [1110, 922], [1110, 1100], [-30, 1100]]), color: "#a8652c", torn: 3.6, seed: 92, fibre: 1.4 }]);
};

// ---------------------------------------------------------------- the fox
const RUST = "#cf5a22", RUST_D = "#9c3c17", RUST_L = "#ec8d45", CREAM = "#f2e2c0", BLACK = "#231813", AMBER = "#e3a53a";
const figure = (g: Gfx) => {
  // the brush in two parts: the far sweep behind the haunch, and the near sweep that lies IN
  // FRONT of the paws, curling round them to its white tip, as a sitting fox wraps its feet
  const tailBack: P[] = P0([[700, 650], [794, 712], [822, 812], [780, 886], [700, 910], [640, 880], [700, 846], [742, 790], [728, 706]]);
  const tailFront: P[] = P0([[770, 872], [690, 918], [580, 934], [470, 926], [392, 904], [360, 880], [382, 864], [470, 886], [580, 894], [680, 880], [744, 846]]);
  const tailTip: P[] = P0([[470, 926], [408, 910], [366, 888], [356, 870], [380, 860], [430, 878], [482, 888], [490, 908]]);
  const tailShade: P[] = P0([[746, 852], [690, 902], [600, 924], [520, 922], [610, 906], [700, 878]]);
  const haunch: P[] = blob(664, 772, 100, 110, 200, 0.05, 18, -0.4);
  const haunchShade: P[] = P0([[742, 730], [760, 800], [726, 864], [660, 884], [700, 850], [732, 790]]);
  const body: P[] = P0([[500, 570], [578, 560], [652, 592], [716, 664], [738, 770], [690, 862], [576, 872], [520, 846], [490, 740], [486, 640]]);
  const shoulder: P[] = P0([[560, 596], [630, 612], [668, 660], [612, 650], [572, 628]]);          // light across the shoulder
  // slender forelegs with black stockings only below the wrist, and neat paws
  const leg = (x0: number, y0: number, x1: number, y1: number, w0: number, w1: number): P[] => P0([[x0 - w0, y0], [x0 + w0, y0], [(x0 + x1) / 2 + w0 * 0.8, (y0 + y1) / 2], [x1 + w1, y1], [x1 - w1, y1], [(x0 + x1) / 2 - w0 * 0.85, (y0 + y1) / 2]], 4);
  const legN = leg(512, 700, 516, 896, 15, 11), legF = leg(566, 716, 570, 892, 13, 10);
  const stock = (x1: number, y1: number, w: number, top: number): P[] => P0([[x1 - w - 2, top], [x1 + w + 2, top + 3], [x1 + w + 1, y1 + 2], [x1 - w - 1, y1 + 2]], 4);
  // the white of a fox runs from the lower jaw down the throat to a point between the forelegs
  const bib: P[] = P0([[452, 556], [520, 566], [556, 598], [558, 672], [540, 740], [522, 790], [502, 746], [480, 670], [462, 604]]);
  const head: P[] = P0([[452, 430], [506, 412], [556, 414], [590, 448], [600, 506], [580, 546], [534, 562], [486, 560], [440, 540], [396, 516], [364, 500], [370, 488], [404, 470]]);
  const jaw: P[] = P0([[368, 502], [410, 510], [458, 530], [520, 546], [566, 540], [590, 528], [614, 556], [598, 562], [574, 578], [530, 582], [470, 568], [416, 542], [378, 516]]);   // the white of the jaw flares back into a pointed cheek tuft
  const brow: P[] = P0([[420, 452], [470, 422], [530, 416], [560, 432], [500, 438], [452, 456]]);
  const earN: P[] = [[462, 432], [516, 418], [488, 318]], earNin: P[] = [[474, 424], [506, 416], [489, 346]];
  const earF: P[] = [[528, 420], [572, 440], [566, 322]];
  const eye: P[] = P0([[430, 470], [446, 462], [464, 464], [472, 472], [456, 476], [440, 476]], 5);

  layer(g, [{ shape: tailBack, color: RUST, torn: 2.6, seed: 300, fibre: 1.2, lift: 1.4 }]);
  layer(g, [{ shape: body, color: RUST, torn: 2.2, seed: 310, fibre: 1.2, lift: 1.3 }, { shape: legF, color: RUST_D, torn: 1.4, seed: 311, lift: 0.9 }]);
  layer(g, [{ shape: haunch, color: RUST, torn: 2.4, seed: 320, lift: 1.2 }, { shape: stock(570, 892, 10, 820), color: "#2e211a", torn: 1.1, seed: 322, lift: 0.4 }]);
  layer(g, [{ shape: haunchShade, color: RUST_D, torn: 2.2, seed: 321, lift: 0.4 }, { shape: shoulder, color: RUST_L, torn: 2, seed: 323, lift: 0.4 }]);
  layer(g, [{ shape: bib, color: CREAM, torn: 3.4, seed: 331, lift: 0.9 }]);
  layer(g, [{ shape: legN, color: RUST, torn: 1.4, seed: 330, lift: 1.1 }]);
  layer(g, [{ shape: stock(516, 896, 11, 816), color: BLACK, torn: 1.2, seed: 332, lift: 0.5 }]);
  layer(g, [{ shape: blob(517, 898, 17, 8, 390, 0.12, 12), color: BLACK, torn: 1, seed: 390, lift: 0.4 }, { shape: blob(572, 896, 15, 7, 391, 0.12, 12), color: "#2e211a", torn: 1, seed: 391, lift: 0.4 }]);
  layer(g, [{ shape: tailFront, color: RUST, torn: 2.6, seed: 303, fibre: 1.2, lift: 1.3 }]);
  layer(g, [{ shape: tailShade, color: RUST_D, torn: 2.2, seed: 301, lift: 0.5 }, { shape: tailTip, color: CREAM, torn: 3.2, seed: 302, lift: 0.7 }]);
  layer(g, [{ shape: earF, color: BLACK, torn: 1.6, seed: 340, lift: 0.8 }, { shape: [[534, 420], [566, 432], [562, 360]], color: RUST_D, torn: 1.2, seed: 341, lift: 0.3 }]);
  layer(g, [{ shape: head, color: RUST, torn: 2, seed: 351, fibre: 1.1, lift: 1.2 }]);
  layer(g, [{ shape: jaw, color: CREAM, torn: 3, seed: 361, lift: 0.6 }, { shape: brow, color: RUST_L, torn: 1.8, seed: 360, lift: 0.4 }, { shape: earN, color: RUST, torn: 1.6, seed: 362, lift: 0.9 }]);
  layer(g, [{ shape: earNin, color: CREAM, torn: 1.8, seed: 370, lift: 0.4 }, { shape: [[480, 350], [498, 350], [489, 318]], color: BLACK, torn: 1, seed: 371, lift: 0.3 }]);
  // the face: a black nose, a fine mouth slip, the amber eye with its slit, one white glint
  layer(g, [{ shape: blob(372, 494, 13, 10, 380, 0.1, 10, 0.3), color: BLACK, seed: 380, lift: 0.4 }, { shape: P0([[382, 508], [412, 512], [440, 520], [438, 523], [410, 516], [383, 512]], 4), color: "#4a2a1e", seed: 381, lift: 0.15 }]);
  layer(g, [{ shape: eye, color: AMBER, seed: 382, lift: 0.3 }]);
  layer(g, [{ shape: P0([[452, 464], [457, 463], [458, 476], [453, 476]], 3), color: BLACK, seed: 383, lift: 0.1 }, { shape: blob(447, 467, 2.4, 2, 384, 0.1, 8), color: "#ffffff", seed: 384, lift: 0.1 }]);
};

// ---------------------------------------------------------------- the foreground
const foreground = (g: Gfx) => {
  // fallen leaves cut from three papers, and torn grass blades across the fox's feet
  const leaf = (cx: number, cy: number, s: number, a: number, color: string, seed: number): Piece => {
    const pts: P[] = [[0, -1], [0.26, -0.64], [0.6, -0.72], [0.44, -0.32], [0.9, -0.12], [0.46, 0.12], [0.62, 0.52], [0.18, 0.34], [0, 0.9], [-0.18, 0.34], [-0.62, 0.52], [-0.46, 0.12], [-0.9, -0.12], [-0.44, -0.32], [-0.6, -0.72], [-0.26, -0.64]];
    return { shape: pts.map(([x, y]) => [cx + (x * Math.cos(a) - y * Math.sin(a)) * s, cy + (x * Math.sin(a) + y * Math.cos(a)) * s] as P), color, seed, lift: 0.6 };
  };
  const r = rng(700);
  layer(g, [leaf(250, 960, 34, 0.4, "#b6352a", 701), leaf(760, 972, 28, -0.8, "#e0962f", 702), leaf(890, 1010, 38, 1.2, "#8f2e1f", 703), leaf(140, 1030, 30, -0.3, "#e0962f", 704), leaf(640, 1040, 24, 2.2, "#b6352a", 705), leaf(990, 900, 22, 0.9, "#c96a2a", 706)]);
  const blades: Piece[] = [];
  for (let i = 0; i < 26; i++) { const x = 300 + r() * 560, h = 26 + r() * 46, lean = (r() - 0.5) * 24, y = 900 + r() * 26; if (x > 340 && x < 800) continue; blades.push({ shape: [[x - 4, y], [x + 4, y], [x + lean + 1, y - h]], color: r() < 0.5 ? "#6f7a3a" : "#8c8f48", torn: 0.8, seed: 720 + i, lift: 0.4 }); }
  layer(g, blades);
  void inside; void lerpP;
};

export const drawFox = (ctx: Ctx, _frame: number, env: Env) => {
  const g = new Gfx(ctx, env, 0, PENCIL);
  ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0);
  sky(g); hills(g); figure(g); foreground(g);
  g.paper("paper", 0.1);
};

export const fox: Film = {
  meta: { title: "Fox at dusk · cut-paper collage", W: 1080, H: 1080, fps: 30, bpm: 120, durationFrames: 1 },
  assets: { images: {} },
  shots: [{ id: "fox", start: 0, end: 1, draw: drawFox }],
};
