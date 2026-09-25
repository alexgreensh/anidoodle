// SCRATCHBOARD KIT. The lynx as FIELDS, no marks: where the animal is (part), how much moonlight
// reaches each point of its fur (tone: 0 = the board stays black, 1 = scraped to white clay),
// which way the fur lies there (ang), and how long the hair is (len). The plate cuts marks from them.
//
// Anatomy (Eurasian lynx, Lynx lynx; head and shoulders, turned ~15 degrees to the viewer's right,
// chin a touch up toward a moon off the upper right). Tall triangular ears set at the top corners
// of the skull, black-rimmed, white hair filling the openings, each ending in a long black tuft.
// A broad flat forehead with dark vertical streaks; large wide-set almond eyes, the inner corner
// lower and drawn down toward the nose, ringed above and below in pale fur, a dark line running
// from the outer corner back into the cheek; in moonlight the pupils are wide and round. A broad
// nose bridge, a small nose leather with slit nostrils, a black lip line that drops from the
// philtrum; puffed white whisker pads carrying rows of dark spots; a small white chin. The facial
// ruff: long hair that flares from below the ears and hangs in two barred, pointed sideburns
// either side of the chin; thick neck fur, a pale throat, the heavy shoulder mass below.
// Reference: from knowledge of lynx portrait photographs (Lynx lynx, Lynx canadensis) and
// scratchboard wildlife portraiture (fur as tapered white flicks cut in the direction of growth).
import { sample, type P } from "./core";

export type LynxField = { W: number; H: number; G: number; gw: number; gh: number; tone: Float32Array; ang: Float32Array; len: Float32Array; part: Uint8Array };
// part: 0 board, 1 head, 2 ear, 3 body, 4 eye (never scraped by fur), 5 nose leather (hatched, not furred)
const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const sstep = (a: number, b: number, v: number) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- authored shapes (1080 space)
// the head with its ruff, clockwise from the near (left) ear's outer base
export const HEAD: P[] = [[400, 342], [384, 374], [352, 410], [322, 452], [306, 500], [308, 548], [320, 600], [338, 650], [360, 700], [382, 746], [408, 722], [446, 724], [480, 750], [512, 722], [546, 706], [566, 712], [588, 706], [622, 728], [654, 748], [686, 722], [724, 736], [748, 690], [760, 650], [768, 610], [786, 560], [798, 506], [794, 456], [778, 410], [758, 376], [742, 348], [700, 302], [640, 282], [566, 276], [494, 284], [440, 302], [412, 322]];
export const EAR_N: P[] = [[392, 352], [392, 290], [396, 230], [403, 184], [410, 156], [418, 152], [440, 188], [466, 236], [492, 290], [440, 306]];
export const EAR_F: P[] = [[642, 290], [670, 236], [698, 190], [716, 158], [724, 152], [732, 176], [738, 232], [744, 296], [748, 356], [700, 304]];
export const TUFT_N: P[] = [[414, 156], [410, 124], [403, 96], [392, 66]], TUFT_F: P[] = [[722, 156], [727, 124], [734, 96], [746, 68]];
export const BODY: P[] = [[330, 500], [312, 600], [282, 700], [224, 800], [124, 900], [10, 970], [-30, 990], [-30, 1110], [1110, 1110], [1110, 940], [1060, 900], [960, 820], [880, 730], [830, 640], [796, 540], [700, 700], [566, 720], [430, 700]];
// eyes as four authored points each: inner corner, top of the lid, outer corner, bottom of the lid
export type Eye = { inner: P; top: P; outer: P; bottom: P; pupil: P; pr: number };
export const EYE_N: Eye = { inner: [528, 448], top: [484, 415], outer: [438, 420], bottom: [486, 460], pupil: [485, 437], pr: 16 };
export const EYE_F: Eye = { inner: [602, 446], top: [638, 413], outer: [680, 416], bottom: [642, 456], pupil: [641, 434], pr: 14.5 };
export const NOSE: P = [566, 536];
export const NOSE_LEATHER: P[] = [[540, 522], [566, 516], [594, 520], [598, 532], [584, 548], [567, 556], [550, 548], [536, 534]];
export const MOON: [number, number, number] = [0.84, -0.46, 0.3];   // to the moon: upper right, low: it rakes across the face

