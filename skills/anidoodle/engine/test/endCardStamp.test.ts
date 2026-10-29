// END CARD, WITHOUT A SPONSOR BAND. The approved card puts the call-to-action stamp at the right edge, on
// the venue's baseline, over a sponsor band that spans the width. The launch template's card has no band,
// and there a fresh critic saw the stamp float far right of the text block. `stamp: "inline"` sets it one
// gap after the line it sits on. And a lockup whose letters hang below its box (a name's descender) says
// how far with `descent`, so the next line keeps its air under the letters, not under the box.
//   node tools/test.mjs endCardStamp
import { endCardLayout, type EndCardSpec } from "../src/canvas-core/endCard";

export const name = "endCard: an inline stamp and a lockup's descent";
export const run = (ok: (cond: boolean, label: string) => void) => {
  const measure = (t: string, font: string) => t.length * Number(/(\d+)px/.exec(font)![1]) * 0.55;
  const spec: EndCardSpec = { lockup: { aspect: 3.2, draw: () => {} }, date: "Bookkeeping that does itself", venue: "npm install tally  ·  tally init", cta: "tally.example", colors: { ink: "#111", accent: "#2f54eb", ctaInk: "#fff" } };
  const edge = endCardLayout(1920, 1080, spec, measure);
  ok(edge.cta.x + edge.cta.w === 1920 - edge.margin, "16:9 default: the approved card's stamp stays at the right margin");
  const inl = endCardLayout(1920, 1080, { ...spec, stamp: "inline" } as never, measure), lineEnd = Math.max(inl.date.x + inl.date.w, inl.venue.x + inl.venue.w);
  ok(inl.cta.x > lineEnd && inl.cta.x - lineEnd <= 120, `RED: an inline stamp sits one gap after the text block (stamp at ${Math.round(inl.cta.x)}, the lines end at ${Math.round(lineEnd)})`);
  ok(Math.abs(inl.cta.y - edge.cta.y) < 1e-9, "the inline stamp keeps the venue's baseline");
  const hang = endCardLayout(1920, 1080, { ...spec, lockup: { ...spec.lockup, descent: 0.3 } } as never, measure);
  ok(hang.date.y - (hang.lockup.y + hang.lockup.h) >= edge.date.y - (edge.lockup.y + edge.lockup.h) + 0.3 * hang.lockup.h - 1e-9, `RED: a lockup that hangs 30 % below its box pushes the next line down by as much (gap ${Math.round(hang.date.y - hang.lockup.y - hang.lockup.h)} against ${Math.round(edge.date.y - edge.lockup.y - edge.lockup.h)})`);
  // inline never runs past the frame: a long line puts the stamp back at the margin
  const longL = endCardLayout(1920, 1080, { ...spec, venue: "npm install a-very-long-package-name-for-the-product && product init --all", stamp: "inline" } as never, measure);
  ok(longL.cta.x + longL.cta.w <= 1920 - longL.margin + 1e-9, "a long line never pushes an inline stamp past the right margin");
};
