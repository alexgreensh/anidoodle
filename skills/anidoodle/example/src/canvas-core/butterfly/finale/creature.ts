// THE CREATURE, REPAINTED. Same control points, new paint. Each membrane panel between the
// spars is its own small wet-in-wet wash, rose at the root running to peach at the margin with
// a butter drop near the tip. The spars are denim line, the rivets are lifted dots, the rim
// light on the sunward margins is paper left unpainted, and starboard forewing panel 2 is
// cornflower blue with a ruled grid lifted in it: a piece of the blueprint it carries with it.
import { Gfx, P, jitter, oval, rng, tube } from "../../core";
import { CX, CY, FW, FW_H, FW_T, HEAD, HW, HW_H, HW_T, Pose, THORAX, Wing, cen, lerp, wingGeom } from "../geom";
import { BUTTER, CORNFLOWER, DENIM, GRASS_SHADE, INK_P, PAPER_W, PEACH, ROSE } from "./world";
import { lift, mottle, wet } from "./paint";

export type Flight = { pose: Pose; heading: number; pitch: number; bank: number };
export const REST_FLIGHT: Flight = { pose: { flap: 1, sweep: 0 }, heading: 0, pitch: 1, bank: 0 };

// world -> screen for the creature: pose on the control points first, then heading, pitch, scale
const mapper = (at: P, scale: number, f: Flight) => {
  const c = Math.cos(f.heading), s = Math.sin(f.heading);
  return (p: P): P => {
    const dx = (p[0] - CX) * scale, dy = (p[1] - CY) * scale * f.pitch; /* pitch foreshortens along the body axis as it climbs away */
    return [at[0] + dx * c - dy * s, at[1] + dx * s + dy * c];
  };
};
export const drawCreature = (g: Gfx, at: P, scale: number, f: Flight, seed = 900) => {
  const T = mapper(at, scale, f), r = rng(seed);
  const pose = f.pose, port = { ...pose, flap: Math.min(1, pose.flap + f.bank) }, star = { ...pose, flap: Math.max(0.2, pose.flap - f.bank) };
  const w: Wing[] = [wingGeom(-1, HW, HW_H, HW_T, 2000, port), wingGeom(1, HW, HW_H, HW_T, 2600, star), wingGeom(-1, FW, FW_H, FW_T, 1000, port), wingGeom(1, FW, FW_H, FW_T, 1600, star)];
  const sc = scale * 90; /* one "unit" of paint at this size */
  g.fill(oval(at[0] - sc * 0.5, at[1] + sc * 0.55, sc * 1.5, sc * 0.35, 10), GRASS_SHADE, 0.16); /* the shadow it throws on the grass, lower left */
  /* the paper was LEFT for it. A watercolourist paints the field around the subject and keeps
     the sheet clean underneath, which is why a wash over white glows and a wash over green does not */
  const reserve: P[] = [];
  w.forEach((wg) => wg.out.forEach((q) => reserve.push(T(q))));
  const rc = cen(reserve);
  w.forEach((wg) => { g.fill(wg.out.map((q) => { const p = T(q); return lerp(p, rc, -0.03) as P; }), PAPER_W, 0.93); });
  g.fill(THORAX.map((q) => lerp(T(q), rc, -0.08)), PAPER_W, 0.95);
  w.forEach((wg, i) => {
    const star2 = i % 2 === 1, out = wg.out.map(T), root = T(wg.h), margin = out.map((q) => lerp(q, cen(out), 0.055));
    /* the margin band: the darkest pigment on the wing, laid first and let dry */
    wet(g, out, ROSE, { alpha: 0.62, seed: seed + i * 40, shrink: 0.985, rim: true, dx: 2, dy: 2 });
    wg.panels.forEach((pn, j) => {
      const p = pn.map((q) => lerp(q, cen(pn), 0.12)).map(T), c0 = cen(p), d = Math.hypot(c0[0] - root[0], c0[1] - root[1]), far = Math.min(1, d / (sc * 3.2));
      if (i === 3 && j === 2) { /* the panel that never came home, painted the colour of the plate it came from */
        wet(g, p, CORNFLOWER, { alpha: 0.8, seed: seed + 300, shrink: 0.95, rim: true });
        const gr = 3; for (let q = 1; q < gr; q++) { const a = lerp(p[0], p[6], q / gr), b = lerp(p[2], p[4], q / gr); lift(g, tube([a, b], sc * 0.03, sc * 0.03, false), seed + 310 + q, 0.5); }
        return;
      }
      /* each panel is its OWN small wash: rose at the root, peach running out to the margin,
         with a paper gap between panels so the wing reads like stained glass */
      wet(g, p, ROSE, { alpha: 0.5 + (1 - far) * 0.34, seed: seed + i * 20 + j, shrink: 0.93, rim: true, dx: 1.5, dy: 1.5 });
      wet(g, p.map((q) => lerp(q, lerp(c0, T(wg.ends[Math.min(j + 1, wg.ends.length - 1)]), 0.45), 0.3)), PEACH, { alpha: 0.3 + far * 0.34, seed: seed + 60 + i * 20 + j, dx: 2, dy: -2, shrink: 0.86, rim: false });
      if (far > 0.5 && r() > 0.4) { const tip = lerp(c0, T(wg.ends[Math.min(j + 1, wg.ends.length - 1)]), 0.55); wet(g, oval(tip[0], tip[1], sc * 0.2, sc * 0.16, 9), BUTTER, { alpha: 0.5, seed: seed + 120 + i * 9 + j, shrink: 0.88, rim: false }); } /* a drop of butter near the tip, dropped in while it is wet */
    });
    wg.ends.forEach((_, j) => { const line = Array.from({ length: 6 }, (_, q) => T(wg.spar(j, 0.05 + (q / 5) * 0.9))); g.fill(tube(line, sc * (j === 0 ? 0.05 : 0.03), sc * 0.01, false), DENIM, j === 0 ? 0.78 : 0.56); });
    for (let j = 1; j <= 4; j++) { const p = T(wg.spar(0, 0.16 + j * 0.18)); lift(g, oval(p[0], p[1], sc * 0.03, sc * 0.03, 8), seed + 200 + i * 9 + j, 0.6); }
    if (star2) { const rim = out.slice(0, Math.ceil(out.length * 0.4)); lift(g, tube(rim, sc * 0.07, sc * 0.04, false), seed + 260 + i, 0.72); } /* rim light on the sunward margin: paper left, never white paint */
    /* lost-and-found pencil: it follows the margin for a while, then leaves it alone */
    const seg = Math.ceil(out.length * 0.45); g.fill(tube([...out.slice(0, seg)], sc * 0.024, sc * 0.014, false), INK_P, 0.5);
    g.fill(tube([...out.slice(seg + 2, out.length)], sc * 0.02, sc * 0.012, false), INK_P, 0.3);
  });
  const body = THORAX.map(T), head = HEAD.map(T);
  for (let i = 0; i < 6; i++) { /* the abdomen is six printed segments with the paper showing in the joints */
    const t0 = i / 6, t1 = (i + 1) / 6, hw = (t: number) => 23 * (1 - t) ** 0.8 + 6.5, g0 = 1.6;
    const q: P[] = [T([CX - hw(t0) * 0.9 + g0, CY + (70 + 170 * t0) * 0.9 + g0]), T([CX + hw(t0) * 0.9 - g0, CY + (70 + 170 * t0) * 0.9 + g0]), T([CX + hw(t1) * 0.9 - g0, CY + (70 + 170 * t1) * 0.9 - g0]), T([CX - hw(t1) * 0.9 + g0, CY + (70 + 170 * t1) * 0.9 - g0])];
    wet(g, q, DENIM, { alpha: 0.72 - i * 0.03, seed: seed + 400 + i, shrink: 0.94, rim: true, dx: 1, dy: 1 });
  }
  wet(g, body, DENIM, { alpha: 0.8, seed: seed + 420, shrink: 0.94, rim: true });
  wet(g, head, DENIM, { alpha: 0.84, seed: seed + 424, shrink: 0.92, rim: true });
  wet(g, body.map((q) => lerp(q, [cen(body)[0] - sc * 0.12, cen(body)[1]] as P, 0.3)), "#4f6f9e", { alpha: 0.34, seed: seed + 426, shrink: 0.9, rim: false }); /* the shadow side: the sun is upper right */
  lift(g, oval(T([CX + 14, CY - 30])[0], T([CX + 14, CY - 30])[1], sc * 0.13, sc * 0.3, 10), seed + 410, 0.45); /* the lit side of the body, taken back off */
  const o = cen(THORAX); ([[o[0] + 2, o[1] + 8, 24], [o[0] - 18, o[1] - 32, 14], [o[0] + 22, o[1] - 24, 10]] as number[][]).forEach(([x, y, rr], i) => { const p = T([x, y]); lift(g, oval(p[0], p[1], rr * scale * 0.95, rr * scale * 0.95, 12), seed + 420 + i, 0.5); wet(g, jitter(oval(p[0], p[1], rr * scale, rr * scale, 12), rr * scale * 0.12, seed + 430 + i), "#8fb3d8", { alpha: 0.42, seed: seed + 430 + i, shrink: 0.9, rim: true }); }); /* the train, lifted out and dropped in cool sky: still clockwork */
  [-1, 1].forEach((sd) => { const a0 = T([CX + sd * 8, CY - 114]), a1 = T([CX + sd * 50, CY - 186]), a2 = T([CX + sd * 112, CY - 222]); const pts = Array.from({ length: 7 }, (_, i) => { const t = i / 6; return lerp(lerp(a0, a1, t), lerp(a1, a2, t), t); }); g.fill(tube(pts, sc * 0.035, sc * 0.012, false), INK_P, 0.7); g.fill(oval(a2[0], a2[1], sc * 0.055, sc * 0.055, 8), INK_P, 0.7); });
  const pr = T([CX, CY - 135]), spir: P[] = []; for (let i = 0; i <= 26; i++) { const t = i / 26, a = 1.4 + t * 2.6 * Math.PI * 2, rr = sc * (0.02 + 0.1 * t); spir.push([pr[0] + Math.cos(a) * rr, pr[1] + Math.sin(a) * rr]); }
  g.fill(tube(spir, sc * 0.026, sc * 0.014, false), INK_P, 0.45); /* the proboscis is still a hairspring */
};
