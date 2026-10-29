// A SPLIT BEAT'S WORDS ARE READ FROM THE MOMENT THEY ARE SET. On a clean split beat reached by a travel, the
// words rise on the way in and the action is pressed after them; between the landing and the press the
// product rests in its before state while the words are read. The declared reading hold began only once the
// after state had landed, so those half-second of reading read to the gate as dead air
// (launchExampleCleanChat 16:9, frames 661 to 697). The hold now starts when the words are set.
// The press's own short hold and the end card's are unchanged.
//   node tools/test.mjs splitReadHold
import { launchExampleCleanChat } from "../src/canvas-core/launchExampleCleanChat";
import type { LaunchFilm } from "../src/canvas-core/launchTemplate";

export const name = "a split beat's words are read from when they are set";
export const run = (ok: (cond: boolean, label: string) => void) => {
  for (const sh of ["16x9", "9x16"]) {
    const f = launchExampleCleanChat.reshape(sh) as LaunchFilm, holds = (f.meta.holds ?? []) as [number, number][];
    // the press's hold is the short one inside the inbox beat (560 to 960 at 60 fps)
    const press = holds.find(([a, b]) => a > 560 && a < 960 && b - a < 10);
    if (!press) { ok(false, `${sh}: the inbox beat declares its press`); continue; }
    const covered = (x: number) => holds.some(([a, b]) => a <= x && x <= b);
    const gaps = []; for (let x = press[0] - 40; x < press[0]; x++) if (!covered(x)) gaps.push(x);
    ok(gaps.length === 0, `RED ${sh}: the 40 frames before the press, words set and being read, are declared (${gaps.length} not: ${gaps[0] ?? ""}-${gaps[gaps.length - 1] ?? ""})`);
    // and the hold still ends where the words sink, not at the end card
    const read = holds.find(([a, b]) => a <= press[0] - 1 && b >= press[1] && b - a > 10);
    ok(!!read && read[1] < 960, `${sh}: the reading hold ends inside the beat (${read?.join("-")})`);
  }
};
