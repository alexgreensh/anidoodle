# Motion grammar: six ways to get from one picture to the next

**Contents:** 1. Foreground as transition · 2. Persistent actor · 3. Selection to expansion · 4. Registered decomposition · 5. Continuous canvas · 6. Exploded layers · Three ready-made seams · Cuts that carry motion · Dealing a hand · Names people use · Names we refuse · Callouts and the label handoff · Choosing

A film that shows one good thing, then another unrelated good thing, reads as a slideshow however
well each is animated. These six mechanisms are ways to make the next picture come OUT of the
current one. They are a grammar to compose from, never presets: pick the one the story is already
asking for, and build it for that film's subject and medium.

**The default does not change.** A gentle move (a bloom, a flip, a push) is still the standard
seam (`workflows/launch-video.md`, Motion). Each mechanism below is a judgement with conditions.
If its "use it when" does not clearly hold, use the gentle move.

Three things hold for all six:

- **The destination is in place before the move starts.** The next scene is already drawn under
  or behind the move, so there is never an empty frame between scenes.
- **Something is carried across**: a shape, a position, a direction of travel. That is what
  separates a designed seam from a transition laid over a join.
- **One or two mechanisms a film, each used for the seams that matter.** All six in 30 seconds is
  a demo reel of moves, not a story.

## 1. Foreground as transition

Something already in the scene (a word, a mark, a shape) grows or sweeps until it covers the
frame, and when it clears the next scene is there.

- **Use it when** the covering thing is part of the story (the brand's ink, the product's mark,
  the claim itself) and the two scenes share nothing else to carry across.
- **Not when** the cover would be an arbitrary shape brought in only to hide the join, or when it
  would happen on every seam: the third time, it reads as a wipe preset.
- **Ours**: the type frames of the launch film (`launch3.ts`, `typeFrame` in `launchCut.ts`). Ink
  blooms open from a point over the picture, the word letters itself on the page inside the
  bloom, and the ink closes to a point on the NEXT picture. The bloom takes the content frame it
  opens over and the one it closes onto as data (`type(lines, len, before, after)`), so the next
  scene is always waiting under it.

## 2. Persistent actor

One object keeps its identity through the whole film while the scenes change around it.

- **Use it when** the story already owns such an object (a cursor, the product's dot, a
  character, a line being drawn) and it has a reason to be in every scene it visits.
- **Not when** it has to be invented for the purpose, or dragged through scenes where it does
  nothing: a mascot that only watches is decoration.
- **Ours**: the ink drop in the launch template (`launchTemplate.ts`). Every press of Generate
  sends a drop into the thread, where it blooms into the answer card; at the end it lifts off
  Generate one last time, lands as the dot of the end card's mark, and the end card opens from
  it. `motif.ts` holds it to the rule: same screen position and size on both sides of the seam,
  within 2 px, or `checkRelay` throws.

- **The general move**: `engine/src/canvas-core/morph.ts`. `handoff({ from, to, t0, t1 })` carries
  one outline from a source shape to a target shape: it travels, stretches a little while it is
  moving, and becomes the target in the second half of the trip, landing on it exactly.
  `coverShape` grows a shape until it is the whole page. Keep the object's colour and edge the
  same on both sides, and hold the seam with `checkShapes` (2 px). `morphDemo.ts`: a full stop
  becomes a card, the card becomes the page.

## 3. Selection to expansion

One item in a set is picked, and it grows until it IS the next scene.

- **Use it when** the story moves from many to one: a wall of options, then the one being used;
  a list, then the item opened. The viewer sees where the next scene came from.
- **Not when** the set was only there to be left (build the set because the story needs range,
  not as a launch pad), or when the item's small and full-frame versions do not match: frame the
  full scene's first frame exactly like the card it grew from.
- **Ours**: the style wall (`launchGallery.ts`, used in `launch2.ts`). The camera punches into
  cards and comes back out; the last punch does not come back, the card fills the frame and
  becomes the scene. The koi does the same from a still: `koiWorld.ts` frames its first frame
  exactly like the koi plate, so the card hands over to the swimming world with no seam.

## 4. Registered decomposition

A whole stays recognisable while its parts move into groups, each part traceable from where it
was to where it lands.

- **Use it when** the point is that the product sorts, extracts or reorganises something the
  viewer has just seen: a crowded week becoming a plan, a document becoming fields.
- **Not when** the parts cannot be followed. Past about seven moving at once, or with parts that
  cross paths, the viewer loses the map; stagger them, or move groups rather than items.
