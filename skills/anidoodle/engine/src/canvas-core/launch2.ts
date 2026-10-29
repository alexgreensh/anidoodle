// LAUNCH, CUT 2. 69 s on the 26-bar score (music/pieces/launch.ts, launchLofi2): 90 bpm, a bar is
// 80 frames. Alex's notes on cut 1 are the brief: it read as a slide deck; nobody could tell it
// was code; the drawings were slow; the waits were long; the styles came one at a time; the site
// was barely shown; the type was set, not drawn; the logo appeared once; the end card was cut out.
// So: the logo writes itself first; the koi draws beside its own code streaming ("no image model,
// just code"); a real chat thread that keeps every answer and scrolls; every drawing 3-6x faster;
// every change of scene a move (break-outs, whip pans, punch-ins, card flips), never a cut; the 31
// styles as a rolling wall the camera punches into; the full website tour; the words drawn in their
// media; the corner logo throughout; an end card composed for the frame, with both install lines.
import type { Ctx, Env, P } from "./core";
import { texture } from "./readable";
import type { Film } from "./film";
import {
  C, GEN, HOME, INPUT, MONO, REPLY, SANS, TEXT, blot, camLerp, caretAt, charTimes, clamp, drawChatFrame, expo, inkDrop, inOut, lerp, lerpP,
  out3, pathOf, plateLayer, pointer, press, ramp, rr, selfLayer, softShadow, typedAt, useCam, type Cam,
  frozenNone,
} from "./launchKit";
import { koiDraw } from "./koiDraw";
import { koi } from "./koi";
import { koiWorld } from "./koiWorld";
import { brickBalloon } from "./brickBalloon";
import { adaptAlmond } from "./adaptAlmond";
import { embroideryAlive } from "./embroideryAlive";
import { webTour } from "./webTour";
import { mechanicalLepidoptera } from "./mechanicalLepidoptera";
import { drawWall, wallCam, cardOf, PUNCH, PUNCH_IN, type Punch } from "./launchGallery";
import { caption, logo, logoBox, logoBug, logoCentred, sentence, writeOn, measure } from "./kinetic";
import { KOI_CODE } from "./launchCode";
import { launchLofi2 } from "./music/pieces/launch";
import { renderPiece } from "./music/render";
import { rng } from "./core";

const W = 1920, H = 1080, FPS = 30, BEAT = 20;
export const T2 = {
  open: [0, 80], ask: [80, 200], code: [200, 360], swim: [360, 560], wall: [560, 800], brick: [800, 1040],
  hand: [1040, 1200], loop: [1200, 1360], web: [1360, 1760], film: [1760, 1840], words: [1840, 2040], end: [2040, 2160],
} as const;
const N = T2.end[1];

// ---------------------------------------------------------------- small helpers
const screen = (ctx: Ctx, env: Env) => ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0);
const GEN_C: P = [GEN.x + GEN.w / 2, GEN.y + GEN.h / 2];
// a whip: the outgoing frame smeared along the move (drawn several times, fading), the incoming following it in
const smear = (ctx: Ctx, env: Env, L: CanvasImageSource, dx: number, dy: number, blur: number) => { screen(ctx, env); for (let k = 5; k >= 0; k--) { ctx.globalAlpha = k === 0 ? 1 : 0.16; ctx.drawImage(L, dx - blur * k * Math.sign(dx || 1) * (dx ? 1 : 0), dy - blur * k * Math.sign(dy || 1) * (dy ? 1 : 0), W, H); } ctx.globalAlpha = 1; };

