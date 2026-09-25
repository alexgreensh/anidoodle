// SCRATCHBOARD HAND for any character Scene (scratchboard.ts's recipe, tinted). A black board;
// each form is SCRAPED to white clay in lines that cross its long axis (cross-contour), twice as
// close on the side the light reaches; the contour is where the scraping stops, so the outline is
// a black gap, never a drawn line; features are left black or scraped white. Then the tinted
// scratchboard step: transparent colour laid over the scraped white of each role (on black it
// cannot show), which keeps her palette in a monochrome medium.
import { type Env, type Gfx, type P, rng } from "../../core";
import { hatchRuns } from "../../gallery";
import { bbox, insidePoly } from "../shape2d";
import type { Scene } from "../types";
import { contourRuns, hashId } from "./storybook";

const BOARD = "#141214", CLAY = "#f3efe6";
const path = (c: CanvasRenderingContext2D, polys: P[][], dx = 0, dy = 0) => { c.beginPath(); polys.forEach((s) => { s.forEach(([x, y], i) => (i ? c.lineTo(x + dx, y + dy) : c.moveTo(x + dx, y + dy))); c.closePath(); }); };
// the long axis of a set of points (principal direction)
const axis = (pts: P[]) => { let mx = 0, my = 0; pts.forEach(([x, y]) => { mx += x; my += y; }); mx /= pts.length; my /= pts.length; let a = 0, b = 0, d = 0; pts.forEach(([x, y]) => { a += (x - mx) ** 2; b += (x - mx) * (y - my); d += (y - my) ** 2; }); return 0.5 * Math.atan2(2 * b, a - d); };

export const renderScratch = (g: Gfx, env: Env, scene: Scene, tint: Record<string, string>, o: { horizon: number }) => {
  const W = env.W, H = env.H, L = scene.light, byId = new Map(scene.parts.map((p) => [p.id, p]));
  g.group("plain", () => {
    const c = g.cur; g.touch(0, 0, W, H); c.fillStyle = BOARD; c.fillRect(0, 0, W, H);
    c.strokeStyle = CLAY; c.lineCap = "round";
    // the ground: long sparse horizontal scrapes, closer toward us; a few stars
    const r = rng(7);
    for (let y = o.horizon; y < H; y += 5 + (H - y) * 0.03) { c.globalAlpha = 0.55; c.lineWidth = 0.9; c.beginPath(); let x = r() * 30; while (x < W) { const l = 30 + r() * 120; c.moveTo(x, y + (r() - 0.5) * 2); c.lineTo(x + l, y + (r() - 0.5) * 2); x += l + 6 + r() * 40; } c.stroke(); }
    for (let i = 0; i < 60; i++) { c.globalAlpha = 0.4 + r() * 0.5; c.lineWidth = 1 + r(); const x = r() * W, y = r() * o.horizon * 0.8; c.beginPath(); c.moveTo(x - 2, y); c.lineTo(x + 2, y); c.moveTo(x, y - 2); c.lineTo(x, y + 2); c.stroke(); }
    c.globalAlpha = 1;
    if (scene.ground?.shadow.length) { c.fillStyle = BOARD; path(c, [scene.ground.shadow]); c.fill(); }
    for (const part of scene.parts) {
      if (part.fill === false || !part.polys.length) continue;
      const seed = hashId(part.id), b = bbox(part.polys), k = part.size, ang = axis(part.polys.flat()) + Math.PI / 2 + 0.12;
      c.fillStyle = BOARD; path(c, part.polys); c.fill("nonzero");                                             // what is under it is covered
      const inside = (x: number, y: number) => part.polys.some((q) => insidePoly(q, x, y));
      const lit = (x: number, y: number) => part.polys.some((q) => insidePoly(q, x - L[0] * k * 0.35, y - L[1] * k * 0.35));
      const pale = part.role === "skin" || part.role === "nail" ? 0.42 : part.role === "coat" ? 0.62 : 1, gap = Math.max(2.2, Math.min(5.5, k * 0.1)) * pale, light = tint[part.role] ? 1 : 0.6;
      c.lineWidth = Math.max(0.7, gap * 0.34); c.globalAlpha = light;
      // pass 1 everywhere; pass 2 in between, only where the light reaches: tone is line spacing
      // each line BOWS across the form (a cross-contour on a cylinder), the bow along the form's long axis
      const ax = Math.cos(ang - Math.PI / 2), ay = Math.sin(ang - Math.PI / 2), sg = ay >= 0 ? 1 : -1;
      c.save(); path(c, part.polys); c.clip("nonzero");
      [0, 1].forEach((pass) => { const off = pass * gap, nx = -Math.sin(ang) * off, ny = Math.cos(ang) * off; c.beginPath(); hatchRuns(b, ang, gap * 2, (x, y) => inside(x + nx, y + ny) && (pass === 0 || lit(x + nx, y + ny)), 2, seed + pass * 7).forEach((run) => { const a = run[0], z = run[run.length - 1], len = Math.hypot(z[0] - a[0], z[1] - a[1]), bow = len * 0.16 * sg; c.moveTo(a[0] + nx, a[1] + ny); c.quadraticCurveTo((a[0] + z[0]) / 2 + nx + ax * bow, (a[1] + z[1]) / 2 + ny + ay * bow, z[0] + nx, z[1] + ny); }); c.stroke(); });
      c.restore();
      c.globalAlpha = 1;
      // the contour: scraping stops short of the edge, leaving a black gap
      c.strokeStyle = BOARD; c.lineWidth = Math.max(1.6, Math.min(4, 1.2 + k * 0.05));
      if (part.outline !== false) contourRuns(part, byId, 2).forEach((run) => { c.beginPath(); run.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); });
      c.strokeStyle = CLAY;
      // features
      for (const m of part.marks) {
        if (m.kind === "fill") { c.fillStyle = m.role === "pupil" || m.role === "mouth" ? BOARD : CLAY; path(c, [m.pts]); c.fill(); if (m.line) { c.strokeStyle = BOARD; c.lineWidth = m.line; path(c, [m.pts]); c.stroke(); c.strokeStyle = CLAY; } }   // coloured fills are scraped white and take their tint; only pupils and the mouth stay board
        else if (m.kind === "line" && (m.alpha ?? 1) > 0.3) { c.strokeStyle = m.role === "glasses" || m.role === "white" ? CLAY : BOARD; c.lineWidth = Math.max(1, m.w * (m.role === "glasses" ? 1.2 : 0.9)); c.beginPath(); m.pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); c.strokeStyle = CLAY; }
        else if (m.kind === "dot") { c.fillStyle = m.role === "white" ? CLAY : m.role === "blush" ? "rgba(243,239,230,0.35)" : BOARD; c.beginPath(); c.ellipse(m.at[0], m.at[1], m.rx, m.ry, 0, 0, Math.PI * 2); c.fill(); }
      }
    }
  });
  // the tint: transparent colour over each role's region (multiply: it only shows on the scraped white)
  g.group("plain", () => {
    const c = g.cur; g.touch(0, 0, W, H);
    for (const part of scene.parts) {
      const t = tint[part.role];
      if (t && part.fill !== false && part.polys.length) { c.fillStyle = t; path(c, part.polys); c.fill("nonzero"); }
      for (const m of part.marks) if (m.kind === "line" && m.role === "glasses" && tint.glasses) { c.strokeStyle = tint.glasses; c.lineWidth = m.w * 1.6; c.beginPath(); m.pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke(); }
    }
  }, { blend: "multiply" });
};
