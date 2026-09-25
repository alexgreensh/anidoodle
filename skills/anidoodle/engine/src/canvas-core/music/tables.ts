// The spec-08 tables as DATA: moods (section 5), styles (section 6), melody types (section 4).
// A film names rows; it never writes adjectives. Every row starts `unconfirmed` until a human
// has listened to 8 seconds of it (spec 08 section 11): the listener's words go in `confirmedBy`.
import type { ModeId } from "./theory";

export type MelodyType = "arpeggio" | "stepwise" | "hook" | "ostinato" | "drone" | "callResponse" | "counterMelody" | "sequence" | "themeTransformation";
export type Family = "piano" | "musicBox" | "celesta" | "mallets" | "pluck" | "harp" | "guitar" | "strings" | "fmBell" | "ePiano" | "chip" | "drums" | "organ" | "bass";
export type Range = [number, number];
export type Mood = {
  id: MoodId; modes: ModeId[]; tempo: Range; meters: string[]; harmonicRhythmBars: Range; register: Range;
  onsetsPerBeat: Range; attackMs: Range; lra: Range; centroidHz: Range | null; families: Family[]; melody: MelodyType[];
  master: "gentle" | "dense"; confirmedBy?: { date: string; words: string };
};
export type MoodId = "joy" | "playful" | "tender" | "wistful" | "melancholy" | "hopeful" | "curious" | "tension" | "dread" | "awe" | "triumph" | "drive" | "calm" | "nostalgic" | "romantic";

