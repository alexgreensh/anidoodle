# Teach drawing: a lesson from a request or from somebody's picture

Two asks, one machine:
- **"How do I draw a cat sitting?"** A basic-drawing lesson: you choose the subject's pose and
  construction, and teach it the way a drawing teacher would.
- **"Here is my drawing, show me how it's drawn."** Recreate the picture and teach one way to
  draw it. This is the one place anidoodle may follow a picture closely (the master copy: the
  user asked for THIS image). Label it **"a way to draw it, not a record of how it was drawn"**:
  nobody knows the real order, and the lesson must not pretend to.

A lesson is a **drawing score** (`engine/src/canvas-core/drawingScore.ts`): parts of the subject,
marks with stable ids, dependencies, teaching phases, layers, erasers and corrections, all
authored as data. One score gives the finished still, the timelapse, the step sheet and a replay
at any frame, from ONE renderer, so the last frame of the timelapse is the finished drawing.

## The workflow

1. **Name the subject and the medium physically** (header comment, like every plate): what the
   tool is, what the paper does, how tone is built, what the construction pencil is.
2. **State the anatomy / structure** that makes it read (realism-and-craft.md), and the
   construction a teacher would use for it (head ball + chest egg + haunch circle for a sitting
   cat; a box and its proportions for a block character).
3. **For a user image:** analyze it (`tools/analyze-style.mjs`), measure the big masses off it
   (bounding boxes, rows of lines, positions: a few lines of python or the profile are enough),
   and redraw them as marks in the matching medium. Pick the medium's plate kit for the marks.
4. **Write the steps first, then the marks.** 6 to 8 steps, in teaching order:
   placement and gesture → big shapes → construction → value masses → local colour → edges and
   details → accents. Not every medium uses every phase; construction can repeat (a "check and
   correct" step is construction). Each step carries:
   - `title` (a few words) and `caption` (24 words or fewer, drawn on the sheet and in the film),
   - `look`: what to look for, with a real proportion or measurement,
   - `how`: the technique (grip, pressure, direction, eraser),
   - `mistake`: the common mistake and why it goes wrong.
   A numbered reveal with captions is not a lesson. Teach something in every step.
5. **Author the score** with `ScoreBuilder`: `layer()`, `part(id, label, dependsOn)`, `step()`,
   then `add()` / `addAll()` / `erase()` under each step. Marks come from `drawingMarks.ts`:
   `stroke`, `hatch` (clipped to a region, density function for tone), `contour` (overlapping
   strokes, weight from a keep function), `sketchEllipse`, `guideLine`, `scribbleDot`.
   - **Construction in blue** on its own layer (`kind: "guide"`); **erase it** with an eraser
     pass (`erase()` with a ghost of 0.05 to 0.3: a kneaded eraser leaves a trace; before
     coloured pencil, lift it to a ghost, because wax seals whatever is under it).
   - **Corrections** are authored events: put the wrong mark on its own layer, erase that layer,
     draw the new mark with `supersedes: oldId`. The validator refuses a correction whose old
     mark was never erased first. Teach the correction: say what was measured and why it was wrong.
6. **Export three films** (see `lessonCat.ts` + `lessonCatSheet.ts` + `lessonCatFinal.ts`, and a
   `page-*.ts` host each): `lessonFilm(score)` (the captioned timelapse; its `.final` is the cold
   render for the identity gate) and `lessonSheet(score, { crop })`. Export
   `LESSON = { score, sheet, final, source? }` from the lesson module.
7. **Run** `node tools/lesson.mjs <lessonFilm> --out <dir> [--ref image --ref-crop x,y,w,h]`. It
   writes `<name>-steps.png`, `<name>-timelapse.mp4`, `<name>-contact.png`, `<name>-final.png`,
   `LESSON.md`, `gates.txt`, and runs:
   - **schema**: unique ids, parts and layers resolve, dependencies acyclic and in order,
     corrections erased first, captions at 24 words or fewer, every guide erased;
   - **identity**: the timelapse's last frame (prefix-cached replay) hashes the same as the
     finished drawing rendered cold;
   - **time travel**: sampled frames hash the same rendered forward, reversed, and each in a
     freshly mounted page;
   - **fidelity** (`--ref`, recreate lessons only): value-mass IoU against the user's image
     (the reference posterised to its own three values) and mean OKLab colour distance.
8. **Look at it.** Read the step sheet at full size, watch the contact sheet, and check that
   every step's caption is true of its panel. No gate can tell you whether the order reads like
   a hand working or whether the teaching is right.

## Grammar of the outputs

- **Step sheet**: one panel per step; everything from earlier steps pale under a paper veil,
  the step's new marks strong; an eraser step shows the erased state pale. Under each panel the
  step number, title, phase and caption, all as pen strokes (`drafting.ts`), never `fillText`.
- **Timelapse**: one mark at a time, each taking time in proportion to its length plus a lift;
  the step's caption is written on as the step starts; a title card first; a closing line and a
  held finished frame last. Steps start on the beat grid.
- **LESSON.md**: every step written out with look / how / mistake, its time in the film, its
  marks and parts, and the layers.

## Proofs (2026-09-25)

| Lesson | From | Steps | Marks |
|---|---|---|---|
| How to draw a cat sitting (graphite, blue col-erase, kneaded eraser) | a plain request | 8, including a measured ear correction | 844 |
| Clawd at the piano (coloured pencil) | the owner's crop of Kevin Ngo's piano film | 8, with the guides lifted to a ghost before colour | 9676 |

Outputs: `anidoodle-research/samples/adapt-teach/lesson-cat/`, `lesson-clawd/`.
