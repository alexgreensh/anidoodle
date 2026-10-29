// A FILM'S EFFECTS OVER SOMEONE ELSE'S MUSIC. The engine's mix (launchSound.mixLaunch: panned cues,
// the score ducked under the ones that matter, every cue measured against the music at its own moment
// and raised until it is heard, the dense delivery master) applied to a generated or supplied track,
// plus the three rules a brand launch film learned by ear:
//   1. Effects are transients, never notes. A tuned kind (a chime, a tuned riser, impact:bloom,
//      press:confirm) is refused, and every placed sound's pitch salience must stay under 0.5.
//      A cue may carry a note only when `pitched` says why in words.
//   2. Every cue is heard: the buried-cue guard measures the track's local loudness at each cue (the
//      film's effects stem once sat 29 dB under the music and nobody could tell without listening).
//   3. The music never ends before the picture: the track's last audible moment must reach the film's end.
// Pure: arrays in, arrays out. tools/track.mjs mix reads the files.
import { mixLaunch, type LaunchCue } from "../launchSound";
import { sfxNeeds, SFX, SFX_KINDS, type SfxKind } from "./sfxKit";
import type { SfxCue, SfxPlan, PlacedCue, SfxAudibility } from "./sfxMix";
import type { Delivered } from "./delivery";
import { pitchSalience, lastSoundOf, monoOf, PITCHED, type Stereo } from "./track";

export type TrackCue = SfxCue & {
  /** stereo position -1 (left) .. 1 (right) */
  pan?: number;
  /** why this cue may carry a note under the track (a deliberate musical button). Without it, a pitched cue fails. */
  pitched?: string;
};
export type TrackPlan = Omit<SfxPlan, "cues" | "score" | "key"> & { cues: TrackCue[] };
export type TrackMix = {
  L: Float32Array; R: Float32Array; sfx: Stereo; placed: PlacedCue[]; audibility: SfxAudibility[];
  raised: { i: number; db: number }[];
  pitch: { i: number; label: string; kind: string; salience: number; hz: number; ringMs: number; allowed?: string; ok: boolean }[];
  ending: { musicEndS: number; filmS: number; ok: boolean; msg?: string };
  lufs: number; dbtp: number; delivered?: Delivered; ok: boolean; problems: string[];
};

/** "tap:thump -9 pan=0.3" -> { kind, variant, gainDb, pan }. Gain is optional, in dB on top of the kind's level. */
export const parseSoundSpec = (spec: string): Omit<TrackCue, "frame"> => {
  const parts = String(spec).trim().split(/\s+/), [kind, variant] = parts[0].split(":");
  if (!(kind in SFX)) throw new Error(`sound "${spec}": unknown kind "${kind}" (kinds: ${SFX_KINDS.join(", ")})`);
  const k = kind as SfxKind;
  if (variant !== undefined && !SFX[k].variants.includes(variant)) throw new Error(`sound "${spec}": ${kind} has no variant "${variant}" (variants: ${SFX[k].variants.join(", ")})`);
  const out: Omit<TrackCue, "frame"> = { kind: k, variant };
  for (const p of parts.slice(1)) {
    const m = /^(pan|duck|snap)=(.+)$/.exec(p);
    if (m) { if (m[1] === "pan") out.pan = Number(m[2]); else if (m[1] === "duck") out.duckDb = Number(m[2]); else out.snap = m[2] as TrackCue["snap"]; continue; }
    if (/^[+-]?\d+(\.\d+)?$/.test(p)) { out.gainDb = Number(p); continue; }
    throw new Error(`sound "${spec}": cannot read "${p}" (write e.g. "tap:thump -9 pan=0.3")`);
  }
  if (out.pan !== undefined && !(out.pan >= -1 && out.pan <= 1)) throw new Error(`sound "${spec}": pan must be -1..1`);
  return out;
};

/** Refuse tuned kinds under a track the engine does not control, unless the cue says why. */
export const checkTrackCues = (plan: TrackPlan) => {
  plan.cues.forEach((c, i) => {
    const v = c.variant ?? SFX[c.kind]?.variants[0];
    if (c.kind in SFX && sfxNeeds(c.kind, v, c).key && !c.pitched?.trim())
      throw new Error(`track mix: cue #${i} ${c.kind}:${v}${c.label ? ` "${c.label}"` : ""} is tuned to a key, and the music here is a track the engine did not write: under someone else's music, effects are transients, never notes. Use tap:${c.kind === "impact" ? "impact" : "tock"} (or another tap variant), or set pitched: "<why this note belongs>"`);
  });
};