// centroid null = report only (spec 08 drive row; ADVISORY 4.1: piano brightness is never gated).
export const MOODS: Record<MoodId, Mood> = {
  joy: { id: "joy", modes: ["major", "mixolydian", "majorPentatonic"], tempo: [110, 150], meters: ["4/4", "12/8"], harmonicRhythmBars: [1, 1], register: [72, 96], onsetsPerBeat: [2, 4], attackMs: [2, 10], lra: [4, 8], centroidHz: [1800, 6000], families: ["musicBox", "mallets", "pluck", "piano"], melody: ["arpeggio", "hook"], master: "gentle" },
  playful: { id: "playful", modes: ["major", "blues", "majorPentatonic"], tempo: [120, 160], meters: ["4/4"], harmonicRhythmBars: [0.25, 0.5], register: [60, 90], onsetsPerBeat: [2, 4], attackMs: [2, 5], lra: [6, 10], centroidHz: [1500, 6000], families: ["pluck", "mallets", "fmBell", "bass", "chip"], melody: ["hook", "callResponse"], master: "dense" },
  tender: { id: "tender", modes: ["major", "lydian"], tempo: [60, 80], meters: ["3/4", "6/8"], harmonicRhythmBars: [1, 2], register: [64, 84], onsetsPerBeat: [1, 2], attackMs: [5, 30], lra: [6, 12], centroidHz: null, families: ["piano", "harp", "strings", "organ"], melody: ["stepwise", "counterMelody"], master: "gentle" },
  wistful: { id: "wistful", modes: ["dorian", "major"], tempo: [70, 95], meters: ["6/8", "4/4"], harmonicRhythmBars: [1, 1], register: [64, 86], onsetsPerBeat: [1.5, 3], attackMs: [5, 20], lra: [6, 10], centroidHz: [1000, 2000], families: ["piano", "musicBox", "strings"], melody: ["stepwise", "themeTransformation"], master: "gentle" },
  melancholy: { id: "melancholy", modes: ["aeolian", "harmonicMinor"], tempo: [50, 72], meters: ["3/4", "4/4"], harmonicRhythmBars: [1, 2], register: [55, 80], onsetsPerBeat: [0.75, 1.5], attackMs: [20, 80], lra: [8, 14], centroidHz: null, families: ["piano", "strings"], melody: ["stepwise", "drone"], master: "gentle" },
  hopeful: { id: "hopeful", modes: ["melodicMinor", "major"], tempo: [80, 110], meters: ["4/4"], harmonicRhythmBars: [1, 1], register: [60, 88], onsetsPerBeat: [1.5, 3], attackMs: [10, 40], lra: [8, 12], centroidHz: null, families: ["piano", "strings", "fmBell"], melody: ["sequence", "stepwise"], master: "gentle" },
  curious: { id: "curious", modes: ["dorian", "lydian", "wholeTone"], tempo: [80, 110], meters: ["4/4", "6/8"], harmonicRhythmBars: [1, 2], register: [60, 84], onsetsPerBeat: [1, 2], attackMs: [2, 10], lra: [6, 10], centroidHz: [1000, 2000], families: ["pluck", "celesta", "fmBell"], melody: ["ostinato", "hook"], master: "gentle" },
  tension: { id: "tension", modes: ["harmonicMinor", "phrygian"], tempo: [90, 130], meters: ["4/4"], harmonicRhythmBars: [2, 4], register: [48, 72], onsetsPerBeat: [2, 4], attackMs: [2, 10], lra: [10, 16], centroidHz: [800, 1500], families: ["strings", "drums", "bass"], melody: ["ostinato", "drone"], master: "dense" },
  dread: { id: "dread", modes: ["phrygian", "aeolian", "locrian"], tempo: [50, 80], meters: ["4/4"], harmonicRhythmBars: [4, 4], register: [36, 60], onsetsPerBeat: [0.5, 1.5], attackMs: [50, 200], lra: [12, 18], centroidHz: [0, 1000], families: ["bass", "piano", "strings"], melody: ["drone"], master: "gentle" },
  awe: { id: "awe", modes: ["lydian", "major"], tempo: [60, 90], meters: ["4/4", "3/4"], harmonicRhythmBars: [2, 2], register: [72, 100], onsetsPerBeat: [1, 3], attackMs: [5, 400], lra: [10, 16], centroidHz: null, families: ["fmBell", "strings", "harp", "organ", "piano"], melody: ["arpeggio", "drone", "themeTransformation"], master: "gentle" },
  triumph: { id: "triumph", modes: ["major", "aeolian"], tempo: [100, 140], meters: ["4/4"], harmonicRhythmBars: [1, 1], register: [60, 90], onsetsPerBeat: [3, 6], attackMs: [2, 10], lra: [6, 10], centroidHz: [1500, 6000], families: ["drums", "strings", "organ"], melody: ["hook", "themeTransformation"], master: "dense" },
  drive: { id: "drive", modes: ["aeolian", "dorian", "mixolydian"], tempo: [110, 140], meters: ["4/4"], harmonicRhythmBars: [1, 1], register: [60, 86], onsetsPerBeat: [4, 8], attackMs: [1, 5], lra: [4, 8], centroidHz: null, families: ["drums", "bass", "pluck"], melody: ["hook", "arpeggio", "ostinato"], master: "dense" },
  calm: { id: "calm", modes: ["mixolydian", "majorPentatonic", "major"], tempo: [60, 90], meters: ["6/8", "3/4"], harmonicRhythmBars: [2, 2], register: [60, 84], onsetsPerBeat: [1, 2], attackMs: [5, 30], lra: [4, 8], centroidHz: [1000, 2000], families: ["guitar", "fmBell"], melody: ["stepwise", "drone"], master: "gentle" },
  nostalgic: { id: "nostalgic", modes: ["major"], tempo: [70, 95], meters: ["4/4"], harmonicRhythmBars: [0.5, 1], register: [60, 84], onsetsPerBeat: [1.5, 3], attackMs: [5, 20], lra: [6, 10], centroidHz: [900, 1600], families: ["ePiano", "drums", "bass"], melody: ["stepwise", "hook"], master: "dense" },
  romantic: { id: "romantic", modes: ["major", "aeolian"], tempo: [60, 85], meters: ["3/4", "4/4"], harmonicRhythmBars: [1, 1], register: [60, 88], onsetsPerBeat: [1, 2.5], attackMs: [10, 60], lra: [8, 14], centroidHz: [1000, 2000], families: ["piano", "strings"], melody: ["stepwise", "counterMelody"], master: "gentle" },
};

/** Blends the gate refuses (spec 08 section 5): use consecutive sections instead. */
export const REFUSED_BLENDS: [MoodId, MoodId][] = [["joy", "dread"], ["playful", "melancholy"], ["calm", "tension"]];
export const ARCS: Record<string, MoodId[]> = { rise: ["melancholy", "hopeful", "triumph"], turn: ["joy", "tension", "joy"], fallAndReturn: ["tender", "melancholy", "tender"], wonder: ["curious", "awe"], comic: ["playful", "tension", "playful"] };

