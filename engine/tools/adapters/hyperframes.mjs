// HYPERFRAMES ADAPTER. Hyperframes (@hyperframes/engine) drives a SEEKABLE page: headless Chrome,
// one deterministic seek per frame, captured through Chrome's BeginFrame rather than by letting a
// clock run. Its page-side contract is a FRAME ADAPTER:
//
//   type FrameAdapter = {
//     id: string;
//     init?: (ctx) => Promise<void> | void;
//     getDurationFrames: () => number;
//     seekFrame: (frame: number) => Promise<void> | void;   // a FRAME NUMBER, not seconds
//     destroy?: () => Promise<void> | void;
//   };
//
// and it asks of that adapter exactly what this engine already guarantees: a finite frame count,
// forward, backward and random seeks, the SAME STATE whenever the same frame is asked for again,
// no wall-clock timers, no unseeded randomness, and all async work finished before capture. That
// is the pull model this film was built on, so the adapter below is nine lines of plumbing:
// `seekFrame(n)` is `window.FILM.seek(n)` and nothing else.
//
// NOT INSTALLED HERE. @hyperframes/engine is not a dependency of this project, so every reference
// to it is behind a dynamic import inside open(): this file imports clean, probe() says exactly
// what is missing and how to get it, and the gate reports CANNOT RUN rather than failing. See
// tools/adapters/README.md for the one-line install.
//
// WHAT IS VERIFIED AND WHAT IS NOT. The page-side FrameAdapter shape above is from Hyperframes'
// published contract and is implemented exactly. The node-side capture calls are taken from the
// engine's own README example, but they have NOT been run here, because running them means
// installing the package. So this adapter refuses to guess: it checks that the module really
// exports what it is about to call and, if not, says what it found instead. A backend that is
// not installed should report that it is not installed, never quietly produce a wrong answer.
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildPage } from "../build-page.mjs";

const require = createRequire(import.meta.url);
const version = (id) => { try { return require(`${id}/package.json`).version; } catch { return null; } };

export const name = "hyperframes";
export const describe = () => "the film seeked frame by frame in headless Chrome by the Hyperframes engine";

export const ENGINE = "@hyperframes/engine";
export const INSTALL = `npm i -D ${ENGINE}`;

export const probe = () => {
  const v = version(ENGINE);
  if (!v) return { ok: false, why: `${ENGINE} is not installed (${INSTALL}); needs Node >= 22, Chrome and ffmpeg` };
  return { ok: true, why: `${ENGINE}@${v}` };
};

// The page-side frame adapter, as a string because it is evaluated in the BROWSER. It is the
// whole of the Hyperframes contract for this film, and it adds no state of its own: every answer
// comes from window.FILM, which is the same surface playwright and the html player drive.
export const FRAME_ADAPTER = (film) => `
  (() => {
    const ready = window.FILM.ready.then(() => window.FILM.mount(${JSON.stringify(1)}));
    const adapter = {
      id: ${JSON.stringify(film)},
      init: () => ready,
      getDurationFrames: () => window.FILM.meta.durationFrames,
      seekFrame: (n) => { window.FILM.seek(n); },  /* synchronous by design: the draw is finished before this returns, so there is nothing to await and nothing to race */
      destroy: () => {},
    };
    window.__hfAdapter = adapter;
    // The engine's own README describes a simpler surface on window.__hf. Both are served from
    // the one object so there is a single source of truth whichever the installed version asks for.
    window.__hf = { duration: () => adapter.getDurationFrames(), seek: (n) => adapter.seekFrame(n), adapter };
  })();
`;

const need = (mod, names) => {
  const missing = names.filter((n) => typeof mod[n] !== "function");
  if (missing.length) throw new Error(`hyperframes: ${ENGINE}@${version(ENGINE)} does not export ${missing.join(", ")} (it exports: ${Object.keys(mod).filter((k) => typeof mod[k] === "function").sort().join(", ") || "no functions"}). This adapter was written against the engine's documented capture API; if that API has moved, fix it here rather than guessing.`);
};

export const open = async (film, opts = {}) => {
  const { scale = 1, workers = 1 } = opts;
  const p = probe();
  if (!p.ok) throw new Error(`hyperframes: ${p.why}`);
  const engine = await import(ENGINE);
  need(engine, ["acquireBrowser", "createCaptureSession", "initializeSession", "captureFrame", "closeCaptureSession"]);

  // Built into .tmp, never over the shipped page: out/ holds the approved deliverable and no
  // adapter has any business rewriting it to render a frame.
  const dir = resolve(".tmp/hyperframes", film);
  mkdirSync(dir, { recursive: true });
  const out = join(dir, `${film}.html`);
  const built = await buildPage({ entry: `src/hosts/page-${film}.ts`, out, title: film });
  const { writeFileSync } = await import("node:fs");
  writeFileSync(out, readFileSync(out, "utf8").replace("</body>", `<script>${FRAME_ADAPTER(film)}</script></body>`));

  const leases = [], sessions = [];
  for (let i = 0; i < Math.max(1, workers); i++) {
    const lease = await engine.acquireBrowser({ captureMode: "beginFrame" });
    const session = engine.createCaptureSession({ browser: lease.browser, url: pathToFileURL(out).href + "?adapter=hyperframes", width: Math.round(built.meta.W * scale), height: Math.round(built.meta.H * scale), fps: built.meta.fps });
    await engine.initializeSession(session);
    leases.push(lease); sessions.push(session);
  }
  const pick = (w) => sessions[((w % sessions.length) + sessions.length) % sessions.length];

  const grab = async (n, w) => {
    const f = Math.max(0, Math.min(built.meta.durationFrames - 1, Math.round(n)));
    const file = join(dir, `f${f}-w${w % Math.max(1, workers)}.png`);
    const t0 = Date.now();
    await engine.captureFrame(pick(w), f, file);
    return { png: readFileSync(file), drawMs: Date.now() - t0 };
  };

  return {
    workers: sessions.length,
    info: () => built.meta,
    frame: async (n, w = 0) => { const r = await grab(n, w); return { png: r.png, shot: null, drawMs: r.drawMs }; },
    hash: async (n, w = 0) => createHash("sha256").update((await grab(n, w)).png).digest("hex").slice(0, 16),
    audio: async (sr) => { const s = pick(0); return s && engine.captureAudio ? engine.captureAudio(s, sr) : null; }, /* the engine mixes audio from <audio> elements; this film synthesizes its score in the page, so there is none to mix */
    artifact: () => null,
    close: async () => { for (const s of sessions) await engine.closeCaptureSession(s); for (const l of leases) await l.release(); },
  };
};
