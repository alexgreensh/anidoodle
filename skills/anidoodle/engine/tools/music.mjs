#!/usr/bin/env node
// Offline music renderer + meter. Renders a named piece to a 48 kHz 32-bit FLOAT WAV (no PCM16
// clipping on the way) and meters the DECODED file: integrated LUFS (BS.1770-4), LRA (EBU 3342),
// true peak (4x), onsets/s (spectral flux), spectral centroid; plus note-data numbers.
//
//   node tools/music.mjs list
//   node tools/music.mjs render <piece> <out.wav> [--seconds 45] [--flat] [--tempo 66] [--fit]
//   node tools/music.mjs meter <file.wav|file.mp4> [more files]
//   node tools/music.mjs samples <outdir>          # the whole deliverable set + meters.json + .m4a
//   node tools/music.mjs score <piece>                # the text score, bar by bar
//   node tools/music.mjs probe                      # piano realism probes
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { writeFileSync, readFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import { dirname, join, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const SR = 48000;
const load = async () => {
  const r = await build({ entryPoints: [join(here, "../src/canvas-core/music/index.ts")], bundle: true, write: false, format: "esm", platform: "neutral", target: "es2022", logLevel: "error" });
  return import("data:text/javascript;base64," + Buffer.from(r.outputFiles[0].text).toString("base64"));
};

export const writeWavFloat = (path, L, R, sr = SR) => {
  const n = L.length, data = Buffer.alloc(n * 8), h = Buffer.alloc(58);
  for (let i = 0; i < n; i++) { data.writeFloatLE(L[i], i * 8); data.writeFloatLE(R[i], i * 8 + 4); }
  h.write("RIFF", 0); h.writeUInt32LE(50 + data.length, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(18, 16); h.writeUInt16LE(3, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 8, 28); h.writeUInt16LE(8, 32); h.writeUInt16LE(32, 34); h.writeUInt16LE(0, 36);
  h.write("fact", 38); h.writeUInt32LE(4, 42); h.writeUInt32LE(n, 46); h.write("data", 50); h.writeUInt32LE(data.length, 54);
  writeFileSync(path, Buffer.concat([h, data]));
};
/** Decode ANY file through ffmpeg to float stereo 48 kHz: we meter what a player would decode. */
export const decode = (path) => {
  const buf = execFileSync("ffmpeg", ["-v", "error", "-i", path, "-vn", "-f", "f32le", "-acodec", "pcm_f32le", "-ac", "2", "-ar", String(SR), "pipe:1"], { maxBuffer: 1 << 30 });
  const f = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4), n = f.length / 2, L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) { L[i] = f[2 * i]; R[i] = f[2 * i + 1]; }
  return [L, R];
};

/** Independent cross-check: ffmpeg's own ebur128 summary (integrated, LRA, true peak). */
const ffmpegEbu = (path) => {
  const out = execFileSync("sh", ["-c", 'ffmpeg -hide_banner -nostats -i "$1" -vn -af ebur128=peak=true -f null - 2>&1', "sh", path], { encoding: "utf8", maxBuffer: 1 << 28 });
  const sum = out.slice(out.lastIndexOf("Summary:"));
  const g = (re) => { const m = re.exec(sum); return m ? Number(m[1]) : NaN; };
  return { I: g(/I:\s+(-?[\d.]+) LUFS/), LRA: g(/LRA:\s+(-?[\d.]+) LU/), TP: g(/Peak:\s+(-?[\d.]+) dBFS/) };
};
const fmt = (x, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : "n/a");
const noteStats = (M, piece) => {
  const all = piece.parts.flatMap((p) => p.notes.filter((n) => n.role !== "drum"));
  const ps = all.map((n) => n.p), lo = Math.min(...ps), hi = Math.max(...ps);
  return { range: `${M.nameOf(lo)}-${M.nameOf(hi)}`, notes: all.length };
};
const onsetsFromData = (rendered) => {
  const ts = rendered.perf.parts.flatMap((p) => p.keys.map((k) => k.t)).sort((a, b) => a - b); let c = 0, last = -1;
  for (const t of ts) if (t - last > 0.03) { c++; last = t; } return c;
};

const renderOne = (M, spec) => {
  let piece = M.PIECES[spec.piece]();
  let tempo = spec.tempo ?? piece.plan.tempo;
  let form;
  if (spec.fit) { const f = M.fitToDuration(piece, spec.seconds); piece = f.piece; tempo = f.tempo; form = `${f.form}: ${f.piece.plan.sections.map((x) => x.id).join(", ")}`; }
  const opts = { seconds: spec.seconds, tempo };
  if (spec.flat) Object.assign(opts, { expressive: false, piano: M.PIANO_FLAT, flatVelocity: 0.6 });
  const t0 = Date.now(), r = M.renderPiece(piece, SR, opts), ms = Date.now() - t0;
  // determinism: a second render must be bit-identical
  const r2 = M.renderPiece(piece, SR, opts); let same = true; for (let i = 0; i < r.L.length; i += 7) if (r.L[i] !== r2.L[i] || r.R[i] !== r2.R[i]) { same = false; break; }
  return { r, piece, tempo, ms, deterministic: same, form };
};

const voicing = (M, piece, tempo, seconds, flat) => {
  // melody vs everything else, rendered separately, loudness difference in LU (both unmastered)
  const only = (roles) => ({ ...piece, parts: piece.parts.map((p) => ({ ...p, notes: p.notes.filter((n) => roles.includes(n.role)) })) });
  const base = { seconds, tempo, master: "none", ...(flat ? { expressive: false, piano: M.PIANO_FLAT, flatVelocity: 0.6 } : {}) };
  const a = M.renderPiece(only(["melody"]), SR, base), b = M.renderPiece(only(["accomp", "bass", "inner"]), SR, base);
  return M.loudness([a.L, a.R], SR).integrated - M.loudness([b.L, b.R], SR).integrated;
};

/** Per-note voicing: mean level (dB, from the piano's velocity->level law) of melody keys minus accompaniment keys. */
const noteVoicing = (r, piece) => {
  const lv = (v) => 20 * Math.log10(v < 0.6 ? Math.pow(v, 1.55) : Math.pow(0.6, 1.55) * Math.pow(v / 0.6, 0.9));
  const mel = [], acc = []; r.perf.parts.forEach((p, i) => { if (piece.parts[i].inst !== "piano") return; for (const k of p.keys) (k.role === "melody" ? mel : acc).push(lv(k.v)); });
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length; return mel.length && acc.length ? mean(mel) - mean(acc) : null;
};
const main = async () => {
  const [cmd, ...args] = process.argv.slice(2);
  const M = await load();
  const flag = (k) => args.includes(k), val = (k, d) => { const i = args.indexOf(k); return i >= 0 ? Number(args[i + 1]) : d; };
  if (cmd === "list") { console.log(Object.keys(M.PIECES).join("\n")); return; }
  if (cmd === "render") {
    const [name, out] = args; const { r, tempo, ms, deterministic, piece } = renderOne(M, { piece: name, seconds: val("--seconds", undefined), tempo: val("--tempo", undefined), flat: flag("--flat"), fit: flag("--fit") });
    writeWavFloat(out, r.L, r.R); const m = M.measure(decode(out), SR);
    console.log(JSON.stringify({ file: out, tempo, renderMs: ms, deterministic, gainDb: r.gainDb, problems: M.planProblems(piece), ...m, shortTerm: undefined }, null, 1)); return;
  }
  if (cmd === "meter") { for (const f of args) { const m = M.measure(decode(f), SR), ff = ffmpegEbu(f); console.log(basename(f), `LUFS ${fmt(m.lufs)} (ffmpeg ${fmt(ff.I)}) LRA ${fmt(m.lra)} (ffmpeg ${fmt(ff.LRA)}) TP ${fmt(m.dbtp)} dBTP (ffmpeg ${fmt(ff.TP)}) onsets/s ${fmt(m.onsetsPerS, 2)} centroid ${fmt(m.centroidHz, 0)} Hz (energy-wtd ${fmt(m.centroidEnergyHz, 0)}) dur ${fmt(m.durationS, 2)} lastOnset ${fmt(m.lastOnsetS, 2)}`); } return; }
  if (cmd === "score") { console.log(M.scoreText(M.PIECES[args[0]]())); return; }
  if (cmd === "probe") { console.log(JSON.stringify(probe(M), null, 1)); return; }
  if (cmd === "samples") {
    const dir = resolve(args[0]);
    const set = [
      { file: "piano-8s", piece: "pianoPhrase8", seconds: 8, tempo: 66, emotion: "tender" },
      { file: "piano-flat-baseline-8s", piece: "pianoPhrase8", seconds: 8, tempo: 66, flat: true, emotion: "(contrast: MIDI-flat)" },
      { file: "nocturne-45s", piece: "nocturne", seconds: 45, fit: true, emotion: "tender -> swelling -> hush" },
      { file: "sampler-musicbox-joy-8s", piece: "musicBoxJoy", seconds: 8, emotion: "joy" },
      { file: "sampler-minor-piano-melancholy-8s", piece: "minorPianoMelancholy", seconds: 8, emotion: "melancholy" },
      { file: "sampler-cinematic-awe-8s", piece: "cinematicAwe", seconds: 8, emotion: "awe" },
      { file: "sampler-chiptune-playful-8s", piece: "chiptunePlayful", seconds: 8, emotion: "playful" },
      { file: "sampler-lofi-nostalgic-8s", piece: "lofiNostalgic", seconds: 8, emotion: "nostalgic" },
      { file: "sampler-marimba-curious-8s", piece: "marimbaCurious", seconds: 8, emotion: "curious" },
      { file: "sampler-harp-tender-8s", piece: "harpTender", seconds: 8, emotion: "tender (lullaby)" },
      { file: "sampler-guitar-wistful-8s", piece: "guitarWistful", seconds: 8, emotion: "wistful" },
      { file: "sampler-celesta-wonder-8s", piece: "celestaWonder", seconds: 8, emotion: "wonder" },
      { file: "sampler-bells-epiano-hopeful-8s", piece: "bellsHopeful", seconds: 8, emotion: "hopeful" },
      { file: "sampler-drive-electronic-8s", piece: "driveElectronic", seconds: 8, emotion: "drive / energy" },
      { file: "sampler-folk-calm-8s", piece: "folkCalm", seconds: 8, emotion: "calm (pastoral)" },
      { file: "fit-theme-15s", piece: "nocturne", seconds: 15, fit: true, emotion: "tender (auto short form)" },
      { file: "fit-theme-60s", piece: "nocturne", seconds: 60, fit: true, emotion: "tender -> swelling -> hush" },
      { file: "fit-theme-180s", piece: "nocturne", seconds: 180, fit: true, emotion: "tender -> swelling -> hush", m4aOnly: true, noMasking: true },
      { file: "fixtures/ghost-fixture-HATED", piece: "ghostFixture", seconds: 35, emotion: "(hated fixture: must FAIL the ghost guard)" },
    ].filter((s) => !args[1] || s.file.includes(args[1]));
    mkdirSync(join(dir, "fixtures"), { recursive: true });
    const results = [];
    for (const s of set) {
      const { r, piece, tempo, ms, deterministic, form } = renderOne(M, s);
      const g = M.guardReport(r, SR, s.seconds, { masking: !s.noMasking });
      const wav = join(dir, s.file + ".wav"); writeWavFloat(wav, r.L, r.R);
      execFileSync("ffmpeg", ["-v", "error", "-y", "-i", wav, "-c:a", "aac", "-b:a", "192k", join(dir, s.file + ".m4a")]);
      const m = M.measure(decode(wav), SR), ff = ffmpegEbu(wav), mm = M.measure(decode(join(dir, s.file + ".m4a")), SR);
      if (s.m4aOnly) unlinkSync(wav);
      const hasPiano = piece.parts.some((p) => p.inst === "piano" && p.notes.some((n) => n.role === "melody"));
      const res = { file: s.file, emotion: s.emotion, form: form ?? "as written", sections: piece.plan.sections.map((x) => x.id).join(","), guards: g, piece: piece.title, style: piece.plan.style, key: piece.plan.sections.map((x) => `${x.key} ${x.mode} (${Array.isArray(x.mood) ? x.mood.slice(0, 2).join("+") : x.mood})`).join(" / "), meter: piece.plan.meter, tempo: +tempo.toFixed(2), renderMs: ms, deterministic,
        gainDb: +r.gainDb.toFixed(2), master: r.masterMode, lufs: m.lufs, ffmpegLufs: ff.I, lra: m.lra, ffmpegLra: ff.LRA, dbtp: m.dbtp, ffmpegTp: ff.TP, samplePeakDb: m.samplePeakDb, onsetsPerS: m.onsetsPerS, dataOnsetsPerS: onsetsFromData(r) / m.durationS,
        centroidHz: m.centroidHz, centroidEnergyHz: m.centroidEnergyHz, durationS: m.durationS, lastOnsetDetectedS: m.lastOnsetS, lastOnsetDataS: r.perf.lastOnset, ...noteStats(M, piece),
        meanMelodyLeadMs: r.perf.meanLeadMs, voicingNoteDb: hasPiano ? noteVoicing(r, piece) : null, pedalChanges: piece.parts.some((p) => p.inst === "piano") && !s.flat ? r.perf.pedal.length : 0, voicingLU: hasPiano ? voicing(M, piece, tempo, s.seconds, s.flat) : null, m4a: { lufs: mm.lufs, dbtp: mm.dbtp }, problems: M.planProblems(piece),
        shortTerm: m.shortTerm.filter((_, i) => i % 10 === 0).map((x) => +x.toFixed(1)) };
      results.push(res);
      console.log(`${s.file}: LUFS ${fmt(m.lufs)} (ff ${fmt(ff.I)}) LRA ${fmt(m.lra)} (ff ${fmt(ff.LRA)}) TP ${fmt(m.dbtp)} (ff ${fmt(ff.TP)}) onsets/s ${fmt(m.onsetsPerS, 2)} [data ${fmt(res.dataOnsetsPerS, 2)}] centroid ${fmt(m.centroidHz, 0)} Hz range ${res.range} tempo ${fmt(tempo, 1)} voicing ${fmt(res.voicingLU)} LU / per-note ${fmt(res.voicingNoteDb)} dB lead ${fmt(res.meanMelodyLeadMs)} ms render ${ms} ms det ${deterministic} problems ${res.problems.length} | ghost ${g.ghost.pass ? "PASS" : "FAIL"} (${g.ghost.failures}/${g.ghost.windows}) reverb ${g.reverb.pass ? "PASS" : "FAIL"} ${fmt(g.reverb.worstDb)} dB masking ${g.masking ? `${g.masking.pass ? "PASS" : "FAIL"} ${Math.round(g.masking.shareOfBarsClear * 100)}%` : "n/a"} | form ${form ?? "-"}`);
    }
    const ref = join(here, "../../../anidoodle-research/refs/kevin-ngo-piano/film.mp4");
    const refPath = [ref, resolve(process.env.HOME ?? "", "CascadeProjects/Prompts/Claude-Skills/anidoodle-research/refs/kevin-ngo-piano/film.mp4")].find(existsSync);
    let reference = null;
    if (refPath) { const dec = decode(refPath), m = M.measure(dec, SR), ff = ffmpegEbu(refPath), gh = M.ghostCheck(dec, SR); reference = { ghost: { pass: gh.pass, failures: gh.failures, windows: gh.windows.map((w) => ({ from: w.from, onsetsPerBeat: +w.onsetsPerBeat.toFixed(2), sustainedShare: +w.sustainedShare.toFixed(2) })) }, file: "kevin-ngo-piano/film.mp4 (reference, measurement only)", lufs: m.lufs, ffmpegLufs: ff.I, lra: m.lra, ffmpegLra: ff.LRA, dbtp: m.dbtp, onsetsPerS: m.onsetsPerS, centroidHz: m.centroidHz, centroidEnergyHz: m.centroidEnergyHz, durationS: m.durationS, lastOnsetDetectedS: m.lastOnsetS, shortTerm: m.shortTerm.filter((_, i) => i % 10 === 0).map((x) => +x.toFixed(1)) };
      console.log(`REFERENCE ghost ${gh.pass ? "PASS" : "FAIL"}: LUFS ${fmt(m.lufs)} (ff ${fmt(ff.I)}) LRA ${fmt(m.lra)} (ff ${fmt(ff.LRA)}) onsets/s ${fmt(m.onsetsPerS, 2)} centroid ${fmt(m.centroidHz, 0)} (energy ${fmt(m.centroidEnergyHz, 0)})`); }
    const prev = existsSync(join(dir, "meters.json")) && args[1] ? JSON.parse(readFileSync(join(dir, "meters.json"), "utf8")) : null;
    const merged = prev ? { ...prev, results: [...prev.results.filter((x) => !results.some((y) => y.file === x.file)), ...results], reference: reference ?? prev.reference } : { generated: "tools/music.mjs samples", sampleRate: SR, results, reference, probe: probe(M) };
    writeFileSync(join(dir, "meters.json"), JSON.stringify(merged, null, 1));
  }
};

/** Piano realism probes (ADVISORY 4.1): single notes, matched loudness where it matters. */
const probe = (M) => {
  const note = (p, v, opts, dur = 3) => { const keys = [{ t: 0.05, off: dur, p, v }]; const { L, R } = M.renderPiano(keys, [], SR, Math.round((dur + 0.5) * SR), opts, 1); return [L, R]; };
  const cents = (arr) => arr;
  const vels = [0.15, 0.3, 0.5, 0.7, 0.9];
  const out = {};
  for (const [label, opts] of [["real", M.PIANO_REAL], ["flat", M.PIANO_FLAT]]) {
    const cs = vels.map((v) => M.centroid(note(60, v, opts, 1.5), SR).energyWeighted);
    const ls = vels.map((v) => M.loudness(note(60, v, opts, 1.5), SR).integrated);
    // decay: RMS in 50 ms windows of a held C4 (mf); slope early (0.1-0.6 s) vs late (2-4 s)
    const [L] = note(60, 0.6, opts, 6), w = Math.round(0.05 * SR), env = [];
    for (let a = 0; a + w < L.length; a += w) { let e = 0; for (let i = a; i < a + w; i++) e += L[i] * L[i]; env.push(10 * Math.log10(e / w + 1e-20)); }
    const slope = (t0, t1) => (env[Math.round(t1 / 0.05)] - env[Math.round(t0 / 0.05)]) / (t1 - t0);
    // beating: std-dev of the late envelope after removing the linear trend (dB)
    const late = env.slice(Math.round(2 / 0.05), Math.round(5 / 0.05)), k = late.length, mx = (k - 1) / 2, my = late.reduce((a, b) => a + b, 0) / k;
    let sxy = 0, sxx = 0; late.forEach((y, i) => { sxy += (i - mx) * (y - my); sxx += (i - mx) ** 2; }); const b1 = sxy / sxx;
    const resid = Math.sqrt(late.reduce((a, y, i) => a + (y - (my + b1 * (i - mx))) ** 2, 0) / k);
    const rank = (a) => a.map((x) => a.filter((y) => y < x).length);
    const rc = rank(cs), rv = rank(vels), n = vels.length, d2 = rc.reduce((a, r, i) => a + (r - rv[i]) ** 2, 0), rho = 1 - (6 * d2) / (n * (n * n - 1));
    out[label] = { centroidByVelocityHz: cs.map((x) => Math.round(x)), loudnessByVelocityLUFS: ls.map((x) => +x.toFixed(1)), spearmanCentroidVsVelocity: new Set(cs.map((x) => Math.round(x))).size === 1 ? "n/a (spectrum does not change with velocity)" : +rho.toFixed(2), decayEarlyDbPerS: +slope(0.1, 0.6).toFixed(1), decayLateDbPerS: +slope(2, 4).toFixed(1), lateEnvelopeWobbleDb: +resid.toFixed(2) };
  }
  out.inharmonicityB = Object.fromEntries([28, 40, 48, 60, 72, 84, 96].map((m) => [M.nameOf(m), +M.inharmonicityB(m).toExponential(2)]));
  void cents;
  return out;
};

main().catch((e) => { console.error(e); process.exit(1); });
