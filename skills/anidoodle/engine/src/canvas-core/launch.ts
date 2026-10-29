// LAUNCH. The anidoodle launch film, 1920x1080, 30 fps, 104 s on the 90 bpm grid of its own score
// (a beat is 20 frames, a bar 80: every scene starts on a bar the music changes on).
//
// THE STORY is one sentence, told from the user's chair: you can make images, illustrations,
// loops, animations and films, in pure code. A person types into a chat and presses Generate; the
// Generate button becomes a drop of ink that blooms into the answer. Each request opens a chapter,
// and the chapter's word writes itself onto a rail at the left as it is delivered:
//   Illustrations  the koi draws itself, stroke by stroke
//   Animations     "now make it swim": the card breaks out to the full frame and the koi swims
//                  through a pond bigger than the screen, the camera following
//   Images         the camera dives into a lily pad and the plates bloom out of shared circles
//                  (watch face, full moon, crayon balloon); then a painter's hand, borrowed
//   Animations     the crayon balloon rebuilds itself in toy bricks and flies over a brick world
//   Loops          an embroidery that stitches itself, on a seamless loop
//   Animations     a live page: Bit watches the real pointer
//   Films          the butterfly film with its own score
// then the words gather in the order of the sentence and "All in pure code." lands on the
// score's home chord, the film pulls back into the editor that draws it, and the name writes itself.
//
// Every plate on screen is that plate's own code drawing live (launchKit.plateLayer): no recordings.
// The one image is a public-domain painting the user "brings" (Van Gogh, Almond Blossom, 1890),
// pinned in assets and shown only as the attachment; the answer is adaptAlmond. The sound is code
// too: the score (music/pieces/launch.ts) plus the UI's clicks, thocks, plips and whooshes below.
import { rng, type Ctx, type Env, type P } from "./core";
import type { Film } from "./film";
import {
  C, CHAT, GEN, HOME, INPUT, MONO, REPLY, SANS, TEXT, artCard, blot, camLerp, caretAt, clamp, drawChatFrame, expo, inOut, lerp, lerpP,
  out3, pathOf, plateLayer, pointer, press, ramp, rr, selfLayer, softShadow, spring, useCam, type Cam, type ChatState,
  frozenNone,
} from "./launchKit";
import { koiDraw } from "./koiDraw";
import { koi } from "./koi";
import { koiWorld, padsOnScreen } from "./koiWorld";
import { pocketWatch } from "./pocketWatch";
import { moonPhases } from "./moonPhases";
import { balloon } from "./balloon";
import { brickBalloon } from "./brickBalloon";
import { adaptAlmond } from "./adaptAlmond";
import { embroideryAlive } from "./embroideryAlive";
import { mascotHero } from "./mascotHero";
import { stateAt, type InputLog } from "./input";
import { mechanicalLepidoptera } from "./mechanicalLepidoptera";
import { banner as bannerFilm } from "./banner";
import { launchLofi } from "./music/pieces/launch";
import { renderPiece } from "./music/render";

const W = 1920, H = 1080, FPS = 30, BEAT = 20;

// THE TIMELINE, in frames. Every boundary is on a bar of the score (80 frames).
export const T = {
  type: [0, 160], gen: [160, 240], draw: [240, 560], swim: [560, 880],
  run: [880, 1120], brick: [1120, 1520], ref: [1520, 1840], emb: [1840, 2080],
  web: [2080, 2400], film: [2400, 2720], reveal: [2720, 2960], end: [2960, 3120],
} as const;
const N = T.end[1];

// ---------------------------------------------------------------- typing
// when each character lands: a typist's rhythm, seeded, never mechanical. Later requests type
// faster: the viewer has learned the move, the film should not make them wait for it.
const charTimes = (text: string, t0: number, rate: number, seed: number) => {
  const out: number[] = []; let t = t0;
  for (let i = 0; i < text.length; i++) { const h = Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453, j = h - Math.floor(h); t += rate * (0.55 + j * 0.9) + (text[i] === " " ? 0.8 * rate : 0); out.push(t); }
  return out;
};
const typedAt = (text: string, f: number, t0: number, rate: number, seed: number) => text.slice(0, charTimes(text, t0, rate, seed).filter((t) => f >= t).length);

// ---------------------------------------------------------------- cameras
const CARD_C: P = [REPLY.x + REPLY.s / 2, REPLY.y + REPLY.s / 2];
// The push onto the reply card. It frames the card and its byline above it with ~45 px to spare top and
// bottom, so no text sits cut by the frame's edge while the camera holds there. The card stays centred
// across the frame; the sent message to its right fades out as the camera pushes in (a focus pull).
const CARD_CAM: Cam = { c: [CARD_C[0], (REPLY.y - 35 + REPLY.y + REPLY.s) / 2], z: 1.55 };
const GEN_C: P = [GEN.x + GEN.w / 2, GEN.y + GEN.h / 2];

// ---------------------------------------------------------------- 1 + 2: the first request, Generate, ink
const KOI_PROMPT = "a koi turning under lily pads, marker comic";
const KOI_TYPE = { t0: 14, rate: 2.0, seed: 7 };
const PRESS = { down: T.gen[0], up: T.gen[0] + 6 };
const DROP = { t0: PRESS.up + 6, land: PRESS.up + 22, full: PRESS.up + 60 };
const KOI_SPEED = 1.5, KOI_DONE = DROP.land + (koiDraw.meta.durationFrames - 30) / KOI_SPEED;
const koiLayer = (env: Env, f: number) => (f < KOI_DONE ? plateLayer(env, "koiDraw", koiDraw, (f - DROP.land) * KOI_SPEED, 1080) : plateLayer(env, "koi", koi, 0, 1080));

const typeCam = (ctx: Ctx, f: number): Cam => {
  const typed = typedAt(KOI_PROMPT, f, KOI_TYPE.t0, KOI_TYPE.rate, KOI_TYPE.seed), [cx] = caretAt(ctx, typed);
  // the macro follows the caret, but never so far that the start of the line leaves the frame:
  // the whole prompt fits at this zoom, so once it is long the camera holds and the caret walks on
  const z = 2.7, keepStart = TEXT.x + (W / 2 - 60) / z;
  const macro: Cam = { c: [Math.min(keepStart, Math.max(TEXT.x + 330, cx - 110)), 934], z };
  return f < 112 ? macro : camLerp(macro, HOME, expo(ramp(f, 112, 150)));
};
const leanCam = (f: number): Cam => { const lean = expo(ramp(f, DROP.land - 4, DROP.full + 20)) * 0.09; return { c: lerpP(HOME.c, CARD_C, lean * 1.6), z: 1 + lean }; };

