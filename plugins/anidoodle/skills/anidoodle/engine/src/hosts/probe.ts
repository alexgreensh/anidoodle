// THE FRAME PROBE (tools/framecheck.mjs), host side. For each frame asked, every line of text (fillText on
// the frame or a full-frame sheet, writeOn, setType) and every content box the art core reports
// (probeRect: a card, a window) is collected in device pixels; a box the frame's edge cuts through
// is returned. Whatever lies wholly outside the frame, or wholly inside it, is fine. With `all`, every
// visible line of text is returned too (cut: false when whole), for the checks that judge where
// text sits (the 9:16 safe zones, textrules.mjs).
// Text is followed through offscreen layers: every fillText/strokeText on ANY surface is recorded in
// that surface's own pixels, and a drawImage of a surface carries its text onto the surface it is
// drawn into (through the source rectangle, the destination rectangle and the current transform).
// So text a film sets on a sheet and composites later is seen exactly like text on the frame
// (the reading-time check was blind to it before). A full clearRect, or an opaque full fillRect,
// forgets a surface's text. Each text record also carries its alpha, its type size in device px,
// its font family and the texture mark (texture(): words not meant to be read).
//
// It lives in its own module (page.ts mounts it) so the unit tests can drive it with a stand-in
// canvas in node: test/probe.test.ts.
import type { Ctx, ProbeRec } from "../canvas-core/core";

type TextRec = ProbeRec & { alpha: number; px: number; family: string; texture?: boolean };
type B = { x0: number; y0: number; x1: number; y1: number };
export type ProbeOut = (ProbeRec | TextRec) & { frame: number; cut?: boolean };

/**
 * canvas/ctx are getters (the page mounts a new context at each scale). seek draws one frame.
 * clearCache empties the film's layer memo (env.cache): a pure memo, so emptying it changes no pixel.
 */
