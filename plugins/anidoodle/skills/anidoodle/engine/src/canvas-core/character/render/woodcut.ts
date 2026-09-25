// WOODCUT HAND (ukiyo-e colour woodblock, woodcut.ts's recipe) for any character Scene. Washi
// paper; one colour block per role, printed flat and multiplied, the plank's grain knocking the
// pigment thin in streaks; a bokashi wipe in the sky; last, the KEY BLOCK: every contour and
// every feature line as the knife leaves it (two cuts either side of a ridge, a stepped width,
// chisel ends), in sumi black. No shading gradients on the figure: ukiyo-e states form with line.
import type { Env, Gfx, P } from "../../core";
import { bokashi, carved, fillAll, grain, washi } from "../../woodcutKit";
import { runLength, thin } from "../shape2d";
import type { Scene } from "../types";
import { contourRuns, hashId, occlude, occluders } from "./storybook";

export const SUMI = "#1d1916";
export type WoodPalette = Record<string, string>;

export const renderWoodcut = (g: Gfx, env: Env, scene: Scene, pal: WoodPalette, o: { horizon: number; sky: string; ground: string }) => {
  const W = env.W, H = env.H, byId = new Map(scene.parts.map((p) => [p.id, p])), covOf = new Map(scene.parts.map((p, i) => [p.id, occluders(scene, i)]));
  // the sheet
  g.group("plain", () => { const c = g.cur; g.touch(0, 0, W, H); c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(washi(env).canvas as CanvasImageSource, 0, 0); c.restore(); });
  // sky bokashi, ground block
  g.group("plain", () => { const c = g.cur; g.touch(0, 0, W, H); bokashi(c, 0, W, 0, o.horizon * 0.55, o.sky, 41); c.fillStyle = o.ground; c.fillRect(0, o.horizon, W, H - o.horizon); grain(c, env, 0.35, [13, 7]); }, { blend: "multiply" });
  // the carver cleared the sky and ground blocks where the figure stands: back to bare paper there
  g.group("plain", () => { const c = g.cur; g.touch(0, 0, W, H); c.save(); c.beginPath(); for (const p of scene.parts) if (p.fill !== false) for (const q of p.polys) { q.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); } c.clip("nonzero"); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(washi(env).canvas as CanvasImageSource, 0, 0); c.restore(); });
  // colour blocks, part by part in paint order (each a flat print; later prints cover earlier)
  g.group("plain", () => {
    const c = g.cur; g.touch(0, 0, W, H);
    if (scene.ground?.shadow.length) { c.globalAlpha = 0.35; fillAll(c, [scene.ground.shadow], "#6b5a4a"); c.globalAlpha = 1; }
    for (const part of scene.parts) {
      if (part.fill === false || !part.polys.length) continue;
      fillAll(c, part.polys, pal[part.role] ?? "#ff00ff");
      for (const m of part.marks) if (m.kind === "fill" && m.role !== "pupil") { c.globalAlpha = m.alpha ?? 1; fillAll(c, [m.pts], pal[m.role] ?? SUMI); c.globalAlpha = 1; }
    }
    grain(c, env, 0.3, [37, 19], 0.04);
  }, { blend: "multiply", alpha: 0.96 });
  // the key block: knife lines, black
  g.group("plain", () => {
    const c = g.cur; g.touch(0, 0, W, H); const cuts: P[][] = [], red: P[][] = [];   // red: a detail that is its own colour block (her glasses), cut as the knife cuts, printed in vermilion
    for (const part of scene.parts) {
      const seed = hashId(part.id), w = Math.max(2.2, Math.min(5.2, 1.8 + part.size * 0.07));
      if (part.outline !== false) contourRuns(part, byId, 2).flatMap((r) => occlude(r, covOf.get(part.id)!)).forEach((run, i) => { if (runLength(run) > 4) cuts.push(carved(thin(run, 3), w, seed + i)); });
      part.marks.forEach((m, i) => {
        if (m.kind === "line" && m.role !== "white" && (m.alpha ?? 1) > 0.3) occlude(m.pts, covOf.get(part.id)!).forEach((pts, j) => (m.role === "glasses" ? red : cuts).push(carved(pts, Math.max(1.1, m.w * (m.role === "glasses" ? 1.25 : 0.9)), seed + 50 + i + j * 97, { tail: 0.7 })));
        if (m.kind === "fill" && m.role === "pupil") cuts.push(m.pts);
        if (m.kind === "dot" && m.role !== "white" && m.role !== "blush") cuts.push(Array.from({ length: 8 }, (_, k) => [m.at[0] + Math.cos(k * 0.785) * m.rx, m.at[1] + Math.sin(k * 0.785) * m.ry] as P));
      });
    }
    fillAll(c, cuts.filter((q) => q.length > 2), SUMI); fillAll(c, red.filter((q) => q.length > 2), pal.glasses ?? "#cf3b2a");
    // the highlights are uncut wood: bare paper left inside the pupils
    for (const part of scene.parts) for (const m of part.marks) if (m.kind === "dot" && m.role === "white") { c.fillStyle = "#efe6d1"; c.beginPath(); c.ellipse(m.at[0], m.at[1], m.rx, m.ry, 0, 0, Math.PI * 2); c.fill(); }
  }, { alpha: 0.95 });
};
