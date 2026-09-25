// RANUNCULUS · drawn. The pencil & watercolour plate, made the way a botanical illustrator makes it.
//
// MEDIUM: an HB pencil and pan watercolour on cold-press paper, the same hand as `ranunculus.ts`.
// ORDER, the point of this film:
//   (1) pencil lay-in: a loose envelope for the bloom and its centre, the stem's gesture, the axis of
//       each leaf, then the lips of the outer three rings, all light enough to live under paint;
//   (2) first light washes: one pale wash per mass (bloom, heart, stem, leaves, calyx), each spreading
//       from where the brush touched and stopping short of its outline;
//   (3) form: every petal shaded toward the ONE light (upper left), outer ring first, working in to
//       the tight centre, exactly as the hero plate paints them (same seeds, same control points);
//   (4) graphite over the paint: lips, veins, stem and leaf contours, each line stopping where a petal
//       painted later sits over it (a hand does not draw what it cannot see).
// The geometry is the hero's, re-authored here so `ranunculus.ts` stays byte-identical. The last
// frame is NOT the hero's pixels: the hero interleaves paint and graphite petal by petal and has no
// lay-in; this one lays all pencil before paint and all graphite after it, as the medium is worked.
import { Gfx, PENCIL, arc, displace, fractal as _f, jitter, line, oval, rng, sample, tube, type Ctx, type Env, type P } from "./core";
import type { Film } from "./film";
import { checkOps, schedule, staged, type Op } from "./brokenColourKit";

const N = 450, HOLD = N - 30;
const META = { title: "Ranunculus · drawn", W: 1080, H: 1080, fps: 30, bpm: 120, durationFrames: N, raster: "cpu" as const };
const K = META.W / 1080;                          // the hero was authored on a 1080 sheet

