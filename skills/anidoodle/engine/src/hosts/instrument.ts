// LAYER INSTRUMENTS (hosts only; the art core never sees them). Two jobs, both by watching what a
// frame DRAWS rather than guessing from its pixels:
//
// 1. THE BLUR MASK (render --blur). Motion blur is for the world and the camera. Type and photos are
//    drawn sharp: on a brand launch film, blurred whips on type and faces read as the violent motion
//    the director rejected (critic round 2). While the subframes are drawn, every line of text, every photo
//    (a film asset drawn with drawImage) and everything inside sharp() is left out; the frame is then
//    drawn twice more, whole and without them, and the pixels that differ are taken from the whole
//    sharp frame. What remains is a blurred world under sharp type.
// 2. THE LAYER PROBE (tools/layerscan.mjs). Per frame: every line of text, every photo, every probeRect
//    box (brand elements report themselves through drawEl), in draw order; the fills made in a brand
//    colour at a translucent alpha; and, on request, how much ink one line of text puts on screen
//    (the frame drawn with and without it). layerscan turns these into its findings.
// Only the frame's own context and full-frame sheets (__frame) count: a cached plate is drawn once
// and reused, so leaving text out of it would leave it out forever.
// THE BLUR MASK'S LIMIT. So type drawn into an offscreen layer (a sheet, a bake() sprite, a plate) and
// composited later is NOT kept sharp: it blurs with the world. Neither is 3D type (three-core text3d), which
// is drawn by WebGL, not fillText. sharpLayers counts the layers holding type that a frame composites
// (layerType), so the render can say how much type it could not keep sharp instead of claiming all of it.
import type { Ctx } from "../canvas-core/core";

type Proto = Record<string, (...a: unknown[]) => unknown>;
// src: "fill" a fillText call (setType draws one per character), "probe" a whole line or box the art reported (probeRect, drawEl)
type Rec = { kind: "text" | "box" | "photo"; src: "fill" | "probe" | "image"; label: string; x0: number; y0: number; x1: number; y1: number; alpha: number; order: number };
const protos = (): Proto[] => [CanvasRenderingContext2D.prototype, ...(typeof OffscreenCanvasRenderingContext2D !== "undefined" ? [OffscreenCanvasRenderingContext2D.prototype] : [])] as unknown as Proto[];
const G = globalThis as { __ANIDOODLE_SHARP__?: "skip"; __ANIDOODLE_PROBE__?: (r: { kind: "text" | "box"; label: string; x0: number; y0: number; x1: number; y1: number }) => void };

const boxOf = (c: Ctx, pts: number[][]) => { const T = c.getTransform(), q = pts.map(([u, v]) => [T.a * u + T.c * v + T.e, T.b * u + T.d * v + T.f]); return { x0: Math.min(...q.map((p) => p[0])), y0: Math.min(...q.map((p) => p[1])), x1: Math.max(...q.map((p) => p[0])), y1: Math.max(...q.map((p) => p[1])) }; };
const textBox = (c: Ctx, t: string, x: number, y: number) => {
  const m = c.measureText(t), a = c.textAlign, dx = a === "center" ? -m.width / 2 : a === "right" || a === "end" ? -m.width : 0;
  return boxOf(c, [[x + dx, y - m.actualBoundingBoxAscent], [x + dx + m.width, y - m.actualBoundingBoxAscent], [x + dx, y + m.actualBoundingBoxDescent], [x + dx + m.width, y + m.actualBoundingBoxDescent]]);
};
// drawImage(img, dx, dy), (img, dx, dy, dw, dh) or (img, sx, sy, sw, sh, dx, dy, dw, dh): the destination box
const imageBox = (c: Ctx, img: { width?: number; height?: number }, a: number[]) => {
  const [dx, dy, dw, dh] = a.length >= 8 ? [a[4], a[5], a[6], a[7]] : a.length >= 4 ? a : [a[0], a[1], Number(img.width), Number(img.height)];
  return boxOf(c, [[dx, dy], [dx + dw, dy], [dx, dy + dh], [dx + dw, dy + dh]]);
};
const hex = (s: string) => s.trim().toLowerCase();
const two = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
/**
 * A declared brand colour as the #rrggbb a canvas reports for its fills, or null when it is not one this
 * can read. #rgb, #rgba, #rrggbb, #rrggbbaa, rgb()/rgba() and hsl()/hsla() are read (alpha is ignored:
 * the colour is the brand's, the alpha is what the scan measures). A short "#c41" or an hsl() used to be
 * compared as written, never matched a fill, and the translucent check passed without looking.
 */