// ---------------------------------------------------------------- the conversation
// One thread for the whole film. Every answer stays in it; the thread scrolls as it grows, eased.
type Art = { src: (env: Env, f: number) => CanvasImageSource; crop?: [number, number, number, number] };
type Item = { kind: "user"; at: number; text: string; attach?: string } | { kind: "card"; at: number; art: Art; label: string; s: number; land: { t0: number; land: number; full: number } };
const KOI_PROMPT = "a koi turning under lily pads, marker comic";
const ASK = { times: charTimes(KOI_PROMPT, 84, 1.0, 7), down: 160, up: 166 };
const DROP0 = { t0: 172, land: 188, full: 222 };
const KOI_SPEED = 3.6, KOI_DONE = DROP0.land + (koiDraw.meta.durationFrames - 30) / KOI_SPEED;
const SWIM_PROMPT = "now make it swim";
const SW = (() => { const times = charTimes(SWIM_PROMPT, 378, 0.55, 11), down = Math.ceil(times[times.length - 1] + 4), up = down + 5; return { times, down, up, drop: { t0: up + 5, land: up + 19, full: up + 40 } }; })();
const SWIM_START = SW.up + 6, SWIM_OUT = SWIM_START + 22, SWIM_FULL = SWIM_OUT + 34; // the koi in the thread starts to swim in its card, then the card opens to the full frame
const swimArt: Art = { src: (env, f) => plateLayer(env, "world1920", koiWorld, Math.max(0, f - SWIM_START), 1920).canvas, crop: [420, 0, 1080, 1080] };
// the koi's card: it draws itself, holds, and when asked to swim, swims right there in the thread (the pond world framed exactly like the plate)
const koiArt: Art = { src: (env, f) => {
  if (f < KOI_DONE) return plateLayer(env, "koiDraw", koiDraw, (f - DROP0.land) * KOI_SPEED, 1080).canvas;
  if (f < SWIM_START) return plateLayer(env, "koi", koi, 0, 1080).canvas;
  const Lw = plateLayer(env, "world1920", koiWorld, f - SWIM_START, 1920).canvas, sq = selfLayer(env, "koiswim", 1080, 1080); sq.ctx.drawImage(Lw, 420, 0, 1080, 1080, 0, 0, 1080, 1080); return sq.canvas;
} };
const HAND_PROMPT = "my koi, painted in this hand";
const HD = (() => { const times = charTimes(HAND_PROMPT, 1068, 0.5, 17), down = Math.ceil(times[times.length - 1] + 4), up = down + 5; return { times, down, up, drop: { t0: up + 5, land: up + 19, full: up + 40 } }; })();
const ALMOND_SPEED = (adaptAlmond.meta.durationFrames - 40) / (T2.hand[1] - 8 - HD.drop.land);
const FLIP = T2.loop[0] + 2; // the Van Gogh card turns over and the embroidery is on its back
const almondArt: Art = { src: (env, f) => (f < FLIP + 6 ? plateLayer(env, "almond", adaptAlmond, 8 + Math.max(0, f - HD.drop.land) * ALMOND_SPEED, 1080) : plateLayer(env, "emb", embroideryAlive, (f - FLIP) % embroideryAlive.meta.durationFrames, 1080)).canvas };
const THREAD: Item[] = [
  { kind: "user", at: ASK.up, text: KOI_PROMPT },
  { kind: "card", at: DROP0.land, art: koiArt, label: "marker comic", s: 560, land: DROP0 },
  { kind: "user", at: SW.up, text: SWIM_PROMPT },
  { kind: "user", at: HD.up, text: HAND_PROMPT, attach: "almond" },
  { kind: "card", at: HD.drop.land, art: almondArt, label: "adapted · the almond-blossom hand", s: 460, land: HD.drop },
];
const TOP = 170, VIEW_BOTTOM = INPUT.y - 26, BUBBLE = 58, ATTACH = 150;
const layout = () => { let y = TOP; return THREAD.map((it) => { const h = it.kind === "user" ? BUBBLE + (it.attach ? ATTACH + 10 : 0) : it.s + 34; const r = { it, y, h }; y += h + 26; return r; }); };
const LAYOUT = layout();
// the scroll: each new item eases the thread up so the newest thing sits just above the composer
const scrollAt = (f: number) => { let s = 0; LAYOUT.forEach((L) => { const want = Math.max(0, L.y + L.h - VIEW_BOTTOM); const prev = s; if (want > prev) s += (want - prev) * expo(ramp(f, L.it.at - 2, L.it.at + 16)); }); return s; };
export const cardRect = (i: number, f: number) => { const L = LAYOUT[i], it = L.it as Extract<Item, { kind: "card" }>; return { x: REPLY.x, y: L.y + 34 - scrollAt(f), s: it.s }; };

