// LESSON LAYOUT FOR THE README OWL. The shared lesson.ts film and sheet were sized for a desk
// screen: at README width (about 900 px on GitHub) their 13 px captions fell to 6 px and the HB
// lines to a hair. This is the same grammar (one drawing score, one renderer, captions written as
// pen strokes with drafting.ts, never fillText) laid out for a small screen:
//   - the sheet is a 3 x 3 grid of tall panels, so a panel is ~275 px wide on the README;
//   - step titles are 40 px caps and captions 28 px caps at sheet size (about 18 px and 13 px
//     when GitHub shrinks the sheet to 900 px), drawn with a heavy pen in near-black;
//   - earlier steps sit under a lighter veil (0.45, not 0.68) so the build-up stays visible;
//   - the last panel, the payoff, shows the whole owl at full strength with no veil.
// The film: a 1080 px wide art area with a deep caption band under it, captions ~3x the old size.
import { Gfx, PENCIL, type Ctx, type Env } from "./core";
import { letter } from "./drafting";
import type { Film } from "./film";
import { all, before, only, paperGrain, progressAt, renderArt, schedule, type Score, type Timing, type View } from "./drawingScore";
import { lessonTiming, wrap } from "./lesson";

export type OwlLook = { ink: string; body: string; accent: string; band: string; rule: string };
const LOOK: OwlLook = { ink: "#1d191a", body: "#2e292a", accent: "#2f5fae", band: "#ebe4d4", rule: "#8a817c" };
const pen = (ctx: Ctx, env: Env) => new Gfx(ctx, env, 0, { ...PENCIL, wobble: 0.35, rough: 0.45 });

type Line = { t: string; cap: number; col: string; w: number; gap: number; x?: number };
// write lines on, one after another; `p` is 0..1 over the whole block (a hand writes, nothing fades)
const block = (g: Gfx, lines: Line[], x: number, y: number, p: number, seed: number) => {
  const cost = lines.map((l) => l.t.length), tot = cost.reduce((a, b) => a + b, 0) || 1; let acc = 0, yy = y;
  lines.forEach((l, i) => { const a = acc / tot, b = (acc + cost[i]) / tot, q = p >= 1 ? 1 : Math.max(0, Math.min(1, (p - a) / (b - a || 1))); acc += cost[i]; if (q > 0) letter(g, l.t, x + (l.x ?? 0), yy, { cap: l.cap, color: l.col, seed: seed + i * 7, w: l.w, progress: q, slant: 0.1, opacity: 1 }); yy += l.cap + l.gap; });
};
const rule = (g: Gfx, x0: number, x1: number, y: number, seed: number, col: string) => g.pen([[x0, y], [(x0 + x1) / 2, y - 1.2], [x1, y + 0.6]], { w: 1.6, color: col, seed, opacity: 0.6, retrace: false, boil: 0, wobble: 0.3 });