export const eyeOutline = (e: Eye, n = 40): P[] => sample([e.inner, [(e.inner[0] + e.top[0]) / 2, e.top[1] + 4], e.top, [(e.top[0] + e.outer[0]) / 2, (e.top[1] + e.outer[1]) / 2 - 2], e.outer, [(e.outer[0] + e.bottom[0]) / 2, e.bottom[1] - 3], e.bottom, [(e.bottom[0] + e.inner[0]) / 2, e.bottom[1] - 1]], true, Math.ceil(n / 8));

// ---------------------------------------------------------------- grid helpers
const fillPoly = (grid: Uint8Array, gw: number, gh: number, G: number, pts0: P[], val: number) => {
  const pts = sample(pts0, true, 8);
  for (let j = 0; j < gh; j++) {
    const y = j * G + G / 2, xs: number[] = [];
    for (let i = 0, k = pts.length - 1; i < pts.length; k = i++) { const a = pts[i], b = pts[k]; if ((a[1] > y) !== (b[1] > y)) xs.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1])); }
    xs.sort((a, b) => a - b);
    for (let q = 0; q + 1 < xs.length; q += 2) for (let i = Math.max(0, Math.ceil((xs[q] - G / 2) / G)); i <= Math.min(gw - 1, Math.floor((xs[q + 1] - G / 2) / G)); i++) grid[j * gw + i] = val;
  }
};
const distIn = (m: Uint8Array, gw: number, gh: number, test: (v: number) => boolean): Float32Array => {
  const d = new Float32Array(gw * gh), BIG = 1e6;
  for (let i = 0; i < d.length; i++) d[i] = test(m[i]) ? BIG : 0;
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { const k = j * gw + i; if (!d[k]) continue; let v = d[k]; if (i) v = Math.min(v, d[k - 1] + 1); if (j) v = Math.min(v, d[k - gw] + 1); if (i && j) v = Math.min(v, d[k - gw - 1] + 1.414); if (j && i < gw - 1) v = Math.min(v, d[k - gw + 1] + 1.414); d[k] = v; }
  for (let j = gh - 1; j >= 0; j--) for (let i = gw - 1; i >= 0; i--) { const k = j * gw + i; if (!d[k]) continue; let v = d[k]; if (i < gw - 1) v = Math.min(v, d[k + 1] + 1); if (j < gh - 1) v = Math.min(v, d[k + gw] + 1); if (i < gw - 1 && j < gh - 1) v = Math.min(v, d[k + gw + 1] + 1.414); if (j < gh - 1 && i) v = Math.min(v, d[k + gw - 1] + 1.414); d[k] = v; }
  return d;
};
export const segDist = (x: number, y: number, pl: P[]) => { let best = 1e9; for (let i = 1; i < pl.length; i++) { const a = pl[i - 1], b = pl[i], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1, t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / l2), d = Math.hypot(a[0] + dx * t - x, a[1] + dy * t - y); if (d < best) best = d; } return best; };
const gauss = (x: number, y: number, c: P, sx: number, sy: number, rot = 0) => { const dx = x - c[0], dy = y - c[1], cs = Math.cos(rot), sn = Math.sin(rot), u = (dx * cs + dy * sn) / sx, v = (-dx * sn + dy * cs) / sy; return Math.exp(-(u * u + v * v)); };
export const insidePoly = (pts: P[], x: number, y: number) => { let k = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) k = !k; } return k; };

