// EMIT, INTERACTIVE. Ship an interactive piece as ONE ES module plus a page that uses it, and prove
// the page is self-contained and alive.
//
//   node tools/emit-interactive.mjs <piece> [--page my-page.html] [--out out/<piece>.html] [--module out/<piece>.mjs]
//
// <piece> is a module in src/canvas-core/ exporting a Piece of the same name (see input.ts).
//
// The module (<piece>.mjs) exports { piece, mount, define } and registers <ani-doodle piece="<kebab>">
// when imported, so a site can use either:
//     <script type="module" src="bit.mjs"></script>  <ani-doodle piece="mascot-hero"></ani-doodle>
//     import { mount, piece } from "./bit.mjs"; const c = mount(el, piece); c.setState("success");
// The page (<piece>.html) is --page with its <!--anidoodle--> marker replaced by the module, inlined
// (browsers refuse module imports from file://, and the page must open offline by double-click).
// Without --page you get a plain demo page with two bound buttons.
//
// Verified on the EMITTED files: nothing reaches outside itself (statically, and at run time from
// file:// with every non-file request counted as a failure), the element mounts and bakes, the
// piece moves on its own (two ticks differ), and the sizes are printed, raw and gzipped.
import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";
import { detect } from "./detect.mjs";

const VAL = new Set(["out", "module", "page", "title", "shot"]);
const pos = [], opt = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith("--")) opt[a.slice(2)] = VAL.has(a.slice(2)) ? process.argv[++i] : true; else pos.push(a); }
const die = (m) => { console.error(`emit-interactive: ${m}`); process.exit(1); };
const name = pos[0] ?? die("usage: node tools/emit-interactive.mjs <piece> [--page page.html] [--out out/x.html] [--module out/x.mjs]");
const kebab = name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
if (!existsSync(`src/canvas-core/${name}.ts`)) die(`no src/canvas-core/${name}.ts`);
const out = resolve(opt.out ?? `out/${kebab}.html`), modOut = resolve(opt.module ?? out.replace(/\.html$/, ".mjs"));

