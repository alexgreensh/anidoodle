// THREE TRANSITION TESTS. src/three-core/transitions.ts: the frames either side of a transition
// must be exactly the shots' own frames, and every mask must cover none of B at 0 and all of it at
// 1. The mask maths is pure and held to numbers; the dispatch is checked with a recording ctx.
//   node tools/test.mjs threeTransitions
import type { Ctx, Env } from "../src/canvas-core/core";
import { crossfade, noiseMask, noiseWipe, radialAlpha, radialWipe, slide, slideOffsets, transition, wipe, wipeAlpha, zoomThrough, type Dir } from "../src/three-core/transitions";

export const name = "threeTransitions";
export const run = (ok: (cond: boolean, label: string) => void) => {
  const W = 320, H = 180;
  const grid: [number, number][] = []; for (let y = 0; y <= H; y += 10) for (let x = 0; x <= W; x += 10) grid.push([x, y]);
  // true when alpha(e) is exactly 0 everywhere at e = 0 and exactly 1 everywhere at e = 1
  const exactEnds = (alpha: (x: number, y: number, e: number) => number) => grid.every(([x, y]) => alpha(x, y, 0) === 0 && alpha(x, y, 1) === 1);

  // 1. at t <= 0 only A is drawn, onto the frame itself; at t >= 1 only B: bit-exact by construction
  const calls: string[] = [];
  const ctx = { tag: "frame" } as unknown as Ctx, env = { W, H, scale: 1, cache: new Map(), canvas: () => { throw new Error("no layer should be made at the ends"); } } as unknown as Env;
  const A = (c: Ctx) => calls.push(`A:${(c as unknown as { tag: string }).tag}`), B = (c: Ctx) => calls.push(`B:${(c as unknown as { tag: string }).tag}`);
  for (const k of [crossfade(), wipe("left"), radialWipe(), noiseWipe(3), slide("up"), zoomThrough()]) {
    calls.length = 0; transition(ctx, env, 0, k, A, B); const at0 = calls.join();
    calls.length = 0; transition(ctx, env, 1, k, A, B); const at1 = calls.join();
    calls.length = 0; transition(ctx, env, -0.5, k, A, B); transition(ctx, env, 7, k, A, B); const out = calls.join();
    ok(at0 === "A:frame" && at1 === "B:frame" && out === "A:frame,B:frame", `${k.kind}: t=0 draws only A and t=1 only B, straight onto the frame (${at0} | ${at1})`);
  }

  // 2. straight wipes, every direction: none of B at 0, all at 1, and B only grows
  for (const dir of ["left", "right", "up", "down"] as Dir[]) {
    ok(exactEnds((x, y, e) => wipeAlpha(x, y, W, H, e, dir, 24)), `wipe ${dir}: exactly none of B at 0, exactly all at 1`);
    let grows = true; for (const [x, y] of grid) for (let e = 0; e < 1; e += 0.05) if (wipeAlpha(x, y, W, H, e + 0.05, dir, 24) < wipeAlpha(x, y, W, H, e, dir, 24)) grows = false;
    ok(grows, `wipe ${dir}: B never retreats`);
  }
  ok(wipeAlpha(0, 90, W, H, 0.5, "right", 24) === 1 && wipeAlpha(W, 90, W, H, 0.5, "right", 24) === 0, "wipe right: halfway, the left edge is B and the right edge is still A");
  // red fixture: the naive edge (0 -> W, no feather margin) leaves a part-B column at both ends
  const naive = (x: number, _y: number, e: number) => Math.min(1, Math.max(0, (e * W - x) / 24 + 1));
  ok(!exactEnds(naive), "red fixture: a wipe whose soft edge starts ON the frame fails the end check");

  // 3. iris: from the centre and from a corner
  for (const [cx, cy] of [[W / 2, H / 2], [0, H], [W * 0.8, H * 0.3]]) ok(exactEnds((x, y, e) => radialAlpha(x, y, W, H, e, cx, cy, 30)), `radial wipe from (${cx}, ${cy}): exact at both ends, corners included`);
  ok(radialAlpha(W / 2, H / 2, W, H, 0.3, W / 2, H / 2, 30) === 1 && radialAlpha(0, 0, W, H, 0.3, W / 2, H / 2, 30) === 0, "a third of the way in, the centre is B and the corner is A");

  // 4. ink-blot noise: exact ends, a real blot pattern in between, ink only on the edge
  const mw = 80, mh = 45, m0 = noiseMask(5, 0, mw, mh), m1 = noiseMask(5, 1, mw, mh), mh5 = noiseMask(5, 0.5, mw, mh);
  ok(m0.alpha.every((v) => v === 0) && m1.alpha.every((v) => v === 255), "noise wipe: alpha exactly 0 everywhere at 0 and 255 everywhere at 1");
  ok(m0.ink!.every((v) => v === 0) && m1.ink!.every((v) => v === 0), "the ink rim is gone at both ends");
  const cover = mh5.alpha.reduce((a, v) => a + v / 255, 0) / (mw * mh);
  ok(cover > 0.2 && cover < 0.8, `halfway, B covers part of the frame in blots (${(cover * 100).toFixed(0)} %)`);
  ok(mh5.ink!.some((v) => v > 200), "halfway, the ink rim is drawn along the blot edges");
  ok(noiseMask(5, 0.5, mw, mh).alpha.every((v, i) => v === mh5.alpha[i]) && noiseMask(6, 0.5, mw, mh).alpha.some((v, i) => v !== mh5.alpha[i]), "the same seed gives the same blots; another seed other blots");
  let grows = true; for (let e = 0; e < 1; e += 0.1) { const a = noiseMask(5, e, mw, mh).alpha, b = noiseMask(5, e + 0.1, mw, mh).alpha; if (b.some((v, i) => v < a[i])) grows = false; }
  ok(grows, "the blots only grow");
  ok(noiseMask(5, 0.5, mw, mh, { ink: false }).ink === null, "ink: false draws no rim");
  // L15: the rim colour went through a hex-only parser, so ink: "red" drew a BLACK rim, silently.
  // Run the real transition on recording layers and read the colour the rim was painted with.
  {
    const rimRGB = (ink: string) => {
      const puts: Uint8ClampedArray[] = [];
      const fake = (): Ctx => new Proxy({}, { get: (_t, k) => k === "createImageData" ? (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }) : k === "putImageData" ? (img: { data: Uint8ClampedArray }) => puts.push(img.data) : k === "createLinearGradient" || k === "createRadialGradient" ? () => ({ addColorStop() {} }) : () => {}, set: () => true }) as unknown as Ctx;
      const env = { W: 64, H: 36, scale: 1, cache: new Map(), canvas: () => ({ canvas: {}, ctx: fake() }) } as unknown as Env;
      transition(fake(), env, 0.5, noiseWipe(5, { ink, inkWidth: 0.2 }), () => {}, () => {});
      const rim = puts[1]; if (!rim) return "no rim drawn";
      for (let q = 0; q < rim.length; q += 4) if (rim[q + 3] > 0) return [rim[q], rim[q + 1], rim[q + 2]].join(",");
      return "rim empty";
    };
    ok(rimRGB("#14112a") === "20,17,42", `GREEN a hex ink paints the rim that colour (${rimRGB("#14112a")})`);
    ok(rimRGB("red") === "255,0,0", `L15 a CSS colour name paints the rim that colour, not black (${rimRGB("red")})`);
    ok(rimRGB("rgb(10, 200, 30)") === "10,200,30", `L15 rgb() works too (${rimRGB("rgb(10, 200, 30)")})`);
    ok(rimRGB("#abc") === "170,187,204", `GREEN short hex (${rimRGB("#abc")})`);
    let e = ""; try { noiseWipe(5, { ink: "not-a-colour" }); } catch (x) { e = String(x); }
    ok(e.includes("noiseWipe"), `L15 an ink that is not a colour is refused when the wipe is made (${e || "no error"})`);
  }

  // 5. slide: A leaves as B arrives, B lands exactly home
  for (const dir of ["left", "right", "up", "down"] as Dir[]) {
    const s0 = slideOffsets(0, dir, W, H), s1 = slideOffsets(1, dir, W, H);
    ok(s0.a[0] === 0 && s0.a[1] === 0 && s1.b[0] === 0 && s1.b[1] === 0 && Math.abs(s0.b[0]) + Math.abs(s0.b[1]) === (dir === "left" || dir === "right" ? W : H), `slide ${dir}: A home at 0, B home at 1, B one frame away at 0`);
  }
  const sm = slideOffsets(0.25, "left", W, H);
  ok(sm.b[0] - sm.a[0] === W, "A and B stay butted together: no gap opens between them");
};
