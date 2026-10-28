// THREE TIMELINE TESTS. src/three-core/timeline.ts compiles director-style combinators to flat
// tweens and reads any frame purely. Timing must be exact to the frame, frames must agree in any
// order, and check() must catch two tweens fighting (a red fixture beside the green one).
//   node tools/test.mjs threeTimeline
import { all, chain, delay, fromTo, loop, mix, sequence, set, timeline, to, wait } from "../src/three-core/timeline";
import { ease } from "../src/three-core/time";

export const name = "threeTimeline";
export const run = (ok: (cond: boolean, label: string) => void) => {
  const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;

  // 1. easing ends: every curve starts at 0 and lands on 1 exactly
  const bad = Object.entries(ease).filter(([, e]) => !near(e(0), 0, 1e-12) || !near(e(1), 1, 1e-12)).map(([k]) => k);
  ok(bad.length === 0, `every ease is 0 at 0 and 1 at 1 (${Object.keys(ease).length} curves${bad.length ? `, off: ${bad.join(", ")}` : ""})`);
  ok(ease.outBack(0.7) > 1, "outBack overshoots before it lands");

  // 2. chain / all / sequence / delay / loop land on exact frames
  const tl = timeline(24, { labels: { drop: 48 }, words: [{ text: "Three,", frame: 96 }, { text: "three", frame: 130 }] });
  tl.at(0, set("a", 0), set("b", 0), set("c", 0), set("d", 0), set("e", 0));
  tl.at(10, chain(to("a", 1, 12, ease.linear), wait(6), to("a", 2, 12, ease.linear)));
  tl.at(10, all(to("b", 5, 4, ease.linear), to("c", 5, 20, ease.linear)));
  tl.at(10, sequence(3, to("d", 1, 6, ease.linear), fromTo("e", 10, 20, 6, ease.linear)));
  ok(tl.num("a", 22) === 1 && tl.num("a", 28) === 1 && near(tl.num("a", 34), 1.5) && tl.num("a", 40) === 2, "chain: first tween ends at 22, holds through the wait, second ends at 40");
  ok(tl.num("b", 14) === 5 && near(tl.num("c", 14), 1) && tl.num("c", 30) === 5, "all: both start at 10, each ends at its own length");
  ok(tl.num("e", 12) === 0 && tl.num("e", 13) === 10 && tl.num("e", 19) === 20, "sequence: the second clip starts exactly 3 frames later (fromTo jumps to its start)");
  ok(sequence(4, wait(10), wait(10), wait(3)).len === 14 && chain(wait(5), all(wait(3), wait(7))).len === 12 && delay(5, wait(3)).len === 8, "lengths: sequence = last start + its length, chain = sum, all = max, delay adds");
  const tl2 = timeline(24);
  tl2.at(0, set("x", 0), loop(3, (i) => chain(to("x", i + 1, 4, ease.linear), wait(2))));
  ok(tl2.num("x", 4) === 1 && tl2.num("x", 10) === 2 && tl2.num("x", 16) === 3 && tl2.end === 16, "loop: three passes of 6 frames, each pass may vary");

  // 3. holds before the first key and after the last
  ok(tl.num("a", -50) === 0 && tl.num("a", 9999) === 2, "a track holds its first value before and its last after");
  const lone = timeline(24); lone.at(20, fromTo("y", 3, 4, 10));
  ok(lone.num("y", 0) === 3 && lone.num("y", 100) === 4, "a fromTo alone holds its `from` before it starts");

  // 4. labels and spoken-word cues
  tl.at("drop", fromTo("f", 0, 1, 12, ease.linear)).at({ word: "three" }, fromTo("g", 0, 1, 1)).at({ word: "three", nth: 1, offset: 2 }, fromTo("h", 0, 1, 1));
  ok(tl.num("f", 54) === 0.5 && tl.frame("drop") === 48, "a label places a clip on its frame");
  ok(tl.frame({ word: "three" }) === 96 && tl.num("g", 95) === 0 && tl.num("g", 97) === 1 && tl.frame({ word: "three", nth: 1, offset: 2 }) === 132, "word cues match case- and punctuation-free, by occurrence, with an offset");
  let threw = ""; try { tl.at("nope", wait(1)); } catch (e) { threw = String(e); } ok(threw.includes("no label 'nope'"), "an unknown label is refused by name");
  let threw2 = ""; try { const t = timeline(24); t.at(4, to("z", 1, 4)); t.value("z", 5); } catch (e) { threw2 = String(e); } ok(threw2.includes("no starting value"), "a to() on a track that was never set is refused, not started from a silent 0");

  // 5. values: vectors and colours (linear light)
  const tv = timeline(24); tv.at(0, set("p", [0, 0, 0]), set("col", "#ff0000")).at(0, to("p", [2, 4, -6], 10, ease.linear), to("col", "#00ff00", 10, ease.linear));
  const pv = tv.vec("p", 5); ok(pv[0] === 1 && pv[1] === 2 && pv[2] === -3, "vectors mix per axis");
  ok(tv.color("col", 5) === "#bcbc00" && mix("#ff0000", "#00ff00", 0.5) === "#bcbc00", "red to green passes through a bright yellow in linear light (#bcbc00, not the muddy #808000)");
  ok(tv.color("col", 0) === "#ff0000" && tv.color("col", 10) === "#00ff00", "colour ends are exact");

  // 6. purity: random order equals sequence
  const frames = Array.from({ length: 160 }, (_, i) => i - 10), seq = frames.map((f) => JSON.stringify(tl.sample(f)));
  let s = 12345; const shuffled = [...frames].sort(() => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) - 0.5);
  const byFrame = new Map(shuffled.map((f) => [f, JSON.stringify(tl.sample(f))]));
  ok(frames.every((f, i) => byFrame.get(f) === seq[i]), "160 frames sampled in a shuffled order equal the frames sampled in sequence");

  // 7. check(): green, then red fixtures
  ok(tl.check({ beat: 1 }).length === 0, "a timeline with no fights and integer cues has nothing to report");
  const red = timeline(24); red.at(0, set("x", 0)).at(0, to("x", 1, 12)).at(6, to("x", 2, 12));
  const fights = red.check(); ok(fights.length === 1 && fights[0].track === "x" && fights[0].frame === 6, `RED: two tweens writing 'x' at once are named (${fights[0]?.msg ?? "none"})`);
  ok(red.num("x", 18) === 2, "and the later-starting tween is the one that wins");
  const grid = timeline(24, { beat: 12 }); grid.at(0, set("x", 0)).at(24, to("x", 1, 6)).at(30, to("x", 2, 6));
  const off = grid.check(); ok(off.length === 1 && off[0].frame === 30, "RED: a cue at frame 30 on a 12-frame beat is off the grid");
  ok(grid.check({ subdiv: 2 }).length === 0, "and allowed when the grid is split into half beats");
};
