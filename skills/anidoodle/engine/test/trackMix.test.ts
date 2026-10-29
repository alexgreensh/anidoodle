// MIX OVER A TRACK TESTS. Effects under someone else's music: tuned kinds refused, every placed sound
// checked for a note, buried cues raised or failed, the music never ending before the picture, and the
// dense master.   node tools/test.mjs trackMix
import { mixOverTrack, parseSoundSpec, checkTrackCues, type TrackPlan } from "../src/canvas-core/music/trackMix";
import { renderSfx, sfxNeeds, sfxDuckDb } from "../src/canvas-core/music/sfxKit";

export const name = "mix over an external track";
export const run = (ok: (cond: boolean, label: string) => void) => {
  const throws = (fn: () => unknown, re: RegExp, label: string) => { try { fn(); ok(false, `${label} (did not throw)`); } catch (e) { ok(re.test((e as Error).message), `${label}: ${(e as Error).message.slice(0, 100)}`); } };
  const sr = 24000, fps = 30, filmS = 8;
  // a stand-in track: a steady chord with a soft pulse, `musicS` long
  const track = (musicS: number, amp = 0.12): [Float32Array, Float32Array] => { const n = Math.round(musicS * sr), L = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / sr; L[i] = amp * (Math.sin(2 * Math.PI * 220 * t) + 0.6 * Math.sin(2 * Math.PI * 277.2 * t) + 0.5 * Math.sin(2 * Math.PI * 329.6 * t)) * (0.8 + 0.2 * Math.sin(2 * Math.PI * 2 * t)); } return [L, L.slice()]; };
  const plan = (cues: TrackPlan["cues"]): TrackPlan => ({ fps, frames: filmS * fps, cues, seed: 1 });
  const taps = [{ frame: 30, kind: "tap" as const, variant: "tock", label: "card lands" }, { frame: 90, kind: "tap" as const, variant: "thump", label: "stage lands", pan: -0.4 }, { frame: 150, kind: "tap" as const, variant: "impact", label: "x locks" }];

  // sound specs
  ok((({ kind, variant, gainDb, pan }) => kind === "tap" && variant === "thump" && gainDb === -9 && pan === 0.3)(parseSoundSpec("tap:thump -9 pan=0.3")), "a sound spec reads kind, variant, gain and pan");
  throws(() => parseSoundSpec("tap:boing"), /no variant "boing"/, "an unknown variant names the real ones");
  throws(() => parseSoundSpec("kazoo"), /unknown kind/, "an unknown kind is refused");
  throws(() => parseSoundSpec("tap:tick pan=3"), /pan must be -1..1/, "a pan outside -1..1 is refused");

  // the tap kind needs no key and ducks by variant
  ok(!sfxNeeds("tap", "impact").key && renderSfx("tap", { variant: "tick" }).L.length > 0, "tap renders without a key (nothing in it is tuned)");
  ok(sfxDuckDb("tap", "impact") === 6 && sfxDuckDb("tap", "tick") === 0, "a tap impact ducks the track 6 dB, a tick does not duck");

  // tuned kinds are refused under a track
  throws(() => checkTrackCues(plan([{ frame: 30, kind: "chime", label: "sparkle" }])), /transients, never notes/, "RED (A5): a tuned chime under an external track is refused");
  throws(() => checkTrackCues(plan([{ frame: 30, kind: "impact", variant: "bloom", label: "reveal" }])), /tap:impact/, "RED: impact:bloom (tuned shimmer) is refused and pointed to tap:impact");
  ok((() => { try { checkTrackCues(plan([{ frame: 30, kind: "press", variant: "confirm", key: "Am", pitched: "the track's own key, a deliberate button on the last downbeat" }])); return true; } catch { return false; } })(), "a tuned cue that says why it belongs is allowed");

  // green: the whole thing
  const m = mixOverTrack(track(filmS + 1), plan(taps), sr);
  ok(m.ok, `taps over a track that covers the picture pass (${m.problems.join("; ")})`);
  ok(Math.abs(m.lufs + 14) < 1 && m.dbtp <= -1, `mastered dense: ${m.lufs.toFixed(1)} LUFS, ${m.dbtp.toFixed(2)} dBTP`);
  ok(m.L.length === filmS * sr && m.sfx[0].length === filmS * sr, "the mix and the effects stem are exactly the film's length");
  ok(m.pitch.every((p) => p.salience <= 0.5) && m.pitch.length === 3, "every placed effect is measured for pitch");
  ok(m.audibility.every((a) => a.ok), "every cue is heard over the track");

  // RED (A4): music that stops 4 s before the picture (the v9 film's silent ending)
  const early = mixOverTrack(track(filmS - 4), plan(taps), sr);
  ok(!early.ok && /ends at 4\.\d\d s and the picture at 8\.00 s/.test(early.ending.msg ?? ""), `RED (A4): music ending 4 s early fails: ${early.ending.msg?.slice(0, 80)}`);

  // RED (A7): a tick under a loud track cannot be raised enough
  const buried = mixOverTrack(track(filmS + 1, 0.3), plan([{ frame: 60, kind: "tap", variant: "tickHi", gainDb: -20, label: "a whisper" }]), sr, { maxRaiseDb: 0 });
  ok(!buried.ok && buried.problems.some((p) => /buried/.test(p)), "RED (A7): a cue buried under the track's local loudness fails, named");
  const raised = mixOverTrack(track(filmS + 1, 0.3), plan([{ frame: 60, kind: "tap", variant: "tock", gainDb: -6, label: "a card" }]), sr);
  ok(raised.ok && raised.raised.length === 1 && raised.raised[0].db > 0, `a quiet cue is raised until it is heard (+${raised.raised[0]?.db.toFixed(1)} dB)`);

  // RED (A5): a pitched cue allowed by reason passes the pitch rule; the same sound without a reason is caught at placement
  const allowed = mixOverTrack(track(filmS + 1), plan([{ frame: 60, kind: "chime", key: "A", pitched: "the logo's own note, agreed with the director" }]), sr);
  ok(allowed.pitch[0].salience > 0.5 && allowed.pitch[0].ok && allowed.ok, `a chime with a reason is measured (${allowed.pitch[0].salience}) and allowed`);
};
