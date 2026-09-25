// THE INTERACTIVE HOST. Everything with a clock or a DOM lives here; the art (a Piece) never sees
// either. The host's whole job is to turn a person into an append-only InputLog, and to draw
//
//     piece.draw(ctx, tick, env, stateAt(tick, log, piece.input))
//
// at 60 Hz ticks. Replaying that log anywhere draws the same frames (tools/replay.mjs proves it).
//
//   mount(el, piece, opts)       -> Controller   no framework, no dependency
//   define({ name: piece })      -> <ani-doodle piece="name" scroll-track="#sel" state="idle">
//
// Page binding: any element with data-anidoodle="<name>" is a target. Pointer enter/leave, press,
// click (mouse, touch, pen, or Enter/Space from the keyboard), keyboard focus, and typing (length
// and caret) on it go into the log, with its rectangle in piece coordinates. controller.setState()
// logs a UI state ("busy", "success", "error"...). Everything else the page does is its own.
import type { Ctx, Env, Layer } from "../canvas-core/core";
import { stats as bakeStats } from "../canvas-core/bake";
import { HZ, restState, stateAt, type InputEvent, type InputLog, type InputState, type Piece } from "../canvas-core/input";

export type MountOptions = {
  root?: ParentNode;                         // where data-anidoodle targets are looked for (default: document)
  scrollTrack?: HTMLElement | string | null; // input.scroll = progress of this element through the viewport
  pauseControl?: boolean;                    // a visible pause button (default true)
  maxScale?: number;                         // cap on device px per logical px (default 3)
  reducedMotion?: "auto" | boolean;          // default "auto": follows prefers-reduced-motion
  state?: string;                            // initial UI state
  clock?: () => number;                      // ms. Default performance.now; the recorder injects a manual one
  sampleEvery?: number;                      // debug: hash every Nth drawn frame (replay gate)
  syncTiming?: boolean;                      // debug: force raster after each draw so frame time is real
  raster?: "gpu" | "cpu";                    // see surfaceFor
};
export type Sample = { tick: number; scale: number; hash: string };
export type Controller = {
  el: HTMLElement; canvas: HTMLCanvasElement; piece: Piece; ready: Promise<void>;
  setState(name: string): void; pause(): void; play(): void; readonly paused: boolean; destroy(): void;
  // tooling (replay gate, recorder): none of these are needed to use a piece
  log(): InputLog; tick(): number; scale(): number; state(tick?: number): InputState;
  render(tick: number, log: InputLog, scale?: number, cold?: boolean): number; renderRest(tick: number, scale?: number): void; hash(): string;
  renderNow(): void; samples(): Sample[]; stats(): Record<string, unknown>; envs(): { live: Env; last: Env | null };
};

// raster "cpu" (willReadFrequently) is for the gate: Chromium silently moves a GPU canvas to software
// after its first readback, and the two antialias differently, so hashing a GPU canvas compares two
// renderers. Pages ship "gpu" (the default); the replay gate forces "cpu" through window.__ANI_RASTER__.
const surfaceFor = (cpu: boolean) => (w: number, h: number): Layer => {
  const c = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(w, h) : Object.assign(document.createElement("canvas"), { width: w, height: h });
  return { canvas: c, ctx: c.getContext("2d", cpu ? { willReadFrequently: true } : undefined) as unknown as Ctx } as Layer;
};
let surface = surfaceFor(false);
const newEnv = (piece: Piece, scale: number): Env => ({ W: piece.meta.W, H: piece.meta.H, scale, cache: new Map(), canvas: surface });
const q = (v: number, step: number) => Math.round(v / step) * step;
const fnv = (d: Uint8ClampedArray) => { let h = 0x811c9dc5; for (let i = 0; i < d.length; i++) { h ^= d[i]; h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16).padStart(8, "0"); };
const pct = (a: number[], p: number) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

declare global { interface Window { __anidoodle?: Controller[]; __ANI_CLOCK__?: () => number; __ANI_RASTER__?: "gpu" | "cpu"; __ANI_SAMPLE__?: number; __ANI_SYNC__?: boolean } }