// the ink: the button's ink wells up, lets go, arcs into the reply with a drawn smear, and blooms
const drawInk = (ctx: Ctx, env: Env, f: number, D: typeof DROP, art: CanvasImageSource, card = REPLY) => {
  if (f < PRESS.up && D === DROP) return;
  const land: P = [card.x + card.s / 2, card.y + card.s / 2], R0 = 30;
  if (f < D.t0) { const w = out3(ramp(f, D.t0 - 6, D.t0)); ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(GEN_C[0], GEN.y + 6 - w * 22, R0 * (0.3 + 0.7 * w), 0, Math.PI * 2); ctx.fill(); return; }
  if (f < D.land) {
    const at = (g: number): P => { const u = ramp(g, D.t0, D.land), e = inOut(u); return [lerp(GEN_C[0], land[0], e), lerp(GEN.y - 16, land[1], e) - Math.sin(Math.PI * u) * 170]; };
    for (let k = 30; k >= 0; k--) { const p = at(f - k * 0.1), r = R0 * (1 - k * 0.022) * (1 - 0.25 * Math.sin(Math.PI * ramp(f, D.t0, D.land))); ctx.fillStyle = C.ink; ctx.globalAlpha = k === 0 ? 1 : 0.22 * (1 - k / 31); ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1; return;
  }
  const u = ramp(f, D.land, D.full), R = lerp(18, card.s * 0.8, out3(u)), rim = lerp(40, 0, ramp(u, 0.55, 1));
  ctx.save(); rr(ctx, card.x, card.y, card.s, card.s, 22); ctx.clip();
  pathOf(ctx, blot(land, R + rim, 311)); ctx.fillStyle = C.ink; ctx.fill();
  pathOf(ctx, blot(land, Math.max(0, R - 6), 311)); ctx.clip();
  ctx.fillStyle = C.paper; ctx.fillRect(card.x, card.y, card.s, card.s); ctx.drawImage(art, card.x, card.y, card.s, card.s);
  ctx.restore();
  for (let i = 0; i < 9; i++) { const a = i * 2.39 + 0.4, d = 30 + (i % 3) * 22 + 160 * out3(ramp(u, 0, 0.3)), s = (1 - ramp(u, 0.12, 0.34)) * (4 + (i % 4) * 2.5); if (s <= 0.2) continue; ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(land[0] + Math.cos(a) * d, land[1] + Math.sin(a) * d, s, 0, Math.PI * 2); ctx.fill(); }
};

// `chrome` fades the thread's head, the byline and the composer (1 = shown): only the ink test uses it
const sceneOpen = (ctx: Ctx, env: Env, f: number, chrome = 1) => {
  useCam(ctx, env, f < T.gen[0] ? typeCam(ctx, f) : leanCam(f));
  const typed = typedAt(KOI_PROMPT, f, KOI_TYPE.t0, KOI_TYPE.rate, KOI_TYPE.seed);
  const s: ChatState = {
    typed: f < PRESS.up ? typed : "", caret: f < PRESS.up && (Math.floor(f / 8) % 2 === 0 || typed.length < KOI_PROMPT.length),
    placeholder: "Describe what you want drawn…",
    sent: f >= PRESS.up ? KOI_PROMPT : undefined, sentAlpha: ramp(f, PRESS.up, PRESS.up + 10),
    genPress: press(f, PRESS.down, PRESS.up), genHot: ramp(f, 150, 158),
    label: f >= DROP.land ? "marker comic" : undefined, labelAlpha: ramp(f, DROP.land, DROP.land + 10) * chrome,
    head: chrome, composer: chrome,
  };
  drawChatFrame(ctx, s);
  if (f >= DROP.land) softShadow(ctx, REPLY.x, REPLY.y, REPLY.s, REPLY.s, 22, ramp(f, DROP.land, DROP.full));
  drawInk(ctx, env, f, DROP, koiLayer(env, f).canvas);
  if (f >= 112 && chrome > 0) { ctx.globalAlpha = chrome; pointer(ctx, lerpP([1760, 1130], [GEN_C[0] + 18, GEN_C[1] + 6], out3(ramp(f, 116, 158))), press(f, PRESS.down, PRESS.up) * 0.8); ctx.globalAlpha = 1; }
};
const sceneDraw = (ctx: Ctx, env: Env, f: number, chrome = 1) => {
  const push = expo(ramp(f, T.draw[0] + 8, T.draw[0] + 80));
  useCam(ctx, env, camLerp(leanCam(f), CARD_CAM, push));
  drawChatFrame(ctx, { typed: "", caret: false, placeholder: "Describe what you want drawn…", sent: KOI_PROMPT, sentAlpha: 1 - push, label: "marker comic", labelAlpha: chrome, head: chrome, composer: chrome });
  artCard(ctx, REPLY.x, REPLY.y, REPLY.s, koiLayer(env, f));
};

// ---------------------------------------------------------------- a request (the rest of the chat)
// The previous answer rides back into the thread and away, the user types, presses Generate, the
// button's ink flies into the reply and the answer blooms and plays. `push` leans into the card.
type Art = { L: CanvasImageSource; w: number; h: number; crop?: [number, number, number, number] };
type Turn = { prompt: string; label: string; t0: number; attach?: string; rate?: number; seed: number };
const turnState = (tn: Turn) => {
  const times = charTimes(tn.prompt, tn.t0 + 10, tn.rate ?? 0.9, tn.seed), end = times[times.length - 1], down = Math.ceil(end + 6), up = down + 5;
  return { times, typeFrom: tn.t0 + 10, end, down, up, drop: { t0: up + 6, land: up + 22, full: up + 60 }, landAt: up + 22, fullAt: up + 60 };
};
const fitCard = (a: Art) => { const hMax = INPUT.y - 40 - REPLY.y, k = Math.min(1, hMax / ((REPLY.s * a.h) / a.w)), s = Math.round(REPLY.s * k); return { s, h: Math.round((s * a.h) / a.w) }; };
const drawArt = (ctx: Ctx, a: Art, x: number, y: number, w: number, h: number) => { if (a.crop) ctx.drawImage(a.L, ...a.crop, x, y, w, h); else ctx.drawImage(a.L, x, y, w, h); };
const sceneTurn = (ctx: Ctx, env: Env, f: number, tn: Turn, art: (f: number) => Art | null, o: { prev?: Art | null; push?: boolean } = {}) => {
  const k = turnState(tn), pushU = o.push ? expo(ramp(f, k.fullAt + 10, k.fullAt + 50)) : 0;
  useCam(ctx, env, camLerp(HOME, CARD_CAM, pushU));
  const typed = typedAt(tn.prompt, f, k.typeFrom, tn.rate ?? 0.9, tn.seed), img = tn.attach ? env.image?.(tn.attach) : undefined;
  drawChatFrame(ctx, {
    typed: f < k.up ? typed : "", caret: f < k.up, placeholder: "Describe what you want drawn…",
    sent: f >= k.up ? tn.prompt : undefined, sentAlpha: ramp(f, k.up, k.up + 10) * (1 - pushU), // the push fades it (focus pull)
    attach: f >= k.up && img ? { img, label: "" } : null,
    genPress: press(f, k.down, k.up), genHot: ramp(f, k.down - 8, k.down),
    label: f >= k.landAt ? tn.label : undefined, labelAlpha: ramp(f, k.landAt, k.landAt + 10),
  });
  // the previous answer rides up out of the thread as the new request starts
  if (o.prev && f < k.landAt) { const u = inOut(ramp(f, tn.t0, tn.t0 + 16)), c = fitCard(o.prev); ctx.globalAlpha = 1 - u; ctx.save(); ctx.translate(0, -120 * u); artCard(ctx, REPLY.x, REPLY.y, c.s, null); rr(ctx, REPLY.x, REPLY.y, c.s, c.h, 22); ctx.clip(); drawArt(ctx, o.prev, REPLY.x, REPLY.y, c.s, c.h); ctx.restore(); ctx.globalAlpha = 1; }
  if (img && f < k.up) { const u = out3(ramp(f, tn.t0, tn.t0 + 12)); ctx.globalAlpha = u; ctx.save(); rr(ctx, INPUT.x + INPUT.w - 420, INPUT.y + 16, 104, 72, 12); ctx.clip(); ctx.drawImage(img, INPUT.x + INPUT.w - 420, INPUT.y + 16, 104, 72); ctx.restore(); ctx.globalAlpha = 1; }
  const a = f >= k.drop.t0 - 6 ? art(f) : null;
  if (a && f < k.landAt) drawInk(ctx, env, f, k.drop, a.L); // the drop in flight (the bloom below takes over at landing)
  if (a && f >= k.landAt) {
    const { s, h } = fitCard(a), grow = out3(ramp(f, k.landAt, k.fullAt)), R = lerp(18, Math.hypot(s, h), grow), c: P = [REPLY.x + s / 2, REPLY.y + h / 2];
    softShadow(ctx, REPLY.x, REPLY.y, s, h, 22, grow);
    ctx.save(); rr(ctx, REPLY.x, REPLY.y, s, h, 22); ctx.clip();
    if (grow < 1) { pathOf(ctx, blot(c, R + 30 * (1 - grow), 77)); ctx.fillStyle = C.ink; ctx.fill(); pathOf(ctx, blot(c, Math.max(0, R - 5), 77)); ctx.clip(); }
    ctx.fillStyle = C.paper; ctx.fillRect(REPLY.x, REPLY.y, s, h); drawArt(ctx, a, REPLY.x, REPLY.y, s, h); ctx.restore();
  }
  pointer(ctx, lerpP([GEN_C[0] + 240, GEN_C[1] + 160], [GEN_C[0] + 18, GEN_C[1] + 6], out3(ramp(f, k.end - 14, k.down))), press(f, k.down, k.up) * 0.8);
  return k;
};
// the previous answer, still: the chat pulls back from it before the next request
const pullBack = (ctx: Ctx, env: Env, f: number, from: number, to: number, prev: Art) => {
  useCam(ctx, env, camLerp(CARD_CAM, HOME, expo(ramp(f, from, to))));
  drawChatFrame(ctx, { typed: "", caret: false, placeholder: "Describe what you want drawn…" });
  const c = fitCard(prev); softShadow(ctx, REPLY.x, REPLY.y, c.s, c.h, 22, 1.4);
  ctx.save(); rr(ctx, REPLY.x, REPLY.y, c.s, c.h, 22); ctx.clip(); ctx.fillStyle = C.paper; ctx.fillRect(REPLY.x, REPLY.y, c.s, c.h); drawArt(ctx, prev, REPLY.x, REPLY.y, c.s, c.h); ctx.restore();
};

// ---------------------------------------------------------------- 3: "now make it swim"
const SWIM: Turn = { prompt: "now make it swim", label: "animation · swimming through the pond", t0: T.swim[0] + 30, seed: 11 };
const SW = turnState(SWIM), SWIM_OPEN = SW.fullAt, SWIM_FULL = SW.fullAt + 30; // the card breaks out to the full frame
const swimFrame = (f: number) => Math.max(0, f - SWIM_OPEN);
const worldLayer = (env: Env, f: number, px = 1920) => plateLayer(env, `world${px}`, koiWorld, swimFrame(f), px);
const SQUARE: [number, number, number, number] = [420, 0, 1080, 1080]; // at t = 0 the world is framed like the plate: this square IS the koi plate
const sceneSwim = (ctx: Ctx, env: Env, f: number) => {
  const koiArt: Art = { L: plateLayer(env, "koi", koi, 0, 1080).canvas, w: 1080, h: 1080 };
  if (f < SWIM.t0) return pullBack(ctx, env, f, T.swim[0], SWIM.t0, koiArt);
  if (f < SWIM_OPEN) { sceneTurn(ctx, env, f, SWIM, () => ({ L: worldLayer(env, f).canvas, w: 1080, h: 1080, crop: SQUARE }), { prev: koiArt }); return; }
  // the break-out: the card's frame opens to the whole screen while the fish starts to move
  const u = expo(ramp(f, SWIM_OPEN, SWIM_FULL)), L = worldLayer(env, f).canvas;
  useCam(ctx, env, HOME);
  if (u < 1) { ctx.globalAlpha = 1 - u; drawChatFrame(ctx, { typed: "", caret: false, placeholder: "Describe what you want drawn…", sent: SWIM.prompt, label: SWIM.label }); ctx.globalAlpha = 1; }
  const x = lerp(REPLY.x, 0, u), y = lerp(REPLY.y, 0, u), w = lerp(REPLY.s, W, u), h = lerp(REPLY.s, H, u), sx = lerp(SQUARE[0], 0, u), sw = lerp(1080, 1920, u);
  ctx.save(); rr(ctx, x, y, w, h, 22 * (1 - u)); ctx.clip(); ctx.drawImage(L, sx, 0, sw, 1080, x, y, w, h); ctx.restore();
};

// ---------------------------------------------------------------- 4: the circle run (Images)
// The camera dives into a lily pad in the swim, and the plates bloom out of shared circles:
// lily pad -> watch face -> full moon -> balloon. Each handover: zoom into circle A, bloom B out of
// it in ink with B's own circle exactly where A's was, zoom out on B.
type Link = { film: Film; key: string; c: P; r: number };
const RUN: Link[] = [
  { film: pocketWatch, key: "watch", c: [468, 590], r: 256 },
  { film: moonPhases, key: "moon", c: [539, 390], r: 70 },
  { film: balloon, key: "balloon", c: [540, 352], r: 236 },
];
const RUN_T0 = T.run[0], STEP = 3 * BEAT, XF = 2 * BEAT;
const O: P = [460, 40], SB = 1000 / 1080;
// the pad the camera dives into: the lily pad nearest the right third of the frame as the run begins
const DIVE = (() => { const t = swimFrame(RUN_T0) / FPS, pads = padsOnScreen(t, W, H).filter((p) => p.x > 200 && p.x < W - 200 && p.y > 150 && p.y < H - 150); const pick = [...pads].sort((a, b) => Number(b.lily) - Number(a.lily) || Math.hypot(a.x - 1300, a.y - 540) - Math.hypot(b.x - 1300, b.y - 540))[0]; return pick.i; })();
const diveCircle = (f: number) => { const p = padsOnScreen(swimFrame(f) / FPS, W, H)[DIVE]; return { c: [p.x, p.y] as P, r: p.r * 0.9 }; };
const bigR = (ra: number, rb: number) => Math.min(560, ra * 3.2, rb * 3.2 * 1.6);
const mapOf = (L: Link, z01: number, R1: number) => {
  const kb = R1 / L.r, fit = (c: number, span: number, side: number) => (kb * span < side ? side / 2 - kb * (span / 2 - c) : clamp(side / 2, side - kb * (span - c), kb * c));
  const base = { at: [O[0] + SB * L.c[0], O[1] + SB * L.c[1]] as P, k: SB }, big = { at: [fit(L.c[0], 1080, W), fit(L.c[1], 1080, H)] as P, k: kb };
  return { k: Math.exp(lerp(Math.log(base.k), Math.log(big.k), z01)), at: lerpP(base.at, big.at, z01) };
};
const drawPlateMapped = (ctx: Ctx, env: Env, L: Link, m: { k: number; at: P }) => {
  const px = m.k > 1.4 ? 2160 : 1080, lay = plateLayer(env, L.key, L.film, 0, px), s = env.scale, x = m.at[0] - m.k * L.c[0], y = m.at[1] - m.k * L.c[1], size = 1080 * m.k;
  ctx.setTransform(s, 0, 0, s, 0, 0);
  softShadow(ctx, x, y, size, size, (22 * m.k) / SB, 1.3);
  ctx.save(); rr(ctx, x, y, size, size, (22 * m.k) / SB); ctx.clip(); ctx.drawImage(lay.canvas, x, y, size, size); ctx.restore();
};
const shiftTo = (m: { k: number; at: P }, from: P, to: P, z01: number) => ({ k: m.k, at: [m.at[0] + (from[0] - to[0]) * z01, m.at[1] + (from[1] - to[1]) * z01] as P });
const in3ish = (t: number) => { const c = clamp(t); return c * c * (2.2 - 1.2 * c); };
const bloomInto = (ctx: Ctx, env: Env, at: P, grow: number, seed: number, drawB: () => void) => {
  const R = lerp(0, 1500, in3ish(grow));
  ctx.save(); ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0);
  pathOf(ctx, blot(at, R + 26 * (1 - grow), seed)); ctx.fillStyle = C.ink; ctx.fill();
  pathOf(ctx, blot(at, Math.max(0, R - 4), seed)); ctx.clip();
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H); drawB(); ctx.restore();
};
const sceneRun = (ctx: Ctx, env: Env, f: number) => {
  ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  const i = Math.min(RUN.length - 1, Math.floor((f - RUN_T0) / STEP)), u = (f - (RUN_T0 + i * STEP)) / XF;
  const zin = expo(ramp(u, 0, 0.42)), zout = 1 - expo(ramp(u, 0.6, 1)), grow = ramp(u, 0.34, 0.66);
  if (u >= 1) return drawPlateMapped(ctx, env, RUN[i], mapOf(RUN[i], 0, 1));
  if (i === 0) { // A is the swim: zoom the full frame about the pad
    const d = diveCircle(f), R1 = bigR(d.r, RUN[0].r), k = Math.exp(lerp(0, Math.log(R1 / d.r), zin)), at = lerpP(d.c, [W / 2, H / 2], zin);
    const L = worldLayer(env, f, k > 1.8 ? 3840 : 1920).canvas;
    ctx.drawImage(L, at[0] - k * d.c[0], at[1] - k * d.c[1], W * k, H * k);
    if (grow > 0) { const mB0 = mapOf(RUN[0], 1, R1), mB = u < 0.6 ? { k: mB0.k, at } : shiftTo(mapOf(RUN[0], zout, R1), at, mB0.at, zout); bloomInto(ctx, env, mB.at, grow, 900, () => drawPlateMapped(ctx, env, RUN[0], mB)); }
    return;
  }
  const A = RUN[i - 1], B = RUN[i], R1 = bigR(A.r, B.r);
  drawPlateMapped(ctx, env, A, mapOf(A, zin, R1));
  if (grow > 0) { const mA = mapOf(A, 1, R1), mB0 = mapOf(B, 1, R1), mB = u < 0.6 ? { k: mB0.k, at: mA.at } : shiftTo(mapOf(B, zout, R1), mA.at, mB0.at, zout); bloomInto(ctx, env, mB.at, grow, 900 + i, () => drawPlateMapped(ctx, env, B, mB)); }
};

