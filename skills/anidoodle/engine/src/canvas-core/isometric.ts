// ISOMETRIC · "the night bake". A cutaway of a tiny two-floor bakery, lit by its oven.
//
// MEDIUM (physical): a flat vector illustration built on a true 2:1 isometric grid, the way an
// iso illustrator works in a pen-tool program: every edge in plan is a 2:1 line, every vertical
// is vertical, every plane is ONE flat colour. Each material has exactly three tones: top (the
// lightest), left face (+y) and right face (+x, the darkest), so form comes from the cube rule,
// never from a gradient. Edges are crisp: tone meets tone with no line and no blur.
// MARKS: the plane (pen-traced outline, then filled), the 2:1 line, the flat light shape.
// EDGE: vector-crisp; texture is sparse and subtle (tile joints, brick courses, grain, a speckle
// on plaster) laid as more planes and hairlines, never as noise over everything.
// ORDER (the film): the iso grid -> massing blocks -> walls and floors -> interiors (oven,
// mezzanine, racks, table, ladder) -> props (bread, sacks, the baker) -> light and shadow (the
// oven's glow poured on the floor and on every face that sees it, shadows thrown away from it)
// -> details (texture, window stars, flour).
// PALETTE: night-cool ambient on warm materials; the only saturated warmth is the oven.
// LIGHT: the oven mouth is the one light. Everything facing it takes a warm flat tint; cast
// shadows fall away from it; the rest of the room sits in cool night ambient.
// SUBJECT + REALISM: a village bakery at 4 a.m. (reference, from knowledge: wood-fired brick
// ovens with an arched mouth and a stone hearth ledge in front; a baker's peel, a long paddle;
// cooling racks on wheels; flour sacks stored on a loft). The baker is 7.5 heads tall (a real
// adult canon), standing with weight on both feet, three-quarter view, holding the peel with a
// fresh boule on it in two hands, turning from the oven to the cooling rack.
// NOT ITS NEAREST NEIGHBOUR (koi, marker comic): no contour line, no thick-thin, no hand wobble;
// the projection is the style: 2:1 edges, three tones, construction-first order.
import type { Ctx } from "./core";
import type { Film } from "./film";
import { clamp01, Iso, Mat, P2, span } from "./isometricKit";

const N = 480, HOLD = 30;
const BG = "#1b2030", GRID = "#333d57", MASS = "#6f8cc4";
const dim = (h: string, f: number) => "#" + [1, 3, 5].map((i) => Math.round(parseInt(h.slice(i, i + 2), 16) * f).toString(16).padStart(2, "0")).join("");
const dimMat = (m: Mat, f: number): Mat => ({ top: dim(m.top, f), left: dim(m.left, f), right: dim(m.right, f) });
const M0: Record<string, Mat> = {                     // night ambient: warm materials seen by cool light
  plaster: { top: "#c9bba0", left: "#a99b82", right: "#8b806e" },
  cut: { top: "#4d3b35", left: "#3f302b", right: "#332723" },
  tile: { top: "#94593f", left: "#6f3f2c", right: "#5a3223" },
  wood: { top: "#9a7350", left: "#7a5839", right: "#624630" },
  darkwood: { top: "#6a4f3e", left: "#533d31", right: "#422f27" },
  brick: { top: "#a9573a", left: "#8a432a", right: "#6f3522" },
  stone: { top: "#bdb3a2", left: "#9a9080", right: "#7e7567" },
  crust: { top: "#dc9d52", left: "#b87a33", right: "#935d24" },
  sack: { top: "#cdbf9f", left: "#b09f7c", right: "#92835f" },
  iron: { top: "#5d5f6b", left: "#474955", right: "#373843" },
};
// everything but the bread sits a step further into the night, so the oven carries the light
const M: Record<string, Mat> = Object.fromEntries(Object.entries(M0).map(([k, m]) => [k, k === "crust" ? m : dimMat(m, k === "brick" ? 0.92 : 0.84)]));
const WARM = "#ffb04a", HOT = "#ffd98a", CORE = "#fff3cf", EMBER = "#e0662c";

type Item = { stage: number; w?: number; make: (iso: Iso, p: number) => void; light?: (iso: Iso, p: number) => void; detail?: (iso: Iso, p: number) => void };

