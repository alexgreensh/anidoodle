// LAUNCH KIT. The pieces of the launch film that are not artwork: timing curves, a camera, a
// chat surface, a pointer, an ink blot, and the one bridge that matters, `plateLayer`, which
// draws any existing film of this engine into an offscreen surface at any frame so the launch
// film can place it, zoom it and cut out of it. Every plate shown in the launch film is the real
// plate drawn live by its own code, never a recording of it.
import { fractal, type Ctx, type Env, type Layer, type P } from "./core";
import { renderFrame, type Film } from "./film";
import { drawEl, type BrandElement } from "./brandKit";

// ---------------------------------------------------------------- palette and type
// THE FROZEN LAUNCH FILMS. launch, launch2 and launch3 are the source of anidoodle's published launch film
// (README). They were made before the 0.10 checks and are kept as they were published: never re-cut to
// meet a later check, and never a template to copy (references/workflows/launch-video-kit.md). Each declares
// the ship rows that cannot look, and the dead-air gate rows it fails, in meta.checks.none with this reason.
export const FROZEN = "frozen source of the published launch film; made before the 0.10 checks";
/** meta.checks.none for a frozen launch film: the ship rows with nothing declared to judge against, plus the named gate rows. */
export const frozenNone = (gateRows: ("gate:identical" | "gate:still")[] = []): Record<string, string> =>
  Object.fromEntries([...["motion:temperament", "layers:translucent", "facts", "review", "length"].map((k) => [k, FROZEN]), ...gateRows.map((k) => [k, `${FROZEN}: its still beats are the pace it was published with, and declaring them as holds one by one would be a re-cut on paper`])]);

export const C = {
  bg: "#ece6da", card: "#fffdf8", ink: "#1d1a16", soft: "#6f675c", mute: "#a39a8c", line: "#e0d8c8",
  chip: "#f3ede1", accent: "#d4622b", accentDeep: "#a9471a", paper: "#fbf9f3", shadow: "rgba(60,40,20,0.10)",
};
export const SANS = (w: number, px: number) => `${w} ${px}px "Avenir Next", "Helvetica Neue", Helvetica, Arial, sans-serif`;
export const MONO = (px: number) => `${px}px "SF Mono", Menlo, Monaco, monospace`;

// ---------------------------------------------------------------- time
export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const ramp = (f: number, a: number, b: number) => clamp((f - a) / (b - a));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerpP = (a: P, b: P, t: number): P => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
export const inOut = (t: number) => { const c = clamp(t); return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2; };
export const out3 = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
export const in3 = (t: number) => Math.pow(clamp(t), 3);
// expo in/out: the camera move of motion design, slow off the mark, fast through, slow landing
export const expo = (t: number) => { const c = clamp(t); return c === 0 ? 0 : c === 1 ? 1 : c < 0.5 ? Math.pow(2, 20 * c - 10) / 2 : (2 - Math.pow(2, -20 * c + 10)) / 2; };
// a closed-form damped spring step: 0 before t0, settles to 1. zeta < 1 overshoots a little.
export const spring = (f: number, t0: number, omega = 0.45, zeta = 0.72) => {
  const t = f - t0; if (t <= 0) return 0;
  const wd = omega * Math.sqrt(1 - zeta * zeta);
  return 1 - Math.exp(-zeta * omega * t) * (Math.cos(wd * t) + ((zeta * omega) / wd) * Math.sin(wd * t));
};
// a press: 0 -> dips toward 1 -> springs back past 0 and settles
export const press = (f: number, down: number, up: number) => (f < down ? 0 : f < up ? out3((f - down) / (up - down)) : 1 - spring(f, up, 0.55, 0.45));