// ---------------------------------------------------------------- the timelapse
export type OwlFilmOpts = { timing?: Partial<Timing>; outro?: string; subtitle?: string };
export const owlFilm = (build: () => Score, o: OwlFilmOpts = {}) => {
  let S0: Score | null = null; const score = () => (S0 ??= build());
  const S = score(), W = 1080, art = Math.round((W * S.H) / S.W), bandH = 360, H = art + bandH;
  const T = lessonTiming({ intro: 90, captionLead: 24, pause: 12, hold: 120, rate: 30, minStep: 120, maxStep: 330, ...o.timing });
  const P0 = schedule(S, T), total = P0.total, last = P0.steps[P0.steps.length - 1];
  const view = (env: Env): View => ({ x: 0, y: 0, w: Math.round(W * env.scale), h: Math.round(art * env.scale) });
  const band = (ctx: Ctx, env: Env, frame: number, final: boolean) => {
    const g = pen(ctx, env), x = 60, maxW = W - 120;
    ctx.save(); ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); ctx.fillStyle = LOOK.band; ctx.fillRect(0, art, W, bandH); ctx.restore();
    rule(g, 40, W - 40, art + 16, 3, LOOK.rule);
    let k = -1; for (let i = 0; i < P0.steps.length; i++) if (frame >= P0.steps[i].start) k = i;
    if (final || frame >= last.end) { // the close
      block(g, [{ t: S.title.toUpperCase(), cap: 56, col: LOOK.ink, w: 6.2, gap: 30 }, ...wrap(o.outro ?? "Now draw it again from memory.", 32, maxW).map((t) => ({ t, cap: 32, col: LOOK.body, w: 3.6, gap: 18 }))], x, art + 70, final ? 1 : Math.min(1, (frame - last.end) / 45), 900);
      return;
    }
    if (k < 0) { // the title card
      block(g, [{ t: S.title.toUpperCase(), cap: 62, col: LOOK.ink, w: 6.8, gap: 30 }, ...wrap(o.subtitle ?? S.medium, 30, maxW).map((t) => ({ t, cap: 30, col: LOOK.accent, w: 3.3, gap: 16 }))], x, art + 70, Math.min(1, frame / Math.max(1, T.intro - 20)), 700);
      return;
    }
    const st = S.steps[k], ps = P0.steps[k], p = Math.min(1, (frame - ps.start) / Math.max(24, (ps.markEnd - ps.start) * 0.4));
    block(g, [{ t: `STEP ${k + 1} OF ${S.steps.length}`, cap: 26, col: LOOK.accent, w: 3.2, gap: 22 }, { t: st.title.toUpperCase(), cap: 52, col: LOOK.ink, w: 6, gap: 26 }, ...wrap(st.caption, 31, maxW).map((t) => ({ t, cap: 31, col: LOOK.body, w: 3.5, gap: 17 }))], x, art + 50, p, 100 + k * 50);
  };
  const draw = (ctx: Ctx, frame: number, env: Env, final: boolean) => {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = S.paper; ctx.fillRect(0, 0, W * env.scale, H * env.scale); ctx.restore();
    // Every frame is drawn cold, no prefix cache. Measured 2026-09-26: the shared prefix cache chains
    // layer copies, and after ~600 forward frames on one page frame 1778 differed from a cold render in
    // 36 px (max 12 levels), so an MP4 rendered by several warm pages was history-dependent (render.mjs
    // probe 5/6). A cold frame costs ~80-100 ms here, inside the 150 ms budget, and is exact by construction.
    renderArt(ctx, env, S, final ? all() : progressAt(P0, frame), view(env));
    band(ctx, env, frame, final);
    paperGrain(ctx, env, 0.05);
  };
  // the pencil rests between steps (the pause before the next caption starts): declared, never hidden
  const holds: [number, number][] = P0.steps.map((s) => [Math.ceil(s.markEnd), s.end] as [number, number]).filter(([a, b]) => b > a);
  holds.push([Math.ceil(last.end + 46), total]);
  return {
    meta: { title: S.title, W, H, fps: 30, bpm: 120, durationFrames: total, raster: "cpu", kind: "drawing", holds },
    assets: { images: {} },
    shots: [{ id: "lesson", start: 0, end: total, draw: (ctx: Ctx, f: number, env: Env) => draw(ctx, f, env, false) }],
    plan: () => P0,
    final: { meta: { title: `${S.title} (final)`, W, H, fps: 30, bpm: 120, durationFrames: 30, raster: "cpu" }, assets: { images: {} }, shots: [{ id: "final", start: 0, end: 30, draw: (ctx: Ctx, _f: number, env: Env) => draw(ctx, total - 1, env, true) }] } as Film,
  } as Film & { plan: () => ReturnType<typeof schedule>; final: Film };
};