// ---------------------------------------------------------------- build
const buildModule = async (piece, tag = piece.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()) => (await build({
  stdin: { contents: `import { mount, define } from "./src/hosts/interactive"; import { ${piece} } from "./src/canvas-core/${piece}"; export const piece = ${piece}; export { mount, define }; define({ ${JSON.stringify(tag)}: ${piece} });`, resolveDir: process.cwd(), loader: "ts" },
  bundle: true, format: "esm", target: "es2020", minify: true, write: false, legalComments: "none",
})).outputFiles[0].text;
const js = await buildModule(name, kebab);
const defaultPage = () => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${opt.title ?? name}</title>
<style>body{margin:0;min-height:100vh;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,480px);gap:32px;align-items:center;padding:32px;box-sizing:border-box;background:#fbf6ea;color:#3d3437;font:16px/1.5 system-ui,sans-serif}button{font:inherit;padding:12px 20px;border-radius:999px;border:2px solid #3d3437;background:#fff;cursor:pointer;margin-right:8px}@media (max-width:760px){body{grid-template-columns:1fr}}</style></head>
<body><div><h1>${opt.title ?? name}</h1><p>Move, hover, tab, click.</p><button data-anidoodle="start">Get started</button><button data-anidoodle="tour">Take the tour</button></div><ani-doodle piece="${kebab}"></ani-doodle>
<!--anidoodle--></body></html>`;
const template = opt.page ? readFileSync(resolve(opt.page), "utf8") : defaultPage();
if (!template.includes("<!--anidoodle-->")) die(`${opt.page} has no <!--anidoodle--> marker to put the module at`);
const html = template.replace("<!--anidoodle-->", () => `<script type="module">${js.replace(/<\/script/gi, "<\\/script")}</script>`);
mkdirSync(dirname(out), { recursive: true }); mkdirSync(dirname(modOut), { recursive: true });
writeFileSync(modOut, js); writeFileSync(out, html);
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
console.log(`EMIT   ${name} -> <ani-doodle piece="${kebab}">`);
console.log(`       module ${modOut}  ${kb(Buffer.byteLength(js))} (${kb(gzipSync(js).length)} gzip)`);
console.log(`       page   ${out}  ${kb(Buffer.byteLength(html))} (${kb(gzipSync(html).length)} gzip)`);

// ---------------------------------------------------------------- verify
let fails = 0, checks = 0;
const say = (ok, label, detail = "") => { checks++; if (!ok) fails++; console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? "   " + detail : ""}`); };
console.log(`\n1. SELF-CONTAINED  the files reach outside themselves for nothing\n${"-".repeat(58)}`);
const count = (s, re) => (s.match(re) ?? []).length;
say(count(html, /https?:\/\//g) === 0, "no http(s) reference of any kind", `${count(html, /https?:\/\//g)} found`);
say(count(html, /<(img|audio|video|source|link|iframe)\b/gi) === 0, "no external element (img, audio, video, link, iframe)");
say(count(html, /<[a-z][^>]*\ssrc\s*=/gi) === 0, "no element with a src= attribute");
say(count(html, /@font-face|@import/gi) === 0, "no web font, no css import");
say(count(js, /fetch\(|XMLHttpRequest|importScripts|WebSocket|EventSource/g) === 0, "no network call in the module");
say(count(js, /Math\.random|Date\.now|new Date/g) === 0, "no Math.random or Date in the module (clocks are performance.now, in the host only)");

if (opt["no-verify"]) process.exit(fails ? 1 : 0);
const d = detect(); if (!d.pw.ok || !d.browser.ok) die(`cannot run the page: ${d.report.playwright}; ${d.report.browser}`);
console.log(`\n2. OFFLINE AND ALIVE  opened from file://\n${"-".repeat(58)}`);
const browser = await d.pw.lib.chromium.launch({ executablePath: d.browser.executablePath });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
const errors = [], reached = [];
page.on("pageerror", (e) => errors.push(e.message)); page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("request", (r) => { const u = r.url(); if (!/^(file|data|blob):/.test(u)) reached.push(u); });
await page.addInitScript(() => { window.__ANI_RASTER__ = "cpu"; }); /* one renderer for the whole check: see surfaceFor in hosts/interactive.ts */
await page.goto(pathToFileURL(out).href);
const r = await page.evaluate(async () => {
  const t = performance.now(); while (!window.__anidoodle?.length && performance.now() - t < 5000) await new Promise((f) => setTimeout(f, 20));
  const c = window.__anidoodle?.[0]; if (!c) return null; await c.ready; const ms = performance.now() - t;
  c.pause(); const log = c.log(); c.render(0, log); const a = c.hash(); c.render(37, log); const b = c.hash(); c.render(0, log); const a2 = c.hash();
  return { ms, a, b, a2, stats: c.stats(), n: window.__anidoodle.length };
});
say(errors.length === 0, "the page runs clean", errors.slice(0, 3).join("; ") || "no page error");
say(reached.length === 0, "nothing outside file: or data: was requested", reached.slice(0, 3).join("; ") || "0 outside requests");
say(!!r, "an <ani-doodle> mounted and baked", r ? `${r.n} piece(s), ready in ${r.ms.toFixed(0)} ms, ${r.stats.sprites} sprites, ${r.stats.spriteMB} MB at scale ${r.stats.scale}` : "no controller");
if (r) { say(r.a !== r.b, "it moves on its own (tick 0 and tick 37 differ)", `${r.a} / ${r.b}`); say(r.a === r.a2, "and tick 0 drawn again is the same frame", r.a2); }
if (opt.shot) await page.screenshot({ path: resolve(opt.shot) });
await browser.close();
console.log(`\n${"=".repeat(58)}\nEMIT-INTERACTIVE: ${fails ? `FAIL   ${fails} of ${checks} checks failed` : `PASS   ${checks}/${checks} checks`}   ${out}`);
process.exit(fails ? 1 : 0);
