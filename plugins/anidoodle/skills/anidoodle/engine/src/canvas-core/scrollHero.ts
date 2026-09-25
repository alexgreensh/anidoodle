// SCROLL HERO. The storybook plate draws itself as you scroll, the way a picture-book page is made.
//
// The idea in one sentence: reading down the page IS the illustrator's hand, so scroll progress is
// the pencil, then the brush, then the final line, and scrolling back up un-draws it.
//   1 PENCIL  construction ovals, then a light sketch of everything, Bit head first and down;
//   2 PAINT   every wash and form, each spreading from where the brush touched;
//   3 LINE    full-weight graphite over the dry paint, head first again;
//   done      the plate, pixel for pixel. A pencil (or brush) sits at the nib the whole way.
//
// HOW, and why it is cheap enough for a web page. The plate's calls are run ONCE at mount through a
// Gfx that records every mark it makes (pen centreline, wash outline, raw-drawn box) in device px,
// and paints four whole stage images: the sheet, the sketch, the painting, the finished plate. A
// stroke is then a MASK: its patch of the next stage image, revealed along its centreline (pens)
// or out from the point the brush touched (washes). Completed strokes are composited, in order,
// onto an accumulator whose contents are a pure function of how many strokes are done (the cache
// key), so scrolling back rebuilds it from the sheet and lands on the same pixels. Each frame is
// one blit, one partial patch and a tool sprite. Scroll is sprung (input spring "p") so a wheel's
// jumps become a hand's pace. Reduced motion: the finished plate, no tool.
import { GRAPHITE, TINT, jitter, sample, type Ctx, type Env, type Layer, type P, Gfx } from "./core";
import { bake, blit, multiply, type Sprite } from "./bake";
import { meadow, sheetSprite, splatter } from "./bitRig";
import { SHADE, drawBit } from "./storybook";
import { scrollSpan, type Piece } from "./input";

const POSE = { look: 1, tilt: 6, lean: 3, handL: [-80, -58] as P, handR: [94, -178] as P }, SEED = 3, BOB = Math.sin(SEED) * 2;
const LOOP = 120;

