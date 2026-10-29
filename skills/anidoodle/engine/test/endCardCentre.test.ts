// END CARD CENTRE (critic finding d4-1). The stacked end card sat 8 to 20 px left of the frame's centre
// on both shapes, every line of it by the same amount. The cause was its settle: the page leans in 3 %
// about the motif's dot, which sits at the right end of the name, so the lean carried the whole card
// left by 3 % of the dot's distance from the axis (20 px on 16:9, 11 px on 9:16). The settle now zooms
// about a point on the card's own axis, and the name with its dot is centred on that axis by its ink
// (kinetic.inkSpan), not its advance width. Measured on the render after the fix: every line of the drawn
// example's card within 1.5 px of the centre on both shapes.
//   node tools/test.mjs endCardCentre
import { launchExample } from "../src/canvas-core/launchExample";
import { makeLaunchFilm, type LaunchFilm } from "../src/canvas-core/launchTemplate";
import type { ProductUI } from "../src/canvas-core/productUI";
import { inkSpan, measure } from "../src/canvas-core/kinetic";

export const name = "end card centre (d4-1)";
export const run = (ok: (cond: boolean, label: string) => void) => {
  // a written name's ink starts a side bearing after its advance does (measured on the render: 6 px at 150 px)
  { const [l, r] = inkSpan("Your Product", 150, { seed: 11 }); ok(l > 2 && l < 12 && r > measure("Your Product", 150) - 20, `RED a written line's ink span is its strokes plus the nib (${l.toFixed(1)} to ${r.toFixed(1)}, advance ${measure("Your Product", 150).toFixed(1)})`); }
  const ui: ProductUI = { title: "T", nav: ["A"], action: "Go", before: { items: [{ id: "a", label: "x", value: 1 }] }, after: { items: [{ id: "a", label: "x", value: 0, done: true }] } };
  const clean = makeLaunchFilm({ title: "Tally", preset: "clean", asks: [{ kind: "ui", ui, prompt: "match every receipt" }], tagline: "Bookkeeping that does itself", install: ["npm i tally"], bpm: 90, score: null });
  for (const [id, f] of [["drawn", launchExample as LaunchFilm], ["clean stack", clean]] as const) for (const sh of ["16x9", "9x16"]) {
    const g = (f.reshape(sh) as Partial<LaunchFilm>).grammar?.endCard;
    if (!g) { ok(false, `RED ${id} ${sh}: the film exposes its end card's geometry`); continue; }
    // where the card's axis lands once the settle has leaned in its full 3 %
    const z = 1.03, axis = g.creep[0] + (g.cx - g.creep[0]) * z;
    ok(Math.abs(axis - g.cx) < 0.5, `RED ${id} ${sh}: the settle keeps the card on its axis (x ${g.cx.toFixed(0)} lands at ${axis.toFixed(1)}; it zooms about x ${g.creep[0].toFixed(0)})`);
    const mid = (g.group[0] + g.group[1]) / 2;
    ok(Math.abs(mid - g.cx) < 1, `${id} ${sh}: the name and its dot are centred on the axis (their middle ${mid.toFixed(1)}, the axis ${g.cx.toFixed(0)})`);
  }
};
