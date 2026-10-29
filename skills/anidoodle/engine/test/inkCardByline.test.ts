// AN ANSWER CARD'S BYLINE, DOT AND WORDS TOGETHER. The card's byline is a dot and a line of words. The
// launch template leaves the words out once the thread scrolls them under its window's top, and a fresh
// critic saw the dot stay behind on its own (9:16, the lean before the word page). The dot belongs to
// the words: no words, no dot, and a byline fading out (labelA) takes both with it.
//   node tools/test.mjs inkCardByline
import { inkCard, TEXT_SHOWN } from "../src/canvas-core/launchKit";
import type { Ctx, Layer } from "../src/canvas-core/core";
import { FakeCanvas } from "./fakeCanvas";

export const name = "inkCard: the byline's dot goes with its words";
export const run = (ok: (cond: boolean, label: string) => void) => {
  const raw = new FakeCanvas(400, 400).ctx;
  const marks: { kind: string; alpha: number }[] = [];
  const ctx = new Proxy(raw, {
    get(t, k) {
      if (k === "arc") return () => marks.push({ kind: "dot", alpha: t.globalAlpha });
      if (k === "fillText") return () => marks.push({ kind: "words", alpha: t.globalAlpha });
      const v = Reflect.get(t, k); return typeof v === "function" ? v.bind(t) : v;
    },
    set(t, k, v) { return Reflect.set(t, k, v); },
  }) as unknown as Ctx;
  const art = { canvas: new FakeCanvas(10, 10) } as unknown as Layer, d = { t0: 0, land: 10, full: 30 };
  const shown = (label: string, labelA?: number) => { marks.length = 0; (inkCard as (...a: unknown[]) => void)(ctx, 20, 60, 200, 100, d, art, label, undefined, undefined, () => 1, labelA); return marks.filter((m) => m.alpha > 0.001).map((m) => m.kind); };
  const full = shown("print · drawn in code");
  ok(full.includes("dot") && full.includes("words"), `a card with a byline draws its dot and its words (${full.join(", ")})`);
  ok(!shown("").includes("dot"), "RED: a card whose byline is left out draws no dot either");
  // a surface that withholds the words (a travel's zone fade) says so, and the dot stays out with them
  const surface = (share: number) => new Proxy(ctx as object, { get(t, k) { if (k === "fillText") return () => { (t as Record<symbol, number>)[TEXT_SHOWN] = share; }; const v = Reflect.get(t, k); return typeof v === "function" ? v.bind(t) : v; }, set(t, k, v) { return Reflect.set(t, k, v); } }) as unknown as Ctx;
  marks.length = 0; (inkCard as (...a: unknown[]) => void)(surface(0), 20, 60, 200, 100, d, art, "print · drawn in code", undefined, undefined, () => 1);
  ok(!marks.some((m) => m.kind === "dot"), `RED: words withheld by the surface (a zone fade) take the dot with them (${marks.map((m) => m.kind).join(", ") || "nothing"})`);
  // and words the surface draws at 40 % (fading toward a zone) take the dot down to 40 % with them
  marks.length = 0; (inkCard as (...a: unknown[]) => void)(surface(0.4), 20, 60, 200, 100, d, art, "print · drawn in code", undefined, undefined, () => 1);
  const dot = marks.find((m) => m.kind === "dot");
  ok(!!dot && Math.abs(dot.alpha - 0.4) < 1e-6, `RED: words faded to 40 % by the surface fade their dot to 40 % too (dot at ${dot ? dot.alpha.toFixed(2) : "none"})`);
  const faded = shown("print · drawn in code", 0);
  ok(!faded.includes("dot") && !faded.includes("words"), `RED: a byline faded to nothing takes its dot with it (${faded.join(", ") || "nothing"})`);
};
