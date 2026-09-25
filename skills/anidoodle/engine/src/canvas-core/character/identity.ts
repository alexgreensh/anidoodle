// IDENTITY PER HAND. The character spec lists what makes her HER; each hand must still show it.
// Line hands draw the same Scene geometry, so their check is the Scene's (every feature part
// present and drawn). Grid hands (pixel, brick) RE-EXPRESS her, so their check is on the grid
// itself: enough cells of the right roles, the rims still rings, the eyes still dark, and the
// silhouette's IoU against the Scene sampled finer.
import type { Scene } from "./types";
import type { Grid } from "./render/grid";
import { gridIoU } from "./render/grid";

export type Check = { feature: string; ok: boolean; got: string };
export const sceneFeatures = (s: Scene, feats: { id: string; parts: string[] }[]): Check[] => {
  const drawn = new Set(s.parts.filter((p) => p.polys.length || p.marks.length).map((p) => p.id));
  return feats.map((f) => { const has = f.parts.filter((p) => drawn.has(p)); return { feature: f.id, ok: has.length > 0, got: has.join("+") || "none" }; });
};
// on a grid: count cells by role (body cells) and by mark role (features), relative to the figure
export const gridFeatures = (g: Grid, s: Scene): Check[] => {
  const body: Record<string, number> = {}, mk: Record<string, number> = {}; let fig = 0;
  g.cells.forEach((c) => { if (c.role) { fig++; body[c.role] = (body[c.role] ?? 0) + 1; } });
  const markCells = new Map<number, string>(); g.marks.forEach((m) => markCells.set(m.i, m.role)); markCells.forEach((r) => (mk[r] = (mk[r] ?? 0) + 1));
  const iou = gridIoU(s, g), pct = (n: number) => `${((100 * n) / (fig || 1)).toFixed(0)}%`;
  return [
    { feature: "glasses", ok: (mk.glasses ?? 0) >= 10, got: `${mk.glasses ?? 0} rim cells` },
    { feature: "eyes", ok: (mk.pupil ?? 0) >= 2, got: `${mk.pupil ?? 0} pupil cells` },
    { feature: "raincoat", ok: (body.coat ?? 0) / fig > 0.3, got: `coat ${pct(body.coat ?? 0)} of the figure` },
    { feature: "toggles", ok: (mk.toggle ?? 0) >= 2, got: `${mk.toggle ?? 0} toggle cells` },
    { feature: "satchel", ok: (body.satchel ?? 0) >= 12, got: `${body.satchel ?? 0} cells` },
    { feature: "fringe", ok: (body.hair ?? 0) / fig > 0.06, got: `hair ${pct(body.hair ?? 0)}` },
    { feature: "wellies", ok: (body.boots ?? 0) >= 12, got: `${body.boots ?? 0} cells` },
    { feature: "silhouette", ok: iou > 0.8, got: `IoU ${iou.toFixed(2)} vs the scene` },
  ];
};
