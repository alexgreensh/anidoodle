import { Gfx, PENCIL, type Ctx, type Env } from "./core";
import type { Film } from "./film";
import { letter } from "./drafting";
import { drawRanunculus } from "./ranunculus";
import { drawKoi } from "./koi";
import { drawPocketWatch } from "./pocketWatch";
import { drawBalloon } from "./balloon";
import { drawWren } from "./wren";
import { drawMoonPhases } from "./moonPhases";
import { drawFox } from "./fox";
import { drawLighthouse } from "./lighthouse";
import { drawMellan } from "./mellan";

// THE STYLE GALLERY. Nine styles, each on its own subject, laid out as a contact sheet.
// The sheet is itself a film drawn by code: every tile is its subject's own pure draw function,
// rendered at full size into an offscreen surface and set down on the sheet, so the gallery is
// exactly as asset-free and as reproducible as the pictures on it. Nothing here is a photograph.

const TILE = 1000, GUT = 44, LAB = 92, HEAD = 150, COLS = 3, ROWS = 3;
const GW = COLS * TILE + (COLS + 1) * GUT, GH = HEAD + ROWS * (TILE + LAB) + (ROWS + 1) * GUT;
const SHEET = "#eee8dc", INKC = "#2a2521", MUTED = "#8a7f72";

const PLATES: { draw: (ctx: Ctx, f: number, env: Env) => void; style: string; subject: string }[] = [
  { draw: drawRanunculus, style: "PENCIL & WATERCOLOUR", subject: "RANUNCULUS" },
  { draw: drawKoi, style: "MARKER COMIC", subject: "KOI" },
  { draw: drawPocketWatch, style: "BALLPOINT SKETCH", subject: "POCKET WATCH" },
  { draw: drawBalloon, style: "CRAYON", subject: "HOT-AIR BALLOON" },
  { draw: drawWren, style: "INK & LINE-WASH", subject: "WREN ON A TWIG" },
  { draw: drawMoonPhases, style: "CHALKBOARD", subject: "PHASES OF THE MOON" },
  { draw: drawFox, style: "CUT-PAPER COLLAGE", subject: "FOX AT DUSK" },
  { draw: drawLighthouse, style: "RISOGRAPH", subject: "LIGHTHOUSE AT SUNSET" },
  { draw: (ctx, f, env) => drawMellan(ctx, f, env, 1), style: "SINGLE-LINE ENGRAVING", subject: "THE MOON, ONE UNBROKEN SPIRAL" },
];

export const drawStyleGallery = (ctx: Ctx, _frame: number, env: Env) => {
  const s = env.scale;
  ctx.setTransform(s, 0, 0, s, 0, 0);
  ctx.fillStyle = SHEET; ctx.fillRect(0, 0, GW, GH);
  // one full-size surface, reused for every plate: each subject draws exactly as it does alone
  const sub: Env = { W: 1080, H: 1080, scale: s, cache: env.cache, canvas: env.canvas, image: env.image };
  const L = env.canvas(Math.round(1080 * s), Math.round(1080 * s));
  const g = new Gfx(ctx, env, 0, PENCIL);
  PLATES.forEach((p, i) => {
    const col = i % COLS, row = Math.floor(i / COLS), x = GUT + col * (TILE + GUT), y = HEAD + GUT + row * (TILE + LAB + GUT);
    L.ctx.setTransform(1, 0, 0, 1, 0, 0); L.ctx.globalAlpha = 1; L.ctx.globalCompositeOperation = "source-over"; L.ctx.clearRect(0, 0, L.canvas.width, L.canvas.height);
    p.draw(L.ctx, 0, sub);
    // the print, lying on the sheet: a soft shadow under it, a hairline edge
    ctx.setTransform(s, 0, 0, s, 0, 0);
    ctx.fillStyle = "rgba(60,45,30,0.10)"; ctx.fillRect(x + 6, y + 9, TILE, TILE); ctx.fillStyle = "rgba(60,45,30,0.08)"; ctx.fillRect(x + 2, y + 3, TILE, TILE);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(L.canvas as CanvasImageSource, 0, 0, L.canvas.width, L.canvas.height, x, y, TILE, TILE);
    ctx.strokeStyle = "rgba(42,37,33,0.35)"; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
    // the caption, lettered like a contact sheet: number, the hand, then the subject
    letter(g, String(i + 1).padStart(2, "0"), x, y + TILE + 30, { cap: 26, color: MUTED, seed: 900 + i, w: 2.2, opacity: 0.95 });
    letter(g, p.style, x + 64, y + TILE + 30, { cap: 26, color: INKC, seed: 910 + i, w: 2.4, opacity: 0.95 });
    letter(g, p.subject, x + 64, y + TILE + 66, { cap: 17, color: MUTED, seed: 920 + i, w: 1.6, opacity: 0.9 });
  });
  letter(g, "ANIDOODLE  /  NINE STYLES TO CHOOSE FROM", GUT, 52, { cap: 46, color: INKC, seed: 1, w: 3.2, opacity: 0.95 });
  letter(g, "EVERY MARK DRAWN IN CODE. EVERY PLATE REBUILDS PIXEL FOR PIXEL FROM ITS OWN SOURCE.", GUT, 118, { cap: 19, color: MUTED, seed: 2, w: 1.7, opacity: 0.9 });
};

export const styleGallery: Film = {
  meta: { title: "anidoodle · style gallery", W: GW, H: GH, fps: 30, bpm: 120, durationFrames: 1 },
  assets: { images: {} },
  shots: [{ id: "gallery", start: 0, end: 1, draw: drawStyleGallery }],
};
