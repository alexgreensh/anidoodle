import { rng, sample, type Ctx, type Env, type Layer, type P } from "./core";
import type { Film } from "./film";
import { bokashi, carved, clamp, fillAll, gouged, grain, path, rubMask, rubPath, washi } from "./woodcutKit";

// HERONS IN RAIN ON THE DRUM BRIDGE · ukiyo-e colour woodblock (nishiki-e).
//
// MEDIUM, physically: water-based pigment and rice paste brushed onto carved cherry blocks and
// printed by hand onto damp kozo washi, one block per colour, the sheet laid each time against
// the KENTO (an L-shaped notch and a straight guide cut in the block's margin) and rubbed from
// behind with a baren. The KEYBLOCK carries the black line (sumi): each line is a ridge left
// standing between two knife cuts, so its width steps and wanders where the carver re-set the
// knife and every end is a flat chisel cut, never the swell-and-taper of a brush or pen. Each
// COLOUR BLOCK prints a flat where the wood was left standing; big flats show the plank's grain
// and the speckle where the baren rubbed thin (goma-zuri). BOKASHI is the graded wipe: the
// printer wipes the inked block with a damp cloth so the colour runs from full to nothing.
//
// MARKS: carved line, flat colour, grain, bokashi. EDGE: the keyline's hard knife edge; colour
// flats land a hair off their keylines (kento registration is good, never perfect), so a thread
// of paper or an overlap shows at some edges. ORDER: keyblock first; then the colour blocks,
// lightest to darkest; the bokashi blocks last. PALETTE: sumi #1f1b18, usuzumi sky #c6c1b0,
// kihada yellow #d49c3a, heron grey #9fa4a4, far bank #adaf9c, wood #a77a4a, water #9ab5c4,
// near bank #7d8a73, rain grey #8a8983, bokashi bero-ai #2c4a78 and sumi-indigo #3a4557.
// PAPER: warm kozo washi with long curling bast fibres, the margin left bare, the kento pressed
// into it blind.
//
// NOT RISOGRAPH, NOT HALFTONE: no screen, no dots, no overprinted flat inks mixing into new
// colours. Colour is FLAT and shaped by the knife; tone is only bokashi; line is only the key.
//
// SUBJECT, REFERENCE (from knowledge): two grey herons (Ardea cinerea) in rain on the rail of a
// taiko-bashi (a steep wooden drum bridge), after the way Hiroshige crops a bridge large and lets
// rain cross the whole sheet in fine carved diagonals ("Sudden Shower over Shin-Ohashi", 1857),
// and his bird-and-flower prints of herons. Anatomy: dagger bill longer than the head; a black
// stripe from the eye running back into nape plumes; white face and neck with black streaks down
// its front; long pale plumes hanging from the lower neck; grey mantle and folded wing with a
// black patch at the bend and black primaries at the rear; long legs with the intertarsal joint
// bending BACK; three long front toes and a hind toe gripping the rail. One stands alert at the
// crest, neck up in its S; the other hunches further down the slope on one leg, neck sunk into
// its shoulders, as herons do in rain. Both face left, into the wind; the rain drives from the
// upper left. The bridge: kasagi top rail, a nuki mid-rail, posts, the keta deck girder with its
// beam ends, piles and a tie beam into the river; a far bank of trees lost in rain; reeds.
// LIGHT: flat rain light from above. Form comes from bokashi, not a cast shadow: the sky darkens
// to the top, the river deepens toward us, and the underside of the bridge throws a dark band of
// shade down onto the water beneath it (the cast shadow of the piece).

const W0 = 1080, M = 54, IN = { x0: M, y0: M, x1: W0 - M, y1: W0 - M };
const SUMI = "#1f1b18", SKY = "#c6c1b0", YELLOW = "#d49c3a", GREY = "#9fa4a4", FAR = "#adaf9c", WOOD = "#a77a4a", WATER = "#9ab5c4", NEAR = "#7d8a73", RAIN = "#8a8983", AI = "#2c4a78", INDIGO = "#3a4557", UNDER = "#3f3a3c";

