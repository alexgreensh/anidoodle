// BOARD RULES. The pure half of board.mjs: what a brief and a storyboard must hold before anything is
// drawn. Every rule here was a round of notes on a brand launch film: a board of facts that played as a
// slide deck, a logo that arrived with no reason, a brand tagline nobody understood, jokes that were all
// the same shape (and one that made the audience's own tool look stupid), a count of dots read as a
// promise of six more speakers, an ending that ended twice, organisers and sponsors forgotten, filler
// text that viewers tried to read. A rule that can be a check is a check; each failure names its fix.
//
// board.json
// { "version": 1,
//   "brief": { "story": "...", "message": "...", "premise": { "pain": "...", "stereotype": "..." } | "none: <why>",
//     "promise": { "line": "...", "does": "<what the viewer does>", "leaves": "<what they leave with>" },
//     "actor": "<the one object that carries the seams>", "kind": "event" | "product" | "story",
//     "people": { "hosts": [...] | "excluded: <why, who decided>", "sponsors": ..., "partners": ..., "speakers": ... },   (events)
//     "voices": { "<speaker>": "<how their lines look: dots then white type>" },
//     "reference": { "film": "<a film chosen with the person>", "notes": "<its deconstruction>" } | "none: <why>",
//     "length": { "target": 60, "max": 90 } },
//   "rows": [ { "id": "hook", "seconds": 3, "action": "<what moves>", "carry": "<what comes in from the previous row>",
//     "words": ["..."], "lines": [{ "speaker": "ai", "text": "..." }], "texture": ["blah blah"], "kind": "beat" | "card" | "stinger",
//     "brand": true, "bridge": "<why the logo appears now, from what is on screen>", "builtFrom": "<the thing that just acted>",
//     "counts": [{ "of": "dots", "from": 3, "to": 1, "why": "..." }], "answers": "<a stinger: what it answers, visible in the last 3 s>" } ],
//   "jokes": [ { "line": "...", "device": "verbal|visual|interaction|physical|structural", "butt": "situation|habit|...", "who": "<who gets it and why>", "row": "hook" } ],
//   "pitches": [ { "line": "...", "device": "...", "twist": "<the turn that makes it a joke>" } ],
//   "program": [ { "name": "...", "role": "...", "company": "...", "logo": "..." } ], "programTitles": "on: <why>" (titles are off by default) }

