// HTML-PLAYER ADAPTER. The film's deliverable here is not a video, it is the PAGE: one
// self-contained HTML file that plays the whole thing in any browser with no server, no network
// and no sibling files. That is the artifact this adapter produces and the one it is judged on.
//
// It still renders frames, because the gate has to be able to draw the same frame twice and
// compare. It does that by opening N INDEPENDENT instances of the page, which is a stronger test
// than it sounds: each instance has its own texture tiles, its own layer pool and its own cache,
// so two instances agreeing means the caches are genuinely keyed on what the pixels depend on and
// not on the order somebody happened to ask for frames in.
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildPage } from "../build-page.mjs";
import { detect } from "../detect.mjs";

export const name = "html-player";
export const describe = () => "a single self-contained HTML file that plays the film in any browser, offline";

export const probe = () => {
  const env = detect();
  if (!env.pw.ok) return { ok: false, why: `needs playwright to drive the page: ${env.pw.why}` };
  if (!env.browser.ok) return { ok: false, why: `needs a chromium build: ${env.browser.why}` };
  return { ok: true, why: `${env.pw.id}@${env.pw.version}, ${env.browser.why}`, env };
};

// what makes a self-contained page worth shipping: nothing in it may reach outside itself
export const pageChecks = (html) => {
  const has = (re) => { const m = html.match(re); return m ? m.length : 0; };
  const assets = html.match(/window\.__ASSETS__=([^;]*);/);
  return [
    { ok: has(/https?:\/\//g) === 0, label: "no http(s) reference of any kind", detail: `${has(/https?:\/\//g)} found` },
    { ok: has(/<(img|audio|video|source|link|iframe)\b/gi) === 0, label: "no external element (img, audio, video, link)", detail: `${has(/<(img|audio|video|source|link|iframe)\b/gi)} found` },
    { ok: has(/@font-face/gi) === 0, label: "no web font", detail: `${has(/@font-face/gi)} found` },
    { ok: has(/data:[a-z]+\/[a-z0-9.+-]+;base64/gi) === 0, label: "no embedded binary asset", detail: `${has(/data:[a-z]+\/[a-z0-9.+-]+;base64/gi)} found` },
    { ok: has(/fetch\(|XMLHttpRequest|importScripts/g) === 0, label: "no network call in the bundle", detail: `${has(/fetch\(|XMLHttpRequest|importScripts/g)} found` },
    { ok: assets ? assets[1].trim() === "{}" : false, label: "the asset manifest is empty", detail: assets ? assets[1].trim() : "manifest absent" },
    { ok: /window\.FILM\s*=/.test(html), label: "exposes window.FILM so any host can drive it", detail: "" },
    { ok: /audio\s*[:(]/.test(html), label: "any score is synthesized in the page, never loaded", detail: "" },
  ];
};

export const open = async (film, opts = {}) => {
  const { scale = 1, workers = 1 } = opts;
  const p = probe();
  if (!p.ok) throw new Error(`html-player: ${p.why}`);
  const out = resolve(`dist/${film}.html`);
  const built = await buildPage({ entry: `src/hosts/page-${film}.ts`, out, title: film });
  const html = readFileSync(out, "utf8");

  const browser = await p.env.pw.lib.chromium.launch({ executablePath: p.env.browser.executablePath, args: ["--disable-background-timer-throttling"] });
  const context = await browser.newContext({ viewport: { width: 640, height: 640 }, deviceScaleFactor: 1 });
  const pages = [];
  for (let i = 0; i < workers; i++) {
    const page = await context.newPage(), errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => { if (!r.url().startsWith("file:") && !r.url().startsWith("data:")) errors.push(`page reached the network: ${r.url()}`); }); /* the page is supposed to be offline: prove it at run time, not just by reading it */
    await page.goto(pathToFileURL(out).href + "?adapter=html-player");
    await page.evaluate(async (s) => { await window.FILM.ready; window.FILM.mount(s); window.FILM.warm(); }, scale);
    if (errors.length) throw new Error("page failed: " + errors.join("; "));
    pages.push(page);
  }
  const pick = (w) => pages[((w % pages.length) + pages.length) % pages.length];
  return {
    workers: pages.length,
    info: () => pages[0].evaluate(() => window.FILM.meta),
    frame: async (n, w = 0) => { const r = await pick(w).evaluate((f) => { const s = window.FILM.seek(f); return { ...s, png: window.FILM.png() }; }, n); return { png: Buffer.from(r.png, "base64"), shot: r.shot, drawMs: r.ms }; },
    hash: (n, w = 0) => pick(w).evaluate((f) => { window.FILM.seek(f); return window.FILM.hash(); }, n),
    audio: (sr) => pages[0].evaluate((s) => window.FILM.audio(s), sr),
    artifact: () => ({ path: out, kind: "self-contained HTML player", bytes: statSync(out).size, meta: built.meta, checks: pageChecks(html) }),
    close: () => browser.close(),
  };
};