const drawUser = (ctx: Ctx, env: Env, it: Extract<Item, { kind: "user" }>, y: number, a: number) => {
  ctx.globalAlpha = a; ctx.font = SANS(500, 26);
  const tw = ctx.measureText(it.text).width, bw = tw + 52, bx = 1560 - bw; let yy = y;
  const img = it.attach ? env.image?.(it.attach) : undefined;
  if (img) { ctx.save(); rr(ctx, 1560 - 240, yy, 240, ATTACH, 16); ctx.clip(); ctx.drawImage(img, 1560 - 240, yy, 240, ATTACH); ctx.restore(); yy += ATTACH + 10; }
  ctx.fillStyle = C.chip; rr(ctx, bx, yy, bw, BUBBLE - 2, 22); ctx.fill(); ctx.fillStyle = C.ink; ctx.textBaseline = "middle"; ctx.fillText(it.text, bx + 26, yy + 29); ctx.globalAlpha = 1;
};
const drawCard = (ctx: Ctx, env: Env, it: Extract<Item, { kind: "card" }>, x: number, y: number, f: number, flip = 1) => {
  ctx.fillStyle = C.ink; ctx.globalAlpha = ramp(f, it.land.land, it.land.land + 10); ctx.beginPath(); ctx.arc(x + 9, y - 16, 7, 0, Math.PI * 2); ctx.fill();
  ctx.font = SANS(600, 20); ctx.textBaseline = "middle"; ctx.fillText(f >= FLIP + 6 && it.art === almondArt ? "loop · embroidery, seamless" : it.label, x + 26, y - 15); ctx.globalAlpha = 1;
  const s = it.s, grow = out3(ramp(f, it.land.land, it.land.full)), c: P = [x + s / 2, y + s / 2], L = it.art.src(env, f);
  ctx.save(); ctx.translate(c[0], c[1]); ctx.scale(flip, 1); ctx.translate(-c[0], -c[1]);
  softShadow(ctx, x, y, s, s, 20, grow * 1.3);
  ctx.save(); rr(ctx, x, y, s, s, 20); ctx.clip();
  if (grow < 1) { pathOf(ctx, blot(c, lerp(16, s * 0.8, grow) + 28 * (1 - grow), 77)); ctx.fillStyle = C.ink; ctx.fill(); pathOf(ctx, blot(c, Math.max(0, lerp(16, s * 0.8, grow) - 5), 77)); ctx.clip(); }
  ctx.fillStyle = C.paper; ctx.fillRect(x, y, s, s);
  if (it.art.crop) ctx.drawImage(L, ...it.art.crop, x, y, s, s); else ctx.drawImage(L, x, y, s, s);
  ctx.restore(); ctx.restore();
};
// the drop in flight from Generate to where the new card will land
const drawDrop = (ctx: Ctx, f: number, d: { t0: number; land: number }, to: P) => inkDrop(ctx, f, d, to);
type ChatO = { typed: string; caret: boolean; press: number; hot: number; flip?: number; hideCard?: number; composer?: number };
const drawChat = (ctx: Ctx, env: Env, f: number, o: ChatO) => {
  drawChatFrame(ctx, { typed: o.typed, caret: o.caret, placeholder: "Describe what you want drawn…", genPress: o.press, genHot: o.hot, composer: o.composer });
  const sc = scrollAt(f);
  ctx.save(); ctx.beginPath(); ctx.rect(300, 158, 1320, VIEW_BOTTOM - 158); ctx.clip();
  LAYOUT.forEach((L, i) => {
    if (f < L.it.at) return;
    const y = L.y - sc; if (y > VIEW_BOTTOM || y + L.h < 100) return;
    if (L.it.kind === "user") drawUser(ctx, env, L.it, y, ramp(f, L.it.at, L.it.at + 8));
    else if (o.hideCard !== i) drawCard(ctx, env, L.it, REPLY.x, y + 34, f, i === 4 ? (o.flip ?? 1) : 1);
  });
  ctx.restore();
  // drops in flight land on the card's place in the thread
  LAYOUT.forEach((L, i) => { if (L.it.kind !== "card") return; const r = cardRect(i, f); drawDrop(ctx, f, L.it.land, [r.x + r.s / 2, r.y + r.s / 2]); });
};

// ---------------------------------------------------------------- the corner logo
const BUG: P = [1700, 1040];
const bug = (ctx: Ctx, env: Env, f: number) => logoBug(ctx, env, f, BUG[0], BUG[1], 0.9, { t0: 70, fps: FPS });

// ---------------------------------------------------------------- 0: the logo writes itself
const sceneOpen = (ctx: Ctx, env: Env, f: number) => {
  const u = expo(ramp(f, 58, 80));
  useCam(ctx, env, HOME);
  drawChatFrame(ctx, { typed: "", caret: false, placeholder: "Describe what you want drawn…" });
  screen(ctx, env); ctx.globalAlpha = 1 - u; ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
  // the wordmark, big, then it shrinks away toward its corner as the chat comes up under it
  const em = lerp(150, 26, u), cx = lerp(W / 2, BUG[0], u), cy = lerp(H / 2 - 10, BUG[1] - 20, u);
  ctx.globalAlpha = 1 - ramp(f, 72, 80); logoCentred(ctx, env, cx, cy, em, ramp(f, 2, 50), { pen: f < 56 }); ctx.globalAlpha = 1;
  if (f < 58) caption(ctx, env, "hand-drawn art, written as code", W / 2, H / 2 + 210, 28, ramp(f, 30, 52), "plain", { align: "center" });
};

