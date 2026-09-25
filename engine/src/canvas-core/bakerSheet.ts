// THEO THE BAKER, coloured pencil: the adult proof of the drawing layer. The hero (presenting a
// loaf, three-quarter view), the construction it was built on (the gesture lay-in alone), and the
// same man turned three ways at a smaller scale. Every figure is theoBaker.toScene(pose): the rig
// and its gates underneath, the designed masses on top, the pencil hand over all of it.
import { GRAPHITE, Gfx, PENCIL, type Ctx, type Env } from "./core";
import type { Film } from "./film";
import { add, camera, lensPx } from "./character/math3";
import type { Scene } from "./character/types";
import { order } from "./character/build";
import { renderPencil } from "./character/render/pencil";
import { letter } from "./drafting";
import { bakerPose, loafPart, theoBaker } from "./characters/theo/baker";

const W = 2500, H = 1900;
export const BAKER_PENCIL = {
  skin: { base: "#e3a882", shade: "#b87458" }, nail: { base: "#eecab4", shade: "#d4a58c" }, shirt: { base: "#eef0ec", shade: "#aeb8c6" }, apron: { base: "#d9c493", shade: "#a58e57" },
  apronDark: { base: "#7d6a42", shade: "#5a4a2c" }, trousers: { base: "#5d5650", shade: "#3a3531" }, boots: { base: "#7e4c2b", shade: "#4e2c16" }, hair: { base: "#4a3a31", shade: "#2c211b" },
  grey: { base: "#a9a4a0", shade: "#86817d" }, beard: { base: "#6a5244", shade: "#43322a" }, crust: { base: "#cf8e46", shade: "#8e5424" }, crustDark: { base: "#7a4217", shade: "#5a2e10" }, flour: { base: "#fbf6ea", shade: "#e6dcc8" },
  pupil: { base: "#4a3a2c", shade: "#2c2118" }, white: { base: "#fffdf6", shade: "#e8e2d4" }, blush: { base: "#dd8a7c", shade: "#bb6a5e" }, mouth: { base: "#7a3434", shade: "#5a2222" }, lip: { base: "#b8665e", shade: "#94483f" },
};
const withLoaf = (s: Scene, cam: ReturnType<typeof camera>, at: [number, number, number]): Scene => ({ ...s, parts: order([...s.parts, loafPart(cam, at)]) });

export const drawBakerSheet = (ctx: Ctx, _f: number, env: Env) => {
  const s = env.scale; ctx.setTransform(s, 0, 0, s, 0, 0); ctx.fillStyle = "#e9e3d6"; ctx.fillRect(0, 0, W, H);
  const tile = (x: number, y: number, w: number, h: number, draw: (g: Gfx, sub: Env) => void) => {
    const L = env.canvas(Math.round(w * s), Math.round(h * s)), sub: Env = { W: w, H: h, scale: s, cache: env.cache, canvas: env.canvas, image: env.image };
    L.ctx.setTransform(1, 0, 0, 1, 0, 0); L.ctx.clearRect(0, 0, L.canvas.width, L.canvas.height); draw(new Gfx(L.ctx, sub, 0, PENCIL), sub);
    ctx.setTransform(s, 0, 0, s, 0, 0); ctx.fillStyle = "rgba(60,45,30,0.12)"; ctx.fillRect(x + 6, y + 8, w, h); ctx.drawImage(L.canvas as CanvasImageSource, 0, 0, L.canvas.width, L.canvas.height, x, y, w, h);
  };
  const g = new Gfx(ctx, env, 0, PENCIL);
  // the hero: three-quarter, 50 mm, eye at his chest
  const hero = bakerPose(-28), eye = add(hero.pose.root, [-1.1, 0.12, 2.9]);   // a level camera at his waist: verticals stay vertical, he does not lean
  const heroCam = (w: number, h: number) => camera(eye, add(hero.pose.root, [0.05, 0.12, 0.1]), lensPx(50, w * 1.45), w * 0.5, h * 0.47);
  tile(40, 40, 1300, 1820, (gg, sub) => { const cam = heroCam(sub.W, sub.H); renderPencil(gg, sub, withLoaf(theoBaker.toScene(hero.pose, cam), cam, hero.loaf), BAKER_PENCIL, { horizon: sub.H * 0.86, ground: "#b39b7c" }); });
  // the construction: the gesture lay-in alone, then the lay-in with the designed contours
  tile(1380, 40, 540, 760, (gg, sub) => { const cam = heroCam(sub.W, sub.H); renderPencil(gg, sub, withLoaf(theoBaker.toScene(hero.pose, cam), cam, hero.loaf), BAKER_PENCIL, { horizon: sub.H * 0.86, only: ["layin"] }); });
  tile(1940, 40, 520, 760, (gg, sub) => { const cam = heroCam(sub.W, sub.H); renderPencil(gg, sub, withLoaf(theoBaker.toScene(hero.pose, cam), cam, hero.loaf), BAKER_PENCIL, { horizon: sub.H * 0.86, only: ["layin", "line"] }); });
  // the same man turned: front, profile, back (a long lens, so the three read as a turnaround)
  [0, 90, 180].forEach((yaw, i) => tile(1380 + i * 367, 880, 350, 900, (gg, sub) => {
    const b = bakerPose(yaw), cam = camera(add(b.pose.root, [0, -0.1, 11]), add(b.pose.root, [0, -0.1, 0]), (sub.H * 0.9 * 11) / 1.8, sub.W / 2, sub.H * 0.5);
    renderPencil(gg, sub, withLoaf(theoBaker.toScene(b.pose, cam), cam, b.loaf), BAKER_PENCIL, { horizon: sub.H * 0.92 });
  }));
  letter(g, "LAY-IN: THE GESTURE FIRST", 1380, 820, { cap: 16, color: GRAPHITE, seed: 3, w: 1.6 });
  letter(g, "THEN THE DESIGNED CONTOURS", 1940, 820, { cap: 16, color: GRAPHITE, seed: 4, w: 1.6 });
  letter(g, "THEO THE BAKER  /  COLOURED PENCIL  /  RIG UNDERNEATH, DRAWING ON TOP", 1380, 1810, { cap: 17, color: GRAPHITE, seed: 5, w: 1.7 });
};
export const bakerSheet: Film = { meta: { title: "Theo the baker", W, H, fps: 30, bpm: 120, durationFrames: 1 }, assets: { images: {} }, shots: [{ id: "sheet", start: 0, end: 1, draw: drawBakerSheet }] };