// ---------------------------------------------------------------- 5: "now in toy bricks, and let it fly"
const BRICK: Turn = { prompt: "now build it in toy bricks, and let it fly", label: "animation · toy bricks", t0: T.brick[0] + 30, seed: 13 };
const BK = turnState(BRICK), BRICK_SPEED = (brickBalloon.meta.durationFrames - 1) / (T.brick[1] - 12 - BK.landAt);
const brickArt = (env: Env, f: number): Art => ({ L: plateLayer(env, "brick", brickBalloon, (f - BK.landAt) * BRICK_SPEED, 1080).canvas, w: 1080, h: 1080 });
const sceneBrick = (ctx: Ctx, env: Env, f: number) => {
  const prev: Art = { L: plateLayer(env, "balloon", balloon, 0, 1080).canvas, w: 1080, h: 1080 };
  if (f < BRICK.t0) return pullBack(ctx, env, f, T.brick[0], BRICK.t0, prev);
  sceneTurn(ctx, env, f, BRICK, (g) => brickArt(env, Math.max(g, BK.landAt)), { prev, push: true });
};

// ---------------------------------------------------------------- 6: a painter's hand, borrowed
const REF: Turn = { prompt: "my koi again, painted in this hand", label: "adapted · the almond-blossom hand", t0: T.ref[0] + 30, attach: "almond", seed: 17 };
const RF = turnState(REF), ALMOND_SPEED = (adaptAlmond.meta.durationFrames - 40) / (T.ref[1] - 16 - RF.landAt);
const sceneRef = (ctx: Ctx, env: Env, f: number) => {
  const prev = brickArt(env, T.brick[1] - 1);
  if (f < REF.t0) return pullBack(ctx, env, f, T.ref[0], REF.t0, prev);
  sceneTurn(ctx, env, f, REF, (g) => ({ L: plateLayer(env, "almond", adaptAlmond, 8 + Math.max(0, g - RF.landAt) * ALMOND_SPEED, 1080).canvas, w: 1080, h: 1080 }), { prev });
};