const scene = (): Item[] => {
  const I: Item[] = [];
  const box = (stage: number, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, m: Mat, extra: Partial<Item> = {}) =>
    I.push({ stage, make: (iso, p) => iso.make(iso.boxFaces(x0, y0, z0, x1, y1, z1, m), p, m.right), light: (iso, p) => warmBox(iso, x0, y0, z0, x1, y1, z1, p), ...extra });

  // ---------- building shell: slab, two back walls, the chimney
  I.push({ stage: 2, make: (iso, p) => { // the plinth's shadow on the night ground, a flat offset plane
    if (p <= 0) return; iso.ctx.save(); iso.ctx.globalAlpha = 0.45 * Math.min(1, p * 2); iso.face([[12.6, -0.6, -0.6], [12.6, 10.6, -0.6], [0.4, 10.6, -0.6], [0.4, 10, -0.6], [12, 10, -0.6], [12, -0.6, -0.6]], "#0e1119"); iso.ctx.restore();
  } });
  box(2, -0.6, -0.6, -0.6, 12, 10, 0, { top: M.tile.top, left: M.cut.left, right: M.cut.right }, { light: undefined,
    detail: (iso, p) => { // tile joints: every unit a tile, laid as hairlines row by row
      const n = Math.floor(22 * p); for (let k = 1; k <= n; k++) { const t = k <= 11 ? k : 0, s = k > 11 ? k - 11 : 0; if (t && t < 12) iso.line(iso.p(t, 0, 0), iso.p(t, 10, 0), M.tile.left, 1, 0.55); if (s && s < 10) iso.line(iso.p(0, s, 0), iso.p(12, s, 0), M.tile.left, 1, 0.55); }
    } });
  // back wall along y = 0 (its +y face looks at us), cut at the top
  box(2, -0.6, -0.6, 0, 12, 0, 11, { top: M.cut.top, left: M.plaster.left, right: M.cut.right }, { light: undefined,
    detail: (iso, p) => { const r = rngLite(7), n = Math.floor(140 * p); for (let k = 0; k < n; k++) { const x = r() * 12, z = 0.3 + r() * 10.4; if (x > 6.2 && x < 10.8 && z < 5) { r(); continue; } iso.face([[x, 0, z], [x + 0.08, 0, z], [x + 0.08, 0, z + 0.08], [x, 0, z + 0.08]], M.plaster.right, 0.5); } },
  });
  // back wall along x = 0 (its +x face looks at us), with the loft window cut through it
  box(2, -0.6, 0, 0, 0, 10, 11, { top: M.cut.top, left: M.cut.left, right: M.plaster.right }, {
    light: (iso, p) => { // the far wall under the loft catches the oven's reach in two flat bands
      if (p <= 0) return; iso.ctx.save(); iso.ctx.beginPath(); [[0, 0, 0], [0, 10, 0], [0, 10, 5.8], [0, 0, 5.8]].forEach(([x, y, z], i) => { const q = iso.p(x, y, z); if (i) iso.ctx.lineTo(q[0], q[1]); else iso.ctx.moveTo(q[0], q[1]); }); iso.ctx.clip();
      [[4.4, 0.08], [2.8, 0.09]].forEach(([r, a]) => { const pts: [number, number, number][] = []; for (let i = 0; i < 28; i++) { const t = (i / 28) * Math.PI * 2; pts.push([0, 6.2 + Math.cos(t) * r * p, 1.6 + Math.sin(t) * r * 0.8 * p]); } iso.face(pts, WARM, a); }); iso.ctx.restore();
    },
    detail: (iso, p) => { const r = rngLite(11), n = Math.floor(120 * p); for (let k = 0; k < n; k++) { const y = r() * 10, z = 0.3 + r() * 10.4; if (y > 5 && y < 7.4 && z > 7.2 && z < 9.8) { r(); continue; } iso.face([[0, y, z], [0, y + 0.08, z], [0, y + 0.08, z + 0.08], [0, y, z + 0.08]], "#998668", 0.5); } },
  });
  // loft window: reveal (the wall's thickness) then night glass
  I.push({ stage: 3, make: (iso, p) => {
    iso.make([{ pts: [iso.p(0, 5.2, 7.4), iso.p(0, 7.2, 7.4), iso.p(0, 7.2, 9.6), iso.p(0, 5.2, 9.6)], fill: "#6b5a4a" }], p, "#4a3d33");
    iso.make([{ pts: [iso.p(-0.35, 5.45, 7.4), iso.p(-0.35, 7.2, 7.4), iso.p(-0.35, 7.2, 9.35), iso.p(-0.35, 5.45, 9.35)], fill: "#24325a" }], p, "#1a2440");
  }, detail: (iso, p) => {
    if (p <= 0) return; // two stars and a moon sliver, and the window's cross bar
    iso.line(iso.p(-0.35, 6.32, 7.4), iso.p(-0.35, 6.32, 9.35), "#6b5a4a", 3); iso.line(iso.p(-0.35, 5.45, 8.4), iso.p(-0.35, 7.2, 8.4), "#6b5a4a", 3);
    if (p > 0.3) { const m = iso.p(-0.35, 6.85, 9.0); iso.ctx.fillStyle = "#e9eef6"; iso.ctx.beginPath(); iso.ctx.arc(m[0], m[1], iso.u * 0.2, 0, Math.PI * 2); iso.ctx.fill(); iso.ctx.fillStyle = "#24325a"; iso.ctx.beginPath(); iso.ctx.arc(m[0] + iso.u * 0.08, m[1] - iso.u * 0.05, iso.u * 0.18, 0, Math.PI * 2); iso.ctx.fill(); }
    if (p > 0.6) [[5.8, 8.0], [6.0, 9.1], [6.9, 7.8]].forEach(([y, z]) => { const s = iso.p(-0.35, y, z); iso.ctx.fillStyle = "#c9d6ee"; iso.ctx.fillRect(s[0] - 1, s[1] - 1, 2.5, 2.5); });
  } });
  // ground-floor window in the y = 0 wall, under the loft
  I.push({ stage: 3, make: (iso, p) => {
    iso.make([{ pts: [iso.p(1.9, 0, 2.2), iso.p(3.5, 0, 2.2), iso.p(3.5, 0, 4.4), iso.p(1.9, 0, 4.4)], fill: "#6b5a4a" }], p, "#4a3d33");
    iso.make([{ pts: [iso.p(1.9, -0.35, 2.2), iso.p(3.25, -0.35, 2.2), iso.p(3.25, -0.35, 4.15), iso.p(1.9, -0.35, 4.15)], fill: "#24325a" }], p, "#1a2440");
  }, detail: (iso, p) => { if (p > 0) { iso.line(iso.p(2.58, -0.35, 2.2), iso.p(2.58, -0.35, 4.15), "#6b5a4a", 3); iso.line(iso.p(1.9, -0.35, 3.2), iso.p(3.25, -0.35, 3.2), "#6b5a4a", 3); } } });

  // ---------- the loft (mezzanine) over the back-left, and what lives under it
  // wall rack of loaves under the loft, against the x = 0 wall, open toward us (+x)
  const shelfRack = (x0: number, y0: number, x1: number, y1: number, h: number, shelves: number, mat: Mat, loaves: "long" | "round", stage: number) => {
    I.push({ stage, make: (iso, p) => {
      const posts: [number, number][] = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]], t = 0.14;
      const parts = [...posts.map(([x, y]) => iso.boxFaces(x - t / 2, y - t / 2, 0, x + t / 2, y + t / 2, h, mat)), ...Array.from({ length: shelves }, (_, k) => iso.boxFaces(x0, y0, 0.35 + (k * (h - 0.5)) / (shelves - 1) - 0.06, x1, y1, 0.35 + (k * (h - 0.5)) / (shelves - 1), mat))];
      // back posts first, then shelves bottom-up, then the front posts
      const order = [0, 2, ...Array.from({ length: shelves }, (_, k) => 4 + k), 1, 3];
      order.forEach((i, k) => iso.make(parts[i], clamp01(p * order.length - k * 0.7), mat.right));
    } });
    I.push({ stage: 4, make: (iso, p) => {
      const r = rngLite(Math.round(x0 * 100 + y0)); let k = 0; const total = (shelves - 1) * 4;
      for (let s = 0; s < shelves - 1; s++) {
        const z = 0.35 + (s * (h - 0.5)) / (shelves - 1);
        if (loaves === "long") { // baguettes lie along the shelf's depth (x), side by side along y
          for (let j = 0; j < 4; j++) { const y = y0 + 0.25 + j * ((y1 - y0 - 0.5) / 3) + (r() - 0.5) * 0.1; if (clamp01(p * total - k++) <= 0) continue; loaf(iso, x0 + 0.15, y - 0.16, z, x1 - 0.2, y + 0.16, z + 0.3); }
        } else {
          for (let j = 0; j < 4; j++) { const y = y0 + 0.4 + j * ((y1 - y0 - 0.8) / 3), x = (x0 + x1) / 2 + (r() - 0.5) * 0.15; if (clamp01(p * total - k++) <= 0) continue; boule(iso, x, y, z, 0.3); }
        }
      }
    } });
  };
  shelfRack(0.15, 1.0, 1.35, 4.4, 4.6, 5, M.darkwood, "long", 3);
  shelfRack(4.75, 0.15, 6.1, 1.5, 4.4, 5, M.iron, "round", 3);            // the cooling rack by the oven: boules just out
  // flour sacks on the ground floor under the loft
  I.push({ stage: 4, make: (iso, p) => { sack(iso, 1.0, 5.4, 0, clamp01(p * 2)); sack(iso, 1.1, 6.9, 0, clamp01(p * 2 - 1)); } });
  // loft posts, slab, sacks up top, railing
  box(3, 4.2, 4.3, 0, 4.55, 4.65, 5.8, M.wood);
  box(3, 4.2, 9.5, 0, 4.55, 9.85, 5.8, M.wood);
  box(3, 0, 0, 5.8, 4.6, 10, 6.3, M.wood, { detail: (iso, p) => { const n = Math.floor(9 * p); for (let k = 1; k <= n; k++) iso.line(iso.p(0, k, 6.3), iso.p(4.6, k, 6.3), M.wood.left, 1, 0.6); } });
  I.push({ stage: 4, make: (iso, p) => { sack(iso, 1.0, 1.6, 6.3, clamp01(p * 3)); sack(iso, 1.1, 3.1, 6.3, clamp01(p * 3 - 1)); sack(iso, 1.05, 2.35, 7.35, clamp01(p * 3 - 2)); } });
  I.push({ stage: 4, make: (iso, p) => { iso.make(iso.boxFaces(2.3, 6.0, 6.3, 3.3, 7.2, 7.0, M.wood), clamp01(p * 1.5), M.wood.right); if (p > 0.6) for (let j = 0; j < 3; j++) boule(iso, 2.8, 6.25 + j * 0.35, 7.0, 0.16); } });
  I.push({ stage: 3, make: (iso, p) => { // railing: posts then the rail, along the loft edge
    const ys = [0.2, 2.6, 5.0, 7.4, 9.8];
    ys.forEach((y, k) => iso.make(iso.boxFaces(4.42, y - 0.06, 6.3, 4.55, y + 0.06, 8.1, M.wood), clamp01(p * 7 - k), M.wood.right));
    iso.make(iso.boxFaces(4.4, 0.1, 7.95, 4.58, 9.9, 8.12, M.wood), clamp01(p * 7 - 5), M.wood.right);
    iso.make(iso.boxFaces(4.42, 0.1, 7.1, 4.55, 9.9, 7.2, M.wood), clamp01(p * 7 - 6), M.wood.right);
  } });

  // ---------- the oven: brick body, dome, arched mouth, hearth ledge, flue up the wall
  const OV = { x0: 6.4, x1: 10.6, y0: 0, y1: 3.2, h: 3.0 };
  box(3, OV.x0, OV.y0, 0, OV.x1, OV.y1, OV.h, M.brick, {
    light: (iso, p) => { // the oven's own face lit by its mouth: a warm halo shape on the brick
      if (p <= 0) return; const c = iso.p(8.5, 3.2, 1.6); iso.ctx.save(); iso.ctx.beginPath(); iso.boxFaces(OV.x0, OV.y0, 0, OV.x1, OV.y1, OV.h, M.brick)[0].pts.forEach(([x, y], i) => (i ? iso.ctx.lineTo(x, y) : iso.ctx.moveTo(x, y))); iso.ctx.clip();
      [[1.9, 0.18], [1.35, 0.22]].forEach(([r, a]) => { iso.ctx.globalAlpha = a * p; iso.ctx.fillStyle = WARM; iso.ctx.beginPath(); iso.ctx.ellipse(c[0], c[1], r * iso.u * 1.1, r * iso.u * 0.8, -0.46, 0, Math.PI * 2); iso.ctx.fill(); });
      iso.ctx.restore();
    },
    detail: (iso, p) => { // brick courses on both faces, joints staggered
      const rows = 9, n = Math.floor(rows * 2 * p);
      for (let k = 0; k < Math.min(rows, n); k++) { const z = ((k + 1) * OV.h) / (rows + 1); iso.line(iso.p(OV.x0, OV.y1, z), iso.p(OV.x1, OV.y1, z), M.brick.right, 1.2, 0.7); iso.line(iso.p(OV.x1, OV.y0, z), iso.p(OV.x1, OV.y1, z), "#6c3320", 1.2, 0.7); }
      for (let k = 0; k < Math.max(0, n - rows); k++) { const z0 = (k * OV.h) / (rows + 1), z1 = ((k + 1) * OV.h) / (rows + 1); for (let x = OV.x0 + (k % 2 ? 0.35 : 0.7); x < OV.x1; x += 0.7) { if (x > 7.55 && x < 9.45 && z0 < 2.6) continue; iso.line(iso.p(x, OV.y1, z0), iso.p(x, OV.y1, z1), M.brick.right, 1.2, 0.7); } for (let y = OV.y0 + (k % 2 ? 0.35 : 0.7); y < OV.y1; y += 0.7) iso.line(iso.p(OV.x1, y, z0), iso.p(OV.x1, y, z1), "#6c3320", 1.2, 0.7); }
    },
  });
  I.push({ stage: 3, make: (iso, p) => dome(iso, 8.5, 1.6, OV.h, 2.0, 1.5, 1.5, M.brick, p) });
  // flue: from the dome's crown up the back wall and out through the cut
  box(3, 8.05, 0, 4.2, 8.95, 0.85, 11.6, M.brick, { light: undefined, detail: (iso, p) => { const n = Math.floor(16 * p); for (let k = 0; k < n; k++) { const z = 4.6 + k * 0.45; iso.line(iso.p(8.05, 0.85, z), iso.p(8.95, 0.85, z), M.brick.right, 1, 0.6); iso.line(iso.p(8.95, 0, z), iso.p(8.95, 0.85, z), "#6c3320", 1, 0.6); } } });
  // the mouth: an arch in the +y face, the fire inside it (the light)
  I.push({ stage: 3, make: (iso, p) => {
    const arch = archPts(iso, 8.5, OV.y1, 0.95, 0.95, 1.55), inner = archPts(iso, 8.5, OV.y1 - 0.01, 0.8, 1.05, 1.35);
    iso.make([{ pts: arch, fill: "#3a1d14" }], p, "#2a140e");
    if (p >= 1) iso.poly(inner, "#5a2616");
  }, light: (iso, p) => {
    if (p <= 0) return; // fire: floor of embers, flames, a boule baking at the back, all flat shapes
    const inner = archPts(iso, 8.5, OV.y1 - 0.01, 0.8, 1.05, 1.35); iso.ctx.save(); iso.ctx.beginPath(); inner.forEach(([x, y], i) => (i ? iso.ctx.lineTo(x, y) : iso.ctx.moveTo(x, y))); iso.ctx.clip();
    const b = iso.p(8.5, OV.y1, 1.05), s = iso.u;
    iso.poly([[b[0] - s * 0.9, b[1] + 4], [b[0] - s * 0.9, b[1] - s * 0.5 * p], [b[0] + s * 0.9, b[1] - s * 0.9 * p], [b[0] + s * 0.9, b[1] + 4]], EMBER);
    if (p > 0.3) { iso.poly([[b[0] + s * 0.05, b[1]], [b[0] + s * 0.35, b[1] - s * 1.3], [b[0] + s * 0.55, b[1] - s * 0.7], [b[0] + s * 0.75, b[1] - s * 1.55], [b[0] + s * 0.9, b[1]]], WARM); }
    if (p > 0.5) { iso.poly([[b[0] + s * 0.3, b[1]], [b[0] + s * 0.5, b[1] - s * 0.85], [b[0] + s * 0.7, b[1] - s * 0.3], [b[0] + s * 0.8, b[1]]], HOT); }
    if (p > 0.7) { const q = iso.p(8.1, OV.y1 - 0.6, 1.05); iso.ctx.fillStyle = "#7a3a1c"; iso.ctx.beginPath(); iso.ctx.ellipse(q[0], q[1], s * 0.38, s * 0.24, 0, Math.PI, 0); iso.ctx.fill(); iso.ctx.fillStyle = "#b8612a"; iso.ctx.beginPath(); iso.ctx.ellipse(q[0] + s * 0.06, q[1] - 1, s * 0.26, s * 0.16, 0, Math.PI, 0); iso.ctx.fill(); }
    if (p > 0.85) { iso.poly([[b[0] - s * 0.85, b[1] + 4], [b[0] - s * 0.85, b[1] - s * 0.18], [b[0] + s * 0.85, b[1] - s * 0.3], [b[0] + s * 0.85, b[1] + 4]], CORE); }
    iso.ctx.restore();
  } });
  box(3, 7.5, 3.2, 0.92, 9.5, 3.75, 1.07, M.stone);                     // hearth ledge

  // ---------- floor light and shadows: poured after the room is built, under everything on the floor
  I.push({ stage: 5, make: () => {}, light: (iso, p) => {
    if (p <= 0) return; // the glow on the floor: three flat bands, spreading from the mouth as they're laid
    const c: [number, number] = [8.5, 3.75]; const bands: [number, number, string][] = [[5.2, 0.13, WARM], [3.6, 0.16, WARM], [2.2, 0.2, HOT]];
    iso.ctx.save(); iso.ctx.beginPath(); [[0, 0], [12, 0], [12, 10], [0, 10]].forEach(([x, y], i) => { const q = iso.p(x, y, 0); if (i) iso.ctx.lineTo(q[0], q[1]); else iso.ctx.moveTo(q[0], q[1]); }); iso.ctx.clip();
    bands.forEach(([r, a, col], k) => { const t = clamp01(p * 3 - k * 0.6); if (t <= 0) return; const pts: [number, number, number][] = []; for (let i = 0; i <= 24; i++) { const th = (i / 24) * Math.PI; pts.push([c[0] + Math.cos(th) * r * t, c[1] + Math.sin(th) * r * 0.85 * t, 0]); } iso.face(pts, col, a); });
    // cast shadows thrown away from the mouth: the baker's, the table's, the rack's (flat, crisp)
    const sh = (pts: [number, number][], a: number) => { if (p < 0.5) return; iso.face(pts.map(([x, y]) => [x, y, 0] as [number, number, number]), "#1a1420", a * clamp01((p - 0.5) * 2)); };
    sh([[7.85, 5.1], [8.5, 4.85], [8.6, 7.4], [8.0, 8.1], [7.5, 7.5]], 0.34);                    // the baker
    sh([[4.9, 7.6], [7.7, 7.6], [7.9, 9.8], [4.3, 10]], 0.3);                                   // under/behind the table
    iso.ctx.restore();
  } });

  // ---------- table with dough
  I.push({ stage: 3, make: (iso, p) => {
    const legs = [[4.95, 5.85], [7.45, 5.85], [4.95, 7.35], [7.45, 7.35]].map(([x, y]) => iso.boxFaces(x, y, 0, x + 0.22, y + 0.22, 1.75, M.wood));
    legs.forEach((l, k) => iso.make(l, clamp01(p * 5 - k), M.wood.right));
    iso.make(iso.boxFaces(4.9, 5.8, 1.75, 7.7, 7.6, 1.95, { ...M.wood, top: "#c99a68" }), clamp01(p * 5 - 4), M.wood.right);
  }, light: (iso, p) => { if (p > 0) iso.face([[7.7, 5.8, 1.75], [7.7, 7.6, 1.75], [7.7, 7.6, 1.95], [7.7, 5.8, 1.95]], WARM, 0.35 * p); }, detail: (iso, p) => {
    if (p <= 0) return; const r = rngLite(3), n = Math.floor(40 * p); // flour dusted across the top
    for (let k = 0; k < n; k++) { const x = 5.1 + r() * 2.4, y = 6.0 + r() * 1.4; iso.face([[x, y, 1.951], [x + 0.12, y, 1.951], [x + 0.12, y + 0.12, 1.951], [x, y + 0.12, 1.951]], "#f1e7d2", 0.8); }
  } });
  I.push({ stage: 4, make: (iso, p) => { // dough balls and a rolling pin
    [[5.5, 6.3], [6.1, 6.25], [5.6, 6.95], [6.25, 6.9]].forEach(([x, y], k) => { if (clamp01(p * 5 - k) > 0) dough(iso, x, y, 1.95, 0.27); });
    if (p > 0.8) iso.make(iso.boxFaces(6.8, 6.1, 1.95, 7.02, 7.3, 2.15, { top: "#d7ae7c", left: "#b88d5c", right: "#9a7248" }), clamp01((p - 0.8) * 5), "#9a7248");
  } });
  // ---------- ladder to the loft
  I.push({ stage: 3, make: (iso, p) => {
    const rail = (y: number) => [iso.p(6.1, y, 0), iso.p(6.1, y + 0.12, 0), iso.p(4.62, y + 0.12, 6.4), iso.p(4.62, y, 6.4)];
    iso.make([{ pts: rail(8.55), fill: M.wood.left }], clamp01(p * 3), M.wood.right);
    for (let k = 1; k <= 8; k++) { const t = k / 9; if (clamp01(p * 3 - 1 - t) <= 0) continue; const x = 6.1 - 1.48 * t, z = 6.4 * t; iso.make(iso.boxFaces(x - 0.05, 8.6, z - 0.05, x + 0.05, 9.28, z + 0.05, M.wood), 1, M.wood.right); }
    iso.make([{ pts: rail(9.28), fill: M.wood.top }], clamp01(p * 3 - 2), M.wood.right);
  } });
  // ---------- a basket of baguettes standing in the light, waiting for the shop to open
  I.push({ stage: 4, make: (iso, p) => {
    if (p <= 0) return; const bx = 10.9, by = 8.9, r = 0.55, hB = 0.9;
    const W: Mat = { top: "#8a6a44", left: "#b58a57", right: "#94703f" };
    iso.make(iso.boxFaces(bx - r, by - r, 0, bx + r, by + r, hB, W), clamp01(p * 2), W.right);
    const sticks: [number, number, number][] = [[-0.25, -0.2, 0.2], [0.1, -0.3, -0.15], [0.25, 0.1, 0.1], [-0.1, 0.25, -0.2], [0.0, 0.0, 0.05]];
    sticks.forEach(([dx, dy, lean], k) => { if (clamp01(p * 2 - 1 - k * 0.15) <= 0) return; const a = iso.p(bx + dx, by + dy, hB - 0.2), b = iso.p(bx + dx + lean, by + dy - lean * 0.5, hB + 1.9); const w = iso.u * 0.17;
      iso.poly([[a[0] - w, a[1]], [b[0] - w, b[1]], [b[0] + w, b[1]], [a[0] + w, a[1]]], M.crust.left); iso.poly([[a[0], a[1]], [b[0], b[1]], [b[0] + w, b[1]], [a[0] + w, a[1]]], M.crust.right);
      iso.ctx.fillStyle = M.crust.top; iso.ctx.beginPath(); iso.ctx.ellipse(b[0], b[1], w, w * 0.6, 0, 0, Math.PI * 2); iso.ctx.fill();
      for (let c = 1; c <= 3; c++) { const t = c / 4.2; iso.line([a[0] + (b[0] - a[0]) * t - w * 0.7, a[1] + (b[1] - a[1]) * t + 2], [a[0] + (b[0] - a[0]) * t + w * 0.2, a[1] + (b[1] - a[1]) * t - 3], "#f2d19a", 1.2); } });
    iso.face([[bx - r, by + r, hB * 0.45], [bx + r, by + r, hB * 0.45], [bx + r, by + r, hB * 0.55], [bx - r, by + r, hB * 0.55]], "#7d5c36"); // woven band
  }, light: (iso, p) => { if (p > 0) warmBox(iso, 10.35, 8.35, 0, 11.45, 9.45, 0.9, p); } });
  // ---------- the baker, last: nearest the camera of everything he overlaps
  I.push({ stage: 4, make: (iso, p) => baker(iso, 8.2, 5.0, p, 0), light: (iso, p) => { if (p > 0) baker(iso, 8.2, 5.0, 1, p); } });
  return I;
};

