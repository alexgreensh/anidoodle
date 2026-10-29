// THE LAST WORDS STAY INTO THE DROP'S FLIGHT. With the motif, the last split beat's words sank before the drop
// left its bead, and the drop then flew for 0.47 s: on a phone frame the clean scaffold's small product window
// stood alone for 0.53 s, six text blocks in a quarter of the frame (framecheck density, frames 929 to 961,
// over its 0.5 s). The words now finish sinking halfway through the flight, still gone before the drop lands
// and the end card blooms (a fresh critic once saw the bloom eat a word mid-letter).
//   node tools/test.mjs lastWordsFlight
import { makeLaunchFilm, type LaunchFilm } from "../src/canvas-core/launchTemplate";
import { launchExampleClean } from "../src/canvas-core/launchExampleClean";
import type { ProductUI } from "../src/canvas-core/productUI";

export const name = "the last words stay into the drop's flight";
export const run = (ok: (cond: boolean, label: string) => void) => {
  const ui: ProductUI = { title: "TODO", action: "TODO action", before: { items: [{ id: "a", label: "TODO first item" }, { id: "b", label: "TODO second item" }] }, after: { items: [{ id: "b", label: "TODO second item", done: true, accent: true }, { id: "a", label: "TODO first item", tag: "TODO", done: true }] } };
  const f = makeLaunchFilm({ title: "TODO Product", preset: "clean", fps: 60, asks: [{ kind: "ui", ui, prompt: "TODO what a user asks" }, { kind: "ui", ui, split: [{ text: "TODO the feature,", style: "ink", color: "#15161a" }, { text: "in five words.", style: "ink", color: "#2f54eb" }] }], words: [[{ text: "TODO CLAIM.", style: "ink", color: "#15161a" }]], tagline: "t", install: ["npm i x"], bpm: 90, claimBar: 6, score: null, motion: { temperament: "calm", brandColors: ["#2f54eb"] } });
  for (const [id, film] of [["scaffold", f], ["clean example", launchExampleClean as LaunchFilm]] as const) for (const sh of ["16x9", "9x16"]) {
    const w = (film.reshape(sh) as LaunchFilm).grammar?.lastWords;
    if (!w) { ok(false, `${id} ${sh}: the film exposes its last words' timing`); continue; }
    const [a, b] = w.flight, half = a + Math.floor((b - a) / 2);
    ok(w.gone >= half - 1, `RED ${id} ${sh}: the words are still leaving halfway through the flight (gone at ${w.gone}, flight ${a}-${b})`);
    ok(w.gone < b, `${id} ${sh}: and gone before the drop lands (${w.gone} < ${b})`);
  }
};
