// LAUNCH LAYOUT. One timeline, four frame shapes, and a layout function between them: the chat, the
// type frames, the cards, the split feature beats and the end card are RE-COMPOSED for each shape,
// never cropped out of a wide render. 16x9 is the desktop composition (the numbers the template was
// built on, kept exactly); 1x1, 4x5 and 9x16 are phone compositions with phone-safe type: every line
// a viewer must read is at least `minPx` tall at the delivered size (32 px at 1080 across is about
// 11 pt on a 360 pt wide phone, the smallest body size a platform UI uses).
//
//   const L = launchLayout("9x16", { prompts, install, tagline });
//   L.W, L.H            the frame
//   L.chat              the chat component's geometry (drawChatFrame, caretAt, inkDrop, inkCard)
//   L.thread / L.cam    the thread's rhythm and the camera's rests
//   L.type / L.end      the word pages and the end card
//   L.split             a feature beat: the words' column and the live UI's, which never overlap
//   L.stage / L.band    the picture's area and, with captions burned in, the captions' own band
//   L.roles             every text role and its size, which launchLayout checks against minPx
//   L.safe / L.zones    where text may sit: on 9x16 inside the platforms' safe zones (PHONE_SAFE), else the frame
import { CHAT_GEOM, chatGeom, type ChatGeom, type Rect } from "./launchKit";
import type { Cam } from "./launchKit";
import type { P } from "./core";

export type Shape = "16x9" | "1x1" | "4x5" | "9x16";
export const SHAPES: Record<Shape, { W: number; H: number; use: string }> = {
  "16x9": { W: 1920, H: 1080, use: "YouTube, the site, the README" },
  "1x1": { W: 1080, H: 1080, use: "X and LinkedIn feeds" },
  "4x5": { W: 1080, H: 1350, use: "Instagram and LinkedIn feeds (the tallest feed post)" },
  "9x16": { W: 1080, H: 1920, use: "Reels, Shorts, TikTok, Stories" },
};
export const isShape = (s: string): s is Shape => s in SHAPES;
export const parseShapes = (s: string): Shape[] => {
  const out = s.split(",").map((x) => x.trim()).filter(Boolean);
  const bad = out.filter((x) => !isShape(x));
  if (bad.length || !out.length) throw new Error(`shapes: '${bad.join(", ") || s}' is not a shape; use ${Object.keys(SHAPES).join(", ")}`);
  return out as Shape[];
};
// The 9:16 platform safe zones: Reels, TikTok and Shorts lay their own interface over the top band, the
// bottom band and a right-hand column of buttons. Shares of the frame: top and bottom of its height,
// right of its width. tools/textrules.mjs checks rendered frames against the same numbers (a unit test
// holds the two equal). They apply to 9x16 only; the feed shapes have no such overlay.
export const PHONE_SAFE = { top: 0.14, bottom: 0.25, right: 0.14 } as const;
/** The rectangle a W x H frame leaves free of the platforms' interface (the whole frame for a shape the zones do not apply to). */
export const safeRect = (shape: Shape, W: number, H: number): Rect => shape === "9x16" ? { x: 0, y: H * PHONE_SAFE.top, w: W * (1 - PHONE_SAFE.right), h: H * (1 - PHONE_SAFE.top - PHONE_SAFE.bottom) } : { x: 0, y: 0, w: W, h: H };
// on 9x16 the layout keeps this far inside a zone's line (a zone's edge is not a visible edge, so the gap is small)
const ZONE_GAP = 8;

// phone-safe minimums, px at the delivered size: `read` = a line the viewer must read (a prompt, a
// label, the words, the install lines); `chrome` = the UI around them (a header, a button's word)
// the footer is where the film says the product lives: it is on screen in the last second, so it meets
// framecheck's last-second floor (28 px at 1080, tools/framerules.mjs RULES.endPx), not the chrome floor
export const MIN_PX = { phone: { read: 32, chrome: 24, type: 64 }, desk: { read: 18, chrome: 16, type: 80 } };

