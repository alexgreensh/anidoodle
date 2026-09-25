// IDENTITY TRIPTYCH: one pose, one camera, one Scene, three hands. The geometry handed to each
// renderer is byte-identical (the character gate asserts it); only the marks change. If she
// reads as three different girls here, the hands are wrong, not the character.
import { GRAPHITE, Gfx, PENCIL, type Ctx, type Env } from "./core";
import type { Film } from "./film";
import { camera } from "./character/math3";
import { renderStorybook } from "./character/render/storybook";
import { renderMarker } from "./character/render/marker";
import { renderRiso } from "./character/render/riso";
import { letter } from "./drafting";
import { mira } from "./characters/mira";
import { MIRA_MARKER, MIRA_RISO, MIRA_STORYBOOK } from "./characters/mira/palettes";
import { wave } from "./characters/mira/poses";

const PW = 900, PH = 1200, GUT = 40, W = PW * 3 + GUT * 4, H = PH + 220;

export const drawMiraTriptych = (ctx: Ctx, frame: number, env: Env) => {
  ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); ctx.fillStyle = "#ece6da"; ctx.fillRect(0, 0, W, H);
  const pose = wave(-20, 0.8), sub: Env = { W: PW, H: PH, scale: env.scale, cache: env.cache, canvas: env.canvas, image: env.image };
  const L = env.canvas(Math.round(PW * env.scale), Math.round(PH * env.scale));
  const cam = camera([0, 0.8, 5.2], [0, 0.7, 0], 3500, PW / 2, PH * 0.52), scene = mira.toScene(pose, cam);
  const hands: [string, string, (g: Gfx, e: Env) => void][] = [
    ["STORYBOOK", "#fbf6ea", (g) => renderStorybook(g, scene, MIRA_STORYBOOK)],
    ["MARKER COMIC", "#8fd6e6", (g) => renderMarker(g, scene, MIRA_MARKER)],
    ["RISOGRAPH", "#f5efe2", (g, e) => renderRiso(g, e, scene, MIRA_RISO)],
  ];
  const top = new Gfx(ctx, env, frame, PENCIL);
  hands.forEach(([name, paper, draw], i) => {
    L.ctx.setTransform(1, 0, 0, 1, 0, 0); L.ctx.globalAlpha = 1; L.ctx.globalCompositeOperation = "source-over"; L.ctx.clearRect(0, 0, L.canvas.width, L.canvas.height);
    L.ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); L.ctx.fillStyle = paper; L.ctx.fillRect(0, 0, PW, PH);
    const g = new Gfx(L.ctx, sub, frame, PENCIL); draw(g, sub); g.paper("paper", 0.12);
    const x = GUT + i * (PW + GUT); ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); ctx.drawImage(L.canvas as CanvasImageSource, 0, 0, L.canvas.width, L.canvas.height, x, 140, PW, PH);
    letter(top, name, x + PW / 2, PH + 170, { cap: 30, color: GRAPHITE, seed: 40 + i, w: 2.8, align: "center" });
  });
  letter(top, "MIRA V1.0.0  /  ONE POSE, ONE SCENE, THREE HANDS", GUT, 50, { cap: 40, color: GRAPHITE, seed: 7, w: 3.4 });
};
export const miraTriptych: Film = { meta: { title: "Mira identity triptych", W, H, fps: 30, bpm: 120, durationFrames: 1 }, assets: { images: {} }, shots: [{ id: "triptych", start: 0, end: 1, draw: drawMiraTriptych }] };
