// A COUNTER STEP IS AN ANIMATION AT ANY FRAME RATE. A product's figure counting down (3, 2, 1, 0) shows each
// digit for about 0.1 s. framecheck skipped a text replaced in place within 3 frames as an animation step,
// counted in frames: at 30 fps that is 0.1 s, but at 60 fps a digit up 6 frames was timed as a read and
// failed ("1" up 0.1 s, reading it takes 0.7 s: the clean scaffold on 9:16, frame 126). The window is now
// 0.1 s at the film's rate. The case that stays red: a word up 0.2 s, then replaced, is still a read.
//   node tools/test.mjs counterFlash60
// @ts-ignore: a plain ES module shared with the tools
import { autoCues, framesOf, readingVerdict } from "../tools/framerules.mjs";

export const name = "framerules: a counter step at 60 fps";
export const run = (ok: (cond: boolean, label: string) => void) => {
  const T = (label: string, frame: number) => ({ kind: "text", label, frame, x0: 500, y0: 500, x1: 500 + label.length * 40, y1: 560, cut: false, alpha: 1, px: 80, family: "Inter" });
  const range = (a: number, b: number) => Array.from({ length: b - a }, (_, i) => a + i);
  // 3, 2, 1 for 6 frames each at 60 fps, then 0 held 1.5 s
  const digit = (f: number) => (f < 6 ? "3" : f < 12 ? "2" : f < 18 ? "1" : "0");
  const fr = range(0, 120), m = framesOf(fr.map((f) => T(digit(f), f)), fr), c = autoCues(m, fr, { last: 120, fps: 60 });
  ok(c.cues.length === 1 && c.cues[0].text === "0", `RED: a count-down at 60 fps times only its last figure (cues: ${c.cues.map((x: { text: string }) => x.text).join(", ")})`);
  // at 30 fps the same count in 3-frame steps is unchanged
  const d30 = (f: number) => (f < 3 ? "3" : f < 6 ? "2" : f < 9 ? "1" : "0"), fr30 = range(0, 60), c30 = autoCues(framesOf(fr30.map((f) => T(d30(f), f)), fr30), fr30, { last: 60, fps: 30 });
  ok(c30.cues.length === 1 && c30.cues[0].text === "0", "at 30 fps a count in 3-frame steps still times only its last figure");
  // stays red: a word up 0.2 s at 60 fps, then replaced in place, is a read too short
  const w = (f: number) => (f < 12 ? "Saved" : "Synced"), frw = range(0, 120), cw = autoCues(framesOf(frw.map((f) => T(w(f), f)), frw), frw, { last: 120, fps: 60 });
  ok(readingVerdict(cw, [], 60, 120).status === "FAIL" && cw.cues.some((x: { text: string }) => x.text === "Saved"), "a word up 0.2 s at 60 fps, then replaced, is still a read too short");
};
