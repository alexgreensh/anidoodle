// A STAND-IN 2D CANVAS for the host instrument tests (probe.test.ts, instrument.test.ts). Node has no
// canvas, and the probes only need what they hook: the prototype methods, a transform, a save/restore
// stack, measureText, and pixels for the instruments that compare two draws. Pixels are a plain RGBA
// buffer; fillText paints its measured box solid, fillRect paints its rectangle, drawImage copies at
// integer offsets. Install it as globalThis.CanvasRenderingContext2D before a probe runs.
export type M = { a: number; b: number; c: number; d: number; e: number; f: number };
export class FakeCtx {
  canvas: FakeCanvas; globalAlpha = 1; globalCompositeOperation = "source-over"; textAlign = "left"; font = "20px Sans"; fillStyle: string = "#000000"; strokeStyle: string = "#000000";
  T: M = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; stack: M[] = [];
  constructor(c: FakeCanvas) { this.canvas = c; }
  getTransform() { return { ...this.T }; }
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number) { this.T = { a, b, c, d, e, f }; }
  translate(x: number, y: number) { this.T = { ...this.T, e: this.T.e + this.T.a * x + this.T.c * y, f: this.T.f + this.T.b * x + this.T.d * y }; }
  scale(x: number, y: number) { this.T = { ...this.T, a: this.T.a * x, b: this.T.b * x, c: this.T.c * y, d: this.T.d * y }; }
  save() { this.stack.push({ ...this.T }); }
  restore() { this.T = this.stack.pop() ?? this.T; }
  reset() { this.T = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; this.stack = []; this.canvas.px.fill(0); }
  measureText(t: string) { const s = Number(/(\d+)px/.exec(this.font)?.[1] ?? 10); return { width: t.length * s * 0.5, actualBoundingBoxAscent: s * 0.75, actualBoundingBoxDescent: s * 0.25 }; }
  private paint(x0: number, y0: number, x1: number, y1: number, rgb: [number, number, number]) {
    const { width: W, height: H, px } = this.canvas, T = this.T;
    const X0 = Math.max(0, Math.floor(T.a * x0 + T.e)), Y0 = Math.max(0, Math.floor(T.d * y0 + T.f)), X1 = Math.min(W, Math.ceil(T.a * x1 + T.e)), Y1 = Math.min(H, Math.ceil(T.d * y1 + T.f));
    for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) { const p = (y * W + x) * 4; px[p] = rgb[0]; px[p + 1] = rgb[1]; px[p + 2] = rgb[2]; px[p + 3] = 255; }
  }
  fillText(t: string, x: number, y: number) { const m = this.measureText(t); this.paint(x, y - m.actualBoundingBoxAscent, x + m.width, y + m.actualBoundingBoxDescent, [255, 255, 255]); }
  strokeText(t: string, x: number, y: number) { this.fillText(t, x, y); }
  fillRect(x: number, y: number, w: number, h: number) { this.paint(x, y, x + w, y + h, [40, 40, 40]); }
  clearRect(x: number, y: number, w: number, h: number) { const { width: W, height: H, px } = this.canvas; for (let yy = Math.max(0, y); yy < Math.min(H, y + h); yy++) for (let xx = Math.max(0, x); xx < Math.min(W, x + w); xx++) px.fill(0, (yy * W + xx) * 4, (yy * W + xx) * 4 + 4); }
  drawImage(src: FakeCanvas, dx: number, dy: number) {
    const { width: W, height: H, px } = this.canvas, ox = Math.round(this.T.a * dx + this.T.e), oy = Math.round(this.T.d * dy + this.T.f);
    for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) { const s = (y * src.width + x) * 4, X = x + ox, Y = y + oy; if (src.px[s + 3] && X >= 0 && Y >= 0 && X < W && Y < H) px.set(src.px.subarray(s, s + 4), (Y * W + X) * 4); }
  }
  getImageData(_x: number, _y: number, w: number, h: number) { return { data: this.canvas.px.slice(0, w * h * 4) }; }
  fill(..._a: unknown[]) {} stroke(..._a: unknown[]) {} beginPath() {} closePath() {} rect(..._a: unknown[]) {} roundRect(..._a: unknown[]) {} arc(..._a: unknown[]) {} arcTo(..._a: unknown[]) {} ellipse(..._a: unknown[]) {} moveTo(..._a: unknown[]) {} lineTo(..._a: unknown[]) {} bezierCurveTo(..._a: unknown[]) {} quadraticCurveTo(..._a: unknown[]) {} clip(..._a: unknown[]) {}
}
export class FakeCanvas { px: Uint8ClampedArray; ctx: FakeCtx; constructor(public width: number, public height: number) { this.px = new Uint8ClampedArray(width * height * 4); this.ctx = new FakeCtx(this); } getContext() { return this.ctx; } }
export const installFakeCanvas = () => { (globalThis as Record<string, unknown>).CanvasRenderingContext2D = FakeCtx; };
