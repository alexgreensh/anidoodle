// A SLOW PUSH-IN IS A CAMERA MOVE. The camera leaning in on a chat's answer card (1.18x over about half a
// second, off the frame's centre) on a sparse clean frame of thin type replaced 63 to 77 % of the content in
// 0.1 s, and the camera fit (globalMotion) could only try zooms of 3 % and 6 % a frame: a lean of about 1 %
// a frame matched none of them, the move "explained" under half the change, and motionscan read the lean
// as a slide cut (launchExampleCleanChat 16:9, frames 209 to 225). The fit now also tries the zooms between
// its coarse steps, at full size. The case that must stay red: two different layouts swapped in place.
//   node tools/test.mjs motionPushIn
// @ts-ignore: a plain ES module shared with the tools
import { globalMotion, scanSlideCuts } from "../tools/motionscan-core.mjs";

export const name = "motionscan: a slow push-in is a camera move";
export const run = (ok: (cond: boolean, label: string) => void) => {
  const W = 192, H = 108, PAPER = 250;
  // a sparse page of thin type: short dark strokes in a few lines and a card outline, on white
  const page = (seed: number) => (x: number, y: number) => {
    const row = Math.floor((y - 10 - seed * 7) / 14), inRow = (y - 10 - seed * 7) % 14;
    if (row >= 0 && row < 5 && inRow >= 0 && inRow < 3 && x > 20 + seed * 30 && x < 120 + row * 9 && (Math.floor(x / 3) + row + seed) % 5 < 3) return 40;
    if ((Math.abs(x - 140 + seed * 60) < 1 || Math.abs(x - 175 + seed * 60) < 1) && y > 50 && y < 95) return 120;
    return PAPER;
  };
  // the camera at zoom z about (cx, cy), sampled (bilinear, so a sub-pixel move shows as a sub-pixel move)
  const shot = (src: (x: number, y: number) => number, z: number, cx: number, cy: number) => {
    const o = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = cx + (x - cx) / z, v = cy + (y - cy) / z, x0 = Math.floor(u), y0 = Math.floor(v), fx = u - x0, fy = v - y0;
      const p = (a: number, b: number) => src(a, b);
      o[y * W + x] = Math.round((1 - fy) * ((1 - fx) * p(x0, y0) + fx * p(x0 + 1, y0)) + fy * ((1 - fx) * p(x0, y0 + 1) + fx * p(x0 + 1, y0 + 1)));
    }
    return o;
  };
  // a lean: 1.0 to 1.18 over 30 frames (in-out), about a point left of and below the centre
  const ease = (q: number) => (q < 0.5 ? 2 * q * q : 1 - 2 * (1 - q) ** 2);
  const lean = Array.from({ length: 40 }, (_, f) => shot(page(0), 1 + 0.18 * ease(Math.min(1, Math.max(0, (f - 5) / 30))), 70, 70));
  const g = globalMotion(lean[19], lean[20], W, H, { between: true });
  ok(g.explained >= 0.6, `RED: one step of the lean is explained by one zoom and shift (explained ${g.explained.toFixed(2)}, scale ${g.scale})`);
  const r = scanSlideCuts(lean, { width: W, height: H, fps: 60 });
  ok(r.events.length === 0, `RED: a slow push-in on a sparse page of type is no slide cut (${r.events.length} found${r.events.length ? ` at ${r.events.map((e: { frame: number }) => e.frame).join(", ")}` : ""})`);
  // the case that stays red: one sparse page swapped for another in place, in 3 frames, the camera still
  const swap = Array.from({ length: 24 }, (_, f) => { const a = shot(page(0), 1, 96, 54), b = shot(page(1), 1, 96, 54), q = Math.min(1, Math.max(0, (f - 10) / 3)); return a.map((v, i) => Math.round(v + (b[i] - v) * q)); });
  const s = scanSlideCuts(swap.map((x) => Uint8Array.from(x)), { width: W, height: H, fps: 60 });
  ok(s.events.length > 0, `two layouts swapped in place still read as a slide cut (${s.events.length} found)`);
};