// ---------------------------------------------------------------- the bridge
const Y = (x: number) => 470 + 0.0006 * (x - 380) * (x - 380);     // the kasagi's centreline
const POSTS = [96, 246, 404, 560, 716, 876], PILES = [150, 430, 700, 972], WL = 956, SHORE = 548;
const band = (a: number, b: number, x0 = 20, x1 = 1060): P[] => { const top: P[] = [], bot: P[] = []; for (let x = x0; x <= x1; x += 8) { top.push([x, Y(x) + a]); bot.push([x, Y(x) + b]); } return [...top, ...bot.reverse()]; };
const edge = (off: number, x0 = 20, x1 = 1060): P[] => { const o: P[] = []; for (let x = x0; x <= x1; x += 24) o.push([x, Y(x) + off]); return o; };
const box = (x0: number, y0: number, x1: number, y1: number): P[] => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const KASAGI = band(-11, 11), NUKI = band(64, 76), KETA = band(150, 196);
const postBox = (x: number) => box(x - 9, Y(x) + 11, x + 9, Y(x) + 150);
const pileBox = (x: number) => box(x - 14, Y(x) + 196, x + 14, WL);
const TIE: P[] = box(20, 852, 930, 870);
const BRACES: P[][] = PILES.slice(0, -1).map((x, i) => { const a: P = [x + 14, Y(x) + 214], b: P = [PILES[i + 1] - 14, 852]; const nx = -(b[1] - a[1]), ny = b[0] - a[0], l = Math.hypot(nx, ny), h = 7; return [[a[0] + (nx / l) * h, a[1] + (ny / l) * h], [b[0] + (nx / l) * h, b[1] + (ny / l) * h], [b[0] - (nx / l) * h, b[1] - (ny / l) * h], [a[0] - (nx / l) * h, a[1] - (ny / l) * h]]; });
const BEAMS = Array.from({ length: 17 }, (_, i) => 70 + i * 60);
const BRIDGE: P[][] = [KASAGI, NUKI, KETA, ...BEAMS.map((x) => box(x - 6, Y(x) + 194, x + 6, Y(x) + 209)), ...POSTS.map(postBox), ...PILES.map(pileBox), TIE, ...BRACES];

