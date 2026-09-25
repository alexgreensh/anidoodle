import type { Ctx, Env, Layer, P } from "./core";
import type { Film } from "./film";
import { clamp, newsprint, plateLayer, screenDots, starve, toneAt } from "./halftoneKit";
import { buildTone } from "./halftoneScene";

// NEWSPRINT HALFTONE · two-colour, black plus one spot.
//
// MEDIUM, physically: a web-offset newspaper press. The photograph is broken by a contact
// screen into an AM halftone: dots on a fixed grid, their AREA carrying the tone. Two plates:
// BLACK on the classic 45 degree screen and ONE SPOT (a warm orange, the paper's colour ink) on
// its own screen 30 degrees away, at 15, so the two rosette instead of moire. Oil-based ink on
// unbleached groundwood newsprint: every dot soaks sideways into the fibres (dot GAIN, 20-30% in
// the midtones, so the shadows plug toward solid and the light dots fatten), its edge is ragged
// where the fibres wicked it, and a faint halo of spread ink sits round it. Highlights below ~4%
// do not hold on newsprint and drop out to bare paper. The paper stretches across the web
// between the spot unit and the black unit (fan-out) and the units are never quite in register,
// so the orange lands a hair wide and low: a sliver of it shows at the edges of dark shapes.
//
// MARKS: only dots. No line is drawn anywhere; every edge in the picture is where dot size
// changes. EDGE: the photo's own rectangle, with bare newsprint round it (where the misregister
// shows as a thin orange lip on one side). ORDER: the press, not a hand. The original (the
// photograph, built in halftoneScene.ts) is screened into two plates; the spot unit prints, then
// the black unit over it; both multiply, so orange under black is a warm near-black.
// PALETTE: black ink #1d1a17, spot orange #e86a2c, newsprint #e6dfcc. PAPER: newsprint with its
// grey-cream pulp cloud, short dark groundwood fibres, pale surface fibres and the odd bark shive.
//
// NOT RISOGRAPH (its nearest neighbour, lighthouse.ts): riso lays FLAT stencil drums of bright
// fluorescent soy ink that overprint into new colours, with hand-cut shapes and spot tints. This
// is a PHOTOGRAPH: one continuous tone field per ink, rendered only by dot size, dull oil ink,
// dot gain and fibre, one warm spot in a grey world. There are no shapes, only tone.
//
// SUBJECT, LIGHT, REFERENCE: see halftoneScene.ts (Ribblehead-type stone viaduct, a black 4-6-0
// and five coaches, golden hour, sun low to the right, the plume lit on its right flank).
//
// PROCESS (the film): the delivery pile at the end of the press during MAKE-READY. Each beat a
// new sheet is thrown onto the pile. The first sheets carry the spot unit alone, coming up to
// colour: starved and blotchy, then evening out ink key by ink key across the width. Then the
// black unit is thrown on and comes up the same way over the orange; the photograph appears.
// The spot is out of register (the pressman has had nothing to register it TO until the black
// is down); he nudges it in over the last sheets, and the final sheet is the approved print.

const N = 420, BEAT = 15;
// ---------------------------------------------------------------- the cue table (frames)
const CUE = { firstSheet: 15, blackOn: 135, register: 300, lastSheet: 375 } as const;
const SLIDE = 6; // frames for a thrown sheet to land
(() => { if (Object.values(CUE).some((f) => f % 15)) throw new Error("halftone: cue off the beat grid"); if (CUE.lastSheet + SLIDE > N - 30) throw new Error("halftone: the final sheet lands inside the hold"); })();
const SHEETS = (CUE.lastSheet - CUE.firstSheet) / BEAT + 1; // sheets thrown, the last one is the print

export const BLACK = "#1d1a17", SPOT = "#e86a2c";
const PITCH = 5.2, ANG_K = 45, ANG_S = 15, GAIN_K = 0.42, GAIN_S = 0.3, FAN = 0.0016;
const REG_FINAL: P = [1.2, 1.6];          // where the spot sits on the approved sheet (logical px)
const REG_START: P = [9, -7];              // where it sat before the pressman had the black to register to
const KEYS = 12;                           // ink keys across the width of the fountain

