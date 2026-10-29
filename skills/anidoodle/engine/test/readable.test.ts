// READABLE, PEOPLE AND END CARD TESTS. The kit helpers the ship checks expect films to use, held to the
// Brand-launch numbers: a typed reply's hold, one pace scalar, head-size placement and the end card grid.
// @ts-ignore: a plain ES module shared with the tools
import { MIN_READ_S as TR_MIN, READ_S_PER_WORD as TR_WORD, readingNeed } from "../tools/textrules.mjs";
// @ts-ignore: a plain ES module shared with the tools
import { RULES, layoutFindings, framesOf } from "../tools/framerules.mjs";
import { MIN_READ_S, READ_S_PER_WORD, chatHold, chatHoldFrames, paced, paceOf, readS } from "../src/canvas-core/readable";
import { headOf, placePerson } from "../src/canvas-core/people";
import { endCardLayout, type EndCardSpec } from "../src/canvas-core/endCard";

export const name = "readable";
export const run = (ok: (cond: boolean, label: string) => void) => {
  ok(MIN_READ_S === TR_MIN && READ_S_PER_WORD === TR_WORD, "the kit's reading rule is the one framecheck checks");
  const reply = "I can handle the non-human part. Ingrid has the human one.";
  ok(readS(reply) === readingNeed(reply) && Math.abs(readS(reply) - 3.3) < 1e-9, "an 11-word reply needs 3.3 s");
  const h = chatHold(reply, { cps: 58, think: 0.6 });
  ok(Math.abs(h.read - 3.3) < 1e-9 && Math.abs(h.typing - reply.length / 58) < 1e-9 && Math.abs(h.total - (0.6 + reply.length / 58 + 3.3)) < 1e-9, `a typed reply holds think + typing + the full read after the last character (${h.total.toFixed(2)} s)`);
  ok(h.read > 0.9 * 1.25, "NEGATIVE: the film's fixed 0.9 s hold (even x1.25) is under the read the helper gives");
  const slow = chatHold(reply, { cps: 58, think: 0.6, pace: 1.2 });
  ok(Math.abs(slow.read - 3.96) < 1e-9 && slow.typing === h.typing, "pace 1.2 stretches the think and the read, not the typing speed");
  const f = chatHoldFrames(reply, 30, { cps: 58 });
  ok(f.read === 99 && f.total === f.think + f.typing + f.read, "frames round up, so the hold never lands a frame short");
  ok(paceOf({ default: 1.1, coldOpen: 0.8 }, "coldOpen") === 0.8 && paceOf({ default: 1.1 }, "rest") === 1.1 && paced(2, 1.25) === 2.5, "pace per section with a default; paced() multiplies");

  // ---- people: the head of a cut-out from alpha, and placement by head height
  const w = 40, hh = 100, a = new Uint8Array(w * hh);
  const fill = (x0: number, x1: number, y0: number, y1: number) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) a[y * w + x] = 255; };
  fill(12, 28, 5, 30); fill(17, 23, 30, 36); fill(2, 38, 36, 100); // head 5..30, neck 30..36, shoulders below
  const head = headOf(a, w, hh);
  ok(!!head && head.y0 === 5 && head.y1 >= 30 && head.y1 <= 35 && head.x0 === 12 && head.x1 === 28, `the head ends at the neck, the narrowest row under the crown (${JSON.stringify(head)})`);
  ok(headOf(new Uint8Array(100), 10, 10) === null, "an empty image has no head");
  const p1 = placePerson({ x0: 0, y0: 50, x1: 100, y1: 420 }, { cx: 500, crownY: 200, headPx: 300 }), p2 = placePerson({ x0: 0, y0: 20, x1: 60, y1: 210 }, { cx: 900, crownY: 200, headPx: 300 });
  ok(Math.abs((420 - 50) * p1.s - 300) < 1e-9 && Math.abs((210 - 20) * p2.s - 300) < 1e-9 && Math.abs(p1.y + 50 * p1.s - 200) < 1e-9, "two photos of different sizes come out with equal heads, crowns level");

  // ---- the end card grid, in every shape: inside the frame, no centred stack, no gap under 3 %, sponsors switchable
  const spec: EndCardSpec = { lockup: { aspect: 3.2, draw: () => {} }, date: "May 03, 2027", venue: "Santiago The Old Mill", cta: "Reserve a Spot!", colors: { ink: "#fff", accent: "#FFDE59", ctaInk: "#111" },
    sponsors: { list: ["Northwind", "Kestrel", "Bright Star", "Headland Media", "Appsworth", "Elmwood"].map((n, i) => ({ name: n, aspect: 2 + (i % 3) * 0.5, on: i < 4, draw: () => {} })) } };
  const measure = (t: string, font: string) => t.length * Number(/(\d+)px/.exec(font)![1]) * 0.55;
  for (const [W, H] of [[1920, 1080], [1080, 1080], [1080, 1350], [1080, 1920]]) {
    const L = endCardLayout(W, H, spec, measure);
    const rects = [L.lockup, L.date, L.venue, L.cta, ...(L.label ? [L.label] : []), ...L.logos];
    ok(rects.every((r) => r.x >= 0 && r.y >= 0 && r.x + r.w <= W && r.y + r.h <= H), `${W}x${H}: every part inside the frame`);
    ok(L.logos.length === 4, `${W}x${H}: the switched-off sponsors are left out (4 of 6 shown)`);
    const recs = [["date", L.date], ["venue", L.venue], ["cta", L.cta], ["label", L.label!]].map(([label, r]) => { const q = r as { x: number; y: number; w: number; h: number; px: number }; return { kind: "text", label, frame: 0, x0: q.x, y0: q.y, x1: q.x + q.w, y1: q.y + q.h, cut: false, alpha: 1, px: q.px }; });
    const boxes = [L.lockup, ...L.logos].map((r, i) => ({ kind: "box", label: `b${i}`, frame: 0, x0: r.x, y0: r.y, x1: r.x + r.w, y1: r.y + r.h, cut: false }));
    const fr = Array.from({ length: 30 }, (_, i) => i), by = framesOf(fr.flatMap((f) => [...recs, ...boxes].map((r) => ({ ...r, frame: f }))), fr);
    const found = layoutFindings(by, fr, { W, H, fps: 30 });
    ok(found.length === 0, `${W}x${H}: the card passes framecheck's layout rules${found.length ? `: ${found.map((x: { msg: string }) => x.msg).join(" | ")}` : ""}`);
    ok(L.label!.px >= Math.round(38 * Math.min(W, H) / 1080) && L.cta.px * (1080 / Math.min(W, H)) >= RULES.endPx, `${W}x${H}: the sponsors label is 38 px at 1080 and the CTA clears the last-second floor`);
    if (H / W > 1.5) ok(L.lockup.y >= H * 0.14 && L.logos.every((r) => r.y + r.h <= H * 0.75), "9:16: clear of the platforms' top and bottom bands");
  }
  // 9:16 with long lines (a product's tagline and install line): every line ends left of the platforms' right button column
  const long = endCardLayout(1080, 1920, { ...spec, date: "Bookkeeping that does itself", venue: "npm install tally  ·  tally init" }, measure);
  ok([long.date, long.venue, long.cta].every((r) => r.x + r.w <= 1080 * 0.86), `9:16: long lines stay out of the right 14 % column (date ends ${Math.round(long.date.x + long.date.w)}, venue ${Math.round(long.venue.x + long.venue.w)}, limit ${1080 * 0.86})`);
  const wide = endCardLayout(1920, 1080, spec, measure);
  ok(wide.cta.x > 960 && Math.abs(wide.cta.y + wide.cta.h - 22 - (wide.venue.y + wide.venue.h)) < 1, "16:9: the CTA stamp sits right, on the venue's baseline (the approved v12 card)");
};
