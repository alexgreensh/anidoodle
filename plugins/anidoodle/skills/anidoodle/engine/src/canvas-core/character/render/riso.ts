// RISOGRAPH HAND for any character Scene: lighthouse.ts / print.ts's recipe. Three drums
// (yellow, fluorescent pink, blue), each its own layer, each overprinted by multiply through its
// own registration offset and eaten by pinholes and mottle. A palette ROLE is a recipe of drums
// and tones (the coat is yellow at 100%; skin is pink 20% over yellow 28%); tone is a halftone
// screen at that drum's angle; the shadow side is a second screen of the role's shade ink. Every
// part KNOCKS OUT what is under it on every drum before it prints, so occlusion is real paper,
// not overprint soup. The line is blue litho crayon, on the blue drum.
import { type Env, Gfx, type P, halftone } from "../../core";
import { bbox, runLength, thin } from "../shape2d";
import type { Mark, Scene } from "../types";
import { contourRuns, hashId } from "./storybook";

export type RisoRecipe = { inks: [string, number][]; shadeInk?: string; shadeTone?: number };
export const DRUM = { yellow: { col: "#ffd400", ang: 28, off: [-4.5, 3.5] as P }, pink: { col: "#ff48b0", ang: 62, off: [4.5, -3] as P }, blue: { col: "#0078bf", ang: 12, off: [0, 0] as P } } as const;
type DrumName = keyof typeof DRUM;
const NAMES: DrumName[] = ["yellow", "pink", "blue"];
const pathPolys = (c: CanvasRenderingContext2D, polys: P[][], dx = 0, dy = 0) => { c.beginPath(); polys.forEach((s) => { s.forEach(([x, y], i) => (i ? c.lineTo(x + dx, y + dy) : c.moveTo(x + dx, y + dy))); c.closePath(); }); };