export const brandHex = (c: unknown): string | null => {
  if (typeof c !== "string") return null;
  const s = c.trim().toLowerCase();
  let m = /^#([0-9a-f]{3,4})$/.exec(s); if (m) return "#" + [...m[1].slice(0, 3)].map((d) => d + d).join("");
  m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(s); if (m) return "#" + m[1];
  m = /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*(?:[,/]\s*[\d.]+%?\s*)?\)$/.exec(s); if (m) return "#" + [m[1], m[2], m[3]].map((v) => two(Number(v))).join("");
  m = /^hsla?\(\s*([\d.]+)(?:deg)?\s*[, ]\s*([\d.]+)%\s*[, ]\s*([\d.]+)%\s*(?:[,/]\s*[\d.]+%?\s*)?\)$/.exec(s);
  if (m) {
    const h = ((Number(m[1]) % 360) + 360) % 360, sat = Number(m[2]) / 100, l = Number(m[3]) / 100, k = (n: number) => (n + h / 30) % 12, a = sat * Math.min(l, 1 - l);
    const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
    return "#" + [f(0), f(8), f(4)].map((v) => two(v * 255)).join("");
  }
  return null;
};
const colourAlpha = (fill: unknown): { c: string; a: number } | null => {
  if (typeof fill !== "string") return null;
  const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/.exec(fill.replace(/\s+/g, " ").trim());
  if (m) return { c: "#" + [m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, "0")).join(""), a: m[4] === undefined ? 1 : Number(m[4]) };
  return /^#[0-9a-f]{6}$/i.test(fill) ? { c: hex(fill), a: 1 } : null;
};