// ---------------------------------------------------------------- camera
// world coordinates are the 1920x1080 frame; the camera looks at `c` with magnification `z`
export type Cam = { c: P; z: number };
export const HOME: Cam = { c: [960, 540], z: 1 };
export const camLerp = (a: Cam, b: Cam, t: number): Cam => {
  const z = Math.exp(lerp(Math.log(a.z), Math.log(b.z), t)); // zoom travels in log space or it lurches
  // keep the path of the centre steady on screen, not in world: weight it by the zoom
  const w = (z - a.z) / (b.z - a.z || 1);
  return { z, c: lerpP(a.c, b.c, Math.abs(b.z - a.z) < 1e-6 ? t : clamp(w)) };
};
export const useCam = (ctx: Ctx, env: Env, cam: Cam) => {
  const s = env.scale * cam.z;
  ctx.setTransform(s, 0, 0, s, env.scale * (env.W / 2 - cam.c[0] * cam.z), env.scale * (env.H / 2 - cam.c[1] * cam.z));
};
export const toScreen = (cam: Cam, p: P, W = 1920, H = 1080): P => [W / 2 + (p[0] - cam.c[0]) * cam.z, H / 2 + (p[1] - cam.c[1]) * cam.z];

// ---------------------------------------------------------------- plates, live
// Draw frame `frame` of `film` into a surface sized for `px` device pixels across. Sub-films get
// their own cache (their bake keys must never meet the launch film's) and the surface is reused.
// `persist`: a frame that is drawn the same way in every session (a finished plate on the wall)
// may be served from the host's disk store (env.bake) instead of being drawn again: the 31-card
// wall costs a minute to draw cold. Same pixels either way; without a store it simply draws.
export const plateLayer = (env: Env, key: string, film: Film, frame: number, px = 1080, persist = false): Layer => {
  const res = px / film.meta.W, scale = res, lk = `plate:${key}:${px}`;
  let rec = env.cache.get(lk) as { L: Layer; sub: Env; last: number } | undefined;
  if (!rec) {
    const L = env.canvas(Math.round(film.meta.W * scale), Math.round(film.meta.H * scale));
    rec = { L, sub: { W: film.meta.W, H: film.meta.H, scale, cache: new Map(), canvas: env.canvas, image: env.image }, last: NaN };
    env.cache.set(lk, rec);
  }
  const f = Math.max(0, Math.min(film.meta.durationFrames - 1, Math.round(frame)));
  if (rec.last !== f) {
    const L = rec.L, hit = persist ? env.bake?.get(film, f, L.canvas.width, L.canvas.height) : undefined;
    if (hit) { const c = L.ctx; c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = "copy"; c.drawImage(hit, 0, 0); c.globalCompositeOperation = "source-over"; }
    else { renderFrame(film, L.ctx, f, rec.sub); if (persist) env.bake?.put(film, f, L); }
    rec.last = f;
  }
  return rec.L;
};
// a surface the launch film draws into itself (a scene inside a scene), same reuse rule
export const selfLayer = (env: Env, key: string, w: number, h: number): Layer => {
  const lk = `self:${key}:${w}x${h}`; let L = env.cache.get(lk) as Layer | undefined;
  if (!L) { L = env.canvas(w, h); env.cache.set(lk, L); if (env.root && w === Math.round(env.W * env.scale) && h === Math.round(env.H * env.scale)) (L.ctx as unknown as { __frame?: boolean }).__frame = true; } // a full-frame sheet: its text lands in the frame (the probe)
  L.ctx.setTransform(1, 0, 0, 1, 0, 0); L.ctx.clearRect(0, 0, w, h); return L;
};

// ---------------------------------------------------------------- shapes
export const rr = (ctx: Ctx, x: number, y: number, w: number, h: number, r: number) => {
  const q = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + q, y); ctx.arcTo(x + w, y, x + w, y + h, q); ctx.arcTo(x + w, y + h, x, y + h, q); ctx.arcTo(x, y + h, x, y, q); ctx.arcTo(x, y, x + w, y, q); ctx.closePath();
};
export const softShadow = (ctx: Ctx, x: number, y: number, w: number, h: number, r: number, depth = 1) => {
  for (let i = 5; i >= 1; i--) { ctx.fillStyle = `rgba(70,45,20,${0.018 * depth})`; rr(ctx, x - i * 2, y - i * 1 + i * 3, w + i * 4, h + i * 4, r + i * 2); ctx.fill(); }
};
// an ink blot of radius R about c: a wobbling rim, seeded; `grow` 0..1 lets the lobes lead
export const blot = (c: P, R: number, seed: number, n = 96): P[] => {
  const pts: P[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, k = fractal(seed, Math.cos(a) * 1.6 + 5, Math.sin(a) * 1.6 + 5, 1, 1, 3);
    const r = R * (0.9 + 0.22 * k);
    pts.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]);
  }
  return pts;
};
export const pathOf = (ctx: Ctx, pts: P[]) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };

