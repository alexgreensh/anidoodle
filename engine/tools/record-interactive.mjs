// RECORD, INTERACTIVE. A screen recording of a person using an interactive page, made frame-exact.
//
//   node tools/record-interactive.mjs <page.html> <choreography.mjs> --out out/demo.mp4 [--fps 30] [--size 1280x800]
//
// The page's clock is replaced (window.__ANI_CLOCK__) by one this tool advances by exactly one video
// frame at a time, so the recording is the piece at 30 fps no matter how slow the screenshots are:
// what you see at 0:04.20 is tick 252, exactly. Input is real Playwright input (real pointer, key
// and wheel events, through the page's own listeners); a drawn cursor stands in for the system one,
// which screenshots never show.
//
// A choreography is `export default async (r) => { ... }` using:
//   r.glide(target, frames)   move the pointer to a selector's centre or {x, y}, eased, over n frames
//   r.hold(frames)            let time pass
//   r.click(frames = 6)       press, hold ~3 frames, release, then wait
//   r.type(text, perChar = 3) type into whatever has focus
//   r.key(name)               press one key (Tab, Enter...)
//   r.scroll(y, frames)       scroll the window to y, eased
//   r.eval(fn, arg)           run something in the page
//   r.box(selector)           its bounding box
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { detect } from "./detect.mjs";

const pos = [], opt = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith("--")) opt[a.slice(2)] = process.argv[++i]; else pos.push(a); }
const die = (m) => { console.error(`record-interactive: ${m}`); process.exit(1); };
const [pagePath, choreo] = pos; if (!pagePath || !choreo) die("usage: node tools/record-interactive.mjs <page.html> <choreography.mjs> --out out/x.mp4");
const out = resolve(opt.out ?? "out/interactive.mp4"), FPS = +(opt.fps ?? 30), [VW, VH] = (opt.size ?? "1280x800").split("x").map(Number), DPR = +(opt.dpr ?? 1.5);
const d = detect(); if (!d.pw.ok || !d.browser.ok || !d.ffmpeg.ok) die(JSON.stringify(d.report));

const browser = await d.pw.lib.chromium.launch({ executablePath: d.browser.executablePath });
const page = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: DPR });
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
await page.addInitScript(() => {
  window.__vt = 0; window.__ANI_CLOCK__ = () => window.__vt;
  addEventListener("DOMContentLoaded", () => {
    const c = document.createElement("div"); c.id = "__cursor";
    c.style.cssText = "position:fixed;left:0;top:0;width:22px;height:30px;z-index:2147483647;pointer-events:none;transform:translate(-100px,-100px);transition:none";
    c.innerHTML = '<svg width="22" height="30" viewBox="0 0 22 30"><path d="M2 2 L2 24 L8 18.5 L12.5 28 L16 26.5 L11.6 17.2 L19.5 17.2 Z" fill="#1f1a1b" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>';
    const ring = document.createElement("div"); ring.style.cssText = "position:fixed;left:0;top:0;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:3px solid rgba(201,86,107,.8);z-index:2147483646;pointer-events:none;opacity:0";
    document.body.append(ring, c);
    addEventListener("pointermove", (e) => { c.style.transform = `translate(${e.clientX - 2}px,${e.clientY - 2}px)`; ring.style.left = e.clientX + "px"; ring.style.top = e.clientY + "px"; }, true);
    addEventListener("pointerdown", () => { ring.style.opacity = "1"; ring.style.transform = "scale(.7)"; }, true);
    addEventListener("pointerup", () => { ring.style.opacity = "0"; ring.style.transform = "scale(1)"; }, true);
  });
});
await page.goto(pathToFileURL(resolve(pagePath)).href);
await page.evaluate(async () => { while (!window.__anidoodle?.length) await new Promise((r) => setTimeout(r, 10)); await Promise.all(window.__anidoodle.map((c) => c.ready)); });
await page.waitForTimeout(500); // let the canvas fade-in transition finish (CSS runs on real time)

mkdirSync(dirname(out), { recursive: true });
const ff = spawn(d.ffmpeg.bin, ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-", "-vf", `scale=${VW}:${VH}:flags=lanczos,format=yuv420p`, "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-movflags", "+faststart", out], { stdio: ["pipe", "inherit", "inherit"] });
let frames = 0, mouse = { x: VW / 2, y: VH + 40 };
const frame = async () => {
  await page.evaluate((ms) => { window.__vt += ms; window.__anidoodle.forEach((c) => c.renderNow()); }, 1000 / FPS);
  const jpg = await page.screenshot({ type: "jpeg", quality: 92 }); if (!ff.stdin.write(jpg)) await new Promise((r) => ff.stdin.once("drain", r)); frames++;
};
const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);
const where = async (t) => { if (typeof t !== "string") return t; const h = await page.$(t); if (!h) die(`no element ${t}`); const b = await h.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
const r = {
  hold: async (n) => { for (let i = 0; i < n; i++) await frame(); },
  glide: async (t, n = 24) => { const to = await where(t), from = { ...mouse }; for (let i = 1; i <= n; i++) { const u = ease(i / n); mouse = { x: from.x + (to.x - from.x) * u, y: from.y + (to.y - from.y) * u + Math.sin(u * Math.PI) * -18 }; await page.mouse.move(mouse.x, mouse.y); await frame(); } },
  click: async (n = 6) => { await page.mouse.down(); await frame(); await frame(); await frame(); await page.mouse.up(); await r.hold(n); },
  type: async (text, per = 3) => { for (const ch of text) { await page.keyboard.type(ch); await r.hold(per); } },
  key: async (k) => { await page.keyboard.press(k); await frame(); },
  scroll: async (y, n = 30) => { const y0 = await page.evaluate(() => scrollY); for (let i = 1; i <= n; i++) { await page.evaluate((v) => scrollTo(0, v), y0 + (y - y0) * ease(i / n)); await frame(); } },
  eval: (fn, arg) => page.evaluate(fn, arg), box: async (s) => (await page.$(s)).boundingBox(), page,
};
await page.mouse.move(mouse.x, mouse.y);
await (await import(pathToFileURL(resolve(choreo)).href)).default(r);
ff.stdin.end(); await new Promise((res) => ff.on("close", res));
await browser.close();
console.log(`RECORD ${out}  ${frames} frames = ${(frames / FPS).toFixed(1)} s @ ${FPS} fps, ${VW}x${VH}${errors.length ? "   PAGE ERRORS: " + errors.join("; ") : ""}`);
