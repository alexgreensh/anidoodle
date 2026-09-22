// Storybook Bit (pencil + watercolour) on the portable canvas core. A transliteration of
// the proof-4 panel (src/roster.tsx Storybook + src/characters.tsx Bit), same seeds, same
// control points, so any difference you see is the MEDIUM, not the drawing.
import { Env, GRAPHITE, Gfx, P, PENCIL, TINT, arc, heart, line, oval, rng, tube, turn, Ctx } from "./core";

const SHADE = { white: "#c9d2e4", rose: "#cf8291", denim: "#52739f", butter: "#d9b24f" };
const at = (o: P, pts: P[]): P[] => pts.map(([x, y]) => [o[0] + x, o[1] + y]);
const dir = (a: P, b: P) => Math.atan2(b[1] - a[1], b[0] - a[0]);
const HEAD: P[] = [[-70, -40], [-52, -58], [-10, -65], [34, -63], [62, -51], [75, -22], [77, 14], [67, 44], [34, 58], [-8, 61], [-46, 56], [-70, 39], [-79, 6], [-78, -20]];
const BODY: P[] = [[-44, -42], [-20, -50], [16, -50], [42, -42], [54, -14], [57, 18], [45, 42], [14, 52], [-16, 52], [-46, 42], [-57, 16], [-54, -16]];
const BOOT: P[] = [[-13, -8], [-14, 6], [-9, 12], [20, 12], [28, 9], [29, 1], [22, -6], [10, -9], [4, -13]];

type Pose = "open" | "rest";
const handShape = (pose: Pose, k: number) => {
  const R = 13 * k, c: P = [15 * k, 0], spec = pose === "open" ? { a: [-0.62, -0.04, 0.54], len: 17, w: 0.3, thumb: [-1.75, 13] } : { a: [-0.46, 0.0, 0.46], len: 10, w: 0.2, thumb: [-1.5, 10] };
  const on = (ang: number, r: number): P => [c[0] + Math.cos(ang) * r, c[1] + Math.sin(ang) * r], pts: P[] = [[0, -7.5 * k], [5 * k, -11 * k]], ta = spec.thumb[0], tl = spec.thumb[1] * k, valleys: P[] = [];
  pts.push(on(ta - 0.34, R), on(ta - 0.16, R + tl * 0.8), on(ta, R + tl), on(ta + 0.2, R + tl * 0.7), on(ta + 0.36, R * 0.98));
  spec.a.forEach((a, i) => { const L = spec.len * k * (i === 1 ? 1.08 : 1); pts.push(on(a - spec.w, R + L * 0.55), on(a - spec.w * 0.5, R + L * 0.95), on(a, R + L), on(a + spec.w * 0.5, R + L * 0.95), on(a + spec.w, R + L * 0.55)); if (i < 2) { const v = on((a + spec.a[i + 1]) / 2, pose === "open" ? R : R + L * 0.42); pts.push(v); valleys.push(v); } });
  pts.push(on(1.15, R), on(1.9, R * 0.98), [5 * k, 11 * k], [0, 7.5 * k]);
  return { pts, valleys, c };
};
const hand = (g: Gfx, wrist: P, angle: number, pose: Pose, seed: number) => {
  const flip = Math.cos(angle) < 0 ? -1 : 1, place = (pts: P[]): P[] => turn(pts.map(([x, y]) => [wrist[0] + x, wrist[1] + y * flip] as P), wrist[0], wrist[1], (angle * 180) / Math.PI);
  const h = handShape(pose, 1), shape = place(h.pts), cuff = place([[-7, -9.5], [3, -10.5], [4, 0], [3, 10.5], [-7, 9.5], [-8, 0]]);
  g.group("paint", () => { g.form(shape, TINT.white, SHADE.white, { seed, light: [-3, -4] }); g.form(cuff, TINT.rose, SHADE.rose, { seed: seed + 1, light: [-2, -3] }); });
  g.group("ink", () => {
    g.pen(shape, { closed: true, w: 2.9, seed: seed + 2, wobble: 0.5, boil: 0.35, taper: 0.5 });
    if (pose === "open") h.valleys.forEach((v, i) => { const inner: P = [v[0] + (h.c[0] - v[0]) * 0.32, v[1] + (h.c[1] - v[1]) * 0.32]; g.pen(place(line(v, inner, 0.5)), { w: 1.5, seed: seed + 3 + i, wobble: 0.3, boil: 0.3, opacity: 0.75, retrace: false }); });
    g.pen(cuff, { closed: true, w: 2.5, seed: seed + 7, wobble: 0.4, boil: 0.3, taper: 0.5 });
    [-0.45, 0.45].forEach((t, i) => g.pen(place(line([-5.5, t * 9], [2, t * 9.6])), { w: 1.6, seed: seed + 8 + i, wobble: 0.2, opacity: 0.65, retrace: false }));
  });
};
const limb = (g: Gfx, from: P, to: P, bend: number, r: number, seed: number) => {
  const mid = line(from, to, bend)[1], shape = tube([from, mid, to], r, r * 0.86, false);
  const along = (t: number): P => { const a = t < 0.5 ? from : mid, b = t < 0.5 ? mid : to, u = t < 0.5 ? t * 2 : (t - 0.5) * 2; return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]; };
  g.group("paint", () => g.form(shape, TINT.white, SHADE.white, { seed, light: [-3, -3] }));
  g.group("ink", () => { g.pen(shape, { closed: true, w: 2.8, seed: seed + 1, wobble: 0.5, boil: 0.35, taper: 0.4 }); [0.2, 0.36, 0.52, 0.68, 0.84].forEach((t, i) => { const p = along(t), q = along(t + 0.04), a = dir(p, q) + Math.PI / 2; g.pen(line([p[0] - Math.cos(a) * r * 0.85, p[1] - Math.sin(a) * r * 0.85], [p[0] + Math.cos(a) * r * 0.85, p[1] + Math.sin(a) * r * 0.85], 2.2), { w: 1.7, seed: seed + 2 + i, wobble: 0.2, opacity: 0.6, retrace: false }); }); });
};

