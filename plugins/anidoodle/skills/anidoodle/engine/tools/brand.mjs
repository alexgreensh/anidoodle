// BRAND. A brand film uses the brand's EXACT elements, logos and motion, imported and signed off before
// the first storyboard. Drawing them anew from screenshots cost a launch film four rounds of rejection
// ("use the right elements, exact ones from the design file, never invent or draw the official ones
// anew"). This tool turns the source into a brand file the film draws from, and makes the sign-off a check.
//
//   node tools/brand.mjs import <file.svg|dir ...> [--out brand] [--ts src/canvas-core/myBrand.ts] [--sheet] [--on #111]
//        exact paths per element (fills, gradients, transforms, <use>, clip-paths resolved) -> brand/brand.json and a TS
//        module (BRAND + brandMeta for meta.brand); prints each element's parts, symmetry and repeat period.
//        --sheet draws every element twice, from its source SVG and from the import, and fails past 1% different ink.
//   node tools/brand.mjs import --figma <fileKey> --nodes <id,id> [...]   route 1: the Figma REST API, read only,
//        token in FIGMA_TOKEN; exports SVG with text outlined, then imports as above. Never writes to the file.
//   node tools/brand.mjs inventory (--figma <fileKey> | --figma-json file.json | --dir <exports>) [--out brand]
//        EVERY frame of the source -> brand/INVENTORY.md (a read box per frame) + inventory.json + the source's own
//        transition timings as motion tokens (brand/motion.json, merged into brand.json on the next import).
//   node tools/brand.mjs find <words> [--out brand]      "is X in the file?" answered from the whole inventory
//   node tools/brand.mjs check [--out brand]             fails while any frame is unread, or skipped with no reason
//   node tools/brand.mjs logos <dir> --on dark|light [--out brand/logos]
//        each logo (SVG or PNG): trimmed to its ink, a one-colour version for the ground, ink measured, a size that
//        makes every logo read equally, outlines that overlap flagged "check with the owner" (never auto-fixed);
//        writes logos.json and strip.html (+ strip.png when a browser is installed).
//   node tools/brand.mjs logo <film-render.svg|png> --ref <production-screenshot.png> [--out brand/logo-check.png]
//        the production logo and the film's logo side by side at the same height, for a human to sign off first.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isMain } from "./is-main.mjs";
import { brandModule, coloursOf, equaliseLogos, importSvg, logoMetrics, monochrome, repeats, symmetry, toSvg } from "./brandsvg.mjs";
import { checkInventory, findInInventory, framesFromFigma, framesFromFiles, motionTokens, parseInventory, renderInventory } from "./brandinv.mjs";
import { alphaBox, crop, decodePng, encodePng, inkOf, opaqueCorners, tint } from "./pngio.mjs";

const ENGINE = join(dirname(fileURLToPath(import.meta.url)), "..");
const sha = (b) => createHash("sha256").update(b).digest("hex");
const ident = (s) => { const w = String(s).replace(/\.[^.]+$/, "").split(/[^A-Za-z0-9]+/).filter(Boolean); const id = w.map((x, i) => (i ? x[0].toUpperCase() + x.slice(1) : x[0].toLowerCase() + x.slice(1))).join(""); return /^[0-9]/.test(id) ? `el${id}` : id || "element"; };
const svgFiles = (paths) => paths.flatMap((p) => statSync(p).isDirectory() ? readdirSync(p).filter((f) => f.toLowerCase().endsWith(".svg")).sort().map((f) => join(p, f)) : [p]);

