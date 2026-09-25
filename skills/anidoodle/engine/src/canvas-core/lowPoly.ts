import { fractal, rng, type Ctx, type Env, type Layer, type P } from "./core";
import type { Film } from "./film";
import { clamp01, onGrid } from "./scrapbookKit";

// A MOUNTAIN LAKE AT DAWN · low-poly, 3D drawn in code.
//
// MEDIUM, physically: there is none, and that is the point of the style. A scene MODELLED as
// triangle meshes (a heightfield of lake, shores and two mountain ranges; pines as stacked
// six-sided cones; a canoe lofted from cross-sections; rocks as jittered polyhedra), PROJECTED by
// hand through a pinhole camera (no 3D engine: a translate, one pitch rotation and a divide), and
// FLAT-SHADED: every triangle is one colour, from its normal against ONE light, the low sun, plus
// a cool sky ambient, then hazed toward the dawn by its distance. Drawn by PAINTER'S SORT, far to
// near. The mark is the facet: a hard-edged triangle, no line, no gradient, no texture.
// Reflections are the same meshes mirrored in the water plane, drawn only where water is visible
// (a mask made by the same painter's pass) and broken by horizontal ripple cuts.
// ORDER, as a modeller works: the empty viewport; the wireframe (terrain swept from the far
// ranges to the near shore, then the pines, the rocks, the canoe); the faces shading in back to
// front in exactly painter's order (sky, far range, near range, shores, trees, canoe); the water
// facets; the reflections; last the ripple cuts and the sun's glitter path.
// LIGHT: the sun just clearing a notch in the far range, left of centre, 6 degrees up: slopes
// that face it go peach and rose, the rest stay blue-violet; snow on the high faces.
// NOT any other plate: every other plate is a hand's mark on a surface; this one is geometry, and
// its only texture is the triangulation. Reference, from memory: dawn over a lake in the Canadian
// Rockies (a pink-lit range, snow on the upper faces, dark spruce shores, still water).

const N = 450;
const W = 1080, H = 1080, F = 880, CX = 540, CY = 540;
const CAM = { x: 0, y: 3.4, z: -4 }, PITCH = 0.035, CP = Math.cos(PITCH), SP = Math.sin(PITCH);
type V = [number, number, number];
const view = ([x, y, z]: V): V => { const X = x - CAM.x, Y = y - CAM.y, Z = z - CAM.z; return [X, Y * CP + Z * SP, Z * CP - Y * SP]; };
const proj = (v: V): P => { const [X, Y, Z] = view(v); return [CX + (F * X) / Z, CY - (F * Y) / Z]; };
const HORIZON = CY - F * Math.tan(PITCH);
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V): V => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const smoothstep = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- light and colour
const SUN_DIR: V = norm([-0.78, 0.11, 0.62]);        // toward the sun: left, low, beyond the lake
const SUN_SCREEN: P = [372, 408];
const hex = (h: string): V => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
const rgb = (c: V) => `rgb(${c.map((v) => Math.round(255 * clamp01(v))).join(",")})`;
const mixV = (a: V, b: V, t: number): V => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const AMB: V = [0.5, 0.52, 0.8], SUNC: V = [1.35, 0.82, 0.62], HAZE: V = hex("#c79aa6");
const shade = (base: V, n: V, dist: number, ambK = 1): V => { const d = Math.max(0, dot(n, SUN_DIR)), sky = 0.55 + 0.45 * Math.max(0, n[1]); const c: V = [base[0] * (AMB[0] * sky * ambK + SUNC[0] * d), base[1] * (AMB[1] * sky * ambK + SUNC[1] * d), base[2] * (AMB[2] * sky * ambK + SUNC[2] * d)]; return mixV(c, HAZE, 1 - Math.exp(-Math.max(0, dist - 8) / 85)); };

