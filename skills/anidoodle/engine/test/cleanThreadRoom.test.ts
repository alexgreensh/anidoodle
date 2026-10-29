// THE FIRST ANSWER FITS UNDER ITS QUESTION. In the clean look the hook's composer docks at its own size, so it
// stands taller than the laid-out one and the thread's view ends higher. On a phone the answer card shrank to
// fit; on 16:9 it kept its size, so the thread scrolled the question bubble up under the header rule and off,
// and still clipped the card's foot (a fresh critic, cc2-1: "the answer opens with no question above it").
// The card now shrinks to the view on every shape, so the first question and its answer fit with no scroll.
//   node tools/test.mjs cleanThreadRoom
import { launchExampleCleanChat } from "../src/canvas-core/launchExampleCleanChat";
import type { LaunchFilm } from "../src/canvas-core/launchTemplate";

export const name = "the first answer fits under its question";
export const run = (ok: (cond: boolean, label: string) => void) => {
  for (const sh of ["16x9", "9x16"]) {
    const g = (launchExampleCleanChat.reshape(sh) as LaunchFilm).grammar, q = g?.scrolls.find((x) => x.i === 0);
    ok(!!q && q.d <= 0.5, `RED ${sh}: the first question and its answer fit the thread's view with no scroll (scrolls ${q?.d.toFixed(0)} px)`);
  }
};
