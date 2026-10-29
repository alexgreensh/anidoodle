// SHIP RULES. The parts of ship.mjs that decide, as pure functions (rows in, verdict out), so each is
// unit-tested with a case that must fail: the review ledger, the length budget, the critic sheet's
// frames and the verdict itself.
//
// reviews/<film>.json, the review ledger a critic writes and ship reads:
//   { "findings": [{ "id": "r1-4", "p": "P0", "status": "open" | "fixed" | "wontfix", "note": "...", "by": "critic r1" }],
//     "notes": [{ "at": "2026-10-27 21:36", "from": "the director", "text": "who is gonna read this overload of info?" }] }

/** One row of the table. status: PASS, FAIL, NONE (checked, nothing there, with the evidence), FLAG (looked, review it). */
export const row = (step, status, detail, lines = []) => ({ step, status, detail, lines });

// A CHECK THAT CANNOT LOOK FAILS. When a check has nothing to judge against (no temperament, no brand
// colours, no review ledger, no length budget) it did not look, and that is a FAIL, never a FLAG that
// passes: six such rows once added up to SHIP: PASS. A film that truly has nothing there says so, with a
// reason, in meta.checks.none: { "<row>": "<reason>" }, e.g. { "review": "a test fixture nobody is shown" }.
// That row is then NONE and the reason is printed in the table for the reader to judge.

/** The film's declared reason that a check has nothing to look at (meta.checks.none[step]), or null. */
export const waiver = (meta, step) => { const r = meta?.checks?.none?.[step]; return typeof r === "string" && r.trim() ? r.trim() : null; };
/** The row of a check that could not look: FAIL, or NONE with the film's declared reason. */
export const blindRow = (meta, step, why, lines = []) => {
  const r = waiver(meta, step);
  return r ? row(step, "NONE", `not checked, declared in meta.checks.none: ${r}`, lines) : row(step, "FAIL", `${why}: this check cannot look, so it fails (declare meta.checks.none["${step}"] = "<reason>" only when there is truly nothing to check)`, lines);
};
/**
 * A scanner's checks as rows (motionscan, layerscan): PASS and FAIL as they are, NONE (looked, nothing there)
 * as NONE, N/A (did not look) as a blind row. Any other status is a FAIL: it is not one ship knows.
 */
export const scannerRows = (label, r, meta, fails = []) => {
  let given = false;
  return Object.entries(r.checks ?? {}).map(([name, c]) => {
    const step = `${label}:${name}`, lines = c.status === "FAIL" && !given ? ((given = true), fails) : []; // the printer's findings go under the first failing check
    if (c.status === "N/A") return blindRow(meta, step, `did not look: ${c.reason}`);
    if (c.status === "NONE") return row(step, "NONE", c.reason ?? "nothing there to check");
    if (c.status === "PASS") return row(step, "PASS", "clean");
    if (c.status === "FAIL") return row(step, "FAIL", `${name} failed`, lines);
    return row(step, "FAIL", `unknown status '${c.status}' from the scanner`);
  });
};
/** ship --every: a whole number of frames, 1 or more. Above 1 it is a quick look (holds measured in steps), so the verdict is QUICK. */
export const shipEvery = (v) => {
  const n = v === undefined ? 1 : Number(v);
  if (!Number.isInteger(n) || n < 1) throw new Error(`--every wants a whole number of frames, 1 or more; got '${v}'`);
  return { every: n, quick: n > 1 };
};