// ---------------------------------------------------------------- the land
const lakeCX = (z: number) => 1.2 + 2.5 * Math.sin(z * 0.07) - 1.6 * Math.exp(-z / 8);
const lakeHW = (z: number) => { const hw = 4.8 + 0.24 * Math.min(z, 50) + 3.2 * Math.exp(-z / 7); return z <= 50 ? hw : z < 58 ? hw * Math.sqrt(Math.max(0, 1 - ((z - 50) / 8) ** 2)) : -2; };
const ridged = (seed: number, x: number, z: number, f: number) => { const v = 1 - Math.abs(2 * fractal(seed, x, z, f, f, 4) - 1); return v * v; };
const height = (x: number, z: number): number => {
  const d = Math.abs(x - lakeCX(z)) - lakeHW(z);
  let h = d > 0 ? Math.min(d * 0.42, 2.6) + fractal(7, x, z, 0.11, 0.11, 3) * 3.2 * smoothstep(0, 9, d) : -1.2;
  h += 6.5 * smoothstep(54, 66, z) * ridged(11, x, z, 0.075) + 1.5 * smoothstep(52, 60, z);
  h += 17 * smoothstep(74, 90, z) * ridged(23, x + 40, z, 0.045) * (0.7 + 0.3 * fractal(5, x, z, 0.02, 0.02, 2)) + 4 * smoothstep(70, 84, z);
  // the notch the sun clears: a saddle in the far range just left of centre
  const nx = (x + 22) / 10; h -= 9 * Math.exp(-nx * nx) * smoothstep(70, 90, z);
  return h;
};
type Face = { v: V[]; s: P[]; col: string; z: number; kind: "land" | "water" | "obj"; mir?: P[]; mcol?: string; order?: number; group: number };
const faceOf = (v: V[], base: V, kind: Face["kind"], group: number, ambK = 1, cull = false): Face | null => {
  let n = norm(cross(sub(v[1], v[0]), sub(v[2], v[0]))); const c: V = [(v[0][0] + v[1][0] + v[2][0]) / 3, (v[0][1] + v[1][1] + v[2][1]) / 3, (v[0][2] + v[1][2] + v[2][2]) / 3];
  const toCam = sub([CAM.x, CAM.y, CAM.z], c); if (dot(n, toCam) < 0) { if (cull) return null; n = [-n[0], -n[1], -n[2]]; }
  const dist = Math.hypot(...toCam), col = shade(base, n, dist, ambK);
  const f: Face = { v, s: v.map(proj), col: rgb(col), z: view(c)[2], kind, group };
  if (kind !== "water" && v.some((p) => p[1] > 0.01)) { f.mir = v.map(([x, y, z]) => proj([x, -Math.max(0, y), z])); f.mcol = rgb(mixV(col, hex("#35406a"), 0.28).map((q) => q * 0.82) as V); }
  return f;
};
const build = () => {
  const r = rng(77), faces: Face[] = [];
  // a perspective-friendly grid: columns widen with distance, rows grow ~12% each
  const zs: number[] = [0]; while (zs[zs.length - 1] < 118) { const z = zs[zs.length - 1]; zs.push(z + 0.55 + 0.115 * z); }
  const COLS = 44, grid: V[][] = zs.map((z, i) => Array.from({ length: COLS + 1 }, (_, j) => { const u = -1 + (2 * (j + (j > 0 && j < COLS ? (r() - 0.5) * 0.6 : 0))) / COLS, zz = i > 0 && i < zs.length - 1 ? z + (r() - 0.5) * 0.5 * (zs[i + 1] - zs[i - 1]) / 2 : z, x = u * (7 + 0.66 * zz), h = height(x, zz); return [x, Math.max(0, h), zz] as V; }));
  const raw = zs.map((z, i) => grid[i].map(([x, , zz]) => height(x, zz)));
  for (let i = 0; i < zs.length - 1; i++) for (let j = 0; j < COLS; j++) {
    const a = grid[i][j], b = grid[i][j + 1], c = grid[i + 1][j + 1], d = grid[i + 1][j], ha = raw[i][j], hb = raw[i][j + 1], hc = raw[i + 1][j + 1], hd = raw[i + 1][j];
    const tris: [V[], number[]][] = r() < 0.5 ? [[[a, b, c], [ha, hb, hc]], [[a, c, d], [ha, hc, hd]]] : [[[a, b, d], [ha, hb, hd]], [[b, c, d], [hb, hc, hd]]];
    for (const [t, hs] of tris) {
      const mx = Math.max(...hs), avgY = (t[0][1] + t[1][1] + t[2][1]) / 3, zc = (t[0][2] + t[1][2] + t[2][2]) / 3;
      if (mx <= 0) { const far = clamp01((zc - 4) / 55), base = mixV(hex("#2c3561"), hex("#d9a3a8"), far ** 1.3); const k = 0.96 + r() * 0.08; faces.push({ v: t, s: t.map(proj), col: rgb(base.map((q) => q * k) as V), z: view([t[0][0], 0, zc])[2], kind: "water", group: 0 }); continue; }
      const n = norm(cross(sub(t[1], t[0]), sub(t[2], t[0]))), up = Math.abs(n[1]);
      const base = Math.min(...hs) < 0.25 ? hex("#6a6553") : avgY > 11 && up > 0.6 ? hex("#f4eef4") : avgY > 7 || up < 0.55 ? hex(zc > 66 ? "#7d7894" : "#6a6275") : hex(zc > 50 ? "#3f5a50" : "#2e4a3c");
      const f = faceOf(t, base.map((q) => q * (0.95 + r() * 0.1)) as V, "land", 1); if (f) faces.push(f);
    }
  }
  // pines: drifts along both shores, bare rests between; six-sided cone tiers on a trunk
  const pines: V[] = [];
  for (let k = 0; k < 4000 && pines.length < 150; k++) { const z = 9 + r() * 54, x = (r() - 0.5) * (18 + z * 1.1), d = Math.abs(x - lakeCX(z)) - lakeHW(z); if (d < 1.2 || d > 16 || height(x, z) > 5) continue; if (fractal(31, x, z, 0.16, 0.16, 2) < 0.5 + (z > 48 ? -0.06 : 0.02)) continue; if (pines.some((p) => Math.hypot(p[0] - x, p[2] - z) < 1.1 + z * 0.02)) continue; pines.push([x, height(x, z), z]); }
  pines.forEach(([x, y, z], pi) => {
    const hgt = 2.4 + r() * 2.6 + z * 0.02, rot = r() * 1.05, sides = 6, g = 2 + pi;
    const trunk: V[] = Array.from({ length: 4 }, (_, i) => { const a = rot + (i / 4) * 6.28; return [x + Math.cos(a) * 0.12, y, z + Math.sin(a) * 0.12] as V; });
    for (let i = 0; i < 4; i++) { const a = trunk[i], b = trunk[(i + 1) % 4], a2: V = [a[0], y + hgt * 0.25, a[2]], b2: V = [b[0], y + hgt * 0.25, b[2]]; [faceOf([a, b, b2], hex("#4a3426"), "obj", g, 1, true), faceOf([a, b2, a2], hex("#4a3426"), "obj", g, 1, true)].forEach((f) => f && faces.push(f)); }
    for (let t = 0; t < 3; t++) {
      const y0 = y + hgt * (0.18 + t * 0.24), y1 = y0 + hgt * (0.42 - t * 0.04), rad = hgt * (0.34 - t * 0.085), apex: V = [x, y1, z];
      const ring: V[] = Array.from({ length: sides }, (_, i) => { const a = rot + t * 0.5 + (i / sides) * 6.28, rr = rad * (0.85 + r() * 0.3); return [x + Math.cos(a) * rr, y0 - 0.05 * r(), z + Math.sin(a) * rr] as V; });
      for (let i = 0; i < sides; i++) { const f = faceOf([ring[i], ring[(i + 1) % sides], apex], hex(t === 2 ? "#2b5244" : "#23463b"), "obj", g, 1.1, true); if (f) faces.push(f); }
    }
  });
  // the canoe: lofted from 13 stations, bow and stern rising, an open hull you can see into
  const C0: V = [1.6, 0, 8.6], yaw = 0.95, L = 4.8, B = 0.9, cy = Math.cos(yaw), sy = Math.sin(yaw);
  const at = (u: number, lat: number, y: number): V => { const lx = u * L / 2, lz = lat; return [C0[0] + lx * cy - lz * sy, y, C0[2] + lx * sy + lz * cy]; };
  const ST = 13, sts = Array.from({ length: ST }, (_, i) => { const u = -1 + (2 * i) / (ST - 1), w = (B / 2) * Math.pow(Math.max(0, 1 - u * u), 0.55), s = 0.32 + 0.22 * u ** 4; return { u, w, s }; });
  const ring = (st: { u: number; w: number; s: number }): V[] => [at(st.u, -st.w, st.s), at(st.u, -st.w * 0.96, st.s * 0.5), at(st.u, -st.w * 0.82, 0.02), at(st.u, st.w * 0.82, 0.02), at(st.u, st.w * 0.96, st.s * 0.5), at(st.u, st.w, st.s)];
  const inner = (st: { u: number; w: number; s: number }): V[] => [at(st.u, -st.w * 0.9, st.s - 0.02), at(st.u, -st.w * 0.6, 0.12), at(st.u, st.w * 0.6, 0.12), at(st.u, st.w * 0.9, st.s - 0.02)];
  const HULL = hex("#b3392b"), WOOD = hex("#c98a4b"), RAIL = hex("#8a5a32"), cg = 300;
  for (let i = 0; i < ST - 1; i++) {
    const A = ring(sts[i]), Bq = ring(sts[i + 1]), IA = inner(sts[i]), IB = inner(sts[i + 1]), um = (sts[i].u + sts[i + 1].u) / 2;
    const keel = at(um, 0, 0.25), outside = (v: V[]) => { const c: V = [(v[0][0] + v[1][0] + v[2][0]) / 3, (v[0][1] + v[1][1] + v[2][1]) / 3, (v[0][2] + v[1][2] + v[2][2]) / 3]; let n = norm(cross(sub(v[1], v[0]), sub(v[2], v[0]))); if (dot(n, sub(c, keel)) < 0) n = [-n[0], -n[1], -n[2]]; return dot(n, sub([CAM.x, CAM.y, CAM.z], c)) > 0 ? faceOf(v, HULL, "obj", cg) : null; };
    for (let k = 0; k < 5; k++) { [outside([A[k], A[k + 1], Bq[k + 1]]), outside([A[k], Bq[k + 1], Bq[k]])].forEach((f) => f && faces.push(f)); }
    const axis = at(um, 0, 0.7), inside = (v: V[]) => { const c: V = [(v[0][0] + v[1][0] + v[2][0]) / 3, (v[0][1] + v[1][1] + v[2][1]) / 3, (v[0][2] + v[1][2] + v[2][2]) / 3]; let n = norm(cross(sub(v[1], v[0]), sub(v[2], v[0]))); if (dot(n, sub(axis, c)) < 0) n = [-n[0], -n[1], -n[2]]; if (dot(n, sub([CAM.x, CAM.y, CAM.z], c)) <= 0) return null; const f = faceOf(v, WOOD, "obj", cg, 1.3); if (f) delete f.mir; return f; };   /* the water mirrors the hull's underside, never its inside */   // an inner wall is seen only from the side it faces
    for (let k = 0; k < 3; k++) { [inside([IA[k + 1], IA[k], IB[k]]), inside([IA[k + 1], IB[k], IB[k + 1]])].forEach((f) => f && faces.push(f)); }
    [[A[0], IA[0], IB[0], Bq[0]], [A[5], Bq[5], IB[3], IA[3]]].forEach(([p, q, s2, t2]) => { [faceOf([p, q, s2], RAIL, "obj", cg), faceOf([p, s2, t2], RAIL, "obj", cg)].forEach((f) => f && faces.push(f)); });
  }
  // two thwarts and a paddle laid across them
  [-0.35, 0.3].forEach((u) => { const st = sts.find((s) => Math.abs(s.u - u) < 0.09) ?? sts[6], a = at(u, -st.w * 0.9, st.s - 0.06), b = at(u, st.w * 0.9, st.s - 0.06), a2 = at(u + 0.03, -st.w * 0.9, st.s - 0.06), b2 = at(u + 0.03, st.w * 0.9, st.s - 0.06); [faceOf([a, b, b2], RAIL, "obj", cg), faceOf([a, b2, a2], RAIL, "obj", cg)].forEach((f) => f && faces.push(f)); });
  const pa = at(-0.42, -0.95, 0.4), pb = at(0.2, 0.62, 0.36), pw: V = [0.04 * sy, 0, -0.04 * cy]; [faceOf([pa, pb, [pb[0] + pw[0], pb[1] + 0.03, pb[2] + pw[2]]], hex("#e0b27a"), "obj", cg), faceOf([pa, [pb[0] + pw[0], pb[1] + 0.03, pb[2] + pw[2]], [pa[0] + pw[0], pa[1] + 0.03, pa[2] + pw[2]]], hex("#e0b27a"), "obj", cg)].forEach((f) => f && faces.push(f));
  const blade: V[] = [pb, at(0.34, 0.8, 0.34), at(0.36, 0.62, 0.35), at(0.22, 0.5, 0.36)]; [faceOf([blade[0], blade[1], blade[2]], hex("#e0b27a"), "obj", cg), faceOf([blade[0], blade[2], blade[3]], hex("#e0b27a"), "obj", cg)].forEach((f) => f && faces.push(f));

  // painter's sort: far to near. The canoe is drawn as one group after the land it floats on.
  const land = faces.filter((f) => f.kind !== "water" && f.group !== cg).sort((a, b) => b.z - a.z), canoe = faces.filter((f) => f.group === cg).sort((a, b) => b.z - a.z), water = faces.filter((f) => f.kind === "water").sort((a, b) => b.z - a.z);
  const solid = [...land, ...canoe]; solid.forEach((f, i) => (f.order = i)); water.forEach((f, i) => (f.order = i));
  // the wireframe, in the order a modeller builds it: terrain far to near, then trees, rocks, canoe
  const wireOrder = [...faces.filter((f) => f.group <= 1).sort((a, b) => b.z - a.z), ...faces.filter((f) => f.group > 1 && f.group < 200).sort((a, b) => a.group - b.group), ...faces.filter((f) => f.group >= 200 && f.group < 300), ...canoe];
  // unique edges, each revealed with the first face that owns it; hidden once all its faces are filled
  const emap = new Map<string, { a: P; b: P; rank: number; faces: Face[] }>();
  wireOrder.forEach((f, i) => { for (let k = 0; k < 3; k++) { const a = f.s[k], b = f.s[(k + 1) % 3], ka = `${a[0].toFixed(2)},${a[1].toFixed(2)}`, kb = `${b[0].toFixed(2)},${b[1].toFixed(2)}`, key = ka < kb ? ka + "|" + kb : kb + "|" + ka; const e = emap.get(key); if (e) e.faces.push(f); else emap.set(key, { a, b, rank: i, faces: [f] }); } });
  const edges = [...emap.values()].sort((x, y) => x.rank - y.rank);
  return { solid, water, wireOrder, edges, all: faces };
};
type Scene = ReturnType<typeof build>;
const scene = (env: Env): Scene => { let s = env.cache.get("lowPoly:scene") as Scene | undefined; if (!s) { s = build(); env.cache.set("lowPoly:scene", s); } return s; };