// ---------------------------------------------------------------- the hero's geometry, verbatim
type Petal = { shape: P[]; hi: P[]; lip: P[]; veins: { pts: P[]; seed: number }[]; seed: number; tier: number; base: P; reach: number };
const petalGeo = (radius: number, angle: number, width: number, depth: number, seed: number, tier: number): Petal => {
  const r = rng(seed), cx = 531 + (r() - 0.5) * 14, cy = 391 + (r() - 0.5) * 12;
  const place = ([x, y]: P): P => [cx + Math.cos(angle) * y - Math.sin(angle) * x, cy + (Math.sin(angle) * y + Math.cos(angle) * x) * 0.87];
  const lip = arc(0, radius - depth * 0.28, width, depth * 0.45, Math.PI, 0, 9).map(([x, y], i): P => [x, y + Math.sin(i * 1.8 + seed) * depth * 0.045]);
  const shape = [...lip, [width * 0.73, radius - depth * 0.61], [width * 0.15, radius - depth], [-width * 0.63, radius - depth * 0.7]] as P[];
  const hi = [...lip.slice(1, 8), [0, radius - depth * 0.17]].map((p) => place(p as P));
  const veins = [0, 1, 2].map((j) => { const x = (j - 1) * width * 0.42; return { pts: line([x * 0.45, radius - depth * 0.69], [x, radius - depth * 0.06], (r() - 0.5) * 7).map(place), seed: seed + 10 + j }; });
  return { shape: shape.map(place), hi, lip: lip.map(place), veins, seed, tier, base: place([0, radius - depth * 0.85]), reach: depth * 1.35 + width };
};
const PETAL_COLORS = ["#f7ddd2", "#f4cbbb", "#efb8a8", "#e8a491", "#df907f", "#d88071", "#c77364"];
const petals = (() => {
  const r = rng(7321), out: Petal[] = [];
  const rings = [
    { radius: 252, count: 11, width: 99, depth: 150 }, { radius: 211, count: 13, width: 77, depth: 116 }, { radius: 171, count: 14, width: 62, depth: 94 },
    { radius: 134, count: 14, width: 49, depth: 74 }, { radius: 100, count: 12, width: 38, depth: 58 }, { radius: 70, count: 11, width: 28, depth: 42 }, { radius: 43, count: 9, width: 21, depth: 31 },
  ];
  rings.forEach((ring, tier) => {
    const offset = tier * 0.39 + 0.14;
    for (let i = 0; i < ring.count; i++) {
      const a = offset + (i * Math.PI * 2) / ring.count + (r() - 0.5) * 0.15;
      const rad = ring.radius * (0.95 + r() * 0.1), wid = ring.width * (0.88 + r() * 0.24), dep = ring.depth * (0.92 + r() * 0.16);
      out.push(petalGeo(rad, a, wid, dep, 1000 + tier * 500 + i * 25, tier));
    }
  });
  for (let i = 0; i < 5; i++) out.push(petalGeo(20 - i * 2, i * 2.4, 12 - i, 17, 6000 + i * 25, 6));
  return out;
})();
type Leaf = { edge: P[]; mid: P[]; ribs: P[][]; seed: number; origin: P };
const leafGeo = (origin: P, direction: number, size: number, seed: number): Leaf => {
  const place = ([x, y]: P): P => [origin[0] + (x * Math.cos(direction) - y * Math.sin(direction)) * size, origin[1] + (x * Math.sin(direction) + y * Math.cos(direction)) * size];
  const edge: P[] = [[0, 0], [28, -22], [35, -51], [52, -37], [78, -65], [81, -38], [116, -39], [101, -17], [147, 0], [105, 12], [113, 31], [80, 25], [73, 52], [50, 31], [30, 39], [22, 17]];
  return { edge: edge.map(place), mid: line([0, 0], [139, 0], -3).map(place), ribs: [[35, -45], [77, -57], [111, -34], [71, 45], [107, 27]].map(([x, y]) => line([x * 0.56, 0], [x, y], 3).map(place)), seed, origin };
};
const LEAVES = [leafGeo([541, 760], -2.55, 1.25, 40), leafGeo([549, 698], -0.57, 1.02, 60)];
const STEM: P[] = [[547, 548], [557, 645], [539, 756], [517, 880], [524, 991]], STALK = tube(STEM, 8, 4, true), CALYX = oval(543, 548, 48, 34, 10);
// the outline g.form actually fills, so a later petal can hide an earlier line exactly where its paint sits
const formEdge = (pts: P[], seed: number) => displace(sample(jitter(pts, 1.2, seed), true, 8), 13, 0.022, 3, 5);
const bbox = (s: P[]) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; s.forEach(([x, y]) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }); return [x0, y0, x1, y1]; };
const hit = (a: number[], b: number[]) => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
const covers = petals.map((p) => { const e = formEdge(p.shape, p.seed); return { e, box: bbox(e) }; });
const calyxCover = (() => { const e = formEdge(CALYX, 90); return { e, box: bbox(e) }; })();

// ---------------------------------------------------------------- how marks are made
const gfx = (ctx: Ctx, env: Env) => { const g = new Gfx(ctx, env, 0, PENCIL); g.push(0, 0, K); return g; };
const done = (g: Gfx) => g.pop();
// a wet front: the brush touched at `at`, the pigment runs outward along a ragged edge
const spread = (g: Gfx, at: P, shape: P[], p: number, seed: number, fn: () => void) => {
  if (p >= 1) return fn();
  const reach = (Math.max(...shape.map(([x, y]) => Math.hypot(x - at[0], y - at[1]))) + 10) / 0.75, c = g.cur, R = reach * Math.pow(p, 0.75), pts: P[] = Array.from({ length: 28 }, (_, i) => { const a = (i / 28) * Math.PI * 2, k = 0.75 + 0.5 * _f(seed, Math.cos(a) * 40 + 100, Math.sin(a) * 40 + 100, 0.05, 0.05, 2); return [at[0] + Math.cos(a) * R * k, at[1] + Math.sin(a) * R * k]; });
  c.save(); c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.clip(); fn(); c.restore();
};
// graphite that stops under paint laid after it
const hidden = (g: Gfx, lineBox: number[], later: { e: P[]; box: number[] }[]) => {
  const c = g.cur; c.save(); c.globalCompositeOperation = "destination-out"; c.globalAlpha = 0.94; c.fillStyle = "#000";
  later.forEach(({ e, box }) => { if (!hit(box, lineBox)) return; c.beginPath(); e.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill(); });
  c.restore();
};
const LAY = "#8a7f86";
// a ring's silhouette: the crown of every lip in that ring, walked round the centre (a scalloped mass, never a disc)
const silhouette = (tier: number): P[] => petals.filter((p) => p.tier === tier).map((p) => p.lip[4]).sort((a, b) => Math.atan2(a[1] - 391, a[0] - 531) - Math.atan2(b[1] - 391, b[0] - 531));

