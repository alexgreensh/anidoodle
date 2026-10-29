#!/usr/bin/env node
// Unit + end-to-end tests for tools/brand.mjs that need node's own modules (zlib, files), so they run
// here rather than in the bundled test/brand.test.ts. Temp folder under out/, removed afterwards.
//   node tools/brand-unit.mjs            (add --browser to also run the contact-sheet red/green pair)
import { strict as assert } from "node:assert";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { alphaBox, crop, decodePng, encodePng, inkOf, opaqueCorners, tint } from "./pngio.mjs";

const ENGINE = join(dirname(fileURLToPath(import.meta.url)), ".."), TOOL = join(ENGINE, "tools", "brand.mjs"), FIX = join(ENGINE, "test", "fixtures", "brand");
const root = join(ENGINE, "out", ".brand-unit"); rmSync(root, { recursive: true, force: true }); mkdirSync(root, { recursive: true });
let n = 0; const t = (label, fn) => { fn(); n++; console.log(`  PASS  ${label}`); };
const run = (...args) => spawnSync(process.execPath, [TOOL, ...args], { cwd: root, encoding: "utf8" });
try {
  // ---- PNG: written and read back, trimmed to ink, tinted
  const w = 40, h = 20, data = new Uint8Array(w * h * 4);
  for (let y = 5; y < 15; y++) for (let x = 10; x < 30; x++) { const i = (y * w + x) * 4; data.set([200, 30, 30, 255], i); }
  const back = decodePng(encodePng({ w, h, data }));
  t("a PNG written and read back is the same pixels", () => assert.deepEqual([...back.data], [...data]));
  t("the transparent margin is found and trimmed to 20x10 with 200 px of ink", () => { const b = alphaBox(back); assert.deepEqual(b, [10, 5, 20, 10]); assert.equal(inkOf(crop(back, b)), 200); });
  t("tinted white keeps alpha", () => { const x = tint(back, [255, 255, 255]); const i = (5 * w + 10) * 4; assert.deepEqual([...x.data.slice(i, i + 4)], [255, 255, 255, 255]); });
  t("RED: a logo on a solid background is caught", () => assert.ok(opaqueCorners({ w: 2, h: 2, data: new Uint8Array(16).fill(255) }) && !opaqueCorners(back)));
  t("NEGATIVE: not a PNG is refused", () => assert.throws(() => decodePng(Buffer.from([1, 2, 3])), /not a PNG/));
  const rgb = execFileSync("ffmpeg", ["-loglevel", "error", "-f", "lavfi", "-i", "color=c=red:s=8x4", "-frames:v", "1", "-pix_fmt", "rgb24", "-f", "image2pipe", "-vcodec", "png", "-"]);
  t("an RGB PNG from another encoder (ffmpeg, filtered rows) decodes", () => { const p = decodePng(rgb); assert.equal(p.w, 8); assert.ok(p.data[0] > 240 && p.data[1] < 12 && p.data[3] === 255, String([...p.data.slice(0, 4)])); });

  // ---- inventory -> find -> check, through the command line
  const figma = { document: { children: [{ name: "Social", children: [
    { id: "4:7", name: "Social Media partners", type: "FRAME", absoluteBoundingBox: { width: 1080, height: 1080 }, children: [{ type: "TEXT", characters: "Thank you to our sponsors" }] },
    { id: "4:8", name: "Story cover", type: "FRAME", absoluteBoundingBox: { width: 1080, height: 1920 }, children: [] }] }] } };
  writeFileSync(join(root, "file.json"), JSON.stringify(figma));
  t("inventory lists every frame", () => { const r = run("inventory", "--figma-json", "file.json"); assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /2 frames/); });
  t("find answers from the words on a frame", () => assert.match(run("find", "sponsors").stdout, /Social Media partners/));
  t("find says what it searched when nothing matches", () => assert.match(run("find", "speakers").stdout, /not in the names or words of the 2 frames/));
  t("RED: check fails while frames are unread", () => { const r = run("check"); assert.equal(r.status, 1); assert.match(r.stdout, /UNREAD/); });
  const md = join(root, "brand", "INVENTORY.md"); writeFileSync(md, readFileSync(md, "utf8").replace("| [ ] | Social | Social Media partners", "| [x] | Social | Social Media partners").replace("| [ ] | Social | Story cover", "| [-] same elements as the lockup | Social | Story cover"));
  t("check passes once every frame is read or skipped with a reason", () => assert.equal(run("check").status, 0));
  t("re-running inventory keeps the read marks", () => { run("inventory", "--figma-json", "file.json"); assert.equal(run("check").status, 0); });

  // ---- import and logos, through the command line
  t("import writes brand.json and a TS module, and reports the half-turn symmetry", () => { const r = run("import", join(FIX, "hourglass.svg"), "--ts", "src/canvas-core/demoBrand.ts"); assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /same after 1\/2 turn/); assert.ok(existsSync(join(root, "src/canvas-core/demoBrand.ts"))); });
  t("import names the mask it cannot draw", () => assert.match(run("import", join(FIX, "masked.svg"), "--out", "b2").stdout, /WARN .*mask/));
  mkdirSync(join(root, "logos")); writeFileSync(join(root, "logos", "wide.png"), encodePng({ w, h, data })); writeFileSync(join(root, "logos", "solid.png"), encodePng({ w: 2, h: 2, data: new Uint8Array(16).fill(255) }));
  writeFileSync(join(root, "logos", "shared.svg"), `<svg width="100" height="20" xmlns="http://www.w3.org/2000/svg"><rect width="60" height="20" fill="#123456"/><rect x="40" width="60" height="20" fill="#123456"/></svg>`);
  t("logos trims, skips a solid background, and flags shared outlines for the owner", () => { const r = run("logos", "logos", "--on", "dark"); assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /trimmed 40x20 -> 20x10/); assert.match(r.stdout, /SKIP\s+solid\.png has a solid background/); assert.match(r.stdout, /CHECK WITH OWNER/); assert.ok(existsSync(join(root, "brand/logos/shared-dark.svg"))); });

  // ---- M7: a flag that takes no value must not swallow the file after it; an unknown flag is refused
  t("RED (M7): an unknown flag is refused, never read as a value or a file", () => { const r = run("import", join(FIX, "hourglass.svg"), "--sheeet", join(FIX, "hardmask.svg"), "--out", "m7a"); assert.notEqual(r.status, 0); assert.match(r.stderr, /unknown flag --sheeet/); });

  t("RED: brand.json records each source relative to itself, never an absolute path", () => { const r = run("import", join(FIX, "hourglass.svg"), "--out", "relsrc"); assert.equal(r.status, 0, r.stdout + r.stderr); const j = JSON.parse(readFileSync(join(root, "relsrc", "brand.json"), "utf8")); for (const s of Object.values(j.sources)) { assert.ok(!s.file.startsWith("/") && !/^[A-Za-z]:/.test(s.file), `absolute path written: ${s.file}`); assert.ok(existsSync(join(root, "relsrc", s.file)), `relative path does not resolve: ${s.file}`); } });

  // ---- the test override can never send the Figma token off this machine
  await (async () => {
    const { figmaBase } = await import("./brand.mjs");
    t("RED: ANIDOODLE_FIGMA_API pointing at another host is refused", () => { assert.throws(() => figmaBase({ ANIDOODLE_FIGMA_API: "https://evil.example.com" }), /local test server/); assert.throws(() => figmaBase({ ANIDOODLE_FIGMA_API: "http://127.0.0.1.evil.example.com" }), /local test server/); });
    t("no override gives Figma itself; a localhost override is kept", () => { assert.equal(figmaBase({}), "https://api.figma.com"); assert.equal(figmaBase({ ANIDOODLE_FIGMA_API: "http://127.0.0.1:4010/" }), "http://127.0.0.1:4010"); });
  })();

  // ---- L10: a Figma image fetch that fails is an error, never an .svg holding the error page
  await (async () => {
    const { createServer } = await import("node:http"), { spawn } = await import("node:child_process");
    const srv = createServer((q, s) => {
      if (q.url.startsWith("/v1/files/")) { s.setHeader("content-type", "application/json"); s.end(JSON.stringify({ nodes: { "1:2": { document: { name: "Mark" } } } })); }
      else if (q.url.startsWith("/v1/images/")) { s.setHeader("content-type", "application/json"); s.end(JSON.stringify({ images: { "1:2": `http://127.0.0.1:${srv.address().port}/img.svg` } })); }
      else { s.statusCode = 403; s.end("<Error><Code>AccessDenied</Code></Error>"); }
    });
    await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
    const env = { ...process.env, FIGMA_TOKEN: "test-token", ANIDOODLE_FIGMA_API: `http://127.0.0.1:${srv.address().port}` };
    const r = await new Promise((ok) => { const c = spawn(process.execPath, [TOOL, "import", "--figma", "KEY", "--nodes", "1:2", "--out", "l10"], { cwd: root, env }); let out = "", err = ""; c.stdout.on("data", (d) => (out += d)); c.stderr.on("data", (d) => (err += d)); c.on("close", (status) => ok({ status, stdout: out, stderr: err })); });
    srv.close();
    t("RED (L10): a Figma image fetch that returns 403 fails the import and writes no .svg", () => { assert.notEqual(r.status, 0, r.stdout); assert.match(r.stderr, /403/); assert.ok(!existsSync(join(root, "l10", "src", "Mark.svg")), "the error page was saved as Mark.svg"); });
  })();

  if (process.argv.includes("--browser")) {
    t("RED (M7): a file after --sheet is imported too, not dropped as the flag's value", () => { const r = run("import", join(FIX, "hourglass.svg"), "--sheet", join(FIX, "hardmask.svg"), "--out", "m7"); assert.match(r.stdout, /2 file\(s\)/, r.stdout + r.stderr); assert.equal(Object.keys(JSON.parse(readFileSync(join(root, "m7", "brand.json"), "utf8")).report).length, 2); });
    t("the contact sheet passes an exact import", () => { const r = run("import", join(FIX, "hourglass.svg"), "--out", "g", "--sheet"); assert.equal(r.status, 0, r.stdout + r.stderr); assert.match(r.stdout, /BRAND: PASS/); });
    t("a hard white mask imports as a clip and passes the sheet", () => { const r = run("import", join(FIX, "hardmask.svg"), "--out", "h", "--sheet"); assert.equal(r.status, 0, r.stdout + r.stderr); });
    t("RED: the contact sheet fails the masked mark the import cannot draw", () => { const r = run("import", join(FIX, "masked.svg"), "--out", "r", "--sheet"); assert.equal(r.status, 1); assert.match(r.stdout, /BRAND: FAIL/); });
  }
  console.log(`\nBRAND-UNIT: PASS   ${n} checks`);
} catch (e) { console.log(`  FAIL  ${e.message}`); console.log("\nBRAND-UNIT: FAIL"); process.exitCode = 1; }
finally { rmSync(root, { recursive: true, force: true }); }
