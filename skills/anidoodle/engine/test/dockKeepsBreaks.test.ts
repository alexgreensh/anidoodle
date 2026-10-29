// THE DRAWN DOCK KEEPS THE HOOK'S LINE BREAKS. The drawn hook's composer docks by easing its size and its
// type size together, and its words were wrapped afresh each frame at the eased width: "TODO / what a / user
// types" became "TODO what / a user types", then "TODO what a / user types", then "TODO what a user / types",
// words jumping between lines as it moved. Once the calm dock grew longer and started over the prompt's last
// words, the line "TODO what a user" stood 0.13 s (framecheck reading time, the drawn scaffold on 9:16).
// The composer now wraps as the hook did (ChatGeom.wrapAs), then halfway, as its rows change, as the dock
// does: one change of breaks, never one per frame. (Kept as the hook's to the landing, the hook's second line
// hung under the shrinking one-line dock on 16:9 and was clipped: layerscan exits, "types" in slivers.)
//   node tools/test.mjs dockKeepsBreaks
import { composerLines, type ChatGeom } from "../src/canvas-core/launchKit";
import { makeLaunchFilm, type LaunchFilm } from "../src/canvas-core/launchTemplate";
import { lighthouseDraw } from "../src/canvas-core/lighthouseDraw";

export const name = "the drawn dock keeps the hook's line breaks";
export const run = (ok: (cond: boolean, label: string) => void) => {
  // a measuring stub: every character half its type size wide
  const stub = { font: "", measureText: (t: string) => ({ width: t.length * parseFloat(/([\d.]+)px/.exec(stub.font)?.[1] ?? "10") * 0.5 }) };
  const ctx = stub as unknown as Parameters<typeof composerLines>[0];
  const geom = (px: number, w: number): ChatGeom => ({ k: 1, TEXT: { x: 0, base: 0, px }, GEN: { x: w + 20, y: 0, w: 10, h: 10, r: 1 } } as unknown as ChatGeom);
  const hero = geom(70, 420), mid = geom(40, 400), text = "TODO what a user types";
  const lh = composerLines(ctx, text, hero), lm = composerLines(ctx, text, mid);
  ok(lh.join("|") !== lm.join("|"), `the eased geometry alone wraps differently (${lh.join(" / ")} against ${lm.join(" / ")})`);
  const kept = composerLines(ctx, text, { ...mid, wrapAs: { px: 70, maxW: 420 } });
  ok(kept.join("|") === lh.join("|"), `RED: wrapped as the hook, the docking composer keeps its breaks (${kept.join(" / ")})`);
  // and the template's drawn dock asks for it on every frame of the move
  const f = makeLaunchFilm({ title: "TODO Product", asks: [{ prompt: text, plate: lighthouseDraw, label: "l" }, { prompt: "TODO the follow-up", plate: lighthouseDraw, label: "l" }], tagline: "t", install: ["npm i x"], bpm: 90, motion: { temperament: "calm", brandColors: ["#cc5533"] }, score: null, sfx: false });
  for (const sh of ["16x9", "9x16"]) { const d = (f.reshape(sh) as LaunchFilm).grammar?.heroDock; ok(!!d && d.wraps <= 2, `RED ${sh}: the drawn dock wraps as the hook, then as the dock, nothing between (${d?.wraps} sets of breaks)`); }
};