/** The review ledger (R2/R3/R4): critic findings with a priority and a status, and the person's notes, verbatim. */
export const reviewRows = (j, path, err = null, meta = null) => {
  if (err) return [row("review", "FAIL", `${path} is not valid JSON: ${err}`)];
  if (!j) return [blindRow(meta, "review", `no ${path}: no critic findings recorded for this version (review.md: run a fresh critic and record its P0/P1 list there)`)];
  // the ledger's shape, before any of it is read: a wrong shape is a FAIL row, never a crash with no SHIP.md
  const shape = typeof j !== "object" || Array.isArray(j) ? "the ledger is not an object"
    : j.findings !== undefined && (!Array.isArray(j.findings) || j.findings.some((f) => !f || typeof f !== "object" || Array.isArray(f))) ? "findings is not a list of objects"
    : j.notes !== undefined && (!Array.isArray(j.notes) || j.notes.some((n) => !n || typeof n !== "object")) ? "notes is not a list of objects" : null;
  if (shape) return [row("review", "FAIL", `${path}: ${shape} ({ "findings": [{ "id", "p", "status", "note" }], "notes": [{ "at", "from", "text" }] })`)];
  const open = (j.findings ?? []).filter((f) => (f.status ?? "open") === "open"), p0 = open.filter((f) => f.p === "P0"), p1 = open.filter((f) => f.p === "P1");
  const out = [row("review", p0.length ? "FAIL" : p1.length ? "FLAG" : "PASS", `${(j.findings ?? []).length} finding(s) recorded, ${p0.length} open P0, ${p1.length} open P1`, [...p0, ...p1].map((f) => `${p0.includes(f) ? "FAIL" : "FLAG"}  ${f.p} ${f.id ?? ""} ${f.note ?? ""}`.trim()))];
  const notes = (j.notes ?? []).slice(-3);
  if (notes.length) out.push(row("notes", "FLAG", `the person's last ${notes.length} note(s): re-read each against the new sheet before showing it`, notes.map((n) => `${n.at ?? ""} ${n.from ?? ""}: "${n.text}"`.trim())));
  return out;
};

/** Length against meta.checks.length (D1), seconds. */
export const lengthRow = (meta, floor) => {
  const s = meta.durationFrames / meta.fps, L = meta.checks?.length, f = floor ? `; reading needs ${floor.floorS.toFixed(1)} s of it, text holds ${floor.spareS.toFixed(1)} s beyond reading` : "";
  const shots = (meta.shots ?? []).map((x) => `${x.id} ${((x.end - x.start) / meta.fps).toFixed(1)} s`).join(", ");
  const sh = shots ? [`shots: ${shots}`] : [];
  if (!L) return blindRow(meta, "length", `${s.toFixed(1)} s, no length budget (meta.checks.length { target, max })${f}`, sh);
  // a budget needs a number to judge against: max, else the target stands in for it (a budget with no max never failed)
  const num = (v) => typeof v === "number" && Number.isFinite(v) && v > 0, max = num(L.max) ? L.max : num(L.target) ? L.target : null, target = num(L.target) ? L.target : max;
  if (max === null) return row("length", "FAIL", `${s.toFixed(1)} s, the length budget has no number to judge against: give meta.checks.length { target, max } in seconds${f}`, sh);
  return row("length", s > max ? "FAIL" : s > target ? "FLAG" : "PASS", `${s.toFixed(1)} s against target ${target} s, max ${max} s${num(L.max) ? "" : " (no max: the target is the limit)"}${f}`, sh);
};

/** The frames of the critic sheet: one every 2 s, every shot start, the last frame (at most 60). */
export const sheetFrames = (meta) => {
  const N = meta.durationFrames, step = Math.max(1, Math.round(2 * meta.fps)), set = new Set([0, N - 1]);
  for (let f = 0; f < N; f += step) set.add(f); for (const s of meta.shots ?? []) set.add(s.start);
  let fr = [...set].filter((f) => f >= 0 && f < N).sort((a, b) => a - b);
  if (fr.length > 60) { const k = fr.length / 60; fr = Array.from({ length: 60 }, (_, i) => fr[Math.floor(i * k)]); fr[59] = N - 1; }
  return fr;
};

/**
 * PASS only when every row is PASS, NONE (checked, absent, with evidence) or FLAG (looked, review it); a row
 * with any other status fails. QUICK when the run was a quick look (--quick, or --every above 1).
 */
const KNOWN = new Set(["PASS", "NONE", "FLAG"]);
export const verdict = (rows, quick) => (rows.some((r) => !KNOWN.has(r.status)) ? "FAIL" : quick ? "QUICK" : "PASS");

