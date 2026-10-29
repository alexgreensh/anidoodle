// TEST FIXTURES for tools/framecheck.mjs and tools/ship.mjs, not films. Two cuts of one 10 s launch beat
// (a typed AI reply, then the end card), rebuilt from a brand launch film's real faults and their fixes.
//   fixtureShipRed    the reply held 0.9 s after its last character (the film's number; it needs 3.3 s),
//                     "blah" texture drawn as readable text, the v3 end card (eight items packed into a
//                     corner), the card landing twice around a stinger, a 14 px CTA in the last second.
//                     framecheck must FAIL it on every one of those.
//   fixtureShipGreen  the same beat built with the kit: chatHoldFrames for the reply, texture() for the
//                     blah, drawEndCard for one asymmetric card that lands once. framecheck must PASS it.
// A small mark drifts the whole time, so the gate's dead-air rule has motion to see on both.
import { probeRect, type Ctx, type Env } from "./core";
import type { Film } from "./film";
import { chatHoldFrames, texture } from "./readable";
import { drawEndCard, type EndCardSpec } from "./endCard";

const W = 1920, H = 1080, FPS = 30, N = 300;
const REPLY = "I can handle the non-human part. Ingrid has the human one.";
const BG = "#111214", INK = "#f4f1ea", ACC = "#FFDE59";
const SANS = (w: number, px: number) => `${w} ${px}px "Helvetica Neue", Helvetica, Arial, sans-serif`;

const ground = (ctx: Ctx, env: Env, f: number) => {
  ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
  const a = (f / FPS) * 0.9; ctx.fillStyle = ACC; ctx.beginPath(); ctx.arc(W - 120 + Math.cos(a) * 40, 120 + Math.sin(a) * 40, 14, 0, Math.PI * 2); ctx.fill(); // the drifting mark
};
/** The reply typed from frame t0 at 52 chars/s; returns nothing, draws the typed part. */
const typed = (ctx: Ctx, env: Env, f: number, t0: number, card: boolean) => {
  const n = Math.max(0, Math.min(REPLY.length, Math.floor(((f - t0) / FPS) * 52)));
  if (card) { ctx.fillStyle = "#24262b"; ctx.beginPath(); ctx.roundRect(160, 380, 1600, 220, 28); ctx.fill(); probeRect(ctx, env, 160, 380, 1600, 220, "reply card"); }
  if (n) { ctx.fillStyle = INK; ctx.font = SANS(600, 44); ctx.textBaseline = "alphabetic"; ctx.fillText(REPLY.slice(0, n), 220, 506); }
};
const blah = (ctx: Ctx, as: "read" | "texture") => {
  const draw = () => { ctx.fillStyle = "#8a8d93"; ctx.font = SANS(500, 34); for (let i = 0; i < 3; i++) ctx.fillText("blah blah blah blah blah blah", 360, 160 + i * 52); };
  if (as === "texture") texture(ctx, draw); else draw();
};

// ---- RED: the faults, as the film shipped them
const redDraw = (ctx: Ctx, f: number, env: Env) => {
  ground(ctx, env, f);
  if (f < 10) blah(ctx, "read"); // a cold open of greeked text drawn as real words, up a third of a second
  const typedEnd = 18 + Math.ceil((REPLY.length / 52) * FPS), hold = Math.round(0.9 * FPS);
  if (f >= 18 && f < typedEnd + hold) typed(ctx, env, f, 18, true);
  const card = (f >= typedEnd + hold && f < 200) || f >= 240;
  if (card) {
    probeRect(ctx, env, 40, 40, W - 80, H - 80, "end card");
    ctx.fillStyle = INK; ctx.textBaseline = "top";
    ["Kestrel Live", "May 03, 2027", "Santiago", "The Old Mill", "Reserve a Spot!", "www.example.com", "Sponsors", "Nordic  Wren"].forEach((s, i) => { ctx.font = SANS(i === 0 ? 800 : 600, i === 0 ? 40 : 26); ctx.fillText(s, 80 + (i % 2) * 300, 80 + Math.floor(i / 2) * 64); });
  }
  if (f >= 200 && f < 240) { ctx.fillStyle = INK; ctx.font = SANS(700, 64); ctx.textBaseline = "alphabetic"; ctx.fillText("You're absolutely right.", 520, 560); } // the stinger, between two landings
  if (f >= 270) { ctx.fillStyle = ACC; ctx.font = SANS(800, 14); ctx.textBaseline = "top"; ctx.fillText("Reserve a Spot!", 1500, 980); } // shrunk under the stinger
};

