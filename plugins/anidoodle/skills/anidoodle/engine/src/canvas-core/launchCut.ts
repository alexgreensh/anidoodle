// LAUNCH CUT. A launch film is two things: the CONTENT (a continuous timeline of pictures, the chat,
// the plates) and the CUT, a list of data segments that picks spans of that content, re-times them,
// and splices full-frame TYPE FRAMES between them. Re-timing a film is then an edit to a list, never
// to scene code. launch3.ts is the worked example; launchTemplate.ts builds your own film on it.
//
//   const cut = makeCut([pic(0, 200), type(lines, 64, 199, 200), pic(200, 360, 90), ...]);
//   cut.N              the cut's length in frames
//   cut.at(F)          which segment frame F is in, and the local frame inside it
//   cut.contentOf(s,l) the content frame a picture segment shows at local frame l
//   cut.cutOf(c)       where content frame c lands in the cut (for sound events), -1 if cut away
//
// Type frames are an ink bloom: ink opens from the centre over the picture, a page is inside the
// bloom, the words letter themselves on it, and the ink closes to a point on the next picture.
// Words never sit over the art.
import type { Ctx, Env, P } from "./core";
import { C, blot, expo, pathOf, ramp, selfLayer } from "./launchKit";
import { measure, writeOn, type KStyle } from "./kinetic";

export type TypeLine = { text: string; style: KStyle; color: string };
export type PicSeg = { kind: "pic"; from: number; to: number; len: number };
export type TypeSeg = { kind: "type"; lines: TypeLine[]; len: number; before: number; after: number };
export type Seg = PicSeg | TypeSeg;
// a span of content [from, to) played over `len` frames (len < to - from plays it faster)
export const pic = (from: number, to: number, len = to - from): Seg => ({ kind: "pic", from, to, len });
// a type frame of `len` frames; the bloom opens over content frame `before`, closes onto `after`
export const type = (lines: TypeLine[], len: number, before: number, after = before): Seg => ({ kind: "type", lines, len, before, after });

export const makeCut = (SEGS: Seg[]) => {
  const STARTS = (() => { let t = 0; return SEGS.map((s) => { const a = t; t += s.len; return a; }); })();
  const N = STARTS[STARTS.length - 1] + SEGS[SEGS.length - 1].len;
  const at = (F: number) => { let i = SEGS.length - 1; while (i > 0 && STARTS[i] > F) i--; return { s: SEGS[i], local: F - STARTS[i] }; };
  const contentOf = (s: PicSeg, local: number) => s.from + ((s.to - s.from) * local) / s.len;
  const cutOf = (c: number) => { for (let i = 0; i < SEGS.length; i++) { const s = SEGS[i]; if (s.kind === "pic" && c >= s.from && c < s.to) return STARTS[i] + ((c - s.from) * s.len) / (s.to - s.from); } return -1; };
  return { SEGS, STARTS, N, at, contentOf, cutOf };
};

// The beat grid: at `bpm` and `fps`, how many frames a beat and a bar (4 beats) last. Cut on
// downbeats (bar starts), land the claim on a chosen bar, and solve one flexible segment's length
// so it does: `solve(bar, fixedFrames)` = frames left for the flexible segment, or throw.
export const beatGrid = (bpm: number, fps: number) => {
  const beat = (60 / bpm) * fps, bar = beat * 4;
  return {
    beat, bar,
    frameOf: (barNo: number, beatNo = 0) => Math.round(barNo * bar + beatNo * beat),
    solve: (barNo: number, fixed: number, min = 60) => {
      const left = Math.round(barNo * bar) - fixed;
      if (left < min) throw new Error(`beatGrid: only ${left} frames left to land on bar ${barNo}; shorten the cut before it or pick a later bar`);
      return left;
    },
  };
};

