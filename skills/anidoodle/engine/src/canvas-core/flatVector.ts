import { rng, type Ctx, type Env, type Layer, type P } from "./core";
import type { Film } from "./film";
import { clamp, smooth } from "./gallery";
import { cut, streakClip, streaks, streakTip } from "./koiDrawKit";

// FLAT VECTOR · the regatta. A modern flat editorial illustration, built the way it is built in a
// vector app.
//
// MEDIUM, physically: a pen tool on a screen. Every shape is a closed path of hand-placed anchors
// (straight corners for sails and hulls, smooth anchors for hills and water), filled with ONE flat
// colour the instant the path closes. No strokes anywhere: an edge is only where two fills meet,
// and it is perfectly crisp. Depth comes from overlapping planes and atmospheric colour, never
// from a line. Shadows are separate shapes with a linear transparency ramp (the "long shadow"),
// and the texture is a grain brush: a raster speckle painted in broad passes over the shade side
// of a shape, clipped to it.
// MARKS: anchor, anchor, anchor, close, fill. ORDER: background planes (sky, clouds, far and mid
// hills, the bay's bands and the sun's glitter), midground (shore, town, headland, lighthouse),
// the boats (hull, sails, boom, mast, wake), the long shadows, and last the grain brush.
// PALETTE: 13 swatches in one key: warm cream sky, lilac -> sage -> deep teal hills by distance,
// three blues for the bay, coral and mustard sails, navy hulls, bone white.
// LIGHT: a low late-afternoon sun off-frame to the LEFT (west): its glitter path runs off the left
// edge, every slope turned right is in shade, and every shadow is long and thrown right.
// SUBJECT & REFERENCE (from knowledge): small keelboats and dinghies racing (sloop rig: mast,
// boom, mainsail with a roached leech aft of the mast, a jib forward to the bow), all on one tack,
// wind from the left so every hull heels right; the leader is rounding the orange turning mark.
// Flat-illustration conventions from contemporary editorial vector work: layered hills with
// atmospheric perspective, geometric clouds with flat bottoms, grain on the shade side only.
// NOT ITS NEIGHBOUR (cut-paper fox): no torn fibres, no paper lift, no shadow under every piece;
// edges are mathematically crisp and the only shadows are cast ones.

const W = 1080, H = 1080, N = 525, HOLD = 30;
const C = { sky: "#f6e5cf", cloud: "#fcf3e6", far: "#cdbbd6", farS: "#b9a6c8", midL: "#9fbdab", mid: "#86ad9d", midS: "#6f9a8b", deep: "#2f6b63", deepS: "#22524c", shore: "#4f8a72", shoreS: "#3d7360", sand: "#ecc99a", bay: "#3a7ca1", bayH: "#6ea6c1", bayM: "#4c8db1", bayF: "#2f6a90", glint: "#f7dcaa", foam: "#d6e9ee", dash: "#8fc2d6", coral: "#ee7a58", mustard: "#f1b74a", navy: "#1f3a56", bone: "#fcf8ef", teal: "#3f9c8f" };
const NAVY_RGB = "31,58,86", LIFT = 84;

type Paint = string | ((c: Ctx) => CanvasGradient);
type Shape = { polys: P[][]; anchors: P[][]; fill: Paint; stage: number; grain?: { ang: number; k: number; from?: number } };
const S1 = 1, S2 = 2, S3 = 3, S4 = 4;