// ---------------------------------------------------------------- 7: a loop (embroidery)
const EMB: Turn = { prompt: "and one in embroidery, on a loop", label: "loop · seamless", t0: T.emb[0] + 20, seed: 19 };
const EM = turnState(EMB), embArt = (env: Env, f: number): Art => ({ L: plateLayer(env, "emb", embroideryAlive, Math.max(0, f - EM.landAt) % embroideryAlive.meta.durationFrames, 1080).canvas, w: 1080, h: 1080 });
const sceneEmb = (ctx: Ctx, env: Env, f: number) => {
  const prev: Art = { L: plateLayer(env, "almond", adaptAlmond, adaptAlmond.meta.durationFrames - 1, 1080).canvas, w: 1080, h: 1080 };
  sceneTurn(ctx, env, f, EMB, (g) => embArt(env, g), { prev, push: true });
};

// ---------------------------------------------------------------- 8: a live page (Bit)
const WEB: Turn = { prompt: "a robot for my landing page who watches the visitor", label: "interactive · watches the pointer", t0: T.web[0] + 20, rate: 0.8, seed: 23 };
const WB = turnState(WEB);
const BROWSER = { x: 330, y: 70, w: 1460, h: 940 }, HERO = { x: 1090, y: 230, s: 620 }, START = { x: 450, y: 610, w: 250, h: 72 };
const webPointer = (g: number): P => { const pts: P[] = [[1580, 900], [1380, 420], [840, 330], [START.x + 140, START.y + 40]], u = clamp(g / 60) * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(u)); return lerpP(pts[i], pts[i + 1], inOut(u - i)); };
let LOG: InputLog | null = null;
const webLog = (): InputLog => {
  const toPiece = (x: number, y: number): P => [((x - HERO.x) * 560) / HERO.s, ((y - HERO.y) * 560) / HERO.s];
  const [sx, sy] = toPiece(START.x, START.y), log: InputLog = [{ tick: 0, type: "rect", target: "start", x: sx, y: sy, w: (START.w * 560) / HERO.s, h: (START.h * 560) / HERO.s }];
  for (let t = 0; t <= 240; t += 2) { const [x, y] = webPointer(t / 2), [px, py] = toPiece(x, y); log.push({ tick: t, type: "move", x: px, y: py, value: "mouse" }); }
  log.push({ tick: 118, type: "enter", target: "start" }, { tick: 170, type: "down", target: "start" }, { tick: 178, type: "up", target: "start" });
  return log.sort((a, b) => a.tick - b.tick);
};
const subEnvOf = (env: Env, key: string, size: number, scale: number): Env => { const k = `sub:${key}:${scale}`; let e = env.cache.get(k) as Env | undefined; if (!e) { e = { W: size, H: size, scale, cache: new Map(), canvas: env.canvas, image: env.image }; env.cache.set(k, e); } return e; };
const webPage = (ctx: Ctx, env: Env, open: number, tick: number) => {
  useCam(ctx, env, HOME); ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  const e = expo(open), bx = lerp(CHAT.x, BROWSER.x, e), by = lerp(CHAT.y, BROWSER.y, e), bw = lerp(CHAT.w, BROWSER.w, e), bh = lerp(CHAT.h, BROWSER.h, e);
  softShadow(ctx, bx, by, bw, bh, 26, 1.4); ctx.fillStyle = "#fff"; rr(ctx, bx, by, bw, bh, 26); ctx.fill();
  ctx.save(); rr(ctx, bx, by, bw, bh, 26); ctx.clip();
  ctx.fillStyle = "#f4f1ea"; ctx.fillRect(bx, by, bw, 64); ["#e8715a", "#e9b949", "#7cbf6b"].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(bx + 34 + i * 26, by + 32, 8, 0, Math.PI * 2); ctx.fill(); });
  ctx.fillStyle = "#fff"; rr(ctx, bx + 150, by + 14, Math.min(560, bw - 300), 36, 18); ctx.fill(); ctx.fillStyle = C.soft; ctx.font = SANS(500, 19); ctx.textBaseline = "middle"; ctx.fillText("your-site.com", bx + 176, by + 33);
  ctx.globalAlpha = ramp(open, 0.5, 1);
  ctx.fillStyle = C.ink; ctx.font = SANS(700, 76); ctx.textBaseline = "alphabetic"; ctx.fillText("Meet Bit.", START.x, 420);
  ctx.font = SANS(500, 30); ctx.fillStyle = C.soft; ctx.fillText("He reads along with you.", START.x, 480); ctx.fillText("Try the button.", START.x, 522);
  ctx.fillStyle = tick >= 118 ? C.accentDeep : C.ink; rr(ctx, START.x, START.y, START.w, START.h, 36); ctx.fill(); ctx.fillStyle = "#fff"; ctx.font = SANS(600, 28); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("Get started", START.x + START.w / 2, START.y + START.h / 2 + 1); ctx.textAlign = "left";
  LOG ??= webLog();
  const st = stateAt(tick, LOG, mascotHero.input), px = Math.round(HERO.s * env.scale), L = selfLayer(env, "bit", px, px), sub = subEnvOf(env, "bit", 560, px / 560);
  mascotHero.draw(L.ctx, tick, sub, st);
  ctx.save(); rr(ctx, HERO.x, HERO.y, HERO.s, HERO.s, 28); ctx.clip(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(L.canvas, HERO.x * env.scale, HERO.y * env.scale); ctx.restore(); useCam(ctx, env, HOME);
  ctx.globalAlpha = 1; ctx.restore();
  pointer(ctx, webPointer(tick / 2), tick >= 170 && tick < 178 ? 1 : 0);
};
const webTick = (f: number) => Math.max(0, (f - WB.landAt - 10) * 2);
const sceneWeb = (ctx: Ctx, env: Env, f: number) => {
  if (f < WB.landAt) { sceneTurn(ctx, env, f, WEB, () => null, { prev: embArt(env, T.emb[1] - 1) }); return; }
  webPage(ctx, env, ramp(f, WB.landAt, WB.landAt + 24), webTick(f));
};

