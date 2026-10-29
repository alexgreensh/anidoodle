// FRAME RULES TESTS. Every rule framecheck applies to what a film draws, held to a case that must fail
// (a brand launch film's real faults, rebuilt as probe records) and one that must pass.
// @ts-ignore: a plain ES module shared with the tools
import { RULES, autoCues, blocksOf, checkedFrames, edgeCuts, endCardRuns, endSizeFindings, fontReport, framesOf, headSpread, layoutFindings, readingFloor, readingVerdict, rectGap } from "../tools/framerules.mjs";

type R = { kind: string; label: string; frame: number; x0: number; y0: number; x1: number; y1: number; cut?: boolean; alpha?: number; px?: number; family?: string; texture?: boolean };
const T = (label: string, frame: number, x0: number, y0: number, px = 40, o: Partial<R> = {}): R => ({ kind: "text", label, frame, x0, y0, x1: x0 + label.length * px * 0.5, y1: y0 + px * 0.75, cut: false, alpha: 1, px, family: "Inter", ...o });
const BOX = (label: string, frame: number, x0: number, y0: number, x1: number, y1: number): R => ({ kind: "box", label, frame, x0, y0, x1, y1, cut: false });
const range = (a: number, b: number) => Array.from({ length: b - a }, (_, i) => a + i);

