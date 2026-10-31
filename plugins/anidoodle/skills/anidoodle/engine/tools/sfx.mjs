#!/usr/bin/env node
// The sound-effects kit, rendered and checked.
//
//   node tools/sfx.mjs list                         # kinds, variants, levels, when to use each
//   node tools/sfx.mjs one <kind> [variant] [seed] <out.wav|out.mp3>
//   node tools/sfx.mjs kit <outdir>                 # every kind x variant, 3 varied hits each, + demo + page + meters.json
//   node tools/sfx.mjs test                         # determinism, hygiene, audibility, validation (exit 1 on failure)
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url)), SR = 48000;
/** 32-bit float stereo WAV (no clipping on the way to the encoder). */
const writeWavFloat = (path, L, R, sr) => {
  const n = L.length, data = Buffer.alloc(n * 8), h = Buffer.alloc(44);
  for (let i = 0; i < n; i++) { data.writeFloatLE(L[i], i * 8); data.writeFloatLE(R[i], i * 8 + 4); }
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVEfmt ", 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(3, 20); h.writeUInt16LE(2, 22);
  h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 8, 28); h.writeUInt16LE(8, 32); h.writeUInt16LE(32, 34); h.write("data", 36); h.writeUInt32LE(data.length, 40);
  writeFileSync(path, Buffer.concat([h, data]));
};
const load = async () => {
  const r = await build({ entryPoints: [join(here, "../src/canvas-core/music/index.ts")], bundle: true, write: false, format: "esm", platform: "neutral", target: "es2022", logLevel: "error" });
  return import("data:text/javascript;base64," + Buffer.from(r.outputFiles[0].text).toString("base64"));
};
const md5 = (...chans) => { const h = createHash("md5"); for (const c of chans) h.update(Buffer.from(c.buffer, c.byteOffset, c.byteLength)); return h.digest("hex"); };
const dB = (x) => 20 * Math.log10(Math.max(x, 1e-12));
const peakOf = (L, R) => { let p = 0; for (let i = 0; i < L.length; i++) p = Math.max(p, Math.abs(L[i]), Math.abs(R[i])); return p; };
const toMp3 = (wav, mp3) => { execFileSync("ffmpeg", ["-v", "error", "-y", "-i", wav, "-codec:a", "libmp3lame", "-b:a", "192k", mp3]); unlinkSync(wav); };
const writeAudio = (path, L, R) => { if (path.endsWith(".mp3")) { const w = path + ".wav"; writeWavFloat(w, L, R, SR); toMp3(w, path); } else writeWavFloat(path, L, R, SR); };
/** Share of energy above 20 kHz (aliasing / fizz) in dB relative to the total, via one big FFT. */
const hfShare = (M, L) => {
  let N = 1; while (N < L.length) N <<= 1; N = Math.min(N, 1 << 18);
  const re = new Float64Array(N), im = new Float64Array(N); for (let i = 0; i < Math.min(N, L.length); i++) re[i] = L[i];
  M.fft(re, im); let tot = 0, hi = 0; const k20 = Math.round((20000 / SR) * N);
  for (let k = 1; k < N / 2; k++) { const e = re[k] * re[k] + im[k] * im[k]; tot += e; if (k >= k20) hi += e; }
  return 10 * Math.log10(Math.max(hi, 1e-30) / Math.max(tot, 1e-30));
};
const dcOf = (L) => { let s = 0; for (const x of L) s += x; return s / L.length; };
const harshColumns = (h) => {
  const f = (v) => v === null ? "n/a" : v.toFixed(2);
  return `band cue/score ${f(h.cueBandDb)}/${f(h.musicBandDb)}  lift ${f(h.liftDb)}  full ${f(h.cueRmsDb)}  tilt ${f(h.tiltDb)}  peak/score ${f(h.peakDb)}/${f(h.musicPeakDb)}  peak over score ${f(h.peakMarginDb)}  body(150ms) ${f(h.bodyDb)}  peak-body ${f(h.crestDb)} dB  harsh ${h.ok ? "PASS" : "FAIL"}${h.mode === "tame" ? `  tame -${f(h.reductionDb)} dB` : ""}${h.conflict ? "  conflict: " + h.conflict : ""}`;
};
const printAudibility = (mix) => {
  for (const a of mix.audibility) console.log(`  ${a.atS.toFixed(2).padStart(6)} s  ${(a.kind + ":" + a.variant).padEnd(16)} ${a.label.padEnd(22)} margin ${a.marginDb.toFixed(1).padStart(5)} dB  (peak ${a.peakMarginDb.toFixed(1)} dB)  ${harshColumns(mix.harshness.find((h) => h.i === a.i))}`);
};

