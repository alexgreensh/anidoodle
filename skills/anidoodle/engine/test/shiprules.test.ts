// SHIP RULES TESTS. The decisions ship.mjs makes, each with a case that must fail: an open P0 from a
// critic, a film over its length budget, a skipped gate, and a check that could not look.
// @ts-ignore: a plain ES module shared with the tools
import { blindRow, lengthRow, reviewRows, row, scannerRows, sheetFrames, shipEvery, verdict, waiver } from "../tools/shiprules.mjs";

export const name = "shiprules";
export const run = (ok: (cond: boolean, label: string) => void) => {
  // ---- review ledger (R2, R3, R4)
  const led = { findings: [{ id: "r1-1", p: "P0", status: "open", note: "the middle 37-72 s is a carousel" }, { id: "r1-2", p: "P1", status: "open", note: "fades through olive" }, { id: "r1-3", p: "P0", status: "fixed", note: "five-ball blob" }],
    notes: ["make it 20% slower", "that last slide composition is a mess", "who is gonna read this overload of info?", "ugly... too many slides now"].map((text, i) => ({ at: `21:3${i}`, from: "director", text })) };
  const rr = reviewRows(led, "reviews/x.json");
  ok(rr[0].status === "FAIL" && rr[0].lines.length === 2, "NEGATIVE: an open P0 from the critic fails the ship; open P0 and P1 are listed");
  ok(rr[1]?.step === "notes" && rr[1].lines.length === 3 && rr[1].lines[2].includes("too many slides"), "the person's last three notes are printed verbatim, newest last");
  ok(reviewRows({ findings: [{ p: "P0", status: "fixed" }] }, "r.json")[0].status === "PASS", "every P0 fixed passes");
  ok(reviewRows({ findings: [{ p: "P1" }] }, "r.json")[0].status === "FLAG", "an open P1 (no status = open) flags, it does not pass silently");
  ok(reviewRows(null, "r.json")[0].status === "FAIL", "NEGATIVE H3: no review ledger cannot look, so it FAILS (it was a FLAG, and FLAG passed)");
  ok(reviewRows(null, "r.json", null, { checks: { none: { review: "a test fixture nobody is shown" } } })[0].status === "NONE", "H3 no ledger with a declared reason (meta.checks.none.review) is NONE, and the reason is printed");
  ok(reviewRows(null, "r.json", "Unexpected token")[0].status === "FAIL", "NEGATIVE: an unreadable ledger fails");
  // ---- length (D1)
  const meta = (s: number, length?: { target: number; max: number }) => ({ durationFrames: Math.round(s * 30), fps: 30, checks: length ? { length } : undefined, shots: [{ id: "a", start: 0, end: Math.round(s * 30) }] });
  ok(lengthRow(meta(108.7, { target: 75, max: 90 }), null).status === "FAIL", "NEGATIVE: the 108.7 s cut against a 90 s max fails");
  ok(lengthRow(meta(88.8, { target: 75, max: 90 }), null).status === "FLAG", "88.8 s is under max, over target: flagged");
  ok(lengthRow(meta(70, { target: 75, max: 90 }), null).status === "PASS", "under target passes");
  ok(lengthRow(meta(70), { floorS: 40, spareS: 12 }).status === "FAIL" && /reading needs 40\.0 s/.test(lengthRow(meta(70), { floorS: 40, spareS: 12 }).detail), "NEGATIVE H3: no budget cannot look, so it FAILS, and the reading floor is printed");
  ok(lengthRow({ ...meta(70), checks: { none: { length: "a loop with no fixed length" } } }, null).status === "NONE", "H3 no budget with a declared reason is NONE");
  // ---- L4: a budget with no max used to never fail
  ok(lengthRow(meta(100, { target: 75 } as never), null).status === "FAIL", "NEGATIVE L4: a budget with only a target fails a film past it (max falls back to target)");
  ok(lengthRow(meta(70, { max: "90" } as never), null).status === "FAIL", "NEGATIVE L4: a budget with no number to judge against fails, never passes");
  // ---- L3: a ledger of the wrong shape is a FAIL row, never a crash with no SHIP.md
  let l3 = "crash"; try { l3 = reviewRows({ findings: { id: "r1", p: "P0" } }, "r.json")[0].status; } catch { /* the crash is the bug */ }
  ok(l3 === "FAIL", `NEGATIVE L3: findings as an object is a FAIL row (got ${l3})`);
  let l3b = "crash"; try { l3b = reviewRows({ findings: [null, "x"], notes: "not a list" }, "r.json")[0].status; } catch { /* the crash is the bug */ }
  ok(l3b === "FAIL", `NEGATIVE L3: findings that are not objects, or notes that are not a list, fail (got ${l3b})`);
  // ---- the critic sheet and the verdict
  const fr = sheetFrames({ durationFrames: 300, fps: 30, shots: [{ start: 0 }, { start: 75 }] });
  ok(fr.includes(0) && fr.includes(75) && fr.includes(299) && fr.includes(60), `sheet: every 2 s, every shot start, the last frame (${fr.join(",")})`);
  ok(sheetFrames({ durationFrames: 30 * 600, fps: 30, shots: [] }).length === 60, "a long film's sheet is capped at 60 frames");
  ok(verdict([row("a", "PASS", ""), row("b", "NONE", ""), row("c", "FLAG", "")], false) === "PASS", "PASS, NONE (checked, absent) and FLAG (looked, review it) rows pass");
  ok(verdict([row("a", "PASS", ""), row("b", "N/A", "")], false) === "FAIL", "NEGATIVE H3: a row whose status is anything else (N/A) fails the ship");
  // ---- H3: a scanner check that did not look
  const na = { checks: { temperament: { status: "N/A", reason: "no temperament declared" }, slidecut: { status: "PASS" }, faces: { status: "NONE", reason: "no photos drawn" } } };
  const sr = scannerRows("motion", na, {});
  ok(sr.find((r: { step: string }) => r.step === "motion:temperament")?.status === "FAIL", "NEGATIVE H3: a scanner's N/A (did not look) is a FAIL row, never FLAG");
  ok(sr.find((r: { step: string }) => r.step === "motion:faces")?.status === "NONE" && sr.find((r: { step: string }) => r.step === "motion:slidecut")?.status === "PASS", "H3 NONE (looked, nothing there) stays NONE; PASS stays PASS");
  ok(scannerRows("motion", na, { checks: { none: { "motion:temperament": "an archive cut, no brand motion" } } }).find((r: { step: string }) => r.step === "motion:temperament")?.status === "NONE", "H3 a declared reason turns the blind row into NONE with the reason");
  ok(waiver({ checks: { none: { review: "  " } } }, "review") === null && blindRow({}, "x", "why").status === "FAIL", "H3 an empty reason is no reason: still FAIL");
  // the whole H3 input: no temperament, no brand colours, no ledger, no budget. It used to print SHIP: PASS.
  const h3 = [...scannerRows("motion", na, {}), ...reviewRows(null, "r.json"), lengthRow(meta(10), null)];
  ok(verdict(h3, false) === "FAIL", "NEGATIVE H3: a film where several checks could not look does not ship");
  // ---- M2: ship's --every
  ok(shipEvery(undefined).every === 1 && !shipEvery(undefined).quick, "M2 ship checks every frame by default");
  ok(shipEvery("3").every === 3 && shipEvery("3").quick === true, "NEGATIVE M2: ship --every 3 is a quick look: the verdict is QUICK, never PASS");
  let m2 = ""; try { shipEvery("abc"); } catch (e) { m2 = String((e as Error).message); }
  ok(/--every/.test(m2), "NEGATIVE M2: ship --every abc is refused, never passed through to check frame 0 alone");
  ok(verdict([row("a", "PASS", ""), row("b", "FAIL", "")], false) === "FAIL", "NEGATIVE: any FAIL row fails the ship");
  ok(verdict([row("a", "PASS", "")], true) === "QUICK", "NEGATIVE: a --quick run (gate skipped) is QUICK, never PASS");
};
