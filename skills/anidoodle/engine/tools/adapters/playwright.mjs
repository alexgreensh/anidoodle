// PLAYWRIGHT ADAPTER. Thin by design: open the generated page, ask it for frame N, take the
// canvas pixels. Frame accuracy comes from the pull model (frame N is a pure function of N),
// not from anything Playwright does.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { bakeCacheOn, loadBakes, saveBakes } from "../bake-cache.mjs";

export const name = "playwright";
// WEBGL. Only a page whose bundle carries three-core's marker gets a GL backend, so 2D films keep
// exactly the browser they always had. Default: SwiftShader, a CPU renderer that draws the same
// pixels on any machine (slow, ~1-3 s a 1080p frame). ANIDOODLE_GL=gpu uses the machine's GPU
// (Metal on a Mac, about 10x faster), but its hashes only hold on that machine and driver.
export const glArgs = (pagePath) => {
  let three = false; try { three = readFileSync(pagePath, "utf8").includes("__ANIDOODLE_WEBGL__"); } catch { /* not a file: no GL */ }
  if (!three) return [];
  const gpu = process.env.ANIDOODLE_GL === "gpu";
  return gpu ? ["--use-angle=" + (process.platform === "darwin" ? "metal" : "default"), "--ignore-gpu-blocklist", "--enable-gpu-rasterization"]
    : ["--use-angle=swiftshader", "--use-gl=angle", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
};
// bakeCache (default on): finished plate frames come from and go to .cache/bakes (see bake-cache.mjs)
export const open = async ({ pw, browser: found }, pagePath, { scale = 1, workers = 1, bakeCache } = {}) => {
  const browser = await pw.lib.chromium.launch({ executablePath: found.executablePath, args: ["--disable-background-timer-throttling", ...glArgs(pagePath)] });
  // the bake folder is keyed by the browser BINARY, not just its version: Chrome for Testing and
  // chrome-headless-shell report the same version and rasterise differently, so one must never
  // replay the other's plate frames
  const useBakes = bakeCacheOn(bakeCache), bv = `${browser.version()}-${createHash("md5").update(found.executablePath ?? "playwright-default").digest("hex").slice(0, 8)}`; let loadedBakes = 0;
  const context = await browser.newContext({ viewport: { width: 640, height: 640 }, deviceScaleFactor: 1 });
  const pages = [];
  for (let i = 0; i < workers; i++) { const page = await context.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(e.message)); await page.goto(pathToFileURL(pagePath).href + "?adapter=playwright"); await page.evaluate(async (s) => { await window.FILM.ready; window.FILM.mount(s); }, scale); if (useBakes) loadedBakes = await loadBakes(page, bv); await page.evaluate(() => window.FILM.warm()); /* warm = build texture tiles once, outside the timed frames */ if (errors.length) throw new Error("page failed: " + errors.join("; ")); pages.push(page); }
  const pick = (n) => pages[n % pages.length];
  return {
    workers: pages.length,
    bakes: () => ({ on: useBakes, loaded: loadedBakes }),
    info: () => pages[0].evaluate(() => window.FILM.meta),
    // -> { png: Buffer, shot, drawMs, captureMs }
    frame: async (n, w = n) => { const t0 = Date.now(); const r = await pick(w).evaluate((f) => { const s = window.FILM.seek(f); const t = performance.now(); const png = window.FILM.png(); return { ...s, png, enc: performance.now() - t }; }, n); return { png: Buffer.from(r.png, "base64"), shot: r.shot, drawMs: r.ms, encodeMs: r.enc, roundTripMs: Date.now() - t0 }; },
    hash: (n, w = 0) => pick(w).evaluate((f) => { window.FILM.seek(f); return window.FILM.hash(); }, n),
    // motion-blurred frame: `samples` subframes averaged in the page (see hosts/page.ts blur)
    // `samples` is a count (a 360-degree shutter, as before) or a spec { samples: N | 0 (auto), shutter, max, px }
    blur: async (n, samples, w = n) => { const t0 = Date.now(); const r = await pick(w).evaluate(([f, s]) => { const r = window.FILM.blur(f, s); const t = performance.now(); const png = window.FILM.png(); return { ...r, png, enc: performance.now() - t }; }, [n, samples]); return { png: Buffer.from(r.png, "base64"), shot: r.shot, drawMs: r.ms, encodeMs: r.enc, roundTripMs: Date.now() - t0, samples: r.samples, speed: r.speed, sharpPx: r.sharpPx ?? 0, typeInLayers: r.typeInLayers ?? 0 }; },
    // a frame of the poster dissolve (see hosts/page.ts poster): frame n with poster frame p over it
    poster: async (n, p, fade, samples = 1, w = n) => { const t0 = Date.now(); const r = await pick(w).evaluate(([f, pf, fd, s]) => { const r = window.FILM.poster(f, pf, fd, s); const t = performance.now(); const png = window.FILM.png(); return { ...r, png, enc: performance.now() - t }; }, [n, p, fade, samples]); return { png: Buffer.from(r.png, "base64"), shot: r.shot, drawMs: r.ms, encodeMs: r.enc, roundTripMs: Date.now() - t0 }; },
    posterHash: (n, p, fade, samples = 1, w = 0) => pick(w).evaluate(([f, pf, fd, s]) => { window.FILM.poster(f, pf, fd, s); return window.FILM.hash(); }, [n, p, fade, samples]),
    // hash of the motion-blurred frame: what a --blur render actually writes, so the probe checks THAT
    blurHash: (n, samples, w = 0) => pick(w).evaluate(([f, s]) => { window.FILM.blur(f, s); return window.FILM.hash(); }, [n, samples]),
    audio: (sr) => pages[0].evaluate((s) => window.FILM.audio(s), sr),
    // the frame probe (hosts/page.ts): text and content boxes the frame's edge cuts through
    probe: (frames, all = false) => pages[0].evaluate(([fs, a]) => window.FILM.probe(fs, a), [frames, all]),
    // the layer probe (hosts/instrument.ts, tools/layerscan.mjs): text, photos and boxes per frame in draw order, translucent brand fills
    layers: (frames, brand = []) => pages[0].evaluate(([fs, b]) => window.FILM.layers(fs, b), [frames, brand]),
    // visible ink of the text inside each box on one frame (device px)
    ink: (frame, boxes) => pages[0].evaluate(([f, bs]) => window.FILM.ink(f, bs), [frame, boxes]),
    // keeps the fresh bakes, then closes; returns how many plate frames were stored
    close: async () => { let saved = 0; if (useBakes) for (const p of pages) saved += await saveBakes(p, bv).catch(() => 0); await browser.close(); return saved; },
  };
};
