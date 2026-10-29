// FACTS DUPES TESTS. A fact said twice wastes a beat (a launch film said "about 400" in the hook and
// "400+" on a numbers card); a live site is a source with a date. Held to known answers, red and green.
// @ts-ignore: a plain ES module shared with the tools
import { checkFacts, dupes, entryProblems } from "../tools/factsrules.mjs";

export const name = "factsDupes";
export const run = (ok: (cond: boolean, label: string) => void) => {
  const site = { sentence: "Over 400 marketers joined last year.", url: "https://example.com/about", kind: "site", fetched: "2026-10-27" };
  const hook = { claim: "Actually, about 400 of them.", where: "on-screen", source: site };
  const card = { claim: "400+ marketers who figured it out", where: "on-screen", source: site };
  const red = checkFacts([hook.claim, card.claim], { claims: [hook, card] });
  ok(red.status === "FAIL" && red.problems.some((p: { why: string }) => /states 400 again/.test(p.why)), "RED: the same number on two cards fails, naming where it was first");
  ok(checkFacts([hook.claim, card.claim], { claims: [hook, { ...card, reuse: "the hook's number returns as the proof card's headline" }] }).status === "PASS", "a repeat with a reason passes");
  ok(checkFacts([hook.claim], { claims: [hook] }).status === "PASS", "one use passes");
  ok(dupes(["Nobody's on mute.", "nobody's on mute"], []).length === 1, "RED: the same line declared twice is caught, ignoring case and end punctuation");
  ok(dupes(["Day 1", "Step 1 of 3"], [{ claim: "Day 1" }, { claim: "Step 1 of 3" }]).length === 0, "single digits are counting words, not facts: never flagged");
  ok(dupes([], [{ claim: "03.05.2027 in Santiago" }, { claim: "See you 03.05.2027" }]).length === 1, "RED: a date repeated on two cards needs a reason too");
  ok(entryProblems({ claim: "c", source: { sentence: "c", url: "https://a.b", kind: "site" } }).some((w: string) => /fetched date/.test(w)), "RED: a site source with no fetched date fails");
  ok(entryProblems({ claim: "c", source: { sentence: "c", url: "https://a.b", kind: "site", fetched: "2026-10-27" } }).length === 0, "a site source with its date passes");
  // a visual count is a number: six '?' dots claim six more speakers
  ok(entryProblems({ claim: "6 more speakers coming", where: "on-screen", generated: true, note: "six ? dots" }).some((w: string) => /number/.test(w)), "RED: a drawn count listed as generated fails (a count is a claim: source it or draw one symbol)");
};