// ---------------------------------------------------------------- construction helpers
const sm = (a: P[], closed = true, per = 8) => smooth(a, closed, per);
const shape = (poly: P[], anchors: P[], fill: Paint, stage: number, grain?: Shape["grain"]): Shape => ({ polys: [poly], anchors: [anchors.length ? anchors : poly.filter((_, i) => i % Math.max(1, Math.floor(poly.length / 6)) === 0)], fill, stage, grain });
// a smooth ridge (anchors left to right) closed straight down to `base`
const ridge = (top: P[], base: number, fill: Paint, stage: number, grain?: Shape["grain"]): Shape => { const t = sm(top, false, 10); return shape([...t, [t[t.length - 1][0], base], [t[0][0], base]], [...top, [top[top.length - 1][0], base], [top[0][0], base]], fill, stage, grain); };
const cloud = (x: number, y: number, s: number): Shape => { const a: P[] = [[x - 110 * s, y], [x - 92 * s, y - 28 * s], [x - 52 * s, y - 38 * s], [x - 28 * s, y - 70 * s], [x + 22 * s, y - 76 * s], [x + 50 * s, y - 44 * s], [x + 88 * s, y - 40 * s], [x + 112 * s, y]]; const t = sm(a, false, 10); return shape(t, a, C.cloud, S1); };
const rot = (pts: P[], o: P, ang: number, s: number): P[] => { const c = Math.cos(ang), n = Math.sin(ang); return pts.map(([x, y]) => [o[0] + (x * c - y * n) * s, o[1] + (x * n + y * c) * s] as P); };
const capsule = (a: P, b: P, r: number): P[] => { const ang = Math.atan2(b[1] - a[1], b[0] - a[0]), out: P[] = []; for (let i = 0; i <= 6; i++) { const t = ang + Math.PI / 2 + (i / 6) * Math.PI; out.push([a[0] + Math.cos(t) * r, a[1] + Math.sin(t) * r]); } for (let i = 0; i <= 6; i++) { const t = ang - Math.PI / 2 + (i / 6) * Math.PI; out.push([b[0] + Math.cos(t) * r, b[1] + Math.sin(t) * r]); } return out; };
// a long soft shadow: the caster's points thrown right along the water by the low western sun,
// ramped from its foot to nothing
const throwShadow = (pts: P[], y0: number, len = 1.4, drop = 0.34): P[] => pts.map(([x, y]) => [x + Math.max(0, y0 - y) * len, y0 + Math.max(0, y0 - y) * drop]);
const ramp = (a: P, b: P, alpha: number) => (c: Ctx) => { const g = c.createLinearGradient(a[0], a[1], b[0], b[1]); g.addColorStop(0, `rgba(${NAVY_RGB},${alpha})`); g.addColorStop(1, `rgba(${NAVY_RGB},0)`); return g; };

// a sloop, facing right, heeled by `heel` (radians, positive = away from a wind on the left)
const boat = (o: P, s: number, heel: number, main: string, jib: string, hull: string): Shape[] => {
  const R = (p: P[]) => rot(p, o, heel, s);
  const hullP: P[] = [[-104, -4], [114, -15], [98, 3], [70, 17], [18, 23], [-52, 21], [-92, 13]];
  const leech = sm([[-95, -22], [-78, -92], [-46, -178], [-6, -262]], false, 6);
  const mainP: P[] = [[-5, -262], [-6, -24], ...leech];
  const jibP: P[] = [[6, -232], [106, -17], ...sm([[42, -29], [30, -120], [6, -232]], false, 6)];
  const mast: P[] = [[-3, -272], [3, -272], [3, -4], [-3, -4]], boom: P[] = [[-2, -26], [-100, -22], [-100, -17], [-2, -20]];
  const y0 = o[1] + 14 * s, sail = [...R(mainP), ...R(jibP)];
  const sh = [...R(mainP)].map((p) => p), shJ = R(jibP), far = throwShadow(sail, y0).reduce((a, p) => (p[0] > a[0] ? p : a), [0, 0] as P);
  const wake: P[] = [[-96, 10], [-150, 6], [-260, 13], [-330, 17], [-250, 19], [-150, 20], [-92, 18]];
  const bow: P[] = [[92, 6], [128, 10], [150, 18], [120, 20], [88, 16]];
  return [
    shape(throwShadow(sh, y0), [], ramp([o[0], y0], far, 0.58), S4),
    shape(throwShadow(shJ, y0), [], ramp([o[0], y0], far, 0.5), S4),
    shape(R(wake), R([[-96, 10], [-330, 17], [-92, 18]]), C.foam, S3),
    shape(R(hullP), R(hullP), hull, S3, { ang: Math.PI / 2 + heel, k: 0.5 }),
    shape(R(mainP), R([[-5, -262], [-6, -24], [-95, -22], [-46, -178]]), main, S3, { ang: Math.PI + heel, k: 0.35, from: 0.3 }),
    shape(R(boom), R(boom), C.navy, S3),
    shape(R(jibP), R([[6, -232], [106, -17], [42, -29]]), jib, S3, { ang: Math.PI + heel, k: 0.3, from: 0.4 }),
    shape(R(mast), R([[0, -272], [0, -4]]), C.navy, S3),
    shape(R(bow), R(bow), C.bone, S3),
  ];
};