// ---------------------------------------------------------------- the bloom
export type BloomOpts = { inF?: number; outF?: number; close?: boolean; radius?: number; seed?: number; bg?: string; ink?: string; W?: number; H?: number;
  // where the bloom opens from (default the frame's centre): a match cut opens it from the motif (motif.ts)
  center?: P;
  // "circle": a clean round iris instead of the ink blot (the clean preset); rim: the ink edge's width (default 26)
  shape?: "blot" | "circle"; rim?: number;
  // the opening's ease, 0..1 over inF + 2 frames (default expo: shut, then most of the frame in four frames)
  ease?: (t: number) => number };
// A full-frame page inside an ink bloom. `under` draws the picture the bloom opens over (and closes
// onto); `page` draws the page, in screen coordinates, on an offscreen sheet. With close: false the
// bloom stays open (an end card).
// the bloom's radius at a local frame: a page is fully covered while it is 1110 or more (1920x1080)
export const bloomRadius = (local: number, len: number, o: BloomOpts = {}) => {
  const IN = o.inF ?? 14, OUT = o.outF ?? 14, u = (o.ease ?? expo)(ramp(local, 0, IN + 2)), v = o.close === false ? 0 : expo(ramp(local, len - OUT, len));
  return (o.radius ?? 1250) * (v > 0 ? 1 - v : u);
};
export const bloomFrame = (ctx: Ctx, env: Env, local: number, len: number, under: (first: boolean) => void, page: (c: Ctx) => void, o: BloomOpts = {}) => {
  const W = o.W ?? 1920, H = o.H ?? 1080, R = bloomRadius(local, len, o);
  under(local < len / 2);
  if (R < 2) return;
  const L = selfLayer(env, "sheet", Math.round(W * env.scale), Math.round(H * env.scale)), c = L.ctx;
  c.setTransform(env.scale, 0, 0, env.scale, 0, 0); c.fillStyle = o.bg ?? C.bg; c.fillRect(0, 0, W, H);
  page(c);
  const ctr: P = o.center ?? [W / 2, H / 2], seed = o.seed ?? 88, rim = o.rim ?? 26;
  const edge = (r: number) => { if (o.shape === "circle") { ctx.beginPath(); ctx.arc(ctr[0], ctr[1], Math.max(0, r), 0, Math.PI * 2); } else pathOf(ctx, blot(ctr, r, seed)); };
  ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); ctx.save();
  if (rim > 0) { edge(R + rim); ctx.fillStyle = o.ink ?? C.ink; ctx.fill(); }
  edge(Math.max(0, R - (o.shape === "circle" ? 0 : 4))); ctx.clip();
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(L.canvas, 0, 0); ctx.restore();
};

// A type frame: one to three lines, each written on by its own tool, 20 frames apart, sized to fit.
// `bug` draws a corner brand mark on the page (the logo recurs on every frame of the film).
// `lead`: when the first line starts, relative to the bloom being open (default -2); `stagger`: frames
// between lines (default 20); a line takes 18 frames to write.
export type TypeOpts = BloomOpts & { maxW?: number; lead?: number; stagger?: number; text?: P }; // text: the words' centre (default the frame's)
export const typeFrame = (ctx: Ctx, env: Env, lines: TypeLine[], local: number, len: number, under: (first: boolean) => void, bug?: (c: Ctx) => void, o: TypeOpts = {}) => {
  const IN = o.inF ?? 14, W = o.W ?? 1920, H = o.H ?? 1080, maxW = o.maxW ?? 1560, lead = o.lead ?? -2, st = o.stagger ?? 20;
  bloomFrame(ctx, env, local, len, under, (c) => {
    const n = lines.length, size = Math.min(n === 1 ? 190 : 130, ...lines.map((l) => (maxW / measure(l.text, 100)) * 100)), gap = size * 1.45, y0 = (o.text ? o.text[1] : H / 2) - ((n - 1) * gap) / 2 + size * 0.5;
    lines.forEach((l, i) => writeOn(c, env, l.text, o.text ? o.text[0] : W / 2, y0 + i * gap, size, ramp(local, IN + lead + i * st, IN + lead + 18 + i * st), l.style, { color: l.color, align: "center", seed: 7 + i }));
    bug?.(c);
  }, o);
};
