// MIRA IN EVERY HAND: one pose, one camera, one Scene from the one character module, and nine
// hands that each make her in their own marks. Line hands (storybook, marker, riso, woodcut,
// scratchboard, sumi-e, coloured pencil) draw her contour their way; pixel art and toy bricks
// RE-EXPRESS her in their units (a sprite; a studs-out build with round red tiles for glasses).
// Each shot is one tile at full size; miraEveryHand.ts lays them out as one sheet.
import { Gfx, PENCIL, type Ctx, type Env, halftone } from "./core";
import type { Film } from "./film";
import { camera, project } from "./character/math3";
import type { Scene } from "./character/types";
import { renderStorybook } from "./character/render/storybook";
import { renderMarker } from "./character/render/marker";
import { renderRiso } from "./character/render/riso";
import { renderWoodcut } from "./character/render/woodcut";
import { renderScratch } from "./character/render/scratch";
import { renderSumi } from "./character/render/sumi";
import { renderPencil } from "./character/render/pencil";
import { renderPixel } from "./character/render/pixel";
import { renderBrick } from "./character/render/brick";
import { mira } from "./characters/mira";
import { MIRA_BRICK, MIRA_MARKER, MIRA_PENCIL, MIRA_PIXEL, MIRA_RISO, MIRA_SCRATCH, MIRA_STORYBOOK, MIRA_SUMI, MIRA_WOODCUT } from "./characters/mira/palettes";
import { wave } from "./characters/mira/poses";

export const TW = 900, TH = 1200;
export const EVERY_POSE = wave(-20, 0.8);
export const everyCam = () => camera([0, 0.8, 5.2], [0, 0.7, 0], 3500, TW / 2, TH * 0.5);
export const everyScene = (): Scene => mira.toScene(EVERY_POSE, everyCam());
export const HORIZON = () => project(everyCam(), [0, 0, -2.4]).y;

type Hand = { id: string; name: string; note: string; draw: (ctx: Ctx, env: Env, s: Scene) => void };
const plain = (ctx: Ctx, env: Env, col: string) => { ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); ctx.fillStyle = col; ctx.fillRect(0, 0, env.W, env.H); };
export const HANDS: Hand[] = [
  { id: "woodcut", name: "WOODCUT", note: "ukiyo-e: colour blocks, key-block knife line", draw: (ctx, env, s) => renderWoodcut(new Gfx(ctx, env, 0, PENCIL), env, s, MIRA_WOODCUT, { horizon: HORIZON(), sky: "#3b5f8f", ground: "#d9c8a0" }) },
  { id: "brick", name: "TOY BRICK", note: "studs-out build, round tiles for eyes and glasses", draw: (ctx, env, s) => renderBrick(new Gfx(ctx, env, 0, PENCIL), env, s, MIRA_BRICK, { cell: 15, horizon: HORIZON() }) },
  { id: "pixel", name: "PIXEL ART", note: "a sprite: ramps, outline, features as single pixels", draw: (ctx, env, s) => renderPixel(new Gfx(ctx, env, 0, PENCIL), env, s, MIRA_PIXEL, { cell: 10, horizon: HORIZON() }) },
  { id: "scratch", name: "SCRATCHBOARD", note: "scraped cross-contour, tinted", draw: (ctx, env, s) => renderScratch(new Gfx(ctx, env, 0, PENCIL), env, s, MIRA_SCRATCH, { horizon: HORIZON() }) },
  { id: "pencil", name: "COLOURED PENCIL", note: "hatched local colour, cross-hatched shade", draw: (ctx, env, s) => renderPencil(new Gfx(ctx, env, 0, PENCIL), env, s, MIRA_PENCIL, { horizon: HORIZON(), ground: "#7fae6a" }) },
  { id: "sumi", name: "SUMI-E", note: "ink and light colour, brush contours", draw: (ctx, env, s) => renderSumi(new Gfx(ctx, env, 0, PENCIL), env, s, MIRA_SUMI, { horizon: HORIZON() }) },
  { id: "marker", name: "MARKER COMIC", note: "flat cels, hard shadow, swelling ink", draw: (ctx, env, s) => { plain(ctx, env, "#8fd6e6"); const g = new Gfx(ctx, env, 0, PENCIL), c = g.cur; g.group("plain", () => { g.touch(0, 0, env.W, env.H); c.fillStyle = "#6cc2d4"; c.beginPath(); halftone({ x0: 0, y0: 0, x1: env.W, y1: env.H }, 16, 45, (_x, y) => 0.15 + 0.35 * (y / env.H)).forEach(([x, y, r]) => { c.moveTo(x + r, y); c.arc(x, y, r, 0, Math.PI * 2); }); c.fill(); c.fillStyle = "#f2c9a0"; c.fillRect(0, HORIZON(), env.W, env.H); }); renderMarker(g, s, MIRA_MARKER, { weight: 1.1 }); } },
  { id: "riso", name: "RISOGRAPH", note: "three drums, halftone, knockouts", draw: (ctx, env, s) => { plain(ctx, env, "#f5efe2"); const g = new Gfx(ctx, env, 0, PENCIL); renderRiso(g, env, s, MIRA_RISO, { before: (d) => { const b = d.blue, h = HORIZON(); b.fillStyle = "#000"; b.beginPath(); halftone({ x0: 0, y0: h, x1: env.W, y1: env.H }, 8, 12, (_x, y) => 0.12 + 0.4 * Math.min(1, (y - h) / 300)).forEach(([x, y, r]) => { b.moveTo(x + r, y); b.arc(x, y, r, 0, Math.PI * 2); }); b.fill(); } }); g.paper("paper", 0.24); g.paper("coldpress", 0.1); } },
  { id: "storybook", name: "STORYBOOK", note: "pencil and watercolour (the approved sheet's hand)", draw: (ctx, env, s) => { plain(ctx, env, "#fbf6ea"); const g = new Gfx(ctx, env, 0, PENCIL); g.group("paint", () => g.wash([[30, HORIZON()], [env.W - 30, HORIZON() - 10], [env.W - 20, env.H - 40], [40, env.H - 30]], "#a9cfa6", { alpha: 0.5, seed: 4 })); renderStorybook(g, s, MIRA_STORYBOOK); g.paper("paper", 0.12); } },
];

export const miraTile: Film = {
  meta: { title: "Mira, one hand per tile", W: TW, H: TH, fps: 30, bpm: 120, durationFrames: HANDS.length * 15 },
  assets: { images: {} },
  shots: HANDS.map((h, i) => ({ id: h.id, start: i * 15, end: i * 15 + 15, draw: (ctx: Ctx, _f: number, env: Env) => h.draw(ctx, env, everyScene()) })),
};