// ---------------------------------------------------------------- the herons (local: feet at 0,0, facing left)
type Heron = { strokes: [P[], number][]; solids: P[][]; outline: P[]; grey: P[]; legs: P[][]; toes: P[][]; eye: P; bill: P[] };
const seg = (pts: P[]) => sample(pts, false, 6);
const heronA = (): Heron => {
  const billTop: P[] = [[-116, -271], [-98, -275], [-82, -279], [-70, -283]], billBot: P[] = [[-116, -271], [-98, -270], [-82, -269], [-70, -267]];
  const head: P[] = [[-70, -283], [-62, -289], [-50, -289], [-42, -282]], neckBack: P[] = [[-42, -282], [-33, -266], [-24, -246], [-17, -222], [-15, -198], [-8, -176], [2, -162]];
  const back: P[] = [[2, -162], [20, -156], [42, -142], [62, -126], [80, -112], [94, -103]], under: P[] = [[94, -103], [70, -95], [48, -89], [24, -85]];
  const belly: P[] = [[24, -85], [6, -80], [-12, -84], [-30, -97], [-42, -114], [-46, -132]], neckFront: P[] = [[-70, -267], [-63, -256], [-54, -238], [-45, -216], [-44, -194], [-49, -172], [-50, -152], [-46, -132]];
  const wingEdge: P[] = [[-10, -152], [4, -134], [26, -116], [52, -106], [78, -102]];
  const outline = [...seg(billTop), ...seg(head), ...seg(neckBack), ...seg(back), ...seg(under), ...seg(belly), ...seg([...neckFront].reverse()), ...seg([...billBot].reverse())];
  return {
    strokes: [[billTop, 2.6], [billBot, 2.4], [head, 3.0], [neckBack, 3.2], [back, 3.8], [under, 3.0], [belly, 3.4], [neckFront, 3.0], [wingEdge, 2.8],
      [[[-47, -182], [-53, -164], [-55, -144]], 1.6], [[[-45, -178], [-49, -158], [-49, -138]], 1.5], [[[-42, -175], [-43, -156], [-40, -139]], 1.4], [[[-49, -188], [-57, -170], [-61, -150]], 1.5],
      [[[4, -148], [22, -134], [36, -125]], 1.5], [[[16, -153], [36, -139], [52, -128]], 1.5], [[[30, -146], [50, -132], [66, -121]], 1.4]],
    solids: [[[-67, -282], [-52, -286], [-36, -283], [-12, -281], [14, -284], [-8, -277], [-34, -276], [-56, -278]], [[44, -118], [66, -111], [94, -103], [70, -99], [48, -104]], [[-13, -155], [-3, -159], [5, -149], [-5, -142]],
      ...[0.3, 0.42, 0.54, 0.66, 0.78].map((t) => { const i = Math.round(t * 6), p = neckFront[i], q = neckFront[i + 1]; const x = p[0] + (q[0] - p[0]) * 0.5 + 6, y = p[1] + (q[1] - p[1]) * 0.5; return [[x, y - 6], [x + 2.6, y - 5], [x + 1.8, y + 6], [x - 0.6, y + 5]] as P[]; })],
    outline, grey: [...seg([[-16, -200], [-8, -176], [2, -162]]), ...seg(back), ...seg([[94, -103], [78, -102]]), ...seg([...wingEdge].reverse()), ...seg([[-10, -152], [-14, -170], [-16, -200]])],   /* mantle and folded wing; breast, flank and neck stay white paper */
    legs: [[[1, -2], [6, -24], [8, -46]], [[8, -46], [4, -66], [-3, -84]], [[13, -2], [17, -24], [20, -44]], [[20, -44], [16, -64], [11, -84]]],
    toes: [[[1, 0], [-12, 2], [-24, 6]], [[1, 0], [-9, 5], [-15, 11]], [[1, 0], [10, 3]], [[13, 0], [2, 3], [-8, 7]], [[13, 0], [22, 2]]], eye: [-58, -281],
    bill: [...seg(billTop), ...seg([...billBot].reverse())],
  };
};
// the second heron RESTS: neck folded right down so the head sits on its shoulders and the
// folded neck bulges out in front as a pouch of plumes, bill level, on one leg, the other tucked up
const heronB = (): Heron => {
  const billTop: P[] = [[-82, -163], [-66, -167], [-50, -171], [-39, -174]], billBot: P[] = [[-82, -163], [-64, -163], [-50, -164], [-39, -165]];
  const head: P[] = [[-39, -174], [-33, -181], [-22, -184], [-11, -179]], back: P[] = [[-11, -179], [-5, -167], [5, -157], [23, -146], [47, -130], [67, -112], [86, -93]];
  const front: P[] = [[-39, -165], [-47, -158], [-52, -145], [-51, -128], [-45, -111], [-31, -96], [-12, -86], [10, -83]], under: P[] = [[86, -93], [62, -87], [36, -83], [10, -83]];
  const wingEdge: P[] = [[-7, -151], [4, -128], [24, -108], [50, -96], [72, -92]];
  const outline = [...seg(billTop), ...seg(head), ...seg(back), ...seg(under), ...seg([...front].reverse()), ...seg([...billBot].reverse())];
  return {
    strokes: [[billTop, 2.5], [billBot, 2.3], [head, 3.0], [back, 3.8], [front, 3.3], [under, 2.8], [wingEdge, 3.0],
      [[[-49, -141], [-55, -123], [-57, -104]], 1.5], [[[-46, -135], [-50, -116], [-48, -100]], 1.4], [[[-51, -149], [-59, -133], [-63, -114]], 1.5],
      [[[6, -150], [24, -134], [38, -124]], 1.4], [[[20, -150], [40, -134], [56, -120]], 1.4], [[[34, -142], [52, -126], [66, -112]], 1.3]],
    solids: [[[-35, -178], [-22, -182], [-10, -179], [8, -173], [24, -166], [6, -171], [-12, -175], [-31, -176]], [[46, -115], [68, -105], [86, -93], [64, -91], [48, -100]], [[-9, -153], [0, -157], [6, -147], [-3, -141]],
      ...[[-46, -155], [-49, -145], [-50, -134]].map(([x, y]) => [[x + 5, y - 5], [x + 7.5, y - 4], [x + 6.5, y + 5], [x + 4, y + 4]] as P[])],
    outline, grey: [...seg(back), ...seg([[86, -93], [72, -92]]), ...seg([...wingEdge].reverse()), ...seg([[-7, -151], [-11, -179]])],
    legs: [[[2, -2], [6, -26], [8, -50]], [[8, -50], [4, -67], [-1, -84]]],
    toes: [[[2, 0], [-10, 2], [-21, 6]], [[2, 0], [-7, 5], [-13, 10]], [[2, 0], [12, 3]]], eye: [-29, -175],
    bill: [...seg(billTop), ...seg([...billBot].reverse())],
  };
};
const place = (h: Heron, x: number, y: number, s: number): Heron => {
  const t = (p: P): P => [x + p[0] * s, y + p[1] * s], T = (a: P[]) => a.map(t);
  return { strokes: h.strokes.map(([p, w]) => [T(p), w * s]), solids: h.solids.map(T), outline: T(h.outline), grey: T(h.grey), legs: h.legs.map(T), toes: h.toes.map(T), eye: t(h.eye), bill: T(h.bill) };
};
const A = place(heronA(), 330, Y(330) - 11, 1.02), B = place(heronB(), 860, Y(860) - 11, 1.08);
const HERONS = [A, B];
const legRibbons = (h: Heron) => h.legs.map((l, i) => carved(l, i % 2 ? 7.5 : 5, 700 + i, { step: 0.05, tail: 0.9 }));

