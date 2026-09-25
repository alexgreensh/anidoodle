// THE DRAWING SCORE. A drawing written down as the ORDER a hand makes it: parts of the subject,
// marks with stable ids, what each mark waits for, and the teaching phases they fall in. One
// score drives everything: the finished still, a timelapse, a step sheet, a replay at any frame.
// (Spec 14, "an authored drawing score, not a generated video", plus teach mode from ADVISORY-PLAN
// 4.2. It is authored source data: no model, no image, no fetch at render time.)
//
//   parts   the subject's pieces, with dependencies ("the ear waits for the head")
//   layers  isolation for things that must be REMOVED later: blue construction guides, a wrong
//           line that gets corrected. An eraser works on ONE layer and only on what is already
//           on it, the way a kneaded eraser lifts the col-erase blue without touching graphite.
//   marks   one stroke each (or one eraser pass). Built once from (points, seed) and frozen, so a
//           finished mark never changes while later marks go down.
//   steps   the lesson: a phase, a title, a caption, and the teaching (what to look for, how,
//           the common mistake). Every mark belongs to exactly one step.
//
// Final identity holds because there is only one renderer: the timelapse's last frame, the still
// and the step sheet all call renderArt() with the same marks at progress 1. The gate in
// tools/lesson.mjs still checks it (cached replay path against a cold, uncached one) because a
// green claim is not evidence.
import { Gfx, PENCIL, fractal, type Ctx, type Env, type Layer } from "./core";
import { eraserStroke, type Box, type Ink } from "./drawingMarks";
import type { P } from "./core";

export const PHASES = ["placement", "shapes", "construction", "values", "colour", "edges", "accents"] as const;
export type Phase = (typeof PHASES)[number];
export const PHASE_NAME: Record<Phase, string> = { placement: "placement and gesture", shapes: "big shapes", construction: "construction", values: "value masses", colour: "local colour", edges: "edges and details", accents: "accents" };

export type MarkKind = "guide" | "line" | "fill" | "correction" | "erase";
export type LayerSpec = { id: string; tooth: 0 | 1 | 2 | null; alpha?: number; note?: string };
export type Part = { id: string; label: string; dependsOn: string[] };
export type Mark = { id: string; part: string; layer: string; kind: MarkKind; step: number; cost: number; box: Box; ink?: Ink; erase?: { path: P[]; width: number; ghost: number }; after: string[]; supersedes?: string };
export type StepText = { title: string; caption: string; look: string; how: string; mistake?: string };
export type Step = StepText & { id: string; phase: Phase; marks: number[] };
export type Score = {
  id: string; title: string; medium: string; note?: string; W: number; H: number; paper: string; toothAngle: number;
  layers: LayerSpec[]; parts: Part[]; marks: Mark[]; steps: Step[]; byLayer: Map<string, number[]>; index: Map<string, number>;
};

// ---------------------------------------------------------------- authoring
export class ScoreBuilder {
  private layers: LayerSpec[] = []; private parts: Part[] = []; private marks: Mark[] = []; private steps: Step[] = [];
  constructor(private meta: { id: string; title: string; medium: string; note?: string; W: number; H: number; paper: string; toothAngle?: number }) {}
  layer(id: string, tooth: 0 | 1 | 2 | null, alpha = 1, note?: string) { this.layers.push({ id, tooth, alpha, note }); return this; }
  part(id: string, label: string, dependsOn: string[] = []) { this.parts.push({ id, label, dependsOn }); return this; }
  step(id: string, phase: Phase, t: StepText) { this.steps.push({ id, phase, ...t, marks: [] }); return this; }
  private push(m: Omit<Mark, "step">) { const s = this.steps.length - 1; if (s < 0) throw new Error(`mark ${m.id} before any step`); this.marks.push({ ...m, step: s }); this.steps[s].marks.push(this.marks.length - 1); }
  add(id: string, part: string, layer: string, kind: MarkKind, ink: Ink, o: { after?: string[]; supersedes?: string } = {}) { this.push({ id, part, layer, kind, ink, cost: ink.cost, box: ink.box, after: o.after ?? [], supersedes: o.supersedes }); return id; }
  // many marks under one authored name: ids are name.000, name.001 ... stable as long as the recipe is
  addAll(name: string, part: string, layer: string, kind: MarkKind, inks: Ink[], o: { after?: string[] } = {}) { return inks.map((ink, i) => this.add(`${name}.${String(i).padStart(3, "0")}`, part, layer, kind, ink, i === 0 ? o : {})); }
  erase(id: string, part: string, layer: string, path: P[], o: { width: number; ghost: number; after?: string[] }) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of path) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    let len = 0; for (let i = 1; i < path.length; i++) len += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    this.push({ id, part, layer, kind: "erase", erase: { path, width: o.width, ghost: o.ghost }, cost: len * 0.35 + 20, box: [x0 - o.width, y0 - o.width, x1 + o.width, y1 + o.width], after: o.after ?? [] }); return id;
  }
  build(): Score {
    const index = new Map<string, number>(); this.marks.forEach((m, i) => index.set(m.id, i));
    const byLayer = new Map<string, number[]>(this.layers.map((l) => [l.id, []])); this.marks.forEach((m, i) => byLayer.get(m.layer)?.push(i));
    const S: Score = { ...this.meta, toothAngle: this.meta.toothAngle ?? -0.55, layers: this.layers, parts: this.parts, marks: this.marks, steps: this.steps, byLayer, index };
    const { problems } = validate(S); if (problems.length) throw new Error(`drawing score '${S.id}': ${problems.slice(0, 8).join("; ")}${problems.length > 8 ? ` (+${problems.length - 8} more)` : ""}`);
    return S;
  }
}