/** Three varied hits of one variant, back to back, so the ear hears the variation. */
const reel = (M, kind, variant, opts = {}) => {
  const hits = [1, 2, 3].map((seed) => M.renderSfx(kind, { variant, seed, key: "C", bpm: 90, ...opts }, SR));
  const gap = Math.round(0.35 * SR), lead = Math.round(0.15 * SR), pre = Math.max(...hits.map((h) => h.hit)), n = lead + hits.reduce((a, h) => a + h.L.length + gap, 0) + pre;
  const L = new Float32Array(n), R = new Float32Array(n); let at = lead;
  for (const h of hits) { L.set(h.L, at); R.set(h.R, at); at += h.L.length + gap; }
  return { L, R, hits };
};

// The launch-film baseline (launch3.ts audio3), rebuilt verbatim so the kit can be A/B'd against it.
const baseline = (M) => {
  const out = {}, r = (() => { let a = 4242 >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
  const mk = (len, fn, gain, pan = 0) => { const n = Math.round(len * SR), L = new Float32Array(n), R = new Float32Array(n); for (let i = 0; i < n; i++) { const v = fn(i / SR) * gain; L[i] = v * (1 - Math.max(0, pan)); R[i] = v * (1 + Math.min(0, pan)); } return [L, R]; };
  out.click = (() => { const f0 = 2600 + r() * 1400, ph = r() * 6; return mk(0.03, (s) => Math.sin(2 * Math.PI * f0 * s + ph) * Math.exp(-s / 0.004) + (r() - 0.5) * Math.exp(-s / 0.002) * 0.6, 0.05); })();
  out.thock = mk(0.14, (s) => Math.sin(2 * Math.PI * (70 + 90 * Math.exp(-s / 0.02)) * s) * Math.exp(-s / 0.05), 0.2);
  out.plip = mk(0.16, (s) => Math.sin(2 * Math.PI * (320 + 700 * Math.exp(-s / 0.03)) * s) * Math.exp(-s / 0.06), 0.12);
  out.whoosh = (() => { let z = 0; return mk(0.32, (s) => { z += 0.14 * ((r() - 0.5) - z); return z * Math.sin((Math.PI * s) / 0.32) ** 2; }, 0.55); })();
  out.scratch = (() => { let z = 0; return mk(0.6, (s) => { z += 0.5 * ((r() - 0.5) - z); return z * (0.6 + 0.4 * Math.sin(s * 70)) * Math.min(1, s * 20) * Math.min(1, (0.6 - s) * 20); }, 0.07); })();
  return out;
};

// The demo: 15 s of the launch score's first bars with the kit on top, the story of the film's opening.
const FPS = 30, DEMO_FRAMES = 450;
export const demoPlan = (M) => {
  const cues = [];
  // typing "make a koi that swims" at a human cadence (a cue sits on a whole frame)
  const text = "make a koi that swims"; let f = 12;
  for (let i = 0; i < text.length; i++) { cues.push({ frame: Math.round(f), kind: "tick", variant: text[i] === " " ? "space" : "key", label: i === 0 ? "typing" : undefined }); f += 2.4 + ((i * 7) % 5) * 0.55 + (text[i] === " " ? 1.5 : 0); }
  cues.push(
    { frame: 157, kind: "press", variant: "thock", snap: "beat", label: "Generate" },
    { frame: 170, kind: "ink", variant: "bloom", label: "the drawing opens" },
    { frame: 182, kind: "scratch", variant: "nib", lengthS: 1.4, label: "lettering writes" },
    { frame: 232, kind: "whoosh", variant: "soft", label: "scene move" },
    { frame: 250, kind: "swish", variant: "in", label: "code panel slides in" },
    { frame: 268, kind: "bubble", variant: "bubbles", label: "the koi" },
    { frame: 290, kind: "brick", variant: "snap", label: "brick" },
    { frame: 300, kind: "brick", variant: "clack" },
    { frame: 312, kind: "thread", variant: "stitch", label: "embroidery" },
    { frame: 322, kind: "chime", variant: "sparkle", snap: "beat", label: "sparkle" },
    { frame: 400, kind: "riser", variant: "soft", beats: 4, label: "the build" },
    { frame: 400, kind: "impact", variant: "bloom", snap: "bar", label: "the reveal" },
  );
  return { fps: FPS, frames: DEMO_FRAMES, score: { piece: M.launchLofi3() }, beatZeroS: 0, seed: 7, cues }; // key, bpm, bar length come from the score
};
const demoMusic = (M) => { const r = M.renderPiece(M.launchLofi3(), SR); return [r.L.slice(0, Math.round((DEMO_FRAMES / FPS) * SR)), r.R.slice(0, Math.round((DEMO_FRAMES / FPS) * SR))]; };

const page = (rows, demo) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>anidoodle sfx kit</title>
<style>:root{--bg:#F0EEE6;--ink:#1d1b16;--mute:#6b665b;--line:#d8d3c4;--acc:#ca4901}@media (prefers-color-scheme:dark){:root{--bg:#1b1a17;--ink:#eeeae0;--mute:#a39e92;--line:#34322c}}
body{background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,sans-serif;margin:0;padding:24px 16px;max-width:980px;margin:auto}h1{font-size:26px;margin:0 0 4px}h2{font-size:17px;margin:28px 0 8px;color:var(--acc)}p{color:var(--mute);margin:4px 0 12px}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:10px}.c{border:1px solid var(--line);border-radius:10px;padding:10px 12px}.c b{font-size:14px}.m{font:12px ui-monospace,monospace;color:var(--mute)}audio{width:100%;height:34px;margin-top:6px}</style></head><body>
<h1>anidoodle sound-effects kit</h1><p>Every sound is code: layered (transient + body + tail), stereo, and varied per seed. Each player holds 3 hits of the same variant with different seeds, so you hear the variation.</p>
<h2>In context: the launch score's first bars with the kit on top</h2><div class="g">${demo.map(([f, t, d]) => `<div class="c"><b>${t}</b><div class="m">${d}</div><audio controls preload="none" src="${f}"></audio></div>`).join("")}</div>
${rows.map(([kind, use, vs]) => `<h2>${kind}</h2><p>${use}</p><div class="g">${vs.map((v) => `<div class="c"><b>${kind} · ${v.variant}</b><div class="m">${v.meta}</div><audio controls preload="none" src="${v.file}"></audio></div>`).join("")}</div>`).join("\n")}
</body></html>`;

const kit = async (outdir) => {
  const M = await load(), dir = resolve(outdir); mkdirSync(join(dir, "spectra"), { recursive: true });
  const rows = [], meters = { kinds: {}, baseline: {}, demo: null };
  for (const kind of M.SFX_KINDS) {
    const info = M.sfxInfo(kind), vs = [];
    for (const variant of info.variants) {
      const { L, R, hits } = reel(M, kind, variant), file = `${kind}-${variant}.mp3`;
      writeAudio(join(dir, file), L, R);
      const c = M.centroid([L, R], SR), m = { peakDb: dB(peakOf(L, R)), windowLufs: hits.map((h) => +h.lufs.toFixed(1)), centroidHz: Math.round(c.energyWeighted), lengthsS: hits.map((h) => +(h.L.length / SR).toFixed(2)), hfShareDb: +hfShare(M, L).toFixed(1), dc: +dcOf(L).toExponential(1) };
      meters.kinds[`${kind}:${variant}`] = m;
      vs.push({ variant, file, meta: `peak ${m.peakDb.toFixed(1)} dBFS · ${m.windowLufs.join(" / ")} LUFS(win) · centroid ${m.centroidHz} Hz` });
    }
    execFileSync("ffmpeg", ["-v", "error", "-y", "-i", join(dir, `${kind}-${info.variants[0]}.mp3`), "-lavfi", "showspectrumpic=s=480x160:legend=0:scale=log", join(dir, "spectra", `${kind}.png`)]);
    rows.push([kind, info.use, vs]);
  }
  for (const [k, [L, R]] of Object.entries(baseline(M))) { writeAudio(join(dir, `baseline-${k}.mp3`), L, R); meters.baseline[k] = { peakDb: +dB(peakOf(L, R)).toFixed(1), centroidHz: Math.round(M.centroid([L, R], SR).energyWeighted), lengthS: +(L.length / SR).toFixed(2) }; }
  const plan = demoPlan(M), music = demoMusic(M), mix = M.mixSfx(music, plan, SR);
  writeAudio(join(dir, "demo.mp3"), mix.L, mix.R);
  writeAudio(join(dir, "demo-sfx-only.mp3"), mix.sfx[0], mix.sfx[1]);
  writeAudio(join(dir, "demo-music-only.mp3"), music[0], music[1]);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-i", join(dir, "demo.mp3"), "-lavfi", "showspectrumpic=s=900x220:legend=0:scale=log", join(dir, "spectra", "demo.png")]);
  meters.demo = { ok: mix.ok, lufs: +mix.lufs.toFixed(1), dbtp: +mix.dbtp.toFixed(2), limiterDb: +mix.limiterDb.toFixed(2), cues: mix.audibility.map((a) => ({ kind: `${a.kind}:${a.variant}`, label: a.label, atS: +a.atS.toFixed(2), marginDb: +a.marginDb.toFixed(1), peakMarginDb: +a.peakMarginDb.toFixed(1), harshness: mix.harshness.find((h) => h.i === a.i) })) };
  writeFileSync(join(dir, "meters.json"), JSON.stringify(meters, null, 1));
  const demo = [["demo.mp3", "demo: score + kit", `15 s, ${plan.cues.length} cues, ${mix.lufs.toFixed(1)} LUFS, ${mix.dbtp.toFixed(1)} dBTP, every cue audible: ${mix.ok}`], ["demo-sfx-only.mp3", "demo: kit only", "the same cues without the score"], ["demo-music-only.mp3", "demo: score only", "launchLofi3, first 15 s, undipped"],
    ...Object.keys(meters.baseline).map((k) => [`baseline-${k}.mp3`, `baseline: launch3 ${k}`, "the launch film's current effect, for A/B"])];
  writeFileSync(join(dir, "index.html"), page(rows, demo));
  console.log(`wrote ${dir}: ${rows.reduce((a, r) => a + r[2].length, 0)} variant reels, 3 demo files, ${Object.keys(meters.baseline).length} baselines, index.html, meters.json, spectra/`);
  console.log(`demo: ${mix.lufs.toFixed(1)} LUFS, ${mix.dbtp.toFixed(2)} dBTP, limiter ${mix.limiterDb.toFixed(2)} dB, all audible: ${mix.ok}`);
  printAudibility(mix);
};

const test = async () => {
  const M = await load(); let pass = 0, fail = 0;
  const ok = (c, msg) => { if (c) pass++; else { fail++; console.log("FAIL " + msg); } };
  const throws = (fn, re, msg) => { try { fn(); ok(false, `${msg}: did not throw`); } catch (e) { ok(re.test(e.message), `${msg}: wrong message "${e.message}"`); } };
  const all = M.SFX_KINDS.flatMap((k) => M.sfxVariants(k).map((v) => [k, v]));
  ok(M.SFX_KINDS.length >= 14, `>= 14 kinds (got ${M.SFX_KINDS.length})`);
  for (const [k, v] of all) {
    const a = M.renderSfx(k, { variant: v, seed: 11, key: "C", bpm: 90 }, SR), b = M.renderSfx(k, { variant: v, seed: 11, key: "C", bpm: 90 }, SR), c = M.renderSfx(k, { variant: v, seed: 12, key: "C", bpm: 90 }, SR), tag = `${k}:${v}`;
    ok(md5(a.L, a.R) === md5(b.L, b.R), `${tag} deterministic`);
    ok(md5(a.L, a.R) !== md5(c.L, c.R), `${tag} varies with seed`);
    let finite = true; for (let i = 0; i < a.L.length; i++) if (!Number.isFinite(a.L[i]) || !Number.isFinite(a.R[i])) { finite = false; break; }
    ok(finite, `${tag} no NaN/Inf`);
    const pk = peakOf(a.L, a.R);
    ok(pk > 0.01, `${tag} non-silent (peak ${dB(pk).toFixed(1)} dBFS)`);
    ok(dB(pk) <= -0.99, `${tag} peak <= -1 dBFS (got ${dB(pk).toFixed(2)})`);
    ok(Math.abs(dcOf(a.L)) < 1e-3 * Math.max(pk, 1e-9) * 10 && Math.abs(dcOf(a.R)) < 1e-2 * pk, `${tag} no DC offset (${dcOf(a.L).toExponential(1)})`);
    ok(a.lufs > -40, `${tag} speaks (window ${a.lufs.toFixed(1)} LUFS)`);
    ok(Math.abs(a.lufs - c.lufs) < 3.5, `${tag} level stable across seeds (${a.lufs.toFixed(1)} vs ${c.lufs.toFixed(1)})`);
    ok(Math.abs(a.L[a.L.length - 1]) < 1e-3 && Math.abs(a.R[a.R.length - 1]) < 1e-3, `${tag} ends at zero (no end click)`);
    ok(hfShare(M, a.L) < -30, `${tag} no fizz above 20 kHz (${hfShare(M, a.L).toFixed(1)} dB)`);
  }
  // motion: a whoosh approaches bright from the left and leaves darker to the right (doppler + pan)
  const w = M.renderSfx("whoosh", { variant: "air", seed: 5, dir: 1 }, SR), half = (a, b) => [w.L.slice(a, b), w.R.slice(a, b)];
  const pre = half(Math.max(0, w.hit - SR * 0.25), w.hit), post = half(w.hit, w.hit + SR * 0.25), e = (x) => x.reduce((a, v) => a + v * v, 0);
  const cPre = M.centroid(pre, SR).energyWeighted, cPost = M.centroid(post, SR).energyWeighted;
  ok(cPre > cPost * 1.1, `whoosh doppler: approach brighter than exit (${cPre.toFixed(0)} vs ${cPost.toFixed(0)} Hz)`);
  ok(e(pre[0]) > e(pre[1]) && e(post[1]) > e(post[0]), "whoosh travels left -> right (dir 1)");
  // tuning: a bell in A rings on A5 = 880 Hz
  const bell = M.renderSfx("chime", { variant: "bell", key: "A", seed: 2 }, SR), N = 1 << 16, re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < N; i++) re[i] = bell.L[i] + bell.R[i];
  M.fft(re, im); let best = 0, bk = 0; for (let k = 10; k < N / 2; k++) { const m = re[k] * re[k] + im[k] * im[k]; if (m > best) { best = m; bk = k; } }
  ok(Math.abs((bk * SR) / N - 880) < 3, `chime in A rings on 880 Hz (got ${((bk * SR) / N).toFixed(1)})`);
  // no silent defaults: tuned / tempo-synced kinds need a key / bpm, from the plan or the film's score
  throws(() => M.renderSfx("chime"), /tuned and needs a key.*no default key/, "chime without a key");
  throws(() => M.renderSfx("press", { variant: "confirm" }), /needs a key/, "press:confirm without a key");
  throws(() => M.renderSfx("impact", { variant: "bloom" }), /needs a key/, "impact:bloom without a key");
  throws(() => M.renderSfx("riser", { key: "C" }), /needs a bpm.*no default tempo/, "riser without a bpm");
  ok(M.renderSfx("press", {}).L.length > 0 && M.renderSfx("riser", { variant: "air", lengthS: 2 }).L.length > 0, "untuned kinds render without key/bpm");
  throws(() => M.mixSfx(null, { fps: 30, frames: 300, cues: [{ frame: 10, kind: "chime" }] }, SR), /cue #0 \(chime.*is tuned: set plan.key/, "plan cue: chime without a key names the cue");
  throws(() => M.mixSfx(null, { fps: 30, frames: 300, cues: [{ frame: 10.5, kind: "tick" }] }, SR), /cue #0 \(tick.*must be a whole frame/, "a fractional cue frame is rejected, not rounded");
  const noct = M.nocturne(), fromScore = M.placeSfx({ fps: 30, frames: 300, score: { piece: noct }, cues: [{ frame: 10, kind: "chime", variant: "bell" }, { frame: 200, kind: "riser", beats: 2 }] }, SR);
  const rp = M.resolveSfxPlan({ fps: 30, frames: 300, score: { piece: noct }, cues: [] });
  ok(rp.key === "Ab" && rp.bpm === noct.plan.tempo && rp.beatsPerBar === 3, `plan.score gives key/bpm/bar (got ${rp.key} ${rp.bpm} ${rp.beatsPerBar})`);
  ok(Math.abs(fromScore[1].sound.hit / SR - 2 * 60 / noct.plan.tempo) < 0.002, "a riser in a scored plan takes the score's tempo");
  { const b2 = fromScore[0].sound, N2 = 1 << 16, re2 = new Float64Array(N2), im2 = new Float64Array(N2); for (let i = 0; i < N2; i++) re2[i] = b2.L[i] + b2.R[i]; M.fft(re2, im2); let bb = 0, kk = 0; for (let k = 10; k < N2 / 2; k++) { const m = re2[k] * re2[k] + im2[k] * im2[k]; if (m > bb) { bb = m; kk = k; } }
    ok(Math.abs((kk * SR) / N2 - 830.6) < 3, `a bell under the Ab nocturne rings on Ab5 (got ${((kk * SR) / N2).toFixed(1)})`); }
  ok(M.resolveSfxPlan({ fps: 30, frames: 300, key: "D", score: { piece: noct }, cues: [] }).key === "D", "an explicit plan.key beats the score's");
  // tempo sync: a 4-beat riser at 120 bpm lasts 2 s and its hit is its end
  const rz = M.renderSfx("riser", { beats: 4, bpm: 120, key: "G", seed: 3 }, SR); ok(Math.abs(rz.hit / SR - 2) < 0.002, `riser 4 beats @120 = 2 s (got ${(rz.hit / SR).toFixed(3)})`);
  // the demo: deterministic, clean, every cue audible
  const plan = demoPlan(M), music = demoMusic(M), m1 = M.mixSfx(music, plan, SR), m2 = M.mixSfx(music, plan, SR);
  ok(md5(m1.L, m1.R) === md5(m2.L, m2.R), "demo mix deterministic");
  ok(m1.L.length === Math.round((DEMO_FRAMES / FPS) * SR), "demo mix is exactly the film length");
  ok(m1.dbtp <= -0.9, `demo true peak <= -1 dBTP (got ${m1.dbtp.toFixed(2)})`);
  ok(m1.ok && m1.audibility.every((a) => a.marginDb >= -6), `demo: every cue within 6 dB of the score (worst ${Math.min(...m1.audibility.map((a) => a.marginDb)).toFixed(1)} dB)`);
  printAudibility(m1);
  const g = m1.placed.find((p) => p.cue.label === "Generate"); ok(g && Math.abs(g.hitS - 160 / 30) < 1e-9, `snap to beat: frame 157 -> 160 (got ${g && (g.hitS * 30).toFixed(2)})`);
  const imp = m1.placed.find((p) => p.cue.kind === "impact"); ok(imp && Math.min(...Array.from(m1.duck.subarray(imp.window[0], imp.window[1]))) < 0.55, "score ducks >= 5 dB under the impact");
  // a buried cue must FAIL
  const quiet = { ...plan, cues: [{ frame: 200, kind: "tick", gainDb: -30, label: "buried" }] }, mq = M.mixSfx(music, quiet, SR);
  ok(!mq.ok && mq.audibility[0].marginDb < -6, `buried cue detected (margin ${mq.audibility[0].marginDb.toFixed(1)} dB)`);
  throws(() => M.assertSfxAudible(mq), /buried under the score/, "assertSfxAudible throws on a buried cue");
  throws(() => M.filmSfx(() => music, quiet)(SR), /buried/, "filmSfx refuses a buried cue");
  // validation
  const base = { fps: 30, frames: 300, cues: [] };
  throws(() => M.renderSfx("kazoo"), /unknown kind "kazoo".*kinds: tick/, "unknown kind");
  throws(() => M.renderSfx("tick", { variant: "loud" }), /no variant "loud"/, "unknown variant");
  throws(() => M.mixSfx(null, { ...base, cues: [{ frame: 1, kind: "kazoo" }] }, SR), /unknown kind/, "unknown kind in a plan");
  throws(() => M.mixSfx(null, { ...base, cues: [{ frame: 2, kind: "whoosh" }] }, SR), /pre-roll starts before frame 0; move it to frame >= \d+/, "whoosh pre-roll before 0");
  throws(() => M.mixSfx(null, { ...base, bpm: 90, key: "C", cues: [{ frame: 30, kind: "riser", beats: 8 }] }, SR), /pre-roll/, "riser pre-roll before 0");
  for (const s of [-1, 1.5, 2 ** 33, NaN, "7"]) throws(() => M.renderSfx("pop", { seed: s }), /seed must be an integer/, `bad seed ${String(s)}`);
  throws(() => M.mixSfx(null, { ...base, seed: -3, cues: [] }, SR), /seed must be an integer/, "bad plan seed");
  throws(() => M.mixSfx(null, { ...base, cues: [{ frame: 300, kind: "pop" }] }, SR), /frame must be 0\.\.299/, "cue after the film");
  throws(() => M.mixSfx(null, { ...base, cues: [{ frame: -1, kind: "pop" }] }, SR), /frame must be/, "cue before 0");
  throws(() => M.mixSfx(null, { ...base, cues: [{ frame: 10, kind: "pop", snap: "beat" }] }, SR), /need a bpm/, "snap without bpm");
  throws(() => M.renderSfx("chime", { key: "H" }), /bad key/, "bad key");
  throws(() => M.renderSfx("pop", { pitch: 99 }), /pitch must be/, "pitch out of range");
  // placement is stable: inserting an unrelated cue earlier does not change another cue's sound
  const p1 = M.placeSfx({ ...base, cues: [{ frame: 100, kind: "pop" }] }, SR), p2 = M.placeSfx({ ...base, cues: [{ frame: 50, kind: "brick" }, { frame: 100, kind: "pop" }] }, SR);
  ok(md5(p1[0].sound.L) === md5(p2[1].sound.L), "a cue's sound does not depend on the cues before it");
  const p3 = M.placeSfx({ ...base, cues: [{ frame: 100, kind: "tick" }, { frame: 110, kind: "tick" }] }, SR);
  ok(md5(p3[0].sound.L) !== md5(p3[1].sound.L), "two ticks never render identically");
  console.log(`sfx: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
};

const [cmd, ...args] = process.argv.slice(2);
if (cmd === "list") { const M = await load(); for (const k of M.SFX_KINDS) { const i = M.sfxInfo(k); console.log(`${k.padEnd(8)} [${i.variants.join(", ")}]  level ${i.levelLufs} LUFS(win), duck ${i.duckDb} dB\n         ${i.use}`); } }
else if (cmd === "one") { const M = await load(), out = args.pop(), [kind, variant, seed] = args; const s = M.renderSfx(kind, { variant, seed: seed ? Number(seed) : undefined, legacy: process.env.SFX_LEGACY === "1", key: process.env.KEY, bpm: process.env.BPM ? Number(process.env.BPM) : undefined }, SR); writeAudio(out, s.L, s.R); console.log(`${kind}:${s.variant} seed ${s.seed}: ${(s.L.length / SR).toFixed(2)} s, hit @ ${(s.hit / SR).toFixed(3)} s, ${s.lufs.toFixed(1)} LUFS(win)`); }
else if (cmd === "kit" && args[0]) await kit(args[0]);
else if (cmd === "test") await test();
else { console.log("usage: node tools/sfx.mjs list | one <kind> [variant] [seed] <out> | kit <outdir> | test"); process.exit(cmd ? 1 : 0); }
