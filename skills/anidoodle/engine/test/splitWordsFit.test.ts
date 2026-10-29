// SPLIT WORDS FIT THEIR COLUMN. On a phone the split beat stacks its words over the live product, in a
// column a third of the window tall. The words were sized to the column's width only: the clean scaffold's
// stand-in "TODO the feature, TODO in five words." wrapped to four lines and ran down over the product
// window (framecheck: text over text, and over the window's edge, frames 595 to 890 on 9:16). They are now
// set smaller and wrapped again until they fit the column's height too, never under the phone-safe size.
//   node tools/test.mjs splitWordsFit
import { makeLaunchFilm, type LaunchFilm } from "../src/canvas-core/launchTemplate";
import { launchExampleClean } from "../src/canvas-core/launchExampleClean";
import type { ProductUI } from "../src/canvas-core/productUI";

export const name = "split words fit their column";
export const run = (ok: (cond: boolean, label: string) => void) => {
  const ui: ProductUI = { title: "T", action: "Go", before: { items: [{ id: "a", label: "x" }] }, after: { items: [{ id: "a", label: "x", done: true }] } };
  const f = makeLaunchFilm({ title: "TODO Product", preset: "clean", fps: 60, asks: [{ kind: "ui", ui, prompt: "TODO what a user asks the product" }, { kind: "ui", ui, split: [{ text: "TODO the feature,", style: "ink", color: "#15161a" }, { text: "TODO in five words.", style: "ink", color: "#2f54eb" }] }], words: [[{ text: "TODO CLAIM.", style: "ink", color: "#15161a" }]], tagline: "t", install: ["npm i x"], bpm: 90, claimBar: 6, score: null });
  for (const [id, film] of [["scaffold words", f], ["clean example", launchExampleClean as LaunchFilm]] as const) for (const sh of ["16x9", "9x16"]) {
    const g = (film.reshape(sh) as Partial<LaunchFilm>).grammar;
    for (const q of g?.splits ?? []) ok(q.tall <= q.room.h + 0.5, `RED ${id} ${sh}: ask ${q.i}'s words (${q.lines.length} lines at ${q.size.toFixed(0)} px) take ${q.tall.toFixed(0)} px of their ${q.room.h.toFixed(0)} px column`);
    if (!g?.splits?.length) ok(false, `${id} ${sh}: the film exposes its split words`);
  }
  // the clean example's words, which already fitted, are set exactly as before
  const s9 = ((launchExampleClean as LaunchFilm).reshape("9x16") as LaunchFilm).grammar.splits;
  ok(s9.every((q) => q.lines.length === 2), `the clean example's words keep their two lines on 9:16 (${s9.map((q) => q.lines.join(" / ")).join("; ")})`);
};
