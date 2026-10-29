// VOICE. Narration in the film's own mix. The takes arrive baked into the film's bundle
// (tools/narrate.mjs bake writes a module: the timing plus each line as 16-bit PCM in base64), so the
// page never loads a file or touches the network, and a code-built score and the voice are mixed in
// the same place the rest of the film's sound is: Film.audio(sampleRate).
//
//   narrationAudio({ voice, music, ... })   a Film.audio: score ducked under the voice, the voice on its frames, one delivery master
//   mixNarration(music, voice, sr, opts)    the same mix as plain arrays, with the duck curve and the numbers (tests, reports)
//   duckEnvelope(voice, sr, opts)           the music's gain under speech: -9 dB, 40 ms down, 450 ms back up (the ghost film's sidechain)
//   voiceTrack(baked, sr, frames)           every line's take placed at its start frame, as one mono track
//   syncMarks(timing)                       a verify-export sync marker on each line's first word
//
// The ducking dips BEFORE a line starts (a look-ahead the length of the attack), so the first syllable
// never lands on full-level music. Ramps are linear in dB, so the curve is exactly what the numbers say.
import type { FilmAudio } from "./film";
import type { VoiceTiming } from "./subtitles";
import { Biquad, db } from "./music/dsp";
import { deliver, type Delivered, type MasterMode } from "./music/delivery";
import { loudness } from "./music/meter";

/** What `narrate.mjs bake` writes: the timing and each line's take (16-bit little-endian mono PCM, base64). */
export type BakedVoice = { timing: VoiceTiming; sampleRate: number; pcm: Record<string, string> };
export type DuckOpts = { depthDb?: number; attackMs?: number; releaseMs?: number; holdMs?: number; thresholdDb?: number };
export type NarrationOpts = DuckOpts & { musicDb?: number; voiceDb?: number; master?: MasterMode; ceilingDb?: number };
type Stereo = [Float32Array, Float32Array];

/** base64 16-bit little-endian PCM -> Float32 in [-1, 1). */
export const decodePcm16 = (b64: string) => {
  const s = atob(b64), n = s.length >> 1, out = new Float32Array(n);
  for (let i = 0; i < n; i++) { let v = s.charCodeAt(2 * i) | (s.charCodeAt(2 * i + 1) << 8); if (v >= 32768) v -= 65536; out[i] = v / 32768; }
  return out;
};
/** Resample by cubic (Catmull-Rom) interpolation; a low-pass first when going down, so nothing folds back. */
export const resample = (x: Float32Array, from: number, to: number) => {
  if (from === to) return x;
  const src = Float32Array.from(x);
  if (to < from) for (const q of [0.5412, 1.3066]) Biquad.make(from, "lp", to * 0.45, q).run(src);
  const n = Math.round((x.length * to) / from), out = new Float32Array(n), at = (i: number) => src[Math.max(0, Math.min(src.length - 1, i))];
  for (let i = 0; i < n; i++) {
    const p = (i * from) / to, j = Math.floor(p), f = p - j, y0 = at(j - 1), y1 = at(j), y2 = at(j + 1), y3 = at(j + 2);
    out[i] = y1 + 0.5 * f * (y2 - y0 + f * (2 * y0 - 5 * y1 + 4 * y2 - y3 + f * (3 * (y1 - y2) + y3 - y0)));
  }
  return out;
};

// Decoded takes, keyed on the take's own base64 text and then on (source rate, target rate). Keying on the
// exact text means two voices that share a line id and a take length can never be served each other's take.
const decoded = new Map<string, Map<string, Float32Array>>();
/** Every line's take on one mono track of `frames` film frames, each starting exactly on its start frame. */
export const voiceTrack = (v: BakedVoice, sr: number, frames = v.timing.totalFrames) => {
  const fps = v.timing.fps, out = new Float32Array(Math.round((frames / fps) * sr));
  for (const ln of v.timing.lines) {
    const b64 = v.pcm[ln.id]; if (!b64) throw new Error(`voice: no take for line '${ln.id}' (re-run narrate.mjs bake)`);
    let rates = decoded.get(b64); if (!rates) { rates = new Map(); decoded.set(b64, rates); }
    const key = `${v.sampleRate}>${sr}`;
    let x = rates.get(key); if (!x) { x = resample(decodePcm16(b64), v.sampleRate, sr); rates.set(key, x); }
    const at = Math.round((ln.start / fps) * sr);
    for (let i = 0; i < x.length && at + i < out.length; i++) out[at + i] += x[i];
  }
  return out;
};

/**
 * The music's gain (linear, one value per sample) under a voice track: depthDb while the voice speaks
 * (RMS over 5 ms above thresholdDb, held holdMs across the small gaps between words), reached in
 * attackMs and given back over releaseMs, both as straight lines in dB. The dip starts attackMs
 * before the voice, so speech never starts over full-level music.
 */