// ---------------------------------------------------------------- the sky (2D facets) and the sun
const skyFaces = (() => {
  const r = rng(91), cols = 14, rows = 7, pts: P[][] = [];
  for (let i = 0; i <= rows; i++) { const y = -10 + ((HORIZON + 34) * i) / rows; pts.push(Array.from({ length: cols + 1 }, (_, j) => [-10 + (1100 * j) / cols + (j && j < cols ? (r() - 0.5) * 50 : 0), y + (i && i < rows ? (r() - 0.5) * 40 : 0)] as P)); }
  const out: { s: P[]; col: string }[] = [];
  const colAt = (x: number, y: number) => { const t = clamp01(y / (HORIZON + 20)), ds = Math.hypot(x - SUN_SCREEN[0], (y - SUN_SCREEN[1]) * 1.6) / 700; let c = t < 0.45 ? mixV(hex("#262c5c"), hex("#5b4f8a"), t / 0.45) : t < 0.8 ? mixV(hex("#5b4f8a"), hex("#d98f98"), (t - 0.45) / 0.35) : mixV(hex("#d98f98"), hex("#f6bf92"), (t - 0.8) / 0.2); c = mixV(c, hex("#ffd9a8"), clamp01(0.75 - ds) * 0.8 * t); const k = 0.97 + r() * 0.06; return rgb(c.map((q) => q * k) as V); };
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) { const a = pts[i][j], b = pts[i][j + 1], c = pts[i + 1][j + 1], d = pts[i + 1][j]; const tris = (i + j) % 2 ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]]; tris.forEach((t) => { const cx = (t[0][0] + t[1][0] + t[2][0]) / 3, cy = (t[0][1] + t[1][1] + t[2][1]) / 3; out.push({ s: t, col: colAt(cx, cy) }); }); }
  // three faceted clouds, their undersides lit rose by the sun below the horizon
  ([[720, 190, 150, 30], [890, 260, 90, 20], [210, 150, 120, 24]] as [number, number, number, number][]).forEach(([x, y, w, h], ci) => { const n = 7, top: P[] = Array.from({ length: n + 1 }, (_, k) => [x - w + (2 * w * k) / n, y - h * Math.sin((Math.PI * k) / n) * (0.7 + r() * 0.6)] as P), bot: P[] = Array.from({ length: n + 1 }, (_, k) => [x - w * 0.9 + (1.8 * w * k) / n, y + h * 0.35 * Math.sin((Math.PI * k) / n)] as P); for (let k = 0; k < n; k++) { out.push({ s: [top[k], top[k + 1], bot[k]], col: rgb(mixV(hex("#8f7aa8"), hex("#f0a6a0"), 0.25 + 0.15 * ((k + ci) % 3))) }); out.push({ s: [top[k + 1], bot[k + 1], bot[k]], col: rgb(mixV(hex("#8f7aa8"), hex("#ffc3a0"), 0.55 + 0.12 * (k % 2))) }); } });
  return out;
})();
const sunFacets = (() => { const rings: { s: P[]; col: string }[] = []; [[150, "#f7c79a", 0.35], [100, "#fbd7a6", 0.45], [66, "#ffe6b8", 0.6]].forEach(([R, c, a]) => { rings.push({ s: Array.from({ length: 12 }, (_, i) => { const t = (i / 12) * 6.28 + 0.13; return [SUN_SCREEN[0] + Math.cos(t) * (R as number), SUN_SCREEN[1] + Math.sin(t) * (R as number) * 0.9] as P; }), col: `rgba(${hex(c as string).map((v) => Math.round(v * 255)).join(",")},${a})` }); }); rings.push({ s: Array.from({ length: 10 }, (_, i) => { const t = (i / 10) * 6.28; return [SUN_SCREEN[0] + Math.cos(t) * 30, SUN_SCREEN[1] + Math.sin(t) * 30] as P; }), col: "#fff3d6" }); return rings; })();
const stars: P[] = [[120, 60], [310, 96], [610, 44], [860, 80], [980, 150], [470, 130]];

