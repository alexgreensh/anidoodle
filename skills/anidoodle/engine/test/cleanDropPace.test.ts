// THE CLEAN DROP KEEPS TO THE BRAND'S TEMPERAMENT. A chat ask's ink drop flies from the button to its answer
// card in 14 frames. In the clean look the drop is one solid streak, which motionscan follows as a coherent
// thing, and on a phone frame, with the hook's composer docked at its own size, the flight was long enough
// that the streak moved at 45 px a frame where a snappy brand allows 36 (launchExampleCleanChat 9:16, 2.8 s).
// The clean drop's flight now takes the frames its distance needs; the drawn look's trail is unchanged.
//   node tools/test.mjs cleanDropPace
import { launchExampleCleanChat } from "../src/canvas-core/launchExampleCleanChat";
import { launchExample } from "../src/canvas-core/launchExample";
import { launchExampleBrand } from "../src/canvas-core/launchExampleBrand";
import type { LaunchFilm } from "../src/canvas-core/launchTemplate";
import { TEMPERAMENTS } from "../src/canvas-core/motionKit";
import { speedCeiling } from "../src/canvas-core/seams";

export const name = "the clean drop keeps to the brand's temperament";
export const run = (ok: (cond: boolean, label: string) => void) => {
  for (const sh of ["16x9", "9x16"]) {
    const r = launchExampleCleanChat.reshape(sh) as LaunchFilm, cap = 0.95 * TEMPERAMENTS.snappy.maxSpeed * speedCeiling(r.meta.W, 30);
    for (const d of r.grammar?.drops ?? []) ok(d.peak <= cap, `RED ${sh}: ask ${d.i}'s drop tops out at ${d.peak.toFixed(1)} px a frame, under ${cap.toFixed(1)} (${d.flight[1] - d.flight[0]} frames)`);
    if (!r.grammar?.drops?.length) ok(false, `${sh}: the film exposes its drops`);
  }
  // THE LANDING. A lively or calm brand's drop takes longer to fly, and an in-out flight's slow last third then
  // crawled for half a second over a dark page (launchExampleBrand, frames 203-233 of 16:9: dead air to the
  // gate). The clean drop keeps a share of its speed to the end and lands as a hit the iris takes over.
  for (const [nm, film] of [["launchExampleCleanChat", launchExampleCleanChat], ["launchExampleBrand", launchExampleBrand]] as const) for (const sh of ["16x9", "9x16"]) {
    const r = (film as LaunchFilm).reshape(sh) as LaunchFilm;
    for (const d of r.grammar?.drops ?? []) ok(d.landing >= 0.3 * d.peak, `RED ${nm} ${sh}: ask ${d.i}'s drop still moves at ${d.landing.toFixed(1)} px a frame as it lands (at least 30 % of its ${d.peak.toFixed(1)} peak)`);
  }
  const w = (launchExample as LaunchFilm).reshape("9x16") as LaunchFilm;
  ok((w.grammar?.drops ?? []).every((d) => d.flight[1] - d.flight[0] === 14), `the drawn example's drops keep their 14 frames`);
};
