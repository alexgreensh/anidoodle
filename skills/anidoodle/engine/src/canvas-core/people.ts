// PEOPLE. Real people in a film, placed by the size of their HEAD, not the size of their photo.
// On a brand launch film three speaker cut-outs were placed by photo size and their heads came out
// 370, 270 and 190 px; the director: "ines's image looks bigger than tomas and priya... check proportions".
//   headOf(alpha, w, h)           the head box of a head-and-shoulders cut-out, from its alpha alone
//   placePerson(head, o)          the scale and offset that put that head at headPx tall, crown at crownY
//   drawPerson(ctx, env, o)       draws the cut-out so, and reports "head:<group>/<name>" to the frame
//                                 probe: framecheck fails a group whose heads differ by more than 10 %
//   popOut(ctx, circle, draw)     a person on a disc: the body clipped by the circle, the head free above it
// A per-asset head box from the manifest (o.head) always wins over the detected one.
import { probeRect, type Ctx, type Env } from "./core";

export type Box = { x0: number; y0: number; x1: number; y1: number };

/**
 * The head box of a cut-out from its alpha channel (one byte per pixel, row-major, or RGBA when
 * `stride` is 4). The head is the part above the neck, and the neck is the narrowest row between 12 %
 * and 50 % of the figure's height under its crown that is clearly narrower than both the head above
 * and the shoulders below. With no such row (a head-only crop, an oval portrait) the whole figure is
 * the head. Returns null for an empty image.
 */
export const headOf = (alpha: ArrayLike<number>, w: number, h: number, stride = 1, threshold = 32): Box | null => {
  const left = new Array<number>(h).fill(-1), right = new Array<number>(h).fill(-1);
  let top = -1, bottom = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (alpha[(y * w + x) * stride + (stride - 1)] > threshold) { if (left[y] < 0) left[y] = x; right[y] = x; if (top < 0) top = y; bottom = y; }
  if (top < 0) return null;
  const bh = bottom - top + 1, from = top + Math.max(1, Math.floor(0.12 * bh)), to = Math.min(bottom, top + Math.floor(0.5 * bh));
  const wdOf = (y: number) => (left[y] < 0 ? 0 : right[y] - left[y] + 1);
  // the widest row from each row down (the shoulders a neck must sit on)
  const below = new Array<number>(h + 1).fill(0); for (let y = bottom; y >= top; y--) below[y] = Math.max(below[y + 1], wdOf(y));
  // A neck is a row clearly narrower than the head above it AND the shoulders below it. The top of
  // an oval cut-out or a head-only crop is narrow too, but nothing above it is wider: no neck there.
  let neck = -1, best = Infinity, above = 0;
  for (let y = top; y < from; y++) above = Math.max(above, wdOf(y));
  for (let y = from; y <= to; y++) { const wd = wdOf(y); if (wd > 0 && wd < best && above >= wd * 1.15 && below[y + 1] >= wd * 1.15) { best = wd; neck = y; } above = Math.max(above, wd); }
  // no neck: the whole figure is the head (scaling it by a sliver of its top made the person ~8x too big)
  const end = neck < 0 ? bottom + 1 : neck;
  let x0 = w, x1 = 0; for (let y = top; y < end; y++) if (left[y] >= 0) { x0 = Math.min(x0, left[y]); x1 = Math.max(x1, right[y]); }
  return { x0, y0: top, x1: x1 + 1, y1: end };
};

/** Scale and top-left that draw an image whose head is `head` (image px) at headPx tall, crown at (cx, crownY). */
export const placePerson = (head: Box, o: { cx: number; crownY: number; headPx: number }) => {
  const s = o.headPx / Math.max(1, head.y1 - head.y0);
  return { s, x: o.cx - ((head.x0 + head.x1) / 2) * s, y: o.crownY - head.y0 * s };
};

const headCache = (env: Env, name: string, img: CanvasImageSource & { width: number; height: number }) => {
  const k = `people:head:${name}`; let b = env.cache.get(k) as Box | null | undefined;
  if (b === undefined) { const L = env.canvas(img.width, img.height); L.ctx.drawImage(img, 0, 0); b = headOf(L.ctx.getImageData(0, 0, img.width, img.height).data, img.width, img.height, 4); env.cache.set(k, b); }
  return b;
};

/**
 * Draw the cut-out asset `name` with its head `headPx` tall, centred on cx, crown at crownY (film px),
 * and report the head box to the frame probe as head:<group>/<name>. Returns the placement and the head
 * box on screen. People shown as one sequence share a group and a headPx.
 */
export const drawPerson = (ctx: Ctx, env: Env, o: { name: string; group: string; cx: number; crownY: number; headPx: number; head?: Box; alpha?: number }) => {
  const img = env.image?.(o.name) as (CanvasImageSource & { width: number; height: number }) | undefined;
  if (!img) throw new Error(`drawPerson: no image asset '${o.name}'`);
  const head = o.head ?? headCache(env, o.name, img); if (!head) throw new Error(`drawPerson: '${o.name}' has no opaque pixels (a cut-out needs alpha)`);
  const p = placePerson(head, o);
  ctx.save(); if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  ctx.drawImage(img, p.x, p.y, img.width * p.s, img.height * p.s);
  probeRect(ctx, env, p.x + head.x0 * p.s, p.y + head.y0 * p.s, (head.x1 - head.x0) * p.s, (head.y1 - head.y0) * p.s, `head:${o.group}/${o.name}`);
  ctx.restore();
  return { ...p, head: { x0: p.x + head.x0 * p.s, y0: p.y + head.y0 * p.s, x1: p.x + head.x1 * p.s, y1: p.y + head.y1 * p.s } };
};

/**
 * A person on a disc (the hosts card): `draw` is clipped to the circle below its centre line and free
 * above it, so the body sits in the circle and the head pops out over the rim. The disc itself is the
 * caller's (a coded circle stays a perfect circle).
 */
export const popOut = (ctx: Ctx, c: { cx: number; cy: number; r: number }, draw: () => void) => {
  ctx.save(); ctx.beginPath();
  ctx.arc(c.cx, c.cy, c.r, 0, Math.PI * 2);
  ctx.rect(c.cx - c.r, c.cy - c.r * 4, c.r * 2, c.r * 4); // the band above the centre line, as wide as the disc (same winding: one region)
  ctx.clip(); draw(); ctx.restore();
};