export const mixOverTrack = (music: Stereo | null, plan: TrackPlan, sr = 48000, o: { maxRaiseDb?: number } = {}): TrackMix => {
  checkTrackCues(plan);
  const filmS = plan.frames / plan.fps, n = Math.round(filmS * sr), problems: string[] = [];
  const cues: LaunchCue[] = plan.cues.map((c) => ({ ...c, role: "land", x: c.pan === undefined ? undefined : (c.pan + 1) / 2 }));
  const m = mixLaunch(music, { ...plan, cues, W: 1, spread: 1, master: plan.master ?? "dense" }, sr, o.maxRaiseDb ?? 8);
  // the effects stem, rebuilt from the placed (panned, raised) sounds
  const fx: Stereo = [new Float32Array(n), new Float32Array(n)];
  for (const pc of m.placed) for (let i = 0; i < pc.sound.L.length && pc.start + i < n; i++) { fx[0][pc.start + i] += pc.sound.L[i]; fx[1][pc.start + i] += pc.sound.R[i]; }
  const pitch = m.placed.map((pc) => {
    const c = plan.cues[pc.i], p = pitchSalience(monoOf(pc.sound.L, pc.sound.R), sr), allowed = c.pitched?.trim() || undefined;
    return { i: pc.i, label: c.label ?? `${c.kind}:${pc.sound.variant}`, kind: `${c.kind}:${pc.sound.variant}`, salience: p.salience, hz: p.hz, ringMs: p.ringMs, allowed, ok: !!allowed || p.salience <= PITCHED };
  });
  for (const p of pitch) if (!p.ok) problems.push(`cue #${p.i} "${p.label}" (${p.kind}) carries a note (pitch salience ${p.salience.toFixed(2)} at ${p.hz} Hz, rings ${p.ringMs} ms): use a tap variant, or set pitched with the reason`);
  for (const a of m.audibility) if (!a.ok) problems.push(`cue #${a.i} "${a.label}" is buried ${a.marginDb.toFixed(1)} dB under the track at ${a.atS.toFixed(2)} s even after raising it 8 dB: give it a bigger kind (tock, thump) or a duck`);
  const musicEndS = music ? Math.min(lastSoundOf(music[0], music[1], sr), music[0].length / sr) : 0;
  const ending = { musicEndS: +musicEndS.toFixed(3), filmS: +filmS.toFixed(3), ok: !music || musicEndS >= filmS - 0.3, msg: undefined as string | undefined };
  if (!ending.ok) { ending.msg = `the music ends at ${musicEndS.toFixed(2)} s and the picture at ${filmS.toFixed(2)} s: ${(filmS - musicEndS).toFixed(2)} s of silence at the end. Extend the outro by whole bars (track.mjs cut --film-s ${filmS.toFixed(2)}) or end the picture with the music`; problems.push(ending.msg); }
  return { L: m.L, R: m.R, sfx: fx, placed: m.placed, audibility: m.audibility, raised: m.raised.map(({ i, db }) => ({ i, db })), pitch, ending, lufs: m.lufs, dbtp: m.dbtp, delivered: m.delivered, ok: !problems.length, problems };
};

/** The mix as a table a person reads: each cue's margin over the track, any raise, its pitch salience; then the problems. */
export const trackMixReport = (m: TrackMix) => {
  const o = [`MIX OVER TRACK  ${m.placed.length} cues, ${m.lufs.toFixed(1)} LUFS, ${m.dbtp.toFixed(2)} dBTP; music ends ${m.ending.musicEndS} s, picture ${m.ending.filmS} s`];
  o.push(`  ${"at s".padStart(7)}  ${"cue".padEnd(26)} ${"kind".padEnd(13)} ${"margin".padStart(7)} ${"raised".padStart(7)} ${"pitch".padStart(6)}`);
  const raised = new Map(m.raised.map((r) => [r.i, r.db]));
  m.audibility.forEach((a, k) => { const p = m.pitch[k]; o.push(`  ${a.atS.toFixed(2).padStart(7)}  ${String(a.label || p.label).slice(0, 26).padEnd(26)} ${p.kind.padEnd(13)} ${a.marginDb.toFixed(1).padStart(6)}  ${(raised.has(a.i) ? "+" + raised.get(a.i)!.toFixed(1) : "").padStart(7)} ${p.salience.toFixed(2).padStart(6)}${a.ok && p.ok ? "" : "  <-"}`); });
  for (const p of m.problems) o.push(`  FAIL  ${p}`);
  return o.join("\n");
};