/** The import, pure apart from reading the files: -> { elements, report, palette, fonts, sources }. */
export const importFiles = (files) => {
  const elements = {}, report = {}, sources = {}, palette = new Map(), fonts = new Set();
  for (const f of files) {
    const text = readFileSync(f, "utf8"), name = ident(basename(f)), el = importSvg(text);
    if (elements[name]) throw new Error(`two sources map to the element name '${name}' (${sources[name].file} and ${f}); rename one`);
    elements[name] = { w: el.w, h: el.h, parts: el.parts }; sources[name] = { file: f, sha256: sha(text) };
    for (const [c, a] of coloursOf(el)) palette.set(c, (palette.get(c) ?? 0) + a);
    el.fonts.forEach((x) => fonts.add(x));
    report[name] = { parts: el.parts.length, size: `${el.w}x${el.h}`, symmetry: el.parts.length ? symmetry(el) : null, repeats: repeats(el), warnings: el.warnings, fonts: el.fonts };
  }
  const total = [...palette.values()].reduce((a, b) => a + b, 0) || 1;
  return { elements, report, sources, fonts: [...fonts], palette: [...palette].sort((a, b) => b[1] - a[1]).map(([hex, a]) => ({ hex, share: Math.round((a / total) * 1000) / 1000 })) };
};
const describe = (r) => [
  r.symmetry ? (r.symmetry.rotational > 1 ? `same after 1/${r.symmetry.rotational} turn (lands from a spin without a jump)` : "no rotational symmetry") + (r.symmetry.mirrorX ? ", mirror left-right" : "") + (r.symmetry.mirrorY ? ", mirror top-bottom" : "") : "empty",
  ...r.repeats.map((p) => `${p.what === "pattern" ? "colour pattern" : "shape"}: ${p.copies} copies every ${p.step[0] || p.step[1]} units ${p.step[0] ? "across" : "down"}${p.seamless ? ", tiles without a seam" : ""}`),
].join("; ");

