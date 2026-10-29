// PEOPLE EDGE TESTS. src/canvas-core/people.ts headOf on cut-outs with no neck: a head-only crop and
// an oval portrait. The neck search took the narrowest row 12 % under the crown (the top of an oval is
// narrowest), so the "head" came out about 12 % of the figure and the person was scaled about 8x.
// With no neck, the whole figure is the head. (The head-and-shoulders case is in readable.test.ts.)
//   node tools/test.mjs people
import { headOf, placePerson } from "../src/canvas-core/people";

const W = 100, H = 120;
const img = (inside: (x: number, y: number) => boolean) => { const a = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inside(x, y)) a[y * W + x] = 255; return a; };

export const name = "people";
export const run = (ok: (cond: boolean, label: string) => void) => {
  const oval = headOf(img((x, y) => ((x - 50) / 40) ** 2 + ((y - 60) / 55) ** 2 <= 1), W, H)!;
  const ovalH = oval.y1 - oval.y0;
  ok(ovalH >= 100, `L13 an oval cut-out has no neck: the whole oval is the head (${ovalH} px of 111)`);
  const p = placePerson(oval, { cx: 500, crownY: 100, headPx: 220 });
  ok(p.s < 2.2, `L13 so a 220 px head scales it about 2x, not 8x (scale ${p.s.toFixed(2)})`);
  // a head-only crop: a round head with a short neck stub and no shoulders under it
  const crop = headOf(img((x, y) => ((x - 50) / 30) ** 2 + ((y - 45) / 38) ** 2 <= 1 || (y >= 80 && y < 96 && x >= 42 && x < 58)), W, H)!;
  ok(crop.y1 - crop.y0 >= 75, `L13 a head-only crop with no shoulders keeps its whole head (${crop.y1 - crop.y0} px tall, from ${crop.y0})`);
  // GREEN: a real head and shoulders still ends the head at the neck
  const hs = headOf(img((x, y) => (((x - 50) / 22) ** 2 + ((y - 30) / 26) ** 2 <= 1) || (y >= 54 && y < 64 && x >= 42 && x < 58) || (y >= 64 && x >= 4 && x < 96)), W, H)!;
  ok(hs.y0 === 4 && hs.y1 >= 54 && hs.y1 <= 64, `GREEN head and shoulders: the head ends at the neck (${hs.y0}-${hs.y1})`);
};
