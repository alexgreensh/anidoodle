// MIRA IN EVERY HAND: the sheet. Nine tiles, one pose, one camera, one character module; under
// each tile the identity result for THAT hand (features that survived, palette roles inside
// their hue families, and for the grid hands the silhouette IoU). Tiles are drawn at full size by
// their own draw functions into an offscreen surface and set down, exactly as the style gallery.
import { GRAPHITE, Gfx, PENCIL, type Ctx, type Env } from "./core";
import type { Film } from "./film";
import { letter } from "./drafting";
import { HANDS, TH, TW, everyScene } from "./miraTile";
import { MIRA_FEATURES, MIRA_ROLES } from "./characters/mira";
import { MIRA_BRICK, MIRA_MARKER, MIRA_PENCIL, MIRA_PIXEL, MIRA_RISO, MIRA_SCRATCH, MIRA_STORYBOOK, MIRA_SUMI, MIRA_WOODCUT } from "./characters/mira/palettes";
import { gridFeatures, sceneFeatures } from "./character/identity";
import { paletteChecks, risoColour } from "./character/check";
import { DRUM } from "./character/render/riso";
import { pixelGrid } from "./character/render/pixel";
import { brickGrid } from "./character/render/brick";

const GUT = 44, LAB = 190, HEAD = 230, COLS = 3;
const W = COLS * TW + (COLS + 1) * GUT, H = HEAD + 3 * (TH + LAB) + 4 * GUT, SHEET = "#ece6da", MUTED = "#7a7066";

// the colour each hand actually puts down for each role
export const HAND_COLOURS = (): Record<string, Record<string, string>> => {
  const drum = Object.fromEntries(Object.entries(DRUM).map(([k, v]) => [k, v.col]));
  const base = (p: Record<string, { base: string }>) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v.base]));
  const ramp0 = (p: Record<string, [string, string]>) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v[0]]));
  return {
    woodcut: MIRA_WOODCUT, brick: ramp0(MIRA_BRICK.roles), pixel: ramp0(MIRA_PIXEL.roles), scratch: { ...MIRA_SCRATCH, hair: MIRA_SCRATCH.hair },
    pencil: base(MIRA_PENCIL), sumi: { ...Object.fromEntries(Object.entries(MIRA_SUMI).map(([k, v]) => [k, v[0]])), hair: "#3a2a24", glasses: "#c8412c" },
    marker: base(MIRA_MARKER), riso: Object.fromEntries(Object.entries(MIRA_RISO).map(([k, v]) => [k, risoColour(v.inks, drum)])), storybook: base(MIRA_STORYBOOK),
  };
};
export const handIdentity = (id: string) => {
  const s = everyScene(), grid = id === "pixel" ? pixelGrid(s, TW, TH, 10) : id === "brick" ? brickGrid(s, TW, TH, 15) : null;
  const feats = grid ? gridFeatures(grid, s) : sceneFeatures(s, MIRA_FEATURES);
  const cols = HAND_COLOURS()[id], roles = Object.fromEntries(Object.entries(MIRA_ROLES).filter(([r]) => cols[r])) as typeof MIRA_ROLES;
  const pal = paletteChecks("mira", roles, { [id]: cols });
  return { feats, pal };
};

export const drawMiraEveryHand = (ctx: Ctx, _f: number, env: Env) => {
  const s = env.scale; ctx.setTransform(s, 0, 0, s, 0, 0); ctx.fillStyle = SHEET; ctx.fillRect(0, 0, W, H);
  const sub: Env = { W: TW, H: TH, scale: s, cache: env.cache, canvas: env.canvas, image: env.image }, L = env.canvas(Math.round(TW * s), Math.round(TH * s)), g = new Gfx(ctx, env, 0, PENCIL);
  const scene = everyScene();
  HANDS.forEach((h, i) => {
    const col = i % COLS, row = Math.floor(i / COLS), x = GUT + col * (TW + GUT), y = HEAD + GUT + row * (TH + LAB + GUT);
    L.ctx.setTransform(1, 0, 0, 1, 0, 0); L.ctx.globalAlpha = 1; L.ctx.globalCompositeOperation = "source-over"; L.ctx.clearRect(0, 0, L.canvas.width, L.canvas.height);
    h.draw(L.ctx, sub, scene);
    ctx.setTransform(s, 0, 0, s, 0, 0); ctx.fillStyle = "rgba(60,45,30,0.12)"; ctx.fillRect(x + 6, y + 9, TW, TH);
    ctx.imageSmoothingEnabled = h.id !== "pixel"; ctx.drawImage(L.canvas as CanvasImageSource, 0, 0, L.canvas.width, L.canvas.height, x, y, TW, TH); ctx.imageSmoothingEnabled = true;
    ctx.strokeStyle = "rgba(42,37,33,0.35)"; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, TW - 1, TH - 1);
    const idn = handIdentity(h.id), okF = idn.feats.filter((f) => f.ok).length, okP = idn.pal.filter((p) => p.ok).length;
    letter(g, `${String(i + 1).padStart(2, "0")}  ${h.name}`, x, y + TH + 26, { cap: 28, color: GRAPHITE, seed: 900 + i, w: 2.6 });
    letter(g, h.note.toUpperCase(), x, y + TH + 70, { cap: 15, color: MUTED, seed: 920 + i, w: 1.5 });
    letter(g, `IDENTITY ${okF}/${idn.feats.length}   PALETTE ROLES ${okP}/${idn.pal.length} IN FAMILY`, x, y + TH + 104, { cap: 17, color: okF === idn.feats.length && okP === idn.pal.length ? "#3d6b3a" : "#b3372a", seed: 940 + i, w: 1.8 });
    const miss = idn.feats.filter((f) => !f.ok).map((f) => f.feature), iou = idn.feats.find((f) => f.feature === "silhouette");
    letter(g, (miss.length ? "MISSING: " + miss.join(", ").toUpperCase() : "ALL FEATURES PRESENT") + (iou ? `   ${iou.got.toUpperCase()}` : "   SAME SCENE GEOMETRY"), x, y + TH + 138, { cap: 14, color: MUTED, seed: 960 + i, w: 1.4 });
  });
  letter(g, "MIRA IN EVERY HAND", GUT, 60, { cap: 60, color: GRAPHITE, seed: 1, w: 4.6 });
  letter(g, "ONE CHARACTER MODULE, ONE POSE, ONE CAMERA. EACH HAND MAKES HER IN ITS OWN MARKS; BRICKS AND PIXELS REBUILD HER IN THEIR OWN UNITS.", GUT, 150, { cap: 19, color: MUTED, seed: 2, w: 1.7 });
};
export const miraEveryHand: Film = { meta: { title: "Mira in every hand", W, H, fps: 30, bpm: 120, durationFrames: 1 }, assets: { images: {} }, shots: [{ id: "sheet", start: 0, end: 1, draw: drawMiraEveryHand }] };