// ---------------------------------------------------------------- the schema gate
export const validate = (S: Score) => {
  const problems: string[] = [], warnings: string[] = [], seen = new Set<string>(), partIds = new Set(S.parts.map((p) => p.id)), layerIds = new Set(S.layers.map((l) => l.id));
  S.marks.forEach((m) => { if (seen.has(m.id)) problems.push(`duplicate mark id ${m.id}`); seen.add(m.id); if (!partIds.has(m.part)) problems.push(`mark ${m.id}: unknown part ${m.part}`); if (!layerIds.has(m.layer)) problems.push(`mark ${m.id}: unknown layer ${m.layer}`); });
  S.parts.forEach((p) => p.dependsOn.forEach((d) => { if (!partIds.has(d)) problems.push(`part ${p.id}: depends on unknown part ${d}`); }));
  // dependencies acyclic
  const state = new Map<string, number>(), visit = (id: string, path: string[]): void => { if (state.get(id) === 2) return; if (state.get(id) === 1) { problems.push(`part dependency cycle: ${[...path, id].join(" -> ")}`); return; } state.set(id, 1); S.parts.find((p) => p.id === id)?.dependsOn.forEach((d) => visit(d, [...path, id])); state.set(id, 2); };
  S.parts.forEach((p) => visit(p.id, []));
  // order: a part's first mark comes after the first mark of every part it depends on; `after` marks come earlier
  const first = new Map<string, number>(); S.marks.forEach((m, i) => { if (!first.has(m.part)) first.set(m.part, i); });
  S.parts.forEach((p) => { const f = first.get(p.id); if (f === undefined) { warnings.push(`part ${p.id} has no marks`); return; } p.dependsOn.forEach((d) => { const fd = first.get(d); if (fd !== undefined && fd > f) problems.push(`part ${p.id} starts (mark ${S.marks[f].id}) before the part it depends on, ${d}`); }); });
  S.marks.forEach((m, i) => { m.after.forEach((a) => { const j = S.index.get(a); if (j === undefined) problems.push(`mark ${m.id}: after unknown mark ${a}`); else if (j >= i) problems.push(`mark ${m.id}: waits for ${a}, which comes later`); }); });
  // a correction replaces a mark that has been ERASED before the new one starts (on its own layer, so nothing else is lifted)
  S.marks.forEach((m, i) => { if (!m.supersedes) return; const j = S.index.get(m.supersedes); if (j === undefined) { problems.push(`correction ${m.id}: supersedes unknown mark ${m.supersedes}`); return; } const old = S.marks[j]; const e = S.marks.findIndex((x, k) => k > j && k < i && x.kind === "erase" && x.layer === old.layer); if (e < 0) problems.push(`correction ${m.id}: ${old.id} (layer ${old.layer}) is never erased before it`); if (old.layer === m.layer) warnings.push(`correction ${m.id} shares layer ${old.layer} with what it replaces: erase it before drawing`); });
  // phases run forward (a teacher may revisit construction during big shapes, so this only warns)
  S.steps.forEach((s, k) => { if (k && PHASES.indexOf(s.phase) < PHASES.indexOf(S.steps[k - 1].phase)) warnings.push(`step ${s.id} (${s.phase}) comes after ${S.steps[k - 1].id} (${S.steps[k - 1].phase})`); if (!s.marks.length) warnings.push(`step ${s.id} has no marks`); const words = s.caption.split(/\s+/).filter(Boolean).length; if (words > 24) warnings.push(`step ${s.id}: caption is ${words} words (keep it at 24 or fewer)`); });
  // guides must be gone by the end: any mark on a layer whose name starts with "guide" must be under an eraser that runs after it
  S.marks.forEach((m, i) => { if (m.kind !== "guide") return; if (!S.marks.some((x, k) => k > i && x.kind === "erase" && x.layer === m.layer)) warnings.push(`guide ${m.id} is never erased`); });
  const stats = { marks: S.marks.length, parts: S.parts.length, steps: S.steps.length, perPart: Object.fromEntries(S.parts.map((p) => [p.id, S.marks.filter((m) => m.part === p.id).length])), perStep: S.steps.map((s) => `${s.id}:${s.marks.length}`) };
  return { problems, warnings, stats };
};