// ---------------------------------------------------------------- the far bank, the reeds, the rain
const FARBANK: P[] = (() => { const r = rng(801), top: P[] = []; for (let x = IN.x0 - 10; x <= IN.x1 + 10; x += 6) { const clump = Math.abs(Math.sin(x * 0.031 + 1.3)) ** 0.6 * 20 + Math.abs(Math.sin(x * 0.083)) ** 0.5 * 8, pine = x > 600 && x < 700 ? 30 * Math.exp(-(((x - 650) / 22) ** 2)) : 0; top.push([x, 512 - clump - pine - r() * 2]); } return [...top, [IN.x1 + 10, SHORE], [IN.x0 - 10, SHORE]]; })();
const REEDS: P[] = (() => { const r = rng(811), top: P[] = [[720, SHORE + 4]]; for (let x = 730; x <= IN.x1 + 10; x += 7) top.push([x, SHORE - 6 - r() * 10], [x + 3, SHORE - 18 - r() * 34], [x + 5, SHORE - 6 - r() * 8]); return [...top, [IN.x1 + 10, SHORE + 14], [720, SHORE + 12]]; })();
const rain = (seed: number, n: number, dir: P, lo: number, hi: number, w0: number, w1: number): [P[], number][] => {
  const r = rng(seed), l = Math.hypot(dir[0], dir[1]), d: P = [dir[0] / l, dir[1] / l], out: [P[], number][] = [];
  for (let i = 0; out.length < n && i < n * 6; i++) {
    const x = IN.x0 - 120 + r() * (IN.x1 - IN.x0 + 120), y = IN.y0 - 60 + r() * (IN.y1 - IN.y0), sheetOfRain = 0.5 + 0.5 * Math.sin(x * 0.012 - y * 0.004 + seed);
    if (r() > 0.25 + 0.75 * sheetOfRain) continue;                                  // drifts of rain with thinner gaps between
    const onBird = HERONS.some((h) => { const b = h.outline; let c = false; for (let a = 0, j = b.length - 1; a < b.length; j = a++) if (b[a][1] > y !== b[j][1] > y && x < ((b[j][0] - b[a][0]) * (y - b[a][1])) / (b[j][1] - b[a][1]) + b[a][0]) c = !c; return c; });
    if (onBird && r() < 0.8) continue;                                              // the carver spared the birds' heads and backs
    const L = lo + r() * (hi - lo); out.push([[[x, y], [x + d[0] * L, y + d[1] * L]], w0 + r() * (w1 - w0)]);
  }
  return out;
};
const RAIN_K = rain(821, 230, [0.2, 1], 40, 240, 1.0, 1.5), RAIN_G = rain(822, 150, [0.25, 1], 70, 300, 1.8, 2.6);
const RIPPLES: P[][] = (() => { const r = rng(831), out: P[][] = []; for (let i = 0; i < 400 && out.length < 120; i++) { const t = Math.pow(r(), 1.5), y = SHORE + 14 + t * (IN.y1 - SHORE - 20), x = IN.x0 + 10 + r() * (IN.x1 - IN.x0 - 20), L = 8 + t * 34; if (BRIDGE.some((b) => { let c = false; for (let a = 0, j = b.length - 1; a < b.length; j = a++) if (b[a][1] > y !== b[j][1] > y && x < ((b[j][0] - b[a][0]) * (y - b[a][1])) / (b[j][1] - b[a][1]) + b[a][0]) c = !c; return c; })) continue; out.push([[x - L / 2, y], [x, y - 1.5 - t * 2], [x + L / 2, y]]); } return out; })();