// ---------------------------------------------------------------- pointer
// (`tone`: its fill and edge; a dark look passes a light arrow, which a black one on a dark page is not seen)
export const pointer = (ctx: Ctx, p: P, down = 0, s = 1.35, tone: { fill: string; edge: string } = { fill: "#111", edge: "#fff" }) => {
  const k = s * (1 - 0.12 * down);
  const shape: P[] = [[0, 0], [0, 25], [6.4, 19.2], [10.6, 29], [14.8, 27.2], [10.8, 17.8], [19, 17.8]];
  ctx.save(); ctx.translate(p[0], p[1]); ctx.scale(k, k);
  ctx.fillStyle = "rgba(0,0,0,0.18)"; pathOf(ctx, shape.map(([x, y]) => [x + 1.2, y + 2] as P)); ctx.fill();
  pathOf(ctx, shape); ctx.fillStyle = tone.fill; ctx.fill(); ctx.lineWidth = 1.6; ctx.strokeStyle = tone.edge; ctx.lineJoin = "round"; ctx.stroke();
  ctx.restore();
};

// ---------------------------------------------------------------- the chat
// The layout of the one conversation the film lives in (world coordinates).
export const CHAT = { x: 300, y: 56, w: 1320, h: 968, r: 34 };
export const INPUT = { x: 360, y: 884, w: 1200, h: 104, r: 30 };
export const GEN = { x: 1370, y: 906, w: 166, h: 60, r: 30 };
export const REPLY = { x: 400, y: 214, s: 600 }; // the art card: a square the plate lands in
export const TEXT = { x: 404, base: 948, px: 34 };

export type ChatState = {
  typed: string; caret: boolean; placeholder?: string;
  full?: string;                            // the whole prompt being typed: a wrapping composer breaks where it will (composerLines)
  sent?: string; sentAlpha?: number;       // the user's message once it has gone up
  attach?: { img: CanvasImageSource; label: string } | null;
  genPress?: number; genHot?: number;       // the button: press depth 0..1, hover glow 0..1
  label?: string; labelAlpha?: number;      // the reply's byline
  // your product: the thread's name and subline, the button's word, the accent (defaults: anidoodle's own)
  title?: string; subtitle?: string; genLabel?: string; accent?: string;
  // focus pulls: the header's and the composer's opacity while the camera is close on something else (default 1)
  head?: number; composer?: number;
  // the composer laid out on its own (the hero hook: a big composer that shrinks and docks); default the chat's
  composerGeom?: ChatGeom;
};

