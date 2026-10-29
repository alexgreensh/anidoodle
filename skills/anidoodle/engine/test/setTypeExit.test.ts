// SET TYPE, LEAVING. A line that sinks out (setType's `out`) used to report its whole line to the frame
// probe on every frame of its exit. Once its glyphs had dropped below their window, the reader rules let
// the probe stand for the words again beside the last stray glyphs ("Month end, h"), a one-frame "read"
// that framecheck failed on a launch template film. A leaving line reports nothing: its glyphs speak for it.
//   node tools/test.mjs setTypeExit
import { setType } from "../src/canvas-core/kinetic";
import type { Ctx, Env } from "../src/canvas-core/core";

export const name = "setType: a leaving line does not report itself whole";
export const run = (ok: (cond: boolean, label: string) => void) => {
  let m = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  const fills: string[] = [];
  const ctx = {
    font: "", fillStyle: "", textBaseline: "", globalAlpha: 1,
    setTransform: (a: number, b: number, c: number, d: number, e: number, f: number) => { m = { a, b, c, d, e, f }; },
    getTransform: () => m, save: () => {}, restore: () => {}, beginPath: () => {}, rect: () => {}, clip: () => {},
    measureText: (s: string) => ({ width: 10 * s.length }), fillText: (s: string) => { fills.push(s); },
  } as unknown as Ctx;
  const env = { W: 100, H: 100, scale: 1, root: true } as unknown as Env;
  const recs: { label: string }[] = [];
  const G = globalThis as unknown as { __ANIDOODLE_PROBE__?: unknown };
  G.__ANIDOODLE_PROBE__ = (r: { label: string }) => recs.push(r);
  try {
    setType(ctx, env, "Month end,", 10, 50, 40, 1);
    ok(recs.length === 1 && recs[0].label === "Month end,", `a standing line reports its box to the probe (${recs.length})`);
    recs.length = 0; fills.length = 0;
    setType(ctx, env, "Month end,", 10, 50, 40, 1, { out: 0.5 });
    ok(recs.length === 0, `RED: a line on its way out reports nothing (got ${recs.length}: ${recs.map((r) => r.label).join(", ")})`);
    ok(fills.length > 0, "its glyphs are still drawn while they sink");
  } finally { delete G.__ANIDOODLE_PROBE__; }
};
