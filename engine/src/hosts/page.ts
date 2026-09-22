// THE ONE GENERATED PAGE. Playwright, the HTML player and (Phase 5) Hyperframes all drive this
// same page through window.FILM. Everything host-specific (DOM, clocks, asset decoding, Web
// Audio) lives HERE; the art core never sees it.
import type { Ctx, Env, Layer } from "../canvas-core/core";
import { Film, renderFrame, validate } from "../canvas-core/film";

declare global { interface Window { FILM: unknown; __ASSETS__?: Record<string, string> } }

export const mountFilm = (film: Film) => {
  const canvas = document.getElementById("film") as HTMLCanvasElement, images = new Map<string, CanvasImageSource>();
  let env: Env, ctx: Ctx, current = 0;
  // Safari before 16.4 has no 2D OffscreenCanvas: fall back to a detached <canvas>. The core cannot tell the difference.
  const opts = film.meta.raster === "cpu" ? { willReadFrequently: true } : undefined;   // see Film.meta.raster
  const surface = (w: number, h: number): Layer => { const c = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(w, h) : Object.assign(document.createElement("canvas"), { width: w, height: h }); return { canvas: c, ctx: c.getContext("2d", opts) as unknown as Ctx } as Layer; };
  const mount = (scale = 1) => { canvas.width = Math.round(film.meta.W * scale); canvas.height = Math.round(film.meta.H * scale); ctx = canvas.getContext("2d", opts) as CanvasRenderingContext2D; env = { W: film.meta.W, H: film.meta.H, scale, cache: new Map(), canvas: surface, image: (n) => images.get(n) }; return film.meta; };
  // contract rule 4: every asset is loaded AND decoded before frame 0, or the film refuses to start
  const ready = (async () => {
    const problems = validate(film); if (problems.length) throw new Error("timeline: " + problems.join("; "));
    await Promise.all(Object.entries(film.assets.images).map(async ([name, url]) => { const img = new Image(); img.src = window.__ASSETS__?.[name] ?? url; await img.decode(); images.set(name, img); }));
    mount(1); return film.meta;
  })();
  const seek = (frame: number) => { const t0 = performance.now(); const shot = renderFrame(film, ctx, frame, env); ctx.getImageData(0, 0, 1, 1); current = frame; return { shot, ms: performance.now() - t0 }; }; // getImageData forces the deferred raster so the timing is real
  const hash = () => { const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data; let h = 0x811c9dc5; for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16); };
  const b64 = (u8: Uint8Array) => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };
  const audio = (sr: number) => { if (!film.audio) return null; const [L, R] = film.audio(sr), pcm = new Int16Array(L.length * 2); for (let i = 0; i < L.length; i++) { pcm[i * 2] = Math.max(-1, Math.min(1, L[i])) * 32767; pcm[i * 2 + 1] = Math.max(-1, Math.min(1, R[i])) * 32767; } return { sampleRate: sr, frames: L.length, pcm16: b64(new Uint8Array(pcm.buffer)) }; };
  const warm = () => film.shots.forEach((s) => { seek(s.start); seek(s.start + ((s.end - s.start) >> 1)); }); // first + middle frame of every shot: builds tiles, pre-allocates the layer pool
  window.FILM = { meta: film.meta, ready, mount, seek, hash, audio, warm, png: () => canvas.toDataURL("image/png").slice(22), frame: () => current };

  // ---- the player: click or space to play, arrows to step, ?frame=N to open on a frame
  ready.then(() => {
    const q = new URLSearchParams(location.search); if (q.has("adapter")) return; // a backend is driving: stay still
    seek(Number(q.get("frame") ?? 0));
    let playing = false, ac: AudioContext | null = null, t0 = 0, f0 = 0, node: AudioBufferSourceNode | null = null;
    const stop = () => { playing = false; node?.stop(); node = null; };
    const play = () => {
      ac ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); playing = true; f0 = current >= film.meta.durationFrames - 1 ? 0 : current; t0 = ac.currentTime;
      if (film.audio) { const [L, R] = film.audio(ac.sampleRate), buf = ac.createBuffer(2, L.length, ac.sampleRate); buf.getChannelData(0).set(L); buf.getChannelData(1).set(R); node = ac.createBufferSource(); node.buffer = buf; node.connect(ac.destination); node.start(0, f0 / film.meta.fps); }
      const tick = () => { if (!playing) return; const f = f0 + Math.floor((ac!.currentTime - t0) * film.meta.fps); if (f >= film.meta.durationFrames) { seek(film.meta.durationFrames - 1); stop(); return; } if (f !== current) seek(f); requestAnimationFrame(tick); }; tick();
    };
    const toggle = () => (playing ? stop() : play());
    canvas.addEventListener("click", toggle);
    addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); toggle(); } if (e.key === "ArrowRight") { stop(); seek(Math.min(film.meta.durationFrames - 1, current + 1)); } if (e.key === "ArrowLeft") { stop(); seek(Math.max(0, current - 1)); } });
  });
};