const house = (x: number, y: number, w: number, h: number, roof: string): Shape[] => {
  const wall: P[] = [[x, y], [x + w, y], [x + w, y - h], [x, y - h]], rf: P[] = [[x - 3, y - h], [x + w / 2, y - h - w * 0.55], [x + w + 3, y - h]];
  return [shape(throwShadow([[x + w, y], [x + w, y - h], [x + w / 2, y - h - w * 0.55], [x + w * 0.7, y]], y, 1.5, 0.05), [], ramp([x + w, y], [x + w + (h + w * 0.55) * 1.5, y], 0.34), S4), shape(wall, wall, C.bone, S2), shape(rf, rf, roof, S2)];
};

// ---------------------------------------------------------------- the picture, back to front
const scene = (): Shape[] => {
  const r = rng(77), out: Shape[] = [];
  out.push(shape([[0, 0], [W, 0], [W, 560], [0, 560]], [[0, 0], [W, 0], [W, 560], [0, 560]], C.sky, S1, { ang: -Math.PI / 2, k: 0.16, from: 0.4 }));
  out.push(cloud(250, 178, 1.05), cloud(760, 112, 0.8), cloud(985, 222, 0.55));
  out.push(ridge([[0, 452], [130, 404], [262, 432], [402, 388], [556, 424], [704, 372], [862, 410], [1080, 386]], 520, C.far, S1, { ang: 0, k: 0.22 }));
  out.push(ridge([[0, 470], [150, 448], [290, 470], [430, 505]], 530, C.midL, S1, { ang: 0.3, k: 0.2 }));
  out.push(ridge([[420, 520], [560, 470], [700, 438], [830, 456], [950, 426], [1080, 444]], 540, C.mid, S1, { ang: 0.2, k: 0.25 }));
  // the bay: a base, then lighter toward the horizon and deeper toward us, each edge a gentle swell
  const band = (y0: number, y1: number, col: string, amp: number, ph: number, stage = S1): Shape => { const top: P[] = Array.from({ length: 9 }, (_, i) => [i * 135, y0 + Math.sin(i * 1.3 + ph) * amp] as P); const t = sm(top, false, 10); return shape([...t, [W, y1], [0, y1]], [...top, [W, y1], [0, y1]], col, stage); };
  out.push(band(505, H, C.bay, 0, 0), band(505, 548, C.bayH, 0, 0), band(620, 700, C.bayM, 5, 1), band(830, H, C.bayF, 7, 2.2));
  // the sun's glitter: a drift of light dashes running off the left edge, dense there and thinning out
  const gl: P[][] = [], ga: P[][] = [];
  for (let i = 0; i < 46; i++) { const u = r(), x = Math.pow(u, 1.6) * 420 - 20, y = 560 + r() * 240 + x * 0.12, l = 10 + (1 - u) * 34 + r() * 10; if (r() < u * 0.55) continue; const d = capsule([x, y], [x + l, y], 2 + (1 - u) * 2); gl.push(d); ga.push([[x, y], [x + l, y]]); }
  out.push({ polys: gl, anchors: ga, fill: C.glint, stage: S1 });
  // the far shore and its town, watching the race
  out.push(ridge([[640, 530], [760, 506], [880, 494], [1000, 484], [1080, 490]], 556, C.shore, S2, { ang: 0.15, k: 0.3 }));
  out.push(shape(sm([[880, 494], [1000, 484], [1080, 490], [1080, 556], [1010, 540], [940, 520]], true, 6), [[880, 494], [1080, 490], [1080, 556], [940, 520]], C.shoreS, S4));
  [[762, 512, 26, 22, C.coral], [796, 507, 22, 30, C.navy], [834, 503, 30, 24, C.mustard], [884, 497, 24, 28, C.coral], [934, 492, 28, 22, C.teal], [990, 488, 22, 26, C.navy]].forEach(([x, y, w, h, c]) => out.push(...house(x as number, y as number, w as number, h as number, c as string)));
  // the headland and its lighthouse, which marks the mouth of the harbour
  const head: P[] = [[0, 446], [86, 436], [196, 468], [300, 518], [388, 566], [432, 598]];
  const ht = sm(head, false, 10);
  out.push(shape([...ht, [410, 612], [300, 612], [0, 618]], [...head, [300, 612], [0, 618]], C.deep, S2, { ang: 0.4, k: 0.3 }));
  out.push(shape(sm([[86, 436], [196, 468], [300, 518], [388, 566], [432, 598], [330, 600], [220, 540], [130, 470]], true, 8), [[86, 436], [432, 598], [330, 600], [130, 470]], C.deepS, S4));
  out.push(shape(sm([[200, 604], [300, 596], [412, 600], [436, 608], [300, 616], [180, 616]], true, 6), [[200, 604], [436, 608], [180, 616]], C.sand, S2));
  const lx = 352, ly = 550;
  out.push(shape(throwShadow([[lx + 11, ly], [lx + 8, ly - 74], [lx + 2, ly - 94], [lx - 10, ly]], ly, 1.6, 0.12), [], ramp([lx, ly], [lx + 150, ly + 10], 0.34), S4));
  out.push(shape([[lx - 12, ly], [lx + 12, ly], [lx + 8, ly - 70], [lx - 8, ly - 70]], [[lx - 12, ly], [lx + 12, ly], [lx + 8, ly - 70], [lx - 8, ly - 70]], C.bone, S2));
  out.push(shape([[lx - 11, ly - 26], [lx + 11, ly - 26], [lx + 10, ly - 42], [lx - 10, ly - 42]], [[lx - 11, ly - 26], [lx + 11, ly - 26], [lx + 10, ly - 42], [lx - 10, ly - 42]], C.coral, S2));
  out.push(shape([[lx - 11, ly - 70], [lx + 11, ly - 70], [lx + 7, ly - 84], [lx, ly - 94], [lx - 7, ly - 84]], [[lx - 11, ly - 70], [lx + 11, ly - 70], [lx, ly - 94]], C.navy, S2));
  // the land sits high: a wide bay for the race, the sky kept to what the clouds need
  out.forEach((sh) => { if (sh.fill !== C.sky && sh.fill !== C.cloud) { sh.polys = sh.polys.map((p) => p.map(([x, y]) => [x, y >= H - 1 ? H : y - LIFT] as P)); sh.anchors = sh.anchors.map((p) => p.map(([x, y]) => [x, y >= H - 1 ? H : y - LIFT] as P)); } });
  // the fleet, far to near; the leader rounds the mark in the foreground
  const fleet: [P, number, number, string, string, string][] = [[[930, 500], 0.22, 0.1, C.bone, C.bone, C.navy], [[178, 526], 0.28, 0.12, C.coral, C.bone, C.navy], [[640, 546], 0.36, 0.14, C.bone, C.mustard, C.navy], [[850, 636], 0.54, 0.15, C.bone, C.teal, C.coral], [[296, 672], 0.66, 0.13, C.mustard, C.bone, C.navy], [[596, 852], 1.04, 0.16, C.coral, C.bone, C.navy]];
  fleet.forEach(([o, s, h, m, j, hu]) => out.push(...boat(o, s, h, m, j, hu)));
  // the turning mark: an orange inflatable buoy with a white band, its own long shadow
  const bx = 392, by = 902, buoy: P[] = [[bx - 20, by], [bx + 20, by], [bx + 13, by - 30], [bx, by - 44], [bx - 13, by - 30]];
  out.push(shape(throwShadow(buoy, by, 1.4, 0.1), [], ramp([bx, by], [bx + 70, by + 4], 0.3), S4), shape(buoy, buoy, C.coral, S3, { ang: 0, k: 0.4 }), shape([[bx - 17, by - 12], [bx + 17, by - 12], [bx + 14, by - 20], [bx - 14, by - 20]], [[bx - 17, by - 12], [bx + 17, by - 12]], C.bone, S3), shape(capsule([bx - 32, by + 2], [bx + 34, by + 2], 3), [[bx - 32, by + 2], [bx + 34, by + 2]], C.foam, S3));
  // the shore we watch from: two faceted rocks in the near corner, lit face left, shade face right
  const rockA: P[] = [[826, H], [846, 1012], [896, 968], [952, 976], [1000, 1024], [1012, H]], rockAS: P[] = [[896, 968], [952, 976], [1000, 1024], [1012, H], [934, H], [918, 1010]];
  const rockB: P[] = [[972, H], [990, 1036], [1034, 1010], [1080, 1016], [1080, H]], rockBS: P[] = [[1034, 1010], [1080, 1016], [1080, H], [1040, H], [1030, 1040]];
  out.push(shape(throwShadow([[1000, 1024], [952, 976], [896, 968]], 1060, 1.4, 0.05).concat([[1012, 1060]]), [], ramp([1000, 1040], [1080, 1040], 0.4), S4));
  out.push(shape(rockA, rockA, "#4d7480", S2, { ang: 0.2, k: 0.35 }), shape(rockAS, rockAS, "#35555f", S4), shape(rockB, rockB, "#4d7480", S2, { ang: 0.2, k: 0.35 }), shape(rockBS, rockBS, "#35555f", S4));
  out.push(shape(capsule([800, 1046], [860, 1044], 3), [[800, 1046], [860, 1044]], C.foam, S3), shape(capsule([944, 1066], [990, 1064], 2.6), [[944, 1066], [990, 1064]], C.foam, S3));
  // chop: dashes in drifts where the boats and wind work the water, bare rests between
  const dd: P[][] = [], da: P[][] = [], drift = (cx: number, cy: number, n: number, spread: number, s: number) => { for (let i = 0; i < n; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * spread, x = cx + Math.cos(a) * d * 1.8, y = cy + Math.sin(a) * d * 0.5, l = (14 + r() * 26) * s; dd.push(capsule([x, y], [x + l, y], 2.4 * s)); da.push([[x, y], [x + l, y]]); } };
  drift(680, 970, 11, 110, 1.1); drift(150, 880, 8, 90, 1); drift(980, 800, 6, 70, 0.9); drift(520, 745, 5, 60, 0.8);
  out.push({ polys: dd, anchors: da, fill: C.dash, stage: S3 });
  return out;
};

