# Start here: agree the piece with the person, then build

**Contents:** The intake · When they name a move · Defaults when they do not say · Write it down before you draw · Before the first full render · Alive means real motion

anidoodle makes many kinds of thing in many hands. Nothing about a piece is fixed in advance:
not its length, its shape, its style or its sound. So the first job is to find out what this
person wants, quickly, one question at a time, and to fill every gap with a stated default
instead of a guess.

## The intake (ask only what the request leaves open)

Ask one question per turn, with short options and your recommendation first. If they say "you
pick", pick, say what you picked and why in one line, and carry on.

1. **What are you making?** A still, a loop, a picture that draws itself, a story film, an
   explainer, an infographic, a launch or product video, an interactive web piece, a drawing
   lesson, a character, or a style matched from their image. The table in `SKILL.md` routes each
   one to its workflow file.
2. **Drawn or 3D?** One medium for the whole film. Recommend one with a reason: 3D for solid
   things in light (extruded type, products, toys and puppets, a camera moving through space),
   drawn for anything where the marks are the point. A drawn world with a 3D puppet pasted on read
   as two films glued together on the last 3D film, so build a hybrid only when they ask for one.
   3D goes to `references/workflows/three-d.md`; the style question below is for drawn pieces.
3. **Which style?** Show the gallery (https://github.com/alexgreensh/anidoodle/blob/main/skills/anidoodle/assets/styles.jpg, one tile per hand; the list with
   each hand's medium is `references/styles/INDEX.md`). Recommend two or three hands that suit the
   subject and the audience, with one reason each. Offer two other routes:
   - **"Match my image"**: they bring a picture and you adapt its hand (`adapt-a-style.md`).
   - **"A house style"**: they already picked one before; load it from `styles/house/`.
4. **What shape and where will it live?** Square `1x1`, vertical `9x16`, wide `16x9`, portrait
   `4x5`, or any W x H they name. One source can ship several shapes (`references/formats.md`).
5. **How long?** Any length. A three-second sticker, a ninety-second story, a five-minute
   explainer, a twenty-minute lesson. Never cap it and never assume it. Long pieces get chapters
   (`long-film.md`).
6. **Sound?** Silent, or a score: name a music style and a mood per section
   (`references/music/`). Their own track is theirs to bring; anidoodle composes and plays everything else.
7. **Narration?** None, their own recordings, or a generated voice they choose
   (`references/workflows/narration.md`). Say it plainly when you offer one: macOS `say` is free
   but for drafts only (Apple licenses its voices for personal, non-commercial use); Kokoro is free,
   local and licence-clean; a cloud voice (Gemini, OpenAI, ElevenLabs) sends the script's text to
   that company and costs money per use, so it runs only on their yes and with their own key.
8. **Characters?** A new one (build it once, `character-consistency.md`), one they already have
   in a module, or one from their image (reference, embedded only if they ask).

Stop asking the moment you can build. Two questions answered well beat six asked.

## When they name a move

When the person names a move ("a whip pan to the cat", "a slow-mo at the top of the jump"), look
the name up first: `node <skill>/engine/tools/deck.mjs find "<name>"` returns the card or engine
call that builds it, or the reason anidoodle refuses it and what it makes instead. Then record
the move in the brief in four parts: **name** (theirs, and the card id), **duration** (seconds),
**strength** (how far, how fast or how much: a distance as a share of the frame width, a speed,
an overshoot) and **what moves** (which element, camera or layer). Fill only what they said. For
every part they left open, the card's own numbers are the default, written down and marked as
defaults: "whip pan (cam-whip-to-rest) · 0.4 to 0.7 s, card default · peak under the speed
ceiling, card default · the camera, onto the cat, theirs". A vague ask becomes a spec someone can
check against the render. When `find` returns an engine call, there are no card numbers: record
the four parts with your own numbers, marked as yours. When it returns a refusal, tell the person
the reason in one line, record the alternative you will build, and let them veto it.

## Defaults when they do not say

| Open question | Default | Why |
|---|---|---|
| Style | the hand whose recipe best fits the subject, named with a reason | a style is a decision, not a coin toss |
| Shape | `1x1` for social, `16x9` for web heroes and YouTube, `9x16` for Reels/Shorts/TikTok | where it lives decides it |
| Length | still: one frame; loop: 4-8 s; story film: long enough for its arc; explainer: one idea per chapter | the content sets the length, not a template |
| Sound | a film gets a score in the style that fits its mood; a loop or still is silent | silence is a choice too |
| fps | 30 (24 for a hand-drawn cartoon feel, 12 on twos for paper and stop-motion) | the medium's own rhythm |

## Write it down before you draw

One short brief file in the project: kind, medium (drawn or 3D), style (and why), shape(s), length, sound (style +
moods), narration (and whose voice), characters, the one-sentence idea, and any named moves as name, duration, strength and
what moves (card defaults marked as such). Everything the person said goes in their words.
Everything you decided is marked as yours so they can veto it in one line.

## Before the first full render

- **Show options as one still sheet** when a choice is open (a transition, a lettering medium,
  a palette): three to six variants side by side, picked in one message. Then render.
- **Review stills for design**, not only for things overlapping (`references/craft-bar.md`).
- **A picture that draws itself says so**: `kind: "drawing"` in the film's `meta`. A stipple dot
  or a hatch changes far less than 0.5 % of the frame, so without it the gate calls a drawing
  dead air; with it, dead air is judged over 1 s at a 0.02 % floor and a hand may rest half a
  second between passes. `meta: { title, W, H, fps, bpm, durationFrames, kind: "drawing" }`.

## Alive means real motion

When someone asks for a subject to be "alive", "swimming" or "moving", an in-place loop reads as
a GIF. The subject travels through a world that changes as it moves, and the camera follows.
The worked example is the koi: `koi.ts` takes an optional `KoiLive` (time, amplitude, a pose on
a path) and `koiWorld.ts` swims it through a pond much bigger than the frame, sliding under pads
that are placed in the world, its wake spreading from its nose.

The pattern:
1. **Add motion as an optional input** to the subject's drawing function (`live?: KoiLive`).
   With it absent, the code path is the still, untouched.
2. **Guard the still**: render the still plate before and after with `still.mjs` and compare
   the md5 it prints. The still must stay pixel-identical; if it moves, the refactor leaked.
3. **Place the world in world units**, not screen units, so the scenery changes as the subject
   moves; let the camera follow (`references/camera.md`).
4. **Frame 0 of the living version equals the still** (same pose, same framing), so a film can
   hand over from the still card to the living one without a seam.
