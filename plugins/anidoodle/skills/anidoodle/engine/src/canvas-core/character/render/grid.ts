// A SCENE ON A GRID. Pixel art and toy bricks do not draw a character's contour; they RE-EXPRESS
// the character in their own units. This samples a Scene at cell centres: which part is on top,
// its role, whether the cell is on the lit or the shade side of that form, and where the marks
// (eyes, glasses, mouth) fall, stamped at grid resolution so a small feature survives as cells.
import type { P } from "../../core";
import { insidePoly } from "../shape2d";
import type { Mark, Scene } from "../types";

export type Cell = { role: string | null; part: string | null; lit: boolean };
export type Grid = { G: number; H: number; x0: number; y0: number; cell: number; cells: Cell[]; marks: { i: number; role: string; part: string }[] };

const bb = (s: P[]) => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of s) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; } return { x0, y0, x1, y1 }; };

export const sampleScene = (scene: Scene, x0: number, y0: number, cell: number, G: number, H: number, minRing = 2, sprite = false): Grid => {
  const L = scene.light, parts = scene.parts.filter((p) => p.fill !== false && p.polys.length);
  const boxes = parts.map((p) => p.polys.map(bb)), cells: Cell[] = [];
  for (let j = 0; j < H; j++) for (let i = 0; i < G; i++) {
    const x = x0 + (i + 0.5) * cell, y = y0 + (j + 0.5) * cell; let hit: Cell = { role: null, part: null, lit: true };
    for (let k = parts.length - 1; k >= 0; k--) {
      const p = parts[k], inn = p.polys.some((q, n) => { const b = boxes[k][n]; return x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1 && insidePoly(q, x, y); });
      if (!inn) continue;
      const dx = -L[0] * p.size * 0.32, dy = -L[1] * p.size * 0.32, lit = p.polys.some((q) => insidePoly(q, x + dx, y + dy));   // the lit form, shifted toward the light, covers this cell
      hit = { role: p.role, part: p.id, lit }; break;
    }
    cells.push(hit);
  }
  // marks at grid resolution, in paint order (later parts' marks win)
  let cur = "";
  const marks: { i: number; role: string; part: string }[] = [], toCell = (p: P) => [Math.floor((p[0] - x0) / cell), Math.floor((p[1] - y0) / cell)] as [number, number];
  const put = (cx: number, cy: number, role: string) => { if (cx >= 0 && cy >= 0 && cx < G && cy < H) marks.push({ i: cy * G + cx, role, part: cur }); };
  const line = (a: P, b: P, role: string) => { let [x0g, y0g] = toCell(a); const [x1g, y1g] = toCell(b), dx = Math.abs(x1g - x0g), dy = -Math.abs(y1g - y0g), sx = x0g < x1g ? 1 : -1, sy = y0g < y1g ? 1 : -1; let e = dx + dy; for (let n = 0; n < 400; n++) { put(x0g, y0g, role); if (x0g === x1g && y0g === y1g) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0g += sx; } if (e2 <= dx) { e += dx; y0g += sy; } } };
  // A signature ring (a lens rim) smaller than the grid can hold is EXAGGERATED, as a sprite artist
  // would: a midpoint circle of at least `minRing` cells round the ring's centre, never a smear.
  const ring = (cxp: number, cyp: number, rc: number, role: string) => {
    let x = Math.round(rc), y = 0, err = 1 - x; const [cx, cy] = toCell([cxp, cyp]);
    while (x >= y) { [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]].forEach(([a, b]) => put(cx + a, cy + b, role)); y++; if (err < 0) err += 2 * y + 1; else { x--; err += 2 * (y - x) + 1; } }
  };
  const stamp = (m: Mark) => {
    if (m.kind === "line") {
      if ((m.alpha ?? 1) < 0.45 || m.role === "white") return;
      // the sprite policy: at sprite size only what reads survives (rims, pupils, mouth, cheeks): no lids, brows or temple arms
      if (sprite && (m.role === "hair" || (cur === "head" && (m.alpha ?? 1) < 0.8) || cur === "temples")) return;
      const a = m.pts[0], z = m.pts[m.pts.length - 1], b = bb(m.pts), span = Math.max(b.x1 - b.x0, b.y1 - b.y0);
      if (m.pts.length > 12 && Math.hypot(a[0] - z[0], a[1] - z[1]) < span * 0.25 && span < cell * 6) { ring((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, Math.max(minRing, span / 2 / cell), m.role); return; }
      for (let k = 1; k < m.pts.length; k++) line(m.pts[k - 1], m.pts[k], m.role);
    }
    else if (m.kind === "fill") { const b = bb(m.pts); let any = false; for (let cy = Math.floor((b.y0 - y0) / cell); cy <= Math.floor((b.y1 - y0) / cell); cy++) for (let cx = Math.floor((b.x0 - x0) / cell); cx <= Math.floor((b.x1 - x0) / cell); cx++) if (insidePoly(m.pts, x0 + (cx + 0.5) * cell, y0 + (cy + 0.5) * cell)) { put(cx, cy, m.role); any = true; } if (!any) { const c = toCell([(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2]); put(c[0], c[1], m.role); } }
    else { if (m.rx * 2 >= cell * 0.6 || m.role === "pupil") { const c = toCell(m.at); put(c[0], c[1], m.role); } }
  };
  scene.parts.forEach((p) => { cur = p.id; p.marks.forEach(stamp); });
  return { G, H, x0, y0, cell, cells, marks };
};
// how well the grid holds the silhouette: IoU of its figure cells against the scene sampled 4x finer
export const gridIoU = (scene: Scene, g: Grid): number => {
  const fine = sampleScene(scene, g.x0, g.y0, g.cell / 4, g.G * 4, g.H * 4);
  let inter = 0, uni = 0;
  for (let j = 0; j < g.H * 4; j++) for (let i = 0; i < g.G * 4; i++) { const a = !!fine.cells[j * g.G * 4 + i].role, b = !!g.cells[Math.floor(j / 4) * g.G + Math.floor(i / 4)].role; if (a && b) inter++; if (a || b) uni++; }
  return inter / (uni || 1);
};