// THE CHAT'S GEOMETRY. One chat component, laid out per frame shape (launchLayout.ts): the window,
// the composer, the button, where the typed text sits, and the type sizes of each role. `k` scales
// every length that is not a type size (radii, gaps, strokes). `wrap` > 0: the composer holds that
// many lines and the typed words wrap in it the way a phone composer does (the button sits on the
// last line); 0 is the one-line desktop composer. `theme` is the palette (default C).
export type Rect = { x: number; y: number; w: number; h: number };
export type ChatGeom = {
  CHAT: Rect & { r: number }; INPUT: Rect & { r: number }; GEN: Rect & { r: number };
  REPLY: { x: number; y: number; s: number }; TEXT: { x: number; base: number; px: number };
  k: number; px: { head: number; sub: number; bubble: number; label: number; gen: number }; wrap: number; lineH: number;
  theme?: Partial<typeof C>;
  drop?: string;   // the ink drop's colour (default the ink): the clean preset's drop is its one accent
  iris?: boolean;  // the answer card opens as a clean round iris instead of an ink bloom (the clean preset)
  wrapAs?: { px: number; maxW: number }; // wrap the typed words as at this type size and width (a composer easing between two sizes keeps one set of line breaks), drawn at TEXT.px
  look?: ChatLook; // a custom look (launchLook.ts): its text face, shapes, header and label colour; absent, the stock chat
};
/** What the chat takes from a custom look (launchLook.ts resolves it): its faces, its shapes and its window. */
export type ChatLook = {
  fonts: { text: (w: number, px: number) => string };
  shape: { bubble: "rounded" | "square" | "none"; composer: "box" | "bar"; button: "pill" | "square"; radius?: number; buttonLabel?: string };
  chat: { header?: boolean; title?: string; subtitle?: string; logo?: BrandElement; bubble?: { fill: string; ink: string }; reply?: { fill: string; ink: string } };
  onAccent: string;
};
const FT = (g: ChatGeom) => g.look?.fonts.text ?? SANS;
export const CHAT_GEOM: ChatGeom = { CHAT, INPUT, GEN, REPLY, TEXT, k: 1, px: { head: 22, sub: 18, bubble: 26, label: 20, gen: 24 }, wrap: 0, lineH: 44 };
// the same component at any size: derived from the window's rectangle, a length scale and the type
// sizes. chatGeom(CHAT, 1, CHAT_GEOM.px, TEXT.px, 0) IS CHAT_GEOM (a test holds it to that).
export const chatGeom = (chat: Rect & { r?: number }, k: number, px: ChatGeom["px"], promptPx: number, wrap = 0, genW = 166 * k): ChatGeom => {
  const lineH = Math.round(promptPx * 1.3), h = 104 * k + Math.max(0, wrap - 1) * lineH;
  const CH = { x: chat.x, y: chat.y, w: chat.w, h: chat.h, r: chat.r ?? 34 * k };
  const IN = { x: CH.x + 60 * k, y: CH.y + CH.h - 36 * k - h, w: CH.w - 120 * k, h, r: 30 * k };
  const G = { x: IN.x + IN.w - 24 * k - genW, y: IN.y + IN.h - 22 * k - 60 * k, w: genW, h: 60 * k, r: 30 * k };
  return { CHAT: CH, INPUT: IN, GEN: G, REPLY: { x: CH.x + 100 * k, y: CH.y + 158 * k, s: 600 * k }, TEXT: { x: IN.x + 44 * k, base: IN.y + 64 * k, px: promptPx }, k, px, wrap, lineH };
};
const pal = (g: ChatGeom) => (g.theme ? { ...C, ...g.theme } : C);
// the typed words as they sit in a wrapping composer: whole words per line, a word longer than the
// line broken where it must. Measured with the real font, so the lines are what the viewer sees.
// `full`: the whole prompt being typed. Given it, the words break where the finished prompt breaks, so a word
// starts on the line it will end on (a half-typed word that fit jumped a line as it grew, its line read 0.15 s)
export const composerLines = (ctx: Ctx, typed: string, g: ChatGeom, full?: string): string[] => {
  if (full !== undefined && full !== typed && full.startsWith(typed)) {
    const all = composerLines(ctx, full, g), out: string[] = []; let left = typed.length;
    for (const l of all) { if (left <= 0 && out.length) break; out.push(l.slice(0, Math.max(0, left))); left -= l.length; }
    return out;
  }
  const maxW = g.wrapAs ? g.wrapAs.maxW : g.GEN.x - 20 * g.k - g.TEXT.x;
  ctx.font = FT(g)(500, g.wrapAs ? g.wrapAs.px : g.TEXT.px);
  const out: string[] = []; let line = "";
  for (const tok of typed.split(/(?<= )/)) {
    if (ctx.measureText(line + tok).width <= maxW || !line) line += tok; else { out.push(line); line = tok; }
    while (ctx.measureText(line.trimEnd()).width > maxW && line.length > 1) { let cut = line.length - 1; while (cut > 1 && ctx.measureText(line.slice(0, cut)).width > maxW) cut--; out.push(line.slice(0, cut)); line = line.slice(cut); }
  }
  out.push(line);
  return out;
};