export const renderRiso = (g: Gfx, env: Env, scene: Scene, recipes: Record<string, RisoRecipe>, o: { pitch?: number; lineW?: number; before?: (d: Record<DrumName, CanvasRenderingContext2D>) => void } = {}) => {
  const pitch = o.pitch ?? 6.5, byId = new Map(scene.parts.map((p) => [p.id, p])), L = scene.light, W = Math.round(env.W * env.scale), H = Math.round(env.H * env.scale);
  // one persistent surface per drum, reused across frames
  const drums = {} as Record<DrumName, CanvasRenderingContext2D>; let shadeL: CanvasRenderingContext2D;
  NAMES.forEach((n) => { const key = `riso:${n}:${W}x${H}`; let l = env.cache.get(key) as { ctx: CanvasRenderingContext2D } | undefined; if (!l) { l = env.canvas(W, H) as unknown as { ctx: CanvasRenderingContext2D }; env.cache.set(key, l); } l.ctx.setTransform(1, 0, 0, 1, 0, 0); l.ctx.globalCompositeOperation = "source-over"; l.ctx.globalAlpha = 1; l.ctx.clearRect(0, 0, W, H); l.ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); drums[n] = l.ctx; });
  { const key = `riso:shade:${W}x${H}`; let l = env.cache.get(key) as { ctx: CanvasRenderingContext2D } | undefined; if (!l) { l = env.canvas(W, H) as unknown as { ctx: CanvasRenderingContext2D }; env.cache.set(key, l); } shadeL = l.ctx; }
  o.before?.(drums);
  const screen = (c: CanvasRenderingContext2D, polys: P[][], drum: DrumName, tone: number) => {
    if (tone >= 0.96) { c.fillStyle = "#000"; pathPolys(c, polys); c.fill("nonzero"); return; }
    const b = bbox(polys); c.save(); pathPolys(c, polys); c.clip("nonzero"); c.fillStyle = "#000"; c.beginPath();
    halftone(b, pitch, DRUM[drum].ang, () => tone).forEach(([x, y, r]) => { c.moveTo(x + r, y); c.arc(x, y, r, 0, Math.PI * 2); }); c.fill(); c.restore();
  };
  const knock = (polys: P[][]) => NAMES.forEach((n) => { const c = drums[n]; c.globalCompositeOperation = "destination-out"; c.fillStyle = "#000"; pathPolys(c, polys); c.fill("nonzero"); c.globalCompositeOperation = "source-over"; });
  const recipe = (r: string): RisoRecipe => recipes[r] ?? { inks: [["blue", 0.5]] };
  const darkest = (r: string): DrumName => { const rc = recipe(r).inks; return (rc.find(([n]) => n === "blue")?.[0] ?? rc[0]?.[0] ?? "blue") as DrumName; };
  const markOn = (m: Mark, seed: number) => {
    if (m.kind === "line") { if (m.role === "white") { knock([[...m.pts]]); return; } const on: [DrumName, number][] = m.role === "line" ? [["blue", 1]] : recipe(m.role).inks.filter(([, t]) => t >= 0.1).map(([n, t]) => [n as DrumName, Math.min(1, t * 1.15)]); const prev = g.cur; (on.length ? on : [[darkest(m.role), 1] as [DrumName, number]]).forEach(([n, t], k) => { g.cur = drums[n]; g.pen(m.pts, { w: m.w * 1.1, color: "#000", seed: seed + k, wobble: 0.4, boil: 0.2, retrace: false, opacity: t, closed: m.closed }); }); g.cur = prev; return; } // a coloured line prints on every drum its colour is made of
    const pts = m.kind === "fill" ? m.pts : Array.from({ length: 12 }, (_, i) => [m.at[0] + Math.cos((i / 12) * Math.PI * 2) * m.rx, m.at[1] + Math.sin((i / 12) * Math.PI * 2) * m.ry] as P);
    knock([pts]);
    if (m.role !== "white") recipe(m.role).inks.forEach(([n, t]) => screen(drums[n as DrumName], [pts], n as DrumName, Math.min(1, t * (m.alpha ?? 1) + (m.kind === "fill" && m.role === "pupil" ? 1 : 0))));
    if (m.kind === "fill" && m.line) { const prev = g.cur; g.cur = drums.blue; g.pen(pts, { w: m.line, color: "#000", seed, wobble: 0.3, closed: true, retrace: false }); g.cur = prev; }
  };
  if (scene.ground?.shadow.length) screen(drums.blue, [scene.ground.shadow], "blue", 0.35);
  for (const part of scene.parts) {
    const seed = hashId(part.id), rc = recipe(part.role), k = part.size;
    if (part.fill !== false && part.polys.length) {
      knock(part.polys);
      rc.inks.forEach(([n, t]) => screen(drums[n as DrumName], part.polys, n as DrumName, t));
      if (rc.shadeInk) { // the shadow side: a screen, minus the lit form shifted toward the light
        const b = bbox(part.polys), sc = shadeL; sc.setTransform(env.scale, 0, 0, env.scale, 0, 0); sc.clearRect(b.x0 - 10, b.y0 - 10, b.x1 - b.x0 + 20, b.y1 - b.y0 + 20);
        screen(sc, part.polys, rc.shadeInk as DrumName, rc.shadeTone ?? 0.4);
        sc.globalCompositeOperation = "destination-out"; sc.fillStyle = "#000"; pathPolys(sc, part.polys, L[0] * k * 0.4, L[1] * k * 0.4); sc.fill("nonzero"); sc.globalCompositeOperation = "source-over";
        const d = drums[rc.shadeInk as DrumName]; d.save(); d.setTransform(1, 0, 0, 1, 0, 0); const x0 = Math.max(0, Math.floor((b.x0 - 10) * env.scale)), y0 = Math.max(0, Math.floor((b.y0 - 10) * env.scale)), w = Math.min(W - x0, Math.ceil((b.x1 - b.x0 + 20) * env.scale)), h = Math.min(H - y0, Math.ceil((b.y1 - b.y0 + 20) * env.scale)); if (w > 0 && h > 0) d.drawImage(sc.canvas as CanvasImageSource, x0, y0, w, h, x0, y0, w, h); d.restore();
      }
    }
    if (part.outline !== false) { const prev = g.cur; g.cur = drums.blue; const w = Math.max(1.3, Math.min(4.2, 0.9 + k * 0.06)) * (o.lineW ?? 1); contourRuns(part, byId).forEach((run, i) => { if (runLength(run) > 3) g.pen(thin(run, Math.max(2, Math.round(run.length / 26))), { w, color: "#000", seed: seed + i * 7, wobble: 0.5, boil: 0.2, taper: 0.9, retrace: false, opacity: 1 }); }); g.cur = prev; }
    part.marks.forEach((m, i) => markOn(m, seed + 300 + i));
  }
  // print: each drum in its ink, multiplied through its own registration offset
  NAMES.forEach((n) => {
    g.group("plain", () => {
      const c = g.cur; g.touch(0, 0, env.W, env.H);
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0);
      c.drawImage(drums[n].canvas as CanvasImageSource, 0, 0);
      c.globalCompositeOperation = "source-in"; c.fillStyle = DRUM[n].col; c.fillRect(0, 0, W, H); c.restore();
    }, { blend: "multiply", off: DRUM[n].off, textures: ["risoSpeck", "risoMottle"] });
  });
};
