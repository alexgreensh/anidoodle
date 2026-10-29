// SUBTITLES TESTS. src/canvas-core/subtitles.ts: phrase chunking, phrase timing, the caption rules
// (each with a red fixture that must fail), cues, safe placement, and the round trip of caption events
// in frames through tools/avsync.mjs toSrt/toVtt.   node tools/test.mjs subtitles
import { cue, cueEnd, eventProblems, forbiddenBreak, phrasePlan, phrases, readingFrames, subtitleBox, toCaptions, wrapPhrase, MIN_READ_S, READ_S_PER_WORD, type CaptionEvent, type VoiceTiming } from "../src/canvas-core/subtitles";
import type { Ctx, Env } from "../src/canvas-core/core";
// @ts-expect-error plain .mjs tool modules carry no types
import { toSrt, toVtt } from "../tools/avsync.mjs";
// @ts-expect-error plain .mjs tool modules carry no types
import { readingTime, MIN_READ_S as TR_MIN, READ_S_PER_WORD as TR_PER } from "../tools/textrules.mjs";

// a timing from plain lines, every word `secs` long, lines `gapS` apart, at `fps`
const timing = (lines: [string, string][], secs = 0.42, fps = 24, gapS = 0.5): VoiceTiming => {
  let t = 0.5;
  const out = lines.map(([id, text]) => {
    const words = text.split(/\s+/).map((w) => { const from = Math.round(t * fps); t += secs; return { w, from, to: Math.round(t * fps) }; });
    const ln = { id, text, start: words[0].from, end: words[words.length - 1].to, words }; t += gapS; return ln;
  });
  return { version: 1, fps, totalFrames: Math.round((t + 1) * fps), lines: out };
};
const wordsOf = (e: CaptionEvent) => e.text.split(" ").length;