// Bit, lit, waving. Local coordinates, feet at (0,0).
export const drawBit = (g: Gfx, frame: number, seed: number, p: { look: number; tilt: number; lean: number; handL: P; handR: P }) => {
  const { look, tilt, lean, handL, handR } = p, hc: P = [lean * 0.6, -200], bc: P = [0, -86];
  const H = (pts: P[]) => turn(at(hc, pts), hc[0], hc[1], tilt), B = (pts: P[]) => turn(at(bc, pts), 0, 0, lean * 0.12);
  const coil: P[] = [[28, -64], [41, -71], [27, -80], [43, -88], [30, -97], [45, -105], [38, -114]], bulbC: P = [39, -130], bulb = H([bulbC])[0];
  const keyTurn = Math.abs(Math.cos(frame * 0.22)), sL = B([[-50, -28]])[0], sR = B([[50, -28]])[0], footR: P = [28, -12], bootR = at(footR, BOOT), bootL = at([-28, -12], BOOT.map(([x, y]) => [-x, y] as P));
  g.group("ink", () => g.hatch(-62, 8, 130, { n: 15, len: 12, angle: -0.45, seed: seed + 1, opacity: 0.32 }));
  // wind-up key
  g.group("paint", () => { g.form(oval(90, -111, 9, 13 * keyTurn + 3, 8), TINT.butter, SHADE.butter, { seed: seed + 2, light: [-2, -3] }); g.form(oval(90, -81, 9, 13 * keyTurn + 3, 8), TINT.butter, SHADE.butter, { seed: seed + 3, light: [-2, -3] }); });
  g.group("ink", () => {
    g.pen(line([52, -94], [84, -96], 1), { w: 3.6, seed: seed + 4, wobble: 0.4 }); g.pen(oval(90, -96, 5, 5, 7), { closed: true, w: 2.4, seed: seed + 7, wobble: 0.2, taper: 0.4 });
    g.pen(oval(90, -111, 4, Math.max(1.5, 6 * keyTurn), 7), { closed: true, w: 1.7, seed: seed + 8, wobble: 0.2, taper: 0.3, retrace: false }); g.pen(oval(90, -81, 4, Math.max(1.5, 6 * keyTurn), 7), { closed: true, w: 1.7, seed: seed + 9, wobble: 0.2, taper: 0.3, retrace: false });
    g.pen(oval(90, -111, 9, 13 * keyTurn + 3, 8), { closed: true, w: 2.6, seed: seed + 5, wobble: 0.3, taper: 0.5 }); g.pen(oval(90, -81, 9, 13 * keyTurn + 3, 8), { closed: true, w: 2.6, seed: seed + 6, wobble: 0.3, taper: 0.5 });
  });
  // legs + boots
  limb(g, [-24, -40], [-27, -16], -2, 7.5, seed + 10); limb(g, [24, -40], [27, -16], 2, 7.5, seed + 20);
  g.group("paint", () => { g.form(bootL, TINT.denim, SHADE.denim, { seed: seed + 30, light: [-3, -4] }); g.form(bootR, TINT.denim, SHADE.denim, { seed: seed + 31, light: [-3, -4] }); });
  g.group("ink", () => [bootL, bootR].forEach((b, i) => {
    const o: P = i ? footR : [-28, -12], sx = i ? 1 : -1, M = (pts: P[]) => pts.map(([x, y]) => [o[0] + x * sx, o[1] + y] as P);
    g.pen(b, { closed: true, w: 3, seed: seed + 32 + i, wobble: 0.5, boil: 0.35, taper: 0.5 }); g.pen(M([[-13, 7], [6, 8], [28, 6]]), { w: 2, seed: seed + 34 + i, wobble: 0.3, opacity: 0.75, retrace: false });
    g.pen(M(arc(18, 3, 10, 10, 1.05 * Math.PI, 1.75 * Math.PI, 5)), { w: 2, seed: seed + 36 + i, wobble: 0.3, opacity: 0.7, retrace: false });
    [0, 1].forEach((j) => g.pen(M(line([-3 + j * 6, -7 + j], [3 + j * 6, -3 + j])), { w: 1.7, color: "#f4efe6", seed: seed + 38 + i * 2 + j, wobble: 0.2, retrace: false }));
  }));
  // arms, hands
  limb(g, sL, handL, -14, 7.5, seed + 40); limb(g, sR, handR, 14, 7.5, seed + 50);
  hand(g, handL, dir(line(sL, handL, -14)[1], handL), "rest", seed + 60); hand(g, handR, dir(line(sR, handR, 14)[1], handR), "open", seed + 80);
  // body
  const screen = B(at([0, -12], [[-27, -19], [0, -22], [27, -19], [29, 0], [27, 17], [0, 20], [-27, 17], [-29, 0]]));
  g.group("paint", () => {
    g.form(B(BODY), TINT.white, SHADE.white, { seed: seed + 100, light: [-7, -8], hi: [-24, -112, 12, 7, -30] }); g.form(screen, TINT.glow, "#f0c868", { seed: seed + 101, light: [-3, -3] });
    const flat = { dx: 0, dy: 0, shrink: 1, rim: false };
    g.wash(B(heart(0, -13, 10)), TINT.blush, { alpha: 0.95, seed: seed + 102, ...flat }); g.wash(B(arc(0, 30, 15, 14, Math.PI, 2 * Math.PI, 7)), "#fffaf0", { alpha: 0.95, seed: seed + 103, ...flat }); g.wash(B(arc(7, 30, 7, 9, Math.PI, 2 * Math.PI, 5)), TINT.sage, { alpha: 0.75, seed: seed + 104, ...flat });
  });
  g.group("ink", () => {
    g.pen(B(BODY), { closed: true, w: 4, seed: seed + 110, wobble: 0.8, boil: 0.4, taper: 0.6 }); g.pen(screen, { closed: true, w: 2.6, seed: seed + 111, wobble: 0.4, boil: 0.3, taper: 0.5 });
    g.pen(B(at([0, -12], [[-21, -13], [0, -16], [21, -13]])), { w: 1.6, seed: seed + 112, wobble: 0.3, opacity: 0.45, retrace: false }); g.pen(B(heart(0, -13, 10)), { closed: true, w: 1.9, color: "#c9566b", seed: seed + 113, wobble: 0.3, taper: 0.4 });
    g.pen(B(arc(0, 30, 15, 14, Math.PI, 2 * Math.PI, 8)), { w: 2.2, seed: seed + 114, wobble: 0.3 }); g.pen(B(line([-16, 30], [16, 30])), { w: 2.2, seed: seed + 115, wobble: 0.3 }); g.pen(B(line([0, 29], [9, 19])), { w: 2.4, color: "#c9566b", seed: seed + 116, wobble: 0.2, retrace: false });
    [[-43, -34], [43, -34], [-47, 34], [47, 34]].forEach(([x, y], i) => { const c = B([[x * 0.9, y]])[0]; g.pen(oval(c[0], c[1], 2.6, 2.6, 6), { closed: true, w: 1.6, seed: seed + 117 + i, wobble: 0.2, opacity: 0.7, retrace: false }); });
    const hp = B([[24, 30]])[0]; g.hatch(hp[0], hp[1], 24, { n: 5, len: 13, angle: -0.9, seed: seed + 125, opacity: 0.35 });
  });
  const collar = at([lean * 0.3, -140], [[-24, -7], [0, -10], [24, -7], [26, 3], [0, 8], [-26, 3]]);
  g.group("paint", () => g.form(collar, "#e6dfd6", "#b9b0a6", { seed: seed + 130, light: [-2, -3] })); g.group("ink", () => g.pen(collar, { closed: true, w: 2.6, seed: seed + 131, wobble: 0.4, taper: 0.5 }));
  // antenna + bulb
  g.group("plain", () => g.glow(bulb[0], bulb[1], 46, TINT.glow, 0.35 * (0.7 + 0.2 * Math.sin(frame * 0.2)) * 2));
  g.group("paint", () => g.form(H(oval(bulbC[0], bulbC[1], 13, 15, 9)), "#fff0b0", "#f2c65a", { seed: seed + 140, light: [-3, -4], hi: [bulb[0] - 5, bulb[1] - 6, 4, 2.4] }));
  g.group("ink", () => {
    g.pen(H(coil), { w: 2.8, seed: seed + 141, wobble: 0.5, boil: 0.5, taper: 0.4 }); g.pen(H(oval(bulbC[0], bulbC[1], 13, 15, 9)), { closed: true, w: 2.7, seed: seed + 142, wobble: 0.4, taper: 0.5 });
    g.pen(H(at(bulbC, [[-5, 6], [-3, -3], [0, 3], [3, -3], [5, 6]])), { w: 1.7, color: "#c9872a", seed: seed + 143, wobble: 0.2, opacity: 0.8, retrace: false });
    [0, 1, 2, 3, 4, 5].forEach((i) => { const a = -2.9 + i * 0.55; g.pen(H(line([bulbC[0] + Math.cos(a) * 22, bulbC[1] + Math.sin(a) * 22], [bulbC[0] + Math.cos(a) * (33 + (i % 2) * 5), bulbC[1] + Math.sin(a) * (33 + (i % 2) * 5)])), { w: 2.3, color: "#c9973a", seed: seed + 144 + i, wobble: 0.3, retrace: false }); });
  });
  // head
  g.group("paint", () => { [-1, 1].forEach((s) => g.form(H(oval(s * 81 + 1, 2, 11, 17, 9)), TINT.rose, SHADE.rose, { seed: seed + 150 + s, light: [-2, -3] })); g.form(H(HEAD), TINT.white, SHADE.white, { seed: seed + 152, light: [-9, -10], hi: [hc[0] - 40, hc[1] - 40, 16, 8, -28] }); });
  g.group("ink", () => {
    [-1, 1].forEach((s) => { g.pen(H(oval(s * 81 + 1, 2, 11, 17, 9)), { closed: true, w: 2.8, seed: seed + 153 + s, wobble: 0.4, taper: 0.5 }); g.pen(H(line([s * 81 - 3, -5], [s * 81 + 5, 9])), { w: 1.8, seed: seed + 156 + s, wobble: 0.2, opacity: 0.6, retrace: false }); });
    g.pen(H(HEAD), { closed: true, w: 4.2, seed: seed + 160, wobble: 0.9, boil: 0.4, taper: 0.6 }); g.pen(H([[-68, -33], [-30, -41], [10, -43], [44, -41], [69, -34]]), { w: 1.9, seed: seed + 161, wobble: 0.4, opacity: 0.5, retrace: false });
    [[-54, -46], [58, -47]].forEach(([x, y], i) => g.pen(H(oval(x, y, 2.6, 2.6, 6)), { closed: true, w: 1.6, seed: seed + 162 + i, wobble: 0.2, opacity: 0.7, retrace: false }));
    g.pen(H(arc(26, -62, 9, 7, Math.PI, 2 * Math.PI, 5)), { w: 2.4, seed: seed + 164, wobble: 0.3 }); const hp = H([[36, 44]])[0]; g.hatch(hp[0], hp[1], 30, { n: 6, len: 14, angle: -0.95, seed: seed + 165, opacity: 0.33 });
  });
  // face
  const fo: P = [hc[0] + look * 4, hc[1] + 6], fs = seed + 170, gap = 31, T = (pts: P[]) => turn(at(fo, pts), fo[0], fo[1], tilt);
  g.group("paint", () => [-1, 1].forEach((s) => g.wash(T(oval(s * (gap + 22), 20, 14, 8.5, 8)), TINT.blush, { alpha: 0.5, seed: fs + s, dx: 0, dy: 0, shrink: 1, rim: false })));
  g.group("ink", () => {
    [-1, 1].forEach((s, i) => {
      const x = s * gap + look * 3, y = i ? -1 : 0, c = T([[x, y]])[0], k: Ctx = g.cur;
      g.touch(c[0] - 13, c[1] - 13, c[0] + 13, c[1] + 13); k.fillStyle = GRAPHITE; k.beginPath(); k.ellipse(c[0], c[1], 8.4, 10.8, (tilt * Math.PI) / 180, 0, Math.PI * 2); k.fill();
      k.fillStyle = "#fffaf3"; k.beginPath(); k.arc(c[0] - 2.6 + look * 1.5, c[1] - 3.8, 3.3, 0, Math.PI * 2); k.fill(); k.globalAlpha = 0.85; k.beginPath(); k.arc(c[0] + 2.8 + look * 1.5, c[1] + 3.6, 1.5, 0, Math.PI * 2); k.fill(); k.globalAlpha = 1;
      g.pen(T(arc(x, y - 13, 10, 6, 1.25 * Math.PI, 1.75 * Math.PI, 4)), { w: 2, seed: fs + 14 + i, wobble: 0.3, opacity: 0.55, retrace: false });
    });
    g.pen(T(arc(0, 20, 9, 8, 0.12 * Math.PI, 0.88 * Math.PI, 6)), { w: 2.9, seed: fs + 20, wobble: 0.3, boil: 0.3 });
    [-1, 1].forEach((s) => { const c = T([[s * (gap + 22) - 7, 17]])[0]; g.hatch(c[0], c[1], 13, { n: 3, len: 9, color: TINT.blush, pw: 2.6, opacity: 0.9, seed: fs + 30 + s }); });
  });
};