- **Ours**: `productUI.ts` (a `kind: "ui"` ask in the launch template). The interface is drawn
  from data in two states. One press of the product's action and every item, matched by id,
  springs from its place in the before state to its place in the after: rows travel to their new
  slots, values count to their new numbers, new items arrive, old ones leave.

## 5. Continuous canvas

All the scenes live in one layout bigger than the frame, and the camera travels between them
instead of cutting.

- **Use it when** the places are really related in space (sections of one page, rooms of one
  building, steps along one path) and the route between them tells the viewer how.
- **Not when** the places are unrelated (the travel then invents a relationship that is not
  there), or when the journey between two stops is long and empty: every second must change
  (`craft-bar.md`, no dead air). One camera for every plane (`camera.md`).
- **Ours**: `webTour.ts`. Three sections on one long page, a visible cursor, and a camera that
  shows the whole page, then pushes in on every click and every field. `koiWorld.ts` is the
  drawn version: a pond much bigger than the frame, with the scenery placed in the world so it
  changes as the fish travels.

## 6. Exploded layers

One object separates into its layers along its depth, holds so each can be read, then closes
back into the object.

- **Use it when** what is inside is the point: how a thing is built, what a stack is made of.
  The layers must be real parts of the subject, in their real order.
- **Not when** the subject has no true layers and they would be invented for the effect, or when
  the pieces are not held long enough apart to be read. If it never closes again, it is a
  diagram, which may be what the film wants; decide which.
- **Ours, in one direction only**: `paperCraft.ts`, the toy theatre. The scene is built from the
  back, flat by flat, with real gaps between the flats: each piece travels held above the stack,
  its shadow wide and far, and the shadow closes as it lands. That is the closing half. No film
  of ours yet starts whole and separates; treat the opening half as unproven until one does.

## Three ready-made seams

For a plain change of scene that still wants a made mark, `engine/src/canvas-core/transitions.ts`
has three calls. Each takes the two scenes as draw functions and a progress, at any frame size,
with the incoming scene already complete underneath. `transitionsDemo.ts` shows each once.

- **`brushWipe`**: a loaded brush pulled across; with `ink`, a band of wet ink ahead of the new
  picture (without it, a clean bristled edge).
  For the drawn register, in the direction the story is already moving. Not in the clean
  register, and not more than once or twice a film.
- **`iris`**: a round opening from a point, or closing to one. Open it from the thing the next
  scene is about, close it on the thing this one was about; centred on nothing it is only a
  shape. `shape: "blot"` for ink, the plain circle for the clean register.
- **`flashCut`**: a hard cut under a short burst of light, so the hard cut's conditions apply
  (a strong beat, in a piece whose energy asks for it). Never one frame, never full white by
  default, never repeated quickly: declare a film's flashes to `checkFlashes`, which throws on
  any two within half a second.

## Cuts that carry motion

A hard cut between two shots that are both moving can be the smoothest seam there is, or the
roughest. The difference is arithmetic, and `engine/src/canvas-core/seams.ts` does it.

- **Both sides at rest, or both at one speed.** A cut from a moving shot to a still one (or the
  other way) reads as a jerk. So does a cut where the travel turns, halves or doubles.
- **Accelerate out, cut after the fastest frame, arrive and settle.** The outgoing shot speeds up
  over about 0.2 to 0.4 s; the incoming shot opens at that same speed, in that same screen
  direction, and comes to rest over 0.8 to 1.4 s. The exit is the short side.
  `matchedMove({ dir, exitDist, exitF, entryF })` gives both halves, to add to each scene's
  camera look; the entry distance is worked out from the exit speed, so the two always agree.
  The incoming shot owns the cut frame: the outgoing shot's last frame on screen is the one
  before it, and that is its fastest.
  **This short, fast exit is for camera and world moves only.** Type and photos of people leave in
  0.5 to 0.7 s, eased in (they accelerate away from rest), and are never motion-blurred: a launch
  film that whipped every speaker card out in 0.4 s with blur on type and faces was called violent,
  twice. A fast exit used as the seam for many cuts is a preset, however well each is timed.
- **Through the cut, in depth.** `matchedZoom({ push, exitF, entryF })` does the same for a
  camera that flies into one shot and out in the next: a dolly push through the cut. A push is a
  ratio, so both sides run in log space and grow at the same rate per frame across the cut. With the default push the
  incoming shot opens at about two thirds of its size, so its scene must be painted that much
  wider than the frame; a zoom that would open it under 0.4 is refused.
- **There is a top speed.** Past about two and a half frame widths a second
  (`speedCeiling(W, fps)`), blur stops reading as motion and shows as a streak with stepped
  copies. A move that needs more than that wants a shorter travel with the rest hidden behind
  the cut, or a plain cut on the beat. Render fast seams with `--blur auto`, which leaves text
  and photo layers sharp.
