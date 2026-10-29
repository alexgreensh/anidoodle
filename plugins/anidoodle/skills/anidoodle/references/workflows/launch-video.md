# Launch and product videos

**Contents:** Inputs the person brings · Ground it in the real product first · Made for this product, every frame and every note · The story · Type · Motion · The motif · Two registers · Brand and the end card · Sound · Delivery · The process

A launch video makes one promise about a product and shows it being kept. It is a short film
with a job: in the first seconds the viewer knows what the thing is, by the end they know where
to get it. Every rule below was paid for on anidoodle's own 77 s launch film (four cuts) and
checked against published launch-video craft. The reusable pieces are in `launch-video-kit.md`;
a template film renders a 16 s launch for any product from data.

## Inputs the person brings

Product screenshots, a logo, UI captures, a repo link, a feature list, the exact install or
sign-up line. Images they bring may be embedded (pinned by sha256, provenance in the manifest);
everything around them is drawn in code. Never generate or fetch images on your own. One exception
the person opts into: a photo they supplied may be restored or cut out by an image model they choose,
shown beside the original on the film's background before use, with the original kept and the
model recorded in the manifest (`brand-film.md`, people). A film in someone else's brand starts with
`brand-film.md`: the brand's exact elements, logos and motion are imported and signed off first.

## Ground it in the real product first

Before any storyboarding, write a short sourced brief and get ONE approval on it. A launch film
that invents its subject draws a mascot of a product, not the product.

1. **Read the real thing.** The screenshots and captures they brought, the repo's README and UI
   components, the live page. Note the two or three REAL features a viewer should recognise on
   screen, the exact product name and mark, the brand colours as hex.
2. **Collect approved claims.** The one-line promise and any numbers come from their own
   materials (site copy, release notes, README), each with its source next to it, in `facts.json`
   (`facts.md`; `launch.mjs new` scaffolds it). Anything you
   cannot source becomes a question, not a line in the film. List the claims the film must NOT make.
3. **Ask the grounding questions**, one message: which features to show (recommend your three),
   which shapes to ship, where it will run, the exact CTA lines.
4. **Write the brief** where the film's files live: product and promise, features with sources,
   brand colours mapped onto palette roles, approved and banned claims, shapes, platforms. The
   storyboard and every word on screen quote the brief, never memory.

## Made for this product, every frame and every note

The film's pictures are drawn for this product's subject in the style recipe the brief picked
(`references/styles.md`); its score is composed for this brief. anidoodle's own plates and
pieces are examples of the craft, never material for someone else's film.

## The story

- **One sentence the film proves**, written before anything else. anidoodle's: "you can create
  images, illustrations, loops, animations and films in pure code." Every beat serves it. A row
  of features is a spec sheet, not a story.
- **Told from the user's point of view**: they type, press the button, the result appears. The
  viewer should picture themselves doing it.
- **Say what it is in the first five seconds** (anidoodle: "no image model, just code" by 10 s at
  the latest). The hook lands inside 2-3 s and reads with the sound OFF: feeds autoplay muted.
- **Arc**: hook, one core interaction, a fast proof of range (a wall, never a slow tour), the
  brand moment, the call. A visual payoff every 3-5 s; no dead waits.
- **No footnotes, no eyebrow text, no terminal jargon on screen** unless the product is one.
- **A board row is an action, never a fact**, and names what it carries in from the row before; the
  brand arrives as the answer, built from the thing that just acted; one message line beside the
  story sentence; a promise that says what the viewer does and leaves with; one landing at the end.
  The why is `../storytelling.md` ("Launch, brand and event films", "Comedy"); `board.mjs` checks it.

## Type

- **Words get their own space by default.** A word gets its own full frame: an ink bloom
  opens, a brush writes the word, the bloom closes on the next scene (`typeFrame`). Or, for a
  feature beat, its own COLUMN: words on the left, the live UI on the right (words above, UI
  below on a phone), each in its own area of the layout (`split`), faster than a full word page.
  Corner marks step aside when the camera brings UI under them, and sit in their own strip on a
  phone frame.
