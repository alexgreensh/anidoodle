// SCRAPBOOK ENGRAVINGS: the two copperplate spot illustrations of the honeybee page, as lists of
// burin cuts in the order an engraver cuts them (contours, then the shading passes part by part,
// then cross-hatching in the darks, then fur and detail, the cast shadow last).
//
// Realism, stated. A worker honeybee (Apis mellifera), dorsal view in flight, three-quarter turned
// so nothing is mirrored: head wider than long with large kidney-shaped compound eyes on its sides
// and three ocelli on the vertex; elbowed antennae (a long scape, then a ringed flagellum); a
// round, densely furred thorax carrying two wing pairs, the forewing longer and overlapping the
// hindwing's leading edge, venation with a long marginal cell at the tip and three submarginal
// cells; a narrow waist; an abdomen of six visible tergites, each with a pale felted hair band at
// its base and a dark hind margin; three pairs of jointed legs (femur, tibia, a five-part tarsus
// with claws), the hind tibia flattened into a pollen basket that carries a load (she is a
// returning forager). References consulted from memory: 19th-century natural-history plates of
// the honeybee (Cheshire's "Bees and Bee-keeping" style dorsal plates), standard hymenopteran
// wing-venation diagrams, and macro photographs of corbicula pollen loads.
// The flower is a dog rose (Rosa canina): five broad heart-notched petals, imbricate, cupped, on a
// tilted face, a ring of many stamens round a flat disc of styles, a prickled stem and a pinnate
// leaf with serrate leaflets. Light: one lamp, upper left, for both.
import { rng, fractal, type P } from "./core";
import { profile, resample, smooth } from "./gallery";
import { cutLine, dense, occluder, type Cut, type Occluder, clamp01 } from "./scrapbookKit";

const L3 = (() => { const v = [-0.52, -0.64, 0.56], l = Math.hypot(v[0], v[1], v[2]); return v.map((x) => x / l); })();

