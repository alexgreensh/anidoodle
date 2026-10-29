// BOARD TESTS. A brief and storyboard are checked before anything is drawn: rows that carry nothing
// (a slide deck), a logo with no bridge, an abstract promise, jokes on the audience's own tool, counts
// that change for no reason, endings that end twice, events with no hosts or sponsors, texture text in
// real words. The red fixture is the first board of a brand launch film; the green one its fixed board.
// @ts-ignore: a plain ES module shared with the tools
import { checkBoard, BOARD_TEMPLATE } from "../tools/boardrules.mjs";
import good from "./fixtures/board/good.json";
import slides from "./fixtures/board/slides.json";

export const name = "board";
export const run = (ok: (cond: boolean, label: string) => void) => {
  const g = checkBoard(good);
  ok(g.status === "PASS", `the fixed board passes (${g.problems.map((p: { why: string }) => p.why).join("; ") || "no problems"})`);
  ok(g.table[1].carry === "the three dots" && g.seconds === 22, "the board prints each beat's carry and the total length");
  const r = checkBoard(slides), has = (re: RegExp) => r.problems.some((p: { where: string; why: string }) => re.test(`${p.where}: ${p.why}`));
  ok(r.status === "FAIL", "RED: the slide-deck board fails");
  ok(has(/carry nothing in from the row before/), "RED: two rows in a row with nothing carried are a slide cut");
  ok(has(/no bridge/) && has(/built from/), "RED: a logo that appears with no bridge and is built from nothing on screen");
  ok(has(/abstract word \(Multiply\)/) && has(/`does`/), "RED: a brand tagline as the promise, with nothing the viewer does or leaves with");
  ok(has(/brief.message/) && has(/brief.premise/), "RED: no message and no comic premise");
  ok(has(/people.hosts/) && has(/people.sponsors/), "RED: an event film with no hosts or sponsors listed");
  ok(has(/from 3 to 2 with no reason/), "RED: an actor's count changes with no reason");
  ok(has(/texture text .* real words/), "RED: filler text written in real words");
  ok(has(/repeats "400\+ marketers"/), "RED: a line said twice");
  ok(has(/returns to the card after the stinger/) && has(/stinger with nothing to answer/), "RED: card, stinger, card again: the film ends twice");
  ok(has(/never on the tool the audience relies on/) && has(/who gets it/), "RED: a joke on the audience's own tool, with no one named who gets it");
  ok(has(/spans 1 comic device/) && has(/no twist/), "RED: a pitch batch of one device, observations with no twist");
  ok(has(/mystery speaker/) && has(/talk title/), "RED: a mystery speaker and a long talk title in the program");
  ok(has(/brief.reference/), "RED: a brand film with no reference film");
  ok(checkBoard(BOARD_TEMPLATE).problems.some((p: { why: string }) => /TODO/.test(p.why)), "the starting template fails until its TODOs are filled");
  ok(checkBoard({ brief: good.brief, rows: [] }).status === "FAIL", "NEGATIVE: an empty board is never a pass");
  const long = { ...good, rows: good.rows.map((x: object) => ({ ...x, seconds: 20 })) };
  ok(checkBoard(long).problems.some((p: { where: string }) => p.where === "length"), "RED: rows that add up past length.max fail");
  const sameJokes = { ...good, jokes: good.jokes.map((j: object) => ({ ...j, device: "verbal" })) };
  ok(checkBoard(sameJokes).problems.some((p: { why: string }) => /use one device/.test(p.why)), "RED: every joke in one format fails");
  const noVoice = { ...good, brief: { ...good.brief, voices: {} } };
  ok(checkBoard(noVoice).problems.some((p: { why: string }) => /visual voice/.test(p.why)), "RED: a character's line with no registered visual voice fails");
};
