// THE WEB PROFILE. A plate draws a character in ~130 ms at DPR 2 (every stroke ribboned, every group
// blurred and toothed). A web page has 6. So an interactive piece does the drawing ONCE, at mount,
// into sprites, and each frame is a composite of sprites plus a handful of live marks.
//
// A sprite is a pure function of its key (and env.scale, which the key includes): contract rule 5.
// It is cropped to exactly the device box the drawing touched, at integer device pixels, so an
// untransformed blit puts back the very pixels the plate drew. Moving parts are blitted with a
// rotation or a DOWN-scale about a pivot, never an up-scale (contract rule 6).
import { Env, Gfx, Layer, Medium, PENCIL, type Ctx, type Rect } from "./core";

export type Sprite = { c: CanvasImageSource; x: number; y: number; w: number; h: number };
export const stats = { baked: 0, bytes: 0, ms: 0 }; // for the host's report only; pixels never read it

const resettable = (c: unknown) => !!c && typeof (c as { reset?: unknown }).reset === "function";
const scratch = (env: Env): Layer => {
  const DW = Math.round(env.W * env.scale), DH = Math.round(env.H * env.scale), key = `bake:scratch:${DW}x${DH}`;
  let L = env.cache.get(key) as Layer | undefined;
  if (L && resettable(L.ctx)) (L.ctx as unknown as { reset(): void }).reset(); else { L = env.canvas(DW, DH); env.cache.set(key, L); } /* see bake(): pristine, or new */
  return L;
};

// Draw `fn` with a fresh Gfx on a clean full-size scratch, crop what it composited, cache it.
export const bake = (env: Env, key: string, fn: (g: Gfx) => void, o: { medium?: Medium; frame?: number; full?: boolean; raw?: boolean } = {}): Sprite => {
  const k = `sprite:${key}@${env.scale}`, hit = env.cache.get(k) as Sprite | undefined; if (hit) return hit;
  const S = scratch(env), DW = Math.round(env.W * env.scale), DH = Math.round(env.H * env.scale), c = S.ctx;
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = "source-over"; c.clearRect(0, 0, DW, DH);
  // Every bake starts from pristine surfaces. Measured in Chromium: a 2D canvas that has EVER filled
  // with a gradient (Gfx.glow, Gfx.vignette) rasterises later drawing differently, up to 8/255, even
  // after its pixels are cleared and its fillStyle reset. The layer pool and the scratch are shared, so
  // without this a sprite depended on which sprites were baked before it (the replay gate caught it
  // as cold != warm). ctx.reset() restores a canvas completely; where it is missing, drop the pool.
  const pool = env.cache.get(`pool:${DW}x${DH}`) as (Layer & { dirty?: unknown })[] | undefined;
  if (pool) { if (resettable(pool[0]?.ctx)) pool.forEach((L) => { (L.ctx as unknown as { reset(): void }).reset(); L.dirty = null; }); else pool.length = 0; }
  const g = new Gfx(c, env, o.frame ?? 0, o.medium ?? PENCIL); fn(g);
  const r: Rect = o.full || !g.drawn ? [0, 0, DW, DH] : g.drawn, w = Math.max(1, r[2] - r[0]), h = Math.max(1, r[3] - r[1]);
  let L = env.canvas(w, h); L.ctx.drawImage(S.canvas as CanvasImageSource, r[0], r[1], w, h, 0, 0, w, h);
  c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, DW, DH);
  const P = env.cache.get("bake:paper") as { data: Uint8ClampedArray; DW: number } | undefined;
  if (P && !o.raw) L = sheeted(env, L, r[0], r[1], w, h, P);
  const s: Sprite = { c: L.canvas as CanvasImageSource, x: r[0], y: r[1], w, h }; env.cache.set(k, s);
  stats.baked++; stats.bytes += w * h * 4;
  return s;
};

// Blit at rest, offset by whole device pixels: crisp, and exactly the baked pixels.
export const blit = (ctx: Ctx, s: Sprite, dx = 0, dy = 0, alpha = 1) => {
  if (alpha <= 0) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = alpha; ctx.drawImage(s.c, s.x + Math.round(dx), s.y + Math.round(dy)); ctx.globalAlpha = 1;
};
// Blit rotated by `deg` and scaled by (sx, sy) <= 1 about a device-pixel pivot, then moved by (tx, ty).
// Falls back to the crisp path when there is nothing to transform.
export const blitT = (ctx: Ctx, s: Sprite, pivot: [number, number], deg: number, tx: number, ty: number, sx = 1, sy = 1, alpha = 1) => {
  if (alpha <= 0) return;
  const kx = Math.min(1, sx), ky = Math.min(1, sy);
  if (Math.abs(deg) < 0.05 && kx === 1 && ky === 1) return blit(ctx, s, tx, ty, alpha);
  const a = (deg * Math.PI) / 180, c = Math.cos(a), n = Math.sin(a);
  ctx.setTransform(c * kx, n * kx, -n * ky, c * ky, pivot[0] + tx, pivot[1] + ty); ctx.globalAlpha = alpha;
  ctx.drawImage(s.c, s.x - pivot[0], s.y - pivot[1]);
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1;
};

