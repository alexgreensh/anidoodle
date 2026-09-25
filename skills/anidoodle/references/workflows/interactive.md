# Interactive web animation

Hand-drawn pieces that live on a web page and answer the person using it. They follow the pointer,
react to hovered and focused buttons, draw themselves as you scroll, and read along with a form.
None of this is a video or an embedded player: the piece is part of the page's UI.

Three worked demos. Each is one self-contained HTML file that opens offline:

| Demo (piece) | What it does |
|---|---|
| **Landing mascot** (`mascotHero`) | Bit watches your pointer anywhere on the page, eyes first and head a beat later. Hover or Tab to a button and he turns, presents it with his near arm, raises his brows and brightens his bulb. Press: a crouch. Click "Get started": he jumps and cheers, with pencil twinkles. "Take the tour" gets a wave, and poking him makes him giggle. |
| **Scroll-drawn hero** (`scrollHero`) | The storybook plate draws itself as you scroll: construction ovals, a head-first pencil sketch, washes spreading from where the brush lands, then the final line, with a pencil or brush at the nib throughout. Scroll back and it un-draws. The last frame is the plate itself, pixel for pixel. |
| **Form mascot** (`formMascot`) | He reads your caret, nodding at each keystroke, and shuts his eyes with hands up for the password. Press "Show" and he is caught peeking. A bad submit gets a worried head-shake. "Busy" whirs his key, and success is the cheer. |

All three use the storybook plate's hand (pencil + watercolour). Bit is drawn by the plate's own
code (`drawBit`, `limb`, `hand`), unchanged.

## The contract: a frame is a fact, given its input log

```
draw(ctx, tick, env, stateAt(tick, log, piece.input))
```

Nothing else in the contract moves. The art stays pure: a `Piece` never sees a clock, an event or the
DOM. It gets a 60 Hz tick and an `InputState`, and paints the whole frame. The host
(`hosts/interactive.ts`) owns time and the DOM, and turns the person into an append-only `InputLog`.
`stateAt` (`canvas-core/input.ts`) is a pure fold of that log, checkpointed every 60 ticks. The same
log replayed in any page, in any order, cold or warm, draws the same pixels, and `tools/replay.mjs`
proves it for every emitted page.

| Question | Answer |
|---|---|
| Two events in one tick? | They apply in log order. Ticks never decrease; the reducer throws if they do. |
| Can a drawn frame change later? | No. An event is stamped after every tick already drawn: `max(lastDrawn + 1, clock)`. |
| Initial configuration? | It is in the log at tick 0, before anything is drawn: target rectangles, scroll, reduced motion, state and device scale. |
| Resize, DPR? | Log coordinates are in the piece's logical space, so a resize logs new `rect`s and a `view` (the device scale), and changes no state. The host re-bakes at the new scale in the background and swaps on a frame boundary. |
| Interrupted motion? | Springs are critically damped and closed form. A target is a pure function of the discrete state, which only changes at events. Position and velocity carry across an interruption into a new exact segment. |
| One-shot reactions? | Fixed-length clips restarted by each trigger (`clip(s, "click:start", 72)`), with randomness seeded from the log (`reactionSeed`). |
| Keyboard? | Keyboard focus counts as hover (`attention` is the more recent of the two), and Enter or Space is a click. Every hover reaction has a focus equivalent. |
| Touch? | A tap logs its position. A lifted finger logs `exit` and `leave`, so nothing stays hovered. |
| Typing? | Only the length and caret position are logged, never the text. A log holds no personal data. |
| Reduced motion? | It is in the log. The untouched piece is still, reactions are short expression crossfades, and a scroll piece shows its finished picture. |

## Making one

1. **The piece**, in `engine/src/canvas-core/<name>.ts`:
   ```ts
   export const myPiece: Piece = {
     meta: { title, W: 560, H: 560, loop: 480, alt: "what a screen reader hears" },
     input: { springs: {
       look: { omega: 0.3, target: (d) => lookTarget(d, FACE) },               // eyes, quick
       arm:  { omega: 0.16, target: (d) => (attentionOf(d) === "cta" ? 0.5 : 0) },
     } },
     bake: function* (env) { usePaper(env, SHEETS); yield; bg(env); yield* bakeBit(env); },
     draw: (ctx, tick, env, s) => { /* sprites + a few live marks */ },
   };
   ```
   `InputState` gives the art `pointer`, `hover`, `focus`, `attention`, `pressed`, `scroll`, `state`,
   `rects`, `fields`, `since`, `count`, `spring`, `vel` and `reduced`. The helpers are `gaze`, `lean`,
   `parallax`, `lookTarget`, `clip`, `ticksSince`, `reactionSeed`, `scrollSpan` and `ease`.
   Untouched, the piece must loop (`meta.loop`) with no dead second.
2. **The web profile** (`bake.ts`). A plate draws a character in about 130 ms at DPR 2; a page has
   6 ms. Draw once at mount, then composite each frame.
   - `bake` crops exactly what the drawing touched into a sprite.
   - `bakePart` runs chosen groups of a plate's own drawing function.
   - `usePaper` multiplies the sheet into every sprite once (multiply distributes over source-over), so frames need no sheet pass.
   - `blit` on whole device pixels stays crisp.
   - Rotate at most one composed layer per frame: a rotated blit costs about 8x an axis-aligned one on a software canvas.
   - Never enlarge a bitmap.
   - The scroll hero shows the other pattern: the plate recorded as a mark log, four stage images, and strokes as masks.