// ---------------------------------------------------------------- the plate, re-authored (drawStorybook builds its own Gfx)
type Op = { kind: string; gi: number; type: "pen" | "shape" | "box"; pts: [number, number][]; w: number; bit: boolean };
const devPts = (c: Ctx, pts: P[]): [number, number][] => { const m = c.getTransform(); return pts.map(([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]); };
const devScale = (c: Ctx) => { const m = c.getTransform(); return Math.hypot(m.a, m.b); };
type PenO = NonNullable<Parameters<Gfx["pen"]>[1]>;
class Pass extends Gfx {
  mode: "final" | "sketch" | "paint" = "final"; ops: Op[] | null = null; gi = -1; gk = ""; bit = false;
  group(kind: "ink" | "paint" | "plain", fn: () => void, opts: Parameters<Gfx["group"]>[2] = {}) {
    this.gi++; this.gk = kind;
    if (this.mode === "sketch" && kind !== "ink") return;
    if (this.mode === "paint" && kind === "ink") return;
    super.group(kind, fn, this.mode === "sketch" ? { ...opts, alpha: (opts.alpha ?? 1) * 0.4 } : opts);
  }
  private rec(type: Op["type"], pts: [number, number][], w: number) { this.ops?.push({ kind: this.gk, gi: this.gi, type, pts, w, bit: this.bit }); }
  pen(pts: P[], o: PenO = {}) {
    if (this.ops) { const { w = 3.4, seed = 1, closed = false, wobble = 1.1, boil = 0.55 } = o, ctrl = closed ? [...pts, pts[0], pts[1]] : pts; this.rec("pen", devPts(this.cur, sample(jitter(jitter(ctrl, wobble * this.medium.wobble, seed), boil, seed * 911))), w * this.medium.nib * devScale(this.cur)); }
    super.pen(pts, this.mode === "sketch" ? { ...o, w: (o.w ?? 3.4) * 0.7, retrace: false } : o);
  }
  wash(pts: P[], color: string, o: Parameters<Gfx["wash"]>[2] = {}) { this.rec("shape", devPts(this.cur, pts), 13 * devScale(this.cur)); super.wash(pts, color, o); }
  form(pts: P[], color: string, shade: string, o: Parameters<Gfx["form"]>[3] = {}) { this.rec("shape", devPts(this.cur, pts), 14 * devScale(this.cur)); super.form(pts, color, shade, o); }
  fill(pts: P[], color: string, alpha = 1) { this.rec("shape", devPts(this.cur, pts), 3 * devScale(this.cur)); super.fill(pts, color, alpha); }
  touch(x0: number, y0: number, x1: number, y1: number) { this.rec("box", devPts(this.cur, [[x0, y0], [x1, y1]]), 2 * devScale(this.cur)); super.touch(x0, y0, x1, y1); }
}
const scene = (g: Pass, base = true) => { meadow(g, { splatter: false, vignette: false, base }); g.bit = true; g.push(272, 492 + BOB * 2.75, 2.75 * (560 / 1080)); drawBit(g, 0, SEED, POSE); g.pop(); g.bit = false; splatter(g); };
// one stage image: the scene in a mode, then the sheet (vignette + paper) over it
const stage = (env: Env, mode: "blank" | "sketch" | "paint" | "final", ops?: Op[]) => {
  const sheet = sheetSprite(env); /* baked first: bakes share one scratch surface */
  return bake(env, `scroll:stage:${mode}`, (g0) => {
    const g = new Pass(g0.main, env, 0, g0.medium); g.ops = ops ?? null;
    if (mode === "blank") { const m = g.main; m.setTransform(env.scale, 0, 0, env.scale, 0, 0); m.fillStyle = "#fbf6ea"; m.fillRect(0, 0, env.W, env.H); }
    else if (mode === "final") scene(g);
    else {
      g.mode = "sketch"; scene(g);
      if (mode === "paint") { g.mode = "paint"; g.gi = -1; scene(g, false); }   /* the washes go over the sketch, as on paper */
    }
    g.vignette("rgba(90,50,50,0.11)"); multiply(g.main, sheet);
  }, { full: true });
};

// ---------------------------------------------------------------- the timeline: strokes in the order a hand makes them
type Stroke = { op: Op; src: "sketch" | "paint" | "final"; t0: number; t1: number; box: [number, number, number, number]; len: number };
type Plan = { strokes: Stroke[]; T: number; ops: Op[] };
const lenOf = (pts: [number, number][]) => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; };
const boxOf = (env: Env, op: Op): [number, number, number, number] => {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of op.pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const pad = (op.type === "pen" ? op.w / 2 + 3 * env.scale : op.w) + 2;
  return [Math.max(0, Math.floor(x0 - pad)), Math.max(0, Math.floor(y0 - pad)), Math.min(Math.round(env.W * env.scale), Math.ceil(x1 + pad)), Math.min(Math.round(env.H * env.scale), Math.ceil(y1 + pad))];
};
const plan = (env: Env): Plan => {
  const key = "scroll:plan"; let p = env.cache.get(key) as Plan | undefined; if (p) return p;
  const ops: Op[] = []; stage(env, "blank"); stage(env, "final", ops);
  const k = env.scale, ink = ops.filter((o) => o.kind === "ink"), paint = ops.filter((o) => o.kind !== "ink");
  const construction = ink.filter((o) => o.gi === 1).slice(0, 4);                              // the four loose underdrawing marks
  const top = (o: Op) => Math.min(...o.pts.map((q) => q[1]));
  const bitInk = ink.filter((o) => o.bit).map((o, i) => ({ o, i, y: Math.floor(top(o) / (34 * k)) })).sort((a, b) => a.y - b.y || a.i - b.i).map((x) => x.o); // head first, down
  const sceneInk = ink.filter((o) => !o.bit && !construction.includes(o));
  // each phase gets a fixed share of the scroll, matching the page's steps; inside a phase, a stroke's
  // share grows with the square root of its length (long strokes go fast, fiddly ones slow)
  const phases: [Op[], Stroke["src"], number][] = [[construction, "sketch", 0.1], [[...bitInk, ...sceneInk], "sketch", 0.27], [paint, "paint", 0.25], [[...bitInk, ...sceneInk], "final", 0.3]];
  const GAP = 0.02, strokes: Stroke[] = []; let t = 0;
  const weight = (op: Op) => { const L = op.type === "pen" ? lenOf(op.pts) / k : op.type === "shape" ? Math.sqrt(Math.max(1, areaOf(op.pts))) / k : 6; return op.type === "pen" ? 0.5 + Math.sqrt(L) / 7 : op.type === "shape" ? 0.8 + L / 90 : 0.35; };
  phases.forEach(([list, src, share]) => { const total = list.reduce((a, o) => a + weight(o), 0) || 1; list.forEach((op) => { const d = (weight(op) / total) * share; strokes.push({ op, src, t0: t, t1: t + d, box: boxOf(env, op), len: 0 }); t += d; }); t += GAP; });
  p = { strokes, T: t, ops }; env.cache.set(key, p); return p;
};
const areaOf = (pts: [number, number][]) => { let a = 0; for (let i = 0; i < pts.length; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length]; a += x0 * y1 - x1 * y0; } return Math.abs(a) / 2; };

