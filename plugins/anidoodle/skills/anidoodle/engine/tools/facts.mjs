// FACTS. Every claim a film makes, on screen or narrated, is listed in facts.json with the exact
// sentence it comes from and where that sentence lives (a URL or a file). Nothing is invented: no
// testimonial, rating, price, result or real person. What the film generates (a slogan, a drawn
// scene, a mock UI) is labelled `generated`. This is the explainer's research ledger, for any film.
//
//   facts.json
//   { "version": 1, "claims": [
//     { "claim": "Ships in 40 minutes.", "where": "on-screen",
//       "source": { "sentence": "Setup takes about 40 minutes.", "url": "https://example.com/docs" } },
//     { "claim": "IDEA IN. ART OUT.", "where": "on-screen", "generated": true, "note": "slogan written for this film, states no fact" } ] }
//
//   node tools/facts.mjs <film>[-<shape>] [--facts facts.json]   every claim the film declares is listed and well formed
//                                    (default: facts/<film>.json if the film has its own, else facts.json)
//   node tools/facts.mjs init [--facts facts.json]               write an empty facts.json (never overwrites)
//
// A film declares its claims as `film.claims` (a launch template film: the type-frame words, the split
// words and the tagline, plus any `claims: [...]` in its spec). A film that declares none is N/A,
// never a pass. The check is light on purpose: it cannot know a sentence is true, so it holds what it can.
//   - every declared claim has an entry (matched ignoring case, spacing and end punctuation);
//   - a sourced entry has the exact sentence and a URL (http/https) or a file;
//   - a generated entry says what it is, and states no number (a number needs a source);
//   - every number in a sourced claim appears in its source sentence;
//   - a TODO is not a claim yet;
//   - a fact is said once: the same line twice, or the same number in two entries, needs `reuse: "<reason>"`;
//   - a site source ({ kind: "site", url, fetched: "YYYY-MM-DD" }) carries the day it was read.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { isMain } from "./is-main.mjs";
import { EMPTY_FACTS, checkFacts, claimsOf } from "./factsrules.mjs";

// A film's ledger: facts/<film>.json when it has one of its own (the shipped examples do, so they never
// seed a user's facts.json), else the project's facts.json.
export const factsFile = (film) => { const own = resolve("facts", `${String(film ?? "").replace(/-(16x9|1x1|4x5|9x16)$/, "")}.json`); return existsSync(own) ? own : resolve("facts.json"); };
export const readFacts = (file) => { if (!existsSync(file)) return { facts: null }; try { return { facts: JSON.parse(readFileSync(file, "utf8")) }; } catch (e) { return { facts: null, error: `${file} is not valid JSON: ${e.message}` }; } };
export const initFacts = (file) => { if (existsSync(file)) return false; writeFileSync(file, JSON.stringify(EMPTY_FACTS, null, 2) + "\n"); return true; };

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2), fi = argv.indexOf("--facts"), name = argv.find((a, i) => !a.startsWith("--") && argv[i - 1] !== "--facts"), file = fi >= 0 ? resolve(argv[fi + 1]) : name === "init" ? resolve("facts.json") : factsFile(name);
  const USAGE = "node tools/facts.mjs <film>[-<shape>] [--facts facts.json]\n       node tools/facts.mjs init [--facts facts.json]";
  if (name === "init") { console.log(initFacts(file) ? `facts: wrote ${file}` : `facts: ${file} already exists; left as it is`); process.exit(0); }
  const { requireFilm } = await import("./names.mjs"), { loadFilm } = await import("./captions.mjs");
  const film = requireFilm(name, "facts", USAGE), f = await loadFilm(film), { facts, error } = readFacts(file);
  const r = error ? { status: "FAIL", checked: 0, problems: [{ claim: "(facts.json)", why: error }] } : checkFacts(claimsOf(f), facts);
  console.log(`FACTS   ${film}   ${file}`);
  for (const p of r.problems) console.log(`  FAIL  "${p.claim.slice(0, 60)}" ${p.why}`);
  console.log(r.status === "N/A" ? `FACTS: N/A   ${r.reason}` : r.status === "PASS" ? `FACTS: PASS   ${r.checked} claim(s), each listed with its source or labelled generated` : `FACTS: FAIL   ${r.problems.length} problem(s) in ${r.checked} claim(s)`);
  process.exit(r.status === "FAIL" ? 1 : 0);
}