// ---------------------------------------------------------------- 9: a film, with its own score
const FILMT: Turn = { prompt: "now a short film, with its own music", label: "film · with its own score", t0: T.film[0] + 26, seed: 29 };
const FM = turnState(FILMT);
const sceneFilm = (ctx: Ctx, env: Env, f: number) => {
  if (f < FILMT.t0) { webPage(ctx, env, 1 - ramp(f, T.film[0], FILMT.t0), webTick(T.web[1] - 1)); return; } // the page folds back into the chat
  sceneTurn(ctx, env, f, FILMT, (g) => ({ L: plateLayer(env, "lep", mechanicalLepidoptera, 1040 + Math.max(0, g - FM.landAt) * 1.5, 1080).canvas, w: 1080, h: 1080 }));
  if (f >= FM.fullAt) {
    const wave = waveform(env), x0 = REPLY.x + REPLY.s + 60, x1 = CHAT.x + CHAT.w - 70, y = REPLY.y + REPLY.s / 2, head = (f - FM.landAt) * 1.5 + 1040;
    ctx.globalAlpha = ramp(f, FM.fullAt, FM.fullAt + 12);
    for (let i = 0; i < 90; i++) { const a = wave[Math.max(0, Math.min(wave.length - 1, Math.floor(head - 45 + i)))] ?? 0, x = lerp(x0, x1, i / 89), h = 8 + a * 260; ctx.fillStyle = i < 45 ? C.accent : C.line; rr(ctx, x - 2.5, y - h / 2, 5, h, 2.5); ctx.fill(); }
    ctx.fillStyle = C.soft; ctx.font = SANS(500, 18); ctx.textBaseline = "alphabetic"; ctx.fillText("its score: a music box, drawn in code too", x0, y + 180);
    ctx.globalAlpha = 1;
  }
};
const waveform = (env: Env): number[] => {
  let w = env.cache.get("wave") as number[] | undefined; if (w) return w;
  const sr = 6000, [L] = mechanicalLepidoptera.audio!(sr), per = sr / FPS; w = []; let peak = 1e-6;
  for (let i = 0; i < L.length / per; i++) { let s = 0; for (let j = 0; j < per; j++) { const v = L[Math.floor(i * per + j)] ?? 0; s += v * v; } const r = Math.sqrt(s / per); w.push(r); peak = Math.max(peak, r); }
  w = w.map((v) => Math.pow(v / peak, 0.6)); env.cache.set("wave", w); return w;
};

