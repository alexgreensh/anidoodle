// THE ONE GENERATED PAGE. Playwright, the HTML player and (Phase 5) Hyperframes all drive this
// same page through window.FILM. Everything host-specific (DOM, clocks, asset decoding, Web
// Audio) lives HERE; the art core never sees it.
import type { Ctx, Env, Layer } from "../canvas-core/core";
import { Film, renderFrame, validate } from "../canvas-core/film";
import { embeddedAudio, type AudioPayload } from './audio';
import { instruments } from "./instrument";
import { frameProbe } from "./probe";

declare global { interface Window { FILM: unknown; __ASSETS__?: Record<string, string>; __BAKE_SRC__?: Record<string, string>; __ANIDOODLE_SRC__?: WeakMap<object, string>; __SHAPE__?: string; __AUDIO__?: AudioPayload } }

// THE BAKE STORE (Env.bake). A finished plate frame, keyed by the hash of the source that draws it
// (build-page.mjs hashes each film module's whole import closure, plus the engine's own renderer),
// the frame and the pixel size. The adapter loads matching PNGs from disk before frame 0 and saves
// the fresh ones after; the page never touches a file. Only fully opaque frames are kept, because
// only those survive a PNG round trip bit for bit.
const bakeStore = (surface: (w: number, h: number) => Layer) => {
  const loaded = new Map<string, ImageBitmap>(), fresh = new Map<string, Layer>(), stats = { hits: 0, misses: 0, kept: 0, skipped: 0 };
  let on = false; // off until an adapter loads the store: a shipped player keeps no copies
  const keyOf = (film: object, frame: number, w: number, h: number) => { const mod = window.__ANIDOODLE_SRC__?.get(film), hash = mod ? window.__BAKE_SRC__?.[mod] : undefined; return hash ? `${hash}.${frame}.${w}x${h}` : null; };
  const bake: NonNullable<Env["bake"]> = {
    get: (film, frame, w, h) => { if (!on) return undefined; const k = keyOf(film, frame, w, h), img = k ? loaded.get(k) : undefined; if (img) stats.hits++; else stats.misses++; return img; },
    put: (film, frame, layer) => {
      if (!on) return;
      const { width: w, height: h } = layer.canvas, k = keyOf(film, frame, w, h); if (!k || loaded.has(k) || fresh.has(k)) return;
      const d = layer.ctx.getImageData(0, 0, w, h).data; for (let i = 3; i < d.length; i += 4) if (d[i] !== 255) { stats.skipped++; return; }
      const c = surface(w, h); c.ctx.drawImage(layer.canvas, 0, 0); fresh.set(k, c); stats.kept++; // same surface kind as the art: never mix raster paths
    },
  };
  const load = async (entries: Record<string, string>) => { on = true; await Promise.all(Object.entries(entries).map(async ([k, b64]) => { try { const bin = atob(b64), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); const img = await createImageBitmap(new Blob([u8], { type: "image/png" }), { premultiplyAlpha: "none", colorSpaceConversion: "none" }); if (`${img.width}x${img.height}` === k.split(".").pop()) loaded.set(k, img); } catch { /* unreadable: draw it cold */ } })); return loaded.size; }; // decoded in memory: no URL, no request
  const png64 = async (c: Layer["canvas"]) => { const blob = "convertToBlob" in c ? await (c as OffscreenCanvas).convertToBlob({ type: "image/png" }) : await new Promise<Blob>((ok) => (c as HTMLCanvasElement).toBlob((b) => ok(b!), "image/png")); const u8 = new Uint8Array(await blob.arrayBuffer()); let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };
  const take = async () => { const out: Record<string, string> = {}; for (const [k, c] of fresh) out[k] = await png64(c.canvas); fresh.clear(); return out; };
  const hashes = () => [...new Set(Object.values(window.__BAKE_SRC__ ?? {}))];
  return { bake, load, take, hashes, stats };
};