export type StyleId = "musicBox" | "nocturne" | "drive" | "cinematic" | "chiptune" | "lofi" | "folk" | "minimalist" | "jazz" | "lullaby" | "ambient";
export type Style = { id: StyleId; tempo: Range; meters: string[]; families: Family[]; moods: MoodId[]; master: "gentle" | "dense"; arrangement: string; guards: string[]; reverb: "none" | "room" | "hall"; swing?: Range };
export const STYLES: Record<StyleId, Style> = {
  musicBox: { id: "musicBox", tempo: [110, 130], meters: ["12/8"], families: ["musicBox", "fmBell"], moods: ["joy", "curious", "tender", "playful", "wistful"], master: "gentle", reverb: "room", arrangement: "melody -> +bass -> +arp -> +octave sparkle -> bell", guards: ["pluck-only instruments", "more notes, never longer notes"] },
  nocturne: { id: "nocturne", tempo: [50, 72], meters: ["3/4", "6/8"], families: ["piano", "strings"], moods: ["tender", "melancholy", "wistful", "romantic"], master: "gentle", reverb: "room", arrangement: "left-hand broken chords spanning a tenth, right-hand stepwise theme", guards: ["rubato <= 8% of a beat", "no close thirds below C3"] },
  drive: { id: "drive", tempo: [110, 140], meters: ["4/4"], families: ["drums", "bass", "pluck", "strings"], moods: ["drive", "triumph", "tension", "awe"], master: "dense", reverb: "hall", arrangement: "riser, breath, drop", guards: ["phone rule: every low part has content above 500 Hz"] },
  cinematic: { id: "cinematic", tempo: [60, 120], meters: ["4/4", "3/4"], families: ["strings", "piano", "harp", "fmBell", "drums"], moods: ["awe", "triumph", "melancholy", "tension", "hopeful"], master: "gentle", reverb: "hall", arrangement: "layered by register slot; crescendos over 4-8 bars", guards: ["max 4 families at once outside climaxes"] },
  chiptune: { id: "chiptune", tempo: [120, 160], meters: ["4/4"], families: ["chip"], moods: ["joy", "playful", "drive", "tension"], master: "dense", reverb: "none", arrangement: "2 pulses, triangle bass, noise drums; fast arpeggios fake chords", guards: ["<= 4 voices", "no reverb", "PolyBLEP pulses"] },
  lofi: { id: "lofi", tempo: [70, 90], meters: ["4/4"], families: ["ePiano", "drums", "bass"], moods: ["nostalgic", "calm", "wistful"], master: "dense", reverb: "room", swing: [0.55, 0.62], arrangement: "4 or 8 bar loop with small variations", guards: ["no 2 consecutive identical 8-bar blocks", "master low-pass <= 9 kHz allowed"] },
  folk: { id: "folk", tempo: [80, 120], meters: ["6/8", "3/4", "4/4"], families: ["guitar", "harp", "fmBell"], moods: ["calm", "wistful", "joy", "nostalgic"], master: "gentle", reverb: "room", arrangement: "fingerpicked pattern + lead", guards: ["strum spread 10-30 ms low to high"] },
  minimalist: { id: "minimalist", tempo: [100, 140], meters: ["4/4", "12/8"], families: ["mallets", "piano"], moods: ["curious", "tension", "awe"], master: "gentle", reverb: "room", arrangement: "interlocking ostinatos; one change every 8-16 bars", guards: ["a change at least every 16 bars"] },
  jazz: { id: "jazz", tempo: [90, 180], meters: ["4/4"], families: ["piano", "bass", "drums"], moods: ["playful", "nostalgic", "romantic", "curious"], master: "gentle", reverb: "room", swing: [0.6, 0.67], arrangement: "walking bass on quarters, comping off the beat", guards: ["7th chords required"] },
  lullaby: { id: "lullaby", tempo: [60, 75], meters: ["3/4", "6/8"], families: ["musicBox", "celesta", "piano", "harp"], moods: ["tender", "calm"], master: "gentle", reverb: "room", arrangement: "melody + gentle arp, nothing percussive", guards: ["minor lullaby flagged for the human check"] },
  ambient: { id: "ambient", tempo: [50, 80], meters: ["4/4"], families: ["strings", "fmBell", "organ"], moods: ["awe", "calm", "dread"], master: "gentle", reverb: "hall", arrangement: "slow evolution", guards: ["melodic motif at least every 8 bars", "composite ghost check"] },
};

export const MELODY_TYPES: Record<MelodyType, { construction: string; guards: string }> = {
  arpeggio: { construction: "chord tones in a fixed pattern, one per subdivision", guards: "follows every chord change; range <= 17" },
  stepwise: { construction: "step ratio >= 0.7; leaps onto chord tones, stepped back", guards: "range <= 12 per phrase; one high point, in the second half" },
  hook: { construction: "a 2-5 note cell with a distinctive rhythm, repeated and varied", guards: "repetition index 0.4-0.75; returns in the final section" },
  ostinato: { construction: "a fixed 1-2 bar pattern bent to chord tones", guards: "something above it changes every 8 bars" },
  drone: { construction: "tonic or fifth held or re-struck under moving harmony", guards: "re-articulated every 4 bars" },
  callResponse: { construction: "question off the tonic answered on it, new register or instrument", guards: "answer within 1 bar" },
  counterMelody: { construction: "moves when the main line holds, mostly contrary", guards: "shared onsets <= 50%" },
  sequence: { construction: "a 1-2 bar cell repeated a step up or down", guards: "max 3 repeats, then break" },
  themeTransformation: { construction: "the main theme re-cut for a new mood", guards: "contour correlation >= 0.8" },
};
