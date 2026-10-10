# One still, then the whole film — and how two roles share one tree

> Doctrine earned making MECHANICAL LEPIDOPTERA, the worked example in `example/`. Every rule
> below was paid for on that film; where a mistake was the director's own it says so, because
> a rule with its scar attached is one people keep.

**The mistake, and it is mine.** Revision 3 of my spec had eight gates. Revision 4 had seven, stills first, each reviewed before the next began: a ranunculus sheet, six metamorphosis stills, three sheet stills, a re-approval of the destination. It felt rigorous. What it did was make the client approve fragments of a film she could not yet watch, round after round, while the thing she actually wanted, a film, stayed at zero frames. She called the gate off and asked for the finished film. She was right. The film that came back had problems no still would have shown (timing, flow, whether the pull-back felt motivated) and none of the problems the stills had been arguing about.

**Why one still earns its keep and seven do not.** A still answers exactly one question: is this the LOOK. Line, fill, palette, density, realism, medium. That question is cheap to ask (a still renders in under a minute) and ruinous to get wrong late (our first cast on the earlier film was rejected after scenes had been built on it; our first butterfly was rejected after it had been put into two scenes). So you ask it once, properly. Everything else, story, pacing, camera, continuity, music, only exists in motion, and you learn it fastest from a rough whole.

**The rule.**
- **ONE look still**, the hardest frame in the film: hero subject large, in its world, in the final medium, final light. Add a specimen plate if the subject is a real-world thing (`realism-and-craft.md`). Add one more still ONLY for a genuinely different look (we had two media, so two). That is the ceiling: three images.
- **Critique it yourself first**, in writing, against the craft table, and say what is still wrong when you show it.
- ✋ One approval.
- **Then build end to end without stopping.** A rough complete film on day one beats a perfect first act. Mechanical checks run continuously and need nobody's approval: types, grid, contract scan, draw budget, determinism probe, dead air.
- **Review the whole, once.** From the rendered file itself: a contact sheet at one tile per beat, each cut as a before/after pair with a difference measure, the dead-air numbers, a few full-resolution frames where the sheet raises a doubt. One numbered fix list, ranked. One rebuild. How that one review is run (four readings, a scorecard, the gate): `workflows/review.md`.
- **Approval is a budget.** Each gate spends the client's attention and your tokens. Spend them where being wrong is expensive, which is the look, the music sample and the final film. Three, not thirty.

**What a good review looks like** (this part of the over-gated process was worth keeping): freeze a copy of the file and note its hash before looking, because the builder may be re-rendering under you (it was, twice). Report what works first, so it survives the fixes. Give causes, not impressions: not "the body is green" but "the sun disc prints over the thorax, blue times yellow". Correct your own spec in the same breath when the fault was yours (a 5-frame wing lag that I specified became antiphase on a 10-frame beat: one wing folded while the other was spread).

---

## Two roles, written handoffs, and the reset

**Why split at all.** The one who builds a shot cannot see it fresh, and the one who reviews their own work grades the effort. Separating director (story, spec, look, review) from builder (engine, determinism, the contract, the render) gave us a reviewer who had never seen the code's excuses and a builder who was never asked to have taste on a deadline. The client stays the approver and the relay.

**The pattern that worked.**
- **The spec is the single source of intent**, and it is rewritten WHOLE when the story changes, never patched into a palimpsest. Ours went through four revisions in a day; revision 2 was a "section 12 supersedes sections 5 and 9" patch, and everyone, including me, misread it. Mark every line that is the director's own call (we used FABLE) so the client can veto it in one line without hunting.
- **The builder keeps a running decisions log** in the project: design decisions, deviations, tradeoffs, open questions, appended after each batch, with numbers and hashes. It is how the director learns what was actually built, and it is where the best lessons in this document were found.
- **Reviews are files**: `reviews/<thing>-r<N>.md`, numbered items, ranked, self-contained enough to relay verbatim.
- **Two agents, one working tree, will collide.** The builder re-rendered over the file I was reviewing; I patched a source file it had open. The protocol that ended it: the director reviews a frozen COPY (record the hash), writes only review files, and never touches shared source or outputs while the builder is active. Small director patches are allowed only when the builder is idle, and each carries a comment saying who and why.
- **A green checkmark is a claim.** Re-run it. The builder's "G-AIR PASS" was true and the second of near-stillness was also true.

