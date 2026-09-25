// TOY-BRICK HAND for any character Scene: the character BUILT, as a studs-out mosaic seen
// straight on. Every cell is a 1x1 plate in a real brick colour (a stud, a bevel catching the
// light, a hairline seam between plates); the shade side of each form is built in that colour's
// darker brick; the features are 1x1 ROUND TILES (smooth, no stud, a glossy highlight), so her
// round red glasses are a ring of red round tiles and her eyes are black round tiles.
import type { Env, Gfx } from "../../core";
import { shade } from "../../toyBrickKit";
import { insidePoly } from "../shape2d";
import type { Scene } from "../types";
import { type Grid, sampleScene } from "./grid";

export type BrickPalette = { base: string; baseStud: boolean; ground: string; roles: Record<string, [string, string]> };
export const brickGrid = (scene: Scene, W: number, H: number, cell: number): Grid => sampleScene(scene, 0, 0, cell, Math.floor(W / cell), Math.floor(H / cell), 1.6, true);

export const renderBrick = (g: Gfx, env: Env, scene: Scene, pal: BrickPalette, o: { cell: number; horizon: number }) => {
  const W = env.W, H = env.H, s = o.cell, gr = brickGrid(scene, W, H, s), { G, H: GH, cells } = gr, c = g.cur;
  // a builder places round tiles only for the face's features; a strap is built in its own colour; seams and stitching do not exist in bricks
  const FACE = new Set(["glasses", "pupil", "mouth", "blush", "lip"]), tile = new Map<number, string>(), plateCol = new Map<number, string>();
  gr.marks.forEach(({ i, role, part }) => { if (FACE.has(role) || (role === "line" && (part === "head" || part === "nose"))) tile.set(i, role === "line" ? "pupil" : role); else if (role !== "line" && role !== "white" && pal.roles[role]) plateCol.set(i, role); });
  const shadow = scene.ground?.shadow ?? [];
  const plate = (x: number, y: number, col: string, stud: boolean) => {
    c.fillStyle = shade(col, -0.5); c.fillRect(x, y, s, s);                                                       // the seam
    c.fillStyle = col; c.fillRect(x + 0.6, y + 0.6, s - 1.2, s - 1.2);
    c.fillStyle = shade(col, 0.28); c.fillRect(x + 0.6, y + 0.6, s - 1.2, 1.2); c.fillRect(x + 0.6, y + 0.6, 1.2, s - 1.2);   // bevel, lit edges
    c.fillStyle = shade(col, -0.22); c.fillRect(x + 0.6, y + s - 1.8, s - 1.2, 1.2); c.fillRect(x + s - 1.8, y + 0.6, 1.2, s - 1.2);
    if (!stud) return;
    const cx = x + s / 2, cy = y + s / 2, r = s * 0.3;
    c.fillStyle = shade(col, -0.3); c.beginPath(); c.arc(cx + r * 0.18, cy + r * 0.2, r * 1.02, 0, Math.PI * 2); c.fill();        // the stud's shadow
    c.fillStyle = shade(col, 0.06); c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
    c.strokeStyle = shade(col, 0.45); c.lineWidth = Math.max(0.8, s * 0.06); c.beginPath(); c.arc(cx, cy, r * 0.72, Math.PI * 1.05, Math.PI * 1.6); c.stroke();   // the highlight
  };
  const round = (x: number, y: number, col: string) => {
    const cx = x + s / 2, cy = y + s / 2, r = s * 0.47;
    c.fillStyle = shade(col, -0.45); c.beginPath(); c.arc(cx + 0.5, cy + 0.6, r, 0, Math.PI * 2); c.fill();
    c.fillStyle = col; c.beginPath(); c.arc(cx, cy, r * 0.94, 0, Math.PI * 2); c.fill();
    c.fillStyle = "rgba(255,255,255,0.55)"; c.beginPath(); c.ellipse(cx - r * 0.3, cy - r * 0.35, r * 0.34, r * 0.2, -0.6, 0, Math.PI * 2); c.fill();   // gloss
  };
  g.touch(0, 0, W, H);
  for (let j = 0; j < GH; j++) for (let i = 0; i < G; i++) {
    const q = j * G + i, cl = cells[q], x = i * s, y = j * s;
    if (!cl.role) { const onGround = (j + 0.5) * s > o.horizon, sh = shadow.length > 2 && insidePoly(shadow, (i + 0.5) * s, (j + 0.5) * s); plate(x, y, onGround ? (sh ? shade(pal.ground, -0.25) : pal.ground) : pal.base, pal.baseStud || onGround); continue; }
    const ramp = pal.roles[cl.role] ?? ["#ff00ff", "#990099"], t = tile.get(q);
    if (t) { plate(x, y, cl.lit ? ramp[0] : ramp[1], false); round(x, y, (pal.roles[t] ?? ["#1b2a34"])[0]); continue; }
    const pc = plateCol.get(q); if (pc) { plate(x, y, pal.roles[pc][cl.lit ? 0 : 1], true); continue; }
    plate(x, y, cl.lit ? ramp[0] : ramp[1], true);
  }
  return gr;
};
