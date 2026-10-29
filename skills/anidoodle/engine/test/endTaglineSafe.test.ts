// THE END CARD'S LINE STAYS IN THE SAFE RECTANGLE. On a phone the clean end card centres its tagline on the
// frame's axis, but wrapped it to 90 % of the safe rectangle's width, which is narrower on the right (the
// platforms' button column): a line measured from a real face ran into that column for 259 frames
// (launchExampleBrand 9:16, framecheck zones). Each line is now wrapped to the width the axis leaves it inside
// the safe rectangle.
//   node tools/test.mjs endTaglineSafe
import { launchExampleBrand } from "../src/canvas-core/launchExampleBrand";
import { launchExampleClean } from "../src/canvas-core/launchExampleClean";
import type { LaunchFilm } from "../src/canvas-core/launchTemplate";

export const name = "the end card's line stays in the safe rectangle";
export const run = (ok: (cond: boolean, label: string) => void) => {
  for (const [id, film] of [["brand", launchExampleBrand], ["clean", launchExampleClean]] as const) for (const sh of ["16x9", "9x16"]) {
    const e = ((film as LaunchFilm).reshape(sh) as LaunchFilm).grammar.endCard;
    const worst = Math.max(...e.taglineW.map((w) => e.cx + w / 2 - e.room[1]), ...e.taglineW.map((w) => e.room[0] - (e.cx - w / 2)));
    ok(worst <= -8, `RED ${id} ${sh}: every tagline line ends 8 px or more inside the room (${e.tagline.join(" / ")}: ${worst.toFixed(0)} px)`);
  }
};
