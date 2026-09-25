// PLAYWRIGHT ADAPTER. Thin by design: open the generated page, ask it for frame N, take the
// canvas pixels. Frame accuracy comes from the pull model (frame N is a pure function of N),
// not from anything Playwright does.
import { pathToFileURL } from "node:url";

export const name = "playwright";
export const open = async ({ pw, browser: found }, pagePath, { scale = 1, workers = 1 } = {}) => {
  const browser = await pw.lib.chromium.launch({ executablePath: found.executablePath, args: ["--disable-background-timer-throttling"] });
  const context = await browser.newContext({ viewport: { width: 640, height: 640 }, deviceScaleFactor: 1 });
  const pages = [];
  for (let i = 0; i < workers; i++) { const page = await context.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(e.message)); await page.goto(pathToFileURL(pagePath).href + "?adapter=playwright"); await page.evaluate(async (s) => { await window.FILM.ready; window.FILM.mount(s); window.FILM.warm(); }, scale); /* warm = build texture tiles once, outside the timed frames */ if (errors.length) throw new Error("page failed: " + errors.join("; ")); pages.push(page); }
  const pick = (n) => pages[n % pages.length];
  return {
    workers: pages.length,
    info: () => pages[0].evaluate(() => window.FILM.meta),
    // -> { png: Buffer, shot, drawMs, captureMs }
    frame: async (n, w = n) => { const t0 = Date.now(); const r = await pick(w).evaluate((f) => { const s = window.FILM.seek(f); const t = performance.now(); const png = window.FILM.png(); return { ...s, png, enc: performance.now() - t }; }, n); return { png: Buffer.from(r.png, "base64"), shot: r.shot, drawMs: r.ms, encodeMs: r.enc, roundTripMs: Date.now() - t0 }; },
    hash: (n, w = 0) => pick(w).evaluate((f) => { window.FILM.seek(f); return window.FILM.hash(); }, n),
    audio: (sr) => pages[0].evaluate((s) => window.FILM.audio(s), sr),
    close: () => browser.close(),
  };
};