// ---------------------------------------------------------------- 1: the ask
const askCam = (ctx: Ctx, f: number): Cam => {
  // the macro follows the caret, but never so far that the start of the line leaves the frame
  const typed = typedAt(KOI_PROMPT, f, ASK.times), [cx] = caretAt(ctx, typed), z = 2.4, keepStart = TEXT.x + (W / 2 - 60) / z;
  const macro: Cam = { c: [Math.min(keepStart, Math.max(TEXT.x + 330, cx - 110)), 934], z };
  return f < 136 ? macro : camLerp(macro, HOME, expo(ramp(f, 136, 158)));
};
// the code composition: the koi card at left of centre, its code streaming on the right
const CODE_CAM = (): Cam => { const r = cardRect(1, 230), z = 1.25; return { c: [r.x + r.s / 2 + (W / 2 - 520) / z, r.y + r.s / 2 - (620 - H / 2) / z], z }; }; // the card lands at (520, 620), the words above it, the code at right
const sceneAsk = (ctx: Ctx, env: Env, f: number) => {
  const push = f < T2.ask[1] && f >= 160 ? expo(ramp(f, 186, 226)) : 0, cam = f < T2.ask[1] ? (f < 160 ? askCam(ctx, f) : camLerp(HOME, CODE_CAM(), push)) : HOME;
  useCam(ctx, env, cam);
  const typed = typedAt(KOI_PROMPT, f, ASK.times);
  // the code composition crops the composer at the frame's edge: it fades out as the camera pushes in (a focus pull)
  drawChat(ctx, env, f, { typed: f < ASK.up ? typed : "", caret: f < ASK.up, press: press(f, ASK.down, ASK.up), hot: ramp(f, 150, 158), composer: 1 - push });
  if (f >= 136) pointer(ctx, lerpP([1760, 1130], [GEN_C[0] + 18, GEN_C[1] + 6], out3(ramp(f, 138, 158))), press(f, ASK.down, ASK.up) * 0.8);
  bug(ctx, env, f);
};

// ---------------------------------------------------------------- 2: it's code
const sceneCode = (ctx: Ctx, env: Env, f: number) => {
  const back = expo(ramp(f, 328, 359));
  useCam(ctx, env, camLerp(CODE_CAM(), HOME, back));
  drawChat(ctx, env, f, { typed: "", caret: false, press: 0, hot: 0, composer: back }); // the composer returns with the camera
  // the editor slides in from the right, the lines stream in time with the drawing
  screen(ctx, env);
  const inU = expo(ramp(f, 200, 222)) * (1 - back), ex = lerp(W + 40, 1010, inU), ey = 110, ew = 830, eh = 860;
  if (inU > 0.001) {
    softShadow(ctx, ex, ey, ew, eh, 22, 1.6); ctx.fillStyle = "#1f1c18"; rr(ctx, ex, ey, ew, eh, 22); ctx.fill();
    ctx.fillStyle = "#8f8676"; ctx.font = MONO(16); ctx.textBaseline = "middle"; texture(ctx, () => ctx.fillText("koi.ts  ·  drawFish()  ·  running", ex + 26, ey + 30)); // the editor's title bar, part of the code texture
    const prog = clamp((f - DROP0.land) / (KOI_DONE - DROP0.land)), shown = Math.floor(prog * KOI_CODE.length), first = Math.max(0, shown - 24);
    ctx.save(); ctx.beginPath(); ctx.rect(ex, ey + 56, ew, eh - 70); ctx.clip();
    // the code streams in time with the drawing: it shows THAT the koi is code, it is not there to be read
    // line by line, so its lines are texture to the reading-time rule (readable.ts texture())
    texture(ctx, () => { for (let i = first; i < Math.min(KOI_CODE.length, shown + 1); i++) {
      const y = ey + 80 + (i - first) * 32, ln = KOI_CODE[i], partial = i === shown ? ln.slice(0, Math.floor(((prog * KOI_CODE.length) % 1) * ln.length)) : ln;
      ctx.fillStyle = "#5d564b"; ctx.font = MONO(13); ctx.fillText(String(i + 1).padStart(3, " "), ex + 16, y);
      ctx.font = MONO(15); ctx.fillStyle = partial.trim().startsWith("//") ? "#8faa7c" : "#ece4d6"; ctx.fillText(partial, ex + 56, y);
    } });
    ctx.restore();
  }
  // the point, drawn: no image model
  bug(ctx, env, f);
};

