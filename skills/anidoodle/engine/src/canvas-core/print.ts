// Print Bit (risograph) on the portable canvas core. Same shapes as proof-4's Print panel.
// Each drum is drawn on its own layer, eaten by pinholes and mottle (texture tiles), and
// overprinted with `multiply` at its own registration offset. The hand-cut wobble that the
// SVG build got from a displacement filter is baked into the geometry here.
import { Ctx, Env, Gfx, P, RISOLINE, arc, displace, halftone, heart, oval, poly, sample, softBox, tube } from "./core";

const INK = { pink: "#ff48b0", blue: "#0078bf", yellow: "#ffd400" }, PAPER = "#f5efe2";
const cut = (pts: P[]) => displace(displace(pts, 2.2, 0.07, 2, 6), 0.9, 0.45, 1, 9); // scissors, not a plotter: a slow wander plus a fine nibble
const smooth = (pts: P[], per = 8) => cut(sample(pts, true, Math.max(per, 10)));
const dense = (pts: P[]) => cut(poly(pts, 6)); // straight-edged shapes still need vertices to wobble

export const drawPrint = (ctx: Ctx, frame: number, env: Env) => {
  const g = new Gfx(ctx, env, frame, RISOLINE), W = env.W, H = env.H;
  ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); ctx.fillStyle = PAPER; ctx.fillRect(0, 0, W, H);
  const fill = (pts: P[], color: string, alpha = 1) => g.fill(pts, color, alpha);
  const dots = (b: { x0: number; y0: number; x1: number; y1: number }, pitch: number, ang: number, tone: (x: number, y: number) => number, color: string, clip?: P[]) => {
    const c = g.cur; g.touch(b.x0 - 10, b.y0 - 10, b.x1 + 10, b.y1 + 10); c.save(); if (clip) { g.path(c, clip); c.clip(); } c.fillStyle = color; c.beginPath();
    halftone(b, pitch, ang, tone).forEach(([x, y, r]) => { const [q] = cut([[x, y]]); c.moveTo(q[0] + r, q[1]); c.arc(q[0], q[1], r, 0, Math.PI * 2); }); c.fill(); c.restore();
  };
  const drum = (off: P, fn: () => void) => g.group("plain", fn, { blend: "multiply", off, textures: ["risoSpeck", "risoMottle"] });
  const lit = (cx: number, cy: number, r: number, k = 0.8, base = 0.06) => (x: number, y: number) => base + k * Math.max(0, ((x - cx) * 0.6 + (y - cy) * 0.8) / r);

  const headP: P[] = softBox(280, 210, 246, 182, 4.2, 18).map(([x, y], i) => [x + [2, -1, 0, 3, -2][i % 5], y + [-1, 2, 1, -2, 0][i % 5]] as P);
  const bodyP: P[] = softBox(280, 365, 138, 108, 5, 16).map(([x, y], i) => [x + [1, -2, 2][i % 3], y + [0, 1, -1][i % 3]] as P);
  const head = smooth(headP), body = smooth(bodyP), sun = smooth(oval(300, 236, 192, 190, 14)), quarter = cut([[0, 560], ...arc(0, 560, 152, 152, -Math.PI / 2, 0, 24)]);
  const keyShaft = smooth(poly([[344, 361], [386, 359], [386, 373], [344, 374]], 2), 3), keyA = smooth(oval(398, 351, 18, 19, 8)), keyB = smooth(oval(399, 386, 19, 18, 8));
  const Y: P = [-4.5, 3.5], K: P = [4.5, -3], B: P = [0, 0];

  // drum 1: yellow
  drum(Y, () => {
    dots({ x0: 100, y0: 40, x1: 500, y1: 430 }, 7.5, 28, (_x, y) => 0.2 + 0.6 * ((y - 46) / 380), INK.yellow, sun);
    fill(head, INK.yellow, 0.92); fill(smooth(oval(326, 50, 27, 26, 9)), INK.yellow); fill(keyShaft, INK.yellow); fill(keyA, INK.yellow); fill(keyB, INK.yellow);
    [0, 1, 2, 3, 4].forEach((i) => fill(smooth(poly([[40, 400 + i * 18], [136 - i * 3, 399 + i * 18], [136 - i * 3, 407 + i * 18], [40, 408 + i * 18]], 3), 3), INK.yellow));
  });
  // drum 2: fluorescent pink
  drum(K, () => {
    fill(cut(arc(158.5, 215, 35, 36, Math.PI / 2, (3 * Math.PI) / 2, 18)), INK.pink); fill(cut(arc(401.5, 215, 35, 36, -Math.PI / 2, Math.PI / 2, 18)), INK.pink);
    fill(smooth(oval(204, 252, 18, 16, 8)), INK.pink); fill(smooth(oval(356, 252, 17, 17, 8)), INK.pink); fill(smooth(oval(440, 236, 27, 26, 9)), INK.pink); fill(smooth(oval(176, 420, 24, 25, 9)), INK.pink); fill(smooth(oval(331, 46, 17, 17, 8)), INK.pink);
    fill(cut([...arc(226, 500, 30, 30, Math.PI, 1.5 * Math.PI, 10), [230, 470], [230, 500]]), INK.pink); fill(cut([...arc(334, 500, 30, 30, 0, -0.5 * Math.PI, 10), [330, 470], [330, 500]]), INK.pink);
    dots({ x0: 150, y0: 110, x1: 410, y1: 310 }, 6.5, 62, lit(260, 190, 150, 1.0, 0), INK.pink, head); // the head turns: pink screen over yellow = orange
    fill(dense([[450, 470], [510, 470], [480, 416]]), INK.pink, 0.9);
    dots({ x0: 100, y0: 300, x1: 500, y1: 430 }, 7.5, 62, (_x, y) => 0.55 * Math.max(0, (y - 330) / 100), INK.pink, sun);
    dots({ x0: 50, y0: 76, x1: 118, y1: 144 }, 6.5, 62, (x, y) => (Math.hypot(x - 84, y - 110) > 34 ? 0 : 0.15 + 0.6 * ((y - 76) / 68)), INK.pink);
  });
  // the body is knocked out of the sun, so the heart and screen print on clean paper
  g.group("plain", () => { fill(body, PAPER); fill(smooth(oval(280, 366, 80, 64, 10)), PAPER); });
  drum(K, () => { fill(smooth(heart(280, 368, 24), 5), INK.pink); fill(keyShaft, INK.pink, 0.9); fill(keyA, INK.pink, 0.9); fill(keyB, INK.pink, 0.9); });
  // drum 3: blue, the key drum
  drum(B, () => {
    dots({ x0: 0, y0: 400, x1: 160, y1: 560 }, 7, 28, (x, y) => 0.12 + 0.75 * (1 - Math.hypot(x, y - 560) / 152), INK.blue, quarter);
    [[[232, 330], [206, 370], [182, 408]], [[330, 330], [366, 326], [394, 316]], [[394, 316], [416, 284], [434, 250]]].forEach((c) => fill(smooth(tube(c as P[], 12, 12, true), 4), INK.blue));
    fill(smooth(poly([[238, 414], [264, 415], [263, 474], [238, 473]], 2), 3), INK.blue); fill(smooth(poly([[296, 415], [322, 414], [322, 473], [297, 474]], 2), 3), INK.blue);
    fill(cut([...arc(230, 500, 34, 34, Math.PI, 1.5 * Math.PI, 10), [270, 466], [270, 500]]), INK.blue); fill(cut([...arc(330, 500, 34, 34, 0, -0.5 * Math.PI, 10), [290, 466], [290, 500]]), INK.blue);
    fill(body, INK.blue); const c = g.cur; c.globalCompositeOperation = "destination-out"; fill(dense([[245, 337], [315, 335], [316, 397], [244, 396]]), "#000"); c.globalCompositeOperation = "source-over"; // the screen window
    fill(smooth(oval(232, 204, 19, 20, 9)), INK.blue); fill(smooth(oval(328, 203, 20, 19, 9)), INK.blue);
    fill(cut([[251, 246], [266, 247.6], [280, 248], [295, 247], [309, 245], ...arc(280, 245.5, 29, 28, 0.08, Math.PI - 0.08, 14)]), INK.blue);
    [[462, 196], [484, 222], [494, 256]].forEach(([x, y]) => fill(smooth(oval(x, y, 5, 5, 6)), INK.blue));
    [[70, 250], [96, 276], [60, 300]].forEach(([x, y]) => fill(dense([[x - 2, y - 10], [x + 2, y - 10], [x + 2, y - 2], [x + 10, y - 2], [x + 10, y + 2], [x + 2, y + 2], [x + 2, y + 10], [x - 2, y + 10], [x - 2, y + 2], [x - 10, y + 2], [x - 10, y - 2], [x - 2, y - 2]]), INK.blue));
  });
  // the body turns too: pink screen over blue = purple
  drum(K, () => dots({ x0: 205, y0: 305, x1: 355, y1: 425 }, 6.5, 62, lit(260, 350, 90, 0.9, 0), INK.pink, body));
  // the key drawing, in blue litho crayon
  drum(B, () => {
    g.pen(headP, { closed: true, w: 3.6, color: INK.blue, seed: 3, wobble: 0.5 }); g.pen(poly([[290, 120], [272, 104], [304, 92], [276, 78], [306, 66], [322, 56]], 2), { w: 4.2, color: INK.blue, seed: 4, wobble: 0.4 });
    g.pen([[182, 150], [176, 190], [180, 226]], { w: 2.2, color: INK.blue, seed: 5, opacity: 0.8 }); g.pen([[196, 136], [188, 160]], { w: 2.2, color: INK.blue, seed: 6, opacity: 0.8 });
  });
  // paper showing through the eyes, roller banding, and what the printer leaves in the margin
  g.group("plain", () => { const c = g.cur; c.fillStyle = PAPER; [[225, 197, 6], [321, 196, 6.4]].forEach(([x, y, r]) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }); });
  g.group("plain", () => { const c = g.cur; c.fillStyle = "#e9e0cc"; [[214, 5], [468, 7]].forEach(([y, h]) => c.fillRect(0, y, W, h)); }, { blend: "multiply", alpha: 0.22 });
  g.group("plain", () => { const c = g.cur; c.strokeStyle = "#1b1b1b"; c.lineWidth = 1.1; [[24, 24], [536, 24], [24, 536], [536, 536]].forEach(([x, y]) => { c.beginPath(); c.arc(x, y, 7, 0, Math.PI * 2); c.moveTo(x - 12, y); c.lineTo(x + 12, y); c.moveTo(x, y - 12); c.lineTo(x, y + 12); c.stroke(); }); }, { alpha: 0.9 });
  drum(B, () => { [[232, INK.yellow], [262, INK.pink], [292, INK.blue]].forEach(([x, col]) => { const c = g.cur; c.fillStyle = col as string; c.fillRect(x as number, 530, 26, 14); }); });
  g.paper("paper", 0.26); g.paper("coldpress", 0.1); g.paper("coldpress", 0.14);
};
