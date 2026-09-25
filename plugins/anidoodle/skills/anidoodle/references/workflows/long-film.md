# Films of any length

A film is `meta.durationFrames` long, and that number comes from the story, never from a
template. Three minutes, five, twenty: the engine streams frame by frame, the gate measures
frame by frame, and nothing buffers the whole film. What changes with length is how you
organise the work.

## Up to about 90 seconds: one arc

The Film workflow in `SKILL.md` as written: three sentences (setup, transformation, payoff), one
token that returns, one cue table, one look still, one music sample, build end to end.

## Longer: chapters

A long film is a sequence of chapters, each with its own small arc, joined by one through-line.

1. **Write the spine first**: the through-line in one sentence, then one line per chapter
   (what changes in it). If a chapter changes nothing, cut it.
2. **One cue table per chapter, one master table** that places the chapters. Chapter tables use
   local frames; the master adds offsets. Retiming a chapter moves everything after it, and the
   checker runs at load on both levels.
3. **One style contract** (`STYLE-GUIDE.md` in the project) before parallel work: palette, line
   weight at final size, type size per shape, the characters' modules, the music style and its
   section moods. Chapters import it; nobody changes it privately.
4. **Transitions carry the story**: each chapter hands over with a match cut, a covered switch
   (a shape passing, a page turning, a fog at full density) or a shared token. A hard cut to
   black between every chapter is a slideshow.
5. **Music follows the chapters**: one theme, varied per chapter mood (see
   `references/music/`), with the transitions scored (pre-lap, pivot chord, texture handoff).
6. **Review per chapter, then once whole**: a contact sheet per chapter at one tile per beat,
   then the whole film once, with sound and without.

## Rendering long work

- Render chapters as separate films in parallel (`--workers` per film, one film per machine
  core pair), then join the MP4s with ffmpeg's concat demuxer. Each chapter is still exactly
  reproducible on its own.
- Draw budget matters more at length: cache finished layers under keys that name everything
  their pixels depend on, and keep the median frame well under 150 ms.
- The gate's dead-air check reads one small frame at a time, so a twenty-minute film costs
  time, not memory.