export const mountFilm = (film: Film) => {
  // <film>-<shape> (build-page.mjs sets __SHAPE__): the same film, re-composed for that frame
  if (window.__SHAPE__) { if (!film.reshape) throw new Error(`${film.meta.title} has one shape; ${window.__SHAPE__} is for launch template films (film.reshape)`); film = film.reshape(window.__SHAPE__); }
  const filmSound = window.__AUDIO__ ? embeddedAudio(window.__AUDIO__) : film.audio;
  const canvas = document.getElementById("film") as HTMLCanvasElement, images = new Map<string, CanvasImageSource>();
  let env: Env, ctx: Ctx, current = 0;
  // Safari before 16.4 has no 2D OffscreenCanvas: fall back to a detached <canvas>. The core cannot tell the difference.
  const opts = film.meta.raster === "cpu" ? { willReadFrequently: true } : undefined;   // see Film.meta.raster
  const surface = (w: number, h: number): Layer => { const c = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(w, h) : Object.assign(document.createElement("canvas"), { width: w, height: h }); return { canvas: c, ctx: c.getContext("2d", opts) as unknown as Ctx } as Layer; };
  const bakes = bakeStore(surface);
  // 3D shots draw through WebGL (three-core/stage.ts). OffscreenCanvas when the browser has it, a detached <canvas> otherwise.
  const glSurface = (w: number, h: number) => typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(w, h) : Object.assign(document.createElement("canvas"), { width: w, height: h });
  const mount = (scale = 1) => { canvas.width = Math.round(film.meta.W * scale); canvas.height = Math.round(film.meta.H * scale); ctx = canvas.getContext("2d", opts) as CanvasRenderingContext2D; env = { W: film.meta.W, H: film.meta.H, scale, cache: new Map(), canvas: surface, webgl: glSurface, image: (n) => images.get(n), bake: bakes.bake, root: true }; return film.meta; };
  // contract rule 4: every asset is loaded AND decoded before frame 0, or the film refuses to start
  const ready = (async () => {
    const problems = validate(film); if (problems.length) throw new Error("timeline: " + problems.join("; "));
    await Promise.all(Object.entries(film.assets.images).map(async ([name, url]) => { const img = new Image(); img.src = window.__ASSETS__?.[name] ?? url; await img.decode(); (img as unknown as { __name: string }).__name = name; images.set(name, img); }));
    // a launch look's own font files (launchLook.registerFaces) are loaded before frame 0, so no frame is set
    // in a fallback face; a film that added none waits for nothing
    if ((document.fonts as unknown as { size: number }).size) await document.fonts.ready;
    mount(1); return film.meta;
  })();
  const seek = (frame: number) => { const t0 = performance.now(); const shot = renderFrame(film, ctx, frame, env); ctx.getImageData(0, 0, 1, 1); current = frame; return { shot, ms: performance.now() - t0 }; }; // getImageData forces the deferred raster so the timing is real
  const hash = () => { const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data; let h = 0x811c9dc5; for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16); };
  const b64 = (u8: Uint8Array) => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); };
  // MOTION BLUR. One output frame as the average of subframes spread over a one-frame shutter
  // centred on it, confined to its own shot so nothing bleeds across a cut. The average is taken
  // in LINEAR light: blur is light integration, and averaging in sRGB darkens every moving edge.
  // It is also ALPHA-WEIGHTED (premultiplied): a transparent subframe carries no colour, so a
  // sticker's moving edge fades out instead of picking up a dark fringe from the zero RGB that
  // canvas keeps under alpha 0. Opaque pixels take exactly the unweighted path.
  // STEPPED ART (meta.step > 1, or onTwos) holds each drawing for `step` frames, so the shutter
  // would straddle two drawings and smear a pose into its neighbour: such films are not blurred.
  // hosts may keep time; the core never does.
  const toLin = new Float32Array(256);
  for (let i = 0; i < 256; i++) { const s = i / 255; toLin[i] = s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); }
  const fromLin = (l: number) => { const v = l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(l, 1 / 2.4) - 0.055; return Math.max(0, Math.min(255, Math.round(v * 255))); };
  // SHUTTER. `shutter` is the angle in degrees: 360 spreads the subframes over the whole frame
  // interval, 180 (film's standard, and the default) over half of it, centred on the frame.
  // ADAPTIVE (samples 0 = auto): how many subframes a frame needs comes from how fast its picture
  // moves on screen. Two sharp renders at the shutter's two ends are block-matched on a 1/8 luma
  // grid (8x8 blocks, +-16 cells = +-128 px, textured blocks only); the 98th percentile displacement,
  // divided by `px` (default 3: subframes at most 3 px apart), is the count, 1 on a still frame (the
  // sharp frame itself, untouched), at most `max` (default 32). Pure pixels in, a number out:
  // deterministic like the frames it measures.
  // sharp: true (the default) keeps type, photos and sharp() out of the blur (hosts/instrument.ts); false blurs everything.
  type BlurSpec = { samples?: number; shutter?: number; max?: number; px?: number; sharp?: boolean };
  const inst = instruments({ ctx: () => ctx, images: () => new Set(images.values()), draw: (f) => { renderFrame(film, ctx, f, env); }, read: () => ctx.getImageData(0, 0, canvas.width, canvas.height).data, clearCache: () => env.cache.clear() });
  const lumaGrid = (f: number, cell: number) => {
    renderFrame(film, ctx, f, env); const w = canvas.width, h = canvas.height, d = ctx.getImageData(0, 0, w, h).data, gw = Math.floor(w / cell), gh = Math.floor(h / cell), g = new Float32Array(gw * gh);
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) { let s = 0; for (let yy = 0; yy < cell; yy += 2) for (let xx = 0; xx < cell; xx += 2) { const p = ((y * cell + yy) * w + x * cell + xx) * 4, a = d[p + 3] / 255; s += (0.2126 * d[p] + 0.7152 * d[p + 1] + 0.0722 * d[p + 2]) * a; } g[y * gw + x] = s / ((cell * cell) / 4); }
    return { g, gw, gh };
  };
  const speedOf = (t0: number, t1: number) => {
    const cell = 8, B = 8, R = 16, A = lumaGrid(t0, cell), Z = lumaGrid(t1, cell), { gw, gh } = A, vec = new Map<number, [number, number]>();
    const cols = Math.floor((gw - 2 * R - B) / B) + 1;
    for (let by = R, row = 0; by + B + R <= gh; by += B, row++) for (let bx = R, col = 0; bx + B + R <= gw; bx += B, col++) {
      let mean = 0, v = 0; for (let y = 0; y < B; y++) for (let x = 0; x < B; x++) mean += A.g[(by + y) * gw + bx + x]; mean /= B * B;
      for (let y = 0; y < B; y++) for (let x = 0; x < B; x++) v += (A.g[(by + y) * gw + bx + x] - mean) ** 2;
      if (v / (B * B) < 12) continue; // flat: no motion can be read off it
      const sadAt = (dx: number, dy: number) => { let sad = 0; for (let y = 0; y < B; y++) for (let x = 0; x < B; x++) sad += Math.abs(A.g[(by + y) * gw + bx + x] - Z.g[(by + y + dy) * gw + bx + x + dx]); return sad; };
      const cost = new Float64Array((2 * R + 1) ** 2); let best = Infinity;
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { const c = sadAt(dx, dy); cost[(dy + R) * (2 * R + 1) + dx + R] = c; if (c < best) best = c; }
      // content that changes without moving (a stroke drawn, a letter typed) matches nowhere well: not motion
      if (best / (B * B) > 4) continue;
      // a periodic texture (halftone, stripes) matches equally well far away: of the near-best offsets take the SMALLEST motion
      let mx = 0, my = 0, md = Infinity;
      for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { const c = cost[(dy + R) * (2 * R + 1) + dx + R], d = Math.hypot(dx, dy); if (c <= best * 1.1 + B * B * 0.5 && d < md) { md = d; mx = dx; my = dy; } }
      const at = (dx: number, dy: number) => (Math.abs(dx) <= R && Math.abs(dy) <= R ? cost[(dy + R) * (2 * R + 1) + dx + R] : Infinity), c0 = at(mx, my);
      const sub = (m: number, c: number, p: number) => { const d = m - 2 * c + p; return Number.isFinite(d) && d > 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (m - p)) / d)) : 0; };
      vec.set(row * cols + col, [mx + (mx || my ? sub(at(mx - 1, my), c0, at(mx + 1, my)) : 0), my + (mx || my ? sub(at(mx, my - 1), c0, at(mx, my + 1)) : 0)]);
    }
    // real motion is coherent: a block's vector counts only if two of its neighbours agree with it (within 1.5 cells)
    const disp: number[] = [];
    for (const [key, [x, y]] of vec) { const r = Math.floor(key / cols), c = key % cols; let agree = 0; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { if (!dr && !dc) continue; const nb = vec.get((r + dr) * cols + c + dc); if (nb && c + dc >= 0 && c + dc < cols && Math.hypot(nb[0] - x, nb[1] - y) <= 1.5) agree++; } if (agree >= 2) disp.push((Math.hypot(x, y) * cell) / env.scale); }
    if (!disp.length) return 0;
    disp.sort((a, b) => a - b); return disp[Math.min(disp.length - 1, Math.floor(disp.length * 0.98))];
  };
  const blur = (frame: number, spec: number | BlurSpec) => {
    const o: BlurSpec = typeof spec === "number" ? { samples: spec, shutter: 360 } : spec, sh = (o.shutter ?? 180) / 360;
    const n = Math.max(0, Math.min(film.meta.durationFrames - 1, Math.round(frame))), shot = film.shots.find((s) => n >= s.start && n < s.end);
    const stepped = (film.meta.step ?? (film.meta.onTwos ? 2 : 1)) > 1, win = (t: number) => Math.min(shot!.end - 1, Math.max(shot!.start, t));
    let samples = o.samples ?? 0, speed = NaN;
    if (shot && !stepped && samples === 0) { speed = speedOf(win(n - sh / 2), win(n + sh / 2)); samples = Math.max(1, Math.min(o.max ?? 32, Math.ceil(speed / (o.px ?? 3)))); }
    if (!shot || samples < 2 || stepped) { const r = seek(n); return { shot: r.shot, ms: r.ms, samples: 1, speed }; }
    const t0 = performance.now(), w = canvas.width, h = canvas.height, acc = new Float64Array(w * h * 4);
    const keep = o.sharp === false ? null : inst.sharpLayers(n); // the frame's type and photos, drawn sharp
    const sub = () => { for (let i = 0; i < samples; i++) {
      const t = win(n + ((i + 0.5) / samples - 0.5) * sh);
      renderFrame(film, ctx, t, env);
      const d = ctx.getImageData(0, 0, w, h).data;
      for (let p = 0; p < d.length; p += 4) { const a = d[p + 3], k = a / 255; acc[p] += toLin[d[p]] * k; acc[p + 1] += toLin[d[p + 1]] * k; acc[p + 2] += toLin[d[p + 2]] * k; acc[p + 3] += a; }
    } };
    if (keep) inst.withoutSharp(sub); else sub();
    const img = ctx.createImageData(w, h), out = img.data, inv = 1 / samples, full = 255 * samples;
    for (let p = 0; p < out.length; p += 4) {
      const A = acc[p + 3]; if (A === 0) continue; // nothing was ever drawn here: stays transparent black
      const c = A === full ? inv : 255 / A; // premultiplied average, un-premultiplied by the mean alpha
      out[p] = fromLin(acc[p] * c); out[p + 1] = fromLin(acc[p + 1] * c); out[p + 2] = fromLin(acc[p + 2] * c); out[p + 3] = Math.round(A * inv);
    }
    if (keep) for (let i = 0, p = 0; i < keep.mask.length; i++, p += 4) if (keep.mask[i]) { out[p] = keep.whole[p]; out[p + 1] = keep.whole[p + 1]; out[p + 2] = keep.whole[p + 2]; out[p + 3] = keep.whole[p + 3]; }
    ctx.putImageData(img, 0, 0); current = n;
    return { shot: shot.id, ms: performance.now() - t0, samples, speed, sharpPx: keep?.count ?? 0, typeInLayers: keep?.layerType ?? 0 }; // typeInLayers: layers holding type that blurred (instrument.ts)
  };
  // THE FRAME PROBE (tools/framecheck.mjs): hosts/probe.ts. Every call rebuilds the film's layer memo under
  // its hooks, so text in a reused layer (a bake() sprite, a held plate) is seen in every batch.
  const probe = frameProbe({ canvas: () => canvas, ctx: () => ctx, seek: (f) => { seek(f); }, clearCache: () => env.cache.clear() });
  // 3D CHECKS (tools/gate.mjs, still.mjs --grips). Turns three-core/checks3d.ts on, draws each frame asked
  // and returns what every frame's runChecks found, plus where its grips sit on screen (logical px).
  // A frame whose film never calls runChecks returns no record. Off by default: no hook, no cost.
  type Check3D = { frame: number; findings: { frame: number; kind: string; where: string; detail: string }[]; grips: { name: string; x: number; y: number }[] };
  const checks3d = (frames: number[]) => {
    const out: Check3D[] = [], g = globalThis as { __ANIDOODLE_CHECK3D__?: (frame: number, findings: Check3D["findings"], info?: { grips: Check3D["grips"] }) => void };
    g.__ANIDOODLE_CHECK3D__ = (frame, findings, info) => { out.push({ frame, findings, grips: info?.grips ?? [] }); };
    try { for (const f of frames) seek(f); } finally { delete g.__ANIDOODLE_CHECK3D__; }
    return out;
  };
  const audio = (sr: number) => { if (!filmSound) return null; const [L, R] = filmSound(sr); if (L.length !== R.length) throw new Error("audio channels have different lengths"); const pcm = new Float32Array(L.length * 2); for (let i = 0; i < L.length; i++) { pcm[i * 2] = L[i]; pcm[i * 2 + 1] = R[i]; } return { sampleRate: sr, frames: L.length, float32: b64(new Uint8Array(pcm.buffer)) }; };
  const warm = () => film.shots.forEach((s) => { seek(s.start); seek(s.start + ((s.end - s.start) >> 1)); }); // first + middle frame of every shot: builds tiles, pre-allocates the layer pool
  // POSTER. Platforms show frame 0 as the thumbnail, so a delivery may open on a chosen frame (the
  // wall of styles, the logo) and dissolve into the film's real opening over `fade` frames. The
  // poster frame is drawn once into its own surface; frame n < fade is the real frame n with the
  // poster laid over it at 1 - n/fade. Frame 0 IS the poster. Nothing else changes, not the score.
  let posterOf: { key: string; img: CanvasImageSource } | null = null;
  const poster = (frame: number, posterFrame: number, fade: number, samples: number | BlurSpec = 1) => {
    const on = typeof samples === "number" ? samples > 1 : true;
    const n = Math.round(frame), u = fade > 0 ? 1 - n / fade : n === 0 ? 1 : 0, key = `${posterFrame}/${JSON.stringify(samples)}/${canvas.width}x${canvas.height}`;
    if (u > 0 && posterOf?.key !== key) {
      on ? blur(posterFrame, samples) : seek(posterFrame);
      // the copy lives on the same kind of surface the art uses (surface(): same raster opts). A plain
      // GPU <canvas> drawn onto a meta.raster "cpu" canvas flips Chrome's raster path for the rest
      // of the session and every later frame comes out different: measured, not guessed.
      const c = surface(canvas.width, canvas.height); c.ctx.drawImage(canvas, 0, 0); posterOf = { key, img: c.canvas };
    }
    const r = on ? blur(n, samples) : seek(n);
    if (u > 0 && posterOf) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = Math.min(1, u); ctx.globalCompositeOperation = "source-over"; if (u >= 1) ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(posterOf.img, 0, 0); ctx.restore(); }
    current = n; return r;
  };
  // THE LAYER PROBE (tools/layerscan.mjs): per frame, text, photos and reported boxes in draw order, and
  // translucent fills in the brand's colours; ink(): how much each text box shows on a frame.
  const layers = (frames: number[], brand: string[] = []) => { const r = inst.layers(frames, brand); current = frames[frames.length - 1] ?? current; return r; };
  const ink = (frame: number, boxes: { x0: number; y0: number; x1: number; y1: number }[]) => inst.ink(frame, boxes, canvas.width);
  window.FILM = { probe, checks3d, layers, ink, meta: { ...film.meta, placeholders: (window as unknown as { __PLACEHOLDERS__?: string[] }).__PLACEHOLDERS__ ?? [], hasAudio: typeof film.audio === "function", shots: film.shots.map(({ id, start, end }) => ({ id, start, end })) }, ready, mount, seek, hash, audio, warm, blur, poster, bakes: { load: bakes.load, take: bakes.take, hashes: bakes.hashes, stats: () => bakes.stats }, png: () => canvas.toDataURL("image/png").slice(22), frame: () => current };

  // ---- the player: click or space to play, arrows to step, ?frame=N to open on a frame
  ready.then(() => {
    const q = new URLSearchParams(location.search); if (q.has("adapter")) return; // a backend is driving: stay still
    seek(Number(q.get("frame") ?? 0));
    let playing = false, ac: AudioContext | null = null, t0 = 0, f0 = 0, node: AudioBufferSourceNode | null = null;
    const stop = () => { playing = false; node?.stop(); node = null; };
    const play = () => {
      ac ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)(); playing = true; f0 = current >= film.meta.durationFrames - 1 ? 0 : current; t0 = ac.currentTime;
      if (filmSound) { const sr = window.__AUDIO__?.sampleRate ?? ac.sampleRate, [L, R] = filmSound(sr), buf = ac.createBuffer(2, L.length, sr); buf.getChannelData(0).set(L); buf.getChannelData(1).set(R); node = ac.createBufferSource(); node.buffer = buf; node.connect(ac.destination); node.start(0, f0 / film.meta.fps); }
      const tick = () => { if (!playing) return; const f = f0 + Math.floor((ac!.currentTime - t0) * film.meta.fps); if (f >= film.meta.durationFrames) { seek(film.meta.durationFrames - 1); stop(); return; } if (f !== current) seek(f); requestAnimationFrame(tick); }; tick();
    };
    const toggle = () => (playing ? stop() : play());
    canvas.addEventListener("click", toggle);
    addEventListener("keydown", (e) => { if (e.key === " ") { e.preventDefault(); toggle(); } if (e.key === "ArrowRight") { stop(); seek(Math.min(film.meta.durationFrames - 1, current + 1)); } if (e.key === "ArrowLeft") { stop(); seek(Math.max(0, current - 1)); } });
  });
};
