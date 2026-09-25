// STORYBOOK · Bit, drawn. The storybook pencil + watercolour character, made the way a picture-book
// illustrator makes a character page.
//
// MEDIUM: a soft graphite pencil and pan watercolour on warm cold-press paper (the hand of `storybook.ts`).
// ORDER, the point of this film:
//   (1) construction: blue-grey pencil, barely there. The head and body as two loose ovals, the gesture
//       line through them, the shoulder line, the face cross (centre line + eye line), the arm gestures
//       to each hand, the footprint. These stay in the finished page, as they do in real picture books;
//   (2) pencil: a light graphite drawing of Bit over the construction, head first and working down,
//       every contour drawn stroke by stroke (the same strokes the final line will retrace);
//   (3) washes: the sheet's warm ground, sky, the peach of the light, the grass and its shadow, the four
//       flowers, then Bit himself back to front (legs, boots, arms, body, antenna, head, cheeks), each
//       wash spreading from where the brush touched and stopping short of its line;
//   (4) the final line: full-weight graphite over the dry paint, head first again, then the ground
//       line, the grass, the pebbles and the flower stems; last, paint flicked off the brush.
// LIGHT: one light, upper left (every form in drawBit is lit from [-x, -y]); cast shadow = the hatched
//   and washed pool under his boots.
// The character is `storybook.ts`'s drawBit, called unchanged: a Gfx subclass decides which of its
// groups draw in each pass and how far along each stroke is. storybook.ts is not modified and has no
// host page, so nothing existing can change. The scene is re-authored here from drawStorybook's calls.
import { Gfx, PENCIL, TINT, oval, rng, turn, type Ctx, type Env, type Layer, type P } from "./core";
import type { Film } from "./film";
import { drawBit } from "./storybook";
import { checkOps, schedule, staged, type Op } from "./brokenColourKit";

const N = 450, HOLD = N - 30;
const META = { title: "Storybook · Bit, drawn", W: 1080, H: 1080, fps: 30, bpm: 120, durationFrames: N, raster: "cpu" as const };
const SHEET = 560;                                   // drawStorybook was composed on a 560 sheet
const POSE = { look: 1, tilt: 6, lean: 3, handL: [-80, -58] as P, handR: [94, -178] as P }, SEED = 3;
const BOB = Math.sin(SEED) * 2, ACTOR: [number, number, number] = [272, 492 + BOB * 2.75, 2.75 * (SHEET / 1080)];
const U = "#8d90a6";

