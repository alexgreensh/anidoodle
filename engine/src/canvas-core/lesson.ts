// LESSON OUTPUTS from one drawing score: a captioned timelapse film, a step sheet, and a "final"
// film that renders the finished drawing cold (no cache, no schedule) for the identity gate.
// Captions are drawn as pen strokes with drafting.ts: no font is ever loaded, no fillText.
import { Gfx, PENCIL, type Ctx, type Env } from "./core";
import { letter, width } from "./drafting";
import type { Film } from "./film";
import { PHASE_NAME, all, before, only, paperGrain, progressAt, renderArt, schedule, type Score, type Timing, type View } from "./drawingScore";

export type LessonLook = { ink: string; muted: string; accent: string; band: string };
const DEFAULT_LOOK: LessonLook = { ink: "#2f2a2b", muted: "#6d6462", accent: "#3f6fb8", band: "#ece5d6" };

// greedy word wrap against the drafting hand's own advance widths
export const wrap = (text: string, cap: number, maxW: number): string[] => {
  const out: string[] = []; let line = "";
  for (const w of text.toUpperCase().split(/\s+/).filter(Boolean)) { const t = line ? `${line} ${w}` : w; if (width(t, cap) > maxW && line) { out.push(line); line = w; } else line = t; }
  if (line) out.push(line); return out;
};
const pen = (ctx: Ctx, env: Env) => new Gfx(ctx, env, 0, { ...PENCIL, wobble: 0.4, rough: 0.5 });

// write lines on, one after another; `p` is 0..1 over the whole block
const block = (g: Gfx, lines: { t: string; cap: number; col: string; w: number; gap: number; slant?: number }[], x: number, y: number, p: number, seed: number) => {
  const cost = lines.map((l) => l.t.length), tot = cost.reduce((a, b) => a + b, 0) || 1; let acc = 0, yy = y;
  lines.forEach((l, i) => { const a = acc / tot, b = (acc + cost[i]) / tot, q = p >= 1 ? 1 : Math.max(0, Math.min(1, (p - a) / (b - a || 1))); acc += cost[i]; if (q > 0) letter(g, l.t, x, yy, { cap: l.cap, color: l.col, seed: seed + i * 7, w: l.w, progress: q, slant: l.slant ?? 0.12 }); yy += l.cap + l.gap; });
};

