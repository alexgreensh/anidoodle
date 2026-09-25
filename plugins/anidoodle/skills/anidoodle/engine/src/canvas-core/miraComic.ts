// MIRA, MARKER COMIC. The same character module as the storybook sheet, in koi.ts's hand: flat
// cels, hard shadows, a brush-marker contour that swells away from the light. One panel: she is
// up on her crate, low angle, screwing a bulb back into the lamp that went out. Posed, not redrawn.
import { Gfx, PENCIL, type Ctx, type Env, type P } from "./core";
import type { Film } from "./film";
import { V3, add, camera, lensPx, project } from "./character/math3";
import { order, toPart } from "./character/build";
import { renderMarker, COMIC_INK } from "./character/render/marker";
import { blob, fillShape, ink, smooth } from "./gallery";
import { letter } from "./drafting";
import { mira } from "./characters/mira";
import { MIRA_MARKER } from "./characters/mira/palettes";
import { crate, reachOnCrate, screwdriver } from "./characters/mira/poses";
import { rng } from "./core";

const W = 1080, H = 1350;
const PAL = { ...MIRA_MARKER, crate: { base: "#c7773f", shade: "#8e4a20" }, toolRed: { base: "#ee3524", shade: "#b0170c" } };

export const drawMiraComic = (ctx: Ctx, frame: number, env: Env) => {
  const g = new Gfx(ctx, env, frame, PENCIL), yaw = -35;
  ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0);
  const bulb: V3 = [-0.02, 1.9, 0.26];
  const p = reachOnCrate(yaw, add(bulb, [0.0, -0.1, 0.0]));
  // low angle, 30 mm: the crate and boots big, the head small against the ceiling
  const cam = camera([0.62, 0.5, 1.6], [0.02, 1.18, 0.05], lensPx(26, W), W * 0.5, H * 0.5);
  // ---- the room: a flat cel wall, a halftone burst behind her, the lamp on its cord
  g.group("plain", () => {
    fillShape(g, [[0, 0], [W, 0], [W, H], [0, H]], "#7fd3e8");
    const r = rng(9), c = project(cam, bulb);
    for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2 + r() * 0.1, a2 = a + 0.08; fillShape(g, [[c.x, c.y], [c.x + Math.cos(a) * 1600, c.y + Math.sin(a) * 1600], [c.x + Math.cos(a2) * 1600, c.y + Math.sin(a2) * 1600]], "#b6ecf5", 0.8); }
    const far = [[-4, 0, -2.5], [4, 0, -2.5]].map((q) => { const s = project(cam, q as V3); return [s.x, s.y] as P; }), fl: P[] = [...far, [W + 20, H + 20], [-20, H + 20]]; // the floor runs from its far edge to under the lens
    fillShape(g, fl, "#e0845a"); fillShape(g, fl.map(([x, y]) => [x, y + 6] as P), "#c96a45", 0.5);
    // the cord and the lamp shade
    const top = project(cam, [bulb[0], 3, bulb[2]]), socket = project(cam, add(bulb, [0, 0.09, 0])), b = project(cam, bulb);
    ink(g, [[top.x, top.y], [socket.x, socket.y]], COMIC_INK, { w: 5, shadow: 0 });
    const shade = smooth([[socket.x - 70, socket.y + 34], [socket.x - 36, socket.y - 18], [socket.x + 36, socket.y - 18], [socket.x + 70, socket.y + 34]], false, 8);
    fillShape(g, [...shade, [socket.x, socket.y + 44]], "#2f3f86"); ink(g, shade, COMIC_INK, { w: 6, shadow: 0.6 });
    fillShape(g, blob(b.x, b.y + 6, 30, 36, 3, 0.05, 14), "#fff5b8"); ink(g, blob(b.x, b.y + 6, 30, 36, 3, 0.05, 14), COMIC_INK, { w: 5, closed: true, shadow: 0.6 });
  });
  // ---- Mira and her crate, one scene, painted far to near
  const s = mira.toScene(p, cam), props = [...crate(yaw), ...screwdriver(p)].map((bp) => toPart(cam, bp));
  renderMarker(g, { ...s, parts: order([...s.parts, ...props]) }, PAL, { weight: 1.1 });
  // ---- the balloon and the panel
  g.group("plain", () => {
    const bx = 70, by = 70, bw = 470, bh = 150, tail: P[] = [[bx + 330, by + bh - 6], [bx + 420, by + bh + 90], [bx + 380, by + bh - 4]];
    fillShape(g, blob(bx + bw / 2, by + bh / 2, bw / 2, bh / 2, 21, 0.03, 20), "#ffffff"); fillShape(g, tail, "#ffffff");
    ink(g, blob(bx + bw / 2, by + bh / 2, bw / 2, bh / 2, 21, 0.03, 20), COMIC_INK, { w: 5, closed: true, shadow: 0.5 });
    ink(g, [tail[0], tail[1], tail[2]], COMIC_INK, { w: 4.5, shadow: 0.3, taper: [0.1, 0.1] });
  });
  letter(g, "ALMOST...", 140, 104, { cap: 40, color: COMIC_INK, seed: 5, w: 5.2, opacity: 1 });
  letter(g, "ONE MORE TURN", 120, 158, { cap: 30, color: COMIC_INK, seed: 6, w: 4.6, opacity: 1 });
  g.group("plain", () => { const c = g.cur; g.touch(0, 0, W, H); c.strokeStyle = COMIC_INK; c.lineWidth = 16; c.strokeRect(8, 8, W - 16, H - 16); });
  g.paper("paper", 0.1);
};
export const miraComic: Film = { meta: { title: "Mira, marker comic", W, H, fps: 30, bpm: 120, durationFrames: 1 }, assets: { images: {} }, shots: [{ id: "panel", start: 0, end: 1, draw: drawMiraComic }] };