3. **The page.** Mark UI with `data-anidoodle="<name>"`, add `<ani-doodle piece="<kebab-name>">`
   (plus `scroll-track="#selector"` for scroll pieces), and put `<!--anidoodle-->` where the module
   goes. UI states: `document.querySelector("ani-doodle").setState("success")`.
4. **Emit, gate, record:**
   ```bash
   node tools/emit-interactive.mjs myPiece --page page.html --out out/my-piece.html   # also writes out/my-piece.mjs
   node tools/replay.mjs out/my-piece.html --out out/my-piece.replay.json
   node tools/record-interactive.mjs out/my-piece.html choreo.mjs --out out/my-piece.mp4
   ```
   The `.mjs` is the module a real site loads, via `<script type="module" src>` or `import { mount, piece }`.
   The `.html` inlines it, because browsers refuse module imports from `file://`.

`mount(el, piece, opts)` returns `setState`, `pause`, `play` and `destroy`. There is no framework.
The host provides:
- a visible pause button;
- `role="img"` with the piece's `alt`;
- a fade-in once baked;
- no drawing offscreen or in hidden tabs (the clock keeps time);
- no sound.

## What the replay gate proves

1. A scripted person drives the page in real time at DPR 2: sweeps, hover on every target, rapid
   in/out reversals, press, click, cancel, Tab and Enter, typing, a resize **while hovering**, the
   wheel to the bottom and back, and state changes. Every third drawn frame is hashed live.
2. The same on a touch phone (taps, a swipe).
3. A fresh page gets only the log and redraws every sampled tick in reverse, then forward, then cold
   (brand-new env, every sprite re-baked). All three must hash exactly as live.
4. An empty log equals `restState` (built without the reducer); the live tick-0 configuration changes
   nothing; the loop closes; and the untouched piece moves.
5. Reduced motion: still when idle, and a full session renders.
6. Frame time at DPR 2 (with raster forced, and default), startup, sprite memory, and bundle size.

Hashing needs one renderer: Chromium silently moves a GPU canvas to software after its first
readback, so hashed pages run with `window.__ANI_RASTER__ = "cpu"` from the start.

**Two traps the gate caught, both platform behaviour and not bugs in the art:**

- **A canvas remembers gradients.** In Chromium, a 2D canvas that has *ever* filled with a gradient
  (radial or linear, e.g. `Gfx.glow` or `Gfx.vignette`) rasterises later drawing differently, by up
  to 8/255. This holds even after its pixels are cleared and its `fillStyle` is reset. Solid fills
  and patterns do not do this. Because the Gfx layer pool and the bake scratch are shared, a sprite
  came out differently depending on which sprites were baked before it: cold != warm. `bake()` now
  calls `ctx.reset()` on every shared surface first (and drops the pool where `reset` is missing).
  The film engine shares the same pool across frames, so the same order-dependence may exist there.
  It is a lead for the determinism doctrine's unexplained first-run 0/12, not yet a proven cause.
- **GPU to software on readback**, above. Hash only canvases that were software from the start.

## Measured (headless Chromium 1140, this Mac, 1280x800 at DPR 2, September 2026)

| Demo | Gate | Frame p95 (raster forced / default) | Ready | Sprites | Module |
|---|---|---|---|---|---|
| Landing mascot | 22/22 | 4.1 ms / 0.3 ms (2.8 on an earlier run) | 1.9 s | 152, 35 MB at scale 1.5 | 50 KB (20 KB gzip) |
| Form mascot | 22/22 | 3.5 ms / 0.3 ms (2.2 on an earlier run) | 2.0 s | 152, 31 MB at scale 1.25 | 51 KB (20 KB gzip) |
| Scroll hero | 22/22 | 1.8 ms / 0.4 ms | 2.0 s | 4 stages + one patch per stroke, 34 MB at 1.25, 58 MB at 2 | 48 KB (19 KB gzip) |

The budget was 6 ms p95 at DPR 2. The first build measured 7.8 ms, because the head rotated ten face
sprites a frame and the paper multiplied the full canvas every frame. Composing the head once and
baking the paper into the sprites brought it to 2-4 ms (it varies by run on a shared machine). Single frames reach 10-22 ms when a
reaction first needs a cel, or during a rescale swap.

## Limits

- **Frame time is measured on headless Chromium's software canvas**, which is the honest upper bound
  on this machine. A GPU-composited page draws the same frame for well under 1 ms of JS. Measured on
  no real phone.
- **Sprite memory is the price of speed.** It is tens of MB at scale 2, and the scroll hero is the
  heaviest (one patch per stroke). Budget it on low-memory phones, or cap `maxScale`.
- **Startup.** Baking takes about 2 s before the canvas fades in (software raster, DPR 2); the page is usable meanwhile. It happens again on a resize that changes the scale (debounced and off the visible frame, but it doubles memory while both scales exist).
- **Moving parts carry their paper grain** (`usePaper`): exact at rest, a few percent of tone off in
  motion.
- **Continuous poses are quantised**, as hand-drawn animation is: arm lift in 16 cels and the key in
  8 phases. Only the head rotates, as one layer.
- **Logs grow** with pointer movement (coalesced to one move per tick). Hours-long sessions are not
  compacted.
- **Chromium only, verified.** Other browsers are expected to be deterministic within themselves, not
  bit-identical to Chromium. `ctx.reset()` is needed for the order-independence fix; without it the
  pool is dropped instead.
- **The plates were not drawn for this.** Bit's expressions (brows, mouths, lids) are new marks in the
  plate's pen, not the plate's. A new character needs its own parts list.