// ---------------------------------------------------------------- time
export type Timing = { intro: number; captionLead: number; pause: number; hold: number; rate: number; minStep: number; maxStep: number; grid: number };
export type Plan = { total: number; steps: { start: number; markStart: number; markEnd: number; end: number }[]; s: Float64Array; e: Float64Array };
// Steps start on the beat grid. Inside a step the marks run one after another, each taking time
// in proportion to its cost (ink length plus a lift), so long strokes are fast per unit length
// and every lift of the pencil costs a beat of time. One active mark at a time: never two parts at once.
export const schedule = (S: Score, T: Timing): Plan => {
  const n = S.marks.length, s = new Float64Array(n), e = new Float64Array(n), steps: Plan["steps"] = []; let f = T.intro;
  S.steps.forEach((st) => {
    const start = f, markStart = start + T.captionLead, C = st.marks.reduce((a, i) => a + S.marks[i].cost, 0) || 1;
    const dur = Math.max(T.minStep, Math.min(T.maxStep, Math.round(C / T.rate))); let acc = 0;
    st.marks.forEach((i) => { s[i] = markStart + (acc / C) * dur; acc += S.marks[i].cost; e[i] = markStart + (acc / C) * dur; });
    const markEnd = markStart + dur, end = Math.ceil((markEnd + T.pause) / T.grid) * T.grid; steps.push({ start, markStart, markEnd, end }); f = end;
  });
  return { total: Math.ceil((f + T.hold) / T.grid) * T.grid, steps, s, e };
};
export const progressAt = (P: Plan, frame: number) => (i: number) => { const a = P.s[i], b = P.e[i]; return frame >= b ? 1 : frame <= a ? 0 : (frame - a) / (b - a); };

// ---------------------------------------------------------------- rendering
export type View = { x: number; y: number; w: number; h: number }; // device px where design [0,W]x[0,H] lands
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const LEVELS = [0.5, 0.56, 0.64]; // tooth thresholds: light, medium, burnished pressure
const toothField = (env: Env, S: Score): Float32Array => {
  const key = `ds:tooth:${S.W}x${S.H}:${S.toothAngle}`; let f = env.cache.get(key) as Float32Array | undefined; if (f) return f;
  f = new Float32Array(S.W * S.H); const c = Math.cos(S.toothAngle), s = Math.sin(S.toothAngle);
  for (let y = 0; y < S.H; y++) for (let x = 0; x < S.W; x++) { const u = x * c + y * s, v = -x * s + y * c; f[y * S.W + x] = 0.6 * fractal(71, u, v, 0.13, 0.6, 2) + 0.4 * fractal(73, x, y, 0.85, 0.85, 1); }
  env.cache.set(key, f); return f;
};
const toothMask = (env: Env, S: Score, lvl: number, v: View, DW: number, DH: number): Layer => {
  const key = `ds:mask:${S.id}:${lvl}:${v.x},${v.y},${v.w},${v.h}:${DW}x${DH}`; let L = env.cache.get(key) as Layer | undefined; if (L) return L;
  const f = toothField(env, S), small = env.canvas(S.W, S.H), img = small.ctx.createImageData(S.W, S.H), d = img.data, T = LEVELS[lvl];
  for (let i = 0; i < S.W * S.H; i++) d[i * 4 + 3] = 255 * clamp((T - f[i]) * 11 + 0.5);
  small.ctx.putImageData(img, 0, 0); L = env.canvas(DW, DH); L.ctx.imageSmoothingEnabled = true; L.ctx.drawImage(small.canvas as CanvasImageSource, 0, 0, S.W, S.H, v.x, v.y, v.w, v.h);
  env.cache.set(key, L); return L;
};
const surface = (env: Env, name: string, DW: number, DH: number): Layer => { const k = `ds:surf:${name}:${DW}x${DH}`; let L = env.cache.get(k) as Layer | undefined; if (!L) { L = env.canvas(DW, DH); env.cache.set(k, L); } return L; };
const toView = (c: Ctx, S: Score, v: View) => c.setTransform(v.w / S.W, 0, 0, v.h / S.H, v.x, v.y);
const drawItem = (c: Ctx, S: Score, i: number, p: number, v: View) => {
  const m = S.marks[i]; toView(c, S, v);
  if (m.erase) { c.globalCompositeOperation = "destination-out"; c.globalAlpha = 1 - m.erase.ghost; c.strokeStyle = "#000"; eraserStroke(c, m.erase.path, m.erase.width, p); c.globalCompositeOperation = "source-over"; c.globalAlpha = 1; }
  else m.ink!.draw(c, p);
};

