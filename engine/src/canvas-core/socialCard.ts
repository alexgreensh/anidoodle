import { Gfx, PENCIL, line, type Ctx, type Env, type P } from "./core";
import type { Film } from "./film";
import { letter } from "./drafting";
import { TAIL, WORD, inkStroke, outlineOf, place, type Nib } from "./lettering";
import { trace } from "./gallery";
import { drawKoi } from "./koi";
import { drawLighthouse } from "./lighthouse";
import { drawWren } from "./wren";
import { drawFox } from "./fox";
import { drawMoonPhases } from "./moonPhases";
import { drawBalloon } from "./balloon";

// THE SOCIAL CARD. The repository's link preview, 1280 x 640, drawn by the engine it advertises.
// Left, the name written in pointed-pen script on a letterer's card, then the promise in drafted
// capitals, and one sticky note that is the whole idea. Right, six prints from the style gallery dropped on the desk, each one its module's
// own draw function, so the preview is exactly as asset-free as everything it shows.

const W = 1280, H = 640, DESK = "#efe7d9", CARD = "#fcf9f2", IRON = "#2a1c14", MUTED = "#7d7064", LEAD = "#9a8f84", RED = "#b8432f";

const NIB: Nib = { em: 60, slant: 0.3, origin: [138, 214], hair: 0.75, shade: 5.4 };
const STROKES = WORD.map((s, i) => inkStroke(NIB, s, TAIL[i]));

type Print = { draw: (ctx: Ctx, f: number, env: Env) => void; label: string; at: P; size: number; turn: number };
const PRINTS: Print[] = [
  { draw: drawKoi, label: "MARKER COMIC", at: [742, 166], size: 200, turn: -3.2 },
  { draw: drawLighthouse, label: "RISOGRAPH", at: [952, 150], size: 200, turn: 2.1 },
  { draw: drawMoonPhases, label: "CHALKBOARD", at: [1146, 184], size: 180, turn: 4.2 },
  { draw: drawFox, label: "CUT PAPER", at: [760, 446], size: 200, turn: 2.6 },
  { draw: drawWren, label: "INK & WASH", at: [966, 458], size: 200, turn: -2.4 },
  { draw: drawBalloon, label: "CRAYON", at: [1150, 440], size: 172, turn: -4.6 },
];

const card = (ctx: Ctx, cx: number, cy: number, w: number, h: number, deg: number, fill: string, lift = 1) => {
  ctx.save(); ctx.translate(cx, cy); ctx.rotate((deg * Math.PI) / 180);
  ctx.fillStyle = `rgba(70,50,30,${0.07 * lift})`; ctx.fillRect(-w / 2 + 7, -h / 2 + 10, w, h);
  ctx.fillStyle = `rgba(70,50,30,${0.09 * lift})`; ctx.fillRect(-w / 2 + 2, -h / 2 + 3, w, h);
  ctx.fillStyle = fill; ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.restore();
};