export const DEVICES = ["verbal", "visual", "interaction", "physical", "structural"];
const ABSTRACT = /\b(intelligence|synerg\w*|unlock\w*|empower\w*|transform\w*|multipl\w*|next[- ]level|leverag\w*|revolution\w*|elevat\w*|supercharg\w*|reimagin\w*|amplif\w*|innovat\w*)\b/i;
const MYSTERY = /^(tba|tbd|\?+|mystery|secret|to be announced|surprise)( speaker)?$/i;
const GREEK = /\b(blah|lorem|ipsum|dolor|lipsum)\b|x{3,}|~{2,}|_{3,}/i;
const words = (s) => String(s ?? "").toLowerCase().match(/[a-z0-9']+/g) ?? [];
const set = (v) => (Array.isArray(v) ? v.length > 0 : typeof v === "string" && /^(excluded|none)\s*:\s*\S/.test(v.trim()));
const reasoned = (v) => typeof v === "string" && /^(excluded|none|on)\s*:\s*\S/.test(v.trim());
const norm = (s) => String(s ?? "").toLowerCase().replace(/\s+/g, " ").replace(/^[\s"'“”]+|[\s.!?:;"'“”]+$/g, "");
const STOP = new Set(["the", "a", "an", "of", "to", "and", "in", "on", "it", "its", "is", "into", "from", "that", "then", "with", "as", "at", "by", "for", "they", "their", "one", "two", "three"]);
const shares = (a, b) => { const A = new Set(words(a).filter((w) => !STOP.has(w))); return words(b).some((w) => !STOP.has(w) && (A.has(w) || A.has(w.replace(/s$/, "")) || A.has(`${w}s`))); };

/** -> { status: "PASS" | "FAIL", problems: [{ where, why }], table: [{ id, seconds, carry, action }] , seconds } */
export const checkBoard = (board) => {
  const P = [], add = (where, why) => P.push({ where, why });
  if (!board || typeof board !== "object") return { status: "FAIL", problems: [{ where: "board", why: "is not a board object" }], table: [], seconds: 0 };
  const b = board.brief ?? {}, rows = Array.isArray(board.rows) ? board.rows : [];
  const todo = (v, path) => { if (typeof v === "string" && /^todo\b/i.test(v.trim())) add(path, "is still a TODO"); else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) todo(x, `${path}.${k}`); };
  todo(board.brief, "brief"); todo(board.rows, "rows");
  // ---- the brief
  if (!String(b.story ?? "").trim()) add("brief.story", "is missing: one sentence the film proves, written before anything else");
  if (!String(b.message ?? "").trim()) add("brief.message", "is missing: the line the viewer should leave repeating (a film of information with no message is a deck)");
  if (!b.premise || (typeof b.premise === "string" ? !reasoned(b.premise) : !(String(b.premise.pain ?? "").trim() && String(b.premise.stereotype ?? "").trim()))) add("brief.premise", "needs the comic premise { pain: whose pain, stereotype: which habit }, or \"none: <why this film plays it straight>\"");
  const pr = b.promise;
  if (!pr || !String(pr.line ?? "").trim()) add("brief.promise", "is missing: the promise line, naming what the viewer DOES and LEAVES WITH");
  else {
    if (!String(pr.does ?? "").trim() || !String(pr.leaves ?? "").trim()) add("brief.promise", "needs `does` (what the viewer does) and `leaves` (what they leave with): an abstract claim nobody can picture is not a promise");
    if (ABSTRACT.test(pr.line) && !reasoned(pr.taglineApproved)) add("brief.promise", `"${pr.line}" leans on an abstract word (${pr.line.match(ABSTRACT)[0]}); say what the viewer does and leaves with, or set taglineApproved: "on: <who approved it and why it reads>"`);
  }
  if (!String(b.actor ?? "").trim()) add("brief.actor", "is missing: name the one object that carries the film across its seams (the motif)");
  if (b.kind === "event") for (const k of ["hosts", "sponsors", "partners", "speakers"]) if (!set(b.people?.[k])) add(`brief.people.${k}`, `is missing: an event film lists its ${k}, or says "excluded: <why, and who decided>"`);
  if (["event", "product"].includes(b.kind) && !(b.reference && (reasoned(b.reference) || (String(b.reference.film ?? "").trim() && String(b.reference.notes ?? "").trim())))) add("brief.reference", "is missing: one reference film chosen with the person and deconstructed (shot lengths, seams, camera, type entry and exit), or \"none: <why>\"");
  // ---- the rows
  if (!rows.length) add("rows", "the board has no rows (an empty board is never a pass)");
  const table = [], seen = new Map();
  let seconds = 0, lastCard = -1, stingerAfterCard = -1;
  rows.forEach((r, i) => {
    const id = r.id ?? `row ${i + 1}`, at = `rows.${id}`;
    seconds += Number(r.seconds) || 0;
    if (!String(r.action ?? "").trim()) add(at, "has no action: a row says what MOVES and what it becomes, never only what is shown (a fact on a frame is a slide)");
    if (i > 1 && !String(r.carry ?? "").trim() && !String(rows[i - 1].carry ?? "").trim()) add(at, `and ${rows[i - 1].id ?? `row ${i}`} carry nothing in from the row before: two cuts in a row with nothing carried play as a slide deck. Name what moves across (an object, a shape, the camera)`);
    if (i > 0 && String(r.carry ?? "").trim() && !shares(r.carry, `${rows[i - 1].kind ?? ""} ${rows[i - 1].action} ${rows[i - 1].carry ?? ""} ${(rows[i - 1].words ?? []).join(" ")}`)) add(at, `carries "${r.carry}", which the row before never shows: the carried thing must be on screen on both sides of the seam`);
    if (r.brand) {
      if (!String(r.bridge ?? "").trim()) add(at, "reveals the brand with no bridge: answer \"why does the logo appear now?\" in one sentence from what is on screen (the brand arrives as the answer, shown as an action)");
      if (!String(r.builtFrom ?? "").trim()) add(at, "reveals the brand without saying what it is built from: the mark should be built from the thing that just acted");
      else if (i > 0 && !shares(r.builtFrom, `${rows[i - 1].action} ${rows[i - 1].carry ?? ""} ${r.action}`)) add(at, `builds the brand from "${r.builtFrom}", which is not what just acted on screen`);
    }
    for (const c of r.counts ?? []) if (c.from !== c.to && !String(c.why ?? "").trim()) add(at, `changes the count of ${c.of ?? "an actor"} from ${c.from} to ${c.to} with no reason on screen: keep the count, or show why it changes`);
    for (const t of r.texture ?? []) if (!GREEK.test(t) && words(t).length >= 3) add(at, `texture text "${String(t).slice(0, 40)}" is real words: text that is not meant to be read must look unreadable (blah, greeked), or the eye tries to read it`);
    for (const l of r.lines ?? []) if (!b.voices?.[l.speaker]) add(at, `has a line by "${l.speaker}", who has no visual voice in brief.voices: a character's lines always look the same (same bubble, same type)`);
    for (const w of [...(r.words ?? []), ...(r.lines ?? []).map((l) => l.text)]) { const k = norm(w); if (!k) continue; if (seen.has(k)) add(at, `repeats "${String(w).slice(0, 40)}" (first in ${seen.get(k)}): say a line once`); else seen.set(k, id); }
    if (r.kind === "card") { if (stingerAfterCard >= 0 && stingerAfterCard > lastCard) add(at, "returns to the card after the stinger: the film ends twice. One landing: the card OR the stinger is the last thing on screen"); lastCard = i; }
    if (r.kind === "stinger") { if (lastCard >= 0) stingerAfterCard = i; if (!String(r.answers ?? "").trim()) add(at, "is a stinger with nothing to answer: it must answer something visible in the 3 s before it"); }
    table.push({ id, seconds: Number(r.seconds) || 0, carry: r.carry ?? "", action: r.action ?? "" });
  });
  // ---- jokes
  const jokes = Array.isArray(board.jokes) ? board.jokes : [];
  for (const [i, j] of jokes.entries()) {
    const at = `jokes.${i + 1}`;
    if (!DEVICES.includes(j.device)) add(at, `"${String(j.line ?? "").slice(0, 40)}" needs a device: ${DEVICES.join(", ")}`);
    if (!String(j.who ?? "").trim()) add(at, `"${String(j.line ?? "").slice(0, 40)}" needs who gets it and why, in one line; a gag that needs explaining to the client is cut or rewritten`);
    if (/\b(tool|product|person|people|audience|user|ai)\b/i.test(String(j.butt ?? "")) || !String(j.butt ?? "").trim()) add(at, `the butt of "${String(j.line ?? "").slice(0, 40)}" is ${j.butt ? `"${j.butt}"` : "unnamed"}: the joke is on a situation or a habit, never on the tool the audience relies on or a real person`);
  }
  if (jokes.length >= 3) { const top = Math.max(...DEVICES.map((d) => jokes.filter((j) => j.device === d).length)); if (top / jokes.length > 0.6) add("jokes", `${top} of ${jokes.length} jokes use one device: vary it (a visual pun, an interaction, physical comedy, structure), one format repeated stops being funny`); }
  const pitches = Array.isArray(board.pitches) ? board.pitches : [];
  if (pitches.length) {
    const devices = new Set(pitches.map((p) => p.device).filter((d) => DEVICES.includes(d)));
    if (devices.size < Math.min(4, pitches.length)) add("pitches", `the batch spans ${devices.size} comic device(s): a pitch batch spans at least four (${DEVICES.join(", ")})`);
    for (const [i, p] of pitches.entries()) if (!String(p.twist ?? "").trim()) add(`pitches.${i + 1}`, `"${String(p.line ?? "").slice(0, 40)}" has no twist: an observation (true, with no turn) is not a joke`);
  }
  // ---- the program (events)
  for (const [i, s] of (board.program ?? []).entries()) {
    const at = `program.${i + 1}`;
    if (MYSTERY.test(String(s.name ?? "").trim())) add(at, `"${s.name}" is a mystery speaker: list real people only; for more to come, one symbol (a single "?") never a count`);
    for (const k of ["name", "role", "company"]) if (!String(s[k] ?? "").trim()) add(at, `${s.name ?? "a speaker"} has no ${k}: the program shows name, role and company logo for every speaker`);
    if (s.title && !reasoned(board.programTitles)) add(at, `${s.name} shows a talk title: titles are off by default (too long to read in a film); set programTitles: "on: <why>" to keep them`);
  }
  // ---- length
  const L = b.length ?? {};
  if (L.max && seconds > L.max) add("length", `the rows add up to ${seconds} s, over the ${L.max} s maximum: cut whole beats (never speed up reading)`);
  return { status: P.length ? "FAIL" : "PASS", problems: P, table, seconds };
};

/** A starting board with every field, for `board.mjs init`. */
export const BOARD_TEMPLATE = {
  version: 1,
  brief: {
    story: "TODO one sentence the film proves", message: "TODO the line the viewer leaves repeating",
    premise: { pain: "TODO whose pain", stereotype: "TODO which habit" },
    promise: { line: "TODO", does: "TODO what the viewer does", leaves: "TODO what they leave with" },
    actor: "TODO the one object that carries the seams", kind: "product",
    voices: { ai: "TODO how its lines look" },
    reference: { film: "TODO a film chosen with the person", notes: "TODO path to its deconstruction" },
    length: { target: 60, max: 90 },
  },
  rows: [{ id: "hook", seconds: 3, action: "TODO what moves and what it becomes", carry: "", words: [] }],
  jokes: [],
};