// ---------------------------------------------------------------- the timelapse
export type LessonFilmOpts = { W?: number; art?: number; timing?: Partial<Timing>; look?: Partial<LessonLook>; outro?: string };
export const lessonTiming = (o: Partial<Timing> = {}): Timing => ({ intro: 75, captionLead: 20, pause: 25, hold: 75, rate: 38, minStep: 90, maxStep: 330, grid: 15, ...o });
export const lessonFilm = (build: () => Score, o: LessonFilmOpts = {}): Film & { plan: () => ReturnType<typeof schedule>; final: Film } => {
  const W = o.W ?? 1080, art = o.art ?? 1080, bandH = 300, H = art + bandH, look = { ...DEFAULT_LOOK, ...o.look };
  let S0: Score | null = null; const score = () => (S0 ??= build()); // the score is pure data: building it once per page is safe
  const T = lessonTiming(o.timing);
  const planOf = () => schedule(score(), T);
  const P0 = planOf(), total = P0.total;
  const view = (env: Env): View => { const S = score(), k = Math.min(W / S.W, art / S.H) * env.scale, w = Math.round(S.W * k), h = Math.round(S.H * k); return { x: Math.round((W * env.scale - w) / 2), y: Math.round((art * env.scale - h) / 2), w, h }; };
  const band = (ctx: Ctx, env: Env, frame: number, final: boolean) => {
    const S = score(), P = P0, g = pen(ctx, env);
    ctx.save(); ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); ctx.fillStyle = look.band; ctx.fillRect(0, art, W, bandH); ctx.restore();
    g.pen([[40, art + 14], [W / 2, art + 12.5], [W - 40, art + 14]], { w: 1.1, color: look.muted, seed: 3, opacity: 0.5, retrace: false, boil: 0 });
    const x = 56, maxW = W - 112;
    let k = -1; for (let i = 0; i < P.steps.length; i++) if (frame >= P.steps[i].start) k = i;
    if (final || frame >= P.steps[P.steps.length - 1].end) { // the close
      block(g, [{ t: S.title.toUpperCase(), cap: 26, col: look.ink, w: 2.3, gap: 22 }, ...wrap(o.outro ?? "Finished. Now draw it again from memory: the second one teaches more than the first.", 17, maxW).map((t) => ({ t, cap: 17, col: look.muted, w: 1.6, gap: 13 }))], x, art + 58, final ? 1 : Math.min(1, (frame - P.steps[P.steps.length - 1].end) / 40), 900);
      return;
    }
    if (k < 0) { // the title card
      const lines = [{ t: S.title.toUpperCase(), cap: 30, col: look.ink, w: 2.6, gap: 22 }, { t: S.medium.toUpperCase(), cap: 16, col: look.accent, w: 1.5, gap: 16 }, ...(S.note ? wrap(S.note, 15, maxW).map((t) => ({ t, cap: 15, col: look.muted, w: 1.4, gap: 11 })) : [])];
      block(g, lines, x, art + 58, Math.min(1, frame / Math.max(1, T.intro - 15)), 700); return;
    }
    const st = S.steps[k], ps = P.steps[k], p = Math.min(1, (frame - ps.start) / Math.max(20, (ps.markEnd - ps.start) * 0.45));
    const head = `STEP ${k + 1} OF ${S.steps.length}  -  ${PHASE_NAME[st.phase].toUpperCase()}`;
    block(g, [{ t: head, cap: 14, col: look.accent, w: 1.4, gap: 16 }, { t: st.title.toUpperCase(), cap: 25, col: look.ink, w: 2.2, gap: 18 }, ...wrap(st.caption, 17, maxW).map((t) => ({ t, cap: 17, col: look.muted, w: 1.55, gap: 12 }))], x, art + 46, p, 100 + k * 50);
  };
  const draw = (ctx: Ctx, frame: number, env: Env, final: boolean) => {
    const S = score(), v = view(env);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = S.paper; ctx.fillRect(0, 0, W * env.scale, H * env.scale); ctx.restore();
    renderArt(ctx, env, S, final ? all() : progressAt(P0, frame), v, final ? {} : { cache: "film" });
    band(ctx, env, frame, final);
    paperGrain(ctx, env, 0.05);
  };
  return {
    meta: { title: score().title, W, H, fps: 30, bpm: 120, durationFrames: total, raster: "cpu" },
    assets: { images: {} },
    shots: [{ id: "lesson", start: 0, end: total, draw: (ctx, f, env) => draw(ctx, f, env, false) }],
    plan: () => P0,
    // the cold path: every mark at progress 1, no prefix cache, no schedule
    final: { meta: { title: `${score().title} (final)`, W, H, fps: 30, bpm: 120, durationFrames: 30, raster: "cpu" }, assets: { images: {} }, shots: [{ id: "final", start: 0, end: 30, draw: (ctx: Ctx, _f: number, env: Env) => draw(ctx, total - 1, env, true) }] },
  } as Film & { plan: () => ReturnType<typeof schedule>; final: Film };
};