// ---- GREEN: the same beat on the kit
const hold = chatHoldFrames(REPLY, FPS, { cps: 52, think: 0.6 }), T0 = hold.think, CARD = T0 + hold.typing + hold.read;
const SPEC: EndCardSpec = {
  lockup: { aspect: 3, draw: (ctx, b) => { ctx.fillStyle = ACC; ctx.beginPath(); ctx.ellipse(b.x + b.h / 2, b.y + b.h / 2, b.h / 2, b.h / 2, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = INK; ctx.fillRect(b.x + b.h * 1.2, b.y + b.h * 0.3, b.w - b.h * 1.2, b.h * 0.4); } },
  date: "May 03, 2027", venue: "Santiago The Old Mill", cta: "Reserve a Spot!",
  colors: { ink: INK, accent: ACC, ctaInk: BG },
  sponsors: { list: ["northwind", "kestrel", "brightstar", "headland"].map((name, i) => ({ name, aspect: 2.4 + (i % 2) * 0.6, draw: (ctx: Ctx, b: { x: number; y: number; w: number; h: number }) => { ctx.fillStyle = "#5c5f66"; ctx.beginPath(); ctx.roundRect(b.x, b.y, b.w, b.h, b.h * 0.2); ctx.fill(); } })) },
};
const greenDraw = (ctx: Ctx, f: number, env: Env) => {
  ground(ctx, env, f);
  if (f < 10) blah(ctx, "texture"); // the same greek, marked as texture: not meant to be read
  if (f >= T0 && f < CARD) typed(ctx, env, f, T0, true);
  if (f >= CARD) { ctx.textBaseline = "top"; drawEndCard(ctx, env, SPEC, Math.min(1, (f - CARD) / 24)); }
};

const film = (title: string, draw: (ctx: Ctx, f: number, env: Env) => void, extra: Partial<Film["meta"]> = {}): Film => ({
  meta: { title, W, H, fps: FPS, bpm: 60, durationFrames: N, kind: "launch", ...extra },
  assets: { images: {} },
  shots: [{ id: "beat", start: 0, end: N, draw: (ctx, local, env) => draw(ctx, local, env) }],
});
export const fixtureShipRed: Film = film("fixtureShipRed", redDraw);
// the reads are declared holds (the gate's dead-air rule then knows the stillness is meant)
// Every check ship runs must be able to look at it: a calm temperament and the brand's colours for the motion
// scans; the review ledger and the claims, which a test fixture has none of, are declared with a reason.
export const GREEN_NONE = { review: "a test fixture: no critic and no person is ever shown it", facts: "a test fixture: its lines are a made-up chat, not claims about a product" };
export const fixtureShipGreen: Film = film("fixtureShipGreen", greenDraw, { checks: { length: { target: 10, max: 12 }, none: GREEN_NONE }, motion: { temperament: "calm", brandColors: [ACC] }, holds: [[T0, CARD, "the reply types (a few letters a frame) and is read"], [CARD + 16, N, "the end card settles and is read"]] });
// fixtureShipTrack  the green beat whose music is an external track (meta.checks.music.track): ship must run
//                   track.mjs check, soundcheck --sfx and cues --check on it, and verify-export must tie the
//                   delivered mix to the pinned take. tools/ship-e2e.mjs writes the take and its manifest.
export const SHIP_E2E_TRACK = ".tmp/ship-e2e/take.wav.track.json";
export const fixtureShipTrack: Film = { ...fixtureShipGreen, meta: { ...fixtureShipGreen.meta, title: "fixtureShipTrack", checks: { ...fixtureShipGreen.meta.checks, music: { track: SHIP_E2E_TRACK } } } };
// fixtureShipLocked the green beat with an approved shot whose sha is wrong: ship's locks row must FAIL.
export const fixtureShipLocked: Film = { ...fixtureShipGreen, meta: { ...fixtureShipGreen.meta, title: "fixtureShipLocked", motion: { approved: [["beat", "0".repeat(32), "fixture: a sha no render produces"]] } } };
// fixtureShipBlind  the green beat with nothing for four checks to look at (no temperament, no brand colours, no
//                   ledger or claims declared, no length budget): ship must FAIL each of those rows, never pass.
export const fixtureShipBlind: Film = { ...fixtureShipGreen, meta: { ...fixtureShipGreen.meta, title: "fixtureShipBlind", checks: {}, motion: undefined } };
