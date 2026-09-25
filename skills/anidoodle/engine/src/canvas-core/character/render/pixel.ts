// PIXEL-ART HAND for any character Scene (pixelArt.ts's recipe). The character is re-expressed
// as a sprite: a limited palette, each role a two-step ramp (lit, shade) chosen by which side of
// the form a cell sits on, a dark silhouette outline, a shade-coloured inner line where one part
// overlaps another, and the features (eyes, glasses, mouth) stamped as single pixels so they
// survive at sprite size. Painted as whole cells: every device pixel is exactly one palette colour.
import type { Env, Gfx } from "../../core";
import { insidePoly } from "../shape2d";
import type { Scene } from "../types";
import { type Grid, sampleScene } from "./grid";

export type PixelPalette = { bg: string; ground: string; groundShadow: string; outline: string; roles: Record<string, [string, string]> };

export const pixelGrid = (scene: Scene, W: number, H: number, cell: number): Grid => sampleScene(scene, 0, 0, cell, Math.floor(W / cell), Math.floor(H / cell), 2, true);

export const renderPixel = (g: Gfx, env: Env, scene: Scene, pal: PixelPalette, o: { cell: number; horizon: number }) => {
  const W = env.W, H = env.H, cell = o.cell, gr = pixelGrid(scene, W, H, cell), { G, H: GH, cells } = gr, c = g.cur, k = env.scale;
  const colOf = new Array<string>(G * GH);
  const shadow = scene.ground?.shadow ?? [];
  for (let j = 0; j < GH; j++) for (let i = 0; i < G; i++) {
    const q = j * G + i, cl = cells[q], x = (i + 0.5) * cell, y = (j + 0.5) * cell;
    if (!cl.role) { colOf[q] = y > o.horizon ? (shadow.length > 2 && insidePoly(shadow, x, y) ? pal.groundShadow : pal.ground) : pal.bg; continue; }
    const ramp = pal.roles[cl.role] ?? ["#ff00ff", "#990099"]; colOf[q] = cl.lit ? ramp[0] : ramp[1];
  }
  // outline: a figure cell touching the ground or sky; inner line: a cell whose right or lower neighbour is another part
  for (let j = 0; j < GH; j++) for (let i = 0; i < G; i++) {
    const q = j * G + i, cl = cells[q]; if (!cl.role) continue;
    const nb = [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]].map(([a, b]) => (a < 0 || b < 0 || a >= G || b >= GH ? null : cells[b * G + a]));
    if (nb.some((n) => !n || !n.role)) { colOf[q] = pal.outline; continue; }
    const r = nb[1], d = nb[3];
    if ((r && r.part !== cl.part && r.role !== cl.role) || (d && d.part !== cl.part && d.role !== cl.role)) colOf[q] = (pal.roles[cl.role] ?? ["", pal.outline])[1] === colOf[q] ? pal.outline : (pal.roles[cl.role] ?? ["", pal.outline])[1];
  }
  // features last, in paint order
  gr.marks.forEach(({ i, role }) => { const r = pal.roles[role]; colOf[i] = role === "line" ? pal.outline : r ? r[0] : pal.outline; });
  // paint whole cells, one fillRect per run of a colour
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.imageSmoothingEnabled = false; c.globalAlpha = 1; c.globalCompositeOperation = "source-over";
  const cd = Math.round(cell * k);
  for (let j = 0; j < GH; j++) { let i = 0; while (i < G) { const col = colOf[j * G + i]; let e = i + 1; while (e < G && colOf[j * G + e] === col) e++; c.fillStyle = col; c.fillRect(i * cd, j * cd, (e - i) * cd, cd); i = e; } }
  c.restore();
  g.touch(0, 0, W, H);
  return gr;
};