// ---------------------------------------------------------------- masks and patches
const cut = (pts: [number, number][], u: number): [number, number][] => {
  if (u >= 1) return pts; const L = lenOf(pts) * u; let acc = 0; const out: [number, number][] = [pts[0]];
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (acc + d >= L) { const f = d ? (L - acc) / d : 0; out.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f]); return out; } acc += d; out.push(pts[i]); }
  return out;
};
const touchAt = (s: Stroke): [number, number] => (s.op.type === "box" ? [(s.op.pts[0][0] + s.op.pts[1][0]) / 2, (s.op.pts[0][1] + s.op.pts[1][1]) / 2] : s.op.pts.reduce((a, q) => (q[1] + q[0] * 0.3 < a[1] + a[0] * 0.3 ? q : a), s.op.pts[0])); // the brush lands top-left
const mask = (c: Ctx, s: Stroke, u: number, env: Env) => {
  const op = s.op; c.fillStyle = c.strokeStyle = "#000"; c.lineCap = c.lineJoin = "round";
  if (op.type === "pen") { const q = cut(op.pts, u); c.lineWidth = op.w + 3 * env.scale; c.beginPath(); q.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); if (q.length === 1) c.lineTo(q[0][0] + 0.01, q[0][1]); c.stroke(); return; }
  if (op.type === "box") { const [[x0, y0], [x1, y1]] = op.pts; c.fillRect(Math.min(x0, x1) - op.w, Math.min(y0, y1) - op.w, Math.abs(x1 - x0) + 2 * op.w, Math.abs(y1 - y0) + 2 * op.w); }
  else { c.lineWidth = op.w * 2; c.beginPath(); op.pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fill(); c.stroke(); }
  if (u < 1) { const [cx, cy] = touchAt(s), b = s.box, R = Math.max(...[[b[0], b[1]], [b[2], b[1]], [b[0], b[3]], [b[2], b[3]]].map(([x, y]) => Math.hypot(x - cx, y - cy))); c.globalCompositeOperation = "destination-in"; c.beginPath(); c.arc(cx, cy, Math.max(0.5, R * (1 - (1 - u) ** 2)), 0, Math.PI * 2); c.fill(); c.globalCompositeOperation = "source-over"; }
};
// the stroke's region of its stage image, cut out by its mask, into `L` at the stroke's box
const cutOut = (L: Layer, s: Stroke, u: number, env: Env, ox: number, oy: number) => {
  const c = L.ctx, b = s.box, w = b[2] - b[0], h = b[3] - b[1];
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = "source-over"; c.clearRect(ox, oy, w, h);
  c.save(); c.beginPath(); c.rect(ox, oy, w, h); c.clip(); c.setTransform(1, 0, 0, 1, ox - b[0], oy - b[1]); mask(c, s, u, env);
  c.globalCompositeOperation = "source-in"; c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(stage(env, s.src).c, b[0], b[1], w, h, ox, oy, w, h); c.restore();
};
const patch = (env: Env, i: number): Sprite => {
  const key = `scroll:patch:${i}`, hit = env.cache.get(key) as Sprite | undefined; if (hit) return hit;
  const s = plan(env).strokes[i], w = Math.max(1, s.box[2] - s.box[0]), h = Math.max(1, s.box[3] - s.box[1]), L = env.canvas(w, h); cutOut(L, s, 1, env, 0, 0);
  const sp: Sprite = { c: L.canvas as CanvasImageSource, x: s.box[0], y: s.box[1], w, h }; env.cache.set(key, sp); return sp;
};
// the accumulator: the sheet plus the first n patches, in order. Its pixels are a function of n alone.
type Acc = { L: Layer; n: number };
const accumulate = (env: Env, n: number): Layer => {
  const DW = Math.round(env.W * env.scale), DH = Math.round(env.H * env.scale); let a = env.cache.get("scroll:acc") as Acc | undefined;
  if (!a) { a = { L: env.canvas(DW, DH), n: -1 }; env.cache.set("scroll:acc", a); }
  if (a.n > n || a.n < 0) { const c = a.L.ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = "copy"; c.drawImage(stage(env, "blank").c, 0, 0); c.globalCompositeOperation = "source-over"; a.n = 0; }
  for (; a.n < n; a.n++) blit(a.L.ctx, patch(env, a.n));
  return a.L;
};