// ---------------------------------------------------------------- the blocks
// Each block is the wood left standing for one colour. Drawn in 1080-space onto a full-size layer.
type Block = { id: string; color: string; alpha: number; reg: P; grain: number; seed: number; cut: (c: Ctx) => void };
const knock = (c: Ctx, shapes: P[][]) => { c.save(); c.globalCompositeOperation = "destination-out"; fillAll(c, shapes, "#000"); c.restore(); };   // carve away: those areas print nothing from this block
const birds = () => HERONS.map((h) => h.outline);
const BLOCKS: Block[] = [
  { id: "key", color: SUMI, alpha: 0.95, reg: [0, 0], grain: 0.06, seed: 1, cut: (c) => {
    const k = (pts: P[], w: number, s: number, o = {}) => fillAll(c, [carved(pts, w, s, o)], SUMI);
    // the frame line round the picture
    k([[IN.x0, IN.y0], [IN.x1, IN.y0]], 3.2, 11, { smooth: false }); k([[IN.x1, IN.y0], [IN.x1, IN.y1]], 3.2, 12, { smooth: false }); k([[IN.x1, IN.y1], [IN.x0, IN.y1]], 3.2, 13, { smooth: false }); k([[IN.x0, IN.y1], [IN.x0, IN.y0]], 3.2, 14, { smooth: false });
    c.save(); path(c, [[IN.x0, IN.y0], [IN.x1, IN.y0], [IN.x1, IN.y1], [IN.x0, IN.y1]]); c.clip();
    // the bridge: every timber's edges, grain lines along the rails, the beam ends in the girder
    [-11, 11, 64, 76, 150, 196].forEach((o, i) => k(edge(o), o === 11 || o === 196 ? 3.0 : 2.4, 30 + i));
    POSTS.forEach((x, i) => { k([[x - 9, Y(x) + 11], [x - 9, Y(x) + 150]], 2.6, 40 + i, { smooth: false }); k([[x + 9, Y(x) + 11], [x + 9, Y(x) + 150]], 2.2, 50 + i, { smooth: false }); });
    PILES.forEach((x, i) => { k([[x - 14, Y(x) + 196], [x - 14, WL]], 2.8, 60 + i, { smooth: false }); k([[x + 14, Y(x) + 196], [x + 14, WL]], 2.4, 70 + i, { smooth: false }); [-1, 1].forEach((sd, j) => k([[x + sd * 16, WL + 2], [x + sd * 28, WL + 1], [x + sd * 40, WL + 3]], 1.6, 76 + i * 2 + j, { tail: 0.5 }));   /* where each pile goes into the river, the water rings it */ });
    k([[20, 852], [930, 852]], 2.4, 80, { smooth: false }); k([[20, 870], [930, 870]], 2.6, 81, { smooth: false }); k([[930, 852], [930, 870]], 2.2, 82, { smooth: false });
    BRACES.forEach((b, i) => { k([b[0], b[1]], 2.2, 90 + i, { smooth: false }); k([b[3], b[2]], 2.2, 95 + i, { smooth: false }); });
    BEAMS.forEach((x, i) => { const y = Y(x) + 196; k([[x - 6, y], [x - 6, y + 13], [x + 6, y + 13], [x + 6, y]], 1.8, 100 + i, { smooth: false }); });   // the ends of the deck's cross-beams, standing out under the girder
    const r = rng(120); for (let i = 0; i < 16; i++) { const x0 = 40 + r() * 900, L = 60 + r() * 160, o = r() < 0.5 ? -4 + r() * 8 : 166 + r() * 22; k(edge(o, x0, x0 + L), 1.1, 130 + i, { tail: 0.4 }); } // grain carved along the kasagi and the girder
    // water: ripples, and the far bank's waterline broken by the rain
    RIPPLES.forEach((p, i) => k(p, 1.3 + (p[0][1] - SHORE) / 300, 200 + i, { tail: 0.5 }));
    // the herons: contours, then the black of crest, primaries, shoulder and neck streaks
    HERONS.forEach((h, j) => { h.strokes.forEach(([p, w], i) => k(p, w, 300 + j * 50 + i)); fillAll(c, h.solids.map((s, i) => gouged(s, 400 + j * 20 + i, true, 0.6)), SUMI);
      h.legs.forEach((l, i) => k(l.map(([x, y]) => [x + 2.2, y] as P), 1.5, 460 + j * 10 + i, { tail: 0.7 })); h.toes.forEach((t, i) => k(t, 2.4, 480 + j * 10 + i, { tail: 0.6 }));
      c.strokeStyle = SUMI; c.lineWidth = 1.3; c.beginPath(); c.arc(h.eye[0], h.eye[1], 3.1, 0, Math.PI * 2); c.stroke(); c.fillStyle = SUMI; c.beginPath(); c.arc(h.eye[0] - 0.5, h.eye[1], 1.3, 0, Math.PI * 2); c.fill(); });
    // the rain: fine carved diagonals across everything
    RAIN_K.forEach(([p, w], i) => k(p, w, 1000 + i, { smooth: false, step: 0.2, tail: 0.6 }));
    c.restore();
  } },
  { id: "sky", color: SKY, alpha: 0.9, reg: [1.5, -1], grain: 0.34, seed: 2, cut: (c) => { fillAll(c, [box(IN.x0, IN.y0, IN.x1, SHORE + 2)], SKY); knock(c, [...BRIDGE, ...birds()]); } },
  { id: "yellow", color: YELLOW, alpha: 0.92, reg: [-1, 1.5], grain: 0.05, seed: 3, cut: (c) => { HERONS.forEach((h) => { fillAll(c, [h.bill], YELLOW); fillAll(c, legRibbons(h), YELLOW); fillAll(c, h.toes.map((t, i) => carved(t, 4, 600 + i)), YELLOW); c.fillStyle = YELLOW; c.beginPath(); c.arc(h.eye[0], h.eye[1], 3.2, 0, Math.PI * 2); c.fill(); }); } },
  { id: "farbank", color: FAR, alpha: 0.85, reg: [-1.5, 0.5], grain: 0.18, seed: 5, cut: (c) => { c.save(); path(c, FARBANK); c.clip(); const g = c.createLinearGradient(0, 470, 0, SHORE); g.addColorStop(0, FAR); g.addColorStop(0.6, FAR); g.addColorStop(1, FAR + "55"); c.fillStyle = g; c.fillRect(0, 400, W0, 200); c.restore(); knock(c, [...BRIDGE, ...birds()]); } },
  { id: "heron", color: GREY, alpha: 0.88, reg: [2, 1], grain: 0.1, seed: 4, cut: (c) => { HERONS.forEach((h) => fillAll(c, [h.grey], GREY)); } },
  { id: "wood", color: WOOD, alpha: 0.9, reg: [1, 2], grain: 0.3, seed: 6, cut: (c) => { c.save(); path(c, [[IN.x0, IN.y0], [IN.x1, IN.y0], [IN.x1, IN.y1], [IN.x0, IN.y1]]); c.clip(); fillAll(c, BRIDGE, WOOD); c.restore(); knock(c, birds()); } },
  { id: "near", color: NEAR, alpha: 0.9, reg: [1.5, -1.5], grain: 0.12, seed: 8, cut: (c) => { fillAll(c, [REEDS], NEAR); knock(c, [...BRIDGE, ...birds()]); } },
  { id: "water", color: WATER, alpha: 0.88, reg: [-2, 1], grain: 0.34, seed: 7, cut: (c) => { fillAll(c, [box(IN.x0, SHORE, IN.x1, IN.y1)], WATER); knock(c, BRIDGE.filter((b) => b !== KASAGI && b !== NUKI)); } },
  { id: "rain", color: RAIN, alpha: 0.75, reg: [0, 0], grain: 0.05, seed: 9, cut: (c) => { c.save(); path(c, [[IN.x0, IN.y0], [IN.x1, IN.y0], [IN.x1, IN.y1], [IN.x0, IN.y1]]); c.clip(); RAIN_G.forEach(([p, w], i) => fillAll(c, [carved(p, w, 2000 + i, { smooth: false, tail: 0.6 })], RAIN)); c.restore(); } },
  { id: "bokSky", color: INDIGO, alpha: 0.9, reg: [0.5, 0], grain: 0.26, seed: 10, cut: (c) => { bokashi(c, IN.x0, IN.x1, IN.y0, 250, INDIGO, 841, box(IN.x0, IN.y0, IN.x1, 320)); knock(c, birds()); } },
  { id: "bokWater", color: AI, alpha: 0.9, reg: [-1, 1], grain: 0.26, seed: 11, cut: (c) => { bokashi(c, IN.x0, IN.x1, IN.y1, 790, AI, 842, box(IN.x0, 700, IN.x1, IN.y1)); knock(c, BRIDGE.filter((b) => b !== KASAGI && b !== NUKI)); } },
  { id: "under", color: UNDER, alpha: 0.85, reg: [1, 1], grain: 0.2, seed: 12, cut: (c) => {   // the bridge's shade on the river beneath it, and the girder's underside
    const shade: P[] = [...edge(196), [1060, WL + 30], [20, WL + 30]];
    c.save(); path(c, shade); c.clip(); for (let x = 20; x < 1060; x += 6) { const top = Y(x) + 190, g = c.createLinearGradient(0, top, 0, top + 220); g.addColorStop(0, UNDER + "ff"); g.addColorStop(0.3, UNDER + "c8"); g.addColorStop(1, UNDER + "00"); c.fillStyle = g; c.fillRect(x, top, 6.5, 230); } c.restore();
    c.save(); path(c, KETA); c.clip(); for (let x = 20; x < 1060; x += 6) { const bot = Y(x) + 196, g = c.createLinearGradient(0, bot, 0, bot - 30); g.addColorStop(0, UNDER + "cc"); g.addColorStop(1, UNDER + "00"); c.fillStyle = g; c.fillRect(x, bot - 32, 6.5, 33); } c.restore();
    PILES.forEach((x, i) => { const r = rng(850 + i); c.fillStyle = UNDER + "aa"; for (let y = WL + 4; y < WL + 66; y += 6 + r() * 5) { const w = 13 * (1 - (y - WL) / 80) + r() * 5; c.fillRect(x - w + (r() - 0.5) * 6, y, w * 2, 2.5 + r() * 2); } }); // the piles' broken reflections
    knock(c, [...PILES.map(pileBox), TIE, ...BRACES]);
  } },
];