// ---------------------------------------------------------------- fur flow: hand-placed anchors, inverse-distance weighted
// [x, y, angle in degrees (0 = right, 90 = down), weight]
const FLOW: [number, number, number, number][] = [
  [566, 480, -90, 1.4], [566, 420, -90, 1.2], [566, 360, -92, 1], [520, 340, -105, 1], [612, 338, -78, 1], [470, 330, -120, 1], [660, 320, -60, 1], [566, 300, -90, 1],      // bridge and forehead, fanning to the ears
  [520, 400, -150, 1], [610, 398, -30, 1],                                                                                   // over the brows
  [430, 470, 175, 1], [460, 500, 165, 1], [680, 466, 5, 1], [650, 500, 15, 1],                                               // cheeks run back from the eyes
  [380, 500, 112, 1.3], [360, 570, 96, 1.3], [390, 640, 72, 1.2], [450, 684, 52, 1.1], [500, 660, 70, 1],                    // near ruff: out, down, and in toward the chin
  [750, 480, 68, 1.3], [760, 560, 86, 1.3], [792, 500, 82, 1.6], [792, 560, 94, 1.6], [772, 624, 112, 1.4], [318, 520, 98, 1.6], [326, 600, 82, 1.4], [730, 640, 108, 1.2], [680, 680, 128, 1.1], [640, 660, 110, 1],                  // far ruff
  [520, 580, 150, 1], [612, 578, 30, 1], [566, 612, 90, 1],                                                                  // whisker pads sweep out and down, chin down
  [566, 740, 90, 1], [470, 780, 100, 1], [680, 780, 80, 1], [566, 900, 90, 1],                                               // throat and chest
  [340, 460, 130, 1], [250, 600, 130, 1], [140, 740, 142, 1], [260, 860, 112, 1], [120, 960, 115, 1], [400, 900, 100, 1],   // neck and near shoulder
  [820, 700, 60, 1], [920, 790, 40, 1], [1000, 880, 60, 1], [780, 900, 85, 1],                                               // far shoulder
  [420, 250, -80, 1.3], [400, 210, -86, 1], [445, 280, -60, 1], [712, 240, -84, 1.3], [700, 280, -110, 1], [736, 270, -92, 1],   // ears: base toward the tip
];
const LEN: [number, number, number][] = [
  [566, 536, 5], [566, 470, 8], [566, 380, 11], [566, 300, 13], [485, 436, 5], [640, 434, 5], [520, 575, 8], [612, 572, 8], [566, 612, 10],
  [440, 480, 20], [690, 476, 20], [360, 540, 50], [400, 650, 58], [770, 520, 44], [730, 640, 52], [566, 690, 34], [566, 820, 40], [300, 560, 34], [160, 760, 30], [300, 920, 26], [900, 800, 30],
  [420, 240, 11], [712, 240, 11],
];
const idw = (pts: number[][], x: number, y: number, f: (p: number[], w: number) => void) => { for (const p of pts) { const d2 = (x - p[0]) ** 2 + (y - p[1]) ** 2 + 400; f(p, (p[3] ?? 1) / (d2 * d2)); } };