- **Type over the picture is a judgement, and the answer is usually still no.** It earns its
  place only when all of these hold: the picture under the word is calm there (flat or quiet,
  and not moving through the letters); the word belongs to the scene (a label on the thing it
  names, a callout, a kinetic line composed with the picture, not a caption dropped on top);
  the frame would pass as a poster; and it reads with the sound off. Never over a face, a
  product's UI, the detail the shot is about, or busy texture. Check it in a review still at
  the smallest delivery size. In doubt, the word gets its own frame.
- **3-7 words a frame, few frames.** Collapse word cards into one claim then proof ("JUST CODE."
  then "32 STYLES"); fewer cards leave more time for the proof.
- **Hold each settled word 0.5 s or more**, longer for the claim.
- **Text meant as texture looks unreadable** ("blah blah", greeked lines). Real sentences that are
  up too briefly make viewers try, and fail, to read them.
- **Judge DESIGN in review stills, not only collisions**: hierarchy, spacing, whether the frame
  would pass as a poster. A frame with nothing overlapping can still be ugly.

## Motion

- **One world, one camera, by default.** Start with `worldfilm.mjs` and build on `world.ts`: every beat
  a region of one canvas, every seam a camera move. Built scene by scene, a film plays as slides however
  well each scene moves. `motionscan` and `layerscan` hold it (`motion-film.md`).
- **A gentle move is the default transition**: bloom, card flip, push, the card GROWS into the
  frame. Ease in and out; the camera is `references/camera.md`.
- **A hard cut is a judgement.** It works when it is matched: the same shape, position or
  direction of travel on both sides, or a cut on a strong beat in a piece whose energy asks for
  it. A cut with nothing carried across it, and any sharp swoosh, still reads as a slideshow.
- **A designed seam is a judgement too.** Six ways to make the next picture come out of the
  current one, each with when it fits and when it does not: `references/motion-grammar.md`.
  Use one where its conditions clearly hold; otherwise the gentle move.
- **Drawings play 3-6x faster than real time**; a loop is held long enough to see it loop.
- **Alive means real motion**: the koi swims through a scrolling world, not an in-place GIF
  (`start-here.md`, "Alive means real motion").
- **Chat is a real thread**: the request appears BEFORE its result, earlier answers stay, the
  thread scrolls, a follow-up animates in the existing card instead of popping a new one.
- **Web**: show the whole site first, then zoom to each click; the site's copy describes what
  the viewer is seeing.
- **A product that is not a chat shows its own UI**, drawn from its real data in two states: the
  before (the problem), one press of its action, every item springing to the after. Never a
  screenshot slideshow (`productUI.ts`, a `kind: "ui"` ask).

## The motif

**Pick ONE object the story already owns and carry it across the seams**: anidoodle's template
carries the ink drop that every press of Generate sends into the thread; at the end it lifts off
Generate one last time and lands as the dot of the end card's mark ("NAME."), and the end card
blooms open FROM it. The rule for any seam you design as a match cut: on the last frame of the
outgoing shot and the first of the incoming one the object has the same screen position and size
(within 2 px), and the incoming scene opens from it. `motif.ts` (`relay`, `checkRelay`) checks it;
a seam that jumps throws. Use it for the seams that matter (the reveal), never on every cut.
- Banned defaults: a centred title on a gradient, everything fading in, bouncy easing, particle
  bursts, glow on UI chrome, dead time, text scaled into blur.

## Two registers

The **drawn** register (default): ink blooms, hand-lettered words, a warm paper palette, the
product drawn in the chosen style. The **clean** register (`preset: "clean"`) for a UI-first
product: a quiet canvas, ONE accent colour, type as the design (set, not written; each word rises
into place), round iris seams, the product's own UI. Pick one per film; never mix them.