// ---------------------------------------------------------------- the step sheet
export type OwlSheetOpts = { crop: [number, number, number, number]; subtitle: string; medium: string };
export const owlSheet = (build: () => Score, o: OwlSheetOpts): Film => {
  let S0: Score | null = null; const score = () => (S0 ??= build());
  const cols = 3, pw = 600, ph = 800, capH = 280, gap = 48, head = 318;
  const n = score().steps.length, rows = Math.ceil(n / cols), W = cols * pw + (cols + 1) * gap, H = head + rows * (ph + capH) + rows * gap + 10;
  const draw = (ctx: Ctx, _f: number, env: Env) => {
    const S = score(), k = env.scale, g = pen(ctx, env);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = LOOK.band; ctx.fillRect(0, 0, W * k, H * k); ctx.restore();
    block(g, [{ t: S.title.toUpperCase(), cap: 92, col: LOOK.ink, w: 10, gap: 34 }, ...wrap(o.subtitle, 34, W - 2 * gap).map((t) => ({ t, cap: 34, col: LOOK.accent, w: 3.8, gap: 16 })), { t: o.medium.toUpperCase(), cap: 22, col: LOOK.body, w: 2.6, gap: 10 }], gap + 2, 60, 1, 11);
    S.steps.forEach((st, i) => {
      const cx = gap + (i % cols) * (pw + gap), cy = head + Math.floor(i / cols) * (ph + capH + gap);
      const [c0, c1, c2, c3] = o.crop, sc = Math.min(pw / (c2 - c0), ph / (c3 - c1)), ox = cx + (pw - (c2 - c0) * sc) / 2 - c0 * sc, oy = cy + (ph - (c3 - c1) * sc) / 2 - c1 * sc;
      const v: View = { x: Math.round(ox * k), y: Math.round(oy * k), w: Math.round(S.W * sc * k), h: Math.round(S.H * sc * k) }, R = [Math.round(cx * k), Math.round(cy * k), Math.round(pw * k), Math.round(ph * k)] as const;
      const payoff = i === n - 1;
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.beginPath(); ctx.rect(R[0], R[1], R[2], R[3]); ctx.clip(); ctx.fillStyle = S.paper; ctx.fillRect(R[0], R[1], R[2], R[3]);
      if (payoff) renderArt(ctx, env, S, all(), v, { paper: false });
      else {
        if (i > 0) { renderArt(ctx, env, S, before(S, i), v, { paper: false }); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 0.45; ctx.fillStyle = S.paper; ctx.fillRect(R[0], R[1], R[2], R[3]); ctx.globalAlpha = 1; }
        renderArt(ctx, env, S, only(S, i), v, { paper: false });
      }
      ctx.restore();
      ([[[cx, cy], [cx + pw, cy + 0.6]], [[cx + pw, cy], [cx + pw - 0.4, cy + ph]], [[cx + pw, cy + ph], [cx + 0.5, cy + ph - 0.3]], [[cx, cy + ph], [cx, cy]]] as [number, number][][]).forEach((l, j) => g.pen(l, { w: payoff ? 2.2 : 1.3, color: payoff ? LOOK.ink : LOOK.rule, seed: 20 + i * 4 + j, opacity: 0.7, retrace: false, boil: 0, taper: 0.3, wobble: 0.3 }));
      const num = `${i + 1}`, indent = 72, titleLines = wrap(st.title, 40, pw - indent);
      block(g, [{ t: num, cap: 58, col: LOOK.accent, w: 6.4, gap: 0 }], cx + 2, cy + ph + 24, 1, 300 + i * 40);
      block(g, [...titleLines.map((t) => ({ t, cap: 40, col: LOOK.ink, w: 4.6, gap: 22 })), ...wrap(st.caption, 28, pw - 4).map((t, j) => ({ t, cap: 28, col: LOOK.body, w: 3.2, gap: 13, x: -indent }))].map((l, j) => (j < titleLines.length ? { ...l, x: 0 } : l)), cx + 2 + indent, cy + ph + 24 + (titleLines.length === 1 ? 10 : 0), 1, 330 + i * 40);
    });
    paperGrain(ctx, env, 0.04);
  };
  return { meta: { title: `${score().title} (step sheet)`, W, H, fps: 30, bpm: 120, durationFrames: 30, raster: "cpu" }, assets: { images: {} }, shots: [{ id: "sheet", start: 0, end: 30, draw }] };
};