// ---------------------------------------------------------------- drawing
const fillTri = (c: Ctx, s: P[], col: string) => { c.fillStyle = col; c.beginPath(); c.moveTo(s[0][0], s[0][1]); for (let i = 1; i < s.length; i++) c.lineTo(s[i][0], s[i][1]); c.closePath(); c.fill(); c.strokeStyle = col; c.lineWidth = 0.6; c.stroke(); };   // a hairline of the same colour closes the antialias seams between facets
const CUE = { wire: [5, 110], sky: [115, 140], faces: [140, 290], water: [295, 335], refl: [340, 395], ripple: [395, 420] } as const;
onGrid("lowPoly", Object.values(CUE).flat() as number[], N);
const prog = (f: number, [a, b]: readonly [number, number]) => (f >= b ? 1 : clamp01((f - a) / (b - a)));

const layerOf = (env: Env, key: string): Layer => { const DW = Math.round(W * env.scale), DH = Math.round(H * env.scale), k = `lowPoly:${key}:${DW}`; let L = env.cache.get(k) as Layer | undefined; if (!L) { L = env.canvas(DW, DH); env.cache.set(k, L); } return L; };
// where water is visible: the painter's pass again, water white, anything solid erasing it
const waterMask = (env: Env, sc: Scene): Layer => {
  const k = `lowPoly:maskDone:${env.scale}`, L = layerOf(env, "mask"); if (env.cache.get(k)) return L;
  const c = L.ctx; c.setTransform(env.scale, 0, 0, env.scale, 0, 0); c.clearRect(0, 0, W, H);
  const all = [...sc.water.map((f) => ({ f, w: true })), ...sc.solid.map((f) => ({ f, w: false }))].sort((a, b) => b.f.z - a.f.z);
  // the canoe is drawn after the land it floats on: keep it last here as well
  all.sort((a, b) => (a.f.group === 300 ? 1 : 0) - (b.f.group === 300 ? 1 : 0) || b.f.z - a.f.z);
  for (const { f, w } of all) { c.globalCompositeOperation = w ? "source-over" : "destination-out"; fillTri(c, f.s, "#ffffff"); }
  c.globalCompositeOperation = "source-over"; env.cache.set(k, true); return L;
};

