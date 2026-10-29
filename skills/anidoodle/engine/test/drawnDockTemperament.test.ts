// THE DRAWN DOCK KEEPS TO THE BRAND'S TEMPERAMENT. The drawn hook's composer docks over an in-out of a
// second. On a phone frame it travels from the middle of the window to its foot, and a calm brand's hook
// (the default drawn scaffold) moved at 44 px a frame where calm allows 31 (motionscan temperament) and its
// type at 45 against half the speed ceiling (layerscan fasttext). The dock now takes longer when the distance
// asks for it; a lively brand's dock keeps its second.
//   node tools/test.mjs drawnDockTemperament
import { makeLaunchFilm, type LaunchFilm } from "../src/canvas-core/launchTemplate";
import { launchExample } from "../src/canvas-core/launchExample";
import { lighthouseDraw } from "../src/canvas-core/lighthouseDraw";
import { TEMPERAMENTS } from "../src/canvas-core/motionKit";
import { speedCeiling } from "../src/canvas-core/seams";

export const name = "the drawn dock keeps to the brand's temperament";
export const run = (ok: (cond: boolean, label: string) => void) => {
  const calm = makeLaunchFilm({ title: "TODO Product", subtitle: "TODO the one line it lives by", placeholder: "Ask for anything…", asks: [{ prompt: "TODO what a user types", plate: lighthouseDraw, label: "TODO byline" }, { prompt: "TODO the follow-up", plate: lighthouseDraw, label: "TODO byline" }], tagline: "t", install: ["npm i x"], bpm: 90, motion: { temperament: "calm", brandColors: ["#cc5533"] }, score: null, sfx: false });
  for (const [id, film, t] of [["calm scaffold", calm, "calm"], ["lively example", launchExample as LaunchFilm, "lively"]] as const) for (const sh of ["16x9", "9x16"]) {
    const r = film.reshape(sh) as LaunchFilm, d = r.grammar?.heroDock;
    if (!d) { ok(false, `${id} ${sh}: the film exposes its dock`); continue; }
    const cap = 0.95 * Math.min(0.5, TEMPERAMENTS[t].maxSpeed) * speedCeiling(r.meta.W, 30);
    ok(d.peak <= cap, `RED ${id} ${sh}: the dock's fastest point ${d.peak.toFixed(1)} px a frame, under ${cap.toFixed(1)} (${d.frames[1] - d.frames[0]} frames)`);
  }
  // a lively brand keeps the one-second dock where the distance allows it
  const w = (launchExample as LaunchFilm).reshape("16x9") as LaunchFilm;
  ok(w.grammar?.heroDock?.frames[1]! - w.grammar?.heroDock?.frames[0]! === 30, `the lively example's wide dock is still 30 frames`);
};
