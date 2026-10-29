// THE CAMERA'S SPEED TO A FRACTION OF A PIXEL. The temperament check reads the camera's move off frames
// 128 px wide, so one analysis pixel is 8.4 px of a phone frame and 15 px of a wide one, and the camera fit
// knew only whole pixels: a travel at 12.3 px a frame on 9:16 read as 8.4 or 16.9 by turns, and the 16.9s
// failed a calm brand's 15.75 (the clean scaffold, frames 249 to 286). The fit now places the shift between
// pixels (a parabola through the error at the best whole shift and its neighbours) for the speed profile. The case that stays
// red: a pan really at 2.2 analysis px a frame still reads above 2.
//   node tools/test.mjs motionSubpixel
// @ts-ignore: a plain ES module shared with the tools
import { globalMotion, motionBetween } from "../tools/motionscan-core.mjs";

export const name = "motionscan: the camera's speed to a fraction of a pixel";
export const run = (ok: (cond: boolean, label: string) => void) => {
  const W = 128, H = 228;
  // a smooth textured page (blurred blobs), so a sub-pixel pan is a sub-pixel change
  const tex = (x: number, y: number) => 128 + 50 * Math.sin(x * 0.21 + Math.sin(y * 0.13) * 2) * Math.cos(y * 0.17 + x * 0.05);
  const pan = (dx: number) => { const o = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) o[y * W + x] = Math.round(tex(x - dx, y)); return o; };
  const reads = [0, 1, 2, 3, 4].map((f) => globalMotion(pan(f * 1.46), pan((f + 1) * 1.46), W, H, { subpixel: true }).speed);
  ok(reads.every((v) => Math.abs(v - 1.46) <= 0.3), `RED: a pan at 1.46 analysis px a frame reads 1.46 within 0.3 on every frame (${reads.map((v) => v.toFixed(2)).join(", ")})`);
  const fast = globalMotion(pan(0), pan(2.2), W, H, { subpixel: true }).speed;
  ok(fast > 2, `a pan at 2.2 px a frame still reads above 2 (${fast.toFixed(2)})`);
  // the same for the block matcher, the profile's other reading (the fastest coherent element): the clean
  // scaffold's carried word lines at 11.5 px a frame read 8.4 or 16.9 by turns there, after the camera fit was fixed
  const blocks = [0, 1, 2, 3, 4].map((f) => motionBetween(pan(f * 1.46), pan((f + 1) * 1.46), W, H, { R: 10, subpixel: true }).speed);
  ok(blocks.every((v) => Math.abs(v - 1.46) <= 0.3), `RED: the block matcher reads a 1.46 px pan within 0.3 on every frame (${blocks.map((v) => v.toFixed(2)).join(", ")})`);
  const fastB = motionBetween(pan(0), pan(2.2), W, H, { R: 10, subpixel: true }).speed;
  ok(fastB > 2, `the block matcher still reads a 2.2 px pan above 2 (${fastB.toFixed(2)})`);
  const whole = motionBetween(pan(0), pan(1.46), W, H, { R: 10 }).speed;
  ok(Number.isInteger(whole), `without subpixel the block matcher keeps whole pixels (${whole})`);
};