## Brand and the end card

- **The logo recurs**: a small corner mark on every frame (`logoBug`), not once at the start.
- **One landing.** The last thing on screen is the card or the stinger, never card, stinger, card.
- **Event programs** show every speaker as name, role and company logo (from the live site, dated),
  no talk titles and no mystery speakers; the panel's title once. Hosts and sponsors are in the brief.
- **Logos of other companies** are copied from where they are rendered in production, sized to equal
  visual weight, never "fixed" (`brand-film.md`, logos).
- **The end card is composed for the frame**: the name, one line, the exact install lines in a
  panel, held **3 s or more** so a viewer can screenshot them. For an event or campaign, build it on
  `endCard.ts` (`endCardLayout`, `drawEndCard`): one card, one frame, an asymmetric grid with the
  lockup top-left, the event lines under it, the call as a stamp on the right on the venue's baseline,
  a hairline, then a sponsor band (label 38 px, weight 800 at 1080; each sponsor switchable), in every
  shape. Never a centred stack of five or more items, never extra slides for what did not fit.
- **People** (speakers, hosts) are placed by head height with crowns level (`people.ts` `drawPerson`);
  `popOut` puts a person on a disc with the head free above it. anidoodle's are both lines:
  `/plugin marketplace add alexgreensh/anidoodle` and
  `/plugin install anidoodle@alexgreensh-anidoodle`. One primary call; the link smaller below.

## Sound

- **Music first, heard as an mp3 by a human** before it scores anything (you cannot hear it).
  Compose it for THIS brand: pick the style and a mood per section from the brief (energy,
  audience, where it runs), then write the notes (`references/music/compose.md`). anidoodle's own
  launch chose chill lo-fi electronic, one example (`references/music/styles/lofi-electronic.md`);
  never reuse our score or a stock piece. When the person asks for a generated or licensed track,
  it takes its own route (`references/music/generated-tracks.md`): pinned and costed, cut by whole
  bars, effects unpitched, the music never ending before the picture.
- **Effects and a 10 s mix sample are heard first**, on a listening page (`track.mjs listen`), before
  the full mix. You cannot hear; the person can.
- **Balance by stem RMS, not only LUFS**: an integrated -14 LUFS hid a sub 7-10 dB too hot.
- **Cut on downbeats, not every beat.** Land the claim on a chord (launch3's lands on bar 26,
  the home chord); `beatGrid().solve()` fits a flexible segment so it does.
- **Sound effects come from the picture's own math**, never laid on by hand: a key per typed
  character, the press on the frame the button goes down, the drop and its bloom, a card landing
  on its spring's first arrival, each panned to where it happens on screen (`launchSound.ts`).
  Every cue must be heard over the score (the template raises a buried one, then checks).
- **Transition sounds only on real direction changes**: one riser into the big reveal, one
  impact on it, never a whoosh on every cut, nothing on a word page (`references/music/sound-design.md`).
- **Master to -14 LUFS integrated, true peak -1 dBTP or lower**, then listen on a phone speaker.

## Delivery

- **Length**: about 60 s for a launch post (LinkedIn, YouTube, the README); 15-45 s for X; cut
  a platform version rather than pushing one master everywhere. Set `length.target` and
  `length.max` in the brief before the board (`board.mjs` fails a board over the max), and the same
  numbers in the film's `meta.checks.length` (ship fails a cut over the max and prints the reading
  floor: how short the film can get without cutting into reading time). Cut whole
  beats, and only from non-reading holds; never speed the film up to hit a length (it reads rushed).
  Slowing everything for reading through one master pace map is fine, if the key hits are re-solved
  onto their downbeats afterwards.