export const name = "subtitles";
export const run = (ok: (cond: boolean, label: string) => void) => {
  // ---------------------------------------------------------------- chunking
  const T = timing([["l1", "Every film starts as a few plain words."], ["l2", "This one draws itself in code, at 24 frames a second."], ["l3", "The music steps back while I speak, then comes home to Total Recall."]]);
  const ev = phrases(T);
  ok(ev.every((e) => wordsOf(e) >= 2 && wordsOf(e) <= 6), `every phrase holds 2-6 words (${ev.map(wordsOf).join(",")})`);
  ok(ev.every((e) => e.text.length <= 32), "every 16x9 phrase fits one 32-character line");
  ok(T.lines.every((l) => ev.filter((e) => e.line === l.id).flatMap((e) => e.words).map((w) => w.w).join(" ") === l.words.map((w) => w.w).join(" ")), "the phrases of a line hold exactly its words, in order");
  ok(ev.some((e) => e.text.endsWith("code,")), "a comma is where a phrase breaks first");
  ok(!ev.some((e, i) => i && ev[i - 1].line === e.line && /\b24$/.test(ev[i - 1].text) && /^frames/.test(e.text)), "24 | frames is never split");
  ok(!ev.some((e) => /\b(a|the|an)$/i.test(e.text)), "no phrase ends on an article");
  ok(!ev.some((e) => /Total$/.test(e.text)), "a name (Total Recall) stays whole");
  const tall = phrases(timing([["l1", "The music steps back while I speak, then comes home again tonight."]]), { shape: "9x16" });
  ok(tall.every((e) => e.text.length <= 22), `9x16 phrases fit 22 characters (${tall.map((e) => e.text.length).join(",")})`);

  ok(forbiddenBreak("the", "clock") !== null && forbiddenBreak("24", "frames") !== null && forbiddenBreak("$13.60", "dollars") !== null, "the forbidden breaks are named: article | noun, number | unit");
  ok(forbiddenBreak("Total", "Recall") !== null && forbiddenBreak("code,", "at") === null && forbiddenBreak("clock", "rang") === null, "a name is kept; a comma or a plain verb boundary is not");

  // ---------------------------------------------------------------- timing
  ok(ev.every((e) => e.from <= e.words[0].from && e.words[0].from - e.from <= 12), "each phrase appears on its first word: at most 0.5 s before it, never after");
  ok(ev.every((e) => e.to - e.from >= Math.max(20, readingFrames(e.text, 24))), "each phrase holds its reading time and the 20-frame floor");
  ok(ev.every((e, i) => !i || e.from >= ev[i - 1].to + 2), "one phrase at a time, 2 frames apart");
  ok(readingTime(toCaptions(ev, 24), 24).status === "PASS", "framecheck's reading-time rule passes every phrase");
  ok(MIN_READ_S === TR_MIN && READ_S_PER_WORD === TR_PER, "the reading rule here is textrules.mjs's rule");
  const at30 = phrases(timing([["l1", "Every film starts as a few plain words."]], 0.42, 30));
  ok(at30.every((e) => e.to - e.from >= 25), "the 20-frame floor scales with fps (25 at 30 fps)");

  // RED: speech faster than anyone can read in phrases is refused, never squeezed
  const fast = timing([["l1", "this sentence is spoken much too fast for anyone to follow along with phrases on the screen"]], 0.12);
  const fp = phrasePlan(fast);
  ok(fp.problems.some((p) => p.startsWith("TOO TIGHT")), "RED: speech at 8 words a second is TOO TIGHT");
  let threw = false; try { phrases(fast); } catch { threw = true; }
  ok(threw, "RED: phrases() throws on TOO TIGHT instead of squeezing a phrase");

  // ---------------------------------------------------------------- the rules on any events (red fixtures)
  ok(eventProblems([{ from: 0, to: 30, text: "it costs 24" }, { from: 32, to: 70, text: "frames a second" }], 24).some((p) => p.includes("a number from its unit")), "RED: a number split from its unit across two captions is caught");
  ok(eventProblems([{ from: 0, to: 30, text: "it costs 24 frames" }, { from: 32, to: 70, text: "a second each" }], 24).length === 0, "GREEN: the same words split after the unit pass");
  let refused = ""; try { toCaptions([{ from: 10, to: 11, text: "hi there" }], 24); } catch (e) { refused = String(e); }
  ok(refused.includes("is up 1 frame(s)"), "RED: a 1-frame caption is refused");
  let overlap = ""; try { toCaptions([{ from: 0, to: 30, text: "one two" }, { from: 29, to: 60, text: "three four" }], 24); } catch (e) { overlap = String(e); }
  ok(overlap.includes("starts -1 frame(s) after"), "RED: overlapping captions are refused");
  ok(eventProblems([{ from: 0, to: 24 * 8, text: "one two" }], 24).some((p) => p.includes("over 7 s")), "RED: a caption up over 7 s is caught");
  const long = "Supercalifragilistic extraordinarily wonderful words";
  ok(wrapPhrase(long, 32).length === 2 && wrapPhrase(long, 32).every((l) => l.length <= 32), "an over-long phrase wraps onto two lines that each fit");
  ok(eventProblems([{ from: 0, to: 100, text: "aaaaaaaaaaaaaaaaaaaaa bbbbbbbbbbbbbbbbbbbbbbb ccccccccccccccccccccccc" }], 24).some((p) => p.includes("does not fit two lines")), "RED: a phrase too long for two lines is caught");
  const longLine = phrases(timing([["l1", "Extraordinarily, unbelievably, astonishingly incomprehensible narration happens here today."]], 0.5));
  ok(longLine.every((e) => wrapPhrase(e.text, 32).every((l) => l.length <= 32)), "a line of long words splits so every screen line fits");

  // ---------------------------------------------------------------- captions in frames round trip through .srt/.vtt
  const caps = toCaptions(ev, 24), back = (txt: string, sep: string) => [...txt.matchAll(new RegExp(`(\\d\\d):(\\d\\d):(\\d\\d)${sep}(\\d{3}) --> (\\d\\d):(\\d\\d):(\\d\\d)${sep}(\\d{3})`, "g"))].map((m) => [m.slice(1, 5), m.slice(5, 9)].map(([h, mi, s, ms]) => Math.round(((+h * 60 + +mi) * 60 + +s + +ms / 1000) * 24)));
  const srt = back(toSrt(caps, 24), ","), vtt = back(toVtt(caps, 24), "\\.");
  ok(srt.length === caps.length && srt.every(([a, b], i) => a === caps[i].from && b === caps[i].to), "every caption's frames come back exactly from the .srt");
  ok(vtt.length === caps.length && vtt.every(([a, b], i) => a === caps[i].from && b === caps[i].to), "and from the .vtt");
  ok(toSrt(caps, 24).includes("This one draws itself in code,"), "the .srt carries the display words");

  // ---------------------------------------------------------------- cues
  const T2 = timing([["intro", "the clock rang out the hour"]]);
  ok(cue(T2, "intro") === T2.lines[0].start && cueEnd(T2, "intro") === T2.lines[0].end, "a line cue is its first and last frame");
  ok(cue(T2, "intro:clock") === T2.lines[0].words[1].from && cueEnd(T2, "intro:clock") === T2.lines[0].words[1].to, "a word cue is that word's frames");
  ok(cue(T2, "intro:the#2") === T2.lines[0].words[4].from, "#2 picks the second time a word is said");
  let unknown = ""; try { cue(T2, "intro:bell"); } catch (e) { unknown = String(e); }
  ok(unknown.includes("the clock rang out the hour"), "an unknown word throws and shows what the line says");

  // ---------------------------------------------------------------- placement inside the safe area
  const fake = { font: "", measureText: (s: string) => ({ width: s.length * 30 }) } as unknown as Ctx;
  const env916 = { W: 1080, H: 1920, scale: 1 } as Env, env169 = { W: 1920, H: 1080, scale: 1 } as Env;
  const e0: CaptionEvent = { from: 0, to: 40, text: "then comes home again", line: "x", words: [] };
  const b1 = subtitleBox(fake, env916, e0, 0, { home: [0.9, 0.97] });
  ok(b1.y + b1.h <= 1920 * 0.75 && b1.x + b1.w <= 1080 * 0.86 && b1.y >= 1920 * 0.14, "9:16: a phrase homed in the phone's bottom band and button column is moved into the clear area");
  const b2 = subtitleBox(fake, env169, e0, 0, { home: [0.5, 1.2] });
  ok(b2.y + b2.h <= 1080 * 0.95 && b2.x >= 1920 * 0.05, "16:9: a phrase stays inside 5 % margins");
  const b3 = subtitleBox(fake, env169, e0, 50, { home: (f) => (f < 48 ? [0.3, 0.2] : [0.7, 0.2]) });
  ok(Math.abs(b3.x + b3.w / 2 - 0.7 * 1920) < 1, "a per-shot home moves the phrase only where the function says (a cut)");

  // L7: a line whose display text is "" reaches the planner with no words; phrasePlan read words[0] of
  // an empty list and `narrate check` died on a TypeError instead of saying which line was empty.
  {
    const tm = timing([["a", "the first line is fine"], ["b", "so is the third"]]);
    tm.lines.splice(1, 0, { id: "blank", text: "", start: tm.lines[0].end + 6, end: tm.lines[0].end + 12, words: [] });
    let plan: ReturnType<typeof phrasePlan> | null = null, err = "";
    try { plan = phrasePlan(tm); } catch (e) { err = String(e); }
    ok(!!plan && plan.problems.some((p) => p.includes("blank") && p.includes("no words")), `L7 a line with no words is a named problem, not a crash (${err || plan?.problems.join(" | ")})`);
    ok(!!plan && plan.events.every((e) => e.text.length > 0) && plan.events.some((e) => e.line === "b"), "L7 and the lines around it are still planned");
  }
};
