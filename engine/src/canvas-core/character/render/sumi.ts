// SUMI-E HAND for any character Scene (sumiE.ts's recipe, with light colour: the Chinese
// "ink and light colour" tradition). Pale colour washes laid first, soft, bleeding a little into
// the xuan paper; then the contour as BRUSH strokes: one loaded brush of real hairs per stroke,
// pressing in, running dry, lifting (sumiEKit.brush); the hair is one wet mass of scorched ink; the
// features are fine brush lines; the glasses in vermilion, the one strong colour; a red seal.
import { type Env, type Gfx, type P, rng } from "../../core";
import { brush, INK_BLACK, JIAO, NONG, ZHONG, DAN } from "../../sumiEKit";
import { runLength, thin } from "../shape2d";
import type { Scene } from "../types";
import { contourRuns, hashId, occlude, occluders } from "./storybook";
import { mix } from "../../gallery";

const XUAN = "#f1eadb", CINNABAR = "#c8412c";
const path = (c: CanvasRenderingContext2D, polys: P[][]) => { c.beginPath(); polys.forEach((s) => { s.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); }); };

export const renderSumi = (g: Gfx, env: Env, scene: Scene, wash: Record<string, [string, number]>, o: { horizon: number; inkRoles?: string[] }) => {
  const W = env.W, H = env.H, byId = new Map(scene.parts.map((p) => [p.id, p])), inkRoles = new Set(o.inkRoles ?? ["hair"]), covOf = new Map(scene.parts.map((p, i) => [p.id, occluders(scene, i)]));
  g.group("plain", () => { const c = g.cur; g.touch(0, 0, W, H); c.fillStyle = XUAN; c.fillRect(0, 0, W, H); });
  // the ground: three dry, broken horizontal strokes of pale ink
  const r = rng(3);
  [0, 1, 2].forEach((i) => brush(g, { ctrl: [[W * (0.08 + r() * 0.1), o.horizon + 30 + i * 26], [W * 0.5, o.horizon + 26 + i * 26 + (r() - 0.5) * 6], [W * (0.84 + r() * 0.1), o.horizon + 32 + i * 26]], w: 16 - i * 3, press: [[0, 0.3], [0.2, 0.9], [0.8, 0.7], [1, 0.1]], ink: DAN - i * 0.06, dry: 0.9, split: 0.9, bleed: 0.2, streak: true, seed: 900 + i }));
  // colour first, pale and soft. A painter leaves paper where a near form covers a far one, so each
  // wash is laid OPAQUE as that colour thinned into the paper (never multiplied over what is behind)
  g.group("plain", () => {
    const c = g.cur; g.touch(0, 0, W, H);
    for (const part of scene.parts) {
      if (part.fill === false || !part.polys.length) continue;
      if (inkRoles.has(part.role)) { c.globalAlpha = 1; c.fillStyle = mix("#f1eadb", INK_BLACK, 0.9); path(c, part.polys); c.fill("nonzero"); continue; }
      const w = wash[part.role]; c.globalAlpha = 1; c.fillStyle = w ? mix("#f1eadb", w[0], w[1]) : "#f1eadb"; path(c, part.polys); c.fill("nonzero");
    }
    c.globalAlpha = 1;
  }, { blend: "multiply", blur: 1.4 });
  // the brush: every contour run a stroke, heavier on the big masses, lighter ink on small ones
  for (const part of scene.parts) {
    const seed = hashId(part.id), k = part.size;
    if (part.outline !== false && !inkRoles.has(part.role)) contourRuns(part, byId, 2).flatMap((r) => occlude(r, covOf.get(part.id)!)).forEach((run, i) => {
      if (runLength(run) < 6) return;
      brush(g, { ctrl: thin(run, Math.max(2, Math.round(run.length / 9))), w: Math.max(2.2, Math.min(7.5, 1.4 + k * 0.1)), press: [[0, 0.25], [0.12, 0.95], [0.7, 0.75], [1, 0.12]], ink: k > 40 ? NONG : ZHONG, load: 0.95, dry: 0.35, split: 0.6, bleed: 0.35, slow: [[0.02, 0.6]], seed: seed + i * 3 });
    });
    part.marks.forEach((m, i) => {
      if (m.kind === "line" && m.role !== "white" && (m.alpha ?? 1) > 0.3) occlude(m.pts, covOf.get(part.id)!).forEach((pts) => brush(g, { ctrl: pts.length > 2 ? pts : [pts[0], [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2], pts[1]], w: Math.max(1.2, m.w * 1.1), press: [[0, 0.4], [0.3, 1], [1, 0.3]], ink: m.role === "glasses" ? JIAO : m.role === "hair" ? JIAO : ZHONG, dry: 0.1, bleed: 0.15, hairs: 10, seed: seed + 60 + i }));
    });
    // the glasses and the pupils again in colour over the ink: vermilion rims, scorched-ink pupils
    g.group("plain", () => {
      const c = g.cur; g.touch(0, 0, W, H);
      part.marks.forEach((m) => {
        if (m.kind === "line" && m.role === "glasses") { c.strokeStyle = CINNABAR; c.lineWidth = m.w * 1.3; c.lineCap = "round"; c.beginPath(); m.pts.forEach(([x, y], j) => (j ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); }
        if (m.kind === "fill" && (m.role === "pupil" || m.role === "mouth")) { c.fillStyle = INK_BLACK; c.globalAlpha = 0.9; path(c, [m.pts]); c.fill(); c.globalAlpha = 1; }
        if (m.kind === "dot" && m.role === "white") { c.fillStyle = XUAN; c.beginPath(); c.ellipse(m.at[0], m.at[1], m.rx, m.ry, 0, 0, Math.PI * 2); c.fill(); }
        if (m.kind === "dot" && m.role === "blush") { c.fillStyle = "#e0897e"; c.globalAlpha = 0.35; c.beginPath(); c.ellipse(m.at[0], m.at[1], m.rx, m.ry, 0, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1; }
      });
    });
  }
  // the seal, lower right: a vermilion square with a white cut character
  g.group("plain", () => { const c = g.cur, x = W - 110, y = H - 150; g.touch(x - 4, y - 4, x + 64, y + 64); c.fillStyle = CINNABAR; c.globalAlpha = 0.88; c.fillRect(x, y, 56, 56); c.globalAlpha = 1; c.strokeStyle = XUAN; c.lineWidth = 4; c.lineCap = "square"; c.beginPath(); c.moveTo(x + 12, y + 16); c.lineTo(x + 44, y + 16); c.moveTo(x + 28, y + 16); c.lineTo(x + 28, y + 44); c.moveTo(x + 14, y + 44); c.lineTo(x + 42, y + 44); c.moveTo(x + 14, y + 30); c.lineTo(x + 42, y + 30); c.stroke(); }, { blend: "multiply" });
};