// ------------------------------------------------------------------ browser pages (contact sheet, logo strip, side by side)
const kitBundle = async () => {
  const { build } = await import("esbuild");
  return (await build({ entryPoints: [join(ENGINE, "src", "canvas-core", "brandKit.ts")], bundle: true, write: false, format: "iife", globalName: "BK", logLevel: "error" })).outputFiles[0].text;
};
// JSON inside a <script> must not carry '<' (a '</script>' or '<!--' in an SVG comment ends or bends the script)
const safeJson = (v) => JSON.stringify(v).replace(/</g, "\\u003c");
/** Contact sheet: each element from its source SVG, from the import, and their difference in red. */
export const sheetHtml = (brand, svgTexts, kit, ground = "checker") => `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;padding:24px;font:14px/1.4 Poppins,Arial,sans-serif;background:#f4f2ec;color:#111}h1{font-size:20px;margin:0 0 16px}
.row{display:grid;grid-template-columns:200px repeat(3,360px);gap:16px;align-items:center;margin-bottom:18px}
.cell{width:360px;height:240px;display:flex;align-items:center;justify-content:center;${ground === "checker" ? "background:repeating-conic-gradient(#ddd 0 25%,#fff 0 50%) 0 0/16px 16px" : `background:${ground}`}}
img,canvas{max-width:340px;max-height:220px}.bad{color:#b3261e;font-weight:700}</style></head><body>
<h1>Brand contact sheet: source / import / difference</h1><div id="rows"></div>
<script>${kit}</script><script>
const B=${safeJson(brand.elements)}, S=${safeJson(svgTexts)}, out={};
(async()=>{for(const name of Object.keys(B)){const el=B[name], k=Math.min(1400/el.w,600/el.h), W=Math.max(1,Math.round(el.w*k)), H=Math.max(1,Math.round(el.h*k));
 const row=document.createElement('div');row.className='row';row.innerHTML='<div><b>'+name+'</b><br>'+el.parts.length+' parts<br><span id="r-'+name+'"></span></div>';
 const img=new Image();img.width=W;img.height=H;img.src='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(S[name])));const okImg=await img.decode().then(()=>true,()=>false);if(!okImg){out[name]={ink:0,diff:0,share:1,broken:true};row.innerHTML+='<div class=bad>the source SVG does not render in a browser (invalid XML?)</div>';document.getElementById('rows').appendChild(row);continue;}
 const a=document.createElement('canvas');a.width=W;a.height=H;const ca=a.getContext('2d');ca.drawImage(img,0,0,W,H);
 const b=document.createElement('canvas');b.width=W;b.height=H;const cb=b.getContext('2d');cb.scale(k,k);BK.drawEl(cb,el,{name});
 const d=document.createElement('canvas');d.width=W;d.height=H;const cd=d.getContext('2d');const A=ca.getImageData(0,0,W,H).data,Bd=cb.getImageData(0,0,W,H).data,D=cd.createImageData(W,H);
 let ink=0,diff=0;for(let i=0;i<A.length;i+=4){const on=A[i+3]>40||Bd[i+3]>40;if(on)ink++;const dd=Math.max(Math.abs(A[i]*A[i+3]-Bd[i]*Bd[i+3]),Math.abs(A[i+1]*A[i+3]-Bd[i+1]*Bd[i+3]),Math.abs(A[i+2]*A[i+3]-Bd[i+2]*Bd[i+3]),Math.abs(A[i+3]-Bd[i+3])*255)/255;
  // a difference a 1 px shift explains is antialiasing, not a different shape: count it only when no neighbour of the source matches
  let real=false;if(dd>64){real=true;const x=(i/4)%W,y=Math.floor(i/4/W);for(let oy=-1;oy<=1&&real;oy++)for(let ox=-1;ox<=1&&real;ox++){const xx=x+ox,yy=y+oy;if(xx<0||yy<0||xx>=W||yy>=H)continue;const j=(yy*W+xx)*4;
   const e=Math.max(Math.abs(A[j]*A[j+3]-Bd[i]*Bd[i+3]),Math.abs(A[j+1]*A[j+3]-Bd[i+1]*Bd[i+3]),Math.abs(A[j+2]*A[j+3]-Bd[i+2]*Bd[i+3]),Math.abs(A[j+3]-Bd[i+3])*255)/255;if(e<=64)real=false}}
  if(real){diff++;D.data[i]=220;D.data[i+3]=255}else if(on){D.data[i]=D.data[i+1]=D.data[i+2]=180;D.data[i+3]=120}}
 cd.putImageData(D,0,0);const share=ink?diff/ink:0;out[name]={ink,diff,share};
 for(const c of [img,b,d]){const w=document.createElement('div');w.className='cell';w.appendChild(c);row.appendChild(w)}
 document.getElementById('rows').appendChild(row);const r=document.getElementById('r-'+name);r.textContent=(share*100).toFixed(2)+'% of ink differs';if(share>0.01)r.className='bad';}
 window.__results=out;document.body.dataset.done='1';})();
</script></body></html>`;
const shoot = async (html, out, width = 1400) => {
  const { detect } = await import("./detect.mjs"), env = detect();
  if (!env.pw.ok || !env.browser.ok) return { shot: false, why: `no browser (${env.report.playwright}; ${env.report.browser}); open the .html file instead` };
  const browser = await env.pw.lib.chromium.launch({ executablePath: env.browser.executablePath });
  try {
    const page = await browser.newPage({ viewport: { width, height: 800 }, deviceScaleFactor: 1 });
    const errors = []; page.on("pageerror", (e) => errors.push(e.message));
    await page.setContent(html); await page.waitForSelector("body[data-done]", { timeout: 30000 }).catch((e) => { throw new Error(`the page never finished${errors.length ? `: ${errors.join("; ")}` : ""} (${e.message.split("\n")[0]})`); });
    const results = await page.evaluate(() => window.__results ?? null);
    mkdirSync(dirname(out), { recursive: true }); await page.screenshot({ path: out, fullPage: true });
    return { shot: true, results };
  } finally { await browser.close(); }
};

// ------------------------------------------------------------------ logos
const logoStripHtml = (logos, ground) => `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;padding:40px;background:${ground};font:13px Poppins,Arial,sans-serif;color:${ground === "#111111" ? "#eee" : "#111"}}
.strip{display:flex;gap:56px;align-items:center;flex-wrap:wrap}figure{margin:0;text-align:center}figcaption{margin-top:10px;opacity:.8}</style></head><body><div class="strip">
${logos.map((l) => `<figure><img style="height:${l.height}px" src="data:${l.mime};base64,${l.b64}"><figcaption>${l.name}${l.overlaps ? " · check with owner" : ""}</figcaption></figure>`).join("")}
</div><script>Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))).then(()=>{document.body.dataset.done='1'})</script></body></html>`;

