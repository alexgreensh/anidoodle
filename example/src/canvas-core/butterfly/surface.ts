// PART SURFACES. Every part of a plate draws onto its own persistent surface and is composited
// in order. A surface is redrawn only when its KEY changes, and the key names everything the
// pixels depend on, so a cached frame and a cold frame of the same number are identical.
import { Ctx, Env, Gfx, Layer, Medium } from "../core";

export const kk = (...v: (number | string)[]) => v.map((x) => (typeof x === "number" ? x.toFixed(4) : x)).join("|");
export type Slot = { L: Layer; key: string | null };
export const slotOf = (env: Env, name: string, dw: number, dh: number): Slot => {
  const id = `plate:${name}:${dw}x${dh}`; let s = env.cache.get(id) as Slot | undefined;
  if (!s) { s = { L: env.canvas(dw, dh), key: null }; env.cache.set(id, s); }
  return s;
};
export type View = { cx: number; cy: number; zoom: number };
export const WIDE: View = { cx: 540, cy: 540, zoom: 1 };
export const part = (env: Env, medium: Medium, name: string, key: string, boilFrame: number, fn: (g: Gfx) => void, view?: View): Layer => {
  const dw = Math.round(env.W * env.scale), dh = Math.round(env.H * env.scale), s = slotOf(env, name, dw, dh);
  if (s.key !== key) {
    s.L.ctx.setTransform(1, 0, 0, 1, 0, 0); s.L.ctx.globalAlpha = 1; s.L.ctx.globalCompositeOperation = "source-over"; s.L.ctx.clearRect(0, 0, dw, dh);
    const g = new Gfx(s.L.ctx, env, boilFrame, medium);
    if (view && view.zoom !== 1) g.push(env.W / 2 - view.zoom * view.cx, env.H / 2 - view.zoom * view.cy, view.zoom); /* the camera moves the CONTROL POINTS through the transform stack, never the finished pixels */
    fn(g); s.key = key;
  }
  return s.L;
};
export const blit = (ctx: Ctx, L: Layer | null, dx = 0, dy = 0, alpha = 1, op: GlobalCompositeOperation = "source-over") => { if (!L) return; ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = op; ctx.drawImage(L.canvas as CanvasImageSource, dx, dy); ctx.restore(); };
