# The review: a fresh critic, three rounds at most

**Contents:** The loop · No version is shown without its ship table · Before any critic: the design pass · What the critic does · The four readings · Severity · The check before fixing · The scorecard · The gate · The fix ledger

The builder never judges its own work. A builder who has watched the film forty times sees what
they meant, forgives the hand they know is hard, and grades the effort. So every review is done by
a **fresh critic**: a new subagent (or a new session) that has seen none of the building.

Reviews happen three times: after the **storyboard**, after **each scene** (a chapter, for a long
film), and after each **full render**. The loop is the same each time.

## The loop

1. **Freeze.** Copy the file under review and note its hash. The critic judges that copy, even if
   the builder is already re-rendering.
2. **Brief the critic.** Give it the frozen file (for a storyboard, the rows), the story in three
   sentences, the shapes and sound the film promised, and this page. Give it none of the build:
   no conclusions, no chat history, no list of what you think is wrong. DO give it the person's
   own earlier rejections, verbatim, from the project ledger ("that end card is a mess... who is
   going to read this overload of info?"). Critics calibrate on collisions and counts; the person's
   words are the only record of their taste for density, hierarchy and humour. A critic that called
   an end card "generous" which the person had already rejected three times was judging the wrong film.
3. **The critic reports** (below). It returns ranked problems with timestamps and a verdict.
4. **Fix the biggest problem first.** Then the next, if they share a rebuild. Re-render.
5. **A NEW critic rechecks.** Not the one who found the problems; it would see only what it expects.
   Give the new critic the earlier list and the new file, and have it read the new file cold first.
6. **Stop at the verdict "ship", or after round 3.** Open-ended loops never converge: a fourth round
   finds new taste, not new faults. After round 3, report what remains, honestly, in the ledger
   and to the person ("two P2 left: the brush wipe is used twice, the tail rings 0.4 s long").

## No version is shown without its ship table

`node tools/ship.mjs <film> --file out/<the file you will send>.mp4` runs every check on the exact
delivered file (framecheck, verify-export, the gate, motionscan, layerscan, the locks, the sound or
track checks, the cues, facts, the review ledger, the length budget) and writes `SHIP.md`, `ship.json`
and a critic sheet (a frame every 2 s, every shot start, the last frame) beside it. A check that
cannot look is a FAIL, never a pass; an N/A shows as a FLAG with its reason; `--quick` skips the gate
and can never say PASS. Nine versions of a launch film reached the person with no check at all, and
the checks that did run had passed while blind. Attach the table to every version you show.

The critic's findings and the person's own notes live in `reviews/<film>.json`, which ship reads:

```json
{ "findings": [{ "id": "r1-4", "p": "P0", "status": "open", "note": "the end card is crammed", "by": "critic r1" }],
  "notes": [{ "at": "2026-10-27 21:36", "from": "<the person>", "text": "who is going to read this overload of info?" }] }
```

An open P0 fails the ship, an open P1 flags it, and the person's last three notes are printed
verbatim in the table, to be re-read against the new sheet.

## Before any critic: the design pass

The builder checks bugs well and taste badly ("I checked my frames for bugs, not for design"). So
before a version is shown to anyone, the builder judges a still sheet of it **for design first**:
hierarchy, flow, whether each frame would pass as a poster, the brand's temperament; then bugs. It
re-reads the person's last three notes against the new sheet, one by one. Before the first full
render, run a design critique of the storyboard stills with whatever design skills the person has
installed (name them in the brief). Changed beats are shown as a still sheet before any re-render.

## What the critic does

**Pulls its own frames.** It does not use the builder's stills. From the frozen file:

```bash
ffmpeg -i film.mp4 -vf "fps=5,scale=540:-1" frames/f-%04d.png          # a frame every 0.2 s
ffmpeg -ss 11.6 -t 1.2 -i film.mp4 -vf "fps=15,scale=540:-1" seam/s-%03d.png   # denser around a cut
```

Every cut, wipe, camera move and reveal gets the denser pass, about half a second either side, at
15 fps or at every frame for a very fast move. The cuts come from the file itself (`popscan.mjs`
prints where frames jump, `meta.shots` and the cue table list the seams). Detail crops are taken
at `--scale 2` from `still.mjs`, as in the illustrator reading.

**Reads a silent contact sheet and retells the story.** Sound off, 2 frames a second:

```bash
ffmpeg -i film.mp4 -an -vf "fps=2,scale=360:-1,tile=6x5" sheet-%02d.png
```

Before it reads the brief, the critic writes what the film is about, who the characters are, what
changes and what the last frame says, in plain words. Then it compares that with the brief. Where
the retelling differs, the picture is at fault, never the viewer. This is the sound-off read.

**Returns ranked problems, ending with a verdict.** Each problem has a timestamp (seconds and
frame), what is wrong, the cause it can see, and a severity (below). Biggest first. The last line is
exactly `ship` or `one more pass`. `ship` means no P0 or P1 is open on this file; the gate below
still applies.

**Says what works first**, so it survives the fixes.

## The four readings

The critic runs these four readings, in this order, on the frozen file. Each has one job, its own
evidence and its own scores; one reader looks for one kind of fault.

| Reading | Looks at | What it settles | Scores |
|---|---|---|---|
| **Director** | the silent contact sheet and the retelling; then each seam as a before/after pair | Whether someone who has never seen the brief could say what the film is about, and feel the payoff. | point, first second, pacing, seams |
| **Illustrator** | full-size stills of the hardest frames; crops of faces, hands, feet and joins at `--scale 2` | Whether a proud illustrator would sign it, or it is shapes assembled (`craft-bar.md`). | drawing, style |
| **Motion and finish** | `popscan.mjs`, `gate.mjs`, the dense strips across every seam and every fast move | Whether anything pops, stalls, jumps or smears that was not meant to. | motion, finish |
| **Sound and sync** | `music.mjs check` (with its ARC line), `verify-export.mjs`, `soundcheck.mjs` and its `soundsheet.mjs` picture, the cue table against the picture | Whether the sound is one piece with a shape, and lands on the picture. | sound |

For a storyboard only the Director reading applies, on the rows: the story, the point, the pacing on
the grid, the words. For a scene, Director, Illustrator and Motion on the scene's range
(`render.mjs --from F --to T`, silent); the Sound reading waits for the full render.

Also for the critic, on any film with words or claims: `framecheck.mjs` (no clipped text, each text
cue up for `max(0.7 s, 0.3 s per word)`, nothing in the phone zones on 9:16, `craft-bar.md`) and
`facts.mjs` (every claim listed with its source, `facts.md`). Their findings go on the list.

Rules that make a reading worth having:

- **Evidence before opinion.** Every finding names a frame (or a second, for sound) and a cause.
  "The run feels slow" is an impression; "the ground travels 22 px a frame at 400 while her
  stride covers 60" is a finding.
- **A picture that does not read is fixed in the picture.** Never by adding a caption.
- **The sound reading cannot hear.** Its findings are measurements; say so, and a human listens
  before the film ships.

## Severity

| Level | Meaning | Examples |
|---|---|---|
| **P0** | seen on a key moment (the first second, the payoff, the last frame), or it breaks the story, a fact or the contract | the character changes between two shots; the payoff lands 3 frames off its sound; a frame differs between two renders |
| **P1** | noticed on a normal viewing | a one-frame pop mid-scene; two seconds where nothing changes; a seam where the travel reverses |
| **P2** | seen only on pause | a stroke a pixel short for three frames inside a fast move |

## The check before fixing

Before anything is changed, the builder looks at the biggest P0 and P1 once more, at full size,
trying to prove it wrong: it must be on the frame named, be what the finding says, and be
something a viewer would see. Some critic findings do not survive this, and each one that is
"fixed" anyway costs a rebuild and risks something that worked. What survives goes on the list,
ranked by how much the film gains for the time the fix takes.

## The scorecard

The critic scores each line 1 to 5. The descriptions are for 1, 3 and 5. Where two readings disagree, the
lower score stands. A line with an open P0 cannot score above 3.

| | 1 | 3 | 5 |
|---|---|---|---|
| **Point** | a tour of nice things | one idea, but it drops out for a stretch | one idea that reads with the sound off, and something set up early that pays off |
| **First second** | a still or empty frame | moving, but the subject arrives late | frame 0 composed and already in motion; the subject known within a second |
| **Drawing** | subjects built from ellipses; rubber joints | sound, with weak hands, feet or joins | anatomy from named reference; survives a crop at twice the size |
| **Style** | one look recoloured | the medium's marks, used unevenly | the marks, the edge and the order of making all belong to the medium |
| **Motion** | everything fades and slides at one speed | good curves, with a pop or a stall | weight, anticipation, things that settle; nothing stops dead |
| **Seams** | dissolves between unrelated pictures | motivated, but one repeated until it is a preset | something carried across every seam; no designed seam used a third time (`checkSeamPlan`) |
| **Pacing** | dead holds, or everything at once | even, with no high point | one high point, calm either side of it, results held long enough to land |
| **Sound** | out of step with the picture, or wandering | in step, but flat or crowded | every cue on its frame, one clear loudest moment on the payoff, an ending that takes away |
| **Finish** | pops, banding, a frame that differs between renders | an explained flaw or two | gate and export checks pass; every flag from the scans answered |

A silent piece leaves Sound out. A still is scored on Point, Drawing, Style and Finish.

## The gate

The film ships when all of these hold:

- every line is 3 or more, Finish is 5, and the average is 4 or more;
- no P0 is open (a P0 still open after round 3 is a blocker the person is told about, never shipped quietly);
- `ship.mjs` passes on the delivered file (it runs the gate, verify-export and every scan), and for
  a scored film `music.mjs check` passes and a human has listened;
- the last critic's verdict is `ship`, or three rounds are used and what remains is in the ledger.

After the rebuild, the new critic goes down the earlier list item by item against the new file and
marks each one **fixed**, **partly** or **still there**, with the frame looked at. Nothing is
marked fixed from the code alone, and never by the builder who made the fix.

Then say the scores to the person who asked, in plain words, with the one or two things you
would still change. "This is a 4 on Seams, because the brush wipe is used three times" is worth
more to them than "done".

## The fix ledger

Each round adds one block to `ledger.md` in the project, written from the critic's list and the
rebuild. The problem, the fix and the evidence, before and after, in numbers where a tool gives
them and in the frame looked at where it does not. A fix without a before and after is a hope.

```md
## Round 2 · critic 2 · file 9f3c1a (md5 of the render) · verdict: one more pass

| # | Problem (time) | Fix | Before | After | Status |
|---|---|---|---|---|---|
| 1 | The wipe at 8.4 s jumps (P1) | start the wipe on the bar line, ease in and out | popscan: 41 px jump at frame 252 | 3 px at frame 252 | fixed, strip 249-256 looked at |
| 2 | "ART OUT." is up 0.5 s (P1) | hold the page 12 frames longer | framecheck: needs 0.7 s, up 0.5 s | up 0.8 s | fixed |
| 3 | The fox's back foot slides (P2) | plant it for the stride | not measured | not measured | still there, left for the next round |

Open after this round: row 3. Rounds used: 2 of 3.
```

After round 3, or at `ship`, the last block ends with **Left open**, each remaining problem with
its severity and why it was not fixed. That list goes to the person in plain words, with the scores.