// ---------------------------------------------------------------- a Gfx that draws one group of drawBit
type Mode = "census" | "sketch" | "paint" | "line";
type Rec = { kind: string; box: number[]; pens: number };
class Phase extends Gfx {
  mode: Mode = "census"; sel = -1; prog = 1; recs: Rec[] = []; scratch: Ctx | null = null;
  private gi = -1; private pi = 0;
  private note(pts: P[]) { const b = this.recs[this.gi]?.box; if (!b) return; for (const [x, y] of pts) { b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x); b[3] = Math.max(b[3], y); } }
  group(kind: "ink" | "paint" | "plain", fn: () => void, opts: Parameters<Gfx["group"]>[2] = {}) {
    const i = ++this.gi;
    if (this.mode === "census") { this.recs.push({ kind, box: [1e9, 1e9, -1e9, -1e9], pens: 0 }); const prev = this.cur; this.cur = this.scratch!; fn(); this.cur = prev; return; }
    if (i !== this.sel) return;
    this.pi = 0;
    if (this.mode === "paint") { if (kind !== "ink") super.group(kind, () => this.wet(fn), opts); return; }
    if (kind === "ink") super.group(kind, fn, this.mode === "sketch" ? { ...opts, alpha: (opts.alpha ?? 1) * 0.36 } : opts);
  }
  // the brush touched near the upper left of the shape (toward the light) and the pigment runs out from there
  private wet(fn: () => void) {
    if (this.prog >= 1) return fn();
    const [x0, y0, x1, y1] = this.recs[this.sel].box, at: P = [x0 + (x1 - x0) * 0.3, y0 + (y1 - y0) * 0.3], R = (Math.hypot(Math.max(at[0] - x0, x1 - at[0]), Math.max(at[1] - y0, y1 - at[1])) + 6) / 0.8 * Math.pow(this.prog, 0.8) + 2, c = this.cur, r = rng(this.sel * 17 + 5);
    c.save(); c.beginPath(); for (let k = 0; k < 20; k++) { const a = (k / 20) * Math.PI * 2, rr = R * (0.8 + 0.35 * r()); k ? c.lineTo(at[0] + Math.cos(a) * rr, at[1] + Math.sin(a) * rr) : c.moveTo(at[0] + Math.cos(a) * rr, at[1] + Math.sin(a) * rr); } c.closePath(); c.clip(); fn(); c.restore();
  }
  pen(pts: P[], o: Parameters<Gfx["pen"]>[1] = {}) {
    if (this.mode === "census") { this.note(pts); this.recs[this.gi].pens++; return; }
    const k = this.pi++, p = Math.min(1, this.prog * this.recs[this.gi].pens - k);
    if (p <= 0) return;
    super.pen(pts, { ...o, progress: Math.min(o.progress ?? 1, p), w: (o.w ?? 3.4) * (this.mode === "sketch" ? 0.62 : 1) });
  }
  form(pts: P[], color: string, shade: string, o: Parameters<Gfx["form"]>[3] = {}) { if (this.mode === "census") return this.note(pts); super.form(pts, color, shade, o); }
  wash(pts: P[], color: string, o: Parameters<Gfx["wash"]>[2] = {}) { if (this.mode === "census") return this.note(pts); super.wash(pts, color, o); }
  // The glow is a gradient. Painting a gradient into a POOLED layer changes how Chromium later rasterises
  // pencil strokes into that same layer (1/255 on every stroke, measured), so frame order would leak into
  // pixels. The gradient is painted on its own surface and copied in; the pool never sees a gradient.
  glow(cx: number, cy: number, r: number, color: string, opacity: number) {
    if (this.mode === "census") return this.note([[cx - r, cy - r], [cx + r, cy + r]]);
    const env = this.env, DW = Math.round(env.W * env.scale), DH = Math.round(env.H * env.scale), key = `storybookDraw:glow:${DW}x${DH}`;
    let G = env.cache.get(key) as Layer | undefined; if (!G) { G = env.canvas(DW, DH); env.cache.set(key, G); }
    const c = this.cur, t = c.getTransform(), g = G.ctx;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, DW, DH); g.setTransform(t.a, t.b, t.c, t.d, t.e, t.f);
    const grd = g.createRadialGradient(cx, cy, 0, cx, cy, r * 1.7), a = (v: number) => Math.round(255 * Math.max(0, Math.min(1, v * opacity))).toString(16).padStart(2, "0");
    [[0, 1], [0.35, 0.9], [0.6, 0.55], [0.8, 0.2], [1, 0]].forEach(([k, v]) => grd.addColorStop(k, color + a(v)));
    g.fillStyle = grd; g.fillRect(cx - r * 2, cy - r * 2, r * 4, r * 4);
    this.touch(cx - r * 1.8, cy - r * 1.8, cx + r * 1.8, cy + r * 1.8);
    c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(G.canvas as CanvasImageSource, 0, 0); c.restore();
  }
}
const onSheet = (g: Gfx, env: Env) => g.push(0, 0, env.W / SHEET);
const census = (env: Env): Rec[] => {
  const key = "storybookDraw:census:v1"; let recs = env.cache.get(key) as Rec[] | undefined; if (recs) return recs;
  const s = env.canvas(1, 1), g = new Phase(s.ctx, env, 0, PENCIL); g.scratch = s.ctx;
  drawBit(g, 0, SEED, POSE); env.cache.set(key, g.recs); return g.recs;
};
const bitGroup = (mode: Mode, i: number) => (ctx: Ctx, env: Env, p: number) => {
  const g = new Phase(ctx, env, 0, PENCIL); g.recs = census(env); g.mode = mode; g.sel = i; g.prog = p;
  onSheet(g, env); g.push(...ACTOR); drawBit(g, 0, SEED, POSE); g.pop(); g.pop();
};
// a plain op on the sheet (or on Bit's own coordinates), progress handed to `fn`
const sheet = (fn: (g: Gfx, p: number) => void, actor = false) => (ctx: Ctx, env: Env, p: number) => { const g = new Gfx(ctx, env, 0, PENCIL); onSheet(g, env); if (actor) g.push(...ACTOR); fn(g, p); if (actor) g.pop(); g.pop(); };
const spread = (g: Gfx, at: P, reach: number, p: number, seed: number, fn: () => void) => {
  if (p >= 1) return fn();
  const c = g.cur, r = rng(seed), R = reach * Math.pow(p, 0.8) + 2; c.save(); c.beginPath();
  for (let k = 0; k < 20; k++) { const a = (k / 20) * Math.PI * 2, rr = R * (0.8 + 0.35 * r()); k ? c.lineTo(at[0] + Math.cos(a) * rr, at[1] + Math.sin(a) * rr) : c.moveTo(at[0] + Math.cos(a) * rr, at[1] + Math.sin(a) * rr); }
  c.closePath(); c.clip(); fn(); c.restore();
};