// ---------------------------------------------------------------- time
// stage windows; inside one, each shape's time is its anchor count (a hand places each anchor)
const WIN: Record<number, [number, number]> = { [S1]: [4, 118], [S2]: [124, 204], [S3]: [210, 386], [S4]: [392, 440] };
const GRAIN: [number, number] = [446, N - HOLD];
type Timed = { sh: Shape; t0: number; t1: number; g0: number; g1: number };
const timeline = (cache: Map<string, unknown>): Timed[] => {
  const key = "flatVector:timeline"; let t = cache.get(key) as Timed[] | undefined; if (t) return t;
  const sc = scene(), out: Timed[] = sc.map((sh) => ({ sh, t0: 0, t1: 0, g0: 0, g1: 0 }));
  [S1, S2, S3, S4].forEach((st) => { const items = out.filter((o) => o.sh.stage === st), wt = (o: Timed) => 2 + o.sh.anchors.reduce((a, b) => a + b.length, 0) * 0.9, tot = items.reduce((a, o) => a + wt(o), 0), [a, b] = WIN[st]; let acc = 0; items.forEach((o) => { o.t0 = a + ((b - a) * acc) / tot; acc += wt(o); o.t1 = a + ((b - a) * acc) / tot; }); });
  const gi = out.filter((o) => o.sh.grain); gi.forEach((o, i) => { o.g0 = GRAIN[0] + ((GRAIN[1] - GRAIN[0]) * i) / gi.length; o.g1 = GRAIN[0] + ((GRAIN[1] - GRAIN[0]) * (i + 1.6)) / gi.length; o.g1 = Math.min(o.g1, GRAIN[1]); });
  cache.set(key, out); return out;
};