// Paint the art (paper + every layer) for a progress function, into view `v` of ctx.
// `cache` (a name) turns on prefix caching for replay: per layer, the layer with its first k items
// complete is kept, so a frame only draws the marks that are still moving. Same ops, same order:
// the cached path and the cold path produce the same pixels (gated in tools/lesson.mjs).
export const renderArt = (ctx: Ctx, env: Env, S: Score, prog: (i: number) => number, v: View, o: { cache?: string; paper?: boolean } = {}) => {
  const DW = Math.round(env.W * env.scale), DH = Math.round(env.H * env.scale);
  if (o.paper !== false) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.fillStyle = S.paper; ctx.fillRect(v.x, v.y, v.w, v.h); ctx.restore(); }
  for (const Ls of S.layers) {
    const items = S.byLayer.get(Ls.id)!; let any = false; for (const i of items) if (prog(i) > 0) { any = true; break; } if (!any) continue;
    let k = 0; while (k < items.length && prog(items[k]) >= 1) k++;
    const L = surface(env, "scratch", DW, DH), c = L.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = "source-over"; c.globalAlpha = 1; c.clearRect(0, 0, DW, DH);
    if (o.cache && k > 0) c.drawImage(prefix(env, S, Ls.id, items, k, v, o.cache, DW, DH).canvas as CanvasImageSource, 0, 0);
    else for (let j = 0; j < k; j++) drawItem(c, S, items[j], 1, v);
    for (let j = k; j < items.length; j++) { const p = prog(items[j]); if (p > 0) drawItem(c, S, items[j], Math.min(1, p), v); }
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1;
    if (Ls.tooth !== null) { c.globalCompositeOperation = "destination-in"; c.drawImage(toothMask(env, S, Ls.tooth, v, DW, DH).canvas as CanvasImageSource, 0, 0); c.globalCompositeOperation = "source-over"; }
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = Ls.alpha ?? 1; ctx.drawImage(L.canvas as CanvasImageSource, 0, 0); ctx.restore();
  }
};
// the layer with its first k items complete, built from the nearest cached prefix below k
const prefix = (env: Env, S: Score, layer: string, items: number[], k: number, v: View, name: string, DW: number, DH: number): Layer => {
  const keyOf = (j: number) => `ds:pre:${S.id}:${name}:${layer}:${j}:${v.x},${v.y},${v.w},${v.h}:${DW}x${DH}`, hit = env.cache.get(keyOf(k)) as Layer | undefined; if (hit) return hit;
  const lk = `ds:prekeys:${S.id}:${name}:${layer}:${DW}x${DH}`, keys = (env.cache.get(lk) as string[] | undefined) ?? [];
  let j = 0, from: Layer | undefined; for (const key of keys) { const jj = Number(key.split(":")[5]); if (jj < k && jj > j && env.cache.has(key)) { j = jj; from = env.cache.get(key) as Layer; } }
  const L = keys.length >= 2 ? (env.cache.get(keys[0]) as Layer) : env.canvas(DW, DH); // recycle the oldest surface
  if (keys.length >= 2) { env.cache.delete(keys.shift()!); if (from === L) { from = undefined; j = 0; } }
  const c = L.ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = "source-over"; c.globalAlpha = 1; c.clearRect(0, 0, DW, DH);
  if (from) c.drawImage(from.canvas as CanvasImageSource, 0, 0); else j = 0;
  for (let q = j; q < k; q++) drawItem(c, S, items[q], 1, v);
  keys.push(keyOf(k)); env.cache.set(lk, keys); env.cache.set(keyOf(k), L); return L;
};
// the sheet's grain over everything, once (matches the other pencil plates)
export const paperGrain = (ctx: Ctx, env: Env, opacity = 0.05) => new Gfx(ctx, env, 0, PENCIL).paper("paper", opacity);

// ---------------------------------------------------------------- step views
export const stepOf = (S: Score, i: number) => S.marks[i].step;
export const upTo = (S: Score, k: number) => (i: number) => (S.marks[i].step <= k ? 1 : 0); // steps 0..k complete
export const all = () => () => 1;
// the step-sheet grammar: what was there before step k, erasures of step k applied (drawn pale by
// the caller), and step k's new marks on their own (drawn strong)
export const before = (S: Score, k: number) => (i: number) => { const m = S.marks[i]; return m.step < k || (m.step === k && m.kind === "erase") ? 1 : 0; };
export const only = (S: Score, k: number) => (i: number) => { const m = S.marks[i]; return m.step === k && m.kind !== "erase" ? 1 : 0; };
