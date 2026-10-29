// A PRODUCT WINDOW IN A TALL FRAME. On 9:16 a product's own screen is given a tall rectangle (the safe area
// less its margins), and its rows were capped at a desktop height, so the window came out at 70 % of that
// height, centred, with the lower third of the frame empty under it (a fresh critic). On a phone a list's
// rows are tall touch rows: in a tall rectangle they grow until the window fills it. A wide rectangle keeps
// the desktop rows exactly.
//   node tools/test.mjs productUITall
import { uiWindow, type ProductUI } from "../src/canvas-core/productUI";

export const name = "productUI: a tall rectangle gets tall rows";
const WIDE_H = 1580.53; // the desktop window height before this change, measured (to the hundredth)
export const run = (ok: (cond: boolean, label: string) => void) => {
  const ui: ProductUI = { title: "Tally", nav: ["Inbox"], action: "Match all", command: "Ask…",
    before: { stats: [{ label: "Unmatched", value: 14 }], items: ["a", "b", "c", "d"].map((id) => ({ id, label: `Row ${id}`, value: "$1" })) },
    after: { stats: [{ label: "Unmatched", value: 0 }], items: ["a", "b", "c", "d"].map((id) => ({ id, label: `Row ${id}`, value: "$1" })) } };
  const tall = { x: 60, y: 300, w: 830, h: 1030 }, wide = { x: 100, y: 100, w: 1700, h: 1600 } /* not tall: under 1.05 high per wide */;
  const t = uiWindow(tall, ui, 32), w = uiWindow(wide, ui, 18);
  ok(t.h >= 0.85 * tall.h, `RED: in a tall rectangle the window fills it (${Math.round(t.h)} of ${tall.h} px, ${Math.round((100 * t.h) / tall.h)} %)`);
  ok(Math.abs(t.y + t.h / 2 - (tall.y + tall.h / 2)) < 1e-6, "it stays centred in its rectangle");
  ok(Math.abs(w.h - WIDE_H) < 0.01, `a wide rectangle keeps its desktop rows (${w.h.toFixed(2)} px, was ${WIDE_H.toFixed(2)})`);
};