// the photograph occupies a rectangle on the sheet, bare paper round it
const photo = (W: number, H: number) => ({ x0: Math.round(W * 0.045), y0: Math.round(H * 0.045), x1: Math.round(W * 0.955), y1: Math.round(H * 0.955) });

const plates = (env: Env) => {
  const T = buildTone(env), b = photo(env.W, env.H), tag = `${env.W}x${env.H}@${env.scale}`;
  const inside = (x: number, y: number) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
  const kDots = env.cache.get(`halftone:kdots:${tag}`) as ReturnType<typeof screenDots> | undefined ?? (() => { const d = screenDots(b, PITCH, ANG_K, (x, y) => (inside(x, y) ? toneAt(T, T.k, x, y) : 0), GAIN_K); env.cache.set(`halftone:kdots:${tag}`, d); return d; })();
  const sDots = env.cache.get(`halftone:sdots:${tag}`) as ReturnType<typeof screenDots> | undefined ?? (() => { const d = screenDots(b, PITCH, ANG_S, (x, y) => (inside(x, y) ? toneAt(T, T.s, x, y) : 0), GAIN_S, FAN); env.cache.set(`halftone:sdots:${tag}`, d); return d; })();
  return { k: plateLayer(env, `halftone:kplate:${tag}`, kDots, BLACK, 0.9, 7), s: plateLayer(env, `halftone:splate:${tag}`, sDots, SPOT, 0.8, 11), b };
};

// ---------------------------------------------------------------- the make-ready schedule
// Sheet i: how far the ink has come up across the width (0 starved .. 1 at colour), and where
// the spot sits. The fountain has KEYS ink keys; the oscillating rollers smear their settings
// sideways, so density varies smoothly across the sheet, never in hard strips.
type Sheet = { spot: (x: number) => number; black: (x: number) => number; reg: P; seed: number };
const hash = (a: number, b: number) => Math.abs(Math.sin(a * 12.9898 + b * 78.233) * 43758.5453) % 1;
const across = (level: number, seed: number) => (x: number) => {   // x in 0..1 across the sheet
  if (level >= 1) return 1; if (level <= 0) return 0;
  const f = x * (KEYS - 1), i = Math.floor(f), t = f - i, e = (1 - Math.cos(t * Math.PI)) / 2, key = (z: number) => clamp(level * 1.5 - hash(z, seed) * 0.6 - 0.1);
  return key(i) * (1 - e) + key(Math.min(KEYS - 1, i + 1)) * e;
};
const I_BLACK = (CUE.blackOn - CUE.firstSheet) / BEAT, I_REG = (CUE.register - CUE.firstSheet) / BEAT;
const sheet = (i: number): Sheet => {
  const done = i >= SHEETS - 1, lS = done ? 1 : Math.min(1, (i + 1) / I_BLACK) * (i >= I_BLACK + 2 ? 2 : 1), lK = done ? 1 : i < I_BLACK ? 0 : Math.min(1, (i - I_BLACK + 1) / (I_REG - I_BLACK)) * (i >= I_REG ? 2 : 1);
  const nudge = clamp((i - I_REG) / (SHEETS - 1 - I_REG)), reg: P = [REG_START[0] + (REG_FINAL[0] - REG_START[0]) * nudge, REG_START[1] + (REG_FINAL[1] - REG_START[1]) * nudge];
  return { spot: across(lS, 3 + (i % 3)), black: across(lK, 7 + (i % 2)), reg, seed: i };
};