// ---------------------------------------------------------------- 3: now make it swim
const sceneSwim = (ctx: Ctx, env: Env, f: number) => {
  if (f < SWIM_OUT) {
    useCam(ctx, env, HOME);
    const typed = typedAt(SWIM_PROMPT, f, SW.times);
    drawChat(ctx, env, f, { typed: f < SW.up ? typed : "", caret: f < SW.up && f >= 372, press: press(f, SW.down, SW.up), hot: ramp(f, SW.down - 6, SW.down) });
    pointer(ctx, lerpP([GEN_C[0] + 200, GEN_C[1] + 150], [GEN_C[0] + 18, GEN_C[1] + 6], out3(ramp(f, SW.down - 12, SW.down))), press(f, SW.down, SW.up) * 0.8);
    bug(ctx, env, f); return;
  }
  // the break-out: the card opens to the whole frame and the koi swims off
  const u = inOut(ramp(f, SWIM_OUT, SWIM_FULL)), r = cardRect(1, SWIM_OUT), L = swimArt.src(env, f);
  useCam(ctx, env, HOME);
  if (u < 1) { ctx.globalAlpha = 1 - u * 0.8; drawChat(ctx, env, f, { typed: "", caret: false, press: 0, hot: 0, hideCard: 1 }); ctx.globalAlpha = 1; }
  const x = lerp(r.x, 0, u), y = lerp(r.y, 0, u), w = lerp(r.s, W, u), h = lerp(r.s, H, u), sx = lerp(420, 0, u), sw = lerp(1080, 1920, u);
  screen(ctx, env); ctx.save(); rr(ctx, x, y, w, h, 20 * (1 - u)); ctx.clip(); ctx.drawImage(L, sx, 0, sw, 1080, x, y, w, h); ctx.restore();
  bug(ctx, env, f);
};

// ---------------------------------------------------------------- 4: the wall of 31 styles
// the punches are chosen by style, found on the wall where their row has carried them
const PUNCH_STYLES = ["scratchboard", "pixelArt", "toyBrick", "balloon"], PUNCH_TIMES = [0.4, 2.53, 4.67, 6.3];
const WALL_T0 = T2.wall[0] + 10, PUNCH_T0 = 0.9, PUNCH_GAP = PUNCH / FPS; // seconds into the wall
const PUNCHES: Punch[] = (() => {
  const out: Punch[] = [];
  PUNCH_STYLES.forEach((id, j) => {
    const t = PUNCH_TIMES[j], camx = lerp(-240, 240, clamp(t / 8));
    let best: Punch | null = null, bd = 1e9;
    for (let row = 0; row < 4; row++) for (let k = -12; k < 20; k++) { if (cardOf(row, k).id !== id) continue; const speed = [52, -64, 58, -48][row], x = k * 364 + speed * (t + 12 / FPS) + (row % 2) * 182, d = Math.abs(x - camx) + Math.abs(row - 1.5) * 80; if (d < bd) { bd = d; best = { row, k, t0: t }; } }
    if (best) out.push(best);
  });
  return out;
})();
const wallT = (f: number) => (f - WALL_T0) / FPS;
const drawWallAt = (ctx: Ctx, env: Env, f: number) => { const t = wallT(f), w = wallCam(t, PUNCHES, FPS, W, H, true); drawWall(ctx, env, t, w.cam, w.focus); return w; };
const sceneWall = (ctx: Ctx, env: Env, f: number) => {
  if (f < WALL_T0) { // a whip pan off the swim onto the wall
    const u = inOut(ramp(f, T2.wall[0], WALL_T0)), Ls = swimArt.src(env, f);
    screen(ctx, env); ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    smear(ctx, env, Ls, -W * u, 0, 40 * Math.sin(Math.PI * u));
    const Lw = selfLayer(env, "wallwhip", Math.round(W * env.scale), Math.round(H * env.scale)); drawWallAt(Lw.ctx, env, WALL_T0);
    screen(ctx, env); ctx.drawImage(Lw.canvas, W * (1 - u), 0, W, H); bug(ctx, env, f); return;
  }
  const w = drawWallAt(ctx, env, f), t = wallT(f);
  void w; void t;
  bug(ctx, env, f);
};