// ---------------------------------------------------------------- the tools, drawn in the plate's hand
const along = (tip: P, ang: number) => (u: number, v: number): P => [tip[0] + Math.cos(ang) * u - Math.sin(ang) * v, tip[1] + Math.sin(ang) * u + Math.cos(ang) * v];
const TOOL_TIP: P = [280, 330], TOOL_ANG = (-58 * Math.PI) / 180;
const band = (f: (u: number, v: number) => P, u0: number, u1: number, w0: number, w1: number, n = 6): P[] => { const L: P[] = [], R: P[] = []; for (let i = 0; i <= n; i++) { const u = u0 + ((u1 - u0) * i) / n, w = w0 + ((w1 - w0) * i) / n; L.push(f(u, -w)); R.push(f(u, w)); } return [...L, ...R.reverse()]; };
const pencil = (env: Env) => bake(env, "scroll:tool:pencil", (g) => {
  const f = along(TOOL_TIP, TOOL_ANG), body = band(f, 34, 132, 8, 8), wood = band(f, 9, 34, 2.4, 8), rub = band(f, 144, 160, 8, 7.2, 4), fer = band(f, 131, 145, 8.6, 8.6, 3);
  g.group("paint", () => { g.form(body, TINT.butter, SHADE.butter, { seed: 501, light: [-2, -3] }); g.form(wood, "#f3d2ad", "#d9ad83", { seed: 502, light: [-2, -2] }); g.form(fer, "#d6d0c8", "#9d958c", { seed: 503, light: [-1, -2] }); g.form(rub, TINT.rose, SHADE.rose, { seed: 504, light: [-2, -2] }); });
  g.group("ink", () => {
    g.fill(band(f, -1, 10, 0.4, 2.6, 3), GRAPHITE);
    [body, wood, fer, rub].forEach((b, i) => g.pen(b, { closed: true, w: 2, seed: 510 + i, wobble: 0.3, boil: 0.2, taper: 0.4 }));
    g.pen([f(36, 2.5), f(130, 2.5)], { w: 1.2, seed: 520, wobble: 0.2, opacity: 0.45, retrace: false }); g.pen([f(135, -8), f(135, 8)], { w: 1.3, seed: 521, opacity: 0.6, retrace: false }); g.pen([f(140, -8), f(140, 8)], { w: 1.3, seed: 522, opacity: 0.6, retrace: false });
  });
});
const brush = (env: Env) => bake(env, "scroll:tool:brush", (g) => {
  const f = along(TOOL_TIP, TOOL_ANG), hair = [f(-1, 0), f(8, -4), f(22, -6.5), f(34, -5.5), f(34, 5.5), f(22, 6.5), f(8, 4)] as P[], fer = band(f, 33, 56, 5.8, 5.8, 3), handle = band(f, 55, 176, 5.2, 7, 8);
  g.group("paint", () => { g.form(hair, "#7b5b46", "#4f3a2e", { seed: 531, light: [-1, -2] }); g.wash(band(f, 0, 12, 1, 4, 3), "#6fa874", { alpha: 0.9, seed: 532, dx: 0, dy: 0, shrink: 1, rim: false }); g.form(fer, "#d6d0c8", "#9d958c", { seed: 533, light: [-1, -2] }); g.form(handle, "#c9566b", "#9c3d50", { seed: 534, light: [-2, -3] }); });
  g.group("ink", () => [hair, fer, handle].forEach((b, i) => g.pen(b, { closed: true, w: 1.9, seed: 540 + i, wobble: 0.3, boil: 0.2, taper: 0.4 })));
});