- **Shapes**: `16x9` for YouTube and the site, `1x1` or `4x5` for feeds, `9x16` for Reels and
  Shorts. Re-compose per shape from one timeline; never crop a wide render. The template does it
  through `launchLayout.ts` (`launch.mjs ship <film> --shapes 16x9,1x1,9x16`), with phone-safe type:
  every line a viewer reads at least 32 px at 1080 across on the phone shapes, and on 9x16 inside the
  platforms' safe zones (`formats.md`).
- **Captions**: feeds autoplay muted. Ship `.srt`/`.vtt` for players that take a sidecar (YouTube,
  LinkedIn, the site); burn them into their OWN band under the picture for feeds that do not
  (`captions: "burn"`), never over the art; on 9x16 the band sits at the bottom of the safe zones.
- **Sync and peak are checked on the file you ship**, not the master: the sound at every sync
  marker within 1 ms of the mix, the true peak at or under -1 dBTP after the AAC encode
  (`verify-export --delivery`).
- **A UI-heavy film may run at 60 fps** (`fps: 60`); render with `--blur auto` so fast moves blur
  by their real speed and still frames stay sharp.
- **The first frame is the thumbnail.** Platforms and players show frame 1 before play. Make
  it legible and on brand (anidoodle's is the wall of styles; the template's is the prompt, big,
  mid-sentence); never a blank, a fade from black, or a whole chat window too small to read.
  If the story opens quiet, render with `--poster-frame N` (frame 0 shows frame N and dissolves
  into the opening by frame 6), and ship only what passes `verify-export --delivery`.

## The process

1. **Story sentence** and the sourced brief (a brand film: `brand-film.md` steps 0 to 5 first). ✋ One approval.
2. **Storyboard**: one row per beat with its length, the action, what it carries in, the words, the
   transition, as `board.json`; `node tools/board.mjs board.json` must pass. The person sees it as a
   page of drawn stills with timing, never text only.
3. **Options sheet**: transitions and type styles side by side as one cheap still sheet (e.g.
   three blooms, three lettering media). The person picks; nothing is rendered in full yet.
4. **One still per scene**, at 0.3-0.5 scale on a contact sheet, reviewed for design:
   `still.mjs <film> --frames 0,240,610 --sheet out/scenes.jpg` draws them all in one browser
   (`references/working-method.md`).
5. **Music as an mp3 on a page**, heard by a human. ✋ Approval.
6. **Cut as data**: content scenes on one timeline, the cut as `pic`/`type` segments on the
   beat grid (`launchCut.ts`). Re-timing edits the list, never scene code.
7. **Review from the render, by a fresh critic** (`review.md`, three rounds at most): contact
   sheets, cuts as before/after pairs, DESIGN first (type over art, spacing, hierarchy), then timing. Render only the changed range
   (`render.mjs --from F --to T` writes `out/<film>.<F>-<T>.mp4`, silent). Give notes in camera words ("slow this zoom to 0.7x",
   "hold the word 10 frames longer"), never "make it better".
8. **Ship before showing**: `node tools/ship.mjs <film> --file out/<file>.mp4` on the exact file you
   will send, for every version, its table attached (`review.md`). For template films, also:
   **QA**: review every shape's contact sheet against the design checklist in
   `launch-video-kit.md` (no clipped type, no edge-cropped content, balanced per shape, coherent
   content). `launch.mjs ship <film> --shapes ... --gate` runs, for EVERY shape shipped, `framecheck`
   (text and cards whole on every frame; each text up long enough to read; on 9:16 nothing under
   the phone UI; `craft-bar.md`), `facts.mjs` (every claim sourced, `facts.md`), the gate
   (determinism, contract, dead air; declare real holds in `meta.holds`, each with its reason)
   and `verify-export --delivery` (size, frames, score, sync, true peak, a legible frame 0), and
   writes the poster and captions; add `verify-export <film>-<shape> --first-frame #rrggbb` for a
   brand colour. Meter the mix. Keep the review page updated as work lands.
9. ✋ **Final approval** on the finished file.
