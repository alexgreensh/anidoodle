// Build ONE self-contained HTML file: the art core + film, bundled, with every asset in the
// manifest inlined as a data URI. No network, no server, no sibling files.
import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { extname, join } from "node:path";

const MIME = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".woff2": "font/woff2" };
export const buildPage = async ({ entry, out, title, plugins = [] }) => {
  const js = (await build({ entryPoints: [entry], bundle: true, format: "iife", target: "es2020", minify: true, write: false, legalComments: "none", plugins })).outputFiles[0].text;
  // read the manifest out of the film module itself, so the page and the film can never disagree
  const probe = (await build({ stdin: { contents: `export { ${title} as film } from "./src/canvas-core/${title}";`, resolveDir: process.cwd(), loader: "ts" }, bundle: true, format: "esm", write: false, platform: "neutral", plugins })).outputFiles[0].text;
  const { film } = await import("data:text/javascript;base64," + Buffer.from(probe).toString("base64"));
  const assets = Object.fromEntries(Object.entries(film.assets.images).map(([name, file]) => { const mime = MIME[extname(file).toLowerCase()]; if (!mime) throw new Error(`asset '${name}': unsupported type ${file}`); return [name, `data:${mime};base64,${readFileSync(join(process.cwd(), file)).toString("base64")}`]; }));
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${film.meta.title}</title>
<style>html,body{margin:0;height:100%;background:#1b1a1a;display:grid;place-items:center}canvas{max-width:100vw;max-height:100vh;aspect-ratio:${film.meta.W}/${film.meta.H};cursor:pointer;background:#fff}</style></head>
<body><canvas id="film"></canvas><script>window.__ASSETS__=${JSON.stringify(assets)};</script><script>${js.replace(/<\/script/g, "<\\/script")}</script></body></html>`;
  mkdirSync(join(out, ".."), { recursive: true }); writeFileSync(out, html);
  return { out, bytes: html.length, meta: film.meta };
};
if (import.meta.url === `file://${process.argv[1]}`) { const title = process.argv[2] ?? "fixtures"; const r = await buildPage({ entry: `src/hosts/page-${title}.ts`, out: `dist/${title}.html`, title }); console.log(`built ${r.out} (${(r.bytes / 1024).toFixed(0)} KB, self-contained)`); }