// ---------------------------------------------------------------- the chapter rail
// The story's words, written onto the left edge as each is delivered; the live one in ink with an
// accent dot, the delivered ones quiet. At the reveal they gather in the sentence's own order.
const CH = [
  { word: "Illustrations", at: [300] },
  { word: "Animations", at: [SWIM_OPEN, BK.landAt, WB.landAt] },
  { word: "Images", at: [T.run[0] + 20, RF.landAt] },
  { word: "Loops", at: [EM.landAt] },
  { word: "Films", at: [FM.landAt] },
];
const SENTENCE = ["Images", "Illustrations", "Loops", "Animations", "Films"];
const railPos = (i: number): P => [56, 540 - (CH.length * 64) / 2 + i * 64 + 40];
const drawRail = (ctx: Ctx, env: Env, f: number) => {
  ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); ctx.textBaseline = "alphabetic";
  const live = CH.map((c, i) => ({ i, t: Math.max(...c.at.filter((a) => a <= f), -1) })).sort((a, b) => b.t - a.t)[0];
  CH.forEach((c, i) => {
    const a = spring(f, c.at[0], 0.3, 0.72); if (a <= 0) return;
    const [x, y] = railPos(i), on = live.t >= 0 && live.i === i, pulse = on ? 1 - clamp((f - live.t) / 20) : 0;
    ctx.globalAlpha = clamp(a); ctx.font = SANS(700, 34 + 4 * pulse);
    ctx.fillStyle = "rgba(255,253,248,0.55)"; ctx.fillText(c.word, x + 1.5 - 24 * (1 - a), y + 2); // a soft lift off whatever is behind
    ctx.fillStyle = on ? C.ink : C.mute; ctx.fillText(c.word, x - 24 * (1 - a), y);
    if (on) { ctx.fillStyle = C.accent; ctx.beginPath(); ctx.arc(x - 22, y - 12, 6 + 3 * pulse, 0, Math.PI * 2); ctx.fill(); }
  });
  ctx.globalAlpha = 1;
};