// A build-time estimate of a sans line's width, deliberately a little wide: layout decisions (how
// many lines a bubble or a composer needs) are taken before any canvas exists, and an estimate that
// errs wide wraps one word early instead of running under the button.
const NARROW = new Set([..."il.,:;'|!ijtf()[] "]), SEMI = new Set([..."rsz-\"*"]), WIDE = new Set([..."mw"]), CAPW = new Set([..."MW"]);
export const estWidth = (text: string, px: number) => [...text].reduce((a, ch) => a + px * (NARROW.has(ch) ? 0.3 : SEMI.has(ch) ? 0.48 : WIDE.has(ch) ? 0.88 : CAPW.has(ch) ? 0.98 : /[A-Z]/.test(ch) ? 0.72 : /[0-9]/.test(ch) ? 0.6 : 0.6), 0);
export const monoWidth = (text: string, px: number) => text.length * px * 0.61;

// Install lines as the end card's panel rows. Each line keeps one row while every line can be at least
// `min` px mono in `avail` px; a line that cannot wraps at a natural break, a space first (after the
// command word), then before "@" or after "/". Its continuation rows hang INDENT characters in, with no
// prompt glyph, so the command still reads as one line to type. A line with no break that fits stays
// whole (the size check then refuses it). px: the mono size every row is set at, at most `cap`.
export type InstallRow = { text: string; indent: number };
export const INSTALL_INDENT = 2;
export const installRows = (lines: string[], avail: number, min: number, cap: number): { rows: InstallRow[]; px: number; wrapped: boolean } => {
  const px0 = Math.min(cap, ...lines.map((s) => avail / (s.length * 0.61)));
  if (px0 >= min) return { rows: lines.map((text) => ({ text, indent: 0 })), px: px0, wrapped: false };
  const most = Math.floor(avail / (min * 0.61)); // characters a row holds at the minimum size
  // where a line may break: [end of this row, start of the next]; a space is dropped, "@" opens the next row, "/" closes this one
  const breaks = (t: string, kind: "space" | "mark") => [...t].flatMap((ch, i) => (kind === "space" ? (ch === " " && i > 0 ? [[i, i + 1]] : []) : ch === "@" && i > 0 ? [[i, i]] : ch === "/" && i > 0 && i < t.length - 1 ? [[i + 1, i + 1]] : []));
  const wrap = (t: string, indent: number): InstallRow[] | null => {
    if (t.length + indent <= most) return [{ text: t, indent }];
    // two rows if any break gives two (a space first, the longest first row), else more
    for (const kind of ["space", "mark"] as const) for (const [end, next] of breaks(t, kind).reverse()) if (end + indent <= most && t.length - next + INSTALL_INDENT <= most) return [{ text: t.slice(0, end), indent }, { text: t.slice(next), indent: INSTALL_INDENT }];
    for (const kind of ["space", "mark"] as const) {
      // the longest first row that fits, whose rest can be wrapped in turn
      for (const [end, next] of breaks(t, kind).reverse()) {
        if (end + indent > most) continue;
        const rest = wrap(t.slice(next), INSTALL_INDENT);
        if (rest) return [{ text: t.slice(0, end), indent }, ...rest];
      }
    }
    return null;
  };
  const rows = lines.flatMap((t) => (avail / (t.length * 0.61) >= min ? [{ text: t, indent: 0 }] : wrap(t, 0) ?? [{ text: t, indent: 0 }]));
  return { rows, px: Math.min(cap, ...rows.map((r) => avail / ((r.text.length + r.indent) * 0.61))), wrapped: rows.length > lines.length };
};
export const wrapEst = (text: string, px: number, maxW: number): string[] => {
  const out: string[] = []; let line = "";
  for (const w of text.split(" ")) { const t = line ? `${line} ${w}` : w; if (!line || estWidth(t, px) <= maxW) line = t; else { out.push(line); line = w; } }
  out.push(line); return out;
};