export const frameProbe = (o: { canvas: () => { width: number; height: number }; ctx: () => Ctx; seek: (frame: number) => void; clearCache: () => void }) => (frames: number[], all = false) => {
  const canvas = o.canvas(), ctx = o.ctx();
  const out: ProbeOut[] = [], g = globalThis as { __ANIDOODLE_PROBE__?: (r: ProbeRec) => void };
  type Proto = Record<string, (...a: unknown[]) => void>;
  const protos = [CanvasRenderingContext2D.prototype, ...(typeof OffscreenCanvasRenderingContext2D !== "undefined" ? [OffscreenCanvasRenderingContext2D.prototype] : [])] as unknown as Proto[];
  const names = ["fillText", "strokeText", "drawImage", "clearRect", "fillRect", "beginPath", "rect", "roundRect", "arc", "arcTo", "ellipse", "moveTo", "lineTo", "bezierCurveTo", "quadraticCurveTo", "clip", "save", "restore", "reset"] as const, orig = protos.map((p) => Object.fromEntries(names.map((n) => [n, p[n]])) as Proto);
  const texts = new WeakMap<object, TextRec[]>(), of = (c: object) => { let l = texts.get(c); if (!l) texts.set(c, (l = [])); return l; };
  const box = (T: DOMMatrix, pts: number[][]) => { const q = pts.map(([u, v]) => [T.a * u + T.c * v + T.e, T.b * u + T.d * v + T.f]); return { x0: Math.min(...q.map((p) => p[0])), y0: Math.min(...q.map((p) => p[1])), x1: Math.max(...q.map((p) => p[0])), y1: Math.max(...q.map((p) => p[1])) }; };
  const zoom = (T: DOMMatrix) => Math.sqrt(Math.abs(T.a * T.d - T.b * T.c));
  // CLIPS. A text drawn under a clip (an input field that scrolls its text, a mask a line rises through)
  // is seen only inside it. The probe keeps each context's clip as the bounding box of the path it was
  // made from (rect, roundRect, arc, arcTo, ellipse, lines and curves, in device px), intersected down the
  // save/restore stack, and cuts every text box to it; a text wholly outside its clip is not drawn.
  // A clip the probe cannot measure (a Path2D, or a path with no area it could read) is treated as no
  // clip: the text stays in view of the checks. Reading an unknown clip as "clips everything" made every
  // line under it vanish, and the checks then passed on text they never saw.
  const clipOf = new WeakMap<object, { box: B | null; stack: (B | null)[]; path: B | null }>(), cs = (c: object) => { let v = clipOf.get(c); if (!v) clipOf.set(c, (v = { box: null, stack: [], path: null })); return v; };
  const meet = (a: B | null, b: B | null): B | null => (!a ? b : !b ? a : { x0: Math.max(a.x0, b.x0), y0: Math.max(a.y0, b.y0), x1: Math.min(a.x1, b.x1), y1: Math.min(a.y1, b.y1) });
  const grow = (c: Ctx, pts: number[][]) => { const st = cs(c), r = box(c.getTransform(), pts); st.path = st.path ? { x0: Math.min(st.path.x0, r.x0), y0: Math.min(st.path.y0, r.y0), x1: Math.max(st.path.x1, r.x1), y1: Math.max(st.path.y1, r.y1) } : r; };
  const clipped = <T extends B>(c: Ctx, t: T): T | null => { const k = clipOf.get(c)?.box; if (!k) return t; const m = meet(t, k)!; return m.x1 - m.x0 <= 0.5 || m.y1 - m.y0 <= 0.5 ? null : { ...t, ...m }; };
  const text = function (this: Ctx & { __texture?: boolean }, t: string, x: number, y: number) {
    if (!String(t).trim() || this.globalAlpha < 0.01) return;
    const m = this.measureText(t), a = this.textAlign, dx = a === "center" ? -m.width / 2 : a === "right" || a === "end" ? -m.width : 0, T = this.getTransform();
    const fm = /(\d+(?:\.\d+)?)px\s*(.*)$/.exec(this.font), px = (fm ? Number(fm[1]) : 10) * zoom(T), family = (fm?.[2] ?? "").split(",")[0].trim().replace(/^["']|["']$/g, "");
    const rec = clipped(this, { kind: "text" as const, label: String(t), ...box(T, [[x + dx, y - m.actualBoundingBoxAscent], [x + dx + m.width, y - m.actualBoundingBoxAscent], [x + dx, y + m.actualBoundingBoxDescent], [x + dx + m.width, y + m.actualBoundingBoxDescent]]), alpha: this.globalAlpha, px, family, texture: this.__texture || undefined });
    if (rec) of(this.canvas).push(rec);
  };
  const opaque = new WeakSet<object>(); // surfaces whose last full-size fill was opaque: drawn at alpha 1 they cover what is under them
  const solid = (c: Ctx) => c.globalAlpha >= 1 && c.globalCompositeOperation === "source-over" && typeof c.fillStyle === "string" && !/rgba|hsla|transparent|#[0-9a-f]{4}$|#[0-9a-f]{8}$/i.test(c.fillStyle);
  const full = (c: Ctx, x: number, y: number, w: number, h: number) => { const r = box(c.getTransform(), [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]); return r.x0 <= 0 && r.y0 <= 0 && r.x1 >= c.canvas.width && r.y1 >= c.canvas.height; };
  const forget = (c: Ctx, x: number, y: number, w: number, h: number) => {
    const l = texts.get(c.canvas); if (!l?.length) return;
    const r = box(c.getTransform(), [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]), cw = c.canvas.width, ch = c.canvas.height;
    if (r.x0 <= 0 && r.y0 <= 0 && r.x1 >= cw && r.y1 >= ch) { l.length = 0; return; }
    // what lies wholly under an opaque fill is covered: the viewer cannot see it, so it is no longer drawn text
    texts.set(c.canvas, l.filter((t) => !(t.x0 >= r.x0 && t.y0 >= r.y0 && t.x1 <= r.x1 && t.y1 <= r.y1)));
  };
  const isPath2D = (v: unknown) => typeof Path2D !== "undefined" && v instanceof Path2D;
  protos.forEach((p, i) => {
    p.fillText = function (this: Ctx, ...a: unknown[]) { text.call(this, a[0] as string, a[1] as number, a[2] as number); return orig[i].fillText.apply(this, a); };
    p.strokeText = function (this: Ctx, ...a: unknown[]) { text.call(this, a[0] as string, a[1] as number, a[2] as number); return orig[i].strokeText.apply(this, a); };
    p.clearRect = function (this: Ctx, ...a: unknown[]) { const q = a as [number, number, number, number]; forget(this, ...q); if (full(this, ...q)) opaque.delete(this.canvas); return orig[i].clearRect.apply(this, a); };
    p.fillRect = function (this: Ctx, ...a: unknown[]) { const q = a as [number, number, number, number]; if (solid(this)) { forget(this, ...q); if (full(this, ...q)) opaque.add(this.canvas); } return orig[i].fillRect.apply(this, a); };
    p.drawImage = function (this: Ctx, ...a: unknown[]) {
      const src = texts.get(a[0] as object), s = a[0] as { width: number; height: number }, n = a.length;
      const [sx, sy, sw, sh, dx, dy, dw, dh] = (n >= 9 ? a.slice(1, 9) : n >= 5 ? [0, 0, s.width, s.height, ...a.slice(1, 5)] : [0, 0, s.width, s.height, a[1], a[2], s.width, s.height]) as number[];
      if (opaque.has(a[0] as object) && this.globalAlpha >= 1 && this.globalCompositeOperation === "source-over") forget(this, dx, dy, dw, dh); // an opaque sheet covers what was under it
      if (src?.length && this.globalAlpha >= 0.01) {
        const kx = dw / sw, ky = dh / sh, T = this.getTransform(), z = zoom(T) * Math.sqrt(Math.abs(kx * ky)), dst = of(this.canvas);
        for (const t of src) {
          if (t.x1 <= sx || t.x0 >= sx + sw || t.y1 <= sy || t.y0 >= sy + sh) continue; // outside the source rectangle: not drawn
          const u0 = dx + (t.x0 - sx) * kx, v0 = dy + (t.y0 - sy) * ky, u1 = dx + (t.x1 - sx) * kx, v1 = dy + (t.y1 - sy) * ky;
          const rec = clipped(this, { ...t, ...box(T, [[u0, v0], [u1, v0], [u0, v1], [u1, v1]]), alpha: t.alpha * this.globalAlpha, px: t.px * z }); if (rec) dst.push(rec);
        }
      }
      return orig[i].drawImage.apply(this, a);
    };
    const num = (a: unknown[]) => a as number[];
    p.beginPath = function (this: Ctx, ...a: unknown[]) { cs(this).path = null; return orig[i].beginPath.apply(this, a); };
    p.rect = function (this: Ctx, ...a: unknown[]) { const [x, y, w, h] = num(a); grow(this, [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]); return orig[i].rect.apply(this, a); };
    if (orig[i].roundRect) p.roundRect = function (this: Ctx, ...a: unknown[]) { const [x, y, w, h] = num(a); grow(this, [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]); return orig[i].roundRect.apply(this, a); };
    p.arc = function (this: Ctx, ...a: unknown[]) { const [x, y, r] = num(a); grow(this, [[x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r]]); return orig[i].arc.apply(this, a); };
    // arcTo (rounded rects built by hand, launchKit rr()): the arc lies inside the triangle of the pen, the
    // corner and the far point, so the two control points bound it with the pen already in the box
    if (orig[i].arcTo) p.arcTo = function (this: Ctx, ...a: unknown[]) { const q = num(a); grow(this, [[q[0], q[1]], [q[2], q[3]]]); return orig[i].arcTo.apply(this, a); };
    p.ellipse = function (this: Ctx, ...a: unknown[]) { const [x, y, rx, ry] = num(a), r = Math.max(rx, ry); grow(this, [[x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r]]); return orig[i].ellipse.apply(this, a); };
    p.moveTo = function (this: Ctx, ...a: unknown[]) { const [x, y] = num(a); grow(this, [[x, y]]); return orig[i].moveTo.apply(this, a); };
    p.lineTo = function (this: Ctx, ...a: unknown[]) { const [x, y] = num(a); grow(this, [[x, y]]); return orig[i].lineTo.apply(this, a); };
    p.bezierCurveTo = function (this: Ctx, ...a: unknown[]) { const q = num(a); grow(this, [[q[0], q[1]], [q[2], q[3]], [q[4], q[5]]]); return orig[i].bezierCurveTo.apply(this, a); };
    p.quadraticCurveTo = function (this: Ctx, ...a: unknown[]) { const q = num(a); grow(this, [[q[0], q[1]], [q[2], q[3]]]); return orig[i].quadraticCurveTo.apply(this, a); };
    p.clip = function (this: Ctx, ...a: unknown[]) {
      const st = cs(this), b = st.path;
      // only a clip with a measured area narrows what the checks see; anything else is an unknown clip (see CLIPS)
      if (!isPath2D(a[0]) && b && b.x1 - b.x0 > 0.5 && b.y1 - b.y0 > 0.5) st.box = meet(st.box, b);
      return orig[i].clip.apply(this, a);
    };
    p.save = function (this: Ctx, ...a: unknown[]) { const st = cs(this); st.stack.push(st.box); return orig[i].save.apply(this, a); };
    p.restore = function (this: Ctx, ...a: unknown[]) { const st = cs(this); st.box = st.stack.length ? st.stack.pop()! : null; return orig[i].restore.apply(this, a); };
    if (orig[i].reset) p.reset = function (this: Ctx, ...a: unknown[]) { clipOf.delete(this); return orig[i].reset.apply(this, a); };
  });
  let frame = 0;
  // boxes the art reports (probeRect) join the frame's own list, so an opaque fill drawn over them covers them too
  g.__ANIDOODLE_PROBE__ = (r) => { of(canvas).push({ ...r, alpha: 1, px: undefined as unknown as number, family: "" }); };
  try {
    // Text records live only as long as this call (the hooks come off at the end). A layer the film built
    // once and reuses (a bake() sprite, a plate that skips its redraw) carries records only if it is drawn
    // under these hooks, so EVERY call starts by emptying the film's layer memo and each layer is rebuilt
    // here. Emptying it only on the first call left reused layers without records from the second batch
    // on (framecheck asks 40 frames at a time), and every text check then passed on text it never saw.
    // Plate frames from the bake store are the one blind spot left: framecheck opens the page with the bake cache off.
    o.clearCache();
    for (frame of frames) {
      of(canvas).length = 0; clipOf.delete(ctx); o.seek(frame); const W = canvas.width, H = canvas.height, tol = 1.5;
      for (const r of of(canvas).filter((t) => t.alpha >= 0.1)) { const inter = r.x1 > 0 && r.x0 < W && r.y1 > 0 && r.y0 < H, inside = r.x0 >= -tol && r.y0 >= -tol && r.x1 <= W + tol && r.y1 <= H + tol; if (inter && !inside) out.push({ ...r, frame }); else if (all && inter) out.push({ ...r, frame, cut: false }); }
    }
  } finally { protos.forEach((p, i) => names.forEach((n) => { if (orig[i][n]) p[n] = orig[i][n]; })); delete g.__ANIDOODLE_PROBE__; }
  return out;
};