// The sheet over everything, as ONE multiply. Gfx.paper() multiplies a tile at an opacity; applied to
// white that leaves exactly the per-pixel factor, and two factors multiply into one. So a plate's
// `paper("paper", .13); paper("coldpress", .2)` becomes one full-canvas blit per frame.
export const paperFactor = (env: Env, sheets: [string, number][]): Sprite => bake(env, `paper:${sheets.map((s) => s.join("=")).join(",")}`, (g) => {
  const m = g.main; m.setTransform(1, 0, 0, 1, 0, 0); m.fillStyle = "#ffffff"; m.fillRect(0, 0, Math.round(env.W * env.scale), Math.round(env.H * env.scale));
  sheets.forEach(([kind, a]) => g.paper(kind, a));
}, { full: true, raw: true });
// PAPER IN THE SPRITES. (a over b) x F == (a x F) over (b x F): multiply by a per-pixel factor
// distributes over source-over. So instead of one full-canvas multiply every frame, every sprite is
// multiplied ONCE, at bake, by the sheet factor under its rest position, and the frame needs no
// sheet pass at all. Exact for anything drawn where it was baked; a part that moves carries its
// patch of paper grain with it (a few percent of tone, invisible in motion). usePaper() turns it on
// for every later bake in this env; the factor itself and anything baked { raw: true } are exempt.
export const usePaper = (env: Env, sheets: [string, number][]) => {
  if (env.cache.has("bake:paper")) return;
  const f = paperFactor(env, sheets), DW = Math.round(env.W * env.scale), DH = Math.round(env.H * env.scale), R = env.canvas(DW, DH);
  R.ctx.drawImage(f.c, 0, 0); env.cache.set("bake:paper", { data: R.ctx.getImageData(0, 0, DW, DH).data, DW });
};
// read once, multiply in integers, write into a FRESH surface (one that is never read back stays on the GPU)
const sheeted = (env: Env, L: Layer, x0: number, y0: number, w: number, h: number, P: { data: Uint8ClampedArray; DW: number }): Layer => {
  const img = L.ctx.getImageData(0, 0, w, h), d = img.data, f = P.data;
  for (let y = 0; y < h; y++) { let i = y * w * 4, j = ((y0 + y) * P.DW + x0) * 4; for (let x = 0; x < w; x++, i += 4, j += 4) { if (!d[i + 3]) continue; d[i] = (d[i] * f[j] + 127) / 255; d[i + 1] = (d[i + 1] * f[j + 1] + 127) / 255; d[i + 2] = (d[i + 2] * f[j + 2] + 127) / 255; } }
  const out = env.canvas(w, h); out.ctx.putImageData(img, 0, 0); return out;
};
export const multiply = (ctx: Ctx, s: Sprite) => { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = "multiply"; ctx.drawImage(s.c, s.x, s.y); ctx.globalCompositeOperation = "source-over"; };

// A Gfx that runs only SOME of a plate's groups: bake one part of a character from the plate's own
// drawing function, unchanged, by the index of the group calls it makes. `census` lists them.
export class Only extends Gfx {
  n = 0; census: string[] = [];
  constructor(main: Ctx, env: Env, frame: number, medium: Medium, public keep: (i: number) => boolean) { super(main, env, frame, medium); }
  group(kind: "ink" | "paint" | "plain", fn: () => void, opts: Parameters<Gfx["group"]>[2] = {}) { const i = this.n++; this.census.push(kind); if (this.keep(i)) super.group(kind, fn, opts); }
  inkGroup(fn: () => void, o: Parameters<Gfx["inkGroup"]>[1] = {}) { const i = this.n++; this.census.push("inkGroup"); if (this.keep(i)) super.inkGroup(fn, o); }
}
// bake() for a part of a plate: `draw(g)` receives an Only that keeps groups in `keep`.
export const bakePart = (env: Env, key: string, keep: (i: number) => boolean, draw: (g: Gfx) => void, o: { medium?: Medium; frame?: number } = {}): Sprite =>
  bake(env, key, (g0) => { const g = new Only(g0.main, env, o.frame ?? 0, o.medium ?? PENCIL, keep); draw(g); g0.drawn = g.drawn; }, o);