export type Role = { role: string; px: number; min: number };
export type LaunchLayout = {
  shape: Shape; W: number; H: number; k: number; phone: boolean;
  chat: ChatGeom;
  thread: { top: number; viewBottom: number; clip: [number, number, number, number]; bubbleH: number; bubbleLineH: number; bubblePad: number; bubbleR: number; bubbleMaxW: number; bubbleRad: number; gap: number; card: number; cardX: number; cardDy: number; bubbles: string[][] };
  cam: { home: Cam; macroZ: number; macroCreep: number; macroX0: number; macroY: number; follow: boolean; leanZ: number; pointerOff: P; pointerS: number; pointerOn: P };
  bug: { x: number; y: number; px: number };
  type: { maxW: number; cap1: number; capN: number; minPx: number; cover: number; at?: P }; // at: the words' centre when it is not the frame's
  end: { cx: number; titleY: number; titleMax: number; titleW: number; tagline: string[]; taglineY: number; taglinePx: number; taglineLH: number; panelY: number; monoPx: number; rows: InstallRow[]; wrapped: boolean; rowH: number; padX: number; lineY0: number; footerPx: number; footerY: number; caret: [number, number] };
  split: { words: Rect; ui: Rect; vertical: boolean; wordsPx: number };
  stage: Rect; band: Rect | null;
  uiFull: Rect;  // a product-UI ask's panel when it has no words beside it
  safe: Rect; zones: boolean;
  roles: Role[];
};
export type LayoutContent = { prompts: string[]; install: string[]; tagline: string; title?: string; band?: boolean; wrap?: (text: string, px: number, maxW: number) => string[] }; // wrap: the look's text face (default the stock estimate)

// the desktop composition: the exact numbers of the 1920x1080 film
const desk = (c: LayoutContent): LaunchLayout => {
  const W = 1920, H = 1080, g = CHAT_GEOM, VIEW_BOTTOM = g.INPUT.y - 26, py = 590, n = c.install.length, ph = 60 * n + 50;
  return {
    shape: "16x9", W, H, k: 1, phone: false, chat: g,
    thread: { top: 170, viewBottom: VIEW_BOTTOM, clip: [300, 158, 1320, VIEW_BOTTOM - 158], bubbleH: 58, bubbleLineH: 34, bubblePad: 26, bubbleR: 1560, bubbleMaxW: 1080, bubbleRad: 22, gap: 26, card: 460, cardX: g.REPLY.x, cardDy: 34, bubbles: c.prompts.map((p) => [p]) },
    cam: { home: { c: [960, 540], z: 1 }, macroZ: 2.4, macroCreep: 0.25, macroX0: 330, macroY: 934, follow: true, leanZ: 1.18, pointerOff: [1780, 1140], pointerS: 1.35, pointerOn: [g.GEN.x + g.GEN.w / 2 + 18, g.GEN.y + g.GEN.h / 2 + 6] },
    // the corner mark sits in the gutter right of the window, clear of its corner (24 px at the old 24 px size touched it)
    bug: { x: W - 36, y: H - 30, px: 22 },
    type: { maxW: 1560, cap1: 190, capN: 130, minPx: MIN_PX.desk.type, cover: 1110 },
    end: { cx: W / 2, titleY: 400, titleMax: 150, titleW: 1300, tagline: [c.tagline], taglineY: 520, taglinePx: 30, taglineLH: 40, panelY: py, monoPx: 30, rows: c.install.map((text) => ({ text, indent: 0 })), wrapped: false, rowH: 60, padX: 60, lineY0: py + 55, footerPx: 28, footerY: py + ph + 60, caret: [16, 34] },
    // a two-column grid on the frame's centre line: words 40 %, a 100 px gutter, the live UI 46 %, equal margins
    split: { words: { x: 150, y: 150, w: 720, h: 780 }, ui: { x: 970, y: 120, w: 800, h: 840 }, vertical: false, wordsPx: 96 },
    stage: { x: 0, y: 0, w: W, h: H }, band: null,
    uiFull: { x: 250, y: 90, w: 1420, h: 880 }, safe: { x: 0, y: 0, w: W, h: H }, zones: false,
    roles: [],
  };
};