export const name = "framerules";
export const run = (ok: (cond: boolean, label: string) => void) => {
  const fps = 30, W = 1920, H = 1080;
  // ---- blocks: glyphs drawn one by one read as words
  const glyphs = [..."Hi you"].map((ch, i) => (ch === " " ? null : T(ch, 0, 100 + i * 22 + (i > 2 ? 12 : 0), 100, 40))).filter(Boolean) as R[];
  const bl = blocksOf(glyphs);
  ok(bl.length === 1 && bl[0].key === "Hi you", `glyphs drawn one at a time join into one block with its word gap ("${bl[0]?.key}")`);
  ok(blocksOf([T("Line one of it", 0, 100, 100), T("line two", 0, 100, 145)]).length === 1, "two lines of one paragraph are one block");
  ok(blocksOf([T("Title", 0, 100, 100), T("Far away", 0, 1200, 800)]).length === 2, "text far apart is two blocks");

  // ---- reading time from drawn text (T2): a brand launch film's reply, 11 words up 2.5 s, fails; 3.3 s passes
  const reply = "I can handle the non-human part. Ingrid has the human one.";
  const shown = (s: number, from = 30) => { const fr = range(0, 200), m = framesOf(range(from, from + Math.round(s * fps)).map((f) => T(reply, f, 100, 400)), fr); return { m, fr }; };
  const short = shown(2.5), sv = readingVerdict(autoCues(short.m, short.fr, { last: 200, fps }), [], fps, short.fr.length);
  ok(sv.status === "FAIL" && sv.bad[0]?.need === 3.3, `NEGATIVE: the 11-word reply up 2.5 s fails, it needs 3.3 s (${JSON.stringify(sv.bad[0])})`);
  const long = shown(3.4), lv = readingVerdict(autoCues(long.m, long.fr, { last: 200, fps }), [], fps, long.fr.length);
  ok(lv.status === "PASS" && lv.checked === 1, "the same reply up 3.4 s passes");
  // typed text: the read starts after the last character
  const typedRecs: R[] = []; const words = reply.split(" ");
  for (let f = 0; f < 120; f++) { const n = Math.min(words.length, 1 + Math.floor(f / 6)); typedRecs.push(T(words.slice(0, n).join(" "), f, 100, 400)); }
  const typed = autoCues(framesOf(typedRecs, range(0, 130)), range(0, 130), { last: 130, fps });
  ok(typed.cues.length === 1 && typed.cues[0].from === 60 && typed.skipped.typing >= 9, `a typed reply is one cue, timed from its last word (from ${typed.cues[0]?.from}, ${typed.skipped.typing} typing steps skipped)`);
  ok(readingVerdict(typed, [], fps, 130).status === "FAIL", "NEGATIVE: typed for 2 s then held 2 s (under 3.3 s after the last word) fails");
  // texture text is skipped, and a film with text can never be N/A
  const blah = framesOf(range(0, 10).map((f) => T("blah blah blah blah blah", f, 100, 100, 40, { texture: true })), range(0, 10));
  const bv = readingVerdict(autoCues(blah, range(0, 10), { fps }), [], fps, 10);
  ok(bv.status === "FAIL" && /no cue/.test(bv.reason), "NEGATIVE: text drawn but nothing timed is a FAIL that says why, never N/A");
  const none = readingVerdict(autoCues(framesOf([], range(0, 10)), range(0, 10), { fps }), [], fps, 10);
  ok(none.status === "NONE" && /no text was drawn/.test(none.reason), "a film that draws no text says so with its evidence (NONE), not N/A");
  ok(readingVerdict(autoCues(framesOf([], []), [], { fps }), [], fps, 0).status === "FAIL", "NEGATIVE: no frame checked is a FAIL (an empty run proves nothing)");
  ok(autoCues(blah, range(0, 10), { fps }).texture === 10, "texture blocks are counted, not judged");
  // a count-up is an animation, not ten reads
  const count = framesOf(range(0, 80).map((f) => T(String(Math.min(400, f * 10)), f, 500, 500, 80)), range(0, 80));
  const cc = autoCues(count, range(0, 80), { last: 80, fps });
  ok(cc.cues.length === 1 && cc.cues[0].text === "400" && cc.skipped.flash > 5, `a count-up times only its final number (${cc.cues.map((c: { text: string }) => c.text).join(",")})`);
  // the same words moving from the input to the bubble are one read; a return of read text is not judged again
  const moved = framesOf([...range(0, 40).map((f) => T("hello there", f, 100, 900)), ...range(41, 60).map((f) => T("hello there", f, 900, 300))], range(0, 100));
  ok(autoCues(moved, range(0, 100), { last: 100, fps }).cues.length === 1, "a sent message (input, then bubble, one frame apart) is one cue");
  const back = framesOf([...range(0, 40).map((f) => T("Header", f, 100, 100)), ...range(80, 84).map((f) => T("Header", f, 100, 100))], range(0, 100));
  const bc = autoCues(back, range(0, 100), { last: 100, fps });
  ok(bc.cues.length === 1 && bc.skipped.seen === 1, "a header read in full and back for 4 frames later is not a new read");
  // a line leaving word by word (last word first) leaves remnants that are exit steps, not reads
  const leaving: R[] = []; for (let f = 0; f < 60; f++) leaving.push(T("Beat two: one line", f, 100, 400)); ["Beat two: one", "Beat two:", "Beat"].forEach((k, i) => leaving.push(T(k, 60 + i, 100, 400)));
  const lv2 = autoCues(framesOf(leaving, range(0, 70)), range(0, 70), { last: 70, fps });
  ok(lv2.cues.length === 1 && lv2.skipped.exit === 3, `a sinking exit's remnants ("Beat" for 1 frame) are exit steps, not reads (${lv2.skipped.exit})`);
  // RED (launch template): a sinking line drops behind its clip glyph by glyph, short letters first, so
  // "And" leaves "A d" (the n gone below the edge first). The remnant is not a substring of "And", but its
  // letters are, in order, in the same place: an exit step, not a 1-frame read
  const sink: R[] = []; for (let f = 0; f < 60; f++) sink.push(T("And it shows", f, 100, 400)); sink.push(T("And", 60, 100, 400));
  for (const f of [61, 62]) sink.push(T("A", f, 100, 400), T("d", f, 140, 400));
  const gl = autoCues(framesOf(sink, range(0, 70)), range(0, 70), { last: 70, fps });
  ok(gl.cues.length === 1 && gl.cues[0].text === "And it shows", `RED: glyphs left by a sinking word ("A d") are an exit step (${gl.cues.map((c: { text: string }) => c.text).join(" | ")})`);
  // but a different text that only shares letters with what was there is still a read
  const swap: R[] = []; for (let f = 0; f < 60; f++) swap.push(T("And it shows", f, 100, 400)); for (let f = 60; f < 62; f++) swap.push(T("dish", f, 100, 400));
  ok(autoCues(framesOf(swap, range(0, 70)), range(0, 70), { last: 70, fps }).cues.some((c: { text: string }) => c.text === "dish"), "a new short word in the same place is still a read, not an exit");
  // the edge: held cuts fail, a pan across the edge does not
  const cutRec = (f: number, x0: number) => ({ kind: "text", label: "Beat 3: one line", frame: f, x0, y0: 400, x1: x0 + 800, y1: 460 });
  ok(edgeCuts(range(0, 17).map((f) => cutRec(f, 1500 - f * 20)), range(0, 30))[0].fail === false, "a line sliding across the edge with the camera is a pan, not a fault");
  ok(edgeCuts(range(0, 30).map((f) => cutRec(f, 1500)), range(0, 30))[0].fail === true, "NEGATIVE: a line sliced by the edge and left there (the 196-frame cut) fails");
  ok(edgeCuts([cutRec(0, 1500), cutRec(1, 1500)], range(0, 30))[0].fail === false && edgeCuts([0, 1, 2].map((f) => cutRec(f, 1500)), range(0, 30))[0].fail, "held means 3 checked frames in a row, unmoved");
  const fl = readingFloor([{ from: 0, to: 90, text: "one two three four" }, { from: 30, to: 60, text: "five" }], fps);
  ok(Math.abs(fl.floorS - 1.7) < 1e-9 && Math.abs(fl.spareS - 2.1) < 1e-9, `reading floor: union of the needs (${fl.floorS} s), spare = time beyond them (${fl.spareS.toFixed(2)} s)`);

  // ---- layout (C1, C2, C4, T9)
  const lay = (recs: R[], n = 30, exemptRanges?: unknown) => layoutFindings(framesOf(range(0, n).flatMap((f) => recs.map((r) => ({ ...r, frame: f }))), range(0, n)), range(0, n), { W, H, fps, exemptRanges });
  const corner = ["Kestrel Live", "May 03", "Santiago", "The Old Mill", "Reserve a Spot!", "www.example.com", "Sponsors", "Nordic"].map((s, i) => T(s, 0, 60 + (i % 2) * 260, 60 + Math.floor(i / 2) * 90, 28));
  const cf = lay(corner);
  ok(cf.some((x: { rule: string }) => x.rule === "density") && cf.some((x: { msg: string }) => /packed into/.test(x.msg)), `NEGATIVE: the v3 end card, eight items in one corner, fails density (${cf.map((x: { msg: string }) => x.msg).join(" | ").slice(0, 160)})`);
  const stack = ["Kestrel Live", "May 03", "Santiago", "Reserve a Spot!", "www.example.com"].map((s, i) => { const t = T(s, 0, 0, 200 + i * 150, 48); const w = t.x1 - t.x0; return { ...t, x0: 960 - w / 2, x1: 960 + w / 2 }; });
  ok(lay(stack).some((x: { rule: string }) => x.rule === "centred stack"), "NEGATIVE: five lines centred on one axis fail as a centred stack");
  const grid = [T("Kestrel Live", 0, 150, 150, 64), T("May 3, Santiago ", 0, 150, 400, 44), T("Reserve a Spot!", 0, 1400, 400, 44), T("Sponsors", 0, 150, 800, 38)];
  ok(lay(grid).length === 0, "the approved asymmetric card (lockup, event lines, CTA right, sponsors foot) passes");
  const close = [BOX("bubble", 0, 600, 300, 1300, 500), BOX("dots", 0, 900, 520, 1000, 560)];
  ok(lay(close).some((x: { rule: string }) => x.rule === "gap"), "NEGATIVE: the '?' dots 20 px under the bubble fail the 3% gap");
  ok(lay([BOX("bubble", 0, 600, 300, 1300, 500), BOX("dots", 0, 900, 600, 1000, 640)]).length === 0, "the dots moved 100 px down pass");
  ok(lay([T("Line over line", 0, 100, 100, 60), T("Another text", 0, 140, 110, 60)]).some((x: { rule: string }) => x.rule === "text over text"), "NEGATIVE: two texts on top of each other fail");
  ok(lay([BOX("card", 0, 400, 400, 900, 700), T("crossing the card edge", 0, 700, 500, 40)]).some((x: { rule: string }) => x.rule === "text over an edge"), "NEGATIVE: text running over a card's edge fails");
  ok(lay([BOX("card", 0, 400, 400, 1500, 700), T("inside", 0, 500, 500, 40)]).length === 0, "text inside its card passes");
  ok(lay(corner, 10).length === 0, "a layout held under 0.5 s (a passing move) is not judged");
  ok(lay(corner, 30, [[0, 30, "the joke is the wall of text"]]).length === 0, "a declared layoutExempt range with a reason is not judged");
  ok(rectGap({ x0: 0, y0: 0, x1: 10, y1: 10 }, { x0: 13, y0: 14, x1: 20, y1: 20 }) === 5, "rectGap is the edge-to-edge distance");

  // ---- the last second (T10), the end card (S9), heads (C5), fonts (T8)
  const endRecs = framesOf(range(270, 300).map((f) => T("Reserve a Spot!", f, 1500, 900, 14)), range(0, 300));
  ok(endSizeFindings(endRecs, range(0, 300), { W, H, fps, durationFrames: 300 }).length === 1, "NEGATIVE: a 14 px CTA in the last second fails");
  ok(endSizeFindings(framesOf(range(270, 300).map((f) => T("Reserve a Spot!", f, 1500, 900, 44)), range(0, 300)), range(0, 300), { W, H, fps, durationFrames: 300 }).length === 0, "a 44 px CTA passes");
  const card = (fs: number[]) => framesOf(fs.map((f) => BOX("end card", f, 50, 50, 1870, 1030)), range(0, 300));
  ok(!endCardRuns(card([...range(100, 150), ...range(200, 300)]), range(0, 300)).ok, "NEGATIVE: card, stinger, card (two landings) fails");
  ok(endCardRuns(card(range(200, 300)), range(0, 300)).ok, "one landing passes");
  const heads = (hs: number[]) => framesOf(hs.map((h, i) => BOX(`head:speakers/${["ines", "tomas", "priya"][i]}`, i, 0, 0, h * 0.8, h)), range(0, 3));
  const hs = headSpread(heads([370, 270, 190]), range(0, 3));
  ok(hs.length === 1 && !hs[0].ok && hs[0].people.length === 3, "NEGATIVE: heads of 370, 270 and 190 px in one sequence fail");
  ok(headSpread(heads([300, 290, 305]), range(0, 3))[0].ok, "heads within 10% pass");
  const fonts = fontReport(framesOf([T("Speaker", 0, 0, 0, 40, { family: "Helvetica" }), T("Title", 0, 0, 200, 40, { family: "Acid Grotesk" })], [0]), [0], { fonts: ["Acid Grotesk"], standIns: { "Acid Grotesk": "Helvetica" } });
  ok(fonts.find((f: { family: string }) => f.family === "Helvetica")?.standFor === "Acid Grotesk" && !fonts.find((f: { family: string }) => f.family === "Acid Grotesk")?.offBrand, "a stand-in face is named with the brand face it stands in for");
  ok(fontReport(framesOf([T("x", 0, 0, 0, 40, { family: "Comic Sans" })], [0]), [0], { fonts: ["Acid Grotesk"] })[0].offBrand, "NEGATIVE: a face outside the brand's is flagged");
  ok(RULES.endPx === 28 && RULES.gapShare === 0.03 && RULES.maxBlocks === 7, "the numbers: 28 px at the end, 3% gaps, at most 7 blocks");
  // ---- M13: one label drawn twice on a frame (two "Learn more" buttons, setType's per-character fills)
  const twin = (f: number, x0: number) => ({ kind: "text", label: "Learn more", frame: f, x0, y0: 400, x1: x0 + 300, y1: 440 });
  const two = edgeCuts(range(0, 6).flatMap((f) => [twin(f, 1700), twin(f, 200 + f * 37)]), range(0, 30));
  ok(two[0].fail === true && two[0].held === 6, `NEGATIVE M13: a cut held 6 frames is found while a second record with the same label moves (held ${two[0].held})`);
  ok(edgeCuts(range(0, 6).flatMap((f) => [twin(f, 1700 - f * 20), twin(f, 200 + f * 37)]), range(0, 30))[0].fail === false, "M13 two same-label records that both move are not a held cut");
  // ---- M2/M3: the frames a check looks at. A bad --every, --from or --to is refused, never a check of frame 0 alone
  const bad = (o: Record<string, unknown>, N = 100) => { try { checkedFrames(o, N); return ""; } catch (e) { return String((e as Error).message); } };
  ok(checkedFrames({ every: 1 }, 5).join(",") === "0,1,2,3,4" && checkedFrames({ every: 2, from: 1, to: 6 }, 10).join(",") === "1,3,5", "frames: every, from, to");
  ok(/--every/.test(bad({ every: NaN })), "NEGATIVE M2: --every abc (NaN) is refused, never a check of frame 0 alone");
  ok(/--every/.test(bad({ every: 0 })) && /--every/.test(bad({ every: 1.5 })) && /--every/.test(bad({ every: -2 })), "NEGATIVE M3: --every 0 (a loop with no end), 1.5 or -2 is refused");
  ok(/--from/.test(bad({ every: 1, from: 120 })) && /--from/.test(bad({ every: 1, from: NaN })), "NEGATIVE M3: --from past the end, or not a number, is refused (0 frames checked proves nothing)");
  ok(/--to/.test(bad({ every: 1, from: 10, to: 10 })) && /--to/.test(bad({ every: 1, to: NaN })), "NEGATIVE M3: --to at or before --from, or not a number, is refused");
};