// ---------------------------------------------------------------- 10: all in pure code
const kw = /\b(export|const|type|as)\b/g;
const CODE = ["// THE TIMELINE, in frames. Every boundary is on a bar of the score.", "export const T = {", ...Object.entries(T).map(([k, v]) => `  ${k}: [${v[0]}, ${v[1]}],`), "} as const;"];
const sceneReveal = (ctx: Ctx, env: Env, f: number) => {
  const r0 = T.reveal[0], u = expo(ramp(f, r0, r0 + 40)), lines = ramp(f, r0 + 16, r0 + 90);
  ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); ctx.fillStyle = "#1b1916"; ctx.fillRect(0, 0, W, H);
  const ed = { x: 60, y: 70, w: 900, h: 940 };
  ctx.globalAlpha = u; ctx.fillStyle = "#23201c"; rr(ctx, ed.x, ed.y, ed.w, ed.h, 20); ctx.fill();
  ctx.fillStyle = "#8f8676"; ctx.font = MONO(18); ctx.textBaseline = "middle"; ctx.fillText("launch.ts", ed.x + 28, ed.y + 34);
  let left = Math.floor(lines * CODE.join("").length);
  CODE.forEach((ln, i) => {
    const n = Math.max(0, Math.min(ln.length, left)); left -= ln.length; if (n <= 0) return;
    const y = ed.y + 90 + i * 44, text = ln.slice(0, n);
    ctx.fillStyle = "#5d564b"; ctx.font = MONO(18); ctx.fillText(String(i + 1).padStart(2, " "), ed.x + 24, y);
    ctx.font = MONO(22); ctx.fillStyle = text.trim().startsWith("//") ? "#7e9a6c" : "#e9e1d3"; ctx.fillText(text, ed.x + 74, y);
    if (!text.trim().startsWith("//")) { ctx.fillStyle = C.accent; for (const m of text.matchAll(kw)) ctx.fillText(m[0], ed.x + 74 + ctx.measureText(text.slice(0, m.index)).width, y); }
  });
  ctx.globalAlpha = 1;
  // the film, shrunk into its canvas pane, still playing its last scene
  const pane = { x: lerp(0, 1010, u), y: lerp(0, 150, u), w: lerp(W, 850, u), h: lerp(H, 478, u) };
  const L = selfLayer(env, "inner", Math.round(W * env.scale * 0.5), Math.round(H * env.scale * 0.5)), sub: Env = { ...env, scale: env.scale * 0.5 };
  sceneFilm(L.ctx, sub, T.film[1] - 40 + (f - r0) * 0.25);
  ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0);
  ctx.save(); rr(ctx, pane.x, pane.y, pane.w, pane.h, 18 * u); ctx.clip(); ctx.drawImage(L.canvas, pane.x, pane.y, pane.w, pane.h); ctx.restore();
  ctx.globalAlpha = u; ctx.fillStyle = "#8f8676"; ctx.font = MONO(18); ctx.textBaseline = "middle"; ctx.fillText("canvas · 1920×1080 · 30 fps · every frame and every sound computed", 1010, 122); ctx.globalAlpha = 1;
  // the chapter words fly from the rail to the sentence, one a beat, then the line lands on the downbeat
  // the slots are laid out by measured width, as a line of type: two lines under the pane
  const g0 = r0 + 40, gap = 16, maxX = 1860; ctx.font = SANS(700, 44); ctx.textBaseline = "alphabetic";
  const slots: P[] = []; let sx = 1010, sy = 720;
  SENTENCE.forEach((w, j) => { const wd = ctx.measureText(w + (j < 4 ? "," : "")).width; if (sx + wd > maxX) { sx = 1010; sy += 70; } slots.push([sx, sy]); sx += wd + gap; });
  SENTENCE.forEach((word, j) => {
    const ci = CH.findIndex((c) => c.word === word), from = railPos(ci), q = inOut(ramp(f, g0 + j * 10, g0 + j * 10 + 30)), p = lerpP(from, slots[j], q);
    ctx.font = SANS(700, lerp(34, 44, q)); ctx.fillStyle = mixTo("#8a8173", "#f4efe6", q); ctx.fillText(word + (j < 4 ? "," : ""), p[0], p[1]);
  });
  const hit = spring(f, 2880, 0.32, 0.62); // bar 36 of the score: the home chord
  if (hit > 0) { ctx.globalAlpha = clamp(hit); ctx.font = SANS(800, 84); ctx.fillStyle = C.accent; ctx.fillText("All in pure code.", 1010, 920 + (1 - hit) * 26); ctx.globalAlpha = 1; }
};
const mixTo = (a: string, b: string, t: number) => { const h = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16)); const x = h(a), y = h(b); return `rgb(${x.map((v, i) => Math.round(lerp(v, y[i], clamp(t)))).join(",")})`; };

const sceneEnd = (ctx: Ctx, env: Env, f: number) => {
  ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); ctx.fillStyle = "#f4efe6"; ctx.fillRect(0, 0, W, H);
  const L = plateLayer(env, "banner", bannerFilm, Math.min(200, 12 + (f - T.end[0]) * 1.6), 2000);
  ctx.drawImage(L.canvas, 0, 230, 1920, (1920 * 620) / 2000);
  ctx.fillStyle = C.ink; ctx.font = MONO(30); ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.globalAlpha = ramp(f, T.end[0] + 40, T.end[0] + 56); ctx.fillText("/plugin install anidoodle@alexgreensh-anidoodle", 960, 910);
  ctx.fillStyle = C.soft; ctx.font = SANS(500, 26); ctx.fillText("Images · Illustrations · Loops · Animations · Films   ·   Claude Code and Codex   ·   github.com/alexgreensh/anidoodle", 960, 972); ctx.textAlign = "left"; ctx.globalAlpha = 1;
};