// ---------------------------------------------------------------- grain
const grainTile = (env: Env): Layer => {
  const key = `flatVector:grain:${env.scale}`; let L = env.cache.get(key) as Layer | undefined; if (L) return L;
  const n = Math.round(240 * env.scale); L = env.canvas(n, n); const img = L.ctx.createImageData(n, n), d = img.data, r = rng(4242);
  for (let i = 0; i < n * n; i++) { const v = r(); if (v < 0.34) { d[i * 4] = 31; d[i * 4 + 1] = 58; d[i * 4 + 2] = 86; d[i * 4 + 3] = Math.round(90 + r() * 165); } }
  L.ctx.putImageData(img, 0, 0); env.cache.set(key, L); return L;
};
const scratch = (env: Env): Layer => { const key = `flatVector:tmp:${env.scale}`; let L = env.cache.get(key) as Layer | undefined; if (!L) { L = env.canvas(Math.round(W * env.scale), Math.round(H * env.scale)); env.cache.set(key, L); } return L; };
const bbox = (ps: P[][]) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; ps.forEach((p) => p.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); })); return { x0: Math.max(0, x0 - 2), y0: Math.max(0, y0 - 2), x1: Math.min(W, x1 + 2), y1: Math.min(H, y1 + 2) }; };
const path = (c: Ctx, ps: P[][]) => { c.beginPath(); ps.forEach((p) => { p.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); }); };
// the grain brush: speckle clipped to the shape, ramped from nothing on the lit side to full on the
// shade side; while it is being applied, only where the brush's passes have been
// Painted into a surface whose device origin sits at logical (ox, oy). A finished grain never
// changes, so it is painted once into its own bbox-sized surface and only composited after that.
const paintGrain = (t: Ctx, env: Env, sh: Shape, q: number, seed: number, ox: number, oy: number) => {
  const gr = sh.grain!, b = bbox(sh.polys), k = env.scale, OX = Math.floor(ox * k), OY = Math.floor(oy * k), dev = (x: number, y: number): [number, number] => [Math.floor(x * k) - OX, Math.floor(y * k) - OY];
  const [sx, sy] = dev(b.x0, b.y0), sw = Math.ceil((b.x1 - b.x0) * k) + 2, shh = Math.ceil((b.y1 - b.y0) * k) + 2;
  t.save(); t.setTransform(1, 0, 0, 1, 0, 0); t.clearRect(sx, sy, sw, shh);
  t.setTransform(k, 0, 0, k, -OX, -OY); path(t, sh.polys); t.clip();
  if (q < 1) streakClip(t, streaks(sh.polys, Math.max(26, (b.y1 - b.y0) * 0.22), gr.ang + Math.PI / 2 + 0.3, seed, 260), q);
  t.setTransform(1, 0, 0, 1, -OX, -OY); t.fillStyle = t.createPattern(grainTile(env).canvas as CanvasImageSource, "repeat")!; t.fillRect(sx + OX, sy + OY, sw, shh); // the grain is anchored to the artboard, cached or not
  t.restore(); t.save(); t.setTransform(k, 0, 0, k, -OX, -OY);
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, R = Math.hypot(b.x1 - b.x0, b.y1 - b.y0) / 2, dx = Math.cos(gr.ang), dy = Math.sin(gr.ang), from = gr.from ?? 0.15;
  const g = t.createLinearGradient(cx - dx * R, cy - dy * R, cx + dx * R, cy + dy * R); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(from, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,1)");
  t.globalCompositeOperation = "destination-in"; t.fillStyle = g; t.fillRect(b.x0 - 2, b.y0 - 2, b.x1 - b.x0 + 4, b.y1 - b.y0 + 4); t.restore();
  return { sx, sy, sw, shh };
};
const grain = (c: Ctx, env: Env, sh: Shape, q: number, seed: number, idx: number) => {
  const b = bbox(sh.polys), k = env.scale; let src: Layer, r: { sx: number; sy: number; sw: number; shh: number };
  if (q >= 1) {
    const key = `flatVector:grain:${idx}:${k}`; let L = env.cache.get(key) as Layer | undefined;
    if (!L) { L = env.canvas(Math.ceil((b.x1 - b.x0) * k) + 4, Math.ceil((b.y1 - b.y0) * k) + 4); paintGrain(L.ctx, env, sh, 1, seed, b.x0, b.y0); env.cache.set(key, L); }
    src = L; r = { sx: 0, sy: 0, sw: Math.ceil((b.x1 - b.x0) * k) + 2, shh: Math.ceil((b.y1 - b.y0) * k) + 2 };
  } else {
    src = scratch(env); r = paintGrain(src.ctx, env, sh, q, seed, 0, 0);
    const st = streaks(sh.polys, Math.max(26, (b.y1 - b.y0) * 0.22), sh.grain!.ang + Math.PI / 2 + 0.3, seed, 260), [x, y] = streakTip(st, q), rr = st.w / 2; // the grain brush's cursor, a ring the size of its tip
    c.save(); c.strokeStyle = "rgba(255,255,255,0.9)"; c.lineWidth = 2.6; c.beginPath(); c.arc(x, y, rr, 0, Math.PI * 2); c.stroke(); c.strokeStyle = UI; c.lineWidth = 1.2; c.beginPath(); c.arc(x, y, rr, 0, Math.PI * 2); c.moveTo(x - 5, y); c.lineTo(x + 5, y); c.moveTo(x, y - 5); c.lineTo(x, y + 5); c.stroke(); c.restore();
  }
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = sh.grain!.k; c.drawImage(src.canvas as CanvasImageSource, r.sx, r.sy, r.sw, r.shh, Math.floor(b.x0 * k), Math.floor(b.y0 * k), r.sw, r.shh); c.restore();
};