// ---------------------------------------------------------------- 5: crayon to bricks, and it flies
const BRICK_SPEED = (brickBalloon.meta.durationFrames - 1) / (T2.brick[1] - 6 - T2.brick[0]);
const brickFrame = (f: number) => Math.max(0, (f - T2.brick[0]) * BRICK_SPEED);
const sceneBrick = (ctx: Ctx, env: Env, f: number) => {
  screen(ctx, env); ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  // the balloon card fills the frame's height; as it takes flight it opens to the full width
  const open = expo(ramp(f, T2.brick[0] + 120, T2.brick[0] + 160)), size = lerp(H, W, open), x = (W - size) / 2, y = (H - size) / 2;
  const L = plateLayer(env, "brick", brickBalloon, brickFrame(f), 1080).canvas;
  softShadow(ctx, x, y, size, size, 14 * (1 - open), 1.3); ctx.save(); rr(ctx, x, y, size, size, 14 * (1 - open)); ctx.clip(); ctx.drawImage(L, x, y, size, size); ctx.restore();
  bug(ctx, env, f);
};

// ---------------------------------------------------------------- 6: a painter's hand, then 7: the card flips to a loop
const sceneHand = (ctx: Ctx, env: Env, f: number) => {
  // the flight shrinks away as the chat comes back, scrolled to its newest message
  const back = expo(ramp(f, T2.hand[0], T2.hand[0] + 24));
  useCam(ctx, env, HOME);
  const typed = typedAt(HAND_PROMPT, f, HD.times), chip = out3(ramp(f, 1058, 1066));
  drawChat(ctx, env, f, { typed: f < HD.up ? typed : "", caret: f < HD.up && f >= 1066, press: press(f, HD.down, HD.up), hot: ramp(f, HD.down - 6, HD.down) });
  const img = env.image?.("almond");
  if (img && f < HD.up && chip > 0) { ctx.globalAlpha = chip; ctx.save(); rr(ctx, INPUT.x + INPUT.w - 420, INPUT.y + 16, 104, 72, 12); ctx.clip(); ctx.drawImage(img, INPUT.x + INPUT.w - 420, INPUT.y + 16, 104, 72); ctx.restore(); ctx.globalAlpha = 1; }
  if (f >= HD.down - 14) pointer(ctx, lerpP([GEN_C[0] + 200, GEN_C[1] + 150], [GEN_C[0] + 18, GEN_C[1] + 6], out3(ramp(f, HD.down - 14, HD.down))), press(f, HD.down, HD.up) * 0.8);
  if (back < 1) { screen(ctx, env); const s = lerp(1, 0.2, back), L = plateLayer(env, "brick", brickBalloon, brickFrame(T2.brick[1] - 1), 1080).canvas; ctx.globalAlpha = 1 - back; ctx.drawImage(L, 0, (1080 - 1920) / 2, 1920, 1920); ctx.globalAlpha = 1; void s; }
  bug(ctx, env, f);
};
const sceneLoop = (ctx: Ctx, env: Env, f: number) => {
  const flip = Math.cos(Math.PI * inOut(ramp(f, FLIP - 8, FLIP + 8))), r = cardRect(4, f), push = inOut(ramp(f, FLIP + 12, FLIP + 52));
  // the push frames the card and its byline above it, so the byline is never cut by the frame's top edge
  const top = r.y - 40, z = (H - 60) / (r.y + r.s - top);
  useCam(ctx, env, camLerp(HOME, { c: [r.x + r.s / 2, (top + r.y + r.s) / 2], z }, push));
  drawChat(ctx, env, f, { typed: "", caret: false, press: 0, hot: 0, flip: Math.abs(flip) < 0.02 ? 0.02 : Math.abs(flip) });
  bug(ctx, env, f);
};

// ---------------------------------------------------------------- 8: the website
export const WEB_SKIP = 118; // the webTour frame where Bit's hero is in view: the scroll-drawn hero is cut, nobody could tell what it was
const WEB0 = T2.web[0] + 10, webFrame = (f: number) => Math.max(0, Math.min(webTour.meta.durationFrames - 1, f - WEB0 + WEB_SKIP));
const sceneWeb = (ctx: Ctx, env: Env, f: number) => {
  const L = plateLayer(env, "web", webTour, webFrame(f), 1920).canvas;
  if (f < WEB0) { // a whip up off the embroidery onto the site
    const u = inOut(ramp(f, T2.web[0], WEB0)), r = cardRect(4, f), Le = plateLayer(env, "emb", embroideryAlive, (f - FLIP) % embroideryAlive.meta.durationFrames, 1080).canvas;
    screen(ctx, env); ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(0, -H * u); ctx.drawImage(Le, (W - H) / 2, 0, H, H); ctx.restore(); void r;
    ctx.drawImage(L, 0, H * (1 - u), W, H); bug(ctx, env, f); return;
  }
  screen(ctx, env); ctx.drawImage(L, 0, 0, W, H);
  bug(ctx, env, f);
};