// the phone compositions: one column, the chat as tall as the frame allows, type sizes floored at the phone minimums.
// Each is composed inside E, the edges it treats as its frame: the frame itself for 1x1 and 4x5; on 9x16
// the safe rectangle S, so every line a viewer reads stays clear of the platforms' interface (the picture's
// background still fills the whole frame). E sits `m - ZONE_GAP` outside a zone's line, so the margins
// leave ZONE_GAP against a zone and the full margin m against the frame's own left edge.
const phone = (shape: Exclude<Shape, "16x9">, c: LayoutContent, H0: number, S: Rect): LaunchLayout => {
  // (9x16 composes inside its safe rectangle, about a 4x5 frame's worth of room, so it takes 4x5's scale)
  const W = 1080, H = H0, m = 40, k = { "1x1": 1.12, "4x5": 1.22, "9x16": 1.22 }[shape], min = MIN_PX.phone, zones = shape === "9x16";
  const E = zones ? { x0: 0, y0: S.y - (m - ZONE_GAP), x1: S.x + S.w + (m - ZONE_GAP), y1: Math.min(S.y + S.h, H) } : { x0: 0, y0: 0, x1: W, y1: H };
  const Ew = E.x1 - E.x0, Eh = E.y1 - E.y0;
  const px = { head: Math.max(22 * k, min.chrome), sub: Math.max(18 * k, min.chrome), bubble: Math.max(26 * k, min.read), label: Math.max(20 * k, min.read), gen: Math.max(24 * k, min.chrome) };
  // the window stops above the corner mark's own strip: the mark never sits on the UI, and its letters stay
  // clear of the window's corner while the hook's camera creeps 2 % about the window's centre
  const bugPx = Math.max(24 * k, min.chrome), bugStrip = Math.round(bugPx + 56), bugY = zones ? E.y1 - 0.3 * bugPx - 2 : E.y1 - 20;
  const promptPx = Math.max(34 * k, min.read), chatR = { x: E.x0 + m, y: E.y0 + m, w: Ew - 2 * m, h: Eh - m - bugStrip, r: 34 * k };
  // the composer holds the longest prompt; the button sits on its last line
  const base = chatGeom(chatR, k, px, promptPx, 1), textW = base.GEN.x - 20 * k - base.TEXT.x;
  const lines = Math.min(3, Math.max(1, ...c.prompts.map((p) => (c.wrap ?? wrapEst)(p, promptPx, textW).length)));
  const g = chatGeom(chatR, k, px, promptPx, lines);
  const top = g.CHAT.y + 114 * k, viewBottom = g.INPUT.y - 26 * k, bubbleMaxW = g.INPUT.w * 0.86, bubbleLineH = Math.round(px.bubble * 1.3);
  const bubbles = c.prompts.map((p) => (c.wrap ?? wrapEst)(p, px.bubble, bubbleMaxW - 52 * k));
  // the answer card: as wide as the thread allows, and short enough that a card and the prompt above it both fit the view
  const card = Math.round(Math.min(g.INPUT.w, viewBottom - top - 58 * k - 2 * bubbleLineH - 60 * k));
  const cardX = g.CHAT.x + (g.CHAT.w - card) / 2;
  // the end card, stacked and centred. On 9x16 it centres on the frame itself, the column a viewer sees
  // (centred on the safe rectangle it sat 60 px left of the middle, and read off-centre outside a feed), and
  // stays as narrow as the room between the middle and the right-hand zone allows
  const endCol = zones ? { cx: W / 2, w: 2 * (S.x + S.w + (m - ZONE_GAP) - W / 2) } : { cx: E.x0 + Ew / 2, w: Ew };
  const inst = installRows(c.install, endCol.w - 2 * 32 - 2 * 36, min.read, 30 * k), mono = inst.px;
  const taglinePx = Math.max(30 * k, min.read), tagline = (c.wrap ?? wrapEst)(c.tagline, taglinePx, endCol.w - 2 * m - 60), tLH = Math.round(taglinePx * 1.3);
  const titleMax = 150 * k, rowH = Math.round(mono * 2), ph = rowH * inst.rows.length + 50 * k;
  const block = titleMax + 60 + tagline.length * tLH + 60 + ph + 80, y0 = E.y0 + (Eh - block) / 2 - 20;
  const titleY = y0 + titleMax * 0.62, taglineY = y0 + titleMax + 60 + tLH / 2, panelY = taglineY + (tagline.length - 0.5) * tLH + 50;
  // the split beat, stacked: the words on top, the live UI under them. On 9x16 both sit in the window's
  // rectangle, and the UI is inset so its push (12 % at most) never carries its text past that rectangle.
  const PUSH = 1.12, R = { x: chatR.x, y: chatR.y, w: chatR.w, h: chatR.h + 22 }; // (+22: a product's panel keeps the room the corner mark's wider strip took from the chat window; it never creeps as the hook does)
  const wordsH = Math.round(R.h * 0.32), uiTop = R.y + wordsH + 30, uiW = Math.floor(R.w / PUSH), uiH = Math.floor((R.y + R.h - uiTop) / PUSH);
  const split = zones
    ? { words: { x: R.x + 20, y: R.y + 10, w: R.w - 40, h: wordsH }, ui: { x: Math.round(R.x + (R.w - uiW) / 2), y: Math.round(uiTop + (R.y + R.h - uiTop - uiH) / 2), w: uiW, h: uiH }, vertical: true, wordsPx: 96 }
    : { words: { x: 80, y: 90, w: W - 160, h: Math.round(H * 0.3) }, ui: { x: m + 20, y: Math.round(H * 0.3) + 130, w: W - 2 * m - 40, h: H - Math.round(H * 0.3) - 130 - 90 }, vertical: true, wordsPx: shape === "1x1" ? 76 : 84 };
  // a UI ask on its own: on 9x16 the window's rectangle less 6 %, the room its camera creeps into
  const uiFull = zones ? { x: Math.round(R.x + R.w * 0.03), y: Math.round(R.y + R.h * 0.03), w: Math.round(R.w * 0.94), h: Math.round(R.h * 0.94) } : { x: 40, y: Math.round(H * 0.1), w: W - 80, h: Math.round(H * 0.76) };
  // a word page: its lines, and on 9x16 its bloom too, centred on the window's rectangle
  const typeAt: P = [E.x0 + Ew / 2, R.y + R.h / 2];
  // the hook: the prompt big, the camera gliding after the caret (and down a line when the words wrap)
  const macroZ = { "1x1": 1.85, "4x5": 1.95, "9x16": 2.05 }[shape];
  return {
    shape, W, H, k, phone: true, chat: g,
    thread: { top, viewBottom, clip: [g.CHAT.x, g.CHAT.y + 102 * k, g.CHAT.w, viewBottom - (g.CHAT.y + 102 * k)], bubbleH: 58 * k + (px.bubble - 26 * k) * 1.2, bubbleLineH, bubblePad: 26 * k, bubbleR: g.INPUT.x + g.INPUT.w, bubbleMaxW, bubbleRad: 22 * k, gap: 26 * k, card, cardX, cardDy: 34 * k + (px.label - 20 * k), bubbles },
    // on 9x16 the lean on a new card goes further: the card is smaller there, and the rest of the window fades as it leaves the safe area
    cam: { home: { c: [W / 2, H / 2], z: 1 }, macroZ, macroCreep: macroZ * 0.08, macroX0: W / 2 / macroZ - 60 * k, macroY: g.INPUT.y + g.INPUT.h / 2, follow: true, leanZ: zones ? 1.5 : 1.1, pointerOff: [W - 110, H + 70], pointerS: 1.35 * k, pointerOn: [g.GEN.x + g.GEN.w / 2 + 18 * k, g.GEN.y + g.GEN.h / 2 + 6 * k] },
    bug: { x: chatR.x + chatR.w - 20, y: bugY, px: bugPx }, // under the window's right edge, 20 px in: aligned to the content, with room before the right-hand zone
    type: { maxW: Ew - 2 * 90, cap1: 190, capN: 150, minPx: min.type, cover: zones ? Math.ceil(Math.max(...[[0, 0], [W, 0], [0, H], [W, H]].map(([x, y]) => Math.hypot(x - typeAt[0], y - typeAt[1])))) + 9 : Math.ceil(Math.hypot(W, H) / 2) + 9, ...(zones ? { at: typeAt } : {}) }, // cover: the bloom's reach to the farthest corner from where it opens
    end: { cx: endCol.cx, titleY, titleMax, titleW: endCol.w - 2 * m - 80, tagline, taglineY, taglinePx, taglineLH: tLH, panelY, monoPx: mono, rows: inst.rows, wrapped: inst.wrapped, rowH, padX: 36, lineY0: panelY + 25 * k + rowH / 2, footerPx: Math.max(28 * k, min.read), footerY: panelY + ph + 60, caret: [Math.round(mono * 0.53), Math.round(mono * 1.13)] },
    split, stage: { x: 0, y: 0, w: W, h: H }, band: null, uiFull, safe: S, zones,
    roles: [],
  };
};