export const instruments = (o: { ctx: () => Ctx; images: () => Set<unknown>; draw: (frame: number) => void; read: () => Uint8ClampedArray; clearCache?: () => void }) => {
  const own = (c: Ctx & { __frame?: boolean }) => c === o.ctx() || !!c.__frame; // ctx is a getter: the page mounts its context after building the instruments
  // TYPED LAYERS (the blur mask's limit, above). From the first blurred frame on, every surface that is not
  // the frame's own and gets text (or a typed surface drawn into it) is marked, and each frame counts how
  // many marked surfaces it composites. Installed only when a blur runs, so a shipped player is untouched;
  // the film's layer memo is emptied once then so the layers already built are rebuilt and marked.
  const typed = new WeakSet<object>(); let counting = false, layerType = 0, marking = false;
  const mark = () => {
    if (marking) return; marking = true;
    protos().forEach((p) => {
      const ft = p.fillText, st = p.strokeText, di = p.drawImage;
      p.fillText = function (this: Ctx, ...a: unknown[]) { if (!own(this) && String(a[0]).trim()) typed.add(this.canvas); return ft.apply(this, a); };
      p.strokeText = function (this: Ctx, ...a: unknown[]) { if (!own(this) && String(a[0]).trim()) typed.add(this.canvas); return st.apply(this, a); };
      p.drawImage = function (this: Ctx, ...a: unknown[]) { if (typed.has(a[0] as object)) { if (own(this)) { if (counting) layerType++; } else typed.add(this.canvas); } return di.apply(this, a); };
    });
    o.clearCache?.();
  };
  // hide: leave text / photos out of the frame's own drawing while fn runs. Restores the prototypes even on a throw.
  const hiding = <T>(what: { text?: boolean | string; photo?: boolean }, fn: () => T): T => {
    const ps = protos(), saved = ps.map((p) => ({ fillText: p.fillText, strokeText: p.strokeText, drawImage: p.drawImage })), imgs = o.images();
    const skipText = (t: unknown) => what.text === true || (typeof what.text === "string" && String(t) === what.text);
    ps.forEach((p, i) => {
      for (const k of ["fillText", "strokeText"] as const) { const f = saved[i][k]; p[k] = function (this: Ctx, ...a: unknown[]) { if (own(this) && skipText(a[0])) return; return f.apply(this, a); }; }
      const d = saved[i].drawImage; p.drawImage = function (this: Ctx, ...a: unknown[]) { if (what.photo && own(this) && imgs.has(a[0])) return; return d.apply(this, a); };
    });
    const prev = G.__ANIDOODLE_SHARP__; if (what.text === true || what.photo) G.__ANIDOODLE_SHARP__ = "skip";
    try { return fn(); } finally { ps.forEach((p, i) => Object.assign(p, saved[i])); G.__ANIDOODLE_SHARP__ = prev; }
  };

  /**
   * The sharp layers of frame n: [mask of pixels the type/photos/sharp() own, the whole sharp frame], or null
   * when the frame has none. layerType: how many layers holding type the frame composites (those blur).
   */
  const sharpLayers = (n: number) => {
    mark(); layerType = 0; counting = true;
    try { o.draw(n); } finally { counting = false; }
    const whole = o.read().slice(), lt = layerType;
    hiding({ text: true, photo: true }, () => o.draw(n)); const bare = o.read();
    const mask = new Uint8Array(whole.length / 4); let any = 0;
    for (let i = 0, p = 0; p < whole.length; i++, p += 4) if (whole[p] !== bare[p] || whole[p + 1] !== bare[p + 1] || whole[p + 2] !== bare[p + 2] || whole[p + 3] !== bare[p + 3]) { mask[i] = 1; any++; }
    return any || lt ? { mask, whole, count: any, layerType: lt } : null;
  };
  /** Run fn (the subframe loop) with the sharp layers left out. */
  const withoutSharp = <T>(fn: () => T) => hiding({ text: true, photo: true }, fn);

  /** Layer records for each frame asked, in draw order, plus brand-colour fills at a translucent alpha. */
  const layers = (frames: number[], brand: string[] = []) => {
    // declared colours are read as #rrggbb (brandHex); one that cannot be read is returned in `unread`, and
    // layerscan fails the translucent check on it rather than comparing a colour no fill can match
    const unread = brand.filter((c) => !brandHex(c)), brandSet = new Set(brand.map(brandHex).filter((c): c is string => !!c));
    const out: { frame: number; recs: Rec[]; translucent: { colour: string; alpha: number }[]; unread?: string[] }[] = [], ps = protos(), imgs = o.images();
    const saved = ps.map((p) => ({ fillText: p.fillText, drawImage: p.drawImage, fill: p.fill, fillRect: p.fillRect, stroke: p.stroke }));
    let recs: Rec[] = [], tr: { colour: string; alpha: number }[] = [], order = 0;
    const brandFill = (c: Ctx, style: unknown) => { if (!brandSet.size || !own(c)) return; const ca = colourAlpha(style); if (!ca || !brandSet.has(ca.c)) return; const a = c.globalAlpha * ca.a; if (a > 0.05 && a < 0.95) tr.push({ colour: ca.c, alpha: +a.toFixed(3) }); };
    ps.forEach((p, i) => {
      const s = saved[i];
      p.fillText = function (this: Ctx, ...a: unknown[]) { if (own(this) && this.globalAlpha >= 0.1 && String(a[0]).trim()) recs.push({ kind: "text", src: "fill", label: String(a[0]), ...textBox(this, String(a[0]), Number(a[1]), Number(a[2])), alpha: this.globalAlpha, order: order++ }); return s.fillText.apply(this, a); };
      p.drawImage = function (this: Ctx, ...a: unknown[]) { if (own(this) && imgs.has(a[0])) recs.push({ kind: "photo", src: "image", label: String((a[0] as { __name?: string }).__name ?? "image"), ...imageBox(this, a[0] as { width?: number; height?: number }, a.slice(1).map(Number)), alpha: this.globalAlpha, order: order++ }); return s.drawImage.apply(this, a); };
      p.fill = function (this: Ctx, ...a: unknown[]) { brandFill(this, this.fillStyle); return s.fill.apply(this, a); };
      p.fillRect = function (this: Ctx, ...a: unknown[]) { brandFill(this, this.fillStyle); return s.fillRect.apply(this, a); };
      p.stroke = function (this: Ctx, ...a: unknown[]) { brandFill(this, this.strokeStyle); return s.stroke.apply(this, a); };
    });
    const prevProbe = G.__ANIDOODLE_PROBE__;
    G.__ANIDOODLE_PROBE__ = (r) => { recs.push({ ...r, src: "probe", alpha: 1, order: order++ }); };
    try { for (const f of frames) { recs = []; tr = []; order = 0; o.draw(f); out.push({ frame: f, recs, translucent: tr, ...(unread.length ? { unread } : {}) }); } }
    finally { ps.forEach((p, i) => Object.assign(p, saved[i])); G.__ANIDOODLE_PROBE__ = prevProbe; }
    return out;
  };

  /** Visible ink of the text inside each box on frame n: pixels that change when ALL text is left out, counted per box (device px). */
  const ink = (n: number, boxes: { x0: number; y0: number; x1: number; y1: number }[], width: number) => {
    o.draw(n); const whole = o.read().slice();
    hiding({ text: true }, () => o.draw(n)); const bare = o.read(), height = whole.length / 4 / width;
    return boxes.map((b) => {
      let k = 0; const x0 = Math.max(0, Math.floor(b.x0)), x1 = Math.min(width, Math.ceil(b.x1)), y0 = Math.max(0, Math.floor(b.y0)), y1 = Math.min(height, Math.ceil(b.y1));
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const p = (y * width + x) * 4; if (Math.abs(whole[p] - bare[p]) + Math.abs(whole[p + 1] - bare[p + 1]) + Math.abs(whole[p + 2] - bare[p + 2]) > 24) k++; }
      return k;
    });
  };
  return { sharpLayers, withoutSharp, layers, ink };
};