export const drawChatFrame = (ctx: Ctx, s: ChatState, g: ChatGeom = CHAT_GEOM) => {
  const { CHAT, INPUT, GEN, REPLY, TEXT, k, px } = g, P = pal(g);
  ctx.fillStyle = P.bg; ctx.fillRect(-2000, -2000, 6000, 6000);
  softShadow(ctx, CHAT.x, CHAT.y, CHAT.w, CHAT.h, CHAT.r, 1.2);
  const LO = g.look, F = FT(g), winR = LO?.shape.radius !== undefined ? LO.shape.radius * k : CHAT.r;
  ctx.fillStyle = P.card; rr(ctx, CHAT.x, CHAT.y, CHAT.w, CHAT.h, winR); ctx.fill();
  // the thread's head: a small ink dot and a name, nothing that belongs to anyone else (a custom look: the
  // product's own logo in the dot's place, or no header at all)
  if (LO?.chat.header !== false) {
  if (s.head !== undefined) ctx.globalAlpha = s.head;
  // (the clean look's ink is never see-through, layerscan translucent: its dot is cut in or out whole, at half)
  { const a = ctx.globalAlpha; if (g.iris) ctx.globalAlpha = a >= 0.5 ? 1 : 0;
    const logo = LO?.chat.logo;
    if (logo) { const sc = (26 * k) / Math.max(logo.w, logo.h); ctx.save(); ctx.translate(CHAT.x + 58 * k - (logo.w * sc) / 2, CHAT.y + 52 * k - (logo.h * sc) / 2); ctx.scale(sc, sc); drawEl(ctx, logo, { name: "logo" }); ctx.restore(); }
    else { ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(CHAT.x + 58 * k, CHAT.y + 52 * k, 9 * k, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = a; }
  const title = LO?.chat.title ?? s.title, sub = LO?.chat.subtitle ?? s.subtitle;
  // (with a logo the words stand 34 px or more clear of it: framecheck's gap between a brand element and text)
  const tx = LO?.chat.logo ? CHAT.x + 71 * k + Math.max(34, 36 * k) : CHAT.x + 80 * k;
  ctx.font = F(600, px.head); ctx.fillStyle = P.ink; ctx.textBaseline = "middle"; ctx.fillText(title ?? "anidoodle", tx, CHAT.y + 53 * k);
  const subX = title === undefined ? tx + 116 * k : tx + ctx.measureText(title).width + 16 * k;
  ctx.font = F(500, px.sub); ctx.fillStyle = P.mute; ctx.fillText(sub ?? "drawn in code", subX, CHAT.y + 54 * k);
  ctx.fillStyle = P.line; ctx.fillRect(CHAT.x + 32 * k, CHAT.y + 98 * k, CHAT.w - 64 * k, 1.5 * k);
  if (s.head !== undefined) ctx.globalAlpha = 1;
  }
  // the sent message, right aligned
  if (s.sent) {
    ctx.globalAlpha = s.sentAlpha ?? 1; ctx.font = F(500, px.bubble);
    const tw = ctx.measureText(s.sent).width, pad = 26 * k, bw = tw + pad * 2, bx = CHAT.x + CHAT.w - 60 * k - bw, by = CHAT.y + 124 * k;
    let ay = by;
    if (s.attach) { const iw = 240 * k, ih = 150 * k; ay = by; ctx.save(); rr(ctx, CHAT.x + CHAT.w - 60 * k - iw, ay, iw, ih, 16 * k); ctx.clip(); ctx.drawImage(s.attach.img, CHAT.x + CHAT.w - 60 * k - iw, ay, iw, ih); ctx.restore(); ay += ih + 10 * k; }
    ctx.fillStyle = P.chip; rr(ctx, bx, ay, bw, 56 * k, 22 * k); ctx.fill();
    ctx.fillStyle = P.ink; ctx.textBaseline = "middle"; ctx.fillText(s.sent, bx + pad, ay + 29 * k);
    ctx.globalAlpha = 1;
  }
  if (s.label) { ctx.globalAlpha = s.labelAlpha ?? 1; ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(REPLY.x + 9 * k, REPLY.y - 26 * k, 7 * k, 0, Math.PI * 2); ctx.fill(); ctx.font = F(600, px.label); ctx.textBaseline = "middle"; ctx.fillText(s.label, REPLY.x + 26 * k, REPLY.y - 25 * k); ctx.globalAlpha = 1; }
  // the composer
  { const g2 = s.composerGeom ?? g, { INPUT, GEN, TEXT, k, px } = g2;
  if (s.composer !== undefined) ctx.globalAlpha = s.composer;
  // (a bar: round ends at one line's height; a composer grown to three lines keeps those ends, never an oval)
  const inR = LO ? (LO.shape.composer === "bar" ? Math.min(INPUT.h / 2, 52 * k) : LO.shape.radius !== undefined ? LO.shape.radius * k : INPUT.r) : INPUT.r;
  ctx.fillStyle = P.paper; rr(ctx, INPUT.x, INPUT.y, INPUT.w, INPUT.h, inR); ctx.fill();
  ctx.lineWidth = 2 * k; ctx.strokeStyle = P.line; ctx.stroke();
  ctx.font = F(500, TEXT.px); ctx.textBaseline = "alphabetic";
  if (!s.typed && s.placeholder) { ctx.fillStyle = P.mute; ctx.fillText(s.placeholder, TEXT.x, TEXT.base); }
  const acc = s.accent ?? P.accent;
  if (g2.wrap > 0) {
    const lines = composerLines(ctx, s.typed, g2, s.full); ctx.font = F(500, TEXT.px); ctx.fillStyle = P.ink;
    lines.forEach((l, i) => ctx.fillText(l, TEXT.x, TEXT.base + i * g2.lineH));
    if (s.caret) { const i = lines.length - 1, x = TEXT.x + ctx.measureText(lines[i]).width + 3 * k; ctx.fillStyle = acc; ctx.fillRect(x, TEXT.base + i * g2.lineH - 0.94 * TEXT.px, 3 * k, 1.18 * TEXT.px); }
  } else {
    ctx.fillStyle = P.ink; ctx.fillText(s.typed, TEXT.x, TEXT.base);
    if (s.caret) { const x = TEXT.x + ctx.measureText(s.typed).width + 3; ctx.fillStyle = acc; ctx.fillRect(x, TEXT.base - 32, 3, 40); }
  }
  // Generate
  const pr = s.genPress ?? 0, hot = s.genHot ?? 0, q = 1 - 0.07 * pr, gx = GEN.x + (GEN.w * (1 - q)) / 2, gy = GEN.y + (GEN.h * (1 - q)) / 2;
  { const a = ctx.globalAlpha; if (g.iris) ctx.globalAlpha = a >= 0.5 ? 1 : 0; // (the clean look's accent button, cut whole, as its dot)
  const genR = LO?.shape.button === "square" ? Math.min(GEN.r, 8 * k) : GEN.r;
  ctx.fillStyle = hot > 0 ? mixHex(acc, s.accent ? deepen(acc) : P.accentDeep, 0.35 * hot + 0.4 * pr) : acc; rr(ctx, gx, gy, GEN.w * q, GEN.h * q, genR * q); ctx.fill(); ctx.globalAlpha = a; }
  ctx.fillStyle = LO?.onAccent ?? "#fff"; ctx.font = F(600, px.gen * q); ctx.textBaseline = "middle"; ctx.textAlign = "center"; ctx.fillText(s.genLabel ?? "Generate", GEN.x + GEN.w / 2, GEN.y + GEN.h / 2 + 1 * k); ctx.textAlign = "left";
  if (s.composer !== undefined) ctx.globalAlpha = 1; }
};
// where the caret is: the end of the typed words (on their last line in a wrapping composer)
export const caretAt = (ctx: Ctx, typed: string, g: ChatGeom = CHAT_GEOM, full?: string): P => {
  if (g.wrap > 0) { const lines = composerLines(ctx, typed, g, full), i = lines.length - 1; ctx.font = FT(g)(500, g.TEXT.px); return [g.TEXT.x + ctx.measureText(lines[i]).width, g.TEXT.base + i * g.lineH - 0.35 * g.TEXT.px]; }
  ctx.font = FT(g)(500, g.TEXT.px); return [g.TEXT.x + ctx.measureText(typed).width, g.TEXT.base - 12];
};

const hx = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const deepen = (h: string) => "#" + hx(h).map((v) => Math.round(v * 0.78).toString(16).padStart(2, "0")).join("");
export const mixHex = (a: string, b: string, t: number) => { const x = hx(a), y = hx(b); return `rgb(${x.map((v, i) => Math.round(lerp(v, y[i], clamp(t)))).join(",")})`; };

// the art card: paper, a hairline, and whatever layer is inside, clipped to the rounded square
export const artCard = (ctx: Ctx, x: number, y: number, s: number, L: Layer | null, r = 22) => {
  softShadow(ctx, x, y, s, s, r, 1.4);
  ctx.save(); rr(ctx, x, y, s, s, r); ctx.clip(); ctx.fillStyle = C.paper; ctx.fillRect(x, y, s, s);
  if (L) ctx.drawImage(L.canvas, x, y, s, s);
  ctx.restore();
  ctx.lineWidth = 1.5; ctx.strokeStyle = "rgba(0,0,0,0.08)"; rr(ctx, x, y, s, s, r); ctx.stroke();
};

// ---------------------------------------------------------------- typing, the drop, the answer card
// Human typing: the time each character lands, uneven and seeded, spaces a little slower.
export const charTimes = (text: string, t0: number, rate: number, seed: number) => { const out: number[] = []; let t = t0; for (let i = 0; i < text.length; i++) { const h = Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453, j = h - Math.floor(h); t += rate * (0.55 + j * 0.9) + (text[i] === " " ? 0.6 * rate : 0); out.push(t); } return out; };
export const typedAt = (text: string, f: number, times: number[]) => text.slice(0, times.filter((t) => f >= t).length);
// The drop: a bead of ink lifts off Generate and arcs to where the answer card will land.
export type Drop = { t0: number; land: number; full: number };
// the drop's progress along its path: the drawn look's in-out; the clean look's keeps 60 % of a steady pace, so
// it lands still moving, a hit the iris takes over (an in-out's slow last third crawled for half a second on a
// lively brand's longer flight: dead air to the gate)
const dropEase = (u: number, g: ChatGeom) => (g.iris ? 0.4 * inOut(u) + 0.6 * u : inOut(u));
// (and it flies straight: the 150 px arc, falling again as the drop rose to a card above the button, cancelled
// its climb near the end on a phone frame, where the path is mostly upward, and the drop hung there)
const dropArc = (g: ChatGeom) => (g.iris ? 0 : 150);
export const inkDrop = (ctx: Ctx, f: number, d: { t0: number; land: number }, to: P, g: ChatGeom = CHAT_GEOM) => {
  const { GEN, k } = g, ink = g.drop ?? pal(g).ink, GEN_C: P = [GEN.x + GEN.w / 2, GEN.y + GEN.h / 2];
  if (f < d.t0 - 6 || f >= d.land) return;
  if (f < d.t0) { const w = out3(ramp(f, d.t0 - 6, d.t0)); ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(GEN_C[0], GEN.y + 6 * k - w * 22 * k, 30 * k * (0.3 + 0.7 * w), 0, Math.PI * 2); ctx.fill(); return; }
  const at = (t: number): P => { const u = ramp(t, d.t0, d.land), e = dropEase(u, g); return [lerp(GEN_C[0], to[0], e), lerp(GEN.y - 16 * k, to[1], e) - Math.sin(Math.PI * u) * dropArc(g) * k]; };
  // the drawn look trails ghosts of ink; the clean look's drop (its one accent, never see-through) stretches
  // into one solid, tapering streak along its path instead, as the motif's drop does
  for (let j = 24; j >= 0; j--) { const p = at(f - j * 0.1); ctx.fillStyle = ink; ctx.globalAlpha = g.iris || j === 0 ? 1 : 0.22 * (1 - j / 25); ctx.beginPath(); ctx.arc(p[0], p[1], 30 * k * (g.iris ? 1 - j * 0.034 : 1 - j * 0.022), 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
};
// where the drop is at frame f (null when it is not in flight): the motif's position for a match cut
export const inkDropAt = (f: number, d: { t0: number; land: number }, to: P, g: ChatGeom = CHAT_GEOM): { p: P; r: number } | null => {
  const { GEN, k } = g, GEN_C: P = [GEN.x + GEN.w / 2, GEN.y + GEN.h / 2];
  if (f < d.t0 - 6 || f >= d.land) return null;
  if (f < d.t0) { const w = out3(ramp(f, d.t0 - 6, d.t0)); return { p: [GEN_C[0], GEN.y + 6 * k - w * 22 * k], r: 30 * k * (0.3 + 0.7 * w) }; }
  const u = ramp(f, d.t0, d.land), e = dropEase(u, g);
  return { p: [lerp(GEN_C[0], to[0], e), lerp(GEN.y - 16 * k, to[1], e) - Math.sin(Math.PI * u) * dropArc(g) * k], r: 30 * k };
};
// The answer card in the thread: a byline, then the art, revealed by the landed drop blooming open.
// `art` is any layer (plateLayer gives a live plate); `crop` picks a source rectangle.
// `grow` (default an out-cubic from land to full) is how open the card is at frame f: the template
// passes a spring, so the card lands on the spring's first arrival and its sound cue can sit there
/** Set by a surface that faded or withheld the last fillText to the share of it drawn, 0..1 (launchTemplate's placed(), fading a line before a zone), so a mark that belongs to the line fades and leaves with it. */
export const TEXT_SHOWN = Symbol.for("anidoodle.textShown");
export const inkCard = (ctx: Ctx, x: number, y: number, s: number, f: number, d: Drop, art: Layer, label: string, crop?: [number, number, number, number], g: ChatGeom = CHAT_GEOM, growAt?: (f: number) => number, labelA = 1) => {
  const k = g.k, P = pal(g), A = ctx.globalAlpha; // a card drawn under a focus pull keeps the caller's opacity
  // the byline: a dot and its words, drawn together or not at all (a dot left alone reads as a stray mark)
  const LA = A * ramp(f, d.land, d.land + 10) * Math.max(0, Math.min(1, labelA));
  if (label && LA > 0.001) {
    // the words first: a surface that fades or withholds a line (a travel's zone fade) says how much of it
    // it drew through TEXT_SHOWN, and the dot is drawn at that much too, fading and leaving with its words
    ctx.fillStyle = g.look?.chat.reply?.ink ?? P.ink; ctx.globalAlpha = LA; ctx.font = FT(g)(600, g.px.label); ctx.textBaseline = "middle";
    const c = ctx as Ctx & { [TEXT_SHOWN]?: number }; c[TEXT_SHOWN] = 1; ctx.fillText(label, x + 26 * k, y - 15 * k);
    const shown = Math.max(0, Math.min(1, Number(c[TEXT_SHOWN] ?? 1)));
    // (the clean look's dot is its ink, never see-through: it grows in and shrinks out with its words instead)
    if (shown > 0) { ctx.globalAlpha = g.iris ? 1 : LA * shown; ctx.beginPath(); ctx.arc(x + 9 * k, y - 16 * k, 7 * k * (g.iris ? LA * shown : 1), 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.globalAlpha = A;
  const grow = growAt ? growAt(f) : out3(ramp(f, d.land, d.full)), c: P = [x + s / 2, y + s / 2];
  softShadow(ctx, x, y, s, s, 20 * k, Math.min(1, grow) * 1.3);
  ctx.save(); rr(ctx, x, y, s, s, 20 * k); ctx.clip();
  if (grow < 1 && g.iris) { ctx.beginPath(); ctx.arc(c[0], c[1], Math.max(0, lerp(18 * k, s * 0.72, grow)), 0, Math.PI * 2); ctx.clip(); }
  else if (grow < 1) { pathOf(ctx, blot(c, lerp(16 * k, s * 0.8, grow) + 28 * k * (1 - grow), 77)); ctx.fillStyle = g.drop ?? P.ink; ctx.fill(); pathOf(ctx, blot(c, Math.max(0, lerp(16 * k, s * 0.8, grow) - 5 * k), 77)); ctx.clip(); }
  ctx.fillStyle = g.look?.chat.reply?.fill ?? P.paper; ctx.fillRect(x, y, s, s);
  if (crop) ctx.drawImage(art.canvas, ...crop, x, y, s, s); else ctx.drawImage(art.canvas, x, y, s, s);
  ctx.restore();
  // the clean iris's edge while it opens: a solid ring in the drop's colour, so the landed drop visibly opens
  // into it (a pale disc on a cream card read as the answer fading in, a fresh critic's cc1-3)
  // (only while the whole ring is inside the card: wider, it showed as four arcs in the corners, cc3-2)
  const rimR = Math.max(0, lerp(18 * k, s * 0.72, grow));
  if (grow < 1 && g.iris && rimR < s / 2 - 2 * k) {
    ctx.save(); rr(ctx, x, y, s, s, 20 * k); ctx.clip();
    ctx.beginPath(); ctx.arc(c[0], c[1], rimR, 0, Math.PI * 2);
    ctx.strokeStyle = g.drop ?? P.accent; ctx.lineWidth = 4 * k; ctx.stroke(); ctx.restore();
  }
};