// ---------------------------------------------------------------- 9: a film
// the film's own arc as a trailer: its blueprint drawn, the butterfly coming alive in colour, flying off through the flowers
export const lepAt = (u: number) => (u < 0.36 ? lerp(60, 520, u / 0.36) : u < 0.62 ? lerp(560, 820, (u - 0.36) / 0.26) : lerp(900, 1420, (u - 0.62) / 0.38));
const sceneFilm = (ctx: Ctx, env: Env, f: number) => {
  const L = plateLayer(env, "lep", mechanicalLepidoptera, lepAt(clamp((f - T2.film[0]) / (T2.film[1] - T2.film[0]))), 1080).canvas, u = expo(ramp(f, T2.film[0], T2.film[0] + 16));
  screen(ctx, env); ctx.fillStyle = "#101010"; ctx.fillRect(0, 0, W, H);
  const s = lerp(0.6, 1, u) * W; ctx.drawImage(L, (W - s) / 2, (H - s) / 2, s, s);
  bug(ctx, env, f);
};

// ---------------------------------------------------------------- 10: the sentence, and 11: the end
const WORDS = ["Images", "Illustrations", "Loops", "Animations", "Films"]; // the kit adds the commas and the full stop
const sceneWords = (ctx: Ctx, env: Env, f: number) => {
  screen(ctx, env); ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  if (f < T2.words[0] + 30) { const u = expo(ramp(f, T2.words[0], T2.words[0] + 30)), L = plateLayer(env, "lep", mechanicalLepidoptera, lepAt(1), 1080).canvas; ctx.globalAlpha = 1 - u; const s = W * (1 - 0.3 * u); ctx.drawImage(L, (W - s) / 2, (H - s) / 2, s, s); ctx.globalAlpha = 1; }
  sentence(ctx, env, WORDS, f, T2.words[0] + 30, { beat: BEAT, styles: ["marker", "ink", "thread", "crayon", "marker"], colors: ["#2f6fd6", C.ink, "#2e7d6e", "#d8452f", "#7a3fb0"], size: 70, top: 230 });
  bug(ctx, env, f);
};
const sceneEnd = (ctx: Ctx, env: Env, f: number) => {
  screen(ctx, env); ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  const em = 120, b = logoBox(env, em), cx = W / 2, cy = 360;
  logoCentred(ctx, env, cx, cy, em, ramp(f, T2.end[0], T2.end[0] + 36), { pen: f < T2.end[0] + 40 }); void b; void logo;
  const a = ramp(f, T2.end[0] + 30, T2.end[0] + 44);
  ctx.globalAlpha = a; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillStyle = C.soft; ctx.font = SANS(500, 28); ctx.fillText("Images · Illustrations · Loops · Animations · Films, all in pure code", cx, 560);
  ctx.fillStyle = "#1f1c18"; rr(ctx, cx - 520, 640, 1040, 170, 22); ctx.fill();
  ctx.fillStyle = "#ece4d6"; ctx.font = MONO(30); ctx.fillText("/plugin marketplace add alexgreensh/anidoodle", cx, 695); ctx.fillText("/plugin install anidoodle@alexgreensh-anidoodle", cx, 755);
  ctx.fillStyle = C.soft; ctx.font = SANS(500, 24); ctx.fillText("Claude Code and Codex  ·  github.com/alexgreensh/anidoodle", cx, 880);
  ctx.textAlign = "left"; ctx.globalAlpha = 1;
};

