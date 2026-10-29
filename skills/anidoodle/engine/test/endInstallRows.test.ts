// THE END CARD'S INSTALL LINES, SET AS A TERMINAL SETS THEM. The launch template's end card holds the
// exact lines a viewer copies in a dark panel. They were each centred on their own, so two lines of
// different lengths started at different places: a fresh critic read it as a caption, not a terminal
// (a P1 on the drawn example). Every line starts at the panel's left padding, in both presets and shapes.
//   node tools/test.mjs endInstallRows
import { launchExample } from "../src/canvas-core/launchExample";
import { launchExampleClean } from "../src/canvas-core/launchExampleClean";
import { renderFrame } from "../src/canvas-core/film";
import type { Ctx, Env, Layer } from "../src/canvas-core/core";
import type { LaunchFilm } from "../src/canvas-core/launchTemplate";
import { FakeCanvas } from "./fakeCanvas";

// offscreen layers (the paper's grain) write pixels: the fake surface takes them and keeps none
const pixels = <T extends object>(c: T) => Object.assign(c, { createPattern: () => ({ setTransform: () => {} }), createLinearGradient: () => ({ addColorStop: () => {} }), createRadialGradient: () => ({ addColorStop: () => {} }), createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }), putImageData: () => {}, getImageData: (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }) });

export const name = "launch end card: install lines start together, left in the panel";
export const run = (ok: (cond: boolean, label: string) => void) => {
  for (const [id, base] of [["drawn", launchExample], ["clean", launchExampleClean]] as const) for (const sh of ["16x9", "9x16"]) {
    const film = (base as LaunchFilm).reshape(sh), L = film.layout;
    const canvas = new FakeCanvas(L.W, L.H), raw = pixels(canvas.ctx), seen: { text: string; left: number }[] = [];
    // every surface's fillText, the page's and any layer's: where a line's left edge lands on its surface
    const proto = Object.getPrototypeOf(raw) as { fillText: (s: string, x: number, y: number) => void }, keep = proto.fillText;
    proto.fillText = function (this: CanvasRenderingContext2D, t: string, x: number) { const w = this.measureText(t).width, a = this.textAlign; seen.push({ text: t, left: a === "center" ? x - w / 2 : a === "right" || a === "end" ? x - w : x }); };
    const ctx = raw as unknown as Ctx;
    const env = { W: L.W, H: L.H, scale: 1, root: true, cache: new Map(), canvas: (w: number, h: number) => { const c = new FakeCanvas(w, h); return { canvas: c, ctx: pixels(c.ctx), w, h } as unknown as Layer; } } as unknown as Env;
    try { renderFrame(film, ctx, film.meta.durationFrames - 1, env); } finally { proto.fillText = keep; }
    const rows = seen.filter((r) => /install|init|\$ |npx|npm|brew|pip/.test(r.text) && r.text.length > 6);
    const lefts = rows.map((r) => Math.round(r.left));
    if (id === "clean" && rows.length === 1) { ok(true, `clean ${sh}: the grid card sets its install lines as one line ("${rows[0].text}")`); continue; }
    ok(rows.length >= 2 && Math.max(...lefts) - Math.min(...lefts) <= 1, `RED ${id} ${sh}: the install lines start at one x (${rows.map((r, j) => `"${r.text}" at ${lefts[j]}`).join(", ") || "none found"})`);
  }
};
