// REMOTION ADAPTER. Drives the same pure art core through a Remotion <Composition>: a canvas in
// a React component, `renderFrame(film, ctx, frame, env)` keyed to useCurrentFrame(), and the
// score read straight off `film.audio(sampleRate)`. Remotion supplies the frame number and takes
// the screenshot; it is told nothing else, and the art core never learns it is there.
//
// WHAT THIS ADAPTER PROVES, AND WHAT IT DOES NOT. Each still is rendered in its own page, so
// every frame here is drawn COLD. That is a real and complementary check: it proves frame N owes
// nothing to the frames rendered before it. It is also why this adapter cannot catch a stale
// cache the way html-player can, and the gate's determinism section is weaker when pointed at
// it. Run BOTH; neither is the whole bar. (`references/backends-and-adapters.md` has the worked
// case: an order-dependence only a warm, shared-cache adapter can surface.)
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

const require = createRequire(import.meta.url);
const tryRequire = (id) => { try { return require(id); } catch { return null; } };
const version = (id) => tryRequire(`${id}/package.json`)?.version ?? null;

export const name = "remotion";
export const describe = () => "the same art core rendered through a Remotion <Composition>, one still per frame";

export const probe = () => {
  const need = ["remotion", "@remotion/bundler", "@remotion/renderer"];
  const missing = need.filter((id) => !version(id));
  if (missing.length) return { ok: false, why: `not installed: ${missing.join(", ")} (npm i ${missing.join(" ")})` };
  const vs = need.map((id) => `${id}@${version(id)}`);
  const spread = new Set(need.map((id) => version(id)));
  if (spread.size > 1) return { ok: false, why: `remotion packages disagree on version (${vs.join(", ")}); they must match` };
  return { ok: true, why: vs.join(", ") };
};

// The film module is the source of truth for meta and for the score. It is read the way
// build-page.mjs reads it: bundled on its own, with no host attached, so nothing can disagree.
const loadFilm = async (film) => {
  const { build } = await import("esbuild");
  const out = (await build({ stdin: { contents: `export { ${film} as film } from "./src/canvas-core/${film}";`, resolveDir: process.cwd(), loader: "ts" }, bundle: true, format: "esm", write: false, platform: "neutral" })).outputFiles[0].text;
  return (await import("data:text/javascript;base64," + Buffer.from(out).toString("base64"))).film;
};

const pcm16 = (film, sr) => {
  if (!film.audio) return null;
  const [L, R] = film.audio(sr), pcm = new Int16Array(L.length * 2);
  for (let i = 0; i < L.length; i++) { pcm[i * 2] = Math.max(-1, Math.min(1, L[i])) * 32767; pcm[i * 2 + 1] = Math.max(-1, Math.min(1, R[i])) * 32767; }
  return { sampleRate: sr, frames: L.length, pcm16: Buffer.from(pcm.buffer).toString("base64") };
};

// Bundling is per FILM, not per session: the gate opens an adapter many times in one process and
// webpack has no business running again for a bundle that cannot have changed.
const bundles = new Map();
const bundleFor = async (film, bundle) => {
  if (!bundles.has(film)) {
    const dir = resolve(".tmp/remotion", film);
    mkdirSync(dir, { recursive: true });
    const entry = join(dir, "entry.tsx");
    // Three lines, generated. The COMPONENT lives in the repo where it can be read and reviewed;
    // only the static import of the one film is written out, and registerRoot is written in full
    // because Remotion reads the entry file looking for that exact call.
    writeFileSync(entry, [
      `import { registerRoot } from "remotion";`,
      `import { ${film} } from ${JSON.stringify(resolve("src/canvas-core", film))};`,
      `import { rootFor } from ${JSON.stringify(resolve("tools/adapters/remotion/canvas.tsx"))};`,
      `registerRoot(rootFor(${film}));`, ``,
    ].join("\n"));
    bundles.set(film, bundle({ entryPoint: entry, outDir: join(dir, "bundle"), onProgress: () => {} })); /* outDir keeps the build inside the project, not in the system temp */
  }
  return bundles.get(film);
};

export const open = async (film, opts = {}) => {
  const { scale = 1, workers = 1 } = opts;
  const p = probe();
  if (!p.ok) throw new Error(`remotion: ${p.why}`);
  const { bundle } = require("@remotion/bundler");
  const { getCompositions, renderStill, openBrowser } = require("@remotion/renderer");

  const data = await loadFilm(film);
  const serveUrl = await bundleFor(film, bundle);
  const comps = await getCompositions(serveUrl);
  const composition = comps.find((c) => c.id === data.meta.title);
  // The composition is not trusted to agree with the film: if Remotion is about to render a
  // different length or a different size, that is a silent wrong answer, so it is an error here.
  if (!composition) throw new Error(`remotion: the bundle has no composition '${data.meta.title}' (found: ${comps.map((c) => c.id).join(", ") || "none"})`);
  if (composition.durationInFrames !== data.meta.durationFrames) throw new Error(`remotion: composition is ${composition.durationInFrames} frames, the film is ${data.meta.durationFrames}`);
  if (composition.width !== data.meta.W || composition.height !== data.meta.H) throw new Error(`remotion: composition is ${composition.width}x${composition.height}, the film is ${data.meta.W}x${data.meta.H}`);

  // Independent browsers, so "two workers" means two genuinely separate instances rather than two
  // tabs sharing one process. Remotion gives each still its own page regardless, which is what
  // makes every frame here a cold draw.
  const browsers = [];
  for (let i = 0; i < Math.max(1, workers); i++) browsers.push(await openBrowser("chrome"));
  const pick = (w) => browsers[((w % browsers.length) + browsers.length) % browsers.length];
  const dir = resolve(".tmp/remotion", film);

  const still = async (n, w) => {
    const f = Math.max(0, Math.min(data.meta.durationFrames - 1, Math.round(n)));
    const file = join(dir, `f${f}-w${w % Math.max(1, workers)}.png`);
    const t0 = Date.now();
    await renderStill({ composition, serveUrl, output: file, frame: f, imageFormat: "png", scale, puppeteerInstance: pick(w), overwrite: true });
    if (!existsSync(file)) throw new Error(`remotion: renderStill wrote nothing for frame ${f}`);
    return { png: readFileSync(file), drawMs: Date.now() - t0 };
  };

  return {
    workers: browsers.length,
    info: () => data.meta,
    frame: async (n, w = 0) => { const r = await still(n, w); return { png: r.png, shot: (data.shots.find((s) => n >= s.start && n < s.end) ?? {}).id ?? null, drawMs: r.drawMs }; },
    // Hashed through the PNG the renderer wrote: that file IS what this backend produces, so
    // hashing anything else would be grading something the backend does not actually deliver.
    hash: async (n, w = 0) => createHash("sha256").update((await still(n, w)).png).digest("hex").slice(0, 16),
    audio: async (sr) => pcm16(data, sr),
    artifact: () => null, /* like playwright: a means to an MP4, not a deliverable of its own */
    close: async () => { for (const b of browsers) await b.close({ silent: true }); },
  };
};
