// MIRA, RISOGRAPH. The same character module in lighthouse.ts's hand: three drums (yellow,
// fluorescent pink, blue) overprinted by multiply through their own registration, tone as
// halftone screens, knockouts to bare paper, a blue litho-crayon line. A poster: she sits on
// her crate holding a gear up to the light. Her roles are recipes of drums (MIRA_RISO).
import { Gfx, PENCIL, type Ctx, type Env, type P, halftone, oval } from "./core";
import type { Film } from "./film";
import { camera, lensPx, project } from "./character/math3";
import { order, toPart } from "./character/build";
import { renderRiso } from "./character/render/riso";
import { letter } from "./drafting";
import { mira } from "./characters/mira";
import { MIRA_RISO } from "./characters/mira/palettes";
import { crate, gearInPinch, gearToEye } from "./characters/mira/poses";

const W = 1080, H = 1350, PAPER = "#f5efe2";
const RECIPES = { ...MIRA_RISO, crate: { inks: [["pink", 0.45], ["yellow", 0.7], ["blue", 0.12]] as [string, number][], shadeInk: "blue", shadeTone: 0.35 } };

export const drawMiraRiso = (ctx: Ctx, frame: number, env: Env) => {
  const g = new Gfx(ctx, env, frame, PENCIL), yaw = -50;
  ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  const p = gearToEye(yaw), cam = camera([-0.35, 0.75, 2.05], [0.05, 0.56, 0], lensPx(40, W), W * 0.54, H * 0.6);
  const s = mira.toScene(p, cam), props = [...crate(yaw), gearInPinch(p)].map((b) => toPart(cam, b));
  renderRiso(g, env, { ...s, parts: order([...s.parts, ...props]) }, RECIPES, {
    pitch: 6,
    before: (d) => {
      // a pink sun behind her (screened darker toward its lower edge), a blue floor, the title in blue
      const sun = oval(560, 470, 360, 360, 40), c = d.pink; c.save(); c.beginPath(); sun.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.clip(); c.fillStyle = "#000"; c.beginPath();
      halftone({ x0: 180, y0: 100, x1: 940, y1: 850 }, 7, 62, (_x, y) => 0.25 + 0.55 * ((y - 110) / 740)).forEach(([x, y, r]) => { c.moveTo(x + r, y); c.arc(x, y, r, 0, Math.PI * 2); }); c.fill(); c.restore();
      const fy = project(cam, [0, 0, 0]).y, b = d.blue; b.fillStyle = "#000"; b.beginPath();
      halftone({ x0: 0, y0: fy - 30, x1: W, y1: H }, 7, 12, (_x, y) => 0.18 + 0.5 * Math.min(1, (y - fy + 30) / 400)).forEach(([x, y, r]) => { b.moveTo(x + r, y); b.arc(x, y, r, 0, Math.PI * 2); }); b.fill();
      const prev = g.cur; g.cur = b;
      letter(g, "MIRA", 70, 70, { cap: 120, color: "#000", seed: 3, w: 11, opacity: 1 });
      letter(g, "SMALL INVENTOR, BIG IDEAS", 76, 230, { cap: 30, color: "#000", seed: 4, w: 3.4, opacity: 1 });
      g.cur = d.yellow; letter(g, "NO. 1", 880, 1250, { cap: 44, color: "#000", seed: 5, w: 5, opacity: 1 }); g.cur = prev;
      [[980, 120], [920, 190], [1010, 230]].forEach(([x, y]) => { const q: P[] = oval(x, y, 9, 9, 10); b.beginPath(); q.forEach(([a, e], i) => (i ? b.lineTo(a, e) : b.moveTo(a, e))); b.fill(); });
    },
  });
  // what the printer leaves in the margin
  g.group("plain", () => { const c = g.cur; g.touch(0, 0, W, H); c.strokeStyle = "#1b1b1b"; c.lineWidth = 1.1; [[26, 26], [W - 26, 26], [26, H - 26], [W - 26, H - 26]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, 7, 0, Math.PI * 2); c.moveTo(x - 12, y); c.lineTo(x + 12, y); c.moveTo(x, y - 12); c.lineTo(x, y + 12); c.stroke(); }); }, { alpha: 0.9 });
  g.paper("paper", 0.26); g.paper("coldpress", 0.14);
};
export const miraRiso: Film = { meta: { title: "Mira, risograph", W, H, fps: 30, bpm: 120, durationFrames: 1 }, assets: { images: {} }, shots: [{ id: "poster", start: 0, end: 1, draw: drawMiraRiso }] };
