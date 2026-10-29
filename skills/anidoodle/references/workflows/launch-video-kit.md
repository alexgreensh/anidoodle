# The launch kit: build your product's launch film

**Contents:** Start from the template (16 s, one file) · The parts, for a film of your own shape · Worked example

The pieces anidoodle's own launch film is made of, in `engine/src/canvas-core/`, usable for any
product. The rules they serve are in `launch-video.md`.

## Start from the template (16 s, one file)

`launchTemplate.ts` turns data into a film: one to three asks, a type frame between them, and an
end card with your install lines. `launchExample.ts` is a complete one for a made-up product (the
drawn look, chat asks); `launchExampleClean.ts` is the second look on a UI-first product (the
product's own UI in three screens, two of them split beats, 60 fps), and `launchExampleCleanChat.ts`
is the clean look with a chat ask (the hook, an answer card opening as an iris, a word page, then the
product's screen). Copy their shape, not their contents:
the plates, the UI data and the score are the product's own, made for its brief.

```bash
node tools/launch.mjs new myLaunch                 # the spec, every product line marked TODO (--preset clean for UI-first)
node tools/still.mjs myLaunch-9x16 --frames 0,120,330 --sheet out/look-9x16.jpg   # one look per shape, one browser
node tools/launch.mjs ship myLaunch --shapes 16x9,1x1,9x16 --blur auto --gate
```

`ship` renders every shape to `out/myLaunch-<shape>.mp4`, writes its poster (`.poster.png`, the
film's own legible frame) and its captions (`.srt`, `.vtt`), runs `verify-export --delivery` on each
file (size, frames, score, A/V sync at every marker, the true peak after the encode, a legible frame
0), `framecheck.mjs` on every frame (no text, no card, no product window cut by the frame's edge;
text held long enough to read; on 9:16 no text in the phone zones), `facts.mjs` once (every claim
sourced) and, with `--gate`, the gate; one table at the end, exit 1 if any shape fails.

### Design review checklist (every shape, before anything ships)

The gate proves a film is deterministic; it cannot see whether it is well designed. Review the
contact sheet of EVERY shape against this list, and fix, never waive:

- **No clipped type.** Every word a viewer reads is whole on every frame: the typed prompt, the
  bubbles, the labels, the words, the install lines. `framecheck.mjs` (run by `ship`) fails any
  line of text the frame's edge cuts through.
- **Time to read.** Each text up at least `max(0.7 s, 0.3 s per word)`, and never over a busy picture
  without a plate (`craft-bar.md`). `framecheck.mjs` fails a declared cue held too briefly.
- **Phone safe zones on 9:16.** No text in the top 14 %, the bottom 25 % or the right 14 % of the
  frame, where the platforms put their own interface (`formats.md`). `ship` fails the shape for it;
  `--zones warn` only flags it. The template's 9:16 layout already keeps every line inside.
- **Every claim sourced.** The words, the tagline and any extra `claims` in the spec are listed in
  `facts.json` with their source sentence and URL or file (`workflows/facts.md`); `ship` checks it.
- **No edge-cropped content.** A card, a product window, a film's card sits whole in the frame
  with a margin, unless it is a deliberate full-bleed (the whole frame is that one thing). What
  the camera is about to cut fades before it does. `framecheck.mjs` checks the cards and windows.
- **Balanced composition per shape.** The subject owns the frame (a product UI about 70-80 % of a
  16x9 frame's width), a split beat is a real two-column grid with the words sized as the design,
  the end card is one centred group with presence; no big dead areas, nothing huddled in a corner.
- **Coherent example content.** Every ask shows THIS product: its UI, its plates, its words. No
  stock plate or another product's screen inside a film about something else.
- **Judge design, not only collisions**: hierarchy, spacing, whether each frame would pass as a
  poster.

```ts
import { C } from "./launchKit";
import { makeLaunchFilm } from "./launchTemplate";
import { dashboardSketch, onboardingSketch } from "./myProductPlates"; // drawn for YOUR subject
import { myProductScore } from "./myProductScore";                      // composed for YOUR brief
import { myInbox } from "./myProductUI";                                // YOUR product's UI, as data (productUI.ts)

export const myLaunch = makeLaunchFilm({
  title: "Your Product", subtitle: "the one line it lives by",
  asks: [
    { prompt: "sketch my dashboard, as a print", plate: dashboardSketch, label: "print · drawn in code" },
    { kind: "ui", ui: myInbox, prompt: "match every receipt" },            // the product's own UI, before -> after
  ],
  words: [[{ text: "IDEA IN.", style: "ink", color: C.ink }, { text: "ART OUT.", style: "ink", color: C.accent }]],
  tagline: "One sentence that says what it is",
  install: ["npm install your-product", "your-product init"],
  bpm: 96, // the tempo of the score you composed; the brief sets it, there is no default
  askBeats: 6, typeBeats: 4, endBeats: 8, claimBar: 4,
  score: myProductScore, // or null for a silent film
});
```

What you get, from data:

- **Chat asks** (`kind` omitted): the hook: the first prompt is the hero, already being typed at
  frame 0 in a big composer across most of the frame (at least 64 px type on 1x1/4x5/9x16, 56 px on
  16x9, wrapping to 2-3 lines, never clipped; a prompt too long for that is an error), which shrinks
  and docks at the bottom of the chat as Generate is pressed (over a second, or longer when the
  distance would take its fastest point past what the brand's motion temperament allows: a calm
  brand's hook on a phone frame docks over nearly two). Later prompts are typed with the whole
  composer in frame, the camera easing out for the press, an ink drop arcing from Generate
  into the thread and blooming open into a card where the plate draws itself live (the card opens
  on a spring), the thread keeping earlier answers and scrolling, a gentle lean onto each new card that keeps it whole with a margin (what the camera is about
  to cut fades first). The drawn dock keeps the hook's line breaks until it lands (no word jumps a
  line on the move) and re-wraps once, at rest. In the clean look the hook's composer glides down
  whole and IS the dock: it never shrinks, on the move or after it lands, and rests a moment before
  Ask is pressed (on 9x16 it is laid out a little narrower, to dock clear of the phone's right-hand
  zone). The drop flies as one solid streak of the accent, over as many frames as its distance needs
  to stay inside the brand's temperament, the answer card opens as an iris, and the window
  stays whole and opaque while the camera leans in (still moving as a travel takes over), so no
  brand colour is ever see-through.
- **UI asks** (`kind: "ui"`): the product's interface drawn from data (`productUI.ts`) in its
  `before` state; the ask typed into its command bar if it has a `prompt`; the pointer presses its
  `action`; every item springs to its place in the `after` state (matched by `id`: rows move,
  numbers count, bars fill, new items arrive, old ones leave).
- **Film asks** (`kind: "film"`): any film of this engine (a `webTour`, a loop, a plate) in a card.
- **Split feature beats**: a UI or film ask with `split: [lines]` puts its words in their own
  column beside the live UI (above it on a phone), never over it: faster than a full word page.
  The words are sized to their column's width and height (set smaller and rewrapped when they would
  run down over the product); their read, once set and the product has landed, is a declared hold
  (after a travel in, from the moment they are set, through the press, until they sink).
- **Seams**: chat to chat is one thread; a seam between kinds with no word page opens as a bloom.
- **The motif**: an ink drop lifts off Generate (or the product's action, or the film's card) and
  lands as the dot of the end card's mark ("NAME."); the end card blooms open FROM it and stays.
  The last split beat's words finish sinking halfway through its flight, gone before it lands.
- **Sound from the picture** (`launchSound.ts`): a key per character typed (the space bar its
  own), the press on the frame Generate goes down, the drop and its bloom, each card landing on its
  spring's first arrival, each UI item's landing; every cue panned to where it happens on screen;
  one riser and one impact at the reveal and nothing on any other cut. A cue measured under the
  score is raised until heard (at most +8 dB), then the mix is checked and a buried cue throws.
  `film.cues` lists them; `meta.sync` names the presses and the impact for verify-export.
- **Captions**: `meta.captions` from the prompts, the word pages, the split words and the end card;
  `launch.mjs ship` or `captions.mjs` writes `.srt`/`.vtt`; `captions: "burn"` also draws them
  in their own band under the picture on the phone shapes (the picture is composed above it).
- The corner mark (your name) steps aside before any lean. Real holds are declared, so the gate
  passes.

Sync wins over length: the score plays at the film's bpm exactly, so every cut sits on its
downbeats, and the film is made whole bars of the score (`gridScore`: the stretch section
repeated or dropped, then the end-card hold, which is a hold, grows or shrinks to the bar; the
tail rings out in whole bars). A score in 4/4 with no pickup, starting on frame 0. If no form
fits, the build throws: compose a 1-bar stretch section or change askBeats/endBeats. Render
refuses a beat-grid film whose score is more than 0.5 % off its bpm. The bed is set to -14 LUFS
with the true peak at or under -1 dBTP (`musicBed`); a dynamic piece stops at the peak ceiling
first and render says how far short; `limit: true` lets a look-ahead limiter take those peaks.

**The plates, the UI and the score are made for this product, every time.** A style is a recipe
applied to the user's subject (`references/styles.md`): draw their dashboard, their mascot, their
product's world in the chosen hand, as a still plus its `*Draw` film; a UI ask's data comes from
the product's real screens and states. anidoodle's own plates (the lighthouse and fox in
`launchExample.ts`) and the web tour are placeholders, never a user's film. The score is composed
for the brief's style, mood and length (`references/music/compose.md`); `score` is required
(`null` means silent), `bpm` has no default, and the template refuses anidoodle's own pieces, by
identity, by title and by content (the same novelty gate `music.mjs check` runs).

### One timeline, four shapes

`shape: "16x9" | "1x1" | "4x5" | "9x16"` (or `film.reshape(shape)`, or the film name
`myLaunch-9x16` in any tool) composes the same cut for another frame through `launchLayout.ts`:
the chat window, composer and card are laid out for the frame (a phone composer wraps the prompt
and the camera keeps the whole composer in frame), word pages re-set their lines, the split beat
stacks, the end card stacks and centres. The timing, the cut and the sound do not change.
Every line a viewer must read is phone-safe on 1x1, 4x5 and 9x16: at least 32 px at 1080 across
(about 11 pt on a phone) for prompts, bubbles, card labels, tagline and install lines, 64 px for a
word page; the layout throws with the fix when one cannot be (an install line too long for 9x16).

### Looks: the film wears the product's own look

A look is a base grammar plus the product's own tokens. `look.base` picks the grammar; every other
field dresses it, and any field left out keeps the base's value. `preset: "clean"` is shorthand for
`look: { base: "clean" }` (a preset and a base that disagree are an error). With no look the film
draws exactly what it drew before (launch, launch2 and launch3 render byte-identical).

The two bases:
- `drawn` (default): ink blooms, hand-lettered words (`writeOn`), a warm paper palette.
- `clean`: a quiet canvas, ONE accent (the button, the drop, the dot, the caret), type as the design:
  word pages SET in the display face (`setType`), round iris seams, the answer card opening as an
  iris. It takes every kind of ask: chat asks (the hook's composer glides down whole and IS the dock;
  give the answer plate a ground other than the card's, or the iris opens unseen), product screens and
  films. `registerLook(name, { clean, palette })` adds a base of your own.

| Field | What it sets | Notes |
|---|---|---|
| `look.base` | the grammar: `"drawn"`, `"clean"`, or a registered look | `preset` is its shorthand |
| `look.palette` | any of `bg card ink soft mute line chip accent accentDeep paper` | merged over the base; checked for contrast (below) |
| `look.fonts` | `{ display, text, mono }`, each `{ family, file }` | `file` is a local `.ttf` imported into the film (`import f from "../../assets/fonts/X.ttf"`); registered before the first frame, no network; every measure, wrap and reading-time path uses its own glyph advances. A missing file or an `.otf`/`.woff2` is a clear error (convert to `.ttf`) |
| `look.shape` | `radius`, `bubble` (`rounded` `square` `none`), `composer` (`box` `bar`), `button` (`pill` `square`), `buttonLabel` | the radius caps every corner, the chat's and the product UI's alike |
| `look.chat` | `header` on/off, `title`, `subtitle`, `logo` (a brand element, drawn with brandKit `drawEl`), `bubble` and `reply` `{ fill, ink }` | a logo also opens the clean end card, before the name, on its baseline |
| `look.from` | a brand file from `node tools/brand.mjs import` | fills the palette (its saturated colour the accent; a dark-first file the ground and ink) and the logo; explicit fields win |

The product's own screen is a `kind: "ui"` ask (`productUI.ts`): it takes the look's face, label colour
and shape too. READABILITY: a custom palette is checked pair by pair (WCAG AA: 4.5:1 for body text,
3:1 for large type and the button's label), only on pairs that touch a token you changed, and the build
fails naming the token and both colours. On a dark ground the pointer turns light. `launchExampleBrand.ts`
is the worked example: an invented brand, dark ground, a serif display face, square shapes, its own logo,
a chat ask and a product ask; `node tools/launch.mjs new` scaffolds a commented `look` block.
With two or more install lines, use `endCard: "grid"`: the stacked card is then five blocks centred
on one axis, which framecheck fails as a centred stack.

### Frame rate and motion blur

`fps: 60` doubles the frames on the same timing (a UI-heavy film's scrolls and springs read
smoother); the cues, holds, captions and sync markers follow. `render.mjs --blur auto` takes as
many subframes as each frame's measured on-screen speed needs (1 on a still frame), `--shutter 180`.

| Spec field | Meaning |
|---|---|
| `title`, `subtitle`, `placeholder`, `genLabel`, `accent` | the chat's name, subline, empty text, button word, button (and the clean look's one accent) colour |
| `asks[]` | 1-3 of `{ prompt, plate, label, from?, to?, crop? }` (chat), `{ kind: "ui", ui, prompt?, split? }`, `{ kind: "film", film, from?, to?, split? }` |
| `words[i]` | the type frame after `asks[i]` (not after the last ask; it flows into the end card) |
| `tagline`, `install[]`, `footer` | the end card; install lines are shown exactly as given |
| `bpm` (required), `fps` (30 or 60), `askBeats`, `typeBeats`, `endBeats` | the beat grid (a beat is 60 x 30 / bpm frames at 30 fps) and each part's length in beats |
| `claims` | extra on-screen or narrated claims for `facts.json`; the words, split words and tagline are claims already |
| `claimBar` | land the end card on this bar's downbeat, counting from bar 0 (`claimBar: 4` = frame 4 x bar); throws if it cannot. A longer last ask is really longer, never slowed |
| `score` (required) or `audio` | the score composed for this product (the `Material` function compose.md writes, or a `Piece`), as a bed; `null` for silence; or your own finished mix (not checked; it replaces the cues too) |
| `shape`, `preset`, `sfx`, `motif`, `captions` | the frame (16x9 default); the look (drawn, clean); sound cues (default on; `launch.mjs new` writes `sfx: false` beside `score: null`, since cues alone are clicks on silence that soundcheck fails: turn them on with the score); the relay into the end card (default on); `"sidecar"` (default) or `"burn"` |

The template refuses a feature list (more than 3 asks) and an end card too short to read.

## The parts, for a film of your own shape

**`launchKit.ts`**: timing and UI.
- Easing: `ramp`, `inOut`, `out3`, `in3`, `expo`, a closed-form `spring`, `press` (a button
  press that dips and springs back). Camera: `Cam`, `camLerp` (zoom travels in log space),
  `useCam`, `toScreen`. For longer camera work use `references/camera.md`.
- `plateLayer(env, key, film, frame, px)`: draw ANY film of this engine into an offscreen layer
  at any frame. This is composition without recordings: every plate in a launch film is the real
  plate drawn live by its own code. `selfLayer` is a scratch surface for a scene inside a scene.
- The chat: `drawChatFrame(ctx, state)` (window, composer, Generate; `title`, `subtitle`,
  `genLabel`, `accent` are yours), `charTimes`/`typedAt` (human typing), `caretAt`, `pointer`,
  `inkDrop` (the drop from the button to the card), `inkCard` (the answer card that blooms
  open), `artCard`, `softShadow`, `rr`.
- The ink: `blot(c, R, seed)` and `pathOf`, a seeded wobbling rim for blooms and drops.

**`kinetic.ts`**: lettering that is written, never set.
- `writeOn(ctx, env, text, x, y, size, p, style, opts)`: a line written stroke by stroke by a
  visible tool, in `ink`, `crayon`, `thread`, `chalk`, `brick` or `marker`. `measure` sizes it.
- `setType(ctx, env, text, x, y, size, p, opts)`: a line SET in a heavy sans, each word rising
  into place behind its baseline: the clean look's type. `setWidth` measures it. `{ out }` sinks it out
  last word first on an ease-in over 1.3x its size (no slivers at the clip edge); `{ space: "world" }`
  draws it inside a camera or a region (`motion-film.md`).
- `sentence` (one medium per word, one word per beat), `caption` (a small callout with an
  underline or arrow), `logo`/`logoCentred` and `logoBug` (anidoodle's own wordmark and corner
  mark; for your product, write your name with `writeOn` as the template does).

**`launchLayout.ts`**: `launchLayout(shape, content)` gives a shape's whole composition (the
chat geometry, the thread, the camera's rests, the word pages, the split columns, the end card,
the caption band) and the size of every text role, checked against the phone-safe minimums
(`MIN_PX`). `drawChatFrame`, `caretAt`, `inkDrop` and `inkCard` take its `chat` geometry;
`chatGeom(rect, k, px, promptPx, lines)` is the same chat component at any size.

**`productUI.ts`**: `drawProductUI(ctx, rect, ui, { f, t0 }, theme, { minPx })` draws a
product's interface from data in its before state and springs every item to its after state
from `t0`; the window fits its content. `uiSettles` gives each item's landing frame and
`springLand(t0, omega, zeta)` the frame any spring first reaches its target (where its sound goes).

**`motif.ts`**: `relay(keys)` is one object's continuous path across a seam (cut frames),
`seamGap` and `checkRelay` measure it on both sides of a match cut and throw past 2 px.

**`launchSound.ts`**: `mixLaunch`/`launchAudio` place cues from the sfx kit (`music/sfx`),
pan each by its screen x (`panOf`), duck the score, raise a buried cue until it is heard, and
hold the mix under -1 dBTP.

**`launchCut.ts`**: the cut as data.
- `pic(from, to, len)` plays a span of your content timeline over `len` frames; `type(lines,
  len, before, after)` is a word page. `makeCut(segs)` gives `N`, `at(F)`, `contentOf`, `cutOf`
  (map content-frame sound events onto the cut).
- `beatGrid(bpm, fps)`: `beat`, `bar`, `frameOf(bar, beat)`, and `solve(bar, fixed)`, the frames
  left for one flexible segment so the claim lands on a bar (launch3 lands on bar 26).
- `bloomFrame` (a page inside an ink bloom; `close: false` keeps it open for an end card;
  `center` opens it from a point, the motif; `shape: "circle"` is the clean look's iris),
  `typeFrame` (one to three lines written on it; `lead`, `stagger`), `bloomRadius` (for holds).

**`launchGallery.ts`**: `drawWall` and `wallCam`, a rolling wall of style cards where the
focus card GROWS toward the viewer instead of the camera zooming. The proof-of-range beat.

**`webTour.ts`**: a website drawn in code and toured: the whole page first, then the camera
zooms to each click, with the pointer and input log driving the page's own state.

## Worked example

`launch2.ts` is anidoodle's content timeline (chat, koi with its code streaming, the wall, the
brick balloon, the almond hand (Van Gogh's public-domain *Almond Blossom* as the attached
reference, `engine/assets/refs/` with its `PROVENANCE.json`; `adapt-a-style.md`), the embroidery
loop, the web tour, the butterfly film, the end card); `launch3.ts` is the cut: data segments
spliced with type frames, 77 s on the score's 29 bars. They are anidoodle's own film, so a plain
scaffold leaves them out; `scaffold.mjs <dir> --example` brings them in (with the butterfly they
are built on) to study. Study them for pacing, then build yours on
the template with your own pictures and your own music; anidoodle's launch is one example of the
grammar, not a skin to reuse.
`launch.ts`, `launch2.ts` and `launch3.ts` are frozen reference builds of that published film, made before the 0.10 checks (their declarations say so, `FROZEN` in `launchKit.ts`): never templates; start from `launch.mjs new`, whose examples pass `ship.mjs`.
