// Two small films for checking scored picture, precise sonic marks, and the finished mix.
import type { Film } from "./film";
import type { Ctx } from "./core";
import { brokenBeat, synthPopHouse } from "./music/pieces/modern";
import { filmSound, type SoundPlan } from "./music/sound-design";

const W = 1080, FPS = 30, FRAMES = 240;
export const showcaseSound = (variant: "color" | "ink"): SoundPlan => ({
  fps: FPS, frames: FRAMES, master: "dense", duckDb: 4,
  ambience: { level: 0.1, seed: variant === "color" ? 7 : 13 },
  cues: [
    { frame: 30, kind: "click", strength: 0.55 },
    { frame: 76, kind: "whoosh", lengthFrames: 18, strength: 0.58, pan: -0.2 },
    { frame: 90, kind: variant === "color" ? "impact" : "ink", strength: 0.8, pan: 0.1 },
    { frame: 150, kind: "paper", strength: 0.5 },
    { frame: 195, kind: "riser", lengthFrames: 25, strength: 0.45 },
    { frame: 195, kind: "impact", strength: 0.8 },
  ],
});

const circle = (ctx: Ctx, x: number, y: number, radius: number, color: string) => {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
};
const film = (variant: "color" | "ink"): Film => ({
  meta: { title: variant === "color" ? "Color arrives" : "Ink takes shape", W, H: W, fps: FPS, bpm: 120, durationFrames: FRAMES, raster: "cpu", kind: "story" },
  assets: { images: {} },
  shots: [
    { id: "first", start: 0, end: 90, draw: (ctx, t) => {
      ctx.fillStyle = variant === "color" ? "#101a31" : "#f4f0e6"; ctx.fillRect(0, 0, W, W);
      circle(ctx, 190 + 4 * t, 540, 90 + 1.8 * t, variant === "color" ? "#72d7e6" : "#252d3b");
    } },
    { id: "answer", start: 90, end: 195, draw: (ctx, t) => {
      ctx.fillStyle = variant === "color" ? "#17233d" : "#eee9db"; ctx.fillRect(0, 0, W, W);
      circle(ctx, 540, 540, 150 + t * 4.0, variant === "color" ? "#eabc62" : "#343c52");
      circle(ctx, 540 + t, 540 - t, 12 + t / 3, variant === "color" ? "#f3eee7" : "#c15845");
    } },
    { id: "final", start: 195, end: FRAMES, draw: (ctx, t) => {
      ctx.fillStyle = variant === "color" ? "#263f57" : "#e6e0ce"; ctx.fillRect(0, 0, W, W);
      circle(ctx, 540, 540, 310 + t * 2.3, variant === "color" ? "#eabc62" : "#343c52");
      circle(ctx, 540, 540, 70 + t * 0.15, variant === "color" ? "#263f57" : "#e6e0ce");
    } },
  ],
  audio: filmSound(variant === "color" ? synthPopHouse() : brokenBeat(), showcaseSound(variant)),
});
export const colorArrives = film("color");
export const inkTakesShape = film("ink");
