// A REVEAL IS NOT A MOVE. An end card that opens as a growing disc (a bloom's rim) uncovers the new page
// and covers the old one; nothing in either moves. The block matcher read it as fast motion: a block of the
// old page's text, covered by the rim, "found" its look-alike in the text still standing beside it, a few
// letters over, and that false match was the fastest thing in the frame (launchExampleClean 9:16 frames
// 979 to 985 read 51 px a frame against the snappy limit of 36). A block whose match lands on content that
// was already there, unchanged, did not move there: it was covered. Real motion still reads, the green
// case that must stay red: a textured card crossing flat ground fast.
//   node tools/test.mjs motionReveal
// @ts-ignore: a plain ES module shared with the tools
import { speedProfile } from "../tools/motionscan-core.mjs";

export const name = "motionscan: a reveal edge is not motion";
export const run = (ok: (cond: boolean, label: string) => void) => {
  const W = 192, H = 108, PAPER = 236;
  // lines of "text": letters as dark strokes on a short period, so a letter has look-alikes a few px away
  const text = (x: number, y: number) => { const row = Math.floor(y / 12), inRow = y % 12; if (row < 1 || row > 7 || inRow < 3 || inRow > 9) return PAPER; const cx = (x + row * 3) % 7; return cx < 2 || (cx === 4 && inRow % 3 === 0) ? 30 : PAPER; };
  const page = (x: number, y: number) => ((Math.floor(x / 5) + Math.floor(y / 5)) % 3 === 0 ? 120 : 200); // the new page: other content, flat-ish
  const frame = (r: number) => { const o = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) o[y * W + x] = Math.hypot(x - 150, y - 50) < r ? page(x, y) : text(x, y); return o; };
  const reveal = Array.from({ length: 24 }, (_, f) => frame(4 + 3 * f)); // the rim grows 3 analysis px a frame
  const sp = speedProfile(reveal, { width: W, height: H, scale: 1, R: 10 }), top = Math.max(...sp.slice(2));
  ok(top <= 4.5, `RED: a disc opening at 3 px a frame over standing text reads at most its rim's pace (fastest ${top.toFixed(1)} px a frame)`);
  // the green case that stays red: a textured card crossing flat ground at 9 px a frame is fast motion
  const tex = (x: number, y: number) => (((x * 7) ^ (y * 13)) % 11 < 5 ? 40 : 190);
  const cross = Array.from({ length: 12 }, (_, f) => { const o = new Uint8Array(W * H).fill(PAPER), x0 = 10 + 9 * f; for (let y = 30; y < 80; y++) for (let x = x0; x < Math.min(W, x0 + 50); x++) o[y * W + x] = tex(x - x0, y); return o; });
  const sc = speedProfile(cross, { width: W, height: H, scale: 1, R: 10 }), fast = Math.max(...sc.slice(2));
  ok(fast >= 8, `a card crossing flat ground at 9 px a frame still reads as fast (${fast.toFixed(1)} px a frame)`);
};
