import { Gfx, PENCIL, arc, line, oval, rng, tube, type Ctx, type Env, type P } from "./core";
import type { Film } from "./film";

// Broad, cupped outer petals give way to densely folded inner petals.
// Each lip is offset independently so the bloom never becomes a radial rosette.
const petal = (g: Gfx, radius: number, angle: number, width: number, depth: number, seed: number, tier: number) => {
  const r = rng(seed), cx = 531 + (r() - 0.5) * 14, cy = 391 + (r() - 0.5) * 12;
  const place = ([x, y]: P): P => [cx + Math.cos(angle) * y - Math.sin(angle) * x, cy + (Math.sin(angle) * y + Math.cos(angle) * x) * 0.87];
  const lip = arc(0, radius - depth * 0.28, width, depth * 0.45, Math.PI, 0, 9)
    .map(([x, y], i): P => [x, y + Math.sin(i * 1.8 + seed) * depth * 0.045]);
  const shape = [...lip, [width * 0.73, radius - depth * 0.61], [width * 0.15, radius - depth], [-width * 0.63, radius - depth * 0.7]] as P[];
  const colors = ["#f7ddd2", "#f4cbbb", "#efb8a8", "#e8a491", "#df907f", "#d88071", "#c77364"];
  g.group("paint", () => {
    g.form(shape.map(place), colors[tier], tier < 3 ? "#ce8c8a" : "#ac6667", { seed, light: [-3.2, -4.6], alpha: 0.94 });
    g.wash([...lip.slice(1, 8), [0, radius - depth * 0.17]].map(p => place(p as P)), "#fff2dc", { seed: seed + 1, alpha: 0.28, dx: -1, dy: -1, shrink: 0.91, rim: false });
  });
  g.group("ink", () => {
    g.pen(lip.map(place), { seed: seed + 2, w: 0.88, opacity: 0.43, color: "#726262", wobble: 0.65, boil: 0, taper: 1, retrace: true });
    for (let j = 0; j < 3; j++) {
      const x = (j - 1) * width * 0.42;
      g.pen(line([x * 0.45, radius - depth * 0.69], [x, radius - depth * 0.06], (r() - 0.5) * 7).map(place), { seed: seed + 10 + j, w: 0.48, opacity: 0.17, color: "#986b69", wobble: 0.35, boil: 0, retrace: false });
    }
  });
};

const leaf = (g: Gfx, origin: P, direction: number, size: number, seed: number) => {
  const place = ([x, y]: P): P => [origin[0] + (x * Math.cos(direction) - y * Math.sin(direction)) * size, origin[1] + (x * Math.sin(direction) + y * Math.cos(direction)) * size];
  // Ranunculus foliage is divided into pointed lobes.
  const edge: P[] = [[0, 0], [28, -22], [35, -51], [52, -37], [78, -65], [81, -38], [116, -39], [101, -17], [147, 0], [105, 12], [113, 31], [80, 25], [73, 52], [50, 31], [30, 39], [22, 17]];
  g.group("paint", () => g.form(edge.map(place), "#a4b28b", "#637f70", { seed, light: [-3, -4], alpha: 0.9 }));
  g.group("ink", () => {
    g.pen(edge.map(place), { seed: seed + 1, closed: true, w: 0.95, opacity: 0.45, wobble: 0.65, boil: 0, color: "#5f6a5c" });
    g.pen(line([0, 0], [139, 0], -3).map(place), { seed: seed + 2, w: 0.9, opacity: 0.55, boil: 0 });
    [[35, -45], [77, -57], [111, -34], [71, 45], [107, 27]].forEach(([x, y], i) => g.pen(line([x * 0.56, 0], [x, y], 3).map(place), { seed: seed + 3 + i, w: 0.55, opacity: 0.35, boil: 0, retrace: false }));
  });
};

export const drawRanunculus = (ctx: Ctx, _frame: number, env: Env) => {
  // A still has no line boil across frames; its only randomness is seeded geometry.
  const g = new Gfx(ctx, env, 0, PENCIL);
  ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0);
  ctx.fillStyle = "#fffaf3";
  ctx.fillRect(0, 0, env.W, env.H);
  const stem: P[] = [[547, 548], [557, 645], [539, 756], [517, 880], [524, 991]];
  const stalk = tube(stem, 8, 4, true);
  g.group("paint", () => g.form(stalk, "#a6b48b", "#708776", { seed: 21, light: [-3, -1] }));
  g.group("ink", () => g.pen(stalk, { seed: 22, closed: true, w: 0.95, opacity: 0.53, wobble: 0.6, boil: 0 }));
  leaf(g, [541, 760], -2.55, 1.25, 40);
  leaf(g, [549, 698], -0.57, 1.02, 60);
  g.group("paint", () => g.form(oval(543, 548, 48, 34, 10), "#abb68b", "#6f8069", { seed: 90, light: [-4, -5] }));

  const r = rng(7321);
  const rings = [
    { radius: 252, count: 11, width: 99, depth: 150 },
    { radius: 211, count: 13, width: 77, depth: 116 },
    { radius: 171, count: 14, width: 62, depth: 94 },
    { radius: 134, count: 14, width: 49, depth: 74 },
    { radius: 100, count: 12, width: 38, depth: 58 },
    { radius: 70, count: 11, width: 28, depth: 42 },
    { radius: 43, count: 9, width: 21, depth: 31 },
  ];
  rings.forEach((ring, tier) => {
    const offset = tier * 0.39 + 0.14;
    for (let i = 0; i < ring.count; i++) {
      const a = offset + i * Math.PI * 2 / ring.count + (r() - 0.5) * 0.15;
      petal(g, ring.radius * (0.95 + r() * 0.1), a, ring.width * (0.88 + r() * 0.24), ring.depth * (0.92 + r() * 0.16), 1000 + tier * 500 + i * 25, tier);
    }
  });
  for (let i = 0; i < 5; i++) petal(g, 20 - i * 2, i * 2.4, 12 - i, 17, 6000 + i * 25, 6);
  g.paper("paper", 0.12);
  g.paper("coldpress", 0.18);
};

export const ranunculus: Film = {
  meta: { title: "Ranunculus · pencil + watercolour", W: 1080, H: 1080, fps: 30, bpm: 120, durationFrames: 1 },
  assets: { images: {} },
  shots: [{ id: "ranunculus", start: 0, end: 1, draw: drawRanunculus }],
};