// ---------------------------------------------------------------- the pen tool at work
const UI = "#2b7bf6";
const penTool = (c: Ctx, sh: Shape, q: number) => {
  // the anchors go down one after another along each path; the path follows the cursor; the last
  // anchor placed shows its bezier handles
  const tot = sh.polys.length, per = 1 / tot;
  c.save(); c.lineWidth = 1.4; c.strokeStyle = UI; c.lineJoin = "round";
  sh.polys.forEach((poly, i) => {
    const qi = clamp((q - i * per) / per); if (qi <= 0) return;
    const drawn = cut([...poly, poly[0]], qi); c.beginPath(); drawn.forEach(([x, y], j) => (j ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
    const an = sh.anchors[i] ?? [], na = Math.min(an.length, Math.ceil(qi * an.length + 1e-9));
    for (let j = 0; j < na; j++) { const [x, y] = an[j]; c.fillStyle = j === na - 1 && qi < 1 ? UI : "#ffffff"; c.fillRect(x - 3.5, y - 3.5, 7, 7); c.strokeRect(x - 3.5, y - 3.5, 7, 7); }
    if (qi < 1 && na > 0) { const [x, y] = an[na - 1], nx = an[Math.min(an.length - 1, na)], px = an[Math.max(0, na - 2)], hx = (nx[0] - px[0]) * 0.18, hy = (nx[1] - px[1]) * 0.18; c.beginPath(); c.moveTo(x - hx, y - hy); c.lineTo(x + hx, y + hy); c.stroke(); [[x - hx, y - hy], [x + hx, y + hy]].forEach(([hx2, hy2]) => { c.beginPath(); c.arc(hx2, hy2, 3.2, 0, Math.PI * 2); c.fillStyle = "#ffffff"; c.fill(); c.stroke(); }); }
  });
  c.restore();
};

export const drawFlatVector = (ctx: Ctx, f: number, env: Env) => {
  ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0);
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);           // the empty artboard
  const tl = timeline(env.cache), drawing: [Shape, number][] = [], fin = f >= N - HOLD;
  tl.forEach(({ sh, t0, t1, g0, g1 }, i) => {
    const q = fin || f >= t1 ? 1 : f <= t0 ? 0 : (f - t0) / (t1 - t0);
    if (q < 1) { if (q > 0) drawing.push([sh, q]); return; }
    ctx.fillStyle = typeof sh.fill === "string" ? sh.fill : sh.fill(ctx); path(ctx, sh.polys); ctx.fill("nonzero");   // the path closed: its fill lands
    if (sh.grain) { const gq = fin || f >= g1 ? 1 : f <= g0 ? 0 : (f - g0) / (g1 - g0); if (gq > 0) grain(ctx, env, sh, gq, 900 + i, i); }
  });
  drawing.forEach(([sh, q]) => penTool(ctx, sh, q));
};

export const STYLE = { id: "flatVector", name: "Flat vector", family: "modern flat illustration", medium: "pen-tool paths in a vector app, flat fills that land when a path closes, long-shadow shapes with a transparency ramp, a raster grain brush over the shade sides", nearest: "fox", hero: "a regatta of small sailboats on a bay under hills, the leader rounding the mark" };

export const flatVector: Film = {
  meta: { title: "Flat vector · the regatta", W, H, fps: 30, bpm: 120, durationFrames: N },
  assets: { images: {} },
  shots: [{ id: "artboard", start: 0, end: N, draw: drawFlatVector }],
};