export const drawLowPoly = (ctx: Ctx, f: number, env: Env) => {
  const sc = scene(env), s = env.scale;
  ctx.setTransform(s, 0, 0, s, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  // the empty viewport: a dark modelling grid
  ctx.fillStyle = "#171a26"; ctx.fillRect(0, 0, W, H); ctx.strokeStyle = "#23283a"; ctx.lineWidth = 1; ctx.beginPath(); for (let x = 0; x <= W; x += 60) { ctx.moveTo(x, 0); ctx.lineTo(x, H); } for (let y = 0; y <= H; y += 60) { ctx.moveTo(0, y); ctx.lineTo(W, y); } ctx.stroke();
  const pSky = prog(f, CUE.sky), pFace = prog(f, CUE.faces), pWater = prog(f, CUE.water), pRefl = prog(f, CUE.refl), pRip = prog(f, CUE.ripple);
  // sky facets, top to bottom (the farthest thing there is), then the sun, then stars
  if (pSky > 0) { const n = Math.floor(pSky * skyFaces.length); const order = skyFaces.map((q, i) => ({ q, i, y: (q.s[0][1] + q.s[1][1] + q.s[2][1]) / 3 })).sort((a, b) => a.y - b.y); order.slice(0, n).forEach(({ q }) => fillTri(ctx, q.s, q.col)); if (pSky >= 1) { sunFacets.forEach((q) => { ctx.fillStyle = q.col; ctx.beginPath(); q.s.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill(); }); ctx.fillStyle = "#fff4e0"; stars.forEach(([x, y], i) => { const k = 1.2 + (i % 3) * 0.5; ctx.beginPath(); ctx.moveTo(x, y - k * 2); ctx.lineTo(x + k * 0.6, y); ctx.lineTo(x, y + k * 2); ctx.lineTo(x - k * 0.6, y); ctx.closePath(); ctx.fill(); }); } }
  // solid faces, painter's order
  const nSolid = Math.floor(pFace * sc.solid.length); for (let i = 0; i < nSolid; i++) fillTri(ctx, sc.solid[i].s, sc.solid[i].col);
  // water facets, far to near. They sit under everything solid, so each is drawn and then the
  // solid faces nearer than it are laid again over it only where they overlap: simpler and exact,
  // we draw water into its own layer and cut it with the solid mask.
  if (pWater > 0) {
    const Wl = layerOf(env, "water"), wc = Wl.ctx; wc.setTransform(s, 0, 0, s, 0, 0); wc.globalCompositeOperation = "source-over"; wc.clearRect(0, 0, W, H);
    const nW = pWater >= 1 ? sc.water.length : Math.floor(pWater * sc.water.length); for (let i = 0; i < nW; i++) fillTri(wc, sc.water[i].s, sc.water[i].col);
    // reflections: the mirrored meshes, far to near, darkened toward the water
    if (pRefl > 0) { const mir = sc.solid.filter((q) => q.mir), nR = pRefl >= 1 ? mir.length : Math.floor(pRefl * mir.length); for (let i = 0; i < nR; i++) fillTri(wc, mir[i].mir!, mir[i].mcol!); }
    // ripple cuts: thin bands where the surface is stirred show the plain water colour again
    if (pRip > 0) { const r = rng(404); wc.globalAlpha = 0.9; for (let y = HORIZON + 8, k = 0; y < H; y += 9 + (y - HORIZON) * 0.1, k++) { const vis = clamp01(pRip * 1.3 - (y - HORIZON) / (H - HORIZON) * 0.3); if (vis <= 0) continue; const th = 0.8 + (y - HORIZON) * 0.012; for (let x = -20 + r() * 120; x < W; x += 120 + r() * 260) { const l = (20 + r() * 90) * vis; const t = clamp01((y - HORIZON) / 500); wc.fillStyle = rgb(mixV(hex("#d9a3a8"), hex("#2c3561"), t ** 0.8)); wc.fillRect(x, y, l, th); } } wc.globalAlpha = 1;
      // the sun's glitter path: short bright dashes in a column under it, widening toward us
      const g = rng(405); wc.fillStyle = "#ffe7bf"; for (let y = HORIZON + 3; y < 760; y += 3 + (y - HORIZON) * 0.05) { const spread = 8 + (y - HORIZON) * 0.35, n = Math.max(1, Math.floor((1 - (y - HORIZON) / 300) * 4 * pRip)); for (let k = 0; k < n; k++) { const x = SUN_SCREEN[0] + (g() - 0.5) * 2 * spread, l = 4 + g() * 14 * (1 - (y - HORIZON) / 320); if (l > 1) wc.fillRect(x - l / 2, y, l, 1.2 + (y - HORIZON) * 0.006); } } }
    const M = waterMask(env, sc); wc.save(); wc.setTransform(1, 0, 0, 1, 0, 0); wc.globalCompositeOperation = "destination-in"; wc.drawImage(M.canvas as CanvasImageSource, 0, 0); wc.restore(); wc.globalCompositeOperation = "source-over";
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(Wl.canvas as CanvasImageSource, 0, 0); ctx.restore();
  }
  // wireframe over whatever is not yet a face, in cyan, drawn edge by edge
  const pWire = prog(f, CUE.wire); if (pWire > 0 && pRefl < 1) {
    const E = sc.edges, n = pWire * sc.wireOrder.length; ctx.strokeStyle = "rgba(130,210,255,0.5)"; ctx.lineWidth = 0.7; ctx.beginPath();
    const nWater = pWater >= 1 ? sc.water.length : Math.floor(pWater * sc.water.length), filled = (q: Face) => q.order! < (q.kind === "water" ? nWater : nSolid);
    for (const e of E) { if (e.rank >= n) break; if (e.faces.every(filled)) continue; const part = clamp01(n - e.rank); ctx.moveTo(e.a[0], e.a[1]); ctx.lineTo(e.a[0] + (e.b[0] - e.a[0]) * part, e.a[1] + (e.b[1] - e.a[1]) * part); }
    ctx.stroke();
  }
};

export const lowPoly: Film = {
  meta: { title: "A mountain lake at dawn · low-poly", W, H, fps: 30, bpm: 120, durationFrames: N, raster: "cpu" },
  assets: { images: {} },
  shots: [{ id: "lowPoly", start: 0, end: N, draw: (ctx, f, env) => drawLowPoly(ctx, f, env) }],
};
export const STYLE = { id: "lowPoly", name: "Low-poly", family: "3D in code", medium: "triangle meshes projected by hand through a pinhole camera, each facet flat-shaded by its normal against one low sun, painter-sorted far to near; no 3D engine", nearest: "none (the only geometry plate); closest in spirit riso's flat inks", hero: "A mountain lake at dawn: pink-lit range, spruce shores, a red canoe, reflections" };
