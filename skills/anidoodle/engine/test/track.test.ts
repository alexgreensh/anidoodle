// EXTERNAL TRACK TESTS. Tempo, bars, the real end and the stops of a supplied track; cut lists read the
// way people write them; cuts refused for the faults that broke a brand launch film's mix; the edit's bar
// grid; and pitch salience, calibrated so short strikes pass and notes fail.
//   node tools/test.mjs track
import { analyzeTrack, parseSegs, planCut, renderCut, trackGrid, pitchSalience, lastSoundOf, stemCues, chroma, keyOf, PITCHED } from "../src/canvas-core/music/track";
import { renderSfx, sfxVariants } from "../src/canvas-core/music/sfxKit";

export const name = "external track (analyse, cut, grid, pitch)";
export const run = (ok: (cond: boolean, label: string) => void) => {
  const throws = (fn: () => unknown, re: RegExp, label: string) => { try { fn(); ok(false, `${label} (did not throw)`); } catch (e) { ok(re.test((e as Error).message), `${label}: ${(e as Error).message.slice(0, 90)}`); } };
  // a synthetic "track": 120 bpm, first downbeat at 0.25 s, a kick on every downbeat and a hat on every
  // beat, a designed stop over bar 6, then 3 s of silence after the last note
  const sr = 16000, len = 30, music = (bpm = 120, d0 = 0.25, endS = 27, stop: [number, number] | null = [12.25, 13.25]) => {
    const n = sr * len, L = new Float32Array(n), beat = 60 / bpm;
    let seed = 7; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff - 0.5; };
    for (let k = 0; d0 + k * beat < endS; k++) {
      const t0 = d0 + k * beat; if (stop && t0 >= stop[0] - 1e-6 && t0 < stop[1]) continue;
      const a = Math.round(t0 * sr), down = k % 4 === 0;
      for (let i = 0; i < sr * 0.25 && a + i < n; i++) { const t = i / sr; L[a + i] += (down ? 0.6 * Math.sin(2 * Math.PI * 60 * t) * Math.exp(-t / 0.08) : 0) + 0.15 * rnd() * Math.exp(-t / 0.015) + 0.05 * Math.sin(2 * Math.PI * 330 * t) * Math.exp(-t / 0.2); }
    }
    // a quiet sustained pad under everything except the stop, as real music has (hits alone decay to silence)
    for (let i = 0; i < Math.round(endS * sr); i++) { const t = i / sr; if (!(stop && t >= stop[0] && t < stop[1])) L[i] += 0.03 * Math.sin(2 * Math.PI * 220 * t); }
    return [L, L.slice()] as [Float32Array, Float32Array];
  };
  const [L, R] = music(), a = analyzeTrack(L, R, sr);
  ok(Math.abs(a.bpm - 120) < 0.2, `tempo found: ${a.bpm} bpm (120 played)`);
  ok(Math.abs(a.downbeatS - 0.25) < 0.02, `first downbeat found on the kick: ${a.downbeatS} s (0.25 played)`);
  ok(Math.abs(a.lastSoundS - 27.2) < 0.4 && a.tailS > 2.3, `the real end: last note ${a.lastSoundS} s, ${a.tailS} s of silence after it (27.0 + the ring)`);
  ok(a.stops.some((s) => Math.abs(s.atS - 12.4) < 0.4 && s.lenS >= 0.5), `the designed stop is found: ${JSON.stringify(a.stops)}`);
  ok(a.bars.length >= 14 && Math.abs(a.bars[1].t - 2.25) < 0.03, `bars on the grid: bar 1 at ${a.bars[1]?.t} s`);
  ok(a.sections.some((s) => s.level === "silent" || s.level === "quiet"), `sections mark the stop and the tail: ${a.sections.map((s) => s.level).join(",")}`);
  ok(analyzeTrack(L, R, sr, { bpm: 120 }).tempoCandidates.length === 0, "a pinned tempo is used as given");
  throws(() => analyzeTrack(L.subarray(0, sr), R.subarray(0, sr), sr), /at least 2 s/, "a track too short to measure is refused");
  // key: an A minor triad spread over octaves reads as A minor
  const n = sr * 3, k = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / sr; k[i] = 0.3 * Math.sin(2 * Math.PI * 220 * t) + 0.2 * Math.sin(2 * Math.PI * 261.63 * t) + 0.2 * Math.sin(2 * Math.PI * 329.63 * t) + 0.1 * Math.sin(2 * Math.PI * 110 * t); }
  ok(keyOf(chroma(k, sr)).name === "Am", `an A minor chord reads as Am (${keyOf(chroma(k, sr)).name})`);

  // ---- cut lists as people write them
  const segsText = "0 6\n8 36\n36 48\n56 64\n28 38\n40 60\n68 72.72"; // a brand launch film's list: no final newline
  ok(parseSegs(segsText).length === 7 && parseSegs(segsText)[6].to === 72.72, "RED FIXTURE (A4): the last segment of a list with no final newline is kept (a shell `while read` loop dropped it)");
  const naive = segsText.split("\n").slice(0, -1); // what `while read a b` did with the unterminated last line
  ok(naive.length === 6, "the dropped-segment bug reproduced: a line reader that needs a newline sees 6 of 7 segments");
  ok(parseSegs("0:6, 8:36 # groove\r\n36-48").length === 3, "comma, colon, dash, CRLF and comments all read");
  ok(JSON.stringify(parseSegs("bars 0-3, 5-6", a)) === JSON.stringify([{ from: 0.25, to: 6.25 }, { from: 10.25, to: 12.25 }]), "a bar list becomes seconds on the track's grid");
  throws(() => parseSegs("zero to six"), /cannot read segment/, "an unreadable segment names itself");
  throws(() => parseSegs("bars 0-3"), /needs the track's analysis/, "a bar list without an analysis is refused");

  // ---- planCut: green, then each fault it refuses
  const bar = (i: number) => +(a.downbeatS + i * a.barS).toFixed(4), last = a.lastSoundS;
  const green = planCut(a, [{ from: 0, to: bar(4) }, { from: bar(7), to: last }], { filmS: bar(4) + last - bar(7) - 0.2 });
  ok(green.errors.length === 0, `a cut on bars that keeps the track's ending passes (${green.errors.join("; ")})`);
  ok(green.downbeats.includes(+(bar(4)).toFixed(4)) && green.joins.length === 1 && Math.abs(green.joins[0].toOffMs) < 30, "the edit's downbeats and its join are reported");
  ok(planCut(a, [{ from: 0, to: bar(4) + 0.3 }, { from: bar(7), to: last }]).errors.some((e) => /off a downbeat/.test(e)), "RED: a join 300 ms off a downbeat is refused, naming the bar to use");
  ok(planCut(a, [{ from: 0, to: bar(4) }, { from: bar(7), to: 29.5 }]).errors.some((e) => /past the track's last note/.test(e)), "RED (A4): a segment that carries the silence after the last note is refused");
  ok(planCut(a, [{ from: 0, to: bar(4) }, { from: bar(7), to: bar(10) }]).errors.some((e) => /before the track's last note/.test(e)), "RED: an outro that stops before the track's own ending is refused");
  ok(planCut(a, [{ from: 0, to: bar(4) }, { from: bar(7), to: bar(10) }], { fadeOutS: 2 }).errors.every((e) => !/before the track's last note/.test(e)), "a declared fade-out may end early on purpose");
  const short = planCut(a, [{ from: 0, to: bar(4) }, { from: bar(7), to: last }], { filmS: bar(4) + last - bar(7) + 4 });
  ok(short.errors.some((e) => /4\.\d\d s of silence at the end/.test(e)), "RED (A4): music that ends 4 s before the picture is refused, with the bars to add");
  ok(planCut(a, [{ from: 0, to: last }], { filmS: 20 }).warnings.some((w) => /past the picture/.test(w)), "music that runs well past the picture warns (the mux would cut its ending)");
  ok(green.quiet.length === 0 && planCut(a, [{ from: 0, to: last }]).quiet.some((q) => q.fromS < 12.5 && q.toS > 13), "the track's own stop is carried into the edit as a declared quiet range");

  // ---- renderCut: exact length, bars stay where planned
  const imp = new Float32Array(sr * 10); imp[Math.round(4.25 * sr)] = 1; // an impulse on a downbeat
  const [cL] = renderCut(imp, imp, sr, [{ from: 0, to: 2.25 }, { from: 4.25, to: 8.25 }]);
  ok(cL.length === Math.round(2.25 * sr) + Math.round(8.25 * sr) - Math.round(4.25 * sr), `the edit is exactly the sum of its segments (${(cL.length / sr).toFixed(3)} s)`);
  let at = 0, pk = 0; for (let i = 0; i < cL.length; i++) if (Math.abs(cL[i]) > pk) { pk = Math.abs(cL[i]); at = i; }
  ok(Math.abs(at / sr - 2.25) < 0.001, `a downbeat lands where the plan says (${(at / sr).toFixed(4)} s in the edit)`);
  const sine = Float32Array.from({ length: sr * 6 }, (_, i) => Math.sin((2 * Math.PI * 100 * i) / sr)), [sL] = renderCut(sine, sine, sr, [{ from: 0, to: 2 }, { from: 4, to: 6 }]);
  let jump = 0; for (let i = 1; i < sL.length; i++) jump = Math.max(jump, Math.abs(sL[i] - sL[i - 1]));
  ok(jump < 0.06, `the crossfade joins a continuous sine without a click (largest step ${jump.toFixed(3)})`);

  // ---- trackGrid
  const g = trackGrid(green.downbeats, 60), h = g.holdTo(1.0, 1.5);
  ok(green.downbeats.includes(h.landS) && h.landS >= 2.5 && h.holdS === +(h.landS - 1).toFixed(4) && h.frame === Math.round(h.landS * 60), `holdTo lands a hold of at least 1.5 s on a downbeat (${h.holdS} s, lands ${h.landS} s, frame ${h.frame})`);
  ok(g.landOn(4.3) === 4.25, "landOn snaps to the nearest downbeat");
  throws(() => g.holdTo(30, 5), /no downbeat after/, "a hold past the music's last bar is refused");

  // ---- pitch salience: notes fail, strikes pass
  const S = 48000, note = (hz: number, ms: number, tau: number) => Float32Array.from({ length: Math.round((S * ms) / 1000) }, (_, i) => Math.sin((2 * Math.PI * hz * i) / S) * Math.exp(-i / S / tau) + 0.3 * Math.sin((2 * Math.PI * hz * 2 * i) / S) * Math.exp(-i / S / tau));
  let s0 = 3; const noise = (ms: number, tau: number) => Float32Array.from({ length: Math.round((S * ms) / 1000) }, (_, i) => { s0 = (s0 * 16807) % 2147483647; return (s0 / 2147483647 - 0.5) * Math.exp(-i / S / tau); });
  const marimba = pitchSalience(note(523, 400, 0.25), S), strike = pitchSalience(note(523, 14, 0.004), S), tap = pitchSalience(noise(20, 0.004), S), harp = pitchSalience(note(110, 400, 0.3), S);
  ok(marimba.salience > PITCHED && Math.abs(marimba.hz - 523) < 15, `RED (A5): a 400 ms C5 note carries a note (${marimba.salience}, ${marimba.hz} Hz)`);
  ok(harp.salience > PITCHED, `RED: a low A2 note is caught too (${harp.salience})`);
  ok(strike.salience <= PITCHED, `a 14 ms strike of the same note is too short to name (${strike.salience}, rings ${strike.ringMs} ms)`);
  ok(tap.salience < 0.2, `a noise tap carries no note (${tap.salience})`);
  for (const v of sfxVariants("tap")) { const s = renderSfx("tap", { variant: v, seed: 3 }, S), p = pitchSalience(Float32Array.from(s.L, (x, i) => 0.5 * (x + s.R[i])), S); ok(p.salience <= PITCHED, `tap:${v} carries no note (${p.salience})`); }
  const chime = renderSfx("chime", { key: "Am", seed: 1 }, S), pc = pitchSalience(Float32Array.from(chime.L, (x, i) => 0.5 * (x + chime.R[i])), S);
  ok(pc.salience > PITCHED, `RED: the engine's own tuned chime is flagged as a note (${pc.salience})`);

  // ---- stemCues + lastSoundOf
  const stem = new Float32Array(S * 4), put = (x: Float32Array, t: number) => stem.set(x, Math.round(t * S));
  put(noise(20, 0.004), 0.5); put(noise(20, 0.004), 1.0); put(note(523, 400, 0.25), 2.0); put(noise(20, 0.004), 3.2);
  const sc = stemCues(stem, stem, S);
  ok(sc.length === 4 && sc.filter((c) => c.salience > PITCHED).length === 1 && Math.abs(sc[2].atS - 2.0) < 0.01, `stemCues finds 4 effects and the one note among them (${sc.map((c) => c.salience).join(", ")})`);
  ok(Math.abs(lastSoundOf(L, R, sr) - a.lastSoundS) < 0.06, "lastSoundOf agrees with the analysis");
};