// one sheet off the press, composited onto its own surface
const STRIPS = 54;
const printSheet = (env: Env, i: number): Layer => {
  const key = `halftone:sheet:${i}:${env.W}x${env.H}@${env.scale}`; let L = env.cache.get(key) as Layer | undefined; if (L) return L;
  // keep only the sheets on top of the pile: an evicted sheet is rebuilt identically if asked for
  for (const ck of [...env.cache.keys()]) if (ck.startsWith("halftone:sheet:")) { const n = Number(ck.split(":")[2]); if (n < i - 1 || n > i + 1) env.cache.delete(ck); }
  const W = env.W, H = env.H, k = env.scale, DW = Math.round(W * k), DH = Math.round(H * k);
  L = env.canvas(DW, DH); const c = L.ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.drawImage(newsprint(env, `halftone:paper:${W}x${H}@${k}`).canvas, 0, 0);
  if (i < 0) { env.cache.set(key, L); return L; }
  const sh = sheet(i), P = plates(env), tk = `halftone:tmp:${DW}x${DH}`, tmp = (env.cache.get(tk) as Layer | undefined) ?? (() => { const t = env.canvas(DW, DH); env.cache.set(tk, t); return t; })();
  const ink = (plate: Layer, dens: (x: number) => number, off: P, seed: number) => {
    const sw = W / STRIPS, d = Array.from({ length: STRIPS }, (_, z) => dens((z + 0.5) / STRIPS));
    if (d.every((v) => v <= 0)) return;
    const t = tmp.ctx; t.setTransform(1, 0, 0, 1, 0, 0); t.globalCompositeOperation = "copy"; t.drawImage(plate.canvas, Math.round(off[0] * k), Math.round(off[1] * k)); t.globalCompositeOperation = "source-over";
    const sft: P = [hash(seed, 1) * 256, hash(seed, 2) * 256];
    d.forEach((v, z) => { if (v < 1) starve(t, env, [z * sw, 0, (z + 1) * sw, H], 1 - v * 0.9, sft); });
    // where a key is barely open the film of ink is thin: the zone prints light as well as broken
    c.save(); c.globalCompositeOperation = "multiply";
    d.forEach((v, z) => { if (v <= 0) return; const x0 = Math.floor(z * sw * k), x1 = z === STRIPS - 1 ? DW : Math.floor((z + 1) * sw * k); c.globalAlpha = v >= 1 ? 1 : 0.3 + 0.7 * v; c.drawImage(tmp.canvas, x0, 0, x1 - x0, DH, x0, 0, x1 - x0, DH); });
    c.restore();
  };
  ink(P.s, sh.spot, sh.reg, sh.seed * 2 + 1);
  ink(P.k, sh.black, [0, 0], sh.seed * 2 + 2);
  env.cache.set(key, L); return L;
};

const draw = (ctx: Ctx, f: number, env: Env) => {
  const k = env.scale, DW = Math.round(env.W * k), DH = Math.round(env.H * k);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const n = f < CUE.firstSheet ? -1 : Math.min(SHEETS - 1, Math.floor((f - CUE.firstSheet) / BEAT)), t0 = CUE.firstSheet + n * BEAT, u = n < 0 ? 1 : clamp((f - t0) / SLIDE);
  if (f >= CUE.lastSheet + SLIDE || u >= 1) { ctx.drawImage(printSheet(env, n).canvas, 0, 0); return; }
  // a sheet in flight: thrown from the top, it slides down over the pile and lands
  ctx.drawImage(printSheet(env, n - 1).canvas, 0, 0);
  const e = 1 - Math.pow(1 - u, 3), y = Math.round(-DH * (1 - e));
  const sg = ctx.createLinearGradient(0, y + DH, 0, y + DH + 26 * k); sg.addColorStop(0, "rgba(30,25,20,0.32)"); sg.addColorStop(1, "rgba(30,25,20,0)");
  ctx.fillStyle = sg; ctx.fillRect(0, y + DH, DW, 26 * k);                             // its shadow on the sheet below
  ctx.drawImage(printSheet(env, n).canvas, 0, y);
};

export const halftone: Film = {
  meta: { title: "Viaduct at golden hour · newsprint halftone", W: 1080, H: 1080, fps: 30, bpm: 120, durationFrames: N },
  assets: { images: {} },
  shots: [{ id: "makeready", start: 0, end: N, draw }],
};

export const STYLE = { id: "halftone", name: "Newsprint halftone", family: "print", medium: "web-offset newspaper print: black on a 45 degree AM screen plus one orange spot at 15 degrees, oil ink gaining into unbleached groundwood newsprint", nearest: "lighthouse", hero: "a steam train crossing a stone viaduct at golden hour" };