// ---------------------------------------------------------------- the piece
export const scrollHero: Piece = {
  meta: { title: "Bit, drawn as you scroll", W: 560, H: 560, loop: LOOP, alt: "A storybook illustration of a small wind-up robot in a meadow, drawn in pencil and watercolour as you scroll down the page." },
  input: { springs: { p: { omega: 0.12, target: (d) => d.scroll } } },
  bake: function* (env) {
    yield "sheet"; sheetSprite(env); yield "stages"; stage(env, "blank"); yield "plan"; const pl = plan(env); yield "sketch"; stage(env, "sketch"); yield "paint"; stage(env, "paint");
    yield "tools"; pencil(env); brush(env);
    for (let i = 0; i < pl.strokes.length; i++) { patch(env, i); if (i % 8 === 7) yield `patch${i}`; }
  },
  draw: (ctx, t, env, s) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
    const pl = plan(env), bob = Math.sin((2 * Math.PI * t) / LOOP), k = env.scale;
    const p = s.reduced ? 1 : scrollSpan(s.spring.p as number, 0.02, 0.96);
    if (p >= 1) { blit(ctx, stage(env, "final")); if (!s.reduced) tool(ctx, env, pencil(env), [500, 520], 2 * bob, 12); return; }
    const time = p * pl.T, S = pl.strokes;
    let lo = 0, hi = S.length; while (lo < hi) { const m = (lo + hi) >> 1; if (S[m].t1 <= time) lo = m + 1; else hi = m; }       // lo = strokes finished
    blit(ctx, { c: accumulate(env, lo).canvas as CanvasImageSource, x: 0, y: 0, w: 0, h: 0 });
    let nib: P = S[0] ? [S[0].op.pts[0][0] / k, S[0].op.pts[0][1] / k] : [280, 280], painting = false;
    const cur = S[lo];
    if (cur && time > cur.t0) {
      const u = Math.min(1, (time - cur.t0) / (cur.t1 - cur.t0)), tmp = scratch(env); cutOut(tmp, cur, u, env, 0, 0);
      const w = cur.box[2] - cur.box[0], h = cur.box[3] - cur.box[1]; ctx.drawImage(tmp.canvas as CanvasImageSource, 0, 0, w, h, cur.box[0], cur.box[1], w, h);
      painting = cur.src === "paint"; nib = tipOf(cur, u, k, t);
    } else if (lo > 0) { const prev = S[lo - 1]; painting = prev.src === "paint" && (!cur || cur.src === "paint"); nib = tipOf(prev, 1, k, t); if (cur && !painting && prev.src !== cur.src) nib = [cur.op.pts[0][0] / k, cur.op.pts[0][1] / k]; }
    tool(ctx, env, painting ? brush(env) : pencil(env), nib, 1.5 * bob, 0);
  },
};
const scratch = (env: Env): Layer => { const key = "scroll:tmp"; let L = env.cache.get(key) as Layer | undefined; if (!L) { L = env.canvas(Math.round(env.W * env.scale), Math.round(env.H * env.scale)); env.cache.set(key, L); } return L; };
const tipOf = (s: Stroke, u: number, k: number, t: number): P => {
  if (s.op.type === "pen") { const q = cut(s.op.pts, u), e = q[q.length - 1]; return [e[0] / k, e[1] / k]; }
  const [cx, cy] = touchAt(s), b = s.box, r = (Math.min(b[2] - b[0], b[3] - b[1]) / 2) * Math.min(1, u) * 0.8, a = u * 9 + t * 0.02; return [(cx + Math.cos(a) * r) / k, (cy + Math.sin(a) * r) / k];
};
// the tool with its tip at `nib` (sheet px), bobbing; `lift` raises it off the paper
const tool = (ctx: Ctx, env: Env, sp: Sprite, nib: P, bob: number, lift: number) => blit(ctx, sp, (nib[0] - TOOL_TIP[0]) * env.scale, (nib[1] - TOOL_TIP[1] - lift + bob) * env.scale);
