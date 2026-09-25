// COLOURED-PENCIL HAND for any character Scene (colouredPencil.ts's recipe, through its kit). A
// sheet of passes: a light lay-in, a local-colour pass hatched on one diagonal per form, a shade
// pass cross-hatched in the shadow colour on the side turned from the light, darks pressed hard,
// and a contour in dark pencil as a chain of overlapping strokes. Every pass is bitten by the
// paper's tooth (wax only lands on the ridges), so the cream shows through the colour.
import { type Env, type Gfx, type P, sample } from "../../core";
import { limb } from "../../pixelArtKit";
import { Sheet, contour, dot, hatch, layLine, minus, poly, union, type Mark, type Region } from "../../colouredPencilKit";
import { runLength } from "../shape2d";
import type { Scene } from "../types";
import type { Palette } from "./storybook";
import { contourRuns, hashId, occlude, occluders } from "./storybook";

const PAPER = "#f4eddc", LEAD = "#3a2f3d";
const fillMark = (c: CanvasRenderingContext2D, m: Mark) => { c.globalAlpha = m.a; c.fillStyle = m.col; c.beginPath(); c.moveTo(m.poly[0], m.poly[1]); for (let i = 2; i < m.poly.length; i += 2) c.lineTo(m.poly[i], m.poly[i + 1]); c.closePath(); c.fill(); };

