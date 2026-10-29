// LAUNCH TEMPLATE GRAMMAR. The moves both presets are built from, checked as data on the two worked
// examples (launchExample, drawn; launchExampleClean, clean) in 16:9 and 9:16, so a film copied from the
// template passes ship's motion and layer scans by construction. Each line is a fix a ship run or a fresh
// critic forced (reports/TEMPLATE2.md):
//   the drawn preset's word pages are places the camera travels to, never an ink bloom swapped in place
//     (seven slide cuts in sixteen seconds on the drawn example);
//   Generate is pressed only once the hook's composer has docked (a button pressed on the move);
//   frame 0, the thumbnail, shows the first prompt typed to a whole word ("a lighthouse at s");
//   the thread scrolls once per ask, at most three quarters of half the speed ceiling (type at 150 px a frame);
//   the end card's bloom opens no faster than the brand's temperament allows (its rim at 200 px a frame);
//   a wide frame's travels alternate (down, up, down), never one direction twice in a row;
//   on a tall frame a word page's lines are gone before the travel's edge reaches them;
//   a product's drop swells beside its action, never on the button's word.
//   node tools/test.mjs launchGrammar
import { launchExample } from "../src/canvas-core/launchExample";
import { launchExampleClean } from "../src/canvas-core/launchExampleClean";
import { typedAt } from "../src/canvas-core/launchKit";
import { TEMPERAMENTS } from "../src/canvas-core/motionKit";
import { speedCeiling } from "../src/canvas-core/seams";
import { uiActionRect, type ProductUI } from "../src/canvas-core/productUI";
import { sinkOf, type LaunchFilm } from "../src/canvas-core/launchTemplate";
import { typeExit } from "../src/canvas-core/motionKit";