// a two-sided frame hung on a spine: at(t, s), s > 0 uses hp, s < 0 uses hn
export type Frame = { at: (t: number, s: number) => P; nrm: (t: number) => P; tan: (t: number) => P; hw: (t: number, s: number) => number; outline: P[]; len: number };
export const frame = (ctrl: P[], hp: (t: number) => number, hn: (t: number) => number = hp, n = 90): Frame => {
  const sp = resample(smooth(ctrl, false, 12), n), nr: P[] = sp.map((_, i) => { const a = sp[Math.max(0, i - 1)], b = sp[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [-dy / l, dx / l]; });
  let len = 0; for (let i = 1; i < n; i++) len += Math.hypot(sp[i][0] - sp[i - 1][0], sp[i][1] - sp[i - 1][1]);
  const pick = (arr: P[], t: number): P => { const f = clamp01(t) * (n - 1), i = Math.floor(f), k = Math.min(n - 1, i + 1), u = f - i; return [arr[i][0] + (arr[k][0] - arr[i][0]) * u, arr[i][1] + (arr[k][1] - arr[i][1]) * u]; };
  const hw = (t: number, s: number) => (s >= 0 ? hp(t) : hn(t));
  const at = (t: number, s: number): P => { const p = pick(sp, t), q = pick(nr, t), w = hw(t, s); return [p[0] + q[0] * w * s, p[1] + q[1] * w * s]; };
  const L: P[] = [], R: P[] = []; for (let i = 0; i <= 60; i++) { const t = i / 60; L.push(at(t, 1)); R.push(at(t, -1)); }
  return { at, nrm: (t) => pick(nr, t), tan: (t) => { const q = pick(nr, t); return [q[1], -q[0]]; }, hw, outline: [...L, ...R.reverse()], len };
};
const K = (k: [number, number][]) => profile(k);

// shading of a rounded tube at (t, s): the normal leans out across s and toward the ends
const tubeShade = (f: Frame, t: number, s: number, round = 0.7): number => {
  const q = f.nrm(t), tg = f.tan(t), e = 2 * t - 1, ek = Math.sign(e) * Math.pow(Math.abs(e), 5) * round, sc = Math.max(-1, Math.min(1, s));
  let nx = q[0] * sc + tg[0] * ek, ny = q[1] * sc + tg[1] * ek; const nz = Math.sqrt(Math.max(0.02, 1 - sc * sc - ek * ek)), l = Math.hypot(nx, ny, nz); nx /= l; ny /= l;
  const lam = Math.max(0, nx * L3[0] + ny * L3[1] + (nz / l) * L3[2]);
  return 1 - (0.1 + 0.9 * lam);
};
const combine = (a: number, b: number) => 1 - (1 - a) * (1 - b);
const toneW = (tone: number, wMax: number, lo = 0.14) => wMax * Math.pow(clamp01((tone - lo) / (1 - lo)), 0.85);

// transverse rings across a tube (constant t), bowed toward `bowDir` so the segment reads convex
const rings = (f: Frame, t0: number, t1: number, gap: number, tone: (t: number, s: number) => number, wMax: number, occ: Occluder[], bow = 0.14, sExt = 1.02): Cut[] => {
  const n = Math.max(2, Math.round(((t1 - t0) * f.len) / gap)), out: Cut[] = [];
  for (let i = 0; i <= n; i++) {
    const t = t0 + ((t1 - t0) * i) / n, tg = f.tan(t), hwM = (f.hw(t, 1) + f.hw(t, -1)) / 2, pts: P[] = [], ss: number[] = [];
    for (let k = 0; k <= 24; k++) { const s = -sExt + (2 * sExt * k) / 24, p = f.at(t, s), b = (1 - s * s) * hwM * bow; pts.push([p[0] + tg[0] * b, p[1] + tg[1] * b]); ss.push(s); }
    const d = dense(pts, 1.8), m = d.length;
    out.push(cutLine(d, (_x, _y, j) => toneW(tone(t, -sExt + (2 * sExt * j) / (m - 1)), wMax), occ, 1.8));
  }
  return out;
};
// longitudinal lines (constant s): the cross-hatch that goes in only where the tone is deep
const along = (f: Frame, s0: number, s1: number, gap: number, t0: number, t1: number, tone: (t: number, s: number) => number, wMax: number, lo: number, occ: Occluder[]): Cut[] => {
  const hwM = (f.hw(0.5, 1) + f.hw(0.5, -1)) / 2, n = Math.max(1, Math.round(((s1 - s0) * hwM) / gap)), out: Cut[] = [];
  for (let i = 0; i <= n; i++) {
    const s = s0 + ((s1 - s0) * i) / n, pts: P[] = [];
    for (let k = 0; k <= 30; k++) pts.push(f.at(t0 + ((t1 - t0) * k) / 30, s));
    const d = dense(pts, 1.8), m = d.length;
    out.push(cutLine(d, (_x, _y, j) => toneW(tone(t0 + ((t1 - t0) * j) / (m - 1), s), wMax, lo), occ, 1.8));
  }
  return out;
};
// a contour, heavier on the side turned from the light
const contour = (pts: P[], w0: number, w1: number, occ: Occluder[], closed = true): Cut => {
  const d = dense(closed ? [...pts, pts[0], pts[1]] : pts, 1.6), n = d.length;
  let cx = 0, cy = 0; d.forEach(([x, y]) => { cx += x; cy += y; }); cx /= n; cy /= n;
  return cutLine(d, (x, y, i) => { const a = d[Math.max(0, i - 1)], b = d[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; let ox = dy / l, oy = -dx / l; if (ox * (x - cx) + oy * (y - cy) < 0) { ox = -ox; oy = -oy; } const away = clamp01(-(ox * L3[0] + oy * L3[1]) / Math.hypot(L3[0], L3[1]) * 0.5 + 0.5); return w0 + (w1 - w0) * away * away; }, occ, 1.6);
};
const open = (pts: P[], w: number, occ: Occluder[] = [], taper = true): Cut => cutLine(smooth(pts, false, 8), (_x, _y, i, n) => w * (taper ? 0.55 + 0.45 * Math.sin((Math.PI * (i + 0.5)) / n) : 1), occ, 1.6);
// short fur flicks: from a seed point along a direction, tapered, width from tone
const flick = (p: P, dir: number, len: number, w: number, curl: number): Cut => { const pts: P[] = []; for (let k = 0; k <= 5; k++) { const u = k / 5, a = dir + curl * u; pts.push([p[0] + Math.cos(a) * len * u, p[1] + Math.sin(a) * len * u]); } return { pts, w: pts.map((_, i) => w * Math.sin((Math.PI * (i + 0.7)) / 6.4)) }; };

// ---------------------------------------------------------------- the bee
export type Engraving = { passes: Cut[][]; tint: { shape: P[]; color: string; alpha: number }[]; bounds: P[] };
export const bee = (ox: number, oy: number, deg: number, sc: number): Engraving => {
  const a = (deg * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a), B = ([x, y]: P): P => [ox + (x * ca - y * sa) * sc, oy + (x * sa + y * ca) * sc], BB = (ps: P[]) => ps.map(B);
  const r = rng(4242);
  // parts, drawn from the back of the stack forward
  const abd = frame(BB([[0, 50], [3, 108], [8, 168], [13, 226]]), K([[0, 13], [0.1, 33], [0.3, 46], [0.55, 46], [0.78, 35], [0.93, 17], [1, 4]]));
  const thx = frame(BB([[0, -46], [1, 0], [0, 50]]), K([[0, 22], [0.18, 43], [0.5, 52], [0.82, 45], [1, 20]]));
  const head = frame(BB([[0, -44], [-1, -76], [0, -108]]), K([[0, 24], [0.14, 42], [0.42, 47], [0.74, 36], [1, 13]]));
  const scale = (f: number) => f * sc;
  const oAbd = occluder(abd.outline), oThx = occluder(thx.outline), oHead = occluder(head.outline);
  // legs: femur, tibia, basitarsus + four small tarsomeres, claw. [attach, knee, ankle, foot]
  type Leg = { j: P[]; w: [number, number, number]; hind?: boolean };
  const legs: Leg[] = [
    // every leg leaves the underside of the THORAX (fore, mid, hind pairs), so each is hidden where
    // it enters under the thorax's edge; knees of the fore and mid legs bend forward and out, the
    // hind femur runs back and the tibia (the pollen basket) trails back along the abdomen
    { j: [[-18, -30], [-54, -50], [-62, -90], [-52, -122]], w: [6, 5, 3] }, { j: [[20, -28], [58, -44], [72, -82], [86, -108]], w: [6, 5, 3] },
    { j: [[-28, -2], [-80, 10], [-106, 56], [-124, 92]], w: [6.5, 5.5, 3.2] }, { j: [[30, 0], [84, 4], [116, 42], [142, 66]], w: [6.5, 5.5, 3.2] },
    { j: [[-22, 26], [-68, 60], [-86, 120], [-78, 168]], w: [7, 9, 4], hind: true }, { j: [[24, 26], [68, 64], [94, 124], [102, 174]], w: [7, 9, 4], hind: true },
  ];
  const bodyOcc = [oAbd, oThx, oHead];
  const legPasses: Cut[] = [], legContours: Cut[] = [], pollen: P[][] = [], legOutlines: P[][] = [];
  legs.forEach((lg, li) => {
    const J = BB(lg.j);
    const segs: [P, P, number, number][] = [[J[0], J[1], lg.w[0] * 1.1, lg.w[0] * 0.8], [J[1], J[2], lg.w[1] * 0.75, lg.w[1] * (lg.hind ? 1.25 : 0.9)], [J[2], [J[2][0] + (J[3][0] - J[2][0]) * 0.42, J[2][1] + (J[3][1] - J[2][1]) * 0.42], lg.w[2] * (lg.hind ? 1.5 : 1.1), lg.w[2] * 0.9]];
    segs.forEach(([p0, p1, w0, w1], si) => {
      const mid: P = [(p0[0] + p1[0]) / 2 + (r() - 0.5) * 3, (p0[1] + p1[1]) / 2 + (r() - 0.5) * 3], f = frame([p0, mid, p1], (t) => scale(w0 + (w1 - w0) * t) * (0.85 + 0.3 * Math.sin(Math.PI * t)), undefined, 30);
      legOutlines.push(f.outline);
      legContours.push(contour(f.outline, 0.7, 1.5, bodyOcc));
      legPasses.push(...along(f, -0.85, 0.85, 2.2, 0.04, 0.96, (t, s) => combine(tubeShade(f, t, s, 0.5), 0.5), 1.15, 0.2, bodyOcc));
      for (let k = 0; k < 5; k++) { const t = 0.15 + k * 0.17, sd = k % 2 ? 1 : -1, p = f.at(t, sd * 1.02), q = f.nrm(t); legPasses.push(flick(p, Math.atan2(q[1] * sd, q[0] * sd) + 0.7 * sd, scale(4 + r() * 3), 0.55, 0.3)); }
      // the fringe of long hairs on the hind tibia's edges: the pollen basket's rim
      if (lg.hind && si === 1) for (let k = 0; k < 11; k++) { const t = 0.12 + k * 0.075; [1, -1].forEach((sd) => { const p = f.at(t, sd * 1.05), q = f.nrm(t); legPasses.push(flick(p, Math.atan2(q[1] * sd, q[0] * sd) + 0.5, scale(7 + r() * 4), 0.7, 0.4)); }); }
      if (lg.hind && si === 1) { const c = f.at(0.55, li % 2 ? -0.1 : 0.1), rr = scale(12); pollen.push(Array.from({ length: 24 }, (_, i) => { const u = (i / 24) * Math.PI * 2, k = 1 + (fractal(li + 90, Math.cos(u) * 2, Math.sin(u) * 2, 0.7, 0.7, 2) - 0.5) * 0.3; return [c[0] + Math.cos(u) * rr * 1.15 * k, c[1] + Math.sin(u) * rr * k] as P; })); }
    });
    // the small tarsomeres as a beaded chain, then the claw
    const t0 = segs[2][1], end = J[3]; legContours.push(cutLine(dense([t0, end], 1.5), (_x, _y, i, n) => scale(3.2 - 1.4 * (i / n)) * (0.75 + 0.25 * Math.abs(Math.sin((i / n) * Math.PI * 4))), bodyOcc, 1.5));
    const dx = end[0] - t0[0], dy = end[1] - t0[1], l = Math.hypot(dx, dy); [0.5, -0.5].forEach((da) => { const an = Math.atan2(dy, dx) + da; legContours.push(open([end, [end[0] + Math.cos(an) * scale(6), end[1] + Math.sin(an) * scale(6)], [end[0] + Math.cos(an + da * 1.4) * scale(9), end[1] + Math.sin(an + da * 1.4) * scale(9)]], 1.1, bodyOcc)); });
    void l;
  });
  // pollen load: stipple, dense in the shade, then a broken rim
  const pollenCuts: Cut[] = [];
  pollen.forEach((sh, i) => { const rr = rng(700 + i); let cx = 0, cy = 0; sh.forEach(([x, y]) => { cx += x; cy += y; }); cx /= sh.length; cy /= sh.length; for (let k = 0; k < 140; k++) { const u = rr() * Math.PI * 2, d = Math.sqrt(rr()), p: P = [cx + Math.cos(u) * d * scale(13), cy + Math.sin(u) * d * scale(11.5)], tone = clamp01(0.35 + ((p[0] - cx) * -L3[0] + (p[1] - cy) * -L3[1]) / scale(20)); if (rr() < tone) pollenCuts.push(flick(p, rr() * 6.28, 1.6, 1.1, 0)); } pollenCuts.push(contour(sh, 0.3, 1.2, [])); });

  // abdomen: six tergites. Tone = form shading + a dark hind margin on each; the felt band at
  // each base is left pale and cut later as fur
  const terg = [0.1, 0.25, 0.41, 0.57, 0.72, 0.86, 1];
  const pig = (t: number) => { for (let i = 0; i < terg.length - 1; i++) if (t >= terg[i] && t < terg[i + 1]) { const u = (t - terg[i]) / (terg[i + 1] - terg[i]); return u < 0.28 ? 0.02 : u > 0.62 ? 0.62 : 0.3; } return 0.5; };
  const abdTone = (t: number, s: number) => combine(tubeShade(abd, t, s, 0.9), pig(t));
  const abdCuts = rings(abd, 0.03, 0.99, 3.0, abdTone, 1.75, [oThx], 0.2);
  const abdCross = along(abd, -0.95, 0.95, 3.6, 0.05, 0.98, abdTone, 1.1, 0.55, [oThx]);
  const tergLines = terg.slice(1, -1).map((t) => { const pts: P[] = []; for (let k = 0; k <= 24; k++) { const s = -1 + k / 12, p = abd.at(t, s), tg = abd.tan(t), b = (1 - s * s) * abd.hw(t, 1) * 0.2; pts.push([p[0] + tg[0] * b, p[1] + tg[1] * b]); } return cutLine(pts, (x, y, i, n) => 0.8 + 1.1 * clamp01(i / n), [oThx], 1.6); });
  // felt bands: short flicks laid backward across each tergite base
  const felt: Cut[] = []; terg.slice(0, -2).forEach((t0, i) => { const t1 = t0 + (terg[i + 1] - t0) * 0.3; for (let k = 0; k < 26; k++) { const t = t0 + r() * (t1 - t0), s = (r() - 0.5) * 1.9, p = abd.at(t, s), tg = abd.tan(t); felt.push(flick(p, Math.atan2(tg[1], tg[0]) + s * 0.5, scale(5 + r() * 3), 0.55 + 0.5 * tubeShade(abd, t, s), 0.3)); } });

  // thorax: form rings under a pelt of flicks radiating from the centre; the fur breaks the silhouette
  const thxTone = (t: number, s: number) => combine(tubeShade(thx, t, s, 0.9), 0.35);
  const thxCuts = rings(thx, 0.04, 0.96, 3.4, thxTone, 1.4, [oHead], 0.25);
  const fur: Cut[] = []; const c0 = thx.at(0.5, 0);
  for (let k = 0; k < 330; k++) { const t = r(), s = (r() * 2 - 1) * 1.08, p = thx.at(t, s); if (oHead && occHit(oHead, p)) continue; const dir = Math.atan2(p[1] - c0[1], p[0] - c0[0]) + (r() - 0.5) * 0.7, tone = thxTone(clamp01(t), s); fur.push(flick(p, dir, scale(5 + r() * 5), 0.4 + 0.95 * tone, (r() - 0.5) * 0.9)); }
  // tegulae: the little scale over each wing root
  const teg = [[-38, -18], [38, -20]].map((q) => contour(Array.from({ length: 12 }, (_, i) => { const u = (i / 12) * 6.28; return B([q[0] + Math.cos(u) * 7, q[1] + Math.sin(u) * 5]); }), 0.6, 1.2, []));

  // head: face rings, big eyes cross-hatched dark with a lit spot left bare, ocelli, mandibles
  const headTone = (t: number, s: number) => combine(tubeShade(head, t, s, 0.6), 0.4);
  const eyeL: P[] = [], eyeR: P[] = []; for (let i = 0; i <= 16; i++) { const t = 0.06 + (i / 16) * 0.74; eyeL.push(head.at(t, 1.03)); eyeR.push(head.at(t, -1.03)); } for (let i = 16; i >= 0; i--) { const u = i / 16, t = 0.06 + u * 0.74, d = 0.12 + 0.36 * Math.pow(Math.sin(Math.PI * u), 0.8); eyeL.push(head.at(t, 1.03 - d)); eyeR.push(head.at(t, -(1.03 - d))); } const eyeLs = smooth(eyeL, true, 3), eyeRs = smooth(eyeR, true, 3); eyeL.length = 0; eyeL.push(...eyeLs); eyeR.length = 0; eyeR.push(...eyeRs);
  const oEyes = [occluder(eyeL), occluder(eyeR)];
  const headCuts = rings(head, 0.05, 0.97, 3.2, headTone, 1.5, oEyes, 0.12);
  const eyeCuts: Cut[] = [];
  [eyeL, eyeR].forEach((ey, ei) => {
    const b = ey.reduce((m, [x, y]) => ({ x0: Math.min(m.x0, x), y0: Math.min(m.y0, y), x1: Math.max(m.x1, x), y1: Math.max(m.y1, y) }), { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 }), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, hl: P = [cx - (b.x1 - b.x0) * 0.12, cy - (b.y1 - b.y0) * 0.16];
    const inEye = occluder(ey);
    [0.7, -0.5].forEach((ang, pass) => { const ca2 = Math.cos(ang), sa2 = Math.sin(ang), R = Math.hypot(b.x1 - b.x0, b.y1 - b.y0) / 2; for (let v = -R; v <= R; v += 2.2) { const pts: P[] = []; for (let u = -R; u <= R; u += 1.5) pts.push([cx + u * ca2 - v * sa2, cy + u * sa2 + v * ca2]); eyeCuts.push(cutLine(pts, (x, y) => { if (!occHit(inEye, x, y)) return 0; const dh = Math.hypot(x - hl[0], y - hl[1]) / (R * 0.4); return (pass ? 1.0 : 1.25) * clamp01((dh - 0.22) * 2.2) * (ei ? 1.1 : 0.95); }, [], 1.5)); } });
    eyeCuts.push(contour(ey, 0.9, 1.9, []));
  });
  const ocelli = [[0, -58], [-8, -52], [8, -52]].map((q) => contour(Array.from({ length: 10 }, (_, i) => { const u = (i / 10) * 6.28; return B([q[0] + Math.cos(u) * 3, q[1] + Math.sin(u) * 3]); }), 0.6, 1, []));
  const mand = [open(BB([[-9, -104], [-13, -113], [-7, -118]]), 1.6), open(BB([[9, -104], [14, -112], [8, -118]]), 1.6)];
  const headFur: Cut[] = []; for (let k = 0; k < 60; k++) { const t = 0.05 + r() * 0.5, s = (r() - 0.5) * 1.1, p = head.at(t, s); if (oEyes.some((o) => occHit(o, p))) continue; headFur.push(flick(p, Math.atan2(-head.tan(t)[1], -head.tan(t)[0]) + (r() - 0.5) * 1.2, scale(4 + r() * 3), 0.5 + 0.6 * headTone(t, s), 0.4)); }
  // antennae: scape, elbow, a ringed flagellum
  const ant = ([[[-9, -104], [-18, -118], [-21, -130]], [[-21, -130], [-32, -146], [-50, -159], [-68, -164]]] as P[][]).concat([[[9, -104], [19, -116], [24, -128]], [[24, -128], [29, -150], [40, -170], [50, -186]]]);
  const antCuts: Cut[] = []; ant.forEach((seg, i) => { const pts = BB(seg); antCuts.push(open(pts, scale(i % 2 ? 2.4 : 3.2), [], false)); if (i % 2) { const d = dense(smooth(pts, false, 8), 5); d.slice(1, -1).forEach((p, k) => { const q = d[k + 2], dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1; antCuts.push({ pts: [[p[0] - (dy / l) * 1.8, p[1] + (dx / l) * 1.8], [p[0] + (dy / l) * 1.8, p[1] - (dx / l) * 1.8]], w: [0.7, 0.7] }); }); } });

  // wings: outline, veins, a whisper of membrane lines toward the trailing edge
  type Wing = { ctrl: P[]; lead: (t: number) => number; trail: (t: number) => number; veins: P[][]; flip: boolean };
  const FW = [[[0.02, 0.85], [0.3, 0.88], [0.62, 0.9]], [[0.6, 0.9], [0.8, 0.86], [0.95, 0.6], [0.9, 0.45], [0.75, 0.55], [0.6, 0.72], [0.6, 0.9]], [[0.03, 0.35], [0.3, 0.5], [0.6, 0.72]], [[0.03, -0.05], [0.3, -0.05], [0.52, 0.0], [0.68, 0.12], [0.8, 0.3], [0.9, 0.45]], [[0.3, 0.5], [0.3, -0.05]], [[0.45, 0.6], [0.47, -0.02]], [[0.68, 0.66], [0.72, 0.17]], [[0.03, -0.45], [0.28, -0.5], [0.5, -0.55]], [[0.5, -0.55], [0.52, 0.0]], [[0.03, -0.75], [0.2, -0.85]]] as P[][];
  const HW = [[[0.02, 0.85], [0.3, 0.9], [0.55, 0.9]], [[0.03, 0.2], [0.4, 0.25], [0.62, 0.35]], [[0.03, -0.35], [0.38, -0.4]], [[0.4, 0.25], [0.38, -0.4]]] as P[][];
  const wings: Wing[] = [
    { ctrl: [[-30, 6], [-82, 16], [-146, 46]], lead: K([[0, 3], [0.2, 9], [0.6, 11], [0.9, 8], [1, 0]]), trail: K([[0, 5], [0.2, 15], [0.5, 19], [0.8, 15], [0.95, 7], [1, 0]]), veins: HW, flip: false },
    { ctrl: [[30, 4], [88, 10], [150, 30]], lead: K([[0, 3], [0.2, 9], [0.6, 11], [0.9, 8], [1, 0]]), trail: K([[0, 5], [0.2, 15], [0.5, 19], [0.8, 15], [0.95, 7], [1, 0]]), veins: HW, flip: true },
    { ctrl: [[-34, -22], [-102, -24], [-198, -2]], lead: K([[0, 4], [0.2, 11], [0.6, 14], [0.9, 11], [1, 0]]), trail: K([[0, 6], [0.15, 18], [0.45, 25], [0.75, 23], [0.93, 12], [1, 0]]), veins: FW, flip: false },
    { ctrl: [[34, -22], [106, -36], [200, -26]], lead: K([[0, 4], [0.2, 11], [0.6, 14], [0.9, 11], [1, 0]]), trail: K([[0, 6], [0.15, 18], [0.45, 25], [0.75, 23], [0.93, 12], [1, 0]]), veins: FW, flip: true },
  ];
  const wingCuts: Cut[] = [], wingOut: P[][] = [];
  wings.forEach((wg) => {
    // leading edge = +v. For a wing whose spine runs right the frame's +s is the trailing side, so flip.
    const f = frame(BB(wg.ctrl), (t) => scale(wg.flip ? wg.trail(t) : wg.lead(t)), (t) => scale(wg.flip ? wg.lead(t) : wg.trail(t)), 60), V = ([t, v]: P): P => f.at(t, wg.flip ? -v : v);
    wingOut.push(f.outline);
    wingCuts.push(contour(f.outline, 0.45, 0.9, []));
    wg.veins.forEach((vn, i) => { const pts = vn.map(V); wingCuts.push(cutLine(dense(pts.length > 2 ? smooth(pts, false, 6) : pts, 1.6), (_x, _y, k, n) => (i === 0 ? 1.5 : 1.05) * (1 - 0.45 * (k / n)), [], 1.6)); });
    for (let k = 0; k < 7; k++) { const v = -0.25 - k * 0.1, t0 = 0.35 + r() * 0.2, pts: P[] = []; for (let j = 0; j <= 14; j++) pts.push(V([t0 + (0.96 - t0) * (j / 14), v * (1 - 0.3 * (j / 14))])); wingCuts.push(cutLine(pts, (_x, _y, j, n) => 0.42 * Math.sin((Math.PI * (j + 0.5)) / n), [], 1.8)); }
  });

  // contours of the body parts (legs have theirs above)
  const contours = [contour(abd.outline, 0.8, 1.9, [oThx]), contour(head.outline, 0.7, 1.6, oEyes)];

  // cast shadow on the card: horizontal lines under the offset silhouette, feathered at its edge
  const sil = [abd.outline, thx.outline, head.outline, ...wingOut, ...legOutlines, ...pollen];
  const off: P = [scale(40), scale(56)], shadowPolys = sil.map((s) => occluder(s.map(([x, y]) => [x + off[0], y + off[1]] as P))), silOcc = sil.map(occluder);
  const all = sil.flat(), bx0 = Math.min(...all.map((p) => p[0])) + off[0] - 10, bx1 = Math.max(...all.map((p) => p[0])) + off[0] + 10, by0 = Math.min(...all.map((p) => p[1])) + off[1], by1 = Math.max(...all.map((p) => p[1])) + off[1];
  const shade: Cut[] = []; const inS = (x: number, y: number) => shadowPolys.some((o) => occHit(o, x, y));
  for (let y = by0; y <= by1; y += 3.8) { const pts: P[] = []; for (let x = bx0; x <= bx1; x += 2) pts.push([x, y]); shade.push(cutLine(pts, (x, yy) => { if (!inS(x, yy)) return 0; let k = 0; for (const [dx, dy] of [[7, 0], [-7, 0], [0, 7], [0, -7]]) if (inS(x + dx, yy + dy)) k++; return 0.25 + 0.6 * (k / 4) ** 2; }, silOcc, 2)); }

  return {
    passes: [
      [...contours, ...legContours, ...wingCuts.slice(0, 0)],        // 1 contours
      [...abdCuts, ...tergLines],                                      // 2 the abdomen
      [...thxCuts, ...headCuts, ...teg, ...ocelli, ...mand],           // 3 thorax and head
      [...legPasses, ...antCuts],                                      // 4 legs, antennae
      wingCuts,                                                         // 5 wings
      [...abdCross, ...eyeCuts, ...fur, ...felt, ...headFur, ...pollenCuts], // 6 cross-hatch, eyes, fur, pollen
      shade,                                                            // 7 cast shadow
    ],
    tint: [...pollen.map((s) => ({ shape: s, color: "#d99a2b", alpha: 0.55 })), { shape: abd.outline, color: "#c98a3c", alpha: 0.22 }, { shape: thx.outline, color: "#a8743a", alpha: 0.16 }],
    bounds: sil.flat(),
  };
};
const occHit = (o: Occluder, x: number | P, y?: number) => { const px = typeof x === "number" ? x : x[0], py = typeof x === "number" ? y! : x[1]; if (px < o.b.x0 || px > o.b.x1 || py < o.b.y0 || py > o.b.y1) return false; let k = false; const pts = o.pts; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if (a[1] > py !== b[1] > py && px < ((b[0] - a[0]) * (py - a[1])) / (b[1] - a[1]) + a[0]) k = !k; } return k; };

// ---------------------------------------------------------------- the dog rose
export const rose = (cx: number, cy: number, R: number): Engraving => {
  const r = rng(515), squash = 0.8, Pp = ([u, v]: P): P => [cx + u, cy + v * squash];      // flower plane -> card (a face tilted back)
  type Petal = { a: number; len: number; wide: number; curl: number };
  const petals: Petal[] = [-96, -22, 50, 118, 192].map((d, i) => ({ a: ((d + (r() - 0.5) * 10) * Math.PI) / 180, len: R * (0.92 + r() * 0.12), wide: 0.95 + r() * 0.12, curl: i % 2 ? 1 : -1 }));
  // back petals first: the upper ones lie farther away on a face tilted back
  const order = petals.map((p, i) => ({ p, i, z: Math.sin(p.a) })).sort((x, y) => x.z - y.z);
  const frames = order.map(({ p }) => { const c = Math.cos(p.a), s = Math.sin(p.a), drift = 0.12 * p.curl, ctrl: P[] = [0.1, 0.5, 1].map((u) => { const a2 = p.a + drift * u; return [Math.cos(a2) * p.len * u, Math.sin(a2) * p.len * u] as P; }); void c; void s; return { p, f: frame(ctrl, K([[0, 5], [0.25, 25 * p.wide], [0.65, 47 * p.wide], [0.88, 49 * p.wide], [1, 36 * p.wide]])) }; });
  // a heart-notched petal outline in the plane, then projected
  const petalOutline = (f: Frame): P[] => { const o: P[] = []; for (let i = 0; i <= 30; i++) o.push(f.at((i / 30) * 0.93, 1)); o.push(f.at(0.99, 0.6), f.at(1.0, 0.3), f.at(0.93, 0), f.at(1.0, -0.3), f.at(0.99, -0.6)); for (let i = 30; i >= 0; i--) o.push(f.at((i / 30) * 0.93, -1)); return o.map(Pp); };
  const outs = frames.map(({ f }) => petalOutline(f));
  const occs = outs.map(occluder), disc = Array.from({ length: 28 }, (_, i) => { const u = (i / 28) * 6.28; return Pp([Math.cos(u) * R * 0.2, Math.sin(u) * R * 0.2]); }), oDisc = occluder(disc);
  const petalCuts: Cut[] = [], petalCont: Cut[] = [];
  frames.forEach(({ p, f }, k) => {
    const front = [...occs.slice(k + 1), oDisc];
    const facing = Math.sin(p.a);                      // lower petals face the viewer and catch less of the upper-left light
    const tone = (t: number, s: number) => clamp01(0.08 + 0.6 * Math.pow(1 - t, 2.2) + 0.28 * Math.pow(Math.abs(s), 3) + 0.14 * facing + 0.12 * Math.max(0, Math.cos(p.a) * 0.8) + (s * p.curl > 0.4 ? 0.12 : 0));
    for (let i = 0; i <= 22; i++) { const s = -0.94 + (1.88 * i) / 22, pts: P[] = []; for (let j = 0; j <= 20; j++) { const t = 0.06 + (0.88 * j) / 20, bend = Math.sin(Math.PI * t) * 3 * s; pts.push(Pp([f.at(t, s)[0] + f.nrm(t)[0] * bend, f.at(t, s)[1] + f.nrm(t)[1] * bend])); } const m = dense(pts, 1.8).length; petalCuts.push(cutLine(pts, (_x, _y, j) => toneW(tone(0.06 + (0.88 * j) / (m - 1), s), 1.35, 0.16), front, 1.8)); }
    petalCont.push(contour(outs[k], 0.6, 1.5, front));
    // a cupped rim: a second line just inside the upper edge where it turns
    const rim: P[] = []; for (let i = 3; i <= 27; i++) rim.push(f.at((i / 30) * 0.93, p.curl * 0.86)); petalCont.push(cutLine(rim.map(Pp), (_x, _y, j, n) => 0.9 * Math.sin((Math.PI * (j + 0.5)) / n), front, 1.6));
  });
  // stamens: filaments leaning out from the disc, each with an anther flick; disc stippled
  const stam: Cut[] = [];
  for (let i = 0; i < 64; i++) { const u = (i / 64) * 6.28 + (r() - 0.5) * 0.12, r0 = R * 0.17, r1 = R * (0.32 + r() * 0.16), bow = (r() - 0.5) * 0.25, p0 = Pp([Math.cos(u) * r0, Math.sin(u) * r0]), pm = Pp([Math.cos(u + bow) * (r0 + r1) / 2, Math.sin(u + bow) * (r0 + r1) / 2]), p1 = Pp([Math.cos(u + bow * 1.5) * r1, Math.sin(u + bow * 1.5) * r1]); stam.push(cutLine(smooth([p0, pm, p1], false, 6), (_x, _y, j, n) => 0.45 + 0.3 * (j / n), [], 1.4)); stam.push(flick(p1, u + 1.2, 3.4, 2.2, 0.5)); }
  for (let i = 0; i < 90; i++) { const u = r() * 6.28, d = Math.sqrt(r()) * R * 0.17, p = Pp([Math.cos(u) * d, Math.sin(u) * d]); if (r() < 0.35 + 0.5 * clamp01((p[0] - cx + p[1] - cy) / (R * 0.3) + 0.5)) stam.push(flick(p, r() * 6.28, 1.6, 1.2, 0)); }
  stam.push(contour(disc, 0.5, 1, []));
  // stem with prickles, a pinnate leaf of three serrate leaflets with a midrib and veins
  const petalOcc = [...occs, oDisc];
  const stemPts: P[] = [[cx + 4, cy + R * 0.5], [cx + 10, cy + R * 1.0], [cx - 4, cy + R * 1.45], [cx - 16, cy + R * 1.9]];
  const stemF = frame(stemPts, () => 3.6);
  const stem: Cut[] = [contour(stemF.outline, 0.6, 1.4, petalOcc), ...rings(stemF, 0.05, 0.98, 3.2, (t, s) => tubeShade(stemF, t, s, 0.2), 0.9, petalOcc, 0.05)];
  [0.35, 0.62, 0.84].forEach((t, i) => { const p = stemF.at(t, i % 2 ? 1 : -1), q = stemF.nrm(t), sg = i % 2 ? 1 : -1; stem.push(cutLine([p, [p[0] + q[0] * sg * 6 - 2, p[1] + q[1] * sg * 6 - 3]], (_x, _y, j, n) => 2.2 * (1 - j / n), [], 1)); });
  const leafCuts: Cut[] = [];
  const rachis: P[] = [stemF.at(0.55, 1), [cx + R * 0.5, cy + R * 1.15], [cx + R * 0.95, cy + R * 1.2]];
  leafCuts.push(open(rachis, 1.4));
  const leaflet = (base: P, dir: number, len: number, w: number, seed: number) => {
    const ctrl: P[] = [0, 0.5, 1].map((u) => [base[0] + Math.cos(dir + 0.1 * u) * len * u, base[1] + Math.sin(dir + 0.1 * u) * len * u] as P), f = frame(ctrl, K([[0, 2], [0.3, w], [0.6, w * 1.02], [0.9, w * 0.5], [1, 0.5]]));
    const o: P[] = []; for (let i = 0; i <= 40; i++) { const t = i / 40, tooth = i % 2 ? 1.12 : 0.95; o.push(f.at(t, tooth)); } for (let i = 40; i >= 0; i--) { const t = i / 40, tooth = i % 2 ? 1.12 : 0.95; o.push(f.at(t, -tooth)); }
    leafCuts.push(contour(o, 0.6, 1.3, petalOcc)); leafCuts.push(cutLine([f.at(0.02, 0), f.at(0.5, 0), f.at(0.95, 0)], (_x, _y, j, n) => 1.0 * (1 - 0.6 * j / n), petalOcc, 1.5));
    for (let i = 1; i < 9; i++) { const t = i / 9.5; [1, -1].forEach((sd) => { const pts: P[] = []; for (let j = 0; j <= 8; j++) { const u = j / 8; pts.push(f.at(Math.min(1, t + u * 0.12), sd * u * 0.92)); } leafCuts.push(cutLine(pts, (_x, _y, j, n) => (sd < 0 ? 0.95 : 0.55) * Math.sin((Math.PI * (j + 0.5)) / n), petalOcc, 1.4)); if (sd < 0) { const q: P[] = []; for (let j = 0; j <= 8; j++) { const u = j / 8; q.push(f.at(Math.min(1, t + 0.05 + u * 0.12), -u * 0.9)); } leafCuts.push(cutLine(q, (_x, _y, j, n) => 0.6 * Math.sin((Math.PI * (j + 0.5)) / n), petalOcc, 1.4)); } }); }
    void seed;
  };
  leaflet(rachis[1], -0.9, R * 0.42, R * 0.13, 1); leaflet(rachis[1], 0.9, R * 0.4, R * 0.12, 2); leaflet(rachis[2], 0.05, R * 0.5, R * 0.15, 3);
  // a small cast shadow of the bloom on the card, down and right
  const offR: P = [R * 0.22, R * 0.3], sh = outs.map((o) => occluder(o.map(([x, y]) => [x + offR[0], y + offR[1]] as P))), shade: Cut[] = [];
  const allP = outs.flat(), x0 = Math.min(...allP.map((p) => p[0])) + offR[0], x1 = Math.max(...allP.map((p) => p[0])) + offR[0], y0 = Math.min(...allP.map((p) => p[1])) + offR[1], y1 = Math.max(...allP.map((p) => p[1])) + offR[1];
  for (let y = y0; y <= y1; y += 3.6) { const pts: P[] = []; for (let x = x0; x <= x1; x += 2) pts.push([x, y]); shade.push(cutLine(pts, (x, yy) => (sh.some((o) => occHit(o, x, yy)) ? 0.55 : 0), [...petalOcc], 2)); }
  return { passes: [[...petalCont], petalCuts, stam, [...stem, ...leafCuts], shade], tint: outs.map((o) => ({ shape: o, color: "#e39aa2", alpha: 0.3 })).concat([{ shape: disc, color: "#e0b83a", alpha: 0.5 }]), bounds: allP };
};
