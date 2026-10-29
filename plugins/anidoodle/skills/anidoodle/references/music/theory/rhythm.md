# Rhythm and groove

**Contents:** 1. Metric hierarchy · 2. Syncopation · 3. The backbeat and core patterns · 4. Swing and feel · 5. Polyrhythm and hemiola · 6. Fills and transitions · 7. Density arcs · 8. Rhythm in the melody · 9. Humanize or quantize

Positions are beats in the bar (`1`, `1&` = the eighth after it, `1e&a` = sixteenths). In 6/8 and 12/8 a
beat is a dotted quarter. `craft` measures this page on the **rhythm** line.

## 1. Metric hierarchy

Beats nest into levels, and a stronger level is heard as more important (Lerdahl & Jackendoff 1983;
London 2012). `craft` weights positions this way:

| Position | 4/4 | 3/4 | 6/8, 12/8 | weight |
|---|---|---|---|---|
| downbeat | 1 | 1 | 1 | 4 |
| mid-bar | 3 | - | 7 (12/8) | 3 |
| beats | 2, 4 | 2, 3 | the dotted quarters | 2 |
| eighths | the `&`s | the `&`s | each eighth | 1 |
| sixteenths | `e`, `a` | `e`, `a` | the sixteenths | 0 |

Rules that follow from it:

- Arrivals (cadences, section starts, the climax) go on downbeats.
- Chord changes go on strong beats.
- What sits on weak positions is motion.

## 2. Syncopation

A syncopation is an onset on a weak position followed by silence or a tie over a stronger one: the
expected accent is displaced (Longuet-Higgins & Lee 1984). `craft` reports a syncopation index per
layer: melody, bass, and kick+snare.

- **The inverted U.** Medium syncopation makes people most want to move and enjoy it most. Too
  little is stiff, too much loses the beat (Witek et al. 2014).
- In groove idioms (lo-fi, hip-hop, house, funk, pop, jazz), `craft` warns when nothing is syncopated.
  Anticipate the bass or a melody note by an eighth, or tie over beat 3.
- Keep the **kick and backbeat anchored**, and syncopate on top of them. If everything is
  syncopated, nothing is.

## 3. The backbeat and core patterns

| Idiom | Kick | Snare / clap | Hats |
|---|---|---|---|
| Rock / pop | 1, 3 (plus pushes on `2&` or `3&`) | 2, 4 | eighths |
| Four on the floor (house, disco) | every beat | 2, 4 | off-beat `&` open hat |
| Hip-hop / boom bap | 1, `2&`, `3&` (varies) | 2, 4, lazy (late) | swung eighths or sixteenths |
| Half-time (trap, cinematic) | 1, `3a` | 3 | fast sixteenths and triplet rolls |
| Lo-fi | loose 1 and `3&` | 2, 4, soft and late | swung, quiet |
| Waltz 3/4 | 1 | 2, 3 (or brushes) | - |
| 6/8 gallop | 1, 4 | 4 (or 2 and 5) | eighths |

Write your own, and let the family be the idiom rather than the notes. `craft`'s **groove consistency**
compares each bar's kick and snare with the section's commonest bar. Below 0.45 the groove never
settles. Hold the kick and backbeat, and vary the hats and the fill bar.

## 4. Swing and feel

- **Swing ratio** = long:short eighth. 1:1 is straight, 2:1 is triplet, 3:1 is dotted.
- Jazz drummers swing **harder at slow tempos and straighter at fast ones**: up to about 3.5:1 slow,
  down to about 1:1 fast. The short note stays near 100 ms (Friberg & Sundström 2002).
- The engine's `swing` is the long note's share: 0.5 straight, 0.58 is about 1.4:1, 0.67 is triplet.
  Typical settings:
  - lo-fi and hip-hop 0.54-0.62 (sixteenth swing);
  - jazz 0.6-0.67 (eighths, less at fast tempos);
  - house 0.5-0.56;
  - rock and orchestral 0.5.
- **Push and lay back:** hats slightly early drive, a snare 10-25 ms late relaxes (the "lazy"
  hip-hop and lo-fi backbeat), and the kick stays on the grid. The engine's `perform` applies per-lane
  feel. You choose the style and swing.

## 5. Polyrhythm and hemiola

- **Hemiola:** 3 against 2. Two bars of 3/4 regrouped as three bars of 2/4 is the classic cadence
  approach, and it drives any ending.
- **3 over 4:** a three-note cell in running sixteenths realigns every 3 beats. It gives motion
  without changing the tempo, as in minimalism and tension cues.
- **Odd meters:** 7/8 = 2+2+3, 5/4 = 3+2. Accent the group starts so the ear can count.

## 6. Fills and transitions

- A fill goes on the **last bar (or half bar) of a section**, never in the middle of a phrase. It ends
  **on the next downbeat** with a crash or an arrival.
- Build to a landing:
  1. density rises (eighths to sixteenths);
  2. the snare rolls up;
  3. a beat or a bar of silence (the breath) comes just before the drop.

  The silence makes the landing bigger (Huron 2006, the tension-contrast effect).
- One fill per 4-8 bars. More turns into noise.

## 7. Density arcs

- Section contrast is mostly density: layers in and out, and onsets per beat. `craft` prints each
  section's onsets per beat and layer count. It warns when every section is the same, and when a
  section repeats the previous one note for note (dead air).
- A good arc:
  1. sparse intro;
  2. medium verse;
  3. the hook adds a layer;
  4. the breakdown thins to one or two;
  5. the drop brings everything;
  6. the outro thins again.

## 8. Rhythm in the melody

A line with **one repeated rhythm and a few changes** is memorable. The same pitches with a new rhythm
are a new tune (this is why the novelty fingerprint weighs rhythm most). Vary one axis at a time.

## 9. Humanize or quantize

- Machines are perfectly on grid. Players deviate in **correlated** ways (drifting ahead or behind for
  several notes, 1/f-like), and listeners prefer that to random jitter (Hennig et al. 2011).
- Random jitter is not feel: listeners do not rate randomly microtimed grooves above quantized ones
  (Frühauf, Kopiez & Platz 2013; Senn et al. 2016).
- The engine: `perform` adds correlated micro-timing and per-lane feel. Grid parts (music box,
  chiptune, drive) stay mechanical on purpose. Velocity (`@0.6`) carries accents: write strong-weak
  patterns (ghost notes at 0.3-0.5) instead of hoping the performer invents them.

Sources: Lerdahl & Jackendoff, *A Generative Theory of Tonal Music* (1983); London, *Hearing in Time*
(2nd ed., 2012); Longuet-Higgins & Lee, "The rhythmic interpretation of monophonic music", *Music
Perception* 1 (1984); Witek et al., "Syncopation, body-movement and pleasure in groove music", *PLoS
ONE* 9 (2014); Friberg & Sundström, "Swing ratios and ensemble timing in jazz performance", *Music
Perception* 19 (2002); Hennig et al., "The nature and perception of fluctuations in human musical
rhythms", *PLoS ONE* 6 (2011); Frühauf, Kopiez & Platz, "Music on the timing grid", *Musicae
Scientiae* 17 (2013); Senn et al., "The effect of expert performance microtiming on listeners'
experience of groove in swing or funk music", *Frontiers in Psychology* 7 (2016); Huron, *Sweet Anticipation* (2006).