**The reset.** Long sessions rot. Ours showed it plainly: the client's messages began arriving with their first half cut off, context was being summarised underneath me, and I caught myself about to rebuild a plan on a half-sentence. The tell is any of these: you are guessing at what was asked; you re-derive something already decided; your answers get longer and less certain; the harness itself reports low context quality.

Do not push through. Reset:
1. **Write state to disk first.** Spec current, decisions log current, open review filed, and a short memory note: roles, the story in three sentences, the hard rules, where everything lives, the known environment traps.
2. **Clear the session.**
3. **Re-brief in one message with a READ-FIRST list**: the spec, the contract section, the built modules, the memory note. Roles stated in the first line. The task last.
4. **The fresh session verifies before it trusts.** Read the files, check the disk, say what disagrees with the briefing. (Ours found that the "already built" camera was not in the source, in the first five minutes.)

A reset cost us about ten minutes because the state was in files. It would have cost the project if the state had been in the conversation. And when a message arrives truncated, look for the full text in the session transcript before you guess; twice the missing half changed the job.

---

## Spend tokens and time where they buy something

The launch film cost 188M tokens, about 99% of them cache re-reads of one 750k-token context.
None of that was drawing. These habits cut it by an order of magnitude:

- **One session per cut, with a handover file.** When a cut is done, write the state (what
  exists, the rules the person gave, what is open, where files live) and start the next cut in a
  fresh session that reads it. A long session re-reads its whole history on every turn.
- **Briefed helpers, never context-inheriting forks.** A helper gets a short written brief and
  the few files it needs. A fork inherits the whole conversation and pays for it on every call.
- **Contact sheets at 0.3-0.5 scale** for review (`ffmpeg -vf "fps=1,scale=576:-1,tile=4x4"`),
  full size only for the crop a sheet raised a doubt about. Never re-read a big image you have
  already judged.
- **Options sheet before any full render.** Transitions, type styles, palettes: one still
  sheet with three to six variants side by side, picked in one message.
- **Timelines as data.** Scenes on one content timeline, the cut as a list of segments
  (`launchCut.ts`). Re-timing edits the list; scene code and its reviews stay valid.
- **Range renders.** `render.mjs <film> --from F --to T` renders frames `[F, T)` only, silent
  (the score would not line up), and writes `out/<film>.<F>-<T>.mp4`; it refuses an `--out`
  that is the finished film. For review, not for shipping.
- **Many stills, one browser.** `still.mjs <film> --frames 0,700,1500` draws every listed frame
  in one page (one build, one launch, plates baked once); ranges work too, `--frames 0-300:50`
  is every 50th frame from 0 to 300. Add `--sheet out/sheet.jpg` for a contact sheet of them at
  `--sheet-scale` (default 0.4). `--out out/dir/` or `--out out/x-{frame}.png` names the PNGs.
- **Plate cache.** Finished plate frames are kept in `engine/.cache/bakes/<browser version>-<binary>/`,
  keyed by a hash of the plate's whole import closure, so a wall of 32 live plates stops
  re-baking (about 60 s) on every still, and an edited plate simply misses and is drawn again.
  It is never needed: delete `.cache/` any time. `--no-bake-cache` (or `ANIDOODLE_BAKE_CACHE=0`)
  draws every plate cold, which is what to do when you suspect the cache.
- **Frame-exact comparisons.** `render.mjs --hashes out/x.md5` writes the md5 of every frame
  before the encoder touches it; diff two of those files to prove an engine change left a film
  byte-identical, or to find the first frame it moved.
- **Holds are declared, never absorbed.** A word being read, an end card, a loop being watched:
  put the range in `meta.holds` with its reason in a comment. The gate's dead-air check then
  knows the stillness is meant. Anything else that sits still is a dead wait: cut it. A wait the
  review found in a film that is already approved goes in `meta.locked` with its reason: the gate
  prints it and keeps failing, so the decision stays visible. If the owner accepts it as shipped,
  it becomes a hold with that reason as its third field (`[from, to, "approved as shipped: ..."]`),
  which the gate prints and passes (`launch3.ts`).
- **`npm test`** (in `engine/`) runs the unit suites in `engine/test/*.test.ts` without a
  browser (camera moves today). Run it with the gate after any engine change.