export const drawStorybook = (ctx: Ctx, frame: number, env: Env) => {
  const g = new Gfx(ctx, env, frame, PENCIL), W = env.W, H = env.H;
  ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0); ctx.fillStyle = "#fbf6ea"; ctx.fillRect(0, 0, W, H);
  // the painting stops short of the sheet
  g.group("paint", () => {
    g.wash([[40, 46], [170, 36], [300, 42], [430, 34], [522, 44], [528, 170], [520, 300], [526, 430], [518, 488], [400, 480], [280, 490], [150, 482], [42, 490], [34, 380], [42, 250], [36, 130]], "#f3d9b4", { alpha: 0.62, seed: 2 });
    g.wash(oval(170, 150, 150, 105, 9), "#a9cdea", { alpha: 0.24, seed: 3 }); g.wash(oval(420, 330, 120, 150, 9), "#f2b9a0", { alpha: 0.26, seed: 4 }); g.wash(oval(318, 96, 80, 70, 8), TINT.glow, { alpha: 0.5, seed: 5 });
    g.wash([[34, 470], [150, 452], [300, 460], [430, 450], [530, 466], [524, 530], [300, 538], [44, 530]], "#9cc79a", { alpha: 0.62, seed: 6 }); g.wash([[60, 486], [200, 474], [330, 480], [330, 500], [190, 506], [70, 504]], "#6fa874", { alpha: 0.35, seed: 7 });
    g.wash(oval(292, 494, 124, 13, 10), "#7d6fa8", { alpha: 0.42, seed: 8 });
  });
  // pencil underdrawing, left in
  g.group("ink", () => {
    const U = "#8d90a6";
    g.pen(turn(oval(300, 214, 128, 104, 12), 300, 214, 6), { closed: true, w: 1.4, color: U, seed: 9, opacity: 0.45, wobble: 2 }); g.pen(oval(292, 392, 86, 92, 10), { closed: true, w: 1.4, color: U, seed: 10, opacity: 0.42, wobble: 2 });
    g.pen([[318, 96], [300, 214], [288, 400], [286, 500]], { w: 1.3, color: U, seed: 11, opacity: 0.42 }); g.pen([[170, 232], [300, 214], [432, 196]], { w: 1.3, color: U, seed: 12, opacity: 0.4 });
    g.pen([[36, 470], [150, 454], [300, 461], [430, 452], [530, 468]], { w: 2, seed: 13, opacity: 0.55 });
    [[66, 0], [84, 1], [104, 0], [128, 1], [430, 0], [452, 1], [474, 0], [500, 1]].forEach(([x, k], i) => g.pen([[x, 472], [x + (k ? 5 : -4), 456 - (i % 3) * 4], [x + (k ? 9 : -8), 444 - (i % 3) * 5]], { w: 1.9, color: "#5f8f62", seed: 20 + i, retrace: false }));
    [[176, 512, 9, 5], [396, 516, 11, 6], [232, 524, 6, 4]].forEach(([x, y, a, b], i) => g.pen(oval(x, y, a, b, 7), { closed: true, w: 1.6, seed: 40 + i, opacity: 0.6 }));
  });
  ([[64, 440, "#f2899c", 50], [488, 430, "#c7b3e0", 60], [446, 452, "#f5b98a", 70], [98, 462, "#f3d577", 80]] as [number, number, string, number][]).forEach(([x, y, c, seed]) => {
    g.group("paint", () => { const flat = { dx: 3, dy: 2, shrink: 0.94, rim: true }; [0, 1, 2, 3, 4].forEach((i) => g.wash(oval(x + Math.cos(i * 1.256 + 0.4) * 9, y + Math.sin(i * 1.256 + 0.4) * 9, 7.5, 7.5, 6), c, { alpha: 0.85, seed: seed + i, ...flat })); g.wash(oval(x, y, 3.4, 3.4, 5), TINT.butter, { alpha: 0.95, seed: seed + 6, ...flat }); });
    g.group("ink", () => { g.pen([[x, y + 9], [x + 2, y + 24], [x - 1, y + 40]], { w: 1.8, color: "#6f9b6a", seed: seed + 7, retrace: false }); g.pen(oval(x, y, 16, 16, 9), { closed: true, w: 1.5, seed: seed + 8, opacity: 0.6, wobble: 2 }); });
  });
  // the actor: same placement maths as <Actor x=272 y=492 s=2.75> around a 1080 viewBox in a 560 box
  const seed = 3, bob = Math.sin(frame * 0.16 + seed) * 2;
  g.push(272, 492 + bob * 2.75, 2.75 * (560 / 1080)); drawBit(g, frame, seed, { look: 1, tilt: 6, lean: 3, handL: [-80, -58], handR: [94, -178] }); g.pop();
  // paint off the brush
  g.group("paint", () => { const c = g.cur; ([[5, 26, [50, 60, 510, 470], "#e9a887", 3], [8, 12, [60, 380, 500, 520], "#6fa874", 2.6]] as [number, number, number[], string, number][]).forEach(([sd, n, box, col, rmax]) => { const r = rng(sd); for (let i = 0; i < n; i++) { const x = box[0] + r() * (box[2] - box[0]), y = box[1] + r() * (box[3] - box[1]), k = r(); g.touch(x - 5, y - 5, x + 5, y + 5); c.globalAlpha = 0.5 * (0.5 + r() * 0.5); c.fillStyle = col; c.beginPath(); c.arc(x, y, 0.5 + k * k * rmax, 0, Math.PI * 2); c.fill(); } c.globalAlpha = 1; }); });
  g.paper("paper", 0.13); g.vignette("rgba(90,50,50,0.11)"); g.paper("coldpress", 0.2);
};