// ---------------------------------------------------------------- props
const rngLite = (seed: number) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const archPts = (iso: Iso, cx: number, y: number, hw: number, z0: number, zSpring: number): P2[] => {
  const pts: P2[] = [iso.p(cx - hw, y, z0), iso.p(cx + hw, y, z0)];
  for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI; pts.push(iso.p(cx + Math.cos(a) * hw, y, zSpring + Math.sin(a) * hw * 0.8)); }
  return pts;
};
// A dome under the cube rule: the half turned to +x in the right tone, the half turned to +y in
// the left tone (the meridian between them projects to a vertical line through the crown), and
// the cap that faces up in the top tone. Three flat planes, one silhouette.
const dome = (iso: Iso, cx: number, cy: number, z0: number, rx: number, ry: number, rz: number, m: Mat, p: number) => {
  if (p <= 0) return; const ctx = iso.ctx, ring = (e: number, n = 48) => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return iso.p(cx + Math.cos(a) * Math.cos(e) * rx, cy + Math.sin(a) * Math.cos(e) * ry, z0 + Math.sin(e) * rz); });
  const pts: P2[] = []; for (let j = 0; j <= 12; j++) pts.push(...ring((j / 12) * (Math.PI / 2), 36));
  const hull = convexHull(pts), ys = hull.map((q) => q[1]), y0 = Math.min(...ys), y1 = Math.max(...ys), mid = iso.p(cx, cy, z0)[0];
  ctx.save(); if (p < 1) { ctx.beginPath(); ctx.rect(-1e4, y1 - (y1 - y0 + 2) * p, 2e4, 1e4); ctx.clip(); }
  iso.poly(hull, m.left);
  ctx.save(); ctx.beginPath(); ctx.rect(mid, -1e4, 1e4, 2e4); ctx.clip(); iso.poly(hull, m.right); ctx.restore();
  const cap = ring(0.95); ctx.save(); ctx.beginPath(); hull.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.clip();
  const capHull = convexHull([...cap, ...ring(1.25, 24), iso.p(cx, cy, z0 + rz)]); iso.poly(capHull, m.top); ctx.restore();
  ctx.restore();
};
const convexHull = (pts: P2[]): P2[] => {
  const q = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o: P2, a: P2, b: P2) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: P2[] = [], up: P2[] = [];
  for (const p of q) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = q.length - 1; i >= 0; i--) { const p = q[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
};
// Flat warm light on a box: the +x face and the top take one tint each if they can see the
// mouth, stepped by distance (three bands), never a gradient.
const MOUTH: [number, number, number] = [8.5, 3.6, 1.7];
const warmStep = (d: number) => (d < 3.5 ? 0.4 : d < 5.5 ? 0.27 : d < 8.5 ? 0.15 : 0);
const warmBox = (iso: Iso, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, p: number) => {
  if (p <= 0) return; const [lx, ly, lz] = MOUTH;
  const cx = (y0 + y1) / 2 > ly - 0.4 && x1 < lx ? warmStep(Math.hypot(lx - x1, ly - (y0 + y1) / 2, lz - (z0 + z1) / 2)) : 0;
  if (cx > 0) iso.face([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], WARM, cx * p);
  const ct = (y0 + y1) / 2 > ly - 0.4 && z1 < lz + 0.6 ? warmStep(Math.hypot(lx - (x0 + x1) / 2, ly - (y0 + y1) / 2, lz - z1)) : 0;
  if (ct > 0) iso.face([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], WARM, ct * p);
};
const loaf = (iso: Iso, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => {
  const m = M.crust; iso.make(iso.boxFaces(x0, y0, z0, x1, y1, z1 - 0.08, m), 1, m.right);
  iso.face([[x0 + 0.05, y0 + 0.04, z1 - 0.08], [x1 - 0.05, y0 + 0.04, z1 - 0.08], [x1 - 0.1, y1 - 0.04, z1], [x0 + 0.1, y1 - 0.04, z1]], m.top);
  for (let k = 1; k <= 3; k++) { const x = x0 + ((x1 - x0) * k) / 4; iso.line(iso.p(x - 0.08, y0 + 0.1, z1), iso.p(x + 0.08, y1 - 0.1, z1), "#f2d19a", 1.3); } // scoring cuts
};
const boule = (iso: Iso, x: number, y: number, z: number, r: number) => {
  const c = iso.p(x, y, z), u = iso.u; const ctx = iso.ctx;
  ctx.fillStyle = M.crust.right; ctx.beginPath(); ctx.ellipse(c[0], c[1] - r * u * 0.45, r * u * 1.35, r * u * 0.95, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = M.crust.left; ctx.beginPath(); ctx.ellipse(c[0] - r * u * 0.25, c[1] - r * u * 0.55, r * u * 1.05, r * u * 0.8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = M.crust.top; ctx.beginPath(); ctx.ellipse(c[0] - r * u * 0.1, c[1] - r * u * 0.85, r * u * 0.85, r * u * 0.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#f2d19a"; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(c[0] - r * u * 0.55, c[1] - r * u * 0.85); ctx.lineTo(c[0] + r * u * 0.35, c[1] - r * u * 0.85); ctx.stroke();
};
const dough = (iso: Iso, x: number, y: number, z: number, r: number) => {
  const c = iso.p(x, y, z), u = iso.u, ctx = iso.ctx;
  ctx.fillStyle = "#d9cbb0"; ctx.beginPath(); ctx.ellipse(c[0], c[1] - r * u * 0.3, r * u * 1.3, r * u * 0.72, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#f1e6cf"; ctx.beginPath(); ctx.ellipse(c[0] - r * u * 0.15, c[1] - r * u * 0.45, r * u * 0.95, r * u * 0.5, 0, 0, Math.PI * 2); ctx.fill();
};
const sack = (iso: Iso, x: number, y: number, z: number, p: number) => {
  if (p <= 0) return; const m = M.sack, w = 0.55, d = 0.75, h = 1.05;
  iso.make(iso.boxFaces(x - w, y - d, z, x + w, y + d, z + h * 0.8, m), p, m.right);
  if (p < 1) return;
  iso.face([[x - w, y - d, z + h * 0.8], [x + w, y - d, z + h * 0.8], [x + w * 0.6, y - d * 0.3, z + h], [x - w * 0.6, y - d * 0.3, z + h]], m.top);
  iso.face([[x - w, y + d, z + h * 0.8], [x + w, y + d, z + h * 0.8], [x + w * 0.6, y + d * 0.3, z + h], [x - w * 0.6, y + d * 0.3, z + h]], m.top);
  iso.face([[x - w * 0.6, y - d * 0.3, z + h], [x + w * 0.6, y - d * 0.3, z + h], [x + w * 0.6, y + d * 0.3, z + h], [x - w * 0.6, y + d * 0.3, z + h]], "#efe2c4");
  iso.line(iso.p(x + w, y - d * 0.2, z + h * 0.35), iso.p(x + w, y + d * 0.2, z + h * 0.35), "#8f7d58", 2);             // stencil band
};

// ---------------------------------------------------------------- the baker
// Screen-space figure over his foot point, authored at u = 36 facing +x-local and MIRRORED, so he
// faces screen lower-left (world +y) toward the table. 7.5 heads: head 21 px, chin at 1 head,
// shoulders ~1.4, elbows ~3, wrists and crotch ~4, knees ~5.6, soles at 7.5. Weight on both feet,
// the near foot a little forward. The oven is behind him (screen upper right), so his BACK edge
// (local -x) takes the warm light; his front sits in the cool night ambient.
const baker = (iso: Iso, x: number, y: number, p: number, lit: number) => {
  const f = iso.p(x, y, 0), k = iso.u / 36, ctx = iso.ctx;
  const S = (pts: P2[]): P2[] => pts.map(([a, b]) => [f[0] - a * k, f[1] + b * k]);
  const shape = (pts: P2[], col: string, a = 1) => iso.poly(S(pts), col, a);
  const ell = (cx: number, cy: number, rx: number, ry: number, col: string) => { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(f[0] - cx * k, f[1] + cy * k, rx * k, ry * k, 0, 0, Math.PI * 2); ctx.fill(); };
  ctx.save();
  if (p < 1) { ctx.beginPath(); ctx.rect(-1e4, f[1] - 185 * k, 2e4, 190 * k * p); ctx.clip(); } // painted top down, as a figure is filled
  const skin = "#c98d6c", skinD = "#9a654e", white = "#d9d6d2", whiteD = "#a9a9b6", whiteDD = "#8c8c9c", apron = "#e4e0d8", trou = "#384058", trouD = "#282d40", shoe = "#241c1c", hair = "#3f2c22", wood = "#a27a50", woodD = "#7a5a3a";
  if (!lit) {
    // far leg (his left, behind) and shoe; then the near leg, foot turned out a little
    shape([[-9, -76], [1, -76], [0, -42], [-1, -9], [-8, -9], [-10, -42]], trouD);
    shape([[-10, -9], [-1, -9], [8, -4], [9, 0], [-10, 0]], shoe);
    shape([[-1, -78], [11, -76], [10, -42], [9, -6], [1, -6], [0, -42]], trou);
    shape([[0, -6], [9, -6], [19, -1], [20, 3], [0, 3]], shoe);
    // chef's jacket: back half in shade, front half lighter, 3/4 so the near side is wider
    shape([[-14, -127], [15, -129], [18, -110], [16, -78], [-12, -76], [-16, -102]], whiteD);
    shape([[-5, -128], [15, -129], [18, -110], [16, -78], [-2, -77], [-3, -102]], white);
    // apron: bib to knees, the near edge swinging forward with the turn
    shape([[-7, -115], [9, -116], [10, -96], [16, -47], [-9, -45], [-7, -96]], apron);
    shape([[-7, -115], [-2, -115], [-3, -96], [-3, -45], [-9, -45], [-7, -96]], whiteD);
    shape([[-13, -97], [16, -98], [16, -94], [-13, -93]], whiteDD);                             // waist tie
    ell(12, -121, 1.3, 1.3, whiteDD); ell(12, -111, 1.3, 1.3, whiteDD);                        // jacket buttons above the bib
    // neck, head three-quarter toward the table, hair, ear, nose
    shape([[-3, -130], [5, -130], [5, -136], [-3, -136]], skinD);
    shape([[-8, -140], [-6, -153], [3, -157], [10, -152], [12, -145], [11, -139], [7, -134], [0, -133], [-6, -135]], skin);
    shape([[-8, -140], [-6, -153], [-1, -156], [-2, -146], [-4, -135]], skinD);
    shape([[11, -146], [14.5, -142.5], [11.5, -140.5]], skinD);                                // nose
    shape([[4, -148], [7, -148], [7, -146.6], [4, -146.6]], "#3a2a24");                       // eye (brow shadow)
    shape([[5, -138], [9, -138.4], [8.6, -137.2], [5, -136.9]], skinD);                       // mouth
    shape([[-9, -144], [-7, -155], [2, -158], [4, -154], [-3, -151], [-5, -142]], hair);
    shape([[-1, -146], [2, -146], [2, -141], [-1, -141]], skinD);                              // ear
    // toque: band, then the pleated puff, its turned side in shade
    shape([[-8, -153], [10, -155], [10, -161], [-8, -159]], white);
    shape([[-12, -160], [-9, -175], [1, -181], [12, -175], [14, -161], [10, -160], [-8, -158]], apron);
    shape([[-12, -160], [-9, -175], [-4, -178], [-4, -159]], whiteD);
    [[-1, -178], [5, -178]].forEach(([a, b]) => shape([[a, b], [a + 1.2, b], [a + 1.6, -161], [a + 0.4, -161]], whiteD));  // pleats
    // far arm: forearm reaching forward under the handle
    shape([[-11, -124], [-4, -124], [5, -100], [16, -93], [14, -87], [-1, -94], [-13, -106]], whiteD);
    shape([[14, -94], [21, -91], [21, -85], [14, -87]], skinD);
    // the peel: handle from behind his hip out past his hands, blade forward and flat (a 2:1 plane)
    shape([[-24, -104], [80, -52], [79, -48], [-25, -100]], wood);
    shape([[70, -58], [104, -41], [86, -32], [52, -49]], "#b58e62");
    shape([[52, -49], [86, -32], [86, -29], [52, -46]], woodD);
    // the boule on the blade, cube-rule tones like every other loaf
    ell(78, -48, 13, 8.5, M.crust.right); ell(76, -50, 11, 7, M.crust.left); ell(77, -53, 8, 4.5, M.crust.top);
    iso.line([f[0] - 72 * k, f[1] - 53 * k], [f[0] - 82 * k, f[1] - 53 * k], "#f2d19a", 1.3 * k);
    // near arm: shoulder, elbow bent at the hip, forearm forward, hand closed round the handle
    shape([[8, -128], [18, -125], [19, -106], [30, -86], [26, -80], [11, -100], [9, -112]], white);
    shape([[26, -84], [34, -80], [35, -75], [30, -72], [25, -76]], skin);
    shape([[27, -78], [34, -76], [33, -73], [28, -74]], skinD);                                  // fingers wrapped under the handle
    shape([[31, -83], [34.5, -82], [34, -80], [31, -80.5]], skinD);                             // thumb over the top
  } else {
    // the oven behind him: a flat warm edge down every surface that faces it (his back)
    const a = 0.9 * lit, L = "#ffcf94";
    shape([[-14, -127], [-10, -127], [-12, -102], [-9, -77], [-12, -76], [-16, -102]], L, a);   // jacket back
    shape([[-11, -124], [-8, -124], [-10, -107], [-13, -106]], L, a * 0.8);                       // far arm back
    shape([[-9, -144], [-7, -155], [-5, -156], [-7, -145]], "#e0a070", a);                        // back of the hair
    shape([[-12, -160], [-9, -175], [-6, -177], [-9, -160]], "#ffe0b0", a);                      // toque
    shape([[-9, -76], [-7, -76], [-8, -42], [-7, -9], [-9, -9], [-10, -42]], "#5a5462", a);        // back of the far leg
    shape([[-9, -45], [-7, -45], [-6, -96], [-7, -96]], "#ffe0b0", a * 0.7);                      // apron edge
    shape([[-24, -104], [-10, -97], [-10, -95], [-25, -100]], "#d9a870", a);                      // handle end
  }
  ctx.restore();
};

// ---------------------------------------------------------------- timeline + render
const STAGES = [[4, 40], [40, 100], [100, 170], [170, 250], [250, 330], [330, 390], [390, 450]]; // grid, massing, walls, interiors, props, light, details
export const isometric: Film = {
  meta: { title: "Isometric · the night bake", W: 1080, H: 1080, fps: 30, bpm: 120, durationFrames: N },
  assets: { images: {} },
  shots: [{ id: "bake", start: 0, end: N, draw: (ctx: Ctx, fr, env) => {
    const W = env.W, H = env.H, u = Math.min(W, H) / 29.5, iso = new Iso(ctx, u, W / 2 - 1.0 * u, H / 2 + 2.3 * u);
    const f = fr >= N - HOLD ? N : fr;
    ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
    // 0: the iso grid, lines ruled one after another across the ground plane
    { const p = span(f, STAGES[0][0], STAGES[0][1]), n = 46, R = 23; for (let k = 0; k < n; k++) { const t = clamp01(p * n * 0.5 - k * 0.5); if (t <= 0) break; const i = k >> 1, d = (k & 1) ? 1 : 0, c = i - R + 5; const a = d ? iso.p(c, -R + 5, -0.6) : iso.p(-R + 5, c, -0.6), b = d ? iso.p(c, R + 5, -0.6) : iso.p(R + 5, c, -0.6); iso.line(a, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], GRID, 1); } }
    // 1: massing blocks, construction lines of the big solids
    { const p = span(f, STAGES[1][0], STAGES[1][1]); const blocks: [number, number, number, number, number, number][] = [[-0.6, -0.6, -0.6, 12, 10, 0], [-0.6, -0.6, 0, 12, 0, 11], [-0.6, 0, 0, 0, 10, 11], [6.4, 0, 0, 10.6, 3.2, 3.0], [0, 0, 5.8, 4.6, 10, 6.3], [4.9, 5.8, 1.75, 7.7, 7.6, 1.95]];
      blocks.forEach((b, k) => { const t = clamp01(p * blocks.length - k * 0.8); if (t <= 0) return; const fs = iso.boxFaces(...b, { top: MASS, left: MASS, right: MASS }); ctx.globalAlpha = 0.22; fs.forEach((q) => iso.poly(q.pts, MASS, 0.18 * clamp01(t * 3))); ctx.globalAlpha = 1; fs.forEach((q) => { ctx.save(); ctx.beginPath(); q.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.clip(); const L = q.pts.length; for (let i = 0; i < L; i++) { const tt = clamp01(t * L - i); if (tt > 0) { const a = q.pts[i], c = q.pts[(i + 1) % L]; iso.line(a, [a[0] + (c[0] - a[0]) * tt, a[1] + (c[1] - a[1]) * tt], MASS, 2.4); } } ctx.restore(); }); }); }
    // 2..6: every item in painter's order, each at its own progress in its stage
    const items = cachedScene(env), byStage = [0, 0, 0, 0, 0, 0, 0], idx = new Map<Item, number>();
    items.forEach((it) => idx.set(it, byStage[it.stage]++));
    const lightItems = items.filter((it) => it.light), detItems = items.filter((it) => it.detail);
    const prog = (st: number, k: number, n: number) => { const [a, b] = STAGES[st], L = b - a, w = Math.min(L, (L / n) * 2.2); return span(f, a + ((L - w) * k) / Math.max(1, n - 1), a + ((L - w) * k) / Math.max(1, n - 1) + w); };
    items.forEach((it) => {
      it.make(iso, prog(it.stage, idx.get(it)!, byStage[it.stage]));
      if (it.light) it.light(iso, prog(5, lightItems.indexOf(it), lightItems.length));
      if (it.detail) it.detail(iso, prog(6, detItems.indexOf(it), detItems.length));
    });
  } }],
};
const cachedScene = (env: { cache: Map<string, unknown> }) => { let s = env.cache.get("isometric/scene") as Item[] | undefined; if (!s) { s = scene(); env.cache.set("isometric/scene", s); } return s; };

export const STYLE = { id: "isometric", name: "Isometric cutaway", family: "digital", medium: "flat vector planes on a true 2:1 isometric grid, three tones per material, crisp edges, pen-tool order", nearest: "koi", hero: "a two-floor bakery cutaway at night, lit by its oven, the baker turning with a fresh loaf" };
