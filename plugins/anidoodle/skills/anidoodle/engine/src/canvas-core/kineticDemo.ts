// KINETIC DEMO. Every treatment in kinetic.ts, on the launch film's grid (90 bpm: a beat is 20 frames).
//   0-60     the wordmark written large by the dip pen, then the corner mark writes itself in
//   60-160   six words, six media: ink, crayon, thread, chalk (on a board), toy bricks, marker; a callout with an arrow
//   160-280  the finale: one medium per word, then "All in pure code." with its swash
import type { Ctx, Env } from "./core";
import type { Film } from "./film";
import { caption, logoBug, logoCentred, measure, sentence, writeOn, type KStyle } from "./kinetic";

const W = 1920, H = 1080, PAPER = "#f4efe6";
const ground = (ctx: Ctx, env: Env) => { ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H); };
const ease = (t: number) => { const c = Math.max(0, Math.min(1, t)); return c * c * (3 - 2 * c); };
const bug = (ctx: Ctx, env: Env, f: number) => logoBug(ctx, env, f, 1640, 1030, 1, { t0: 40 });
// a slow, constant push-in about the frame centre, drawn as vector (positions and sizes scale, no raster
// resample): once a shot's words are down the camera keeps leaning in, so the frame never goes still.
// The corner bug is screen furniture and stays put.
const push = (f: number, len: number, amt: number) => { const z = 1 + (amt * f) / len; return { z, x: (x: number) => W / 2 + (x - W / 2) * z, y: (y: number) => H / 2 + (y - H / 2) * z }; };

const opening = (ctx: Ctx, f: number, env: Env) => {
  ground(ctx, env);
  logoCentred(ctx, env, W / 2, H / 2, 150 * push(f, 60, 0.04).z, ease(f / 44));
  bug(ctx, env, f);
};
// two rows of three, each row laid out by measured width and centred
const SZ = 100, ROWS: [string, KStyle][][] = [[["INK", "ink"], ["CRAYON", "crayon"], ["THREAD", "thread"]], [["CHALK", "chalk"], ["BRICKS", "brick"], ["MARKER", "marker"]]];
const WORDS: [string, KStyle, number, number][] = ROWS.flatMap((row, r) => { const gap = 90, tot = row.reduce((a, [t]) => a + measure(t, SZ), 0) + gap * (row.length - 1); let x = W / 2 - tot / 2; return row.map(([t, st]) => { const o: [string, KStyle, number, number] = [t, st, x, r ? 700 : 360]; x += measure(t, SZ, st === "brick" ? { track: 2.6, slant: 0 } : {}) + gap; return o; }); });
const styles = (ctx: Ctx, f: number, env: Env) => {
  ground(ctx, env);
  const P = push(f, 100, 0.02), z = P.z, sz = SZ * z, [, , cx, cy] = WORDS[3], cw = measure("CHALK", sz); // the chalkboard behind the chalk word
  const bx = P.x(cx - 50), by = P.y(cy - SZ - 55);
  ctx.fillStyle = "#2c3a33"; ctx.fillRect(bx, by, cw + 100 * z, sz + 110 * z); ctx.strokeStyle = "#6b4a2b"; ctx.lineWidth = 14 * z; ctx.strokeRect(bx, by, cw + 100 * z, sz + 110 * z);
  WORDS.forEach(([t, st, x, y], i) => writeOn(ctx, env, t, P.x(x), P.y(y), sz, ease((f - i * 10) / 38), st, { seed: 3 + i }));
  caption(ctx, env, "drawn live, no fonts", P.x(W / 2 + 180), P.y(960), 40 * z, ease((f - 60) / 30), "arrow", { to: [P.x(WORDS[5][2] + 60), P.y(790)] });
  bug(ctx, env, f + 60);
};
const finale = (ctx: Ctx, f: number, env: Env) => {
  ground(ctx, env);
  const P = push(f, 120, 0.03);
  sentence(ctx, env, ["Images", "Illustrations", "Loops", "Animations", "Films"], f, 0, { beat: 14, size: 74 * P.z, claimSize: 118 * P.z, top: P.y(H * 0.3) });
  bug(ctx, env, f + 160);
};

export const kineticDemo: Film = {
  meta: { title: "kinetic lettering · demo", W, H, fps: 30, bpm: 90, durationFrames: 280, raster: "cpu" },
  assets: { images: {} },
  shots: [
    { id: "logo", start: 0, end: 60, draw: opening },
    { id: "styles", start: 60, end: 160, draw: styles },
    { id: "finale", start: 160, end: 280, draw: finale },
  ],
};