export const mount = (el: HTMLElement, piece: Piece, opts: MountOptions = {}): Controller => {
  const { W, H } = piece.meta, root = opts.root ?? document, clock = opts.clock ?? window.__ANI_CLOCK__ ?? (() => performance.now());
  const canvas = document.createElement("canvas");
  canvas.setAttribute("role", "img"); canvas.setAttribute("aria-label", piece.meta.alt);
  Object.assign(canvas.style, { display: "block", width: "100%", height: "auto", aspectRatio: `${W} / ${H}`, opacity: "0", transition: "opacity .4s ease", touchAction: "manipulation" });
  if (getComputedStyle(el).position === "static") el.style.position = "relative";
  el.appendChild(canvas);
  const cpu = (opts.raster ?? window.__ANI_RASTER__) === "cpu"; surface = surfaceFor(cpu);
  opts = { ...opts, sampleEvery: opts.sampleEvery ?? window.__ANI_SAMPLE__, syncTiming: opts.syncTiming ?? window.__ANI_SYNC__ };
  const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: cpu }) as CanvasRenderingContext2D;

  // ---------------------------------------------------------------- clock and log
  const log: InputLog = [];
  let t0 = 0, started = false, paused = false, pausedAt = 0, pausedTotal = 0, lastDrawn = -1, destroyed = false;
  const clockTick = () => (started ? Math.floor(((paused ? pausedAt : clock()) - t0 - pausedTotal) * HZ / 1000) : 0);
  // rule 2 of input.ts: an event takes effect after every tick already drawn
  const push = (e: Omit<InputEvent, "tick">) => {
    const ev: InputEvent = { tick: Math.max(lastDrawn + 1, clockTick()), ...e }, last = log[log.length - 1];
    const merge = last && last.tick === ev.tick && last.type === ev.type && last.target === ev.target && (ev.type === "move" || ev.type === "scroll" || ev.type === "rect" || ev.type === "key" || ev.type === "view");
    if (merge) log[log.length - 1] = ev; else log.push(ev);
    wake();
  };

  // ---------------------------------------------------------------- geometry: client px -> piece px
  const box = () => canvas.getBoundingClientRect();
  const toPiece = (cx: number, cy: number, r = box()): [number, number] => [q(((cx - r.left) * W) / (r.width || 1), 0.25), q(((cy - r.top) * H) / (r.height || 1), 0.25)];
  const targets = new Map<Element, string>(), rects = new Map<string, string>(), fields = new Map<string, string>();
  const scan = () => { targets.clear(); root.querySelectorAll("[data-anidoodle]").forEach((t) => targets.set(t, t.getAttribute("data-anidoodle") || "target")); };
  const nameOf = (t: EventTarget | null) => { for (let n = t as Element | null; n; n = n.parentElement) { const k = targets.get(n); if (k) return { el: n, name: k }; } return null; };
  const track = () => (typeof opts.scrollTrack === "string" ? document.querySelector(opts.scrollTrack) : opts.scrollTrack) as HTMLElement | null;
  let lastScroll = "";
  const poll = () => {
    const r = box(); if (!r.width) return;
    targets.forEach((name, t) => {
      const b = t.getBoundingClientRect(), [x, y] = toPiece(b.left, b.top, r), [x1, y1] = toPiece(b.right, b.bottom, r), k = `${x},${y},${x1},${y1}`;
      if (rects.get(name) !== k) { rects.set(name, k); push({ type: "rect", target: name, x, y, w: x1 - x, h: y1 - y }); }
    });
    const tk = track(); if (tk) {
      const b = tk.getBoundingClientRect(), vh = window.innerHeight, span = b.height - vh;
      const p = span > 1 ? -b.top / span : (vh - b.top) / (vh + b.height), v = Math.max(0, Math.min(1, q(p, 1e-4))).toFixed(4);
      if (v !== lastScroll) { lastScroll = v; push({ type: "scroll", value: Number(v) }); }
    }
  };

  // ---------------------------------------------------------------- scale, envs, baking
  const maxScale = opts.maxScale ?? 3;
  const wantScale = () => { const w = box().width || W; return Math.max(0.5, Math.min(maxScale, q((w * (window.devicePixelRatio || 1)) / W, 0.25))); };
  let env = newEnv(piece, wantScale()), pending: { env: Env; gen: Iterator<unknown> } | null = null, bakeMs = 0;
  const size = (e: Env) => { canvas.width = Math.round(W * e.scale); canvas.height = Math.round(H * e.scale); };
  const step = (gen: Iterator<unknown>, budget: number) => { const t = performance.now(); while (performance.now() - t < budget) if (gen.next().done) { bakeMs += performance.now() - t; return true; } bakeMs += performance.now() - t; return false; };
  let rescaleTimer = 0;
  const rescale = () => { const s = wantScale(); if (s === env.scale && !pending) return; if (pending?.env.scale === s) return; clearTimeout(rescaleTimer); rescaleTimer = window.setTimeout(() => { if (s === env.scale) { pending = null; return; } const e = newEnv(piece, s); pending = { env: e, gen: (piece.bake?.(e) ?? [])[Symbol.iterator]() }; wake(); }, 180); };

  // ---------------------------------------------------------------- the frame
  const frameTimes: number[] = [], samples: Sample[] = [];
  let drawn = 0;
  const hash = () => fnv(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
  const draw = (tick: number) => {
    const s = stateAt(tick, log, piece.input), t = performance.now();
    piece.draw(ctx, tick, env, s);
    if (opts.syncTiming) ctx.getImageData(0, 0, 1, 1);
    frameTimes.push(performance.now() - t); if (frameTimes.length > 3600) frameTimes.shift();
    lastDrawn = tick; drawn++;
    if (opts.sampleEvery && drawn % opts.sampleEvery === 0) samples.push({ tick, scale: env.scale, hash: hash() });
  };
  let raf = 0, visible = true, polls = 0;
  const running = () => started && !paused && visible && !destroyed && document.visibilityState === "visible";
  const loop = () => {
    raf = 0; if (destroyed) return;
    if (pending && step(pending.gen, 6)) { env = pending.env; pending = null; size(env); push({ type: "view", value: env.scale }); draw(Math.max(lastDrawn, clockTick())); }
    if (++polls % 30 === 0) { poll(); rescale(); }
    const tick = clockTick(); if (tick > lastDrawn) draw(tick);
    if (running() || pending) raf = requestAnimationFrame(loop);
  };
  const wake = () => { if (!raf && (running() || pending)) raf = requestAnimationFrame(loop); };

  // ---------------------------------------------------------------- listeners
  const on = <K extends keyof WindowEventMap>(t: EventTarget, type: K | string, fn: (e: Event) => void, o: AddEventListenerOptions = { passive: true }) => { t.addEventListener(type, fn, o); offs.push(() => t.removeEventListener(type, fn, o)); };
  const offs: (() => void)[] = [];
  let pressed: Element | null = null, hovered: Element | null = null;
  on(window, "pointermove", (e) => { const p = e as PointerEvent; const [x, y] = toPiece(p.clientX, p.clientY); push({ type: "move", x, y, value: p.pointerType || "mouse" }); });
  on(document, "pointerout", (e) => { if (!(e as PointerEvent).relatedTarget) push({ type: "leave" }); });
  on(window, "blur", () => push({ type: "leave" }));
  on(window, "pointerover", (e) => { const h = nameOf(e.target); if (h?.el === hovered) return; if (hovered) push({ type: "exit", target: targets.get(hovered) }); hovered = h?.el ?? null; if (h) push({ type: "enter", target: h.name }); });
  on(window, "pointerdown", (e) => { const p = e as PointerEvent; if (p.pointerType !== "mouse") { const [x, y] = toPiece(p.clientX, p.clientY); push({ type: "move", x, y, value: p.pointerType }); } /* a tap has no pointermove before it */ const h = nameOf(e.target), self = e.target === canvas; if (!h && !self) return; pressed = h?.el ?? canvas; push({ type: "down", target: h?.name ?? "self" }); });
  on(window, "pointerup", (e) => {
    const p = e as PointerEvent, h = nameOf(e.target), onIt = pressed && (pressed === canvas ? e.target === canvas : !!h && h.el === pressed);
    if (pressed) push(onIt ? { type: "up", target: pressed === canvas ? "self" : targets.get(pressed) } : { type: "cancel" }); pressed = null;
    if (p.pointerType === "touch") { if (hovered) push({ type: "exit", target: targets.get(hovered) }); hovered = null; push({ type: "leave" }); } // a finger that lifts is not hovering anything
  });
  on(window, "pointercancel", () => { if (pressed) push({ type: "cancel" }); pressed = null; });
  on(window, "click", (e) => { if ((e as MouseEvent).detail !== 0) return; const h = nameOf(e.target); if (!h) return; push({ type: "down", target: h.name }); push({ type: "up", target: h.name }); }); // Enter / Space
  on(window, "focusin", (e) => { const h = nameOf(e.target); if (!h) return; const el2 = e.target as Element; if (el2.matches?.(":focus-visible") || el2.matches?.("input,textarea,select")) push({ type: "focus", target: h.name }); });
  on(window, "focusout", (e) => { const h = nameOf(e.target); if (h) push({ type: "blur", target: h.name }); });
  const measure = document.createElement("canvas").getContext("2d")!;
  const typed = (e: Event) => {
    const h = nameOf(e.target), inp = e.target as HTMLInputElement; if (!h || !inp.matches?.("input,textarea")) return;
    const cs = getComputedStyle(inp), len = inp.value.length, text = inp.type === "password" ? "•".repeat(len) : inp.value;
    measure.font = cs.font || `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const b = inp.getBoundingClientRect(), pl = parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth), pr = parseFloat(cs.paddingRight) + parseFloat(cs.borderRightWidth);
    const cx = Math.min(b.right - pr, b.left + pl + measure.measureText(text.slice(0, inp.selectionStart ?? len)).width - inp.scrollLeft), [x, y] = toPiece(cx, b.top + b.height / 2), k = `${len},${x},${y}`;
    if (fields.get(h.name) === k) return; fields.set(h.name, k); push({ type: "key", target: h.name, value: len, x, y });
  };
  ["input", "keyup", "focusin", "select"].forEach((t) => on(window, t, typed));
  let pollQueued = false;
  const queuePoll = () => { if (pollQueued) return; pollQueued = true; requestAnimationFrame(() => { pollQueued = false; poll(); rescale(); }); };
  on(window, "scroll", queuePoll); on(window, "resize", queuePoll);
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(queuePoll) : null; ro?.observe(canvas);
  const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const reduced = () => (opts.reducedMotion === undefined || opts.reducedMotion === "auto" ? !!mq?.matches : opts.reducedMotion);
  if (mq && (opts.reducedMotion ?? "auto") === "auto") { const f = () => push({ type: "motion", value: reduced() ? "reduce" : "full" }); mq.addEventListener?.("change", f); offs.push(() => mq.removeEventListener?.("change", f)); }
  const io = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver((es) => { visible = es.some((x) => x.isIntersecting); wake(); }) : null; io?.observe(canvas);
  on(document, "visibilitychange", () => wake());

  // ---------------------------------------------------------------- pause control (WCAG 2.2.2)
  let btn: HTMLButtonElement | null = null;
  const paint = () => { if (!btn) return; btn.setAttribute("aria-pressed", String(paused)); btn.setAttribute("aria-label", paused ? "Play animation" : "Pause animation"); btn.dataset.state = paused ? "paused" : "playing"; btn.textContent = paused ? "\u25B6" : "\u2759\u2759"; };
  if (opts.pauseControl !== false) {
    btn = document.createElement("button"); btn.type = "button"; btn.className = "ani-doodle-pause";
    Object.assign(btn.style, { position: "absolute", right: "10px", bottom: "10px", width: "34px", height: "34px", borderRadius: "50%", border: "1.5px solid rgba(61,52,55,.55)", background: "rgba(251,246,234,.85)", color: "#3d3437", cursor: "pointer", font: "600 12px/1 system-ui, sans-serif", display: "grid", placeItems: "center", padding: "0" });
    btn.addEventListener("click", (e) => { e.stopPropagation(); if (paused) api.play(); else api.pause(); });
    el.appendChild(btn); paint();
  }

  // ---------------------------------------------------------------- start: log the initial configuration at tick 0, bake, show
  scan();
  push({ type: "motion", value: reduced() ? "reduce" : "full" });
  if (opts.state) push({ type: "state", value: opts.state });
  poll(); push({ type: "view", value: env.scale });
  const ready = (async () => {
    size(env);
    const gen = (piece.bake?.(env) ?? [])[Symbol.iterator]();
    await new Promise<void>((res) => { const go = () => (destroyed || step(gen, 12) ? res() : requestAnimationFrame(go)); go(); });
    started = true; t0 = clock(); draw(0); canvas.style.opacity = "1"; wake();
  })();

  const api: Controller = {
    el, canvas, piece, ready,
    setState: (name) => push({ type: "state", value: name }),
    pause: () => { if (paused) return; pausedAt = clock(); paused = true; paint(); },
    play: () => { if (!paused) return; pausedTotal += clock() - pausedAt; paused = false; paint(); wake(); },
    get paused() { return paused; },
    destroy: () => { destroyed = true; offs.forEach((f) => f()); ro?.disconnect(); io?.disconnect(); if (raf) cancelAnimationFrame(raf); canvas.remove(); btn?.remove(); const all = window.__anidoodle; if (all) all.splice(all.indexOf(api), 1); },
    log: () => log.map((e) => ({ ...e })),
    tick: () => lastDrawn, scale: () => env.scale,
    state: (tick = lastDrawn) => stateAt(tick, log, piece.input),
    // Draw `tick` of an arbitrary log at an arbitrary scale into this canvas (the live loop should be
    // paused). cold = a brand-new env: every sprite re-baked on demand, nothing carried over.
    render: (tick, lg, scale = env.scale, cold = false) => {
      const e = cold ? newEnv(piece, scale) : scale === env.scale ? env : (replayEnvs.get(scale) ?? replayEnvs.set(scale, newEnv(piece, scale)).get(scale)!);
      if (canvas.width !== Math.round(W * scale)) { canvas.width = Math.round(W * scale); canvas.height = Math.round(H * scale); }
      lastEnv = e; const t = performance.now(); piece.draw(ctx, tick, e, stateAt(tick, lg, piece.input)); ctx.getImageData(0, 0, 1, 1); return performance.now() - t;
    },
    // the untouched piece, from restState (built without the reducer): the plain loop
    renderRest: (tick, scale = env.scale) => { const e = scale === env.scale ? env : (replayEnvs.get(scale) ?? replayEnvs.set(scale, newEnv(piece, scale)).get(scale)!); if (canvas.width !== Math.round(W * scale)) { canvas.width = Math.round(W * scale); canvas.height = Math.round(H * scale); } piece.draw(ctx, tick, e, restState(tick, piece.input)); },
    hash,
    renderNow: () => { poll(); const tk = clockTick(); if (started && tk > lastDrawn) draw(tk); },
    samples: () => samples.slice(), envs: () => ({ live: env, last: lastEnv }),
    stats: () => ({ bakeMs: Math.round(bakeMs), sprites: bakeStats.baked, spriteMB: +(bakeStats.bytes / 1048576).toFixed(1), frames: frameTimes.length, p50: +pct(frameTimes, 0.5).toFixed(2), p95: +pct(frameTimes, 0.95).toFixed(2), max: +pct(frameTimes, 1).toFixed(2), scale: env.scale, log: log.length }),
  };
  const replayEnvs = new Map<number, Env>(); let lastEnv: Env | null = null;
  (window.__anidoodle ??= []).push(api);
  return api;
};

// <ani-doodle piece="name" scroll-track="#selector" state="idle" paused>
export const define = (pieces: Record<string, Piece>, tag = "ani-doodle") => {
  if (typeof customElements === "undefined" || customElements.get(tag)) return;
  customElements.define(tag, class extends HTMLElement {
    static observedAttributes = ["state", "paused"];
    controller: Controller | null = null;
    connectedCallback() {
      if (this.controller) return;
      const name = this.getAttribute("piece") ?? Object.keys(pieces)[0], piece = pieces[name];
      if (!piece) { this.textContent = `ani-doodle: no piece "${name}" (have: ${Object.keys(pieces).join(", ")})`; return; }
      if (!this.style.display) this.style.display = "block";
      this.controller = mount(this, piece, { scrollTrack: this.getAttribute("scroll-track"), state: this.getAttribute("state") ?? undefined, pauseControl: !this.hasAttribute("no-pause") });
      if (this.hasAttribute("paused")) this.controller.pause();
    }
    disconnectedCallback() { this.controller?.destroy(); this.controller = null; }
    attributeChangedCallback(n: string, _o: string | null, v: string | null) { if (!this.controller) return; if (n === "state" && v) this.controller.setState(v); if (n === "paused") (v === null ? this.controller.play() : this.controller.pause()); }
    setState(s: string) { this.controller?.setState(s); }
  });
};
