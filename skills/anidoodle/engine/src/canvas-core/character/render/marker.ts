// MARKER COMIC HAND for any character Scene: koi.ts's recipe. Flat cel colour; a HARD shadow
// (the shade colour, with the lit colour laid over it shifted toward the light and cut to the
// form, no softening); one confident brush-marker contour that swells on the side turned away
// from the light and tapers at its ends; marks inked, not pencilled. Same Scene, other marks.
import { Gfx, P } from "../../core";
import { ink } from "../../gallery";
import { bbox, signedArea, thin } from "../shape2d";
import type { Mark, Scene } from "../types";
import { type Palette, contourRuns, hashId } from "./storybook";

export const COMIC_INK = "#15122a";
const pathPolys = (c: CanvasRenderingContext2D, polys: P[][], dx = 0, dy = 0) => { c.beginPath(); polys.forEach((s) => { s.forEach(([x, y], i) => (i ? c.lineTo(x + dx, y + dy) : c.moveTo(x + dx, y + dy))); c.closePath(); }); };

const markInk = (g: Gfx, marks: Mark[], col: (r: string) => string, seed: number, light: P) => {
  marks.forEach((m, i) => {
    const c = g.cur;
    if (m.kind === "line") { if (m.pts.length > 1) ink(g, m.pts, m.role === "line" ? COMIC_INK : col(m.role), { w: m.w * 1.25, light, shadow: 0.3, taper: [0.2, 0.2], seed: seed + i, rough: 0.15 }, m.alpha ?? 1); }
    else if (m.kind === "fill") { const b = bbox([m.pts]); g.touch(b.x0 - 3, b.y0 - 3, b.x1 + 3, b.y1 + 3); c.globalAlpha = m.alpha ?? 1; c.fillStyle = col(m.role); pathPolys(c, [m.pts]); c.fill(); c.globalAlpha = 1; if (m.line) ink(g, [...m.pts, m.pts[0]], COMIC_INK, { w: m.line * 1.3, light, shadow: 0.4, taper: [0.02, 0.02], seed: seed + i + 50 }); }
    else { g.touch(m.at[0] - m.rx - 2, m.at[1] - m.ry - 2, m.at[0] + m.rx + 2, m.at[1] + m.ry + 2); c.globalAlpha = m.alpha ?? 1; c.fillStyle = col(m.role); c.beginPath(); c.ellipse(m.at[0], m.at[1], Math.max(0.3, m.rx), Math.max(0.3, m.ry), m.rot, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1; }
  });
};

export const renderMarker = (g: Gfx, scene: Scene, pal: Palette, o: { weight?: number } = {}) => {
  const byId = new Map(scene.parts.map((p) => [p.id, p])), L = scene.light, lightTo: P = [L[0], L[1]], sw = (r: string) => pal[r] ?? { base: "#ff00ff", shade: "#990099" };
  const col = (r: string) => (r === "line" ? COMIC_INK : sw(r).base);
  g.group("plain", () => {
    if (scene.ground?.shadow.length) { const c = g.cur, b = bbox([scene.ground.shadow]); g.touch(b.x0, b.y0, b.x1, b.y1); c.fillStyle = "rgba(21,18,42,0.28)"; pathPolys(c, [scene.ground.shadow]); c.fill(); }
    for (const part of scene.parts) {
      const s = sw(part.role), k = part.size, seed = hashId(part.id), c = g.cur;
      if (part.fill !== false && part.polys.length) {
        const b = bbox(part.polys); g.touch(b.x0 - 4, b.y0 - 4, b.x1 + 4, b.y1 + 4);
        c.fillStyle = s.shade; pathPolys(c, part.polys); c.fill("nonzero");
        c.save(); pathPolys(c, part.polys); c.clip("nonzero"); c.fillStyle = s.base; pathPolys(c, part.polys, L[0] * k * 0.34, L[1] * k * 0.34); c.fill("nonzero"); c.restore();
      }
      if (part.outline !== false) {
        const w = Math.max(1.6, Math.min(6.5, 1.2 + k * 0.1)) * (o.weight ?? 1);
        contourRuns(part, byId).forEach((run, i) => {
          const r = thin(run, Math.max(1, Math.round(run.length / 60)));
          // which side of this run is outside: the polygons were wound one way (ccw), so -1
          ink(g, r, COMIC_INK, { w, light: lightTo, shadow: 0.95, taper: [0.06, 0.06], seed: seed + i, side: signedArea(part.polys[0]) >= 0 ? -1 : 1, rough: 0.2, min: 0.3 });
        });
      }
      markInk(g, part.marks, col, seed + 700, lightTo);
    }
  });
};