export const duckEnvelope = (voice: Float32Array, sr: number, o: DuckOpts = {}) => {
  const depth = o.depthDb ?? -9, att = Math.max(1, ((o.attackMs ?? 40) / 1000) * sr), rel = Math.max(1, ((o.releaseMs ?? 450) / 1000) * sr);
  const hold = Math.round(((o.holdMs ?? 120) / 1000) * sr), thr = db(o.thresholdDb ?? -42), hop = Math.max(1, Math.round(0.005 * sr)), n = voice.length;
  const speaking = new Uint8Array(n);
  let lastOn = -Infinity;
  for (let i = 0; i < n; i += hop) {
    let s = 0; const e = Math.min(n, i + hop); for (let k = i; k < e; k++) s += voice[k] * voice[k];
    const on = Math.sqrt(s / (e - i)) > thr; if (on) lastOn = e;
    if (on || i < lastOn + hold) for (let k = i; k < e; k++) speaking[k] = 1;
  }
  // look ahead by the attack: the target falls `att` samples before the voice does
  const ahead = Math.round(att), target = new Float32Array(n);
  for (let i = 0; i < n; i++) target[i] = speaking[Math.min(n - 1, i + ahead)] || speaking[i] ? depth : 0;
  const g = new Float32Array(n), down = -depth / att, up = -depth / rel;
  let cur = 0;
  for (let i = 0; i < n; i++) { const t = target[i]; cur = t < cur ? Math.max(t, cur - down) : Math.min(t, cur + up); g[i] = db(cur); }
  return g;
};

/**
 * Score + voice -> one delivered stereo mix. music may be null (a voice-only piece). The score is set
 * musicDb under its own level, ducked under the voice, the voice laid in the middle, and the whole mix
 * goes through the delivery master (-16 LUFS gentle, -1 dBTP ceiling) that verify-export --delivery accepts.
 */
export const mixNarration = (music: Stereo | null, voice: Float32Array, sr: number, o: NarrationOpts = {}) => {
  const n = voice.length, duck = duckEnvelope(voice, sr, o), mg = db(o.musicDb ?? -6), vg = db(o.voiceDb ?? 0);
  const L = new Float32Array(n), R = new Float32Array(n), mL = new Float32Array(n), mR = new Float32Array(n);
  if (music) for (let i = 0; i < n && i < music[0].length; i++) { mL[i] = music[0][i] * mg * duck[i]; mR[i] = music[1][i] * mg * duck[i]; }
  for (let i = 0; i < n; i++) { const v = voice[i] * vg; L[i] = mL[i] + v; R[i] = mR[i] + v; }
  // speech over music, measured where the voice speaks, before the master (the master moves both alike)
  const margin = speechOverMusic(voice, vg, [mL, mR], duck, sr);
  const delivered: Delivered = deliver(L, R, sr, o.master ?? "gentle", { ceilingDb: (o.ceilingDb ?? -1) - 0.3 });
  const fade = Math.min(n, Math.round(0.015 * sr)); for (let i = 0; i < fade; i++) { const g = i / fade; L[n - 1 - i] *= g; R[n - 1 - i] *= g; }
  return { L, R, duck, delivered, speechOverMusicDb: margin };
};
// K-weighted loudness of the voice and of the ducked music over the samples where the duck is fully down
const speechOverMusic = (voice: Float32Array, vg: number, music: Stereo, duck: Float32Array, sr: number) => {
  let lo = 1; for (let i = 0; i < duck.length; i++) if (duck[i] < lo) lo = duck[i];
  const floor = lo * 1.01, ix: number[] = []; for (let i = 0; i < duck.length; i++) if (duck[i] <= floor) ix.push(i);
  if (ix.length < sr * 0.4) return NaN;
  const v = new Float32Array(ix.length), a = new Float32Array(ix.length), b = new Float32Array(ix.length);
  ix.forEach((k, j) => { v[j] = voice[k] * vg; a[j] = music[0][k]; b[j] = music[1][k]; });
  return loudness([v, v], sr).integrated - loudness([a, b], sr).integrated;
};

/** A Film.audio with narration: `music` is the film's score (filmAudio(piece, s) keeps its .scores for the hosts). */
export const narrationAudio = (p: { voice: BakedVoice; music?: FilmAudio | ((sr: number) => Stereo) | null; frames?: number } & NarrationOpts): FilmAudio => {
  const frames = p.frames ?? p.voice.timing.totalFrames;
  const fn = (sr: number): Stereo => { const m = mixNarration(p.music ? p.music(sr) : null, voiceTrack(p.voice, sr, frames), sr, p); return [m.L, m.R]; };
  return Object.assign(fn, { scores: (p.music as FilmAudio | undefined)?.scores });
};

/** One verify-export sync marker per line, on its first word (the onset check then measures the voice's attack). */
export const syncMarks = (t: VoiceTiming) => t.lines.map((l) => ({ frame: l.words[0]?.from ?? l.start, label: `voice ${l.id}` }));