- **Match everything, once.** Whatever crosses the cut keeps its position, size, colour and
  edge; a property that flips on the cut frame pops. And the resting pose is shown once: if one
  shot settles onto a pose and the next opens on it, the first shot's last frame is the move's
  last in-between, never the pose itself, or the film stops, holds and goes.
- **Never dissolve two copies of one thing.** At the halfway point both are half there and the
  eye sees a ghost. Move one object; change what it is at the middle of its trip.

`checkSeam(velocity before, velocity after, { W, fps })` returns what is wrong with a cut, or
nothing: one side at rest, a turn of more than 30 degrees, a speed that drops or jumps. `checkSeamPlan` reads the film's list of seams and flags a designed seam used a third
time; plain and matched cuts are exempt, and the film's one signature move gets three (the open,
the middle, the close). Use this when both scenes have room to travel the same way. When they do
not, bring both to rest and cut on a beat.

## Dealing a hand

Left to choose, every film reaches for the same three moves. `node tools/deck.mjs deal --kind
story --energy high --seconds 27` deals a hand from `references/motion-deck.json`: an opening, a
close and a spread of seams, camera moves, reveals and acting notes, each with its numbers, its
engine call and when not to use it. The deal is weighted toward what fits the film and is
repeatable from its printed seed; `--avoid` keeps the next film off the last one's cards.

A card is a prompt, never an order. Keep it, adapt it to this film's subject and medium, or drop
it, and say which in the brief. The default at the top of this page still holds: a card whose
"not when" applies is dropped, and the gentle move takes its place.

## Names people use

People ask for moves by the names they know: a whip pan, a mask reveal, a Vertigo shot, a J-cut.
`node tools/deck.mjs find "<name>"` routes the words to the card that builds it, to an engine call
that is not a card (an iris, a lens zoom, a typewriter), or to a refusal. Every card carries those
names in its `aka`. Run it before building anything named, so a word never turns into an
improvised effect; the card's numbers are the default unless the person gave their own
(`workflows/start-here.md`, When they name a move).

## Names we refuse

Some names ask for an effect that breaks the contract or the craft bar. Say so in one line and
offer the alternative; `deck.mjs find` prints the same reason.

| Name | Why not | Make instead |
|---|---|---|
| glitch | colour split and torn pixels are a template overlay with no cause in the picture | a cut on the beat, or one shake on a real impact |
| light sweep | a shine sliding over chrome that nothing in the picture casts | `reveal-by-light`: the light belongs to the world |
| fade-in | marks are made, not faded or scaled up from nothing; a tell on the craft bar | drawn on, revealed from behind, or written |
| particle burst | decoration with no force behind it, never a default | `emph-contact`: dust or splash born on a real contact |
| cross dissolve | two copies of one thing read as a ghost; unrelated pictures, a slideshow join (a poster frame or a reduced-motion fallback may still dissolve) | one object moving and changing mid-trip; the gentle move |
| lens flare | lens artefacts (flare, leaks, bokeh discs) painted onto a drawing read as stock overlays | one named light in the scene, or `reveal-by-light` |

## Callouts and the label handoff

`engine/src/canvas-core/callout.ts` names one thing in the picture: a dot lands on it, a leader
line is drawn out, a label is written at the end. The dot follows the thing as the camera moves
(pin it with `cam.toScreen`, `camera.md`); the label holds still so it can be read. It is type
over the picture, so that judgement applies in full (`workflows/launch-video.md`, Type): a calm
area, a label that names what it points at, one or two on screen at a time. Where the picture is
busy, give the label a `backing` or leave the callout out.

The label can also be the persistent actor across a seam. With `handoff`, the dot and line
retract and the label travels to where the next scene starts, landing as its heading on that
scene's first frame; the next scene draws it from there with `drawLabel` at the same pose.
`checkHandoff` holds the two sides to within 2 px and throws if the seam jumps.
`calloutDemo.ts` shows both.

## Choosing

Ask what the seam has to tell the viewer, then take the mechanism that says it:

| The seam says | Mechanism |
|---|---|
| "and now this", with nothing shared but the brand | Foreground as transition |
| "the same thing, further along" | Persistent actor |
| "this one, out of all of those" | Selection to expansion |
| "the same things, put in order" | Registered decomposition |
| "next to that, over here" | Continuous canvas |
| "and this is what is inside" | Exploded layers |

If none of these is what the seam says, it is a plain change of scene: use the gentle move, or
a matched hard cut where its conditions hold. Review every designed seam as a before/after pair
of stills, and as a strip of the frames between them, before the film is rendered in full.
