// FACTS RULES. The pure half of facts.mjs (no files, no browser), so it is unit-tested: what makes a
// claim's entry well formed, and whether every claim a film declares is listed. See facts.mjs for the
// file format and the command.
export const normClaim = (s) => String(s ?? "").toLowerCase().replace(/\s+/g, " ").replace(/^[\s"'“”]+|[\s.!?:;"'“”]+$/g, "");
const numbers = (s) => (String(s).match(/\d[\d.,]*\d|\d/g) ?? []).map((n) => n.replace(/[.,]+$/, ""));
export const EMPTY_FACTS = { version: 1, about: "Every claim the film makes, on screen or narrated. Sourced: { claim, where, source: { sentence, url or file } }. Generated: { claim, where, generated: true, note }. Nothing invented.", claims: [] };

/** One entry's own problems (shape only). */
export const entryProblems = (e) => {
  const out = [], claim = String(e?.claim ?? "").trim();
  if (!claim) return ["has no claim text"];
  if (/^todo\b/i.test(claim)) out.push("is still a TODO");
  if (e.generated === true) {
    if (!String(e.note ?? "").trim()) out.push("is generated but has no note saying what it is");
    if (numbers(claim).length) out.push("is generated but states a number (a number needs a source)");
    return out;
  }
  const src = e.source ?? {}, sentence = String(src.sentence ?? "").trim();
  // a live site changes: a site source carries the day it was read, so a viewer's "that's wrong now" can be dated
  if (src.kind === "site") { if (!src.url) out.push("is a site source with no url"); if (!/^\d{4}-\d{2}-\d{2}$/.test(String(src.fetched ?? ""))) out.push("is a site source with no fetched date (YYYY-MM-DD, the day the page was read)"); }
  if (!sentence) out.push("has no source.sentence (the exact sentence it comes from)");
  if (!String(src.url ?? "").trim() && !String(src.file ?? "").trim()) out.push("has no source.url or source.file");
  else if (src.url && !/^https?:\/\/\S+$/i.test(String(src.url).trim())) out.push(`source.url '${src.url}' is not an http(s) link`);
  if (sentence) { const have = new Set(numbers(sentence).map((n) => n.replace(/,/g, ""))); for (const n of numbers(claim)) if (!have.has(n.replace(/,/g, ""))) out.push(`states ${n}, which the source sentence does not`); }
  return out;
};

/**
 * claims: the strings a film declares (or undefined/empty). facts: the parsed facts.json, or null when absent.
 * -> { status: "PASS" | "FAIL" | "N/A", checked, problems: [{ claim, why }] }
 */
export const checkFacts = (claims, facts) => {
  const raw = (Array.isArray(claims) ? claims : []).map((c) => String(c).trim()).filter(Boolean), declared = [...new Set(raw)];
  if (!declared.length) return { status: "N/A", checked: 0, problems: [], reason: "the film declares no claims (film.claims), so nothing was checked" };
  if (!facts) return { status: "FAIL", checked: declared.length, problems: declared.map((c) => ({ claim: c, why: "has no facts.json to be listed in (node tools/facts.mjs init)" })) };
  const entries = Array.isArray(facts.claims) ? facts.claims : [], problems = [];
  if (!Array.isArray(facts.claims)) problems.push({ claim: "(facts.json)", why: "has no claims array" });
  const by = new Map(); for (const e of entries) { const k = normClaim(e?.claim); if (k && !by.has(k)) by.set(k, e); }
  for (const c of declared) {
    if (/^todo\b/i.test(c)) { problems.push({ claim: c, why: "is still a TODO in the film" }); continue; }
    const e = by.get(normClaim(c));
    if (!e) { problems.push({ claim: c, why: "is on screen but not listed in facts.json" }); continue; }
    for (const why of entryProblems(e)) problems.push({ claim: c, why });
  }
  problems.push(...dupes(raw, entries));
  const declaredKeys = new Set(declared.map(normClaim));
  for (const e of entries) if (!declaredKeys.has(normClaim(e?.claim))) for (const why of entryProblems(e)) problems.push({ claim: String(e?.claim ?? "(no claim)"), why }); // narrated and other listed claims are held to the same shape
  return { status: problems.length ? "FAIL" : "PASS", checked: declared.length, problems };
};

/** The film's declared claims (a launch film: film.claims; any film may set film.claims or meta.claims). */
export const claimsOf = (film) => film?.claims ?? film?.meta?.claims;


// A fact said twice is a beat wasted: a launch film said "about 400 of them" in the hook and "400+" on a
// numbers card, and the second one was cut late. Numbers worth repeating are rare enough to ask for a reason.
const FACT_NUMBER = /\d[\d.,]*\d[%+x]?|\d[%+x]|\d{2,}/g;
const factNumbers = (s) => [...new Set((String(s).match(FACT_NUMBER) ?? []).map((n) => n.replace(/[.,]+$/, "").replace(/[%+x]$/, "").replace(/,/g, "")).filter((n) => n.length >= 2 || /[%+x]/.test(n)))];
/**
 * Repeats across one film: the same line declared twice, or the same number stated by two entries.
 * The later entry may carry `reuse: "<why the repeat earns its place>"`. -> [{ claim, why }]
 */
export const dupes = (raw, entries = []) => {
  const out = [], seen = new Map();
  for (const c of raw ?? []) { const k = normClaim(c); if (seen.has(k)) { const e = entries.find((x) => normClaim(x?.claim) === k); if (!String(e?.reuse ?? "").trim()) out.push({ claim: c, why: "is on screen twice; cut one, or give its entry reuse: \"<why the repeat earns its place>\"" }); } seen.set(k, true); }
  const firstBy = new Map();
  for (const e of entries) for (const n of factNumbers(e?.claim)) {
    const first = firstBy.get(n);
    if (first === undefined) { firstBy.set(n, e); continue; }
    if (first !== e && !String(e.reuse ?? "").trim()) out.push({ claim: String(e.claim), why: `states ${n} again (first in "${String(first.claim).slice(0, 40)}"); say a fact once, or give this entry reuse: "<reason>"` });
  }
  return out;
};