// the caption band, when captions are burned in: its own strip under the picture, never over it.
// The layout is composed for the picture's area (the stage), and the band is drawn below it.
// On 9x16 the band sits at the bottom of the safe rectangle (captions are text a viewer reads), and the
// strip under it, in the platforms' bottom zone, is the picture's background.
const BAND = { "16x9": 0, "1x1": 150, "4x5": 170, "9x16": 230 };

/** The layout of a launch film in `shape`, for this content. Throws when a line a viewer must read cannot be phone-safe. */
export const launchLayout = (shape: Shape, c: LayoutContent): LaunchLayout => {
  if (!isShape(shape)) throw new Error(`launchLayout: '${shape}' is not a shape; use ${Object.keys(SHAPES).join(", ")}`);
  const { W, H } = SHAPES[shape], band = c.band ? BAND[shape] : 0;
  if (c.band && shape === "16x9") throw new Error("launchLayout 16x9: burned-in captions are for the phone shapes (1x1, 4x5, 9x16); a 16x9 film ships its captions as a .srt/.vtt sidecar");
  // (a wide frame plays where sidecar captions work, YouTube, LinkedIn, the site: its captions ship as .srt/.vtt)
  const S = safeRect(shape, W, H), bandY = !band ? H : shape === "9x16" ? S.y + S.h - band : H - band;
  const L = shape === "16x9" ? desk(c) : phone(shape, c, bandY, S);
  L.H = H; L.stage = { x: 0, y: 0, w: W, h: bandY }; L.band = band ? { x: 0, y: bandY, w: W, h: band } : null;
  const min = L.phone ? MIN_PX.phone : MIN_PX.desk, g = L.chat;
  L.roles = [
    { role: "prompt", px: g.TEXT.px, min: min.read }, { role: "bubble", px: g.px.bubble, min: min.read }, { role: "card label", px: g.px.label, min: min.read },
    { role: "thread title", px: g.px.head, min: min.chrome }, { role: "thread subtitle", px: g.px.sub, min: min.chrome }, { role: "button", px: g.px.gen, min: min.chrome },
    { role: "tagline", px: L.end.taglinePx, min: min.read }, { role: "install lines", px: L.end.monoPx, min: min.read }, { role: "footer", px: L.end.footerPx, min: min.chrome },
    { role: "corner mark", px: L.bug.px, min: min.chrome }, { role: "feature words", px: L.split.wordsPx, min: min.type * 0.75 },
  ];
  const small = L.roles.filter((r) => r.px < r.min - 1e-9);
  if (small.length) throw new Error(`launchLayout ${shape}: ${small.map((r) => `${r.role} would be ${r.px.toFixed(1)} px (phone-safe minimum ${r.min} px)`).join("; ")}${small.some((r) => r.role === "install lines") ? ". Shorten the install line, or ship this shape without it" : ""}`);
  return L;
};