// ---------------------------------------------------------------- the sound
// The score, cut to the film's length, plus the interface: a key click per character, the Generate
// thock, the ink's plip as it lands, a whoosh for every dive and break-out. All synthesized.
const launchAudio = (sr: number): [Float32Array, Float32Array] => {
  const n = Math.round((N / FPS) * sr), L = new Float32Array(n), R = new Float32Array(n);
  const m = renderPiece(launchLofi(), sr); for (let i = 0; i < n && i < m.L.length; i++) { L[i] = m.L[i]; R[i] = m.R[i]; }
  const fade = Math.round(1.5 * sr); for (let i = 0; i < fade; i++) { const g = i / fade; L[n - 1 - i] *= g; R[n - 1 - i] *= g; }
  const r = rng(4242), add = (t: number, len: number, fn: (s: number) => number, gain: number, pan = 0) => { const i0 = Math.round(t * sr); for (let i = 0; i < len * sr && i0 + i < n; i++) { if (i0 + i < 0) continue; const v = fn(i / sr) * gain; L[i0 + i] += v * (1 - Math.max(0, pan)); R[i0 + i] += v * (1 + Math.min(0, pan)); } };
  const click = (fr: number) => { const f0 = 2600 + r() * 1400, ph = r() * 6; add(fr / FPS, 0.03, (s) => Math.sin(2 * Math.PI * f0 * s + ph) * Math.exp(-s / 0.004) + (r() - 0.5) * Math.exp(-s / 0.002) * 0.6, 0.05, (r() - 0.5) * 0.4); };
  const thock = (fr: number) => add(fr / FPS, 0.14, (s) => Math.sin(2 * Math.PI * (70 + 90 * Math.exp(-s / 0.02)) * s) * Math.exp(-s / 0.05), 0.2);
  const plip = (fr: number) => add(fr / FPS, 0.16, (s) => Math.sin(2 * Math.PI * (320 + 700 * Math.exp(-s / 0.03)) * s) * Math.exp(-s / 0.06), 0.12);
  const whoosh = (fr: number, len = 0.7) => { let z = 0; add(fr / FPS, len, (s) => { z += 0.12 * ((r() - 0.5) - z); return z * Math.sin((Math.PI * s) / len) ** 2; }, 0.55); };
  charTimes(KOI_PROMPT, KOI_TYPE.t0, KOI_TYPE.rate, KOI_TYPE.seed).forEach(click); thock(PRESS.down); plip(DROP.land);
  [SWIM, BRICK, REF, EMB, WEB, FILMT].forEach((tn) => { const k = turnState(tn); k.times.forEach(click); thock(k.down); plip(k.landAt); });
  whoosh(SWIM_OPEN, 0.9); [0, 1, 2].forEach((i) => whoosh(RUN_T0 + i * STEP, 0.9)); whoosh(T.reveal[0], 1.2);
  return [L, R];
};

// ---------------------------------------------------------------- the film
const withRail = (draw: (ctx: Ctx, env: Env, f: number) => void) => (ctx: Ctx, env: Env, f: number) => { draw(ctx, env, f); drawRail(ctx, env, f); };
const shot = (id: keyof typeof T, draw: (ctx: Ctx, env: Env, f: number) => void) => ({ id, start: T[id][0], end: T[id][1], draw: (ctx: Ctx, local: number, env: Env) => draw(ctx, env, T[id][0] + local) });
export const launch: Film = {
  meta: {
    title: "anidoodle · launch", W, H, fps: FPS, bpm: 90, durationFrames: N, raster: "cpu", kind: "launch",
    // the reveal pulls back into the editor that draws the film: a full screen of its own code, the words
    // gathering over it into the sentence. The dense code is the point (it is all code), not a layout fault.
    checks: { layoutExempt: [[T.reveal[0], T.reveal[1], "the reveal: the editor that draws this film, full of its own code, the words gathering over it"]], none: frozenNone(["gate:identical", "gate:still"]) },
  },
  assets: { images: { almond: "assets/refs/vangogh-almond-blossom.jpg" } }, // public domain; provenance in engine/assets/refs/PROVENANCE.json
  shots: [
    shot("type", withRail(sceneOpen)), shot("gen", withRail(sceneOpen)), shot("draw", withRail(sceneDraw)), shot("swim", withRail(sceneSwim)),
    shot("run", withRail(sceneRun)), shot("brick", withRail(sceneBrick)), shot("ref", withRail(sceneRef)), shot("emb", withRail(sceneEmb)),
    shot("web", withRail(sceneWeb)), shot("film", withRail(sceneFilm)), shot("reveal", sceneReveal), shot("end", sceneEnd),
  ],
  audio: Object.assign(launchAudio, { scores: [launchLofi()] }),
};

// THE MOTION TEST: the Generate press, the drop and the bloom, on their own. The chat's small print (the
// thread's head, the byline, the composer and its button) fades out in the half second before the last
// one, so the test ends on the bloomed card and the request: nothing under 28 px is left on the end.
// Its declarations are its own (the launch film's exemptions are for frames this test does not have):
// anidoodle's temperament and colours, a length budget, and the two words on screen that claim
// something, each in facts/launchClip.json with its source. Its critic record is reviews/launchClip.json.
export const launchClip: Film & { claims: string[] } = {
  meta: {
    ...launch.meta, title: "anidoodle · launch, the ink test", durationFrames: 120,
    checks: { length: { target: 4, max: 5 } },
    // alive but never violent: the press, the drop's arc and the card's spring land small and settle short.
    // anidoodle's brand colour is its orange accent. The near-black is the drawing ink, a neutral that
    // washes and trails at part strength by nature in the drawn look, so it is not declared as a brand fill
    motion: { temperament: "lively", brandColors: [C.accent] },
    holds: [
      [7, 27, "the pointer settles on Generate and presses it: a small move on a still chat, the beat before the ink"],
      [90, 120, "the koi's first pencil lines: fine strokes on a still card, the test ends on the card itself"],
    ],
  },
  assets: launch.assets,
  // the thread's subline says how the art is made, and the card's byline names its style; the prompt is
  // a user's request and the rest is the chat's own interface, which claim nothing
  claims: ["drawn in code", "marker comic"],
  shots: [{ id: "ink", start: 0, end: 120, draw: (ctx, local, env) => {
    const f = 140 + local, chrome = 1 - inOut(ramp(local, 75, 89)), scene = f < T.draw[0] ? sceneOpen : sceneDraw;
    scene(ctx, env, f, chrome); drawRail(ctx, env, f);
  } }],
};
export const KEYS = () => ({ SWIM: SW, BRICK: BK, REF: RF, EMB: EM, WEB: WB, FILM: FM, KOI_DONE, SWIM_OPEN, DIVE });
