// detect.mjs finds the browser playwright would launch. On Windows its cache lives in
// %LOCALAPPDATA%\ms-playwright and the binaries end in .exe; before this fix the scan only knew
// macOS and Linux paths and POSIX binary names, so a Windows user with a working Chromium from
// another tool was told to download a second one (issue #18).
const fsm = "node:fs", osm = "node:os", pm = "node:path";
const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import(fsm);
const { tmpdir } = await import(osm);
const { join } = await import(pm);
const proc = (globalThis as any).process;
// The suite bundles with esbuild platform "neutral", so node: specifiers and relative imports of
// tools that use them cannot be static; import the tool by absolute file URL at runtime instead.
const urlm = "node:url";
const { pathToFileURL } = await import(urlm);
const { findBrowser } = await import(pathToFileURL(join(proc.cwd(), "tools", "detect.mjs")).href);

export const name = "detect.mjs finds the browser cache on Windows, macOS and Linux";
export function run(ok: (cond: boolean, label: string) => void) {
  const realPlatform = Object.getOwnPropertyDescriptor(proc, "platform")!;
  const saved = { HOME: proc.env.HOME, LOCALAPPDATA: proc.env.LOCALAPPDATA, PLAYWRIGHT_BROWSERS_PATH: proc.env.PLAYWRIGHT_BROWSERS_PATH };
  const root = mkdtempSync(join(tmpdir(), "anidoodle-detect-"));
  // A playwright cache the way Windows lays it out: chrome-win\chrome.exe and
  // chrome-headless-shell-win64\chrome-headless-shell.exe under each build dir.
  const winCache = join(root, "win-lad", "ms-playwright");
  mkdirSync(join(winCache, "chromium-1187", "chrome-win"), { recursive: true });
  writeFileSync(join(winCache, "chromium-1187", "chrome-win", "chrome.exe"), "x");
  mkdirSync(join(winCache, "chromium_headless_shell-1187", "chrome-headless-shell-win64"), { recursive: true });
  writeFileSync(join(winCache, "chromium_headless_shell-1187", "chrome-headless-shell-win64", "chrome-headless-shell.exe"), "x");
  // A macOS cache: Chromium.app with the Chromium binary inside.
  const macHome = join(root, "mac-home");
  mkdirSync(join(macHome, "Library/Caches/ms-playwright/chromium-1187/chrome-mac/Chromium.app/Contents/MacOS"), { recursive: true });
  writeFileSync(join(macHome, "Library/Caches/ms-playwright/chromium-1187/chrome-mac/Chromium.app/Contents/MacOS/Chromium"), "x");
  // A Linux cache: plain chrome.
  const linuxHome = join(root, "linux-home");
  mkdirSync(join(linuxHome, ".cache/ms-playwright/chromium-1187/chrome-linux"), { recursive: true });
  writeFileSync(join(linuxHome, ".cache/ms-playwright/chromium-1187/chrome-linux/chrome"), "x");
  // A custom cache handed over through PLAYWRIGHT_BROWSERS_PATH.
  const customCache = join(root, "custom-cache");
  mkdirSync(join(customCache, "chromium-1188", "chrome-win"), { recursive: true });
  writeFileSync(join(customCache, "chromium-1188", "chrome-win", "chrome.exe"), "x");

  const noPw = { chromium: { executablePath() { throw new Error("playwright's own browser is not installed"); } } };
  const as = (platform: string, env: Record<string, string | undefined>) => {
    Object.defineProperty(proc, "platform", { value: platform });
    for (const [k, v] of Object.entries(env)) v === undefined ? delete proc.env[k] : (proc.env[k] = v);
  };

  try {
    as("win32", { LOCALAPPDATA: join(root, "win-lad"), PLAYWRIGHT_BROWSERS_PATH: undefined });
    const win = findBrowser(noPw);
    ok(win.ok && typeof win.executablePath === "string" && win.executablePath.endsWith(join("chrome-headless-shell-win64", "chrome-headless-shell.exe")), `RED: on Windows the default cache is %LOCALAPPDATA%\\ms-playwright and the headless shell wins (got ${JSON.stringify(win)})`);

    as("win32", { LOCALAPPDATA: join(root, "win-lad"), PLAYWRIGHT_BROWSERS_PATH: customCache });
    const custom = findBrowser(noPw);
    ok(custom.ok && typeof custom.executablePath === "string" && custom.executablePath.endsWith(join("chrome-win", "chrome.exe")), `RED: PLAYWRIGHT_BROWSERS_PATH still overrides, and .exe binaries count (got ${JSON.stringify(custom)})`);

    as("win32", { LOCALAPPDATA: join(root, "empty-lad"), PLAYWRIGHT_BROWSERS_PATH: undefined });
    const missing = findBrowser(noPw);
    ok(!missing.ok && missing.why.includes(join(root, "empty-lad", "ms-playwright")), `RED: a Windows miss names the real Windows cache path (got ${JSON.stringify(missing)})`);

    // The macOS/Linux guards steer homedir() through $HOME, which Windows ignores, so they only
    // prove anything where $HOME works; on a real Windows run they are skipped, not failed.
    if (realPlatform.value !== "win32") {
      as("darwin", { HOME: macHome, PLAYWRIGHT_BROWSERS_PATH: undefined, LOCALAPPDATA: undefined });
      const mac = findBrowser(noPw);
      ok(mac.ok && typeof mac.executablePath === "string" && mac.executablePath.endsWith(join("MacOS", "Chromium")), `macOS still finds ~/Library/Caches/ms-playwright and the Chromium binary (got ${JSON.stringify(mac)})`);

      as("linux", { HOME: linuxHome, PLAYWRIGHT_BROWSERS_PATH: undefined, LOCALAPPDATA: undefined });
      const linux = findBrowser(noPw);
      ok(linux.ok && typeof linux.executablePath === "string" && linux.executablePath.endsWith(join("chrome-linux", "chrome")), `Linux still finds ~/.cache/ms-playwright (got ${JSON.stringify(linux)})`);
    }
  } finally {
    Object.defineProperty(proc, "platform", realPlatform);
    for (const [k, v] of Object.entries(saved)) v === undefined ? delete proc.env[k] : (proc.env[k] = v);
    rmSync(root, { recursive: true, force: true });
  }
}