const FLOWERS: [number, number, string, number][] = [[64, 440, "#f2899c", 50], [488, 430, "#c7b3e0", 60], [446, 452, "#f5b98a", 70], [98, 462, "#f3d577", 80]];
const build = (env: Env): Op[] => {
  const ops: Op[] = [], add = (marks: ((ctx: Ctx, env: Env, p: number) => void)[], f0: number, f1: number, dur: number, pace?: (u: number) => number) => { const t = schedule(marks.length, f0, f1, dur, pace); marks.forEach((d, i) => ops.push({ ...t[i], draw: d })); };
  const recs = census(env), ink = recs.map((r, i) => ({ ...r, i })).filter((r) => r.kind === "ink"), paint = recs.map((r, i) => ({ ...r, i })).filter((r) => r.kind !== "ink");
  const topDown = [...ink].sort((a, b) => a.box[1] - b.box[1]);
  const pen = (pts: P[], o: Parameters<Gfx["pen"]>[1], actor = false) => sheet((g, p) => g.group("ink", () => g.pen(pts, { ...o, progress: p })), actor);
  // (1) construction
  const hc: P = [POSE.lean * 0.6, -200], H = (pts: P[]) => turn(pts.map(([x, y]) => [hc[0] + x, hc[1] + y] as P), hc[0], hc[1], POSE.tilt);
  add([
    pen(turn(oval(300, 214, 128, 104, 12), 300, 214, 6), { closed: true, w: 1.4, color: U, seed: 9, opacity: 0.45, wobble: 2 }),
    pen(oval(292, 392, 86, 92, 10), { closed: true, w: 1.4, color: U, seed: 10, opacity: 0.42, wobble: 2 }),
    pen([[318, 96], [300, 214], [288, 400], [286, 500]], { w: 1.3, color: U, seed: 11, opacity: 0.42 }),
    pen([[170, 232], [300, 214], [432, 196]], { w: 1.3, color: U, seed: 12, opacity: 0.4 }),
    pen(H([[-4, -66], [0, 0], [4, 64]]), { w: 1.6, color: U, seed: 13, opacity: 0.4, wobble: 1 }, true),
    pen(H([[-78, 4], [0, 8], [78, 4]]), { w: 1.6, color: U, seed: 14, opacity: 0.4, wobble: 1 }, true),
    pen([[-50, -28], [-68, -44], [-80, -58]], { w: 1.5, color: U, seed: 15, opacity: 0.38, wobble: 1 }, true),
    pen([[50, -28], [76, -100], [94, -178]], { w: 1.5, color: U, seed: 16, opacity: 0.38, wobble: 1 }, true),
    pen(oval(0, 0, 62, 9, 10), { closed: true, w: 1.5, color: U, seed: 17, opacity: 0.36, wobble: 1 }, true),
  ], 0.5, 58, 8);
  // (2) the pencil drawing, head first
  add(topDown.map((r) => bitGroup("sketch", r.i)), 57, 150, 10);
  // (3) washes: the sheet, then the flowers, then Bit back to front
  const wash = (pts: P[], color: string, alpha: number, seed: number, at: P, _reach: number) => sheet((g, p) => g.group("paint", () => spread(g, at, (Math.max(...pts.map(([x, y]) => Math.hypot(x - at[0], y - at[1]))) + 16) / 0.8, p, seed, () => g.wash(pts, color, { alpha, seed }))));
  add([
    wash([[40, 46], [170, 36], [300, 42], [430, 34], [522, 44], [528, 170], [520, 300], [526, 430], [518, 488], [400, 480], [280, 490], [150, 482], [42, 490], [34, 380], [42, 250], [36, 130]], "#f3d9b4", 0.62, 2, [60, 60], 720),
    wash(oval(170, 150, 150, 105, 9), "#a9cdea", 0.24, 3, [80, 90], 260),
    wash(oval(420, 330, 120, 150, 9), "#f2b9a0", 0.26, 4, [340, 210], 260),
    wash(oval(318, 96, 80, 70, 8), TINT.glow, 0.5, 5, [270, 50], 160),
    wash([[34, 470], [150, 452], [300, 460], [430, 450], [530, 466], [524, 530], [300, 538], [44, 530]], "#9cc79a", 0.62, 6, [40, 465], 520),
    wash([[60, 486], [200, 474], [330, 480], [330, 500], [190, 506], [70, 504]], "#6fa874", 0.35, 7, [70, 488], 280),
    wash(oval(292, 494, 124, 13, 10), "#7d6fa8", 0.42, 8, [180, 490], 260),
  ], 149, 212, 16);
  add(FLOWERS.map(([x, y, c, seed]) => sheet((g, p) => g.group("paint", () => spread(g, [x - 6, y - 6], 40, p, seed, () => { const flat = { dx: 3, dy: 2, shrink: 0.94, rim: true }; [0, 1, 2, 3, 4].forEach((i) => g.wash(oval(x + Math.cos(i * 1.256 + 0.4) * 9, y + Math.sin(i * 1.256 + 0.4) * 9, 7.5, 7.5, 6), c, { alpha: 0.85, seed: seed + i, ...flat })); g.wash(oval(x, y, 3.4, 3.4, 5), TINT.butter, { alpha: 0.95, seed: seed + 6, ...flat }); })))), 211, 236, 8);
  add(paint.map((r) => bitGroup("paint", r.i)), 235, 300, 8);
  // (4) the final line, head first, then the ground, the grass and the pebbles, then the flower stems
  add(topDown.map((r) => bitGroup("line", r.i)), 299, 372, 8, (u) => u * 0.85 + u * u * 0.15);
  add([
    pen([[36, 470], [150, 454], [300, 461], [430, 452], [530, 468]], { w: 2, seed: 13, opacity: 0.55 }),
    ...[[66, 0], [84, 1], [104, 0], [128, 1], [430, 0], [452, 1], [474, 0], [500, 1]].map(([x, k], i) => pen([[x, 472], [x + (k ? 5 : -4), 456 - (i % 3) * 4], [x + (k ? 9 : -8), 444 - (i % 3) * 5]], { w: 1.9, color: "#5f8f62", seed: 20 + i, retrace: false })),
    ...[[176, 512, 9, 5], [396, 516, 11, 6], [232, 524, 6, 4]].map(([x, y, a, b], i) => pen(oval(x, y, a, b, 7), { closed: true, w: 1.6, seed: 40 + i, opacity: 0.6 })),
  ], 371, 393, 3);
  add(FLOWERS.map(([x, y, , seed]) => sheet((g, p) => g.group("ink", () => { g.pen([[x, y + 9], [x + 2, y + 24], [x - 1, y + 40]], { w: 1.8, color: "#6f9b6a", seed: seed + 7, retrace: false, progress: Math.min(1, p * 2) }); if (p > 0.5) g.pen(oval(x, y, 16, 16, 9), { closed: true, w: 1.5, seed: seed + 8, opacity: 0.6, wobble: 2, progress: (p - 0.5) * 2 }); }))), 392, 406, 4);
  // paint flicked off the brush: every drop lands at once in its flick, the flicks one after another
  add([[5, 26, [50, 60, 510, 470], "#e9a887", 3], [8, 12, [60, 380, 500, 520], "#6fa874", 2.6]].map(([sd, n, box, col, rmax]) => sheet((g, p) => g.group("paint", () => { const c = g.cur, r = rng(sd as number), bx = box as number[]; for (let i = 0; i < (n as number); i++) { const x = bx[0] + r() * (bx[2] - bx[0]), y = bx[1] + r() * (bx[3] - bx[1]), k = r(), a = 0.5 * (0.5 + r() * 0.5); if (i >= Math.ceil((n as number) * p)) continue; g.touch(x - 5, y - 5, x + 5, y + 5); c.globalAlpha = a; c.fillStyle = col as string; c.beginPath(); c.arc(x, y, 0.5 + k * k * (rmax as number), 0, Math.PI * 2); c.fill(); } c.globalAlpha = 1; }))), 405, HOLD, 5);
  return checkOps(ops, HOLD);
};

const KEY = "storybookDraw:ops:v1";
export const drawStorybookDraw = (ctx: Ctx, frame: number, env: Env) => staged("storybookDraw", () => { let o = env.cache.get(KEY) as Op[] | undefined; if (!o) { o = build(env); env.cache.set(KEY, o); } return o; },
  (c, e) => { c.setTransform(e.scale, 0, 0, e.scale, 0, 0); c.fillStyle = "#fbf6ea"; c.fillRect(0, 0, e.W, e.H); },
  (c, e) => { const g = new Gfx(c, e, 0, PENCIL); g.paper("paper", 0.13); g.vignette("rgba(90,50,50,0.11)"); g.paper("coldpress", 0.2); })(ctx, frame, env);

export const STYLE = { id: "storybookDraw", name: "Storybook pencil + watercolour, drawn", family: "watercolour", medium: "soft graphite and pan watercolour on warm cold-press: construction, pencil, washes, final line", nearest: "storybook", hero: "Bit, the wind-up robot, waving" };
export const storybookDraw: Film = { meta: META, assets: { images: {} }, shots: [{ id: "storybookDraw", start: 0, end: N, draw: drawStorybookDraw }] };
