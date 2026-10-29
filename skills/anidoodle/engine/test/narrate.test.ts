// NARRATE TESTS. tools/narrate/core.mjs (normalising, WER, ASR words mapped back onto the script, line
// placement, the alignment and audio checks) and src/canvas-core/voice.ts (decoding, placing, ducking,
// the delivered mix). No whisper, no ffmpeg, no network: hand-made ASR words and synthetic signals.
//   node tools/test.mjs narrate
// @ts-expect-error plain .mjs tool modules carry no types
import * as N from "../tools/narrate/core.mjs";
import { decodePcm16, duckEnvelope, mixNarration, resample, voiceTrack, type BakedVoice } from "../src/canvas-core/voice";

type Asr = { text: string; t0: number; t1: number };
// ASR words for a sentence, `secs` each, starting at t0, with words removed or swapped first
const said = (text: string, secs = 0.3, t0 = 0.05): Asr[] => text.split(" ").map((w, i) => ({ text: w, t0: t0 + i * secs, t1: t0 + (i + 1) * secs - 0.02 }));
const b64 = (bytes: number[]) => btoa(String.fromCharCode(...bytes));
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
const dB = (g: number) => 20 * Math.log10(g);

export const name = "narrate";
export const run = (ok: (cond: boolean, label: string) => void) => {
  // ---------------------------------------------------------------- normalising
  const n = (s: string) => N.normalise(s).join(" ");
  ok(n("It cost $13.60.") === n("it cost thirteen dollars sixty") && n("thirteen dollars and sixty cents") === "thirteen dollars sixty", "$13.60, 'thirteen dollars sixty' and '... and sixty cents' all read the same");
  ok(n("CONTEXT!") === "context" && n("\"Context,\"") === "context", "case and punctuation never count");
  ok(n("40% of 1,000 on the 3rd day at 2:30") === "forty percent of one thousand on the third day at two thirty", "percent, thousands, ordinals and clock times are spelled out");
  ok(n("in 2026 and 1984 and 2005") === "in twenty twenty six and nineteen eighty four and two thousand five", "a four-digit number reads as a year");
  ok(n("2AM") === n("two a.m.") && n("well-known") === "well known", "2AM is 'two a.m.'; hyphens join spoken words");

  // ---------------------------------------------------------------- WER
  const w = N.wer("a b c d e f g h i j".split(" "), "a x c d e f g h i j k".replace(" c", "").split(" "));
  ok(w.sub === 1 && w.del === 1 && w.ins === 1 && near(w.wer, 0.3, 1e-9), `one changed, one dropped, one extra word in ten is 30 % (got sub ${w.sub} del ${w.del} ins ${w.ins})`);
  ok(N.wer(["a", "b"], ["a", "b"]).wer === 0 && N.wer([], []).wer === 0 && N.wer([], ["x"]).wer === 1, "a perfect take is 0; nothing heard of nothing is 0");

  // ---------------------------------------------------------------- ASR words back onto the script
  const ins = N.mapTimings("the clock rang out", [{ text: "The", t0: 0, t1: 0.2 }, { text: "uh", t0: 0.2, t1: 0.3 }, { text: "clock", t0: 0.3, t1: 0.6 }, { text: "rang", t0: 0.6, t1: 0.9 }, { text: "out.", t0: 0.9, t1: 1.1 }]);
  ok(ins.tokens.every((t: { status: string }) => t.status === "ok") && ins.inserted.join() === "uh", "an inserted ASR word is set aside; every script word keeps its own time");
  ok(near(ins.tokens[1].t0, 0.3, 1e-9) && near(ins.tokens[1].t1, 0.6, 1e-9), "'clock' takes the time it was heard at, not its neighbour's");
  ok(ins.tokens[0].raw === "the", "the timing carries the script's words, never the ASR's spelling");

  // the lesson-51 regression: an ALL-CAPS word silently dropped by the voice must be FLAGGED, by name
  const script51 = "And at midnight the clock rang out CONTEXT for him.";
  const heard51 = said("And at midnight the clock rang out for him.");
  const rt = N.roundTrip(script51, heard51);
  ok(rt.dropped.join() === "CONTEXT" && rt.problems.includes('DROPPED "CONTEXT"'), "LESSON 51: a take that drops CONTEXT is flagged, naming the word");
  const ctx = rt.tokens.find((t: { raw: string }) => t.raw === "CONTEXT");
  ok(ctx.est === true && ctx.t0 >= heard51[6].t1 - 1e-9 && ctx.t1 <= heard51[7].t0 + 1e-9, "the dropped word's time is marked estimated, between 'out' and 'for'");
  ok(N.alignmentProblems(rt.tokens).some((p: string) => p.includes("CONTEXT")), "and alignment sanity fails it too: every word must be timed");
  ok(N.roundTrip(script51, said('And at midnight the clock rang out "Context!" for him.')).problems.length === 0, "GREEN: the fix (the word in plain case, in quotes) passes");
  ok(N.roundTrip(script51, said("And at midnight the clock rang out contest for him.")).problems.includes('CHANGED "CONTEXT -> contest"'), "a changed word is named with what was heard");
  const dropped2 = N.mapTimings("one two three four five", said("one two four five"));
  ok(dropped2.tokens[2].status === "dropped" && dropped2.tokens[3].status === "ok" && near(dropped2.tokens[3].t0, said("one two four five")[2].t0, 1e-9), "a dropped word does not shift the words after it");
  ok(N.roundTrip("Clawd wandered on", said("Claude wandered on"), { aliases: { Clawd: ["claude"] } }).problems.length === 0 && N.roundTrip("Clawd wandered on", said("Claude wandered on")).problems.length === 1, "an alias accepts a name's known spelling, and only with the alias");
  ok(N.roundTrip("one two three four five six seven eight nine ten", said("one two three four five six seven eight nine ten you")).problems.some((p: string) => p.startsWith("WER")), "extra heard words past 3 % fail");

  // display text keeps its own words, timed by what was said for them
  const sp = N.mapTimings("It cost thirteen dollars sixty.", said("It cost $13.60.", 0.4));
  const disp = N.mapDisplay("It cost $13.60.", sp.tokens);
  ok(disp.length === 3 && disp[2].w === "$13.60." && disp[2].say === "thirteen dollars sixty." && near(disp[2].t0, 0.85, 1e-9) && !disp[2].est, "'$13.60' on screen takes the time of 'thirteen dollars sixty' in the take");

  // whisper.cpp JSON (-ml 1 -sow -ojf) reading
  const wj = N.whisperWords({ transcription: [{ text: "", offsets: { from: 0, to: 10 } }, { text: " The", offsets: { from: 10, to: 220 } }, { text: " [BLANK_AUDIO]", offsets: { from: 220, to: 300 } }, { text: " clock", offsets: { from: 300, to: 590 } }] });
  ok(wj.length === 2 && wj[0].text === "The" && near(wj[1].t0, 0.3, 1e-9) && near(wj[1].t1, 0.59, 1e-9), "whisper's word segments are read in seconds, empty and bracketed segments dropped");

  // ---------------------------------------------------------------- placing lines on frames
  const take = (d: number, words: [string, number, number][]) => ({ durationS: d, words: words.map(([w, t0, t1]) => ({ w, say: w, t0, t1 })) });
  const tm = N.placeLines({ fps: 24, lead: 12, tail: 24, pause: 0.5, lines: [{ id: "a", text: "one two" }, { id: "b", text: "three", pauseAfter: 0 }, { id: "c", text: "four", at: 100 }] },
    [take(1.0, [["one", 0.05, 0.4], ["two", 0.45, 0.95]]), take(0.5, [["three", 0.04, 0.45]]), take(0.5, [["four", 0.05, 0.6]])]);
  ok(tm.lines[0].start === 12 && tm.lines[0].end === 36 && tm.lines[1].start === 48 && tm.lines[1].end === 60, "lines play end to end on whole frames: lead 12, a 1 s take ends at 36, a 0.5 s pause puts the next at 48");
  ok(tm.lines[2].start === 100 && tm.totalFrames === 112 + 24, "a line may name its own frame; the film is the last line plus the tail");
  ok(tm.lines[0].words[1].from === 12 + 11 && tm.lines[0].words[1].to === 12 + 23, "words become film frames from their seconds in the take");
  let overlap = ""; try { N.placeLines({ fps: 24, lines: [{ id: "a", text: "x" }, { id: "b", text: "y", at: 5 }] }, [take(2, [["x", 0, 1]]), take(1, [["y", 0, 0.5]])]); } catch (e) { overlap = String(e); }
  ok(overlap.includes("still speaking"), "RED: a line asked to start over the one before it is refused");

  // ---------------------------------------------------------------- alignment and audio sanity (red, then green)
  const tok = (raw: string, t0: number, t1: number) => ({ raw, words: [raw.toLowerCase().replace(/\W/g, "")], t0, t1 });
  ok(N.alignmentProblems([tok("one", 0, 0.3), tok("two", 1.6, 1.9)]).some((p: string) => p.includes("gap")), "RED: a 1.3 s hole inside a sentence is caught");
  ok(N.alignmentProblems([tok("one.", 0, 0.3), tok("Two", 1.6, 1.9)]).length === 0, "GREEN: the same pause after a full stop is fine");
  ok(N.alignmentProblems([tok("one", 0.5, 0.8), tok("two", 0.2, 0.4)]).some((p: string) => p.includes("monotonic")), "RED: words out of order are caught");
  ok(N.alignmentProblems([tok("one", 0, 0.01), tok("two", 0.02, 2.2)]).length === 2, "RED: a 10 ms word and a 2.2 s word are both caught");
  const sr = 8000, tone = (lead: number, len: number, tail: number, amp: number) => { const x = new Float32Array(Math.round((lead + len + tail) * sr)); for (let i = Math.round(lead * sr); i < Math.round((lead + len) * sr); i++) x[i] = amp * Math.sin(i * 0.3); return x; };
  ok(N.audioProblems(tone(0.04, 2, 0.08, 0.5), sr, { words: 6 }).problems.length === 0, "GREEN: a trimmed, unclipped take of 6 words in 2 s passes");
  ok(N.audioProblems(tone(0.04, 2, 0.08, 1.2).map((v) => Math.max(-1, Math.min(1, v))), sr, { words: 6 }).problems.some((p: string) => p.startsWith("clipped")), "RED: a clipped take is caught");
  ok(N.audioProblems(tone(0.8, 2, 0.08, 0.5), sr, { words: 6 }).problems.some((p: string) => p.includes("before the first word")), "RED: 0.8 s of silence before the first word is caught");
  ok(N.audioProblems(tone(0.04, 2, 0.08, 0.5), sr, { words: 20 }).problems.some((p: string) => p.includes("words per second")), "RED: 20 words in 2 s is not a voice");
  ok(N.audioProblems(new Float32Array(sr), sr).problems.includes("the take is silent"), "RED: a silent take is caught");

  // ---------------------------------------------------------------- the script and the cache key
  ok(N.scriptProblems({ fps: 24, provider: "say", lines: [{ id: "a", text: "hi there" }, { id: "a", text: "again" }] }).some((p: string) => p.includes("duplicate")), "RED: a duplicate line id is refused");
  ok(N.scriptProblems({ fps: 24, provider: "say", lines: [{ id: "a", text: "hi there", display: "Hi there!" }] }).length === 0, "GREEN: a good script has no problems");
  ok(N.takeKey({ provider: "say", voice: { rate: 170, name: "S" }, text: "x", post: "p" }) === N.takeKey({ provider: "say", voice: { name: "S", rate: 170 }, text: "x", post: "p" }), "the cache key does not depend on the order voice settings are written in");
  ok(N.takeKey({ provider: "say", voice: {}, text: "x", post: "p" }) !== N.takeKey({ provider: "say", voice: {}, text: "x ", post: "p" }), "a changed text is a new take");

  // ---------------------------------------------------------------- voice.ts: decode, place, duck, mix
  const pcm = decodePcm16(b64([0x00, 0x00, 0xff, 0x7f, 0x00, 0x80, 0x00, 0x40]));
  ok(pcm.length === 4 && pcm[0] === 0 && near(pcm[1], 32767 / 32768, 1e-9) && pcm[2] === -1 && pcm[3] === 0.5, "16-bit little-endian PCM decodes to [-1, 1)");
  const up = resample(Float32Array.from({ length: 240 }, (_, i) => Math.sin((2 * Math.PI * 100 * i) / 2400)), 2400, 4800);
  ok(up.length === 480 && near(up[200], Math.sin((2 * Math.PI * 100 * 100) / 2400), 0.01), "resampling keeps a tone's shape and length");
  const baked: BakedVoice = { sampleRate: 1000, pcm: { a: b64(Array.from({ length: 200 }, (_, i) => (i % 2 ? 0x40 : 0x00))) }, timing: { version: 1, fps: 10, totalFrames: 20, lines: [{ id: "a", text: "x", start: 5, end: 7, words: [] }] } };
  const vt = voiceTrack(baked, 1000);
  ok(vt.length === 2000 && vt[499] === 0 && vt[500] === 0.5 && vt[599] === 0.5 && vt[600] === 0, "a take lands on its start frame to the sample (frame 5 at 10 fps = sample 500)");
  // L8: two baked voices with the same line id and the same take length must each play their own take
  const twinA: BakedVoice = { ...baked, pcm: { a: b64(Array.from({ length: 200 }, (_, i) => (i % 2 ? 0x20 : 0x00))) } };
  const twinB: BakedVoice = { ...baked, pcm: { a: b64(Array.from({ length: 200 }, (_, i) => (i % 2 ? 0x10 : 0x00))) } };
  const ta = voiceTrack(twinA, 1000), tb = voiceTrack(twinB, 1000);
  ok(ta[500] === 0.25 && tb[500] === 0.125, `RED (L8): same line id and length, different takes, each plays its own (${ta[500]}, ${tb[500]})`);
  const slow: BakedVoice = { ...twinB, sampleRate: 500 };
  ok(voiceTrack(slow, 1000).length === 2000 && voiceTrack(slow, 1000).filter((x) => x !== 0).length > 150, "RED (L8): the same take at another sample rate is resampled again, not served from the cache");

  // the duck: silence 1 s, voice 1 s, silence 2 s
  const S = 8000, v = new Float32Array(4 * S); for (let i = S; i < 2 * S; i++) v[i] = 0.3 * Math.sin(i * 0.2);
  const g = duckEnvelope(v, S);
  ok(near(dB(g[Math.round(0.5 * S)]), 0, 1e-6) && near(dB(g[Math.round(0.95 * S)]), 0, 1e-6), "full level before the voice, until the look-ahead");
  ok(near(dB(g[Math.round(0.98 * S)]), -4.5, 0.5), `half way down 20 ms before the first word (${dB(g[Math.round(0.98 * S)]).toFixed(2)} dB): a 40 ms attack`);
  ok(near(dB(g[S + 40]), -9, 0.05) && near(dB(g[Math.round(1.5 * S)]), -9, 1e-6), "-9 dB from the first word and all through the line");
  const relStart = 2 * S + Math.round(0.12 * S);
  ok(near(dB(g[relStart]), -9, 0.4) && near(dB(g[relStart + Math.round(0.225 * S)]), -4.5, 0.4) && near(dB(g[relStart + Math.round(0.47 * S)]), 0, 0.05), "held 120 ms after the voice, then back up over 450 ms in a straight line (in dB)");
  let mono = true; for (let i = 1; i < S; i++) if (g[i] > g[i - 1] + 1e-9) mono = false; for (let i = 2 * S + 1; i < 4 * S; i++) if (g[i] < g[i - 1] - 1e-9) mono = false;
  ok(mono, "the curve only falls into the line and only rises out of it");
  ok(near(dB(Math.min(...duckEnvelope(v, S, { depthDb: -6 }).subarray(S, 2 * S))), -6, 1e-6), "the depth is a setting");

  // the delivered mix: score ducked, voice over it, -16 LUFS, under -1 dBTP
  const sr2 = 48000, len = 6 * sr2, mL = new Float32Array(len), mR = new Float32Array(len), voice = new Float32Array(len);
  for (let i = 0; i < len; i++) { mL[i] = 0.3 * Math.sin((2 * Math.PI * 220 * i) / sr2); mR[i] = mL[i]; }
  for (let i = 2 * sr2; i < 4 * sr2; i++) voice[i] = 0.2 * Math.sin((2 * Math.PI * 330 * i) / sr2) * (0.6 + 0.4 * Math.sin((2 * Math.PI * 4 * i) / sr2));
  const mx = mixNarration([mL, mR], voice, sr2);
  ok(near(mx.delivered.lufs, -16, 0.3) && mx.delivered.dbtp <= -1 + 1e-6, `the mix is delivered at -16 LUFS under -1 dBTP (${mx.delivered.lufs.toFixed(2)} LUFS, ${mx.delivered.dbtp.toFixed(2)} dBTP)`);
  ok(Number.isFinite(mx.speechOverMusicDb) && mx.speechOverMusicDb > 6, `the voice sits clear of the ducked score (${mx.speechOverMusicDb.toFixed(1)} LU over it)`);
  ok(mx.L.length === len && mx.R.length === len, "the mix is exactly the film's length");
};
