// A WORD BEING TYPED STAYS ON ITS LINE. A wrapping composer broke the words as they were typed so far: a word
// that fit half typed ("which sources dis") jumped to the next line once it grew past the edge, and the line it
// left had stood 0.15 s (framecheck reading time, launchExampleBrand 9:16). Given the whole prompt, the
// composer breaks where the finished prompt breaks, so a word starts on the line it will end on.
//   node tools/test.mjs typedWrap
import { composerLines, type ChatGeom } from "../src/canvas-core/launchKit";

export const name = "a word being typed stays on its line";
export const run = (ok: (cond: boolean, label: string) => void) => {
  const stub = { font: "", measureText: (t: string) => ({ width: t.length * parseFloat(/([\d.]+)px/.exec(stub.font)?.[1] ?? "10") * 0.5 }) };
  const ctx = stub as unknown as Parameters<typeof composerLines>[0];
  const g = { k: 1, TEXT: { x: 0, base: 0, px: 20 }, GEN: { x: 190, y: 0, w: 10, h: 10, r: 1 } } as unknown as ChatGeom; // 17 characters a line
  const full = "which sources disagree?";
  const old = composerLines(ctx, "which sources dis", g);
  ok(old.length === 1 && old[0] === "which sources dis", `without the prompt the half-typed word sits on the first line (${old.join(" / ")})`);
  const kept = composerLines(ctx, "which sources dis", g, full);
  ok(kept.length === 2 && kept[1] === "dis", `RED: with the prompt the word starts on the line it ends on (${kept.join(" / ")})`);
  ok(composerLines(ctx, full, g, full).join("|") === composerLines(ctx, full, g).join("|"), "the finished prompt breaks as before");
  ok(composerLines(ctx, "", g, full).join("|") === "", "nothing typed is one empty line");
  ok(composerLines(ctx, "other words here", g, full).join("|") === composerLines(ctx, "other words here", g).join("|"), "words that are not the prompt's start wrap as before");
};