const blockLayer = (env: Env, b: Block): Layer => {
  const key = `woodcut:block:${b.id}:${env.W}x${env.H}@${env.scale}`; let L = env.cache.get(key) as Layer | undefined; if (L) return L;
  const k = env.scale, s = (env.W / W0) * k; L = env.canvas(Math.round(env.W * k), Math.round(env.H * k)); const c = L.ctx;
  c.setTransform(s, 0, 0, s, b.reg[0] * s, b.reg[1] * s); c.save(); c.beginPath(); c.rect(IN.x0 - 2 - b.reg[0], IN.y0 - 2 - b.reg[1], IN.x1 - IN.x0 + 4, IN.y1 - IN.y0 + 4); c.clip(); b.cut(c); c.restore();   /* the block is only as big as the picture */
  grain(c, env, b.grain, [b.seed * 97 % 512, b.seed * 211 % 512], ((b.seed % 3) - 1) * 0.004);
  env.cache.set(key, L); return L;
};

// the blind kento impressions in the bottom margin, pressed in with the first pull
const kento = (c: Ctx, env: Env) => {
  const s = (env.W / W0) * env.scale; c.save(); c.setTransform(s, 0, 0, s, 0, 0); c.lineWidth = 1.2;
  const mark = (pts: P[]) => { c.strokeStyle = "rgba(255,252,240,0.8)"; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x - 0.8, y - 0.8) : c.moveTo(x - 0.8, y - 0.8))); c.stroke(); c.strokeStyle = "rgba(120,100,70,0.35)"; c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x + 0.8, y + 0.8) : c.moveTo(x + 0.8, y + 0.8))); c.stroke(); };
  mark([[IN.x1 - 30, IN.y1 + 26], [IN.x1, IN.y1 + 26], [IN.x1, IN.y1 + 8]]); mark([[IN.x0 + 150, IN.y1 + 26], [IN.x0 + 214, IN.y1 + 26]]);
  c.restore();
};

