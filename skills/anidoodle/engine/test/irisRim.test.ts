// THE CLEAN IRIS HAS AN EDGE. The clean look's answer card opens as an iris: a circle growing from where the
// drop landed, the answer inside it. With nothing but the answer's own ground to mark it, a fresh critic saw
// a pale disc on a cream card, "the chart fading in, not an iris opening" (cc1-3; on 9:16 the card is small
// and the disc was faint at speed). While it opens, the iris now draws its rim in the drop's colour, solid,
// so the drop visibly opens into the ring; once open, the card has no rim.
//   node tools/test.mjs irisRim
import { CHAT_GEOM, inkCard, type ChatGeom } from "../src/canvas-core/launchKit";
import type { Ctx, Layer } from "../src/canvas-core/core";
import { FakeCanvas } from "./fakeCanvas";

export const name = "the clean iris has an edge while it opens";
export const run = (ok: (cond: boolean, label: string) => void) => {
  const raw = new FakeCanvas(400, 400).ctx, strokes: { style: string; alpha: number }[] = [];
  const ctx = new Proxy(raw, {
    get(t, k) { if (k === "stroke") return () => strokes.push({ style: String(t.strokeStyle), alpha: t.globalAlpha }); const v = Reflect.get(t, k); return typeof v === "function" ? v.bind(t) : v; },
    set(t, k, v) { return Reflect.set(t, k, v); },
  }) as unknown as Ctx;
  const art = { canvas: new FakeCanvas(10, 10) } as unknown as Layer, d = { t0: 0, land: 10, full: 30 };
  const g: ChatGeom = { ...CHAT_GEOM, iris: true, drop: "#2f54eb" };
  const at = (grow: number) => { strokes.length = 0; (inkCard as (...a: unknown[]) => void)(ctx, 20, 60, 200, 20, d, art, "", undefined, g, () => grow); return strokes.filter((s) => s.style.toLowerCase() === "#2f54eb"); };
  const opening = at(0.5);
  ok(opening.length > 0 && opening.every((s) => s.alpha === 1), `RED: half open, the iris draws a solid rim in the drop's colour (${opening.length} stroke(s))`);
  ok(at(1).length === 0, "open, the card has no rim");
  // (once the ring is wider than the card it showed as four blue arcs at the corners, a fresh critic's cc3-2)
  ok(at(0.9).length === 0, "RED: a ring wider than the card is not drawn (no arcs left in its corners)");
  const drawn = { ...CHAT_GEOM, drop: "#2f54eb" } as ChatGeom; strokes.length = 0;
  (inkCard as (...a: unknown[]) => void)(ctx, 20, 60, 200, 20, d, art, "", undefined, drawn, () => 0.5);
  ok(!strokes.some((s) => s.style.toLowerCase() === "#2f54eb"), "the drawn look's ink bloom is unchanged (no rim)");
};
