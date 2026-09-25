// Find a render backend WITHOUT installing anything. Reports exactly what it found and why it
// chose it. A backend is usable only if its library AND a browser binary AND ffmpeg all exist.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const tryRequire = (id, from) => { try { return createRequire(from)(id); } catch { return null; } };
const globalRoot = () => { try { return execFileSync("npm", ["root", "-g"], { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { return null; } };

export const findFfmpeg = () => { const bin = process.env.FFMPEG || "ffmpeg"; try { const v = execFileSync(bin, ["-version"], { stdio: ["ignore", "pipe", "ignore"] }).toString().split("\n")[0]; return { ok: true, bin, why: v }; } catch { return { ok: false, why: "ffmpeg not on PATH (set FFMPEG=/path/to/ffmpeg)" }; } };

export const findPlaywright = () => {
  const here = join(process.cwd(), "package.json"), g = globalRoot(), tried = [];
  const candidates = [["playwright", here], ["playwright-core", here], ...(g ? [["playwright", join(g, "x.js")], ["playwright-core", join(g, "x.js")], ["playwright-core", join(g, "@playwright/mcp/package.json")], ["playwright-core", join(g, "agent-browser/package.json")]] : [])];
  for (const [id, from] of candidates) { const lib = tryRequire(id, from); tried.push(`${id} from ${from}`); if (lib?.chromium) { const version = tryRequire(`${id}/package.json`, from)?.version; return { ok: true, lib, id, from, version }; } }
  return { ok: false, why: `no playwright found (looked in: ${tried.join("; ")})` };
};
// Prefer the browser playwright expects; otherwise the newest cached headless shell or chromium.
export const findBrowser = (lib) => {
  try { const p = lib.chromium.executablePath(); if (p && existsSync(p)) return { ok: true, executablePath: undefined, why: `playwright default: ${p}` }; } catch { /* fall through */ }
  const cache = process.env.PLAYWRIGHT_BROWSERS_PATH || join(homedir(), process.platform === "darwin" ? "Library/Caches/ms-playwright" : ".cache/ms-playwright");
  if (!existsSync(cache)) {
    const local = remotionShell();
    return local ? { ok: true, executablePath: local, why: `remotion's own chrome-headless-shell in node_modules (no playwright cache at ${cache})` } : { ok: false, why: `no browser cache at ${cache}, and none in node_modules/.remotion` };
  }
  const dirs = readdirSync(cache).filter((d) => /^chromium(_headless_shell)?-\d+$/.test(d)).sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]) || (a.includes("headless") ? -1 : 1));
  for (const d of dirs) { const stack = [join(cache, d)]; while (stack.length) { const dir = stack.pop(); for (const e of readdirSync(dir, { withFileTypes: true })) { const f = join(dir, e.name); if (e.isDirectory() && !e.name.endsWith(".app") ? true : false) stack.push(f); else if (e.isDirectory()) stack.push(f); else if (/^(chrome-headless-shell|chrome|Chromium)$/.test(e.name)) return { ok: true, executablePath: f, why: `cached ${d} (playwright's own revision is not installed)` }; } } }
  const local = remotionShell();
  if (local) return { ok: true, executablePath: local, why: `remotion's own chrome-headless-shell in node_modules (no playwright cache at ${cache})` };
  return { ok: false, why: `no chromium build in ${cache}, and none in node_modules/.remotion` };
};
// Remotion keeps a chrome-headless-shell INSIDE the project. It is a real Chromium and it is
// already on disk, so when the playwright cache is missing there is no reason to download a
// second one. Worth knowing: it is a different build from playwright's, so pixels hashed against
// it are comparable within a run but not necessarily to hashes taken on another machine's shell.
const remotionShell = () => {
  const root = join(process.cwd(), "node_modules/.remotion/chrome-headless-shell");
  if (!existsSync(root)) return null;
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const f = join(dir, e.name);
      if (e.isDirectory()) stack.push(f);
      else if (e.name === "chrome-headless-shell") return f;
    }
  }
  return null;
};
export const findRemotion = () => { const v = tryRequire("remotion/package.json", join(process.cwd(), "package.json"))?.version; return v ? { ok: true, version: v } : { ok: false, why: "remotion is not a dependency of this project" }; };

export const detect = () => {
  const ffmpeg = findFfmpeg(), pw = findPlaywright(), browser = pw.ok ? findBrowser(pw.lib) : { ok: false, why: "needs playwright" }, remotion = findRemotion();
  const report = { ffmpeg: ffmpeg.ok ? ffmpeg.why : `MISSING: ${ffmpeg.why}`, playwright: pw.ok ? `${pw.id}@${pw.version} (${pw.from})` : `MISSING: ${pw.why}`, browser: browser.ok ? browser.why : `MISSING: ${browser.why}`, remotion: remotion.ok ? `remotion@${remotion.version} (adapter lands in Phase 3)` : remotion.why, hyperframes: "not probed (Phase 5, by decision)" };
  const chosen = pw.ok && browser.ok && ffmpeg.ok ? "playwright" : null;
  return { chosen, report, ffmpeg, pw, browser };
};