const build = (): Op[] => {
  const ops: Op[] = [], add = (marks: ((ctx: Ctx, env: Env, p: number) => void)[], f0: number, f1: number, dur: number, pace?: (u: number) => number) => { const t = schedule(marks.length, f0, f1, dur, pace); marks.forEach((d, i) => ops.push({ ...t[i], draw: d })); };
  const pencil = (pts: P[], o: Parameters<Gfx["pen"]>[1]) => (ctx: Ctx, env: Env, p: number) => { const g = gfx(ctx, env); g.group("ink", () => g.pen(pts, { ...o, progress: p })); done(g); };
  // (1) lay-in
  const lay: ((ctx: Ctx, env: Env, p: number) => void)[] = [
    pencil(oval(531, 393, 262, 232, 16, -2.6), { closed: true, w: 0.85, color: LAY, opacity: 0.42, seed: 3, wobble: 3, boil: 0, retrace: false }),
    pencil(oval(533, 391, 62, 52, 10, -2.2), { closed: true, w: 0.75, color: LAY, opacity: 0.4, seed: 4, wobble: 2, boil: 0, retrace: false }),
    pencil(STEM, { w: 0.9, color: LAY, opacity: 0.45, seed: 5, wobble: 1.5, boil: 0, retrace: false }),
    ...LEAVES.map((l, i) => pencil(l.mid, { w: 0.75, color: LAY, opacity: 0.42, seed: 6 + i, wobble: 1, boil: 0, retrace: false })),
    ...petals.filter((p) => p.tier <= 2).map((p) => pencil(p.lip, { w: 0.7, color: LAY, opacity: 0.4, seed: p.seed + 7, wobble: 1.2, boil: 0, retrace: false })),
  ];
  add(lay, 0.5, 80, 6, (u) => Math.pow(u, 1.15));
  // (2) first light washes, one per mass, each short of its outline
  const wash = (pts: P[], color: string, alpha: number, at: P, _reach: number, seed: number) => (ctx: Ctx, env: Env, p: number) => { const g = gfx(ctx, env); g.group("paint", () => spread(g, at, pts, p, seed, () => g.wash(pts, color, { alpha, seed, dx: -2, dy: -2, shrink: 0.93 }))); done(g); };
  add([
    wash(silhouette(0), "#f6d6c6", 0.34, [420, 250], 470, 301),
    wash(silhouette(3), "#efb3a0", 0.28, [500, 350], 200, 302),
    wash(STALK, "#c6cea6", 0.4, [547, 560], 460, 303),
    ...LEAVES.map((l, i) => wash(l.edge, "#c9d2aa", 0.4, l.origin, 200, 304 + i)),
    wash(CALYX, "#c4cc9e", 0.4, [520, 530], 90, 306),
  ], 79, 160, 20);
  // (3) form toward the one light, in the hero's order and with the hero's calls
  const form = (at: P, shape: P[], seed: number, fn: (g: Gfx) => void) => (ctx: Ctx, env: Env, p: number) => { const g = gfx(ctx, env); g.group("paint", () => spread(g, at, shape, p, seed, () => fn(g))); done(g); };
  add([
    form([547, 560], STALK, 21, (g) => g.form(STALK, "#a6b48b", "#708776", { seed: 21, light: [-3, -1] })),
    ...LEAVES.map((l) => form(l.origin, l.edge, l.seed, (g) => g.form(l.edge, "#a4b28b", "#637f70", { seed: l.seed, light: [-3, -4], alpha: 0.9 }))),
    form([520, 530], CALYX, 90, (g) => g.form(CALYX, "#abb68b", "#6f8069", { seed: 90, light: [-4, -5] })),
    ...petals.map((pt) => form(pt.base, pt.shape, pt.seed, (g) => {
      g.form(pt.shape, PETAL_COLORS[pt.tier], pt.tier < 3 ? "#ce8c8a" : "#ac6667", { seed: pt.seed, light: [-3.2, -4.6], alpha: 0.94 });
      g.wash(pt.hi, "#fff2dc", { seed: pt.seed + 1, alpha: 0.28, dx: -1, dy: -1, shrink: 0.91, rim: false });
    })),
  ], 159, 336, 9, (u) => u * 0.6 + u * u * 0.4);
  // (4) graphite over the paint
  const later = (i: number) => covers.slice(i + 1);
  const graphite = (i: number) => (ctx: Ctx, env: Env, p: number) => {
    const pt = petals[i], g = gfx(ctx, env);
    g.group("ink", () => {
      g.pen(pt.lip, { seed: pt.seed + 2, w: 0.88, opacity: 0.43, color: "#726262", wobble: 0.65, boil: 0, taper: 1, retrace: true, progress: Math.min(1, p * 1.6) });
      if (p > 0.45) pt.veins.forEach((v, j) => g.pen(v.pts, { seed: v.seed, w: 0.48, opacity: 0.17, color: "#986b69", wobble: 0.35, boil: 0, retrace: false, progress: Math.min(1, Math.max(0, (p - 0.45 - j * 0.12) / 0.3)) }));
      hidden(g, bbox([...pt.lip, ...pt.veins.flatMap((v) => v.pts)]).map((v, k) => v + (k < 2 ? -6 : 6)), later(i));
    });
    done(g);
  };
  const leafLine = (l: Leaf) => (ctx: Ctx, env: Env, p: number) => {
    const g = gfx(ctx, env), s = l.seed;
    g.group("ink", () => {
      g.pen(l.edge, { seed: s + 1, closed: true, w: 0.95, opacity: 0.45, wobble: 0.65, boil: 0, color: "#5f6a5c", progress: Math.min(1, p * 1.5) });
      if (p > 0.5) { g.pen(l.mid, { seed: s + 2, w: 0.9, opacity: 0.55, boil: 0, progress: Math.min(1, (p - 0.5) * 4) }); l.ribs.forEach((rb, i) => g.pen(rb, { seed: s + 3 + i, w: 0.55, opacity: 0.35, boil: 0, retrace: false, progress: Math.min(1, Math.max(0, (p - 0.6 - i * 0.06) / 0.12)) })); }
      hidden(g, bbox(l.edge), [calyxCover, ...covers]);
    });
    done(g);
  };
  add([
    (ctx, env, p) => { const g = gfx(ctx, env); g.group("ink", () => { g.pen(STALK, { seed: 22, closed: true, w: 0.95, opacity: 0.53, wobble: 0.6, boil: 0, progress: p }); hidden(g, bbox(STALK), [calyxCover, ...covers]); }); done(g); },
    ...LEAVES.map(leafLine),
    ...petals.map((_, i) => graphite(i)),
  ], 335, HOLD, 8, (u) => u * 0.8 + u * u * 0.2);
  return checkOps(ops, HOLD);
};

const KEY = "ranunculusDraw:ops:v1";
const ops = (cache: Map<string, unknown>) => () => { let o = cache.get(KEY) as Op[] | undefined; if (!o) { o = build(); cache.set(KEY, o); } return o; };
export const drawRanunculusDraw = (ctx: Ctx, frame: number, env: Env) => staged("ranunculusDraw", ops(env.cache),
  (c, e) => { c.setTransform(e.scale, 0, 0, e.scale, 0, 0); c.fillStyle = "#fffaf3"; c.fillRect(0, 0, e.W, e.H); },
  (c, e) => { const g = new Gfx(c, e, 0, PENCIL); g.paper("paper", 0.12); g.paper("coldpress", 0.18); })(ctx, frame, env);

export const STYLE = { id: "ranunculusDraw", name: "Pencil & watercolour, drawn", family: "watercolour", medium: "HB pencil and pan watercolour on cold-press paper, laid in, washed, formed, then graphite over the paint", nearest: "ranunculus", hero: "a ranunculus in bloom" };
export const ranunculusDraw: Film = { meta: META, assets: { images: {} }, shots: [{ id: "ranunculusDraw", start: 0, end: N, draw: drawRanunculusDraw }] };