// ---------------------------------------------------------------- the step sheet
// Every step as a panel: earlier marks pale under a paper veil, the step's new marks strong, and
// under it the step's caption. Read top-left to bottom-right, like the brick booklet.
export const lessonSheet = (build: () => Score, o: { cols?: number; panel?: number; look?: Partial<LessonLook>; crop?: [number, number, number, number] } = {}): Film => {
  const look = { ...DEFAULT_LOOK, ...o.look }, cols = o.cols ?? 4, pw = o.panel ?? 470, capH = 215, gap = 34, head = 190;
  let S0: Score | null = null; const score = () => (S0 ??= build());
  const n = score().steps.length, rows = Math.ceil(n / cols), W = cols * pw + (cols + 1) * gap, H = head + rows * (pw + capH) + (rows + 1) * gap - 10;
  const draw = (ctx: Ctx, _f: number, env: Env) => {
    const S = score(), k = env.scale, g = pen(ctx, env);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = look.band; ctx.fillRect(0, 0, W * k, H * k); ctx.restore();
    block(g, [{ t: S.title.toUpperCase(), cap: 34, col: look.ink, w: 3, gap: 20 }, { t: `${S.medium.toUpperCase()}  -  ${S.steps.length} STEPS`, cap: 16, col: look.accent, w: 1.5, gap: 14 }, ...(S.note ? wrap(S.note, 14, W - 2 * gap).map((t) => ({ t, cap: 14, col: look.muted, w: 1.3, gap: 10 })) : [])], gap + 4, 42, 1, 11);
    S.steps.forEach((st, i) => {
      const cx = gap + (i % cols) * (pw + gap), cy = head + gap + Math.floor(i / cols) * (pw + capH + gap);
      // the crop (a design-space box) fills the panel, so a small subject is not lost in margin
      const [c0, c1, c2, c3] = o.crop ?? [0, 0, S.W, S.H], sc = Math.min(pw / (c2 - c0), pw / (c3 - c1)), ox = cx + (pw - (c2 - c0) * sc) / 2 - c0 * sc, oy = cy + (pw - (c3 - c1) * sc) / 2 - c1 * sc;
      const v: View = { x: Math.round(ox * k), y: Math.round(oy * k), w: Math.round(S.W * sc * k), h: Math.round(S.H * sc * k) }, R = [Math.round(cx * k), Math.round(cy * k), Math.round(pw * k), Math.round(pw * k)] as const;
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.beginPath(); ctx.rect(R[0], R[1], R[2], R[3]); ctx.clip(); ctx.fillStyle = S.paper; ctx.fillRect(R[0], R[1], R[2], R[3]);
      renderArt(ctx, env, S, before(S, i), v, { paper: false });
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 0.68; ctx.fillStyle = S.paper; ctx.fillRect(R[0], R[1], R[2], R[3]); ctx.globalAlpha = 1; // earlier marks go pale
      renderArt(ctx, env, S, only(S, i), v, { paper: false });
      ctx.restore();
      ([[[cx, cy], [cx + pw, cy + 0.6]], [[cx + pw, cy], [cx + pw - 0.4, cy + pw]], [[cx + pw, cy + pw], [cx + 0.5, cy + pw - 0.3]], [[cx, cy + pw], [cx, cy]]] as [number, number][][]).forEach((l, j) => g.pen(l, { w: 0.9, color: look.muted, seed: 20 + i * 4 + j, opacity: 0.5, retrace: false, boil: 0, taper: 0.3, wobble: 0.3 }));
      const lines = [{ t: `${i + 1}`, cap: 30, col: look.accent, w: 2.6, gap: -30 }, { t: `      ${st.title.toUpperCase()}`, cap: 17, col: look.ink, w: 1.7, gap: 8 }, { t: `      ${PHASE_NAME[st.phase].toUpperCase()}`, cap: 11, col: look.accent, w: 1.1, gap: 16 }, ...wrap(st.caption, 13, pw - 6).map((t) => ({ t, cap: 13, col: look.muted, w: 1.25, gap: 9 }))];
      block(g, lines, cx + 2, cy + pw + 22, 1, 300 + i * 40);
    });
    paperGrain(ctx, env, 0.04);
  };
  return { meta: { title: `${score().title} (step sheet)`, W, H, fps: 30, bpm: 120, durationFrames: 30, raster: "cpu" }, assets: { images: {} }, shots: [{ id: "sheet", start: 0, end: 30, draw }] };
};