export const drawSocialCard = (ctx: Ctx, _frame: number, env: Env) => {
  const s = env.scale, g = new Gfx(ctx, env, 0, PENCIL);
  ctx.setTransform(s, 0, 0, s, 0, 0);
  ctx.fillStyle = DESK; ctx.fillRect(0, 0, W, H);

  // the letterer's card, and the pencil guides the word was written between
  card(ctx, 334, 170, 600, 250, -1.4, CARD);
  g.group("ink", () => {
    [1.95, 1, 0].forEach((y, i) => g.pen([place(NIB, [-0.6, y]), place(NIB, [8.9 - y * 0.3, y])], { w: 0.45, color: LEAD, opacity: i === 2 ? 0.5 : 0.3, wobble: 0.2, boil: 0, retrace: false, seed: 40 + i }));
    for (let x = -0.3; x < 8.7; x += 0.66) g.pen([place(NIB, [x, -0.3]), place(NIB, [x, 2.1])], { w: 0.35, color: LEAD, opacity: 0.18, wobble: 0.1, boil: 0, retrace: false, seed: 60 + Math.round(x * 10) });
  });
  g.group("plain", () => {
    const c = g.cur; c.fillStyle = IRON; g.touch(40, 60, 700, 300);
    STROKES.forEach((k) => { trace(c, outlineOf(k)); c.fill(); });
    const d = place(NIB, [2.2, 1.42]); c.beginPath(); c.ellipse(d[0], d[1], 3.8, 3.0, -0.5, 0, Math.PI * 2); c.fill();
  }, { textures: ["draftTooth"] });

  // the promise, in a draftsman's capitals, and what it makes
  letter(g, "HAND-DRAWN ART,", 62, 332, { cap: 38, color: IRON, seed: 3, w: 3.4 });
  letter(g, "WRITTEN AS CODE.", 62, 390, { cap: 38, color: RED, seed: 4, w: 3.4 });
  g.group("ink", () => g.pen(line([64, 458], [470, 452], 3), { w: 1.2, color: IRON, opacity: 0.55, wobble: 0.8, boil: 0, seed: 7 }));
  letter(g, "ILLUSTRATIONS / LOOPS / STICKERS / FILMS", 64, 482, { cap: 15, color: IRON, seed: 5, w: 1.6, opacity: 0.9 });
  letter(g, "NINE STYLES. EVERY MARK IS CODE.", 64, 514, { cap: 15, color: MUTED, seed: 6, w: 1.5, opacity: 0.9 });

  // the prints, each drawn full size by its own module onto a sheet with a margin and a lettered
  // caption, and the whole sheet is then turned and set down on the desk
  const SW = 1200, SH = 1330, M = 60;
  const sub: Env = { W: 1080, H: 1080, scale: s, cache: env.cache, canvas: env.canvas, image: env.image };
  const sheetEnv: Env = { W: SW, H: SH, scale: s, cache: env.cache, canvas: env.canvas, image: env.image };
  const L = env.canvas(Math.round(1080 * s), Math.round(1080 * s)), S = env.canvas(Math.round(SW * s), Math.round(SH * s));
  PRINTS.forEach((p) => {
    L.ctx.setTransform(1, 0, 0, 1, 0, 0); L.ctx.globalAlpha = 1; L.ctx.globalCompositeOperation = "source-over"; L.ctx.clearRect(0, 0, L.canvas.width, L.canvas.height);
    p.draw(L.ctx, 0, sub);
    const sc = S.ctx; sc.setTransform(s, 0, 0, s, 0, 0); sc.globalAlpha = 1; sc.globalCompositeOperation = "source-over";
    sc.fillStyle = "#fdfbf6"; sc.fillRect(0, 0, SW, SH);
    sc.imageSmoothingEnabled = true; sc.imageSmoothingQuality = "high";
    sc.drawImage(L.canvas as CanvasImageSource, 0, 0, L.canvas.width, L.canvas.height, M, M, 1080, 1080);
    const sg = new Gfx(sc, sheetEnv, 0, PENCIL);
    letter(sg, p.label, SW / 2, M + 1080 + 58, { cap: 64, color: MUTED, seed: 30 + Math.round(p.at[0]), w: 6, align: "center", opacity: 0.95 });
    const k = p.size / 1080, w = SW * k, h = SH * k;
    ctx.setTransform(s, 0, 0, s, 0, 0);
    card(ctx, p.at[0], p.at[1], w, h, p.turn, "#fdfbf6", 1.4);
    ctx.save(); ctx.translate(p.at[0], p.at[1]); ctx.rotate((p.turn * Math.PI) / 180);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    ctx.drawImage(S.canvas as CanvasImageSource, 0, 0, S.canvas.width, S.canvas.height, -w / 2, -h / 2, w, h);
    ctx.restore();
  });

  // the whole idea on one sticky note: say what you want, and there it is on the desk
  card(ctx, 540, 582, 236, 82, -3.5, "#f5df72", 1.2);
  g.push(540, 582, 1);
  letter(g, "ASK: A FOX AT DUSK,", -102, -26, { cap: 13, color: IRON, seed: 91, w: 1.45 });
  letter(g, "IN CUT PAPER.", -104, 2, { cap: 13, color: IRON, seed: 92, w: 1.45 });
  g.pop();
  g.group("ink", () => {
    g.pen([[646, 550], [660, 512], [666, 478], [676, 452]], { w: 1.6, color: IRON, opacity: 0.85, wobble: 0.5, boil: 0, seed: 71 });
    g.pen([[662, 456], [676, 452], [676, 467]], { w: 1.6, color: IRON, opacity: 0.85, wobble: 0.3, boil: 0, seed: 72, retrace: false });
  });
  // what it is, for anyone who meets it outside GitHub
  letter(g, "AN OPEN-SOURCE SKILL FOR CLAUDE CODE", 64, 592, { cap: 11, color: MUTED, seed: 8, w: 1.2, opacity: 0.9 });
  g.group("ink", () => {
    const star = (cx: number, cy: number, k: number, seed: number) => { const pts: P[] = []; for (let i = 0; i <= 10; i++) { const t = (i / 10) * Math.PI * 2 - Math.PI / 2, rr = i % 2 ? k * 0.42 : k; pts.push([cx + Math.cos(t) * rr, cy + Math.sin(t) * rr]); } g.pen(pts, { w: 1.1, color: RED, opacity: 0.7, wobble: 0.4, boil: 0, seed }); };
    star(604, 64, 12, 81);
  });

  g.paper("paper", 0.1);
  g.paper("coldpress", 0.12);
};

export const socialCard: Film = {
  meta: { title: "anidoodle · social card", W, H, fps: 30, bpm: 120, durationFrames: 1 },
  assets: { images: {} },
  shots: [{ id: "card", start: 0, end: 1, draw: drawSocialCard }],
};
