// GATE RULES TESTS. Check 5 (3D) decided as a pure function, with the case that used to pass without
// looking: a 3D film whose rig registers nothing for checks3d printed a note, counted nothing, and the
// gate said PASS without one 3D check having run (H4).
// @ts-ignore: a plain ES module shared with the tools
import { deadAirVerdict, gripFindings, threeDVerdict } from "../tools/gaterules.mjs";

export const name = "gaterules";
export const run = (ok: (cond: boolean, label: string) => void) => {
  const none = threeDVerdict({ recs: [], sampled: 48, fill: 0, meta: {} });
  ok(none.counted && !none.ok, `NEGATIVE H4: a 3D film that registers nothing to check FAILS check 5 (got ${JSON.stringify(none)})`);
  const declared = threeDVerdict({ recs: [], sampled: 48, fill: 0, meta: { checks: { none: { "3d": "a product turntable: no characters, nothing held" } } } });
  ok(!declared.counted && /turntable/.test(declared.detail), "H4 a 3D film that declares why there is nothing to check (meta.checks.none['3d']) is listed with its reason, not failed");
  const clean = threeDVerdict({ recs: [{ frame: 0, findings: [], grips: [{ name: "cup", x: 1, y: 1 }] }], sampled: 1, fill: 0, meta: {} });
  ok(clean.counted && clean.ok, "H4 frames checked with no finding pass");
  const bad = threeDVerdict({ recs: [{ frame: 3, findings: [{ frame: 3, kind: "grip", where: "hand", detail: "through the handle" }], grips: [] }], sampled: 1, fill: 0, meta: {} });
  ok(bad.counted && !bad.ok && /through the handle/.test(bad.detail), "a finding fails, and is printed");
  // ---- L6: still --grips labelled every crop with every grip finding on the frame
  const fs = [
    { frame: 5, kind: "grip-gap", where: "chef holding cup", detail: "floats" },
    { frame: 5, kind: "grip-through-hand", where: "waiter holding tray", detail: "through" },
    { frame: 5, kind: "grip-prop-in-holder", where: "chef / cup at (0,1,0)", detail: "6 points" },
    { frame: 5, kind: "self", where: "chef: arm into its own body", detail: "x" },
  ];
  const cup = gripFindings({ name: "chef/cup" }, fs).map((x: { kind: string }) => x.kind).join(","), tray = gripFindings({ name: "waiter/tray" }, fs).map((x: { kind: string }) => x.kind).join(",");
  ok(cup === "grip-gap,grip-prop-in-holder" && tray === "grip-through-hand", `NEGATIVE L6: each grip crop carries only its own findings (cup: ${cup}; tray: ${tray})`);
  ok(gripFindings({ name: "a/b/c" }, [{ frame: 0, kind: "grip-open", where: "a/b holding c", detail: "" }]).length === 1, "L6 a holder name with a slash in it still matches its grip");

  // CHECK 3, DEAD AIR: a film made before a check existed (a frozen, published film) may declare one dead-air
  // row in meta.checks.none with its reason. The row is then listed with the reason AND its findings, never
  // counted as a pass that looked; a film with no declaration still FAILS; a passing row is unaffected.
  const stillRow = deadAirVerdict("gate:identical", false, "1, 2, 3", {});
  ok(stillRow.counted && !stillRow.ok, "NEGATIVE: identical frames with no declaration FAIL the gate");
  const frozen = deadAirVerdict("gate:identical", false, "1, 2, 3", { checks: { none: { "gate:identical": "frozen source of a published film" } } });
  ok(!frozen.counted && /published/.test(frozen.detail) && /1, 2, 3/.test(frozen.detail), "a declared dead-air row is listed with its reason and its findings, not counted");
  ok(deadAirVerdict("gate:identical", false, "1", { checks: { none: { "gate:identical": "  " } } }).counted, "NEGATIVE: an empty reason is no declaration");
  ok(deadAirVerdict("gate:still", false, "4-19", { checks: { none: { "gate:identical": "x" } } }).counted, "NEGATIVE: a declaration covers only the row it names");
  const fine = deadAirVerdict("gate:still", true, "none", { checks: { none: { "gate:still": "x" } } });
  ok(fine.counted && fine.ok, "a row that passes is a pass whether or not it is declared");
};