// ------------------------------------------------------------------ Figma REST (route 1). Read only.
// ANIDOODLE_FIGMA_API points the calls at a local stand-in for the unit tests. It is accepted only on
// this machine (localhost), so a stray environment variable can never send the token to another host.
export const figmaBase = (env = process.env) => {
  const v = env.ANIDOODLE_FIGMA_API; if (!v) return "https://api.figma.com";
  let u; try { u = new URL(v); } catch { throw new Error(`ANIDOODLE_FIGMA_API is not a URL: unset it to use Figma itself`); }
  if (u.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(u.hostname)) throw new Error(`ANIDOODLE_FIGMA_API must be a local test server (http://127.0.0.1:<port>), got ${u.host}: unset it to use Figma itself`);
  return v.replace(/\/$/, "");
};
const figma = async (path) => {
  const token = process.env.FIGMA_TOKEN; if (!token) throw new Error("FIGMA_TOKEN is not set: make a personal access token (Figma > Settings > Security, read-only file scope) and export FIGMA_TOKEN=..., or use route 4 (ask for an SVG export) in references/workflows/brand-film.md");
  const r = await fetch(`${figmaBase()}/v1/${path}`, { headers: { "X-Figma-Token": token } });
  if (!r.ok) throw new Error(`Figma API ${r.status} on ${path.split("?")[0]}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
};

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2), cmd = argv[0], opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; }, has = (k) => argv.includes(k);
  // Only the flags that take a value skip the word after them; --sheet takes none, so a file after it is
  // still a file. An unknown flag is refused rather than guessed at.
  const VALUED = ["--out", "--ts", "--on", "--figma", "--nodes", "--figma-json", "--dir", "--ref"], BOOL = ["--sheet"];
  const bad = argv.slice(1).find((a) => a.startsWith("--") && !VALUED.includes(a) && !BOOL.includes(a));
  if (bad) { console.error(`brand: unknown flag ${bad} (flags: ${[...VALUED, ...BOOL].join(" ")})`); process.exit(2); }
  const pos = argv.slice(1).filter((a, i, all) => !a.startsWith("--") && !VALUED.includes(all[i - 1]));
  const OUT = resolve(opt("--out", "brand"));
  const die = (m) => { console.error(`brand: ${m}`); process.exit(1); };
  try {
    if (cmd === "import") {
      let files = pos.length ? svgFiles(pos.map((p) => resolve(p))) : [];
      if (opt("--figma")) {
        const key = opt("--figma"), ids = String(opt("--nodes", "")).split(",").filter(Boolean); if (!ids.length) die("--figma needs --nodes <id,id> (brand.mjs inventory lists every frame id)");
        const names = await figma(`files/${key}/nodes?ids=${encodeURIComponent(ids.join(","))}`), urls = await figma(`images/${key}?ids=${encodeURIComponent(ids.join(","))}&format=svg&svg_outline_text=true&svg_simplify_stroke=false`);
        mkdirSync(join(OUT, "src"), { recursive: true });
        for (const id of ids) { const u = urls.images?.[id]; if (!u) die(`Figma rendered nothing for node ${id}`); const res = await fetch(u); if (!res.ok) die(`Figma's image for node ${id} failed: HTTP ${res.status} (nothing written; the link may have expired, run the import again)`); const svg = await res.text(); if (!/<svg[\s>]/i.test(svg)) die(`Figma's image for node ${id} is not an SVG (nothing written)`); const f = join(OUT, "src", `${ident(names.nodes?.[id]?.document?.name ?? id)}.svg`); writeFileSync(f, svg); files.push(f); }
      }
      if (!files.length) die("nothing to import: give SVG files or folders, or --figma <fileKey> --nodes <ids>");
      const brand = importFiles(files), motionFile = join(OUT, "motion.json");
      brand.motion = existsSync(motionFile) ? JSON.parse(readFileSync(motionFile, "utf8")) : {};
      mkdirSync(OUT, { recursive: true });
      // source paths are written relative to brand.json, so the file never carries the person's folder names
      // (a brand.json is often committed or shared); the sheet below still reads the absolute paths in memory
      const relSources = Object.fromEntries(Object.entries(brand.sources).map(([n, s]) => [n, { ...s, file: relative(OUT, s.file).split("\\").join("/") }]));
      writeFileSync(join(OUT, "brand.json"), JSON.stringify({ version: 1, ...brand, sources: relSources }, null, 1));
      const tsOut = resolve(opt("--ts", join(OUT, "brand.ts"))), kit = [resolve("src/canvas-core/brandKit.ts"), join(ENGINE, "src/canvas-core/brandKit.ts")].find(existsSync);
      const kitImport = kit ? (relative(dirname(tsOut), kit).replace(/\\/g, "/").replace(/\.ts$/, "")) : null;
      mkdirSync(dirname(tsOut), { recursive: true }); writeFileSync(tsOut, brandModule(brand, kitImport && (kitImport.startsWith(".") ? kitImport : `./${kitImport}`)));
      console.log(`BRAND IMPORT   ${files.length} file(s) -> ${relative(process.cwd(), join(OUT, "brand.json"))}, ${relative(process.cwd(), tsOut)}\n`);
      for (const [n, r] of Object.entries(brand.report)) { console.log(`  ${n.padEnd(18)} ${String(r.parts).padStart(3)} parts  ${r.size.padEnd(11)} ${describe(r)}`); for (const w of r.warnings) console.log(`  ${"".padEnd(18)} WARN  ${w}`); }
      console.log(`\n  palette: ${brand.palette.slice(0, 10).map((p) => `${p.hex} ${(p.share * 100).toFixed(0)}%`).join(", ")}`);
      if (brand.fonts.length) console.log(`  fonts (live text in the source): ${brand.fonts.join(", ")}. Ask once, early, for the font files (OTF/TTF/WOFF2), or re-export with text outlined. A stand-in face is recorded in the brief and flagged on the review page.`);
      const tokens = Object.entries(brand.motion).filter(([k]) => k !== "_springs");
      if (tokens.length) console.log(`  motion tokens from the source (motionKit motionTokens(BRAND.motion, fps)): ${tokens.slice(0, 4).map(([k, m]) => `${k} ${m.ms} ms ${m.ease === "linear" ? "linear" : `cubic-bezier(${m.ease.join(", ")})`}`).join("; ")}`);
      if (brand.motion._springs) console.log(`  ${brand.motion._springs.length} spring easing(s) have no bezier form; translate them with the person (motion.json _springs)`);
      if (has("--sheet")) {
        const texts = Object.fromEntries(Object.entries(brand.sources).map(([n, s]) => [n, readFileSync(s.file, "utf8")])), html = sheetHtml(brand, texts, await kitBundle(), opt("--on", "checker"));
        writeFileSync(join(OUT, "sheet.html"), html); const r = await shoot(html, join(OUT, "sheet.png"));
        if (!r.shot) { console.log(`\n  SHEET  ${relative(process.cwd(), join(OUT, "sheet.html"))} written; ${r.why}. The match is unmeasured until it renders.`); process.exit(1); }
        const bad = Object.entries(r.results).filter(([, v]) => v.share > 0.01);
        console.log(`\n  SHEET  ${relative(process.cwd(), join(OUT, "sheet.png"))}: ${Object.entries(r.results).map(([n, v]) => v.broken ? `${n} SOURCE DOES NOT RENDER` : `${n} ${(v.share * 100).toFixed(2)}%`).join(", ")}`);
        console.log(bad.length ? `BRAND: FAIL   ${bad.map(([n]) => n).join(", ")} draw(s) more than 1% differently from the source; open sheet.png, fix the import (a mask, filter or pattern the warnings name), never redraw by eye` : "BRAND: PASS   every element draws as its source. Show sheet.png to the person for sign-off before the first storyboard.");
        process.exit(bad.length ? 1 : 0);
      }
      console.log("\nNext: brand.mjs import ... --sheet, and show sheet.png for sign-off before the first storyboard.");
    } else if (cmd === "inventory") {
      let src, inv;
      if (opt("--figma")) { src = `figma ${opt("--figma")}`; inv = framesFromFigma(await figma(`files/${opt("--figma")}?depth=4`)); }
      else if (opt("--figma-json")) { src = basename(opt("--figma-json")); inv = framesFromFigma(JSON.parse(readFileSync(resolve(opt("--figma-json")), "utf8"))); }
      else if (opt("--dir")) { src = opt("--dir"); inv = { frames: framesFromFiles(readdirSync(resolve(opt("--dir")))), motion: [] }; }
      else die("inventory needs --figma <fileKey>, --figma-json <file.json> (the REST file JSON) or --dir <exports>");
      mkdirSync(OUT, { recursive: true });
      const mdFile = join(OUT, "INVENTORY.md"), prev = new Map(existsSync(mdFile) ? parseInventory(readFileSync(mdFile, "utf8")).map((r) => [r.id, r.mark]) : []);
      writeFileSync(mdFile, renderInventory(src, inv.frames, prev)); writeFileSync(join(OUT, "inventory.json"), JSON.stringify(inv.frames, null, 1));
      if (inv.motion.length) writeFileSync(join(OUT, "motion.json"), JSON.stringify(motionTokens(inv.motion), null, 1));
      console.log(`INVENTORY   ${inv.frames.length} frames from ${src} -> ${relative(process.cwd(), mdFile)}${inv.motion.length ? `; ${inv.motion.length} motion token(s) -> motion.json` : ""}\nMark each frame [x] once read, or [-] <reason>. brand.mjs check holds it.`);
    } else if (cmd === "find") {
      const mdFile = join(OUT, "INVENTORY.md"); if (!existsSync(mdFile)) die(`no ${relative(process.cwd(), mdFile)}: run brand.mjs inventory first; without it, "not in the file" is a guess`);
      const rows = parseInventory(readFileSync(mdFile, "utf8")), q = pos.join(" "), hits = findInInventory(rows, q);
      if (hits.length) { console.log(`FIND "${q}": ${hits.length} frame(s)`); for (const h of hits) console.log(`  ${h.page} / ${h.name}  (${h.id})${h.words ? `  "${h.words.slice(0, 90)}"` : ""}`); }
      else console.log(`FIND "${q}": not in the names or words of the ${rows.length} frames in ${relative(process.cwd(), mdFile)}. Say exactly that, and ask; the person may know a frame by another name.`);
    } else if (cmd === "check") {
      const mdFile = join(OUT, "INVENTORY.md"), r = checkInventory(existsSync(mdFile) ? parseInventory(readFileSync(mdFile, "utf8")) : []);
      if (r.why) { console.log(`BRAND CHECK: FAIL   ${r.why}`); process.exit(1); }
      for (const u of r.unread) console.log(`  UNREAD  ${u.page} / ${u.name} (${u.id})`);
      for (const u of r.bareSkips) console.log(`  SKIPPED WITH NO REASON  ${u.page} / ${u.name} (${u.id})`);
      console.log(r.status === "PASS" ? `BRAND CHECK: PASS   all ${r.total} frames read or skipped with a reason` : `BRAND CHECK: FAIL   ${r.unread.length + r.bareSkips.length} of ${r.total} frames not accounted for; open each, then mark it [x], or [-] <why it does not matter>`);
      process.exit(r.status === "PASS" ? 0 : 1);
    } else if (cmd === "logos") {
      const dir = pos[0] ? resolve(pos[0]) : die("logos needs a folder of logo files"), on = opt("--on", "dark"), out = resolve(opt("--out", join(OUT, "logos")));
      if (!["dark", "light"].includes(on)) die("--on is dark or light");
      const colour = on === "dark" ? "#ffffff" : "#111111", rgb = on === "dark" ? [255, 255, 255] : [17, 17, 17]; mkdirSync(out, { recursive: true });
      const logos = [];
      for (const f of readdirSync(dir).filter((x) => /\.(svg|png)$/i.test(x)).sort()) {
        const name = ident(f), p = join(dir, f);
        if (/\.svg$/i.test(f)) {
          const el = importSvg(readFileSync(p, "utf8")), m = logoMetrics(el), mono = toSvg(monochrome(el, colour), { tight: true });
          writeFileSync(join(out, `${name}.svg`), toSvg(el, { tight: true })); writeFileSync(join(out, `${name}-${on}.svg`), mono);
          logos.push({ name, file: f, kind: "svg", h: m.bbox[3], w: m.bbox[2], ink: m.ink, overlaps: m.overlaps, mime: "image/svg+xml", b64: Buffer.from(mono).toString("base64"), warnings: el.warnings });
        } else {
          const img = decodePng(readFileSync(p)), box = alphaBox(img);
          if (opaqueCorners(img)) { logos.push({ name, file: f, kind: "png", skipped: "has a solid background: ask for a transparent PNG or the SVG (a cut-out by eye is a redraw)" }); continue; }
          if (!box) { logos.push({ name, file: f, kind: "png", skipped: "is fully transparent" }); continue; }
          const trimmed = crop(img, box), mono = tint(trimmed, rgb), bytes = encodePng(mono);
          writeFileSync(join(out, `${name}.png`), encodePng(trimmed)); writeFileSync(join(out, `${name}-${on}.png`), bytes);
          logos.push({ name, file: f, kind: "png", w: box[2], h: box[3], ink: inkOf(trimmed), overlaps: 0, trimmed: `${img.w}x${img.h} -> ${box[2]}x${box[3]}`, mime: "image/png", b64: bytes.toString("base64") });
        }
      }
      const ok = equaliseLogos(logos.filter((l) => !l.skipped)), table = [...ok, ...logos.filter((l) => l.skipped)];
      writeFileSync(join(out, "logos.json"), JSON.stringify(table.map(({ b64, mime, ...l }) => l), null, 1));
      console.log(`LOGOS   ${dir} on ${on} -> ${relative(process.cwd(), out)}\n`);
      for (const l of table) console.log(l.skipped ? `  SKIP  ${l.file} ${l.skipped}` : `  ${l.name.padEnd(18)} ${l.kind} ${String(l.w).padStart(5)}x${String(l.h).padEnd(5)} ink density ${String(l.density).padEnd(6)} -> draw ${l.height} px tall${l.trimmed ? `  (trimmed ${l.trimmed})` : ""}${l.overlaps ? `  CHECK WITH OWNER: ${l.overlaps} outline(s) overlap; it may be their design, never fix it yourself` : ""}`);
      const html = logoStripHtml(ok, on === "dark" ? "#111111" : "#f4f2ec"); writeFileSync(join(out, "strip.html"), html);
      const r = await shoot(html, join(out, "strip.png")); console.log(r.shot ? `\n  strip: ${relative(process.cwd(), join(out, "strip.png"))} (show it before use)` : `\n  strip: ${relative(process.cwd(), join(out, "strip.html"))}; ${r.why}`);
    } else if (cmd === "logo") {
      const film = pos[0] ? resolve(pos[0]) : die("logo needs the film's logo (svg or png)"), ref = opt("--ref") ? resolve(opt("--ref")) : die("logo needs --ref <a screenshot of the logo where it is used in production>");
      const uri = (f) => `data:${/\.svg$/i.test(f) ? "image/svg+xml" : "image/png"};base64,${readFileSync(f).toString("base64")}`, out = resolve(opt("--out", join(OUT, "logo-check.png")));
      const html = `<!doctype html><html><body style="margin:0;padding:32px;background:#f4f2ec;font:14px Poppins,Arial,sans-serif"><div style="display:flex;gap:48px;align-items:flex-end">
<figure style="margin:0"><img style="height:160px" src="${uri(ref)}"><figcaption>production: ${basename(ref)}</figcaption></figure>
<figure style="margin:0;background:#111;padding:16px"><img style="height:128px" src="${uri(film)}"><figcaption style="color:#eee">film: ${basename(film)}</figcaption></figure></div>
<script>Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))).then(()=>{document.body.dataset.done='1'})</script></body></html>`;
      writeFileSync(out.replace(/\.png$/, ".html"), html); const r = await shoot(html, out, 1200);
      console.log(r.shot ? `LOGO   ${relative(process.cwd(), out)}: production left, film right. Compare order, colour and spacing of every part, and show it to the person before the logo is used.` : `LOGO   ${out.replace(/\.png$/, ".html")}; ${r.why}`);
    } else {
      console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").filter((l) => l.startsWith("//")).slice(0, 26).map((l) => l.slice(3)).join("\n")); process.exit(cmd ? 2 : 0);
    }
  } catch (e) { die(e.message); }
}
