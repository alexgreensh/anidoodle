// TEST FIXTURES for tools/motionscan.mjs, tools/layerscan.mjs and the render blur mask: a brand launch
// faults in six seconds, and the same material built the way the kit now builds it.
//   fixtureDeck  RED: slides cut one after another in one layout (a carousel), a cross-dissolve, the
//                old ease-out text exit, type whipped off at speed, brand yellow faded in, a frieze
//                sliding across a speaker's face.
//   fixtureWorld GREEN: one world, one camera travelling between regions, setType entries and exits,
//                alternate() sides, opaque brand colour, the frieze behind the speaker.
import { probeRect, type Ctx, type Env } from "./core";
import type { Film } from "./film";
import { setType } from "./kinetic";
import { alternate } from "./motionKit";
import { world } from "./world";

const W = 640, H = 360, FPS = 30, BG = "#111111", YEL = "#ffde59";
const meta = (title: string, durationFrames: number) => ({ title, W, H, fps: FPS, bpm: 120, durationFrames });
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const screen = (ctx: Ctx, env: Env) => ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0);
const TITLES = ["You talk to AI all day.", "Nobody has a prompt for that.", "Half a day with marketers.", "Real systems, real results.", "Meet the speakers.", "See you there."];

// the hand-rolled exit a brand launch film used first: words sink on an EASE-OUT over 1.0x the size
const oldRise = (ctx: Ctx, s: string, x: number, y: number, px: number, p: number) => {
  if (p === 0) return; const sink = p < 0, q0 = Math.abs(p);
  ctx.font = `800 ${px}px Helvetica, Arial, sans-serif`; ctx.textBaseline = "alphabetic"; ctx.fillStyle = "#ffffff";
  const words = s.split(" "), sp = ctx.measureText(" ").width, wd = words.map((v) => ctx.measureText(v).width), total = wd.reduce((a, b) => a + b, 0) + sp * (words.length - 1);
  let cx = x; ctx.save(); ctx.beginPath(); ctx.rect(cx - px, y - px * 1.05, total + 2 * px, px * 1.35); ctx.clip();
  words.forEach((v, i) => { const q = clamp(q0 * (1 + 0.3 * (words.length - 1)) - 0.3 * i), e = 1 - Math.pow(1 - q, 3); if (sink ? q < 1 : q > 0) ctx.fillText(v, cx, y + (sink ? e : 1 - e) * px * 1.0); cx += wd[i] + sp; });
  ctx.restore();
};

// ---------------------------------------------------------------- RED: 4 slides of 60 frames (rise, hold, sink); slide 2 whips, slide 3 dissolves in, slide 4 has the speaker
const slide = (ctx: Ctx, env: Env, i: number, local: number) => {
  screen(ctx, env); ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = clamp(local / 10); ctx.fillStyle = YEL; ctx.fillRect(40, 60, 260, 240); ctx.globalAlpha = 1; // brand yellow faded in: olive mud
  const whip = i === 1 && local >= 54, x = 330 + (whip ? (local - 53) * 70 : 0);   // slide 2 whips its title off at 70 px a frame
  oldRise(ctx, TITLES[i], x, 190, 28, whip ? 1 : local < 8 ? local / 8 : local >= 30 ? -clamp((local - 30) / 28) : 1);
  if (i === 3) { const img = env.image?.("person"); if (img) { ctx.drawImage(img, 120, 80, 120, 160); } ctx.fillStyle = "#e0457b"; const fx = -60 + local * 9; probeRect(ctx, env, fx, 90, 140, 40, "brand:frieze"); ctx.fillRect(fx, 90, 140, 40); } // a frieze slides across the face
};
export const fixtureDeck: Film = {
  meta: { ...meta("fixture: deck", 240), motion: { brandColors: [YEL] } },
  assets: { images: { person: "test/fixtures/motion-person.png" } },
  shots: [0, 1, 2, 3].map((i) => ({ id: `slide${i + 1}`, start: i * 60, end: i * 60 + 60, draw: (ctx: Ctx, local: number, env: Env) => {
    slide(ctx, env, i, local);
    if (i === 2 && local < 12) { // a cross-dissolve from the slide before
      const u = local / 12; ctx.save(); ctx.globalAlpha = 1 - u; ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H); ctx.fillStyle = YEL; ctx.fillRect(40, 60, 260, 240); ctx.restore();
    }
  } })),
};

// ---------------------------------------------------------------- GREEN
const W3 = world({ W, H, regions: [0, 1, 2, 3].map((i) => ({ id: `r${i}`, rect: [i * 680, 0, 640, 360] as [number, number, number, number] })),
  stops: [{ f: 0, at: "r0", hold: 10 }, { f: 80, at: "r1", hold: 10 }, { f: 160, at: "r2", hold: 10 }, { f: 239, at: "r3" }], alive: { amp: 1.5, seed: 4 } });
export const fixtureWorld: Film = {
  meta: { ...meta("fixture: one world", 240), motion: { brandColors: [YEL], temperament: "lively" } },
  assets: { images: { person: "test/fixtures/motion-person.png" } },
  shots: [{ id: "world", start: 0, end: 240, draw: (ctx: Ctx, f: number, env: Env) => {
    screen(ctx, env); ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
    W3.begin(ctx, env, f);
    [0, 1, 2, 3].forEach((i) => W3.region(ctx, `r${i}`, (r) => {
      const [x, y] = r.rect, side = alternate(i, ["left", "right"]), cardX = side === "left" ? x + 40 : x + 340;
      ctx.fillStyle = YEL; ctx.fillRect(cardX, y + 60, 260, 240); // opaque, always
      if (i === 2) { ctx.fillStyle = "#e0457b"; ctx.fillRect(cardX + 20 + Math.sin(f / 9) * 30, y + 90, 140, 40); const img = env.image?.("person"); if (img) ctx.drawImage(img, cardX + 70, y + 80, 120, 160); } // the frieze moves BEHIND the speaker
      const enter = clamp((f - (i * 80 - 20)) / 14), leave = clamp((f - (i * 80 + 40)) / 28); // the same 28-frame exit the deck uses, done with setType out
      setType(ctx, env, TITLES[i], side === "left" ? x + 330 : x + 40, y + 190, 26, enter, { color: "#ffffff", weight: 800, space: "world", out: i === 3 ? 0 : leave });
    }));
    W3.end(ctx);
  } }],
};