export const pencilSheet = (scene: Scene, pal: Palette, o: { horizon: number; W: number; ground?: string } = { horizon: 0, W: 0 }) => {
  const S = new Sheet(), L = scene.light, byId = new Map(scene.parts.map((p) => [p.id, p])), covOf = new Map(scene.parts.map((p, i) => [p.id, occluders(scene, i)]));
  S.pass("ground", 0);
  if (o.ground) hatch(S, poly([[0, o.horizon], [o.W, o.horizon], [o.W, o.horizon + 400], [0, o.horizon + 400]]), { ang: -0.12, gap: 4.5, len: 60, w: 1.4, col: o.ground, a: 0.35, seed: 3, dens: (_x, y) => Math.max(0, 1 - (y - o.horizon) / 380) });
  if (scene.ground?.shadow.length) hatch(S, poly(scene.ground.shadow), { ang: -0.2, gap: 2.4, len: 30, w: 1.5, col: "#7a6a86", a: 0.55, seed: 5 });
  S.pass("layin", 0); S.pass("local", 1); S.pass("shade", 1); S.pass("dark", 2); S.pass("line", 2);
  // the gesture first: long, light, running lines through the pose, overshooting their ends the way a lay-in does
  S.into("layin"); (scene.gesture ?? []).forEach((pl, gi) => pl.forEach((pt, i) => { if (i) layLine(S, pl[i - 1], pt, "#9a8f9e", 300 + gi * 31 + i, 1.1, 0.5); }));
  // what is covered later is not coloured twice: each part's region minus the regions painted over it
  const regs = scene.parts.map((p) => (p.fill === false || !p.polys.length ? null : union(...p.polys.map((q) => poly(q)))));
  scene.parts.forEach((part, i) => {
    const reg0 = regs[i]; if (!reg0) return;
    const above = regs.slice(i + 1).filter((r): r is Region => !!r), reg = above.length ? minus(reg0, ...above) : reg0, sw = pal[part.role]; if (!sw) return;
    const seed = hashId(part.id), k = part.size, shifted = union(...part.polys.map((q) => poly(q.map(([x, y]) => [x + L[0] * k * 0.32, y + L[1] * k * 0.32] as P))));
    const shadeReg = minus(reg, shifted), ang = -0.95 + ((seed % 7) - 3) * 0.04;
    // local colour in TWO layers at crossing angles, pressed firmly: wax on the tooth needs layering to read as colour
    S.into("local"); hatch(S, reg, { ang, gap: Math.max(1.4, Math.min(2.6, k * 0.055)), len: Math.max(10, Math.min(34, k * 0.8)), w: 1.7, col: sw.base, a: 0.92, seed }); hatch(S, reg, { ang: ang + 0.35, gap: Math.max(1.8, Math.min(3.2, k * 0.07)), len: Math.max(10, Math.min(30, k * 0.7)), w: 1.6, col: sw.base, a: 0.7, seed: seed + 5 });
    S.into("shade"); hatch(S, shadeReg, { ang: ang + 0.75, gap: Math.max(1.6, Math.min(3, k * 0.06)), len: Math.max(8, Math.min(26, k * 0.6)), w: 1.4, col: sw.shade, a: 0.6, seed: seed + 1 });
    S.into("dark"); hatch(S, shadeReg, { ang: ang + 1.5, gap: 5, len: 12, w: 1.2, col: sw.shade, a: 0.35, seed: seed + 2, dens: () => 0.6 });
  });
  scene.parts.forEach((part) => {
    const seed = hashId(part.id), k = part.size;
    S.into("layin"); if (part.outline !== false) contourRuns(part, byId, 3).forEach((run, i) => { if (runLength(run) > 8) contour(S, run.map(([x, y]) => [x + 1.5, y - 1] as P), { w: 0.9, col: "#8a8090", a: 0.35, seed: seed + 90 + i, seg: 90 }); });
    S.into("line"); if (part.outline !== false) contourRuns(part, byId, 2).flatMap((r) => occlude(r, covOf.get(part.id)!)).forEach((run, i) => { if (runLength(run) > 4) contour(S, run, { w: Math.max(1.3, Math.min(2.8, 1.1 + k * 0.035)), col: LEAD, a: 0.95, seed: seed + i, seg: 50 }); });
    part.marks.forEach((m, i) => {
      if (m.kind === "line" && m.w > 4 && m.role !== "line") occlude(m.pts, covOf.get(part.id)!).forEach((pts, j) => { const band = limb(sample(pts, false, 4) as [number, number][], m.w / 2, m.w / 2) as P[]; hatch(S, poly(band), { ang: 0.4, gap: 1.2, len: 10, w: 1.3, col: pal[m.role]?.base ?? LEAD, a: 0.9, seed: seed + 70 + i + j }); contour(S, band, { w: 0.9, col: pal[m.role]?.shade ?? LEAD, a: 0.7, seed: seed + 80 + i + j, seg: 40, closed: true }); });   // a strap is a BAND: hatched, edged, never a string of tapered strokes
      else if (m.kind === "line" && m.role !== "white" && (m.alpha ?? 1) > 0.25) occlude(m.pts, covOf.get(part.id)!).forEach((pts) => contour(S, pts, { w: Math.max(0.9, m.w * 0.9), col: m.role === "line" ? LEAD : (pal[m.role]?.shade ?? LEAD), a: 0.85 * (m.alpha ?? 1), seed: seed + 40 + i, seg: 30, smooth: pts.length > 2 }));
      else if (m.kind === "fill") hatch(S, poly(m.pts), { ang: 0.6, gap: 1.1, len: 8, w: 1.3, col: m.role === "white" ? "#fffdf6" : (pal[m.role]?.base ?? LEAD), a: 0.9 * (m.alpha ?? 1), seed: seed + 60 + i, over: 0.2 });
      else if (m.kind === "dot" && m.role !== "white") dot(S, m.at[0], m.at[1], Math.max(0.8, Math.min(m.rx, m.ry)), pal[m.role]?.base ?? LEAD, 0.8 * (m.alpha ?? 1), 1.2);
    });
  });
  return S;
};

export const renderPencil = (g: Gfx, env: Env, scene: Scene, pal: Palette, o: { horizon: number; ground?: string; only?: string[] }) => {
  const W = env.W, H = env.H, S = pencilSheet(scene, pal, { horizon: o.horizon, W, ground: o.ground });
  g.group("plain", () => { const c = g.cur; g.touch(0, 0, W, H); c.fillStyle = PAPER; c.fillRect(0, 0, W, H); });
  for (const p of S.passes.filter((q) => !o.only || o.only.includes(q.id))) g.group("plain", () => { const c = g.cur; g.touch(0, 0, W, H); p.marks.forEach((m) => fillMark(c, m)); c.globalAlpha = 1; }, { textures: [p.tooth === 2 ? "draftTooth" : "pencilTooth"] });
  // highlights lifted out with an eraser: the eye glints, back to paper
  g.group("plain", () => { const c = g.cur; g.touch(0, 0, W, H); for (const part of scene.parts) for (const m of part.marks) if (m.kind === "dot" && m.role === "white") { c.fillStyle = "#fffaf0"; c.beginPath(); c.ellipse(m.at[0], m.at[1], m.rx, m.ry, 0, 0, Math.PI * 2); c.fill(); } });
  g.paper("paper", 0.1);
  return S;
};