// ---------------------------------------------------------------- the pulls (the film)
const PAUSE = 5, START = 0;   /* a breath between pulls while the next block is inked */
const RUB: Record<string, number> = { key: 70, sky: 35, yellow: 10, farbank: 15, heron: 10, wood: 40, near: 10, water: 40, rain: 15, bokSky: 30, bokWater: 30, under: 20 };   /* a small block is a quick pull */
const PULLS = (() => { let t = START; return BLOCKS.map((b, i) => { const p = { b, start: t, end: t + RUB[b.id] }; t = p.end + (i < BLOCKS.length - 1 ? PAUSE : 0); return p; }); })();
const DONE = PULLS[PULLS.length - 1].end, N = Math.ceil((DONE + 30) / 15) * 15;
(() => { if (PULLS.some((p) => p.start % 5 || p.end % 5) || N % 15) throw new Error("woodcut: pulls off the grid"); if (N > 540 || N < 300) throw new Error("woodcut: duration out of range"); })();

// the sheet after the first n pulls (cached; only the newest is kept)
const sheet = (env: Env, n: number): Layer => {
  const key = `woodcut:sheet:${n}:${env.W}x${env.H}@${env.scale}`; let L = env.cache.get(key) as Layer | undefined; if (L) return L;
  for (const ck of [...env.cache.keys()]) if (ck.startsWith("woodcut:sheet:") && Math.abs(Number(ck.split(":")[2]) - n) > 1) env.cache.delete(ck);
  const DW = Math.round(env.W * env.scale), DH = Math.round(env.H * env.scale);
  L = env.canvas(DW, DH); const c = L.ctx; c.setTransform(1, 0, 0, 1, 0, 0);
  if (n > 0) c.drawImage(sheet(env, n - 1).canvas, 0, 0); else c.drawImage(washi(env).canvas, 0, 0);
  if (n > 0) { const b = BLOCKS[n - 1]; c.globalCompositeOperation = "multiply"; c.globalAlpha = b.alpha; c.drawImage(blockLayer(env, b).canvas, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = "source-over"; if (n === 1) kento(c, env); }
  env.cache.set(key, L); return L;
};

const PAD = 250;
const draw = (ctx: Ctx, f: number, env: Env) => {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  let n = 0; while (n < PULLS.length && f >= PULLS[n].end) n++;
  ctx.drawImage(sheet(env, n).canvas, 0, 0);
  const p = PULLS[n]; if (!p || f < p.start) return;
  // the pull in progress: the baren working down the back of the sheet, the colour coming through where it has passed
  const u = (f - p.start) / (p.end - p.start),   /* frame 0 is the bare sheet */ s = (env.W / W0) * env.scale, DW = Math.round(env.W * env.scale), DH = Math.round(env.H * env.scale);
  const mk = `woodcut:mask:${DW}x${DH}`, m = (env.cache.get(mk) as Layer | undefined) ?? (() => { const t = env.canvas(DW, DH); env.cache.set(mk, t); return t; })(), c = m.ctx;
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = "source-over"; c.clearRect(0, 0, DW, DH);
  c.setTransform(s, 0, 0, s, 0, 0); rubMask(c, rubPath(blockBox(p.b), PAD), u, PAD, p.b.seed * 7);
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = "source-in"; c.drawImage(blockLayer(env, p.b).canvas, 0, 0); c.globalCompositeOperation = "source-over";
  ctx.globalCompositeOperation = "multiply"; ctx.globalAlpha = p.b.alpha; ctx.drawImage(m.canvas, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
};
// the part of the sheet each block covers: the printer rubs only over the block
const blockBox = (b: Block) => {
  const all: P[] = b.id === "yellow" || b.id === "heron" ? HERONS.flatMap((h) => [...h.outline, ...h.toes.flat()]) : b.id === "near" ? REEDS : b.id === "farbank" ? FARBANK : b.id === "bokSky" ? box(IN.x0, IN.y0, IN.x1, 300) : b.id === "bokWater" ? box(IN.x0, 760, IN.x1, IN.y1) : b.id === "under" ? box(IN.x0, 640, IN.x1, WL + 80) : b.id === "wood" ? box(IN.x0, 440, IN.x1, IN.y1) : b.id === "sky" ? box(IN.x0, IN.y0, IN.x1, SHORE) : b.id === "water" ? box(IN.x0, SHORE, IN.x1, IN.y1) : box(IN.x0, IN.y0, IN.x1, IN.y1);
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; all.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
  return { x0: clamp(x0 - 20, 0, W0), y0: clamp(y0 - 20, 0, W0), x1: clamp(x1 + 20, 0, W0), y1: clamp(y1 + 20, 0, W0) };
};

export const woodcut: Film = {
  meta: { title: "Herons in rain on the drum bridge · ukiyo-e woodblock", W: 1080, H: 1080, fps: 30, bpm: 120, durationFrames: N, raster: "cpu" },   /* twelve full-size block layers: keep every surface in software so no page antialiases differently */
  assets: { images: {} },
  shots: [{ id: "pulls", start: 0, end: N, draw }],
};

export const STYLE = { id: "woodcut", name: "Ukiyo-e colour woodblock", family: "print", medium: "water-based pigment printed by baren from hand-carved cherry blocks onto damp kozo washi: a sumi keyblock, flat colour blocks, bokashi wipes", nearest: "lighthouse", hero: "two grey herons in rain on a wooden drum bridge" };