// MARKINGS, evaluated once per grid cell inside their own box: [kind, geometry, width/size, amount]
type Mark = { box: [number, number, number, number]; f: (x: number, y: number, a: number) => number };
const lineM = (pl: P[], w: number, dark: number): Mark => { const xs = pl.map((p) => p[0]), ys = pl.map((p) => p[1]); return { box: [Math.min(...xs) - w, Math.min(...ys) - w, Math.max(...xs) + w, Math.max(...ys) + w], f: (x, y, a) => { const d = segDist(x, y, pl); return d < w ? a * (1 - dark * sstep(w, w * 0.3, d)) : a; } }; };
const spotM = (c: P, r: number, dark: number): Mark => ({ box: [c[0] - r, c[1] - r, c[0] + r, c[1] + r], f: (x, y, a) => { const d = Math.hypot(x - c[0], y - c[1]); return d < r ? a * (1 - dark * sstep(r, r * 0.35, d)) : a; } });
const paleM = (c: P, sx: number, sy: number, to: number): Mark => ({ box: [c[0] - sx * 2.2, c[1] - sy * 2.2, c[0] + sx * 2.2, c[1] + sy * 2.2], f: (x, y, a) => a + (to - a) * clamp(gauss(x, y, c, sx, sy) * 1.7) });
const HEAD_MARKS: Mark[] = [
  paleM([566, 576], 64, 34, 1.05), paleM([566, 624], 34, 24, 1.05),                                     // white whisker pads, white chin
  paleM([484, 466], 44, 13, 1.05), paleM([642, 462], 40, 13, 1.05), paleM([486, 400], 40, 11, 0.95), paleM([640, 398], 36, 11, 0.95), paleM([352, 560], 40, 110, 0.75), paleM([774, 560], 34, 100, 0.8),   /* the ruff's pale hair between its bars */   // pale fur above and below each eye
  lineM([[442, 426], [420, 446], [398, 478], [386, 516]], 10, 0.85), lineM([[676, 424], [700, 444], [720, 474], [730, 510]], 9, 0.8),   // the dark line back from each eye's outer corner
  ...[[[540, 384], [534, 340], [530, 300]], [[556, 382], [555, 336], [554, 290]], [[578, 382], [580, 336], [582, 290]], [[594, 384], [602, 342], [608, 302]]].map((pl) => lineM(pl as P[], 6, 0.75)),   // forehead streaks
  ...[[[330, 470], [328, 540], [350, 620], [386, 690]], [[362, 480], [366, 552], [392, 624], [440, 690]], [[780, 470], [780, 540], [760, 612], [716, 668]], [[750, 482], [752, 552], [730, 616], [684, 672]]].map((pl) => lineM(pl as P[], 12, 0.88)),   // the ruff's two bars each side
  lineM([[566, 556], [566, 576], [548, 590], [522, 596], [506, 592]], 3, 0.95), lineM([[566, 576], [586, 590], [610, 594], [624, 588]], 3, 0.95),   // lip line
  ...Array.from({ length: 12 }, (_, i) => { const r = Math.floor(i / 4), c = i % 4; return [spotM([530 - c * 11 - r * 3, 568 + r * 9 + c * 1.5], 2.4, 0.9), spotM([602 + c * 11 + r * 3, 566 + r * 9 + c * 1.5], 2.4, 0.9)]; }).flat(),   // whisker-spot rows
  ...[[420, 520], [436, 552], [404, 548], [700, 520], [684, 548], [712, 552], [540, 330], [596, 332]].map((c) => spotM(c as P, 5, 0.4)),   // faint cheek and crown spots
];
// smooth a grid in place (separable box, a few passes): anatomy has no creases
const blurGrid = (g: Float32Array, gw: number, gh: number, r: number, passes: number) => {
  const tmp = new Float32Array(g.length);
  for (let p = 0; p < passes; p++) {
    for (let j = 0; j < gh; j++) { let acc = 0; const row = j * gw; for (let i = -r; i <= r; i++) acc += g[row + Math.max(0, Math.min(gw - 1, i))]; for (let i = 0; i < gw; i++) { tmp[row + i] = acc / (2 * r + 1); acc += g[row + Math.min(gw - 1, i + r + 1)] - g[row + Math.max(0, i - r)]; } }
    for (let i = 0; i < gw; i++) { let acc = 0; for (let j = -r; j <= r; j++) acc += tmp[Math.max(0, Math.min(gh - 1, j)) * gw + i]; for (let j = 0; j < gh; j++) { g[j * gw + i] = acc / (2 * r + 1); acc += tmp[Math.min(gh - 1, j + r + 1) * gw + i] - tmp[Math.max(0, j - r) * gw + i]; } }
  }
};

