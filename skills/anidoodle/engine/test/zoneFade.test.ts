// A STRING LEAVING THROUGH A PLATFORM ZONE FADES, IT DOES NOT POP. On 9:16 a travel carries the last place
// right, through the right-hand column, where no text may sit. Each string used to be drawn whole until it
// touched the zone and not at all the next frame: a fresh critic saw the answer card's byline vanish in one
// frame (launchExample 9:16, 133 to 134). Now it fades over the 120 px before the zone, measured from where
// it rests, so a string resting near a safe edge is not dimmed the moment a travel starts.
//   node tools/test.mjs zoneFade
import { zoneFadeOf } from "../src/canvas-core/launchTemplate";

export const name = "launch template: strings fade before a platform zone";
export const run = (ok: (cond: boolean, label: string) => void) => {
  const S = { x: 0, y: 269, w: 929, h: 1171 }, fade = zoneFadeOf(S);
  // a byline 380 px wide resting at x 450..830, carried right 25 px a frame
  const a = (f: number) => fade(450 + 25 * f, 500, 830 + 25 * f, 534, [25 * f, 0]);
  const seq = Array.from({ length: 12 }, (_, f) => a(f));
  ok(seq[0] === 1, `a string at rest is drawn whole (${seq[0]})`);
  const between = seq.filter((v) => v > 0.02 && v < 0.98).length;
  ok(between >= 3, `RED: carried into the right-hand zone it fades over several frames, never in one (${seq.map((v) => v.toFixed(2)).join(" ")})`);
  ok(seq.every((v, f) => f === 0 || v <= seq[f - 1] + 1e-9) && seq[11] === 0, "it only fades as it goes, and is gone inside the zone");
  // a string resting 10 px from the zone is whole at rest and starts fading only as it moves
  ok(fade(500, 500, 919, 534, [0, 0]) === 1 && fade(503, 500, 922, 534, [3, 0]) < 1, "a string resting near the zone is whole at rest, and fades from there as it moves");
  // the left side has no zone: a string carried off the left edge is not faded by this rule
  ok(fade(-200, 500, 200, 534, [-500, 0]) === 1, "the left side has no zone");
};
