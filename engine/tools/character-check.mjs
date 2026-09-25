// CHARACTER GATE. node tools/character-check.mjs [--json out.json]
// Holds every character to its invariants (canon, joint limits, bone lengths, symmetry, hands,
// balance, identity per view, palette roles per hand, the walk's planted feet) and then runs the
// negative twins, which MUST fail. Exit code 1 on any failure. No browser needed: characters are
// pure geometry until a hand draws them.
import { build } from "esbuild";
import { writeFileSync } from "node:fs";

const js = (await build({ entryPoints: ["tools/character-check.entry.ts"], bundle: true, format: "esm", write: false, platform: "neutral" })).outputFiles[0].text;
const { run } = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
const t0 = process.hrtime.bigint(), res = run(), ms = Number(process.hrtime.bigint() - t0) / 1e6;
let pass = 0, fail = 0;
for (const { section, results } of res) {
  console.log(`\n${section}\n${"-".repeat(Math.min(96, section.length))}`);
  for (const r of results) { r.ok ? pass++ : fail++; console.log(`  ${r.ok ? "PASS" : "FAIL"}  ${r.id.padEnd(34)} ${r.detail}`); }
}
console.log(`\n${pass} passed, ${fail} failed, in ${ms.toFixed(0)} ms`);
const i = process.argv.indexOf("--json"); if (i > 0) writeFileSync(process.argv[i + 1], JSON.stringify(res, null, 2));
process.exit(fail ? 1 : 0);