// ---------------------------------------------------------------- the sound
const audio2 = (sr: number): [Float32Array, Float32Array] => {
  const n = Math.round((N / FPS) * sr), L = new Float32Array(n), R = new Float32Array(n), m = renderPiece(launchLofi2(), sr);
  for (let i = 0; i < n && i < m.L.length; i++) { L[i] = m.L[i]; R[i] = m.R[i]; }
  const fade = Math.round(1.2 * sr); for (let i = 0; i < fade; i++) { const g = i / fade; L[n - 1 - i] *= g; R[n - 1 - i] *= g; }
  const r = rng(4242), add = (t: number, len: number, fn: (s: number) => number, gain: number, pan = 0) => { const i0 = Math.round(t * sr); for (let i = 0; i < len * sr && i0 + i < n; i++) { if (i0 + i < 0) continue; const v = fn(i / sr) * gain; L[i0 + i] += v * (1 - Math.max(0, pan)); R[i0 + i] += v * (1 + Math.min(0, pan)); } };
  const click = (fr: number) => { const f0 = 2600 + r() * 1400, ph = r() * 6; add(fr / FPS, 0.03, (s) => Math.sin(2 * Math.PI * f0 * s + ph) * Math.exp(-s / 0.004) + (r() - 0.5) * Math.exp(-s / 0.002) * 0.6, 0.05, (r() - 0.5) * 0.4); };
  const thock = (fr: number) => add(fr / FPS, 0.14, (s) => Math.sin(2 * Math.PI * (70 + 90 * Math.exp(-s / 0.02)) * s) * Math.exp(-s / 0.05), 0.2);
  const plip = (fr: number) => add(fr / FPS, 0.16, (s) => Math.sin(2 * Math.PI * (320 + 700 * Math.exp(-s / 0.03)) * s) * Math.exp(-s / 0.06), 0.12);
  const whoosh = (fr: number, len = 0.5, g = 0.5) => { let z = 0; add(fr / FPS, len, (s) => { z += 0.14 * ((r() - 0.5) - z); return z * Math.sin((Math.PI * s) / len) ** 2; }, g); };
  const scratch = (fr: number, len: number) => { let z = 0; add(fr / FPS, len, (s) => { z += 0.5 * ((r() - 0.5) - z); return z * (0.6 + 0.4 * Math.sin(s * 70)) * Math.min(1, s * 20) * Math.min(1, (len - s) * 20); }, 0.05); };
  ASK.times.forEach(click); thock(ASK.down); plip(DROP0.land); scratch(2, 1.6);
  SW.times.forEach(click); thock(SW.down); plip(SW.drop.land); whoosh(SWIM_OUT, 0.8);
  HD.times.forEach(click); thock(HD.down); plip(HD.drop.land);
  whoosh(T2.wall[0], 0.45); PUNCHES.forEach((p) => whoosh(WALL_T0 + p.t0 * FPS, 0.35, 0.4)); whoosh(T2.brick[0] + 120, 0.9);
  whoosh(T2.hand[0], 0.5); whoosh(FLIP - 6, 0.35, 0.4); whoosh(T2.web[0], 0.45); whoosh(T2.film[0], 0.5); whoosh(T2.words[0], 0.6);
  return [L, R];
};

// ---------------------------------------------------------------- the film
const shot = (id: keyof typeof T2, draw: (ctx: Ctx, env: Env, f: number) => void) => ({ id, start: T2[id][0], end: T2[id][1], draw: (ctx: Ctx, local: number, env: Env) => draw(ctx, env, T2[id][0] + local) });
export const launch2: Film = {
  meta: { title: "anidoodle · launch, cut 2", W, H, fps: FPS, bpm: 90, durationFrames: N, raster: "cpu", kind: "launch", checks: { none: frozenNone(["gate:identical", "gate:still"]) } },
  assets: { images: { almond: "assets/refs/vangogh-almond-blossom.jpg" } }, // public domain; provenance in engine/assets/refs/PROVENANCE.json
  shots: [
    shot("open", sceneOpen), shot("ask", sceneAsk), shot("code", sceneCode), shot("swim", sceneSwim), shot("wall", sceneWall), shot("brick", sceneBrick),
    shot("hand", sceneHand), shot("loop", sceneLoop), shot("web", sceneWeb), shot("film", sceneFilm), shot("words", sceneWords), shot("end", sceneEnd),
  ],
  audio: Object.assign(audio2, { scores: [launchLofi2()] }),
};
export const KEYS2 = () => ({ SW, HD, KOI_DONE, SWIM_OUT, PUNCHES, LAYOUT: LAYOUT.map((l) => [l.it.kind, l.y, l.h]) });

// the picture alone, at content frame f (launch3.ts cuts it together with the type frames)
export const content2 = (ctx: Ctx, env: Env, f: number) => { const g = Math.max(0, Math.min(N - 1, Math.round(f))), sh = launch2.shots.find((x) => g >= x.start && g < x.end)!; sh.draw(ctx, g - sh.start, env); };
// the interface's sound events in content frames (launch3.ts maps them onto the cut)
export const SFX2 = () => ({ clicks: [...ASK.times, ...SW.times, ...HD.times], thocks: [ASK.down, SW.down, HD.down], plips: [DROP0.land, HD.drop.land], punches: PUNCHES.map((p) => WALL_T0 + p.t0 * FPS), flip: FLIP - 6 });
