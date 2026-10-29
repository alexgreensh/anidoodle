// WRITTEN LINES, LEAVING. The drawn launch preset's word pages are places on one canvas, like the clean
// preset's: the camera travels to them and on, so a written line needs a way to leave IN PLACE before the
// move carries it into a platform zone or across the frame's edge. writeOn's `out` sinks the written
// line behind its own baseline (the same ease-in exit as setType), and a leaving line reports nothing to
// the frame probe: its strokes speak for what is still showing.
//   node tools/test.mjs writeOnExit
import { writeOn } from "../src/canvas-core/kinetic";
import type { Ctx, Env } from "../src/canvas-core/core";
import { FakeCanvas } from "./fakeCanvas";

export const name = "writeOn: a written line sinks out and stops reporting itself";
export const run = (ok: (cond: boolean, label: string) => void) => {
  const canvas = new FakeCanvas(400, 400), raw = canvas.ctx;
  // the y of every point the strokes are drawn through, in device pixels
  const ys: number[] = [];
  const dev = (x: number, y: number) => raw.T.b * x + raw.T.d * y + raw.T.f;
  const ctx = new Proxy(raw, {
    get(t, k) {
      if (k === "moveTo" || k === "lineTo") return (x: number, y: number) => { ys.push(dev(x, y)); };
      if (k === "quadraticCurveTo") return (_cx: number, _cy: number, x: number, y: number) => { ys.push(dev(x, y)); };
      const v = Reflect.get(t, k); return typeof v === "function" ? v.bind(t) : v;
    },
    set(t, k, v) { return Reflect.set(t, k, v); },
  }) as unknown as Ctx;
  const env = { W: 400, H: 400, scale: 1, root: true, cache: new Map() } as unknown as Env;
  const recs: { label: string }[] = [];
  const G = globalThis as unknown as { __ANIDOODLE_PROBE__?: unknown };
  G.__ANIDOODLE_PROBE__ = (r: { label: string }) => recs.push(r);
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / Math.max(1, a.length);
  try {
    writeOn(ctx, env, "IDEA IN.", 20, 200, 60, 1, "ink");
    const standing = mean(ys);
    ok(recs.length === 1 && ys.length > 0, `a standing written line reports its box and draws (${recs.length} record, ${ys.length} points)`);
    recs.length = 0; ys.length = 0;
    writeOn(ctx, env, "IDEA IN.", 20, 200, 60, 1, "ink", { out: 0.6 } as never);
    ok(recs.length === 0, `RED: a written line on its way out reports nothing (got ${recs.length})`);
    ok(ys.length > 0 && mean(ys) > standing + 10, `RED: its strokes sink below where they stood (mean y ${mean(ys).toFixed(1)} against ${standing.toFixed(1)})`);
    ys.length = 0;
    writeOn(ctx, env, "IDEA IN.", 20, 200, 60, 1, "ink", { out: 1 } as never);
    ok(ys.length === 0, `RED: a line that has left draws nothing (${ys.length} points)`);
  } finally { delete G.__ANIDOODLE_PROBE__; }
};