export const lynxField = (W: number, H: number): LynxField => {
  const G = 2, gw = Math.ceil(W / G), gh = Math.ceil(H / G), n = gw * gh, k = W / 1080;
  const S = (pts: P[]) => pts.map(([x, y]) => [x * k, y * k] as P);
  const part = new Uint8Array(n), tone = new Float32Array(n), ang = new Float32Array(n), len = new Float32Array(n);
  fillPoly(part, gw, gh, G, S(BODY), 3); fillPoly(part, gw, gh, G, S(EAR_N), 2); fillPoly(part, gw, gh, G, S(EAR_F), 2); fillPoly(part, gw, gh, G, S(HEAD), 1);
  const dHead = distIn(part, gw, gh, (v) => v === 1), dBody = distIn(part, gw, gh, (v) => v === 3 || v === 1), dEar = distIn(part, gw, gh, (v) => v === 2);
  const eN = S(eyeOutline(EYE_N)), eF = S(eyeOutline(EYE_F)), nl = S(NOSE_LEATHER);
  // HEIGHT: smooth anatomical masses (gaussians, so no mass shows an edge), rolled off at each silhouette
  const h = new Float32Array(n);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const q = j * gw + i, x = (i * G + 1) / k, y = (j * G + 1) / k, p = part[q]; if (!p) continue;
    if (p === 2) { const ed = dEar[q] * G; h[q] = 160 + 12 * sstep(0, 16, ed) - 10 * gauss(x, y, x < 560 ? [430, 262] : [706, 262], 20, 46); continue; }   // the ear: a thin cupped plate
    const body = 130 * Math.sqrt(sstep(0, 240, dBody[q] * G));
    if (p === 3) { h[q] = body; continue; }
    const rim = Math.sqrt(sstep(0, 110, dHead[q] * G));
    let v = 90 * gauss(x, y, [566, 400], 170, 150) + 150 * gauss(x, y, [566, 470], 240, 270);   // the skull, and the whole head's roundness
    v += 58 * gauss(x, y, [566, 560], 62, 48) + 18 * gauss(x, y, [522, 574], 30, 22) + 18 * gauss(x, y, [612, 572], 30, 22);   // muzzle and whisker pads
    v += 22 * gauss(x, y, [566, 470], 22, 55);                                                    // nose bridge
    v += 12 * gauss(x, y, [484, 404], 40, 12, -0.15) + 12 * gauss(x, y, [640, 402], 36, 12, 0.15); // brows
    v -= 16 * gauss(x, y, [485, 438], 34, 20) + 14 * gauss(x, y, [640, 436], 30, 20);            // sockets
    v += 22 * gauss(x, y, [440, 486], 70, 55) + 22 * gauss(x, y, [690, 482], 60, 55);             // cheeks
    v += 14 * gauss(x, y, [566, 616], 30, 22);                                                    // chin
    h[q] = Math.max(body, 70 + 70 * rim + v * (0.35 + 0.65 * rim));
  }
  blurGrid(h, gw, gh, 4, 2);
  const at = (i: number, j: number) => h[Math.max(0, Math.min(gh - 1, j)) * gw + Math.max(0, Math.min(gw - 1, i))];
  const ml = Math.hypot(...MOON), lx = MOON[0] / ml, ly = MOON[1] / ml, lz = MOON[2] / ml, lxy = Math.hypot(lx, ly), dx = lx / lxy, dy = ly / lxy, rise = lz / lxy;
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const q = j * gw + i, p = part[q]; if (!p) continue;
    const x = (i * G + 1) / k, y = (j * G + 1) / k;
    const hx = (at(i + 1, j) - at(i - 1, j)) / (2 * G), hy = (at(i, j + 1) - at(i, j - 1)) / (2 * G);
    let nx = -hx, ny = -hy, nz = 1; const nn = Math.hypot(nx, ny, nz); nx /= nn; ny /= nn; nz /= nn;
    const lam = clamp((nx * lx + ny * ly + nz * lz + 0.3) / 1.3),   /* wrapped: fur scatters light a little past the terminator */ side = Math.hypot(nx, ny) || 1, rim = Math.pow(1 - nz, 1.5) * clamp((nx * dx + ny * dy) / side);
    const sky = 0.16 * Math.max(0, -nx * 0.5 + nz * 0.8);                                          // a little cold skylight from the front-left: the shadow side is not a hole
    let sh = 0; for (let t = 3; t < 300; t += 3) { const ii = Math.round(i + (dx * t) / G), jj = Math.round(j + (dy * t) / G); if (ii < 0 || jj < 0 || ii >= gw || jj >= gh) break; sh = Math.max(sh, clamp((h[jj * gw + ii] - h[q] - t * rise) / (24 + t * 0.9))); if (sh >= 1) break; }
    // ALBEDO: the lynx's own markings
    let a = p === 3 ? 0.1 : 0.42;
    if (p === 1) for (const m of HEAD_MARKS) if (x >= m.box[0] && x <= m.box[2] && y >= m.box[1] && y <= m.box[3]) a = m.f(x, y, a);
    if (p === 2) { const ed = dEar[q] * G, inner = gauss(x, y, x < 560 ? [446, 280] : [700, 282], 22, 36); a = 0.22 + 0.72 * inner; if (ed < 6) a = 0.06; }   // black ear rim, white hair filling the opening
    if (p === 3) a *= sstep(1100, 780, y) * (0.6 + 0.4 * sstep(300, 700, x));   // the coat turns away and down into the dark below the portrait
    if (p === 3) { const f = Math.sin(x * 0.05 + Math.sin(y * 0.031) * 2.2) * Math.sin(y * 0.055 + x * 0.013); if (f > 0.55) a *= 0.75; }   // faint body spots
    const lit = p === 2 ? 0.8 : Math.pow(lam, 1.2) * 2.15 * (1 - 0.9 * sh);
    const back = Math.pow(1 - nz, 2) * clamp(-nx / side - 0.25) * clamp(1 - 2 * Math.max(0, ny / side)) * (p === 3 ? 0.4 : 1);   // the sky behind the animal just rims its shadow side, enough to find the silhouette
    const white = clamp((a - 0.75) / 0.3) * 0.22;                                                    // white fur carries a little light even turned from the moon
    let t = a * (0.05 + lit + (p === 3 ? 0 : sky) + 0.9 * back) + white + 0.55 * rim * (1 - sh) * (p === 2 ? 0.4 : 1);
    if (y > 400 && y < 470 && x > 430 && x < 690 && (insidePoly(eN, x, y) || insidePoly(eF, x, y))) { part[q] = 4; t = 0; }
    else if (y > 505 && y < 565 && x > 530 && x < 605 && insidePoly(nl, x, y)) { part[q] = 5; }
    tone[q] = clamp(t);
    let sx = 0, sy = 0, ws = 0; idw(FLOW, x, y, (pp, w) => { const r = (pp[2] * Math.PI) / 180; sx += Math.cos(r) * w; sy += Math.sin(r) * w; ws += w; });
    const nd = Math.hypot(x - NOSE[0], y - (NOSE[1] + 24)), radial = p === 1 && y > NOSE[1] ? Math.exp(-((nd / 70) ** 2)) : 0;   // the muzzle fur radiates from under the nose
    ang[q] = Math.atan2((sy / ws) * (1 - radial) + ((y - NOSE[1] - 24) / (nd || 1)) * radial, (sx / ws) * (1 - radial) + ((x - NOSE[0]) / (nd || 1)) * radial);
    let ls = 0, lw = 0; idw(LEN, x, y, (pp, w) => { ls += pp[2] * w; lw += w; }); len[q] = (ls / lw) * k;
  }
  return { W, H, G, gw, gh, tone, ang, len, part };
};
// the tone raster at full size, for looking at (debug only)
export const lynxTone = (W: number, H: number) => { const F = lynxField(W, H), raster = new Float32Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const q = Math.min(F.gh - 1, y >> 1) * F.gw + Math.min(F.gw - 1, x >> 1); raster[y * W + x] = F.part[q] ? 1 - F.tone[q] : 1; } return { raster }; };
