// UNIT TESTS. Every test/*.test.ts module exports { name, run(ok) }; this bundles each with esbuild
// (the same resolver the films use) and runs it in node. No browser, no framework, exit 1 on any
// failure.   node tools/test.mjs [name ...]
import { build } from "esbuild";
import { existsSync, readdirSync } from "node:fs";
import { overlay } from "./overlay.mjs";

const only = process.argv.slice(2);
if (!existsSync("test")) { console.error("test: the unit suites are not in this install (the directory copy leaves them out to stay small). The anidoodle repository has them: see Links in the plugin README."); process.exit(2); }
const files = readdirSync("test").filter((f) => f.endsWith(".test.ts")).sort().filter((f) => !only.length || only.includes(f.replace(/\.test\.ts$/, "")));
if (!files.length) { console.error(`test: nothing to run${only.length ? ` for ${only.join(", ")}` : ""}`); process.exit(2); }
let pass = 0, fail = 0;
for (const f of files) {
  const js = (await build({ entryPoints: [`test/${f}`], bundle: true, format: "esm", write: false, platform: "neutral", plugins: [overlay], logLevel: "error" })).outputFiles[0].text;
  const mod = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));
  console.log(`\n${mod.name ?? f}`);
  try {
    mod.run((cond, label) => { if (cond) pass++; else fail++; console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}`); });
  } catch (e) { fail++; console.log(`  FAIL  crashed: ${e.stack ?? e}`); }
}
console.log(`\nTESTS: ${fail ? "FAIL" : "PASS"}   ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