export const name = "launch template grammar (both presets, 16:9 and 9:16)";
export const run = (ok: (cond: boolean, label: string) => void) => {
  const films: [string, LaunchFilm][] = [];
  for (const [id, f] of [["drawn", launchExample], ["clean", launchExampleClean]] as const) for (const sh of ["16x9", "9x16"]) films.push([`${id} ${sh}`, (f as LaunchFilm).reshape(sh)]);
  const TRV = 42, glide = (q: number) => { const c = Math.min(1, Math.max(0, q)), r = 0.1, v = 1 / (1 - r); return c < r ? (v * c * c) / (2 * r) : c > 1 - r ? 1 - (v * (1 - c) * (1 - c)) / (2 * r) : v * (c - r / 2); };
  for (const [id, film] of films) {
    const g = (film as Partial<LaunchFilm>).grammar, W = film.layout.W, T = film.timing;
    // frame 0 is a whole word
    const prompts = id.startsWith("drawn") ? ["a lighthouse at sunset, as a print"] : ["match every receipt from September"];
    const typed = typedAt(prompts[0], 0, T[0].times), next = prompts[0][typed.length];
    ok(typed.length > 0 && (next === " " || next === undefined), `RED ${id}: frame 0 shows "${typed}", a whole word`);
    // the drawn preset travels into and out of its word pages; Generate waits for the dock
    if (id.startsWith("drawn")) {
      ok(T[1].tin > 0 && (!g || (g.travels.some((t) => t.seam === "page:0") && g.travels.some((t) => t.seam === "ask:1"))), `RED ${id}: the word page is reached by a travel and left by one (into ask 1 over ${T[1].tin} frames)`);
      ok(T[0].down >= T[0].b - 8 + 30, `RED ${id}: Generate goes down at ${T[0].down}, after the dock lands at ${T[0].b - 8 + 30}`);
    }
    ok(!!g, `RED ${id}: the film exposes its grammar`);
    if (!g) continue;
    // one scroll per ask, under the pace
    const cap = 0.75 * 0.5 * speedCeiling(W, 30);
    ok(g.scrolls.every((q) => (1.12 * q.d) / q.len <= cap + 1e-9 && q.len >= 30), `RED ${id}: every thread scroll peaks at or under ${cap.toFixed(1)} px a frame (${g.scrolls.map((q) => `${Math.round(q.d)} px in ${q.len}`).join(", ") || "no chat ask"})`);
    // the end bloom's rim keeps to the temperament
    const temper = TEMPERAMENTS[id.startsWith("drawn") ? "lively" : "snappy"], pace = temper.maxSpeed * speedCeiling(W, 30);
    ok(g.endBloom.radius / g.endBloom.frames <= 0.9 * pace + 1e-9, `RED ${id}: the end card's bloom opens at ${(g.endBloom.radius / g.endBloom.frames).toFixed(1)} px a frame, the ${temper.name} limit is ${pace.toFixed(1)}`);
    // and it opens from the landed drop: the drop arrives at the dot's own size, never swelling into a disc
    ok(film.seams.every((m) => m.into.r <= 0.06 * g.endBloom.radius), `${id}: the drop lands at the dot's size (${film.seams.map((m) => Math.round(m.into.r)).join(", ")} px; the bloom ends at ${Math.round(g.endBloom.radius)})`);
    // travels turn on a wide frame
    if (W > film.layout.H) ok(g.travels.every((t, j) => j === 0 || t.ax[0] !== g.travels[j - 1].ax[0] || t.ax[1] !== g.travels[j - 1].ax[1]), `RED ${id}: no two travels in a row go the same way (${g.travels.map((t) => (t.ax[1] > 0 ? "down" : t.ax[1] < 0 ? "up" : "sideways")).join(", ")})`);
    // on a tall frame the page's lines are gone before the travel's edge reaches them
    if (W < film.layout.H) for (const p of g.pages) {
      const L = film.layout, at = L.type.at!, x0 = at[0] - L.type.maxW / 2, left = at[0] + (x0 - at[0]) * 1.03, ax = Math.abs(g.travels.find((t) => t.seam === `ask:${p.i + 1}`)!.ax[0]);
      const gone = p.out + 18 - 120; // frames into the travel out when the last line has sunk (SINK 18, TYPE 120)
      ok(glide(gone / TRV) * ax <= left, `RED ${id}: page ${p.i}'s lines are gone ${gone} frames into the travel, when its edge has moved ${Math.round(glide(gone / TRV) * ax)} px of the ${Math.round(left)} px before them`);
    }
  }
  // after a product's click the pointer rests above its window, never on a row's figure (a fresh critic saw it
  // settle on "$1,208" on 9:16); the arrow's glyph is 29 units tall at its scale
  for (const sh of ["16x9", "9x16"]) {
    const g = ((launchExampleClean as LaunchFilm).reshape(sh) as Partial<LaunchFilm>).grammar as (LaunchFilm["grammar"] & { rests?: { i: number; tip: [number, number]; win: { x: number; y: number; w: number; h: number }; s: number }[] }) | undefined;
    const rests = g?.rests ?? [];
    ok(rests.length > 0 && rests.every((q) => q.tip[1] + 29 * q.s <= q.win.y), `RED clean ${sh}: after each click the pointer rests clear above the product window (${rests.map((q) => `ask ${q.i}: arrow ends ${Math.round(q.tip[1] + 29 * q.s)}, window starts ${Math.round(q.win.y)}`).join("; ") || "no rest recorded"})`);
  }
  // a page's lines sink one after another with no still frame between them (two lines back to back left
  // the gate an identical pair at 60 fps): over a 0.6 s sink at 60 fps, every frame moves some line
  for (const nL of [2, 3]) {
    const N = 36, low: number[] = [];
    for (let f = 1; f <= N; f++) { let m = 0; for (let j = 0; j < nL; j++) m = Math.max(m, Math.abs(typeExit(sinkOf(f / N, j, nL)) - typeExit(sinkOf((f - 1) / N, j, nL)))); if (m < 0.004 && f > 12) low.push(f); } // (its first 6 frames at 30 fps are an ease-in from rest, declared with the page's hold)
    ok(!low.length && [...Array(nL).keys()].every((j) => sinkOf(1, j, nL) === 1), `RED ${nL} lines: every frame of the sink past its declared start moves a line, and all are gone at its end (still at ${low.join(", ") || "none"})`);
  }
  // the clean example's last ask is a product screen: its drop swells beside the action, clear of its word
  // (the drop's centre plus its radius stays left of the button at any push the split panel can have, 1 to 1.13)
  for (const sh of ["16x9", "9x16"]) {
    const f = (launchExampleClean as LaunchFilm).reshape(sh), g = (f as Partial<LaunchFilm>).grammar, L = f.layout;
    const ui = { title: "Tally", nav: ["Reports", "Books"], action: "Explain", before: { items: [0, 1, 2, 3].map((i) => ({ id: `${i}`, label: "x", value: "$1", bar: 0.5 })) }, after: { items: [0, 1, 2, 3].map((i) => ({ id: `${i}`, label: "x", value: "$1", bar: 0.5 })) } } as ProductUI;
    const r = L.split.ui, a = uiActionRect(r, ui, L.phone ? 32 : 18), cx = r.x + r.w / 2, left = Math.min(...[1, 1.13].map((z) => cx + (a.x - cx) * z)), rad = 30 * L.k;
    ok(!!g && g.lift[0] + rad <= left, `RED clean ${sh}: the drop swells beside Explain (its edge at ${g ? Math.round(g.lift[0] + rad) : "?"}, the button starts at ${Math.round(left)})`);
  }
};
