# Form, arrangement, orchestration, counterpoint

**Contents:** 1. Song forms (and the engine's section kinds) · 2. Film cue structure (scoring to picture) · 3. Builds and releases · 4. Orchestration: registers and frequency slots · 5. Counterpoint basics (a second line that helps)

## 1. Song forms (and the engine's section kinds)

| Form | Shape | Engine kinds |
|---|---|---|
| Verse-chorus | intro, verse, chorus, verse, chorus, bridge, chorus x2, outro | intro, verse, hook, bridge, drop, outro |
| AABA (32-bar) | A (the tune), A (varied end), B (contrast: new key area), A | verse, verse, bridge, hook |
| Loop / beat | 4-8 bar loop; layers in and out every 4-8 bars | groove, hook, half, breakdown, drop |
| Build-drop (EDM, trailer) | intro, build (riser), breath, drop, outro | intro, build, breath, drop, outro |
| Through-composed cue | motif stated, developed, climax, coda | intro, verse, swell, hook, outro |

- The chorus (hook) holds the **motif's clearest statement**, the fullest layers and the most home
  harmony.
- The verse is lighter and leaves room.
- The bridge goes somewhere new: a borrowed or relative key area, a new rhythm, a thinner texture.
  Then it **returns**.
- Return is what makes form. A-B-A satisfies because B made A new (Huron 2006: expectation built,
  then fulfilled).

## 2. Film cue structure (scoring to picture)

Working film composers structure a cue around **hit points**: the frames where something happens
(Karlin & Wright 2004; Davis 2010).

1. **Spot the cue.** List the beats with times: the reveal, the claim, the cut, the logo.
2. **Pick 1-3 sync points** that get a structural downbeat: an arrival, a hit, or a change of layer.
   Don't hit everything. Hitting every cut is "mickey-mousing", fine for comedy and tiring elsewhere.
3. **Tempo from the picture.** Choose a bpm so the key hits land on downbeats (the engine's `fitScore`
   and `stretch` help). A bar lasts `beatsPerBar x 60 / bpm` seconds.
4. **Shape:**
   - establish (the motif, low density);
   - develop (sequence, rising harmony);
   - a breath (one bar of near-silence);
   - the peak on the key frame (the climax note, full layers, home chord);
   - release;
   - a button or tail.
5. **Stingers:** a one-bar hit on a sudden picture event, placed off the grid (`hit: true`).
6. **Leave dialogue space.** Under a voice, thin the 1-4 kHz band. Keep the lead low or tacet and let the
   chords carry the harmony.

## 3. Builds and releases

- **Build** with 4-8 bars of rising density, rising register and rising harmonic rhythm (twice as fast
  into the cadence). Use a dominant pedal or a sus chord, fragments of the motif, and a crescendo. End
  on a lean (V, sus4, a breath), never on home.
- **Release:** land on home, on the downbeat, with the most layers, the motif augmented or in full, and
  the climax note.
- **Before the peak, a dip:** a breakdown, a breath or a drum drop-out. Contrast makes the landing
  (the tension curve in [harmony.md](harmony.md), and `craft`'s tension line).
- **Endings:**
  - a held home chord with the motif's last word;
  - a button (a short tutti hit on 1);
  - a fade only for loops;
  - an open hold only for suspense.

### The shape of the whole, measured

A score can have a good tune, good harmony and a clean mix and still feel like it wanders, because
nothing in it is the high point and nothing in it is the rest. `music.mjs check` prints an **ARC** line
from the finished sound (`arc.ts`): the usual level, the loudest moment and how far through it falls,
how far the opening sits under the body, and how far the ending sits under the peak. It is advisory,
like `craft`: answer each finding, or say why the piece is that way on purpose.

- **A soft way in.** The first two or three seconds carry fewer parts and no low drum, 5 to 12 LU under
  the body. Frame 0 still has one sound with a reason: a drone, the first chord. Silence that swells
  in over a bar reads as nothing happening yet.
- **One loudest moment, on the picture's payoff.** At least 2 LU over the usual level, usually a third
  to two thirds of the way through. Pass the payoff's second (`--payoff 13.5`) and the check says if
  the fullest bar is somewhere else. Hold something back until then: the low drum, the top octave, a
  doubling.
- **Contrast is the arc.** A piece of 20 s or more wants a loudness range of 5 to 8 LU. One texture
  from start to finish measures about 2 and feels dense and flat however good each bar is.
- **The ending takes away.** The close is the most resolved moment, never the loudest: stop on a bar
  line, a breath, one soft element, 8 to 20 dB under the peak. A loudest moment in the last fifth is
  flagged.
- **A loop has no beginning or end.** Only its contrast and its seam are read. The join is flagged when
  the last second and the first differ by more than 3 LU and by more than any two neighbouring seconds
  inside the piece: a phrase that ends into a quiet bar is the music, a step found nowhere else is a seam.

## 4. Orchestration: registers and frequency slots

Every instrument owns a register. Two parts in the same register fight (masking, see
[sound.md](sound.md)). Arrange by giving each part its slot:

| Slot | Range (fundamentals) | Who owns it | Rule |
|---|---|---|---|
| Sub | 30-60 Hz (B0-B1) | kick body, 808/sub bass | one owner at a time; mono |
| Bass | 60-250 Hz (B1-B3) | bass, cello/contrabass, piano left hand, tuba | the root; open 5ths and octaves only |
| Low-mid | 250-500 Hz (B3-B4) | chords, pads, guitar body, low brass, male voice | the mud zone: thin it, don't stack it |
| Mid | 500 Hz-2 kHz (B4-B6) | melody, lead, violins, trumpet, flute, female voice | the lead's home; one lead at a time |
| Presence | 2-5 kHz (harmonics) | attacks, consonants, snare crack, pick | what makes parts audible; not everything bright |
| Air | 5-16 kHz | hats, shakers, cymbals, breath, sparkle (celesta, glock) | light touches |

Guidelines:

- **Spacing follows the harmonic series:** wide intervals low, close intervals high (Rimsky-Korsakov
  1913; Adler 2016).
- **Doubling:**
  - an octave doubling adds weight and brightness;
  - a unison doubling adds body and chorus;
  - a melody doubled in the 3rd or 6th sounds sweet (pop, folk);
  - don't double the leading tone or a chord 7th in classical idioms.
- **At most 3-4 families at once** outside the climax, each in its slot. Five simultaneous functions
  is a useful ceiling:
  1. foundation (bass and drums);
  2. pad (sustained harmony);
  3. rhythm (a moving accompaniment);
  4. lead;
  5. fills and counter.

  (Owsinski 2017, the arrangement elements.)
- **Timbre as contrast:** move the motif to a new instrument for the second statement. It is new
  without changing a note.

## 5. Counterpoint basics (a second line that helps)

A counter-melody is a second voice that stays independent (Fux 1725, *Gradus ad Parnassum*; Jeppesen
1939):

- **Move when the melody holds, hold when it moves** (complementary rhythm). The `counterMelody` guard
  asks for at most 50 % shared onsets.
- **Prefer contrary and oblique motion** to the melody. Similar motion into a 5th or octave hides the
  counter.
- **Consonances on strong beats** (3rds, 6ths, 5ths, octaves). Dissonances pass by step on weak beats,
  or are suspensions that resolve down.
- **Its own register**, a 3rd to a 10th away from the tune, and ideally a different timbre.
- **Call and response:** the counter answers in the melody's rests. This is the easiest, most
  idiomatic counterpoint for pop and film.

Sources: Caplin, *Classical Form* (1998); Everett, *The Foundations of Rock* (2009); Karlin & Wright,
*On the Track* (2nd ed., 2004); Davis, *Complete Guide to Film Scoring* (2nd ed., 2010);
Rimsky-Korsakov, *Principles of Orchestration* (1913); Adler, *The Study of Orchestration* (4th ed.,
2016); Owsinski, *The Mixing Engineer's Handbook* (4th ed., 2017); Fux, *Gradus ad Parnassum* (1725);
Jeppesen, *Counterpoint* (1939); Huron, *Sweet Anticipation* (2006).
