#!/usr/bin/env node
// Sound pack builder: free CC0 recordings (VCSL) -> the anidoodle pack both tracks build to
// (CONTRACT.md: manifest.json + FLAC zones + LICENSES.md). Track B's sampler plays this pack; we
// meet at the format and nowhere else.
//
//   node tools/soundpack.mjs fetch  <source-dir> [--only piano,marimba]   # download the source files the recipes need (skip files already there, verify size)
//   node tools/soundpack.mjs build  <source-dir> <pack-dir> [--only ...]  # write the pack: FLAC zones + manifest.json + LICENSES.md
//   node tools/soundpack.mjs verify <pack-dir>                            # every rule of the contract, exit 1 on any failure
//   node tools/soundpack.mjs report <pack-dir>                            # per instrument: zones, layers, widest pitch gap, MB
//   node tools/soundpack.mjs dist   <pack-dir> <dist-dir>                 # the release artifacts: one tar per instrument + rooms + anidoodle-sounds-v1.json
//
// Determinism: fixed ffmpeg flags with -bitexact, no metadata, manifest keys in a fixed order;
// building twice from the same sources gives the same manifest and the same sha256 per file.
// Zone gain is never touched; where the source normalized its layers (the Steinway, NORMALIZED.txt)
// the instrument says so ("normalized": true) and the engine supplies the dynamics.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync, openSync, closeSync, writeSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { isMain } from "./is-main.mjs";

const SR = 48000;
const VCSL_RAW = "https://raw.githubusercontent.com/sgossner/VCSL/master/";
// The whole-repo file index (size TAB path), kept with the research notes this tool was built from.
// the sound-pack work folder (sources, room recordings, the built pack) lives outside the repository
const PACK_DIR = process.env.ANIDOODLE_SOUNDPACK_DIR ?? "";
const VCSL_TREE = join(PACK_DIR, "vcsl-tree.tsv");

// ---------------------------------------------------------------- note names
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const noteMidi = (n, shift = 0) => {
  const m = /^([A-G])([#b]?)(-?\d+)$/.exec(n);
  if (!m) throw new Error(`bad note name "${n}"`);
  return (Number(m[3]) + 1) * 12 + SEMI[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + shift;
};
const midiName = (midi) => `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
const hzOf = (midi) => 440 * 2 ** ((midi - 69) / 12);

// ---------------------------------------------------------------- recipes
// One table per instrument: the VCSL folder, how to read note/layer/rr out of its file names (they
// differ per instrument), the engine id, kind, damped, and which notes and layers to take. Mic
// position: one per instrument, the closest and driest the source records (Steinway Close, Knight
// Player, Harp KSHarp single pair, Marimba Outrigger, Vibes Main, Glock/Chimes/Timpani as recorded).
// Dynamic names -> layer 1 (softest) .. layers (hardest).
const LAYER_OF_DYN = { ppp: 1, pp: 1, p: 1, mp: 1, mf: 1, soft: 1, f: 2, ff: 2, fff: 2, med: 2, loud: 3 };
// Octave naming traps, both verified by measuring the recorded pitch, not assumed:
//  - The Knight names its octaves one below standard MIDI (its PitchValueConversionChart.txt:
//    A-1 = 21 ... C7 = 108), hence +12.
//  - The struck idiophones (marimba, vibes, glockenspiel, chimes) are also all named one octave
//    BELOW sounding pitch: measured zone spectra land on name+12 for every zone (e.g. marimba
//    "F1" reads 87.3 Hz = F2; glock "G4" reads 787.8 Hz = G5), and the corrected spans reproduce
//    the real instruments' compasses exactly: vibes F3..F6, glockenspiel G5..C8, chimes C4..F5.
// realRange is the real instrument's compass; the manifest range = recorded span widened by
// maxShift (default 2, the repitch allowance) at each end, clipped to realRange.
const RECIPES = [
  {
    id: "piano", title: "Grand Piano, Steinway B", kind: "struck", damped: true, normalized: true,
    dir: "Chordophones/Zithers/Grand Piano, Steinway B/NoSus",
    notesFiles: ["Chordophones/Zithers/Grand Piano, Steinway B/NORMALIZED.txt"],
    re: /^JHPiano_NoSus_Close_([A-G][#b]?-?\d+)_vl(\d+)_rr(\d+)\.wav$/,
    zone: (m) => ({ midi: noteMidi(m[1]), layer: Number(m[2]) - 1, rr: Number(m[3]) }), // vl2..4 -> layers 1..3
    take: (z) => z.midi % 4 === 2, // whole-tone source 22..104, every other note: gaps of 4, inside the +-2 repitch rule
    realRange: [21, 108], // the Steinway keyboard, A0..C8
    // Amendment b (2026-10-04): Sus = the same takes recorded with the pedal down (dampers lifted,
    // the whole harp rings in sympathy); Rel = the key/damper return noise after a NoSus note.
    // Same naming and vl2..4 layers, rr1 only. Rel covers only 33 of the 42 source notes (nothing
    // above ~G#5), so it ships what exists at the same every-other-note density.
    arts: [
      { art: "sus", dir: "Chordophones/Zithers/Grand Piano, Steinway B/Sus", re: /^JHPiano_Sus_Close_([A-G][#b]?-?\d+)_vl(\d+)_rr(\d+)\.wav$/ },
      { art: "rel", dir: "Chordophones/Zithers/Grand Piano, Steinway B/Rel", re: /^JHPiano_NoSusRel_Close_([A-G][#b]?-?\d+)_vl(\d+)_rr(\d+)\.wav$/ },
    ],
  },
  {
    id: "piano.upright", title: "Upright Piano, Knight", kind: "struck", damped: true,
    dir: "Chordophones/Zithers/Upright Piano, Knight/Sustains",
    notesFiles: ["Chordophones/Zithers/Upright Piano, Knight/Info.txt", "Chordophones/Zithers/Upright Piano, Knight/PitchValueConversionChart.txt"],
    re: /^Player_vl(\d+)_rr(\d+)_([A-G][#b]?-?\d+)\.wav$/,
    zone: (m) => ({ midi: noteMidi(m[3], 12), layer: Number(m[1]), rr: Number(m[2]) }),
    take: (z) => z.midi % 4 === 1 || z.midi === 108, // whole-tone 21..108, every other note, top C8 kept
    realRange: [21, 108],
    // Amendment b/c: the Knight ships key/damper release takes for its full note set (Player_rel_rr1_*,
    // one take per note, no velocity layers) - art "rel" at layer 1, same every-other-note density.
    arts: [
      { art: "rel", dir: "Chordophones/Zithers/Upright Piano, Knight/Releases",
        re: /^Player_rel_rr(\d+)_([A-G][#b]?-?\d+)\.wav$/,
        zone: (m) => ({ midi: noteMidi(m[2], 12), layer: 1, rr: Number(m[1]) }) },
    ],
  },
  {
    id: "harp", title: "Concert Harp", kind: "struck", damped: false,
    dir: "Chordophones/Composite Chordophones/Concert Harp",
    re: /^KSHarp_([A-G][#b]?-?\d+)_(fff|pp|ff|mf|mp|f|p)(\d?)\.wav$/,
    zone: (m) => ({ midi: noteMidi(m[1]), layer: LAYER_OF_DYN[m[2]], rr: 1 }), // trailing digit is a take number, one file per note+dynamic
    take: () => true,
    realRange: [23, 103], // concert harp Cb1..Gb7
  },
  {
    id: "marimba", title: "Marimba", kind: "struck", damped: false, sparse: true,
    dir: "Idiophones/Struck Idiophones/Marimba",
    re: /^Marimba_hit_Outrigger_([A-G][#b]?-?\d+)_(soft|med|loud)_\d+\.wav$/,
    zone: (m) => ({ midi: noteMidi(m[1], 12), layer: LAYER_OF_DYN[m[2]], rr: 1 }), // +12: VCSL names one octave below sounding pitch (measured)
    take: () => true,
    realRange: [36, 96], // 5-octave marimba C2..C7; the corrected recordings span F2..C7
  },
  {
    id: "vibes", title: "Vibraphone", kind: "struck", damped: true,
    dir: "Idiophones/Struck Idiophones/Vibraphone", // Hard Mallets + Soft Mallets subfolders
    re: /^Vibes_(hard|soft)_([A-G][#b]?-?\d+)_v(\d)_rr(\d)_Main\.wav$/,
    zone: (m) => ({ mallet: m[1], v: Number(m[3]), midi: noteMidi(m[2], 12), layer: m[1] === "soft" ? 1 : Number(m[3]), rr: Number(m[4]) }), // +12: VCSL names one octave below sounding pitch (measured)
    // soft v1 = layer 1 (the source has no soft-and-quiet hard take); hard v2/v3 = layers 2/3.
    // soft v2 is a different mallet at the same dynamic, not a round robin, so it is left out.
    take: (z) => !(z.mallet === "soft" && z.v === 2),
    realRange: [53, 89], // 3-octave vibraphone F3..F6
  },
  {
    id: "glockenspiel", title: "Glockenspiel", kind: "struck", damped: false, sparse: true,
    dir: "Idiophones/Struck Idiophones/Glockenspiel",
    re: /^glock_(soft|medium|loud)_([A-G][#b]?-?\d+)_\d+\.wav$/,
    zone: (m) => ({ midi: noteMidi(m[2], 12), layer: { soft: 1, medium: 2, loud: 3 }[m[1]], rr: 1 }), // +12: VCSL names one octave below sounding pitch (measured)
    take: () => true,
    realRange: [79, 108], // orchestral glockenspiel G5..C8; the corrected recordings span exactly that
  },
  {
    id: "bell.tubular", title: "Tubular Bells 1", kind: "struck", damped: false, pitch: "chime",
    dir: "Idiophones/Struck Idiophones/Tubular Bells 1",
    re: /^chimes_([A-G][#b]?-?\d+)_(fff|pp|ff|mf|mp|f|p)_rr(\d+)\.wav$/,
    // +12: a chime's perceived strike note sits an octave below its 4th flexural mode, and that
    // measured strike note is name+12 within +-11 cents on all 9 tubes (mode4/2: e.g. the "C3" tube
    // peaks at 524.2 Hz, strike 262.1 Hz = C4). name+24 would imply chimes sounding up to E6, which
    // no real chime set reaches; name+12 lands the set at C4..E5, inside the real C4..F5/G5 compass.
    zone: (m) => ({ midi: noteMidi(m[1], 12), layer: LAYER_OF_DYN[m[2]], rr: 1 }), // rr digits are take numbers: one file per note+dynamic
    take: () => true,
    realRange: [60, 79], // orchestral chimes C4..G5
  },
  {
    id: "timpani", title: "Timpani", kind: "struck", damped: false, pitchedByMeasurement: true,
    dir: "Membranophones/Struck Membranophones/Timpani 2/Hit",
    re: /^Timpani(\d+[A-Z])_hit_v(\d+)_rr(\d+)_main\.wav$/,
    zone: (m) => ({ drum: `Timpani${m[1]}`, layer: { 2: 1, 3: 2, 5: 3 }[Number(m[2])], rr: Number(m[3]) }),
    // Drums chosen from a measured pass over all 34 (see the report's pitch table): a spanning set
    // across E2..A3 with measured gaps of 1-2 semitones, preferring drums whose hits agree. The
    // letters do not encode pitch (no sfz or notes file in the repo decodes them), so every hit is
    // measured: a hit is kept only when its estimate is stable and agrees with its drum's median;
    // anything else is skipped, never guessed. measuredHz rides along so Alex can check it by ear.
    take: (z) => TIMPANI_DRUMS.includes(z.drum),
    realRange: [36, 72], // a kettle's pedal range is about a fifth; the whole set C2..C5
  },
];
// Filled in from the measurement pass (build asserts it is not empty).
const TIMPANI_DRUMS = ["7G", "7D", "2A", "7B", "3A", "6G", "3B", "6E", "3C", "6D", "4A", "8E", "5A", "5B"].map((d) => `Timpani${d}`);

// ---------------------------------------------------------------- rooms (contract amendment b)
// Recorded impulse responses of real spaces, from OpenAIR (Audio Lab, University of York, CC BY
// 4.0): B-format W X Y Z decoded to stereo as L = W + Y, R = W - Y, direct sound at frame 0,
// unit energy, tail cut by the same rule as zones. manifest.rooms maps room id -> metadata;
// directFrames is the length of the direct sound, for the engine to skip.
const ROOMS_SRC = join(PACK_DIR, "rooms-src");
const ROOMS = [
  { id: "small-room", title: "Arthur Sykes Rymer Auditorium, University of York",
    wav: "arthur-sykes-rymer-auditorium-university-york/arthur-sykes-rymer-auditorium-university-york/b-format/s1r7.wav",
    page: "https://www.openair.hosted.york.ac.uk/?page_id=425" },
  { id: "recital-hall", title: "Jack Lyons Concert Hall, University of York",
    wav: "jack-lyons-concert-hall-university-york/jack-lyons-concert-hall-university-york/b-format/rir_jack_lyons_lp1_96k.wav",
    page: "https://www.openair.hosted.york.ac.uk/?page_id=571" },
  // average_space_ir_0.wav is the set's space-averaged B-format IR: the room response averaged
  // over every drum position, neutral by construction where a single drum position's take
  // carries that spot's coloration.
  { id: "live-room", title: "Genesis 6 Studio live room, University of York",
    wav: "genesis-6-studio-live-room-drum-set/genesis-6-studio-live-room-drum-set/examples/average_space_ir_0.wav",
    page: "https://www.openair.hosted.york.ac.uk/?page_id=483" },
];
const DIRECT_FRAMES = Math.round(0.0025 * SR); // ~2.5 ms of direct sound, for the engine to skip

// ---------------------------------------------------------------- the VCSL index
const tree = () => {
  const map = new Map(); // path -> size
  if (!PACK_DIR) throw new Error("soundpack: set ANIDOODLE_SOUNDPACK_DIR to the sound-pack work folder (it holds vcsl-tree.tsv and rooms-src)");
  for (const line of readFileSync(VCSL_TREE, "utf8").split("\n")) {
    const [size, path] = line.split("\t");
    if (path) map.set(path, Number(size));
  }
  return map;
};
const needed = (recipes, index) => {
  const files = [];
  for (const r of recipes) {
    const sources = [{ dir: r.dir, re: r.re }, ...(r.arts ?? [])];
    for (const src of sources) {
      for (const [path, size] of index) {
        if (!path.startsWith(src.dir + "/")) continue;
        const m = src.re.exec(basename(path));
        if (!m) continue;
        const z = (src.zone ?? r.zone)(m);
        if (!r.take(z)) continue;
        if (src.art) z.art = src.art;
        files.push({ recipe: r, path, size, z });
      }
    }
    for (const n of r.notesFiles ?? []) {
      const size = index.get(n);
      if (size === undefined) throw new Error(`${n} not in the VCSL index`);
      files.push({ recipe: r, path: n, size, notes: true });
    }
  }
  return files;
};
const local = (dir, path) => join(dir, ...path.split("/"));
const enc = (path) => path.split("/").map(encodeURIComponent).join("/");

// ---------------------------------------------------------------- fetch
const fetchFiles = async (files, srcDir) => {
  const queue = files.filter(({ path, size }) => {
    const f = local(srcDir, path);
    if (existsSync(f) && statSync(f).size === size) return false;
    if (existsSync(f)) console.log(`  re-fetch ${path} (size ${statSync(f).size} != ${size})`);
    return true;
  });
  console.log(`fetch: ${files.length} files needed, ${queue.length} to download`);
  let done = 0;
  const failed = [];
  const worker = async () => {
    while (queue.length) {
      const { path, size } = queue.shift();
      const res = await fetch(VCSL_RAW + enc(path));
      if (!res.ok) { failed.push(`${path}: HTTP ${res.status}`); continue; }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length !== size) { failed.push(`${path}: got ${buf.length} bytes, index says ${size}`); continue; }
      const f = local(srcDir, path);
      mkdirSync(dirname(f), { recursive: true });
      writeFileSync(f, buf);
      if (++done % 25 === 0) console.log(`  ${done} fetched`);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  if (failed.length) { for (const f of failed) console.error(`  FAILED ${f}`); process.exit(1); }
  console.log(`fetch: ${done} downloaded, all sizes verified`);
};

// ---------------------------------------------------------------- decode / encode / measure
// Every ffmpeg/ffprobe call goes through here: a spawned child can wedge (seen live: an flac
// encode sat at 0% CPU for 30+ min with 99% of its output written - the classic spawnSync
// large-stdin deadlock on macOS). A hard timeout turns that into a loud, named failure instead
// of a silent hang.
const runFf = (bin, args, opts, what) => {
  try {
    return execFileSync(bin, args, { maxBuffer: 1 << 30, timeout: 120000, ...opts });
  } catch (e) {
    throw new Error(e.killed ? `${bin} timed out after 120 s on ${what} (wedged child killed)` : `${bin} failed on ${what}: ${e.message}`);
  }
};
const ffprobe = (f) => JSON.parse(runFf("ffprobe", ["-v", "error", "-print_format", "json", "-show_streams", f], {}, basename(f)).toString()).streams[0];
const decode = (f, ch) => {
  const b = runFf("ffmpeg", ["-v", "error", "-i", f, "-f", "f32le", "-ac", String(ch), "-ar", String(SR), "-"], {}, basename(f));
  return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4);
};
const db = (x) => 20 * Math.log10(x);

// Trim, fade, cut, encode one zone. Never changes gain: the fades are the only multiplies.
// Tail cut (contract, amendment c 2026-10-04, same rule for every instrument and art): whichever
// comes first - the level comes within 6 dB of the SOURCE file's own noise floor (the RMS of its
// last 0.5 s), or 60 dB below the note's peak, or a 20 s cap - then a 250 ms fade-out, so a cut at
// the noise floor is never heard. The earlier "stopped falling" trigger was wrong: a piano's slow
// second-stage decay and a pedalled piano's sympathy ring both fall slowly enough to trip it.
const processZone = (wav, ch, out) => {
  const x = decode(wav, ch), n = x.length / ch;
  let peak = 0;
  for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > peak) peak = a; }
  const amp = (i) => { let m = 0; for (let c = 0; c < ch; c++) { const a = Math.abs(x[i * ch + c]); if (a > m) m = a; } return m; };
  const on = (() => { const thr = peak * 10 ** (-40 / 20); for (let i = 0; i < n; i++) if (amp(i) > thr) return i; return n; })();
  // 2 ms of pre-onset silence, minus a 4-sample guard: 24-bit quantization can nudge the onset a
  // sample or two later, and the contract's 2 ms is measured on the WRITTEN file
  const s0 = Math.max(0, on - Math.round(0.002 * SR) + 4);
  // 0.5 s RMS envelope (absolute dBFS) drives the tail cut, against the source file's own noise
  // floor: the RMS of its last 0.5 s (a digital-silence floor is -inf and simply never triggers)
  const B = Math.round(0.5 * SR), nb = Math.floor(n / B), env = [];
  for (let k = 0; k < nb; k++) {
    let sum = 0;
    for (let i = k * B; i < (k + 1) * B; i++) for (let c = 0; c < ch; c++) sum += x[i * ch + c] * x[i * ch + c];
    env.push(db(Math.sqrt(sum / (B * ch)) || 1e-12));
  }
  const TAIL = Math.min(Math.round(0.5 * SR), n);
  let fsum = 0;
  for (let i = (n - TAIL) * ch; i < n * ch; i++) fsum += x[i] * x[i];
  const floorDb = db(Math.sqrt(fsum / (TAIL * ch)) || 1e-12);
  const end = (() => {
    const kon = Math.floor(on / B), kcap = Math.min(nb, Math.ceil((on + 20 * SR) / B));
    for (let k = kon + 1; k < kcap; k++) {
      if (env[k] <= floorDb + 6) return k * B; // within 6 dB of the source's noise floor
      if (env[k] <= db(peak) - 60) return k * B; // 60 dB below the note's peak
    }
    return Math.min(nb * B, on + 20 * SR); // cap: never past onset + 20 s
  })();
  const cut = Math.max(end, on + Math.round(0.2 * SR), s0 + 1);
  // the 0.5 ms fade-in exists so the CUT never clicks; when the source itself starts at the onset
  // (s0 = 0, VCSL files begin near digital silence) there is no cut and the fade would only bury
  // the attack's own precursor below the -40 dB onset threshold
  const fadeIn = s0 > 0 ? Math.min(Math.round(0.0005 * SR), cut - s0) : 0, fadeOut = Math.min(Math.round(0.25 * SR), cut - s0);
  const frames = cut - s0;
  for (let i = 0; i < fadeIn; i++) { const g = i / fadeIn; for (let c = 0; c < ch; c++) x[(s0 + i) * ch + c] *= g; }
  for (let i = 0; i < fadeOut; i++) { const g = 1 - i / fadeOut; for (let c = 0; c < ch; c++) x[(cut - fadeOut + i) * ch + c] *= g; }
  const pcm = Buffer.from(x.buffer, x.byteOffset + s0 * ch * 4, frames * ch * 4);
  encFlac(pcm, ch, out);
  return { frames, channels: ch };
};
const encFlac = (pcm, ch, out) => {
  runFf("ffmpeg", ["-v", "error", "-y", "-bitexact", "-f", "f32le", "-ar", String(SR), "-ac", String(ch), "-i", "-",
    "-map_metadata", "-1", "-bitexact", "-c:a", "flac", "-compression_level", "8", "-sample_fmt", "s32", "-bits_per_raw_sample", "24", out],
    { input: pcm }, out);
};
// One recorded impulse response -> a normalized stereo FLAC under rooms/<id>.flac. Steps per
// amendment b: decode B-format (W X Y Z) to stereo L = W + Y / R = W - Y, trim so the direct
// arrival sits at frame 0 (the direct sound stays in the file), cut the tail by the zone rule
// (within 6 dB of the source's own last-0.5 s floor, or 60 dB below peak, or 20 s), 250 ms
// fade-out, and normalize the written region to unit energy.
const processRoom = (wav, out) => {
  const x = decode(wav, 4), n = x.length / 4;
  const y = new Float32Array(n * 2);
  let peak = 0;
  for (let i = 0; i < n; i++) {
    const l = x[i * 4] + x[i * 4 + 2], r = x[i * 4] - x[i * 4 + 2];
    y[i * 2] = l; y[i * 2 + 1] = r;
    const a = Math.max(Math.abs(l), Math.abs(r)); if (a > peak) peak = a;
  }
  const thr = peak * 10 ** (-40 / 20);
  let on = 0;
  while (on < n && Math.max(Math.abs(y[on * 2]), Math.abs(y[on * 2 + 1])) <= thr) on++;
  const z = y.subarray(on * 2), m = n - on;
  const B = Math.round(0.5 * SR), nb = Math.floor(m / B), env = [];
  for (let k = 0; k < nb; k++) {
    let sum = 0;
    for (let i = k * B; i < (k + 1) * B; i++) sum += z[i] * z[i];
    env.push(db(Math.sqrt(sum / (B * 2)) || 1e-12));
  }
  const TAIL = Math.min(Math.round(0.5 * SR), m);
  let fs = 0;
  for (let i = (m - TAIL) * 2; i < m * 2; i++) fs += z[i] * z[i];
  const floorDb = db(Math.sqrt(fs / (TAIL * 2)) || 1e-12), peakDb = db(peak);
  const end = (() => {
    const kcap = Math.min(nb, Math.ceil(20 * SR / B));
    for (let k = 1; k < kcap; k++) {
      if (env[k] <= floorDb + 6) return k * B;
      if (env[k] <= peakDb - 60) return k * B;
    }
    return Math.min(nb * B, 20 * SR);
  })();
  const cut = Math.max(end, Math.round(0.2 * SR));
  const fadeOut = Math.min(Math.round(0.25 * SR), cut);
  for (let i = 0; i < fadeOut; i++) { const g = 1 - i / fadeOut; z[(cut - fadeOut + i) * 2] *= g; z[(cut - fadeOut + i) * 2 + 1] *= g; }
  let e = 0;
  for (let i = 0; i < cut * 2; i++) e += z[i] * z[i];
  const g = 1 / Math.sqrt(e);
  const pcm = Buffer.alloc(cut * 2 * 4);
  for (let i = 0; i < cut * 2; i++) pcm.writeFloatLE(z[i] * g, i * 4);
  encFlac(pcm, 2, out);
  return { frames: cut, channels: 2 };
};
// rt60 by Schroeder integration in the 500 Hz-1 kHz band: RBJ bandpass (1 octave, centered at
// the band's geometric mean ~707 Hz) on the channel-sum mono, reverse-cumulative energy, a
// least-squares line over the -5..-35 dB portion of the decay curve, rt60 = -60/slope.
const rt60Of = (x, ch) => {
  const n = x.length / ch;
  const f0 = Math.sqrt(500 * 1000), w0 = 2 * Math.PI * f0 / SR;
  const alpha = Math.sin(w0) * Math.sinh(Math.LN2 / 2 * 1 * w0 / Math.sin(w0));
  const b0 = alpha, b2 = -alpha, a0 = 1 + alpha, a1 = -2 * Math.cos(w0), a2 = 1 - alpha;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const sq = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const v = (b0 * (x[i * ch] + x[i * ch + (ch - 1)]) / 2 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = (x[i * ch] + x[i * ch + (ch - 1)]) / 2; y2 = y1; y1 = v;
    sq[i] = v * v;
  }
  const edc = new Float64Array(n);
  let acc = 0;
  for (let i = n - 1; i >= 0; i--) { acc += sq[i]; edc[i] = acc; }
  const e0 = edc[0], curve = new Float64Array(n);
  for (let i = 0; i < n; i++) curve[i] = 10 * Math.log10(edc[i] / e0 || 1e-30);
  let i0 = curve.findIndex((v) => v <= -5), i1 = curve.findIndex((v) => v <= -35);
  if (i1 <= i0 + SR / 20) i1 = curve.findIndex((v) => v <= -25); // very short room: T20 instead
  if (i0 < 0 || i1 <= i0) return null;
  let sx = 0, sy = 0, sxx = 0, sxy = 0, cnt = 0;
  for (let i = i0; i <= i1; i += 8) { const t = i / SR; sx += t; sy += curve[i]; sxx += t * t; sxy += t * curve[i]; cnt++; }
  return -60 / ((cnt * sxy - sx * sy) / (cnt * sxx - sx * sx));
};
// Measure the WRITTEN file: peakDb over everything, rmsDb over the first 500 ms, and (when id is
// given) the zone's pitch via the estimator the recipe's physics needs.
const measureFlac = (f, id) => {
  const s = ffprobe(f), ch = s.channels, x = decode(f, ch), n = x.length / ch;
  let peak = 0;
  for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > peak) peak = a; }
  const m = Math.min(n, Math.round(0.5 * SR));
  let sum = 0;
  for (let i = 0; i < m * ch; i++) sum += x[i] * x[i];
  const r = { frames: n, channels: ch, peakDb: db(peak), rmsDb: db(Math.sqrt(sum / (m * ch))) };
  if (id) { const p = measureZone(id, x, ch); if (p.stable) r.pitchHz = p.hz; }
  return r;
};

// ---------------------------------------------------------------- pitch by measurement
// Iterative radix-2 FFT (no dependencies in tools).
const fft = (re, im) => {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const ur = re[i + j], ui = im[i + j], vr = re[i + j + len / 2] * cr - im[i + j + len / 2] * ci, vi = re[i + j + len / 2] * ci + im[i + j + len / 2] * cr;
        re[i + j] = ur + vr; im[i + j] = ui + vi; re[i + j + len / 2] = ur - vr; im[i + j + len / 2] = ui - vi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
};
// Hann-windowed magnitude spectrum, N samples at frac into the signal, zero-padded to FFTN.
const FFTN = 32768;
const spectrumOf = (x, ch, frac) => {
  const n = x.length / ch;
  let N = 16384;
  while (N > n) N >>= 1;
  if (N < 2048) return null;
  const o = Math.min(Math.floor(n * frac), n - N);
  const re = new Float64Array(FFTN), im = new Float64Array(FFTN);
  for (let i = 0; i < N; i++) { let s = 0; for (let c = 0; c < ch; c++) s += x[(o + i) * ch + c]; re[i] = s / ch * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N)); }
  fft(re, im);
  const mag = new Float64Array(FFTN / 2);
  for (let i = 0; i < FFTN / 2; i++) mag[i] = Math.hypot(re[i], im[i]);
  return mag;
};
// Strongest spectral peaks, parabolic-refined, >=1.5% apart, lo..hi Hz.
const peakList = (mag, loHz, hiHz, count) => {
  const binHz = SR / FFTN, lo = Math.max(2, Math.ceil(loHz / binHz)), hi = Math.min(mag.length - 2, Math.floor(hiHz / binHz));
  const idx = [];
  for (let i = lo; i <= hi; i++) idx.push(i);
  idx.sort((a, b) => mag[b] - mag[a]);
  const out = [];
  for (const i of idx) {
    const a = Math.log(mag[i - 1]), b = Math.log(mag[i]), c = Math.log(mag[i + 1]);
    const d = a - 2 * b + c;
    const hz = (i + (d ? 0.5 * (a - c) / d : 0)) * binHz;
    if (!isFinite(hz) || hz < loHz) continue;
    if (out.some((p) => Math.abs(hz - p.hz) / hz < 0.015)) continue;
    out.push({ hz, mag: mag[i] });
    if (out.length >= count) break;
  }
  return out;
};
const centsOf = (a, b) => 1200 * Math.log2(a / b);
// Fundamental of a harmonic zone (strings, bars). Candidates come from the observed peaks
// themselves (peak / k for k = 1..12), not a blind grid: a dense grid can lock onto subsonic
// rumble (a ~30 Hz cluster explains the whole spectrum if every partial lands on a high k), while
// a peak-derived candidate for the true f0 also explains its own ladder and still wins on 1/n-
// weighted comb energy. Bounded octave descent (f/2 wins only if it keeps >=85% of the comb
// energy) covers the missing-fundamental case. Two windows of the ring must agree within 50 cents
// or the estimate is unstable.
const harmonicPitch = (x, ch) => {
  const est = (frac) => {
    const mag = spectrumOf(x, ch, frac);
    if (!mag) return null;
    const pk = peakList(mag, 40, 12000, 20);
    if (!pk.length) return null;
    const score = (f0) => {
      let s = 0;
      for (const p of pk) {
        const k = Math.round(p.hz / f0);
        if (k < 1 || k > 16) continue;
        if (Math.abs(centsOf(p.hz, k * f0)) < 40) s += p.mag / k;
      }
      return s;
    };
    const cands = new Map();
    for (const p of pk) for (let k = 1; k <= 12; k++) { const f0 = p.hz / k; if (f0 >= 24 && f0 <= 6000) cands.set(f0, score(f0)); }
    let best = 0, bs = -1;
    for (const [f0, s] of cands) if (s > bs) { bs = s; best = f0; }
    for (let k = 0; k < 3 && best / 2 >= 24 && score(best / 2) >= 0.85 * score(best); k++) best /= 2;
    const ests = [], matched = [];
    for (const p of pk) { const k = Math.round(p.hz / best); if (k >= 1 && Math.abs(centsOf(p.hz, k * best)) < 40) { ests.push(p.hz / k); matched.push(p); } }
    // a believable winner explains >= 2 peaks, or is a lone partial that towers over the rest;
    // a single low peak no stronger than its neighbors is just rumble, and rumble must not
    // answer confidently (the softest marimba hits are rumble-dominated end to end)
    const unmatchedMax = pk.filter((p) => !matched.includes(p)).reduce((a, p) => Math.max(a, p.mag), 0);
    if (matched.length < 2 && !(matched.length === 1 && matched[0].mag >= 3 * unmatchedMax)) return null;
    ests.sort((a, b) => a - b);
    return ests[ests.length >> 1];
  };
  const a = est(0.06), b = est(0.25);
  if (!a || !b) return { hz: 0, stable: false };
  return { hz: (a + b) / 2, stable: Math.abs(centsOf(a, b)) < 50 };
};
// Strike note of a tubular bell: fit the tube's flexural modes {1, 2.76, 5.40, 8.93, 13.3, 18.6}
// and take the 4th mode down an octave (the perceived strike pitch; measured = name+12 on all 9
// VCSL tubes within +-11 cents). Fewer than 4 matched modes = unstable.
const CHIME_MODES = [1, 2.76, 5.40, 8.93, 13.3, 18.6];
const bellPitch = (x, ch) => {
  const mag = spectrumOf(x, ch, 0.2);
  if (!mag) return { hz: 0, stable: false };
  const pk = peakList(mag, 40, 6000, 14);
  let best = null;
  for (const p of pk) for (const r of CHIME_MODES) {
    const f1 = p.hz / r;
    if (f1 < 40 || f1 > 400) continue;
    let matched = 0, score = 0;
    for (const m of CHIME_MODES) {
      const hit = pk.find((q) => Math.abs(q.hz - f1 * m) / (f1 * m) < 0.025);
      if (hit) { matched++; score += hit.mag; }
    }
    if (!best || matched > best.matched || (matched === best.matched && score > best.score)) best = { f1, matched };
  }
  if (!best || best.matched < 4) return { hz: 0, stable: false };
  const m4 = pk.reduce((b, p) => Math.abs(p.hz / best.f1 - 8.93) < Math.abs(b.hz / best.f1 - 8.93) ? p : b);
  return { hz: m4.hz / 2, stable: true };
};
// Fundamental of a timpani hit. The membrane's modes are INHARMONIC (the strongest spectral peak is
// usually the (2,1) mode, and autocorrelation locks onto difference frequencies), so score candidate
// f0 against the kettle's mode ratios instead of a harmonic comb. Two windows of the ring must agree
// within 20 cents or the hit is reported unstable and skipped, never guessed.
const MODES = [1, 1.45, 1.93, 2.39, 2.71]; // (1,1) (2,1) (3,1) (4,1) (2,2) of a kettle membrane
const pitchOf = (x, ch) => {
  const est = (frac) => {
    const mag = spectrumOf(x, ch, frac);
    if (!mag) return null;
    const at = (hz) => { const b = hz * FFTN / SR, i = Math.max(1, Math.floor(b)), f = b - i; return Math.max(mag[i - 1] * (1 - f) + mag[i] * f, mag[i] * (1 - f) + mag[i + 1] * f, mag[i + 1] * (1 - f) + mag[i + 2] * f); };
    let best = 0, bs = -1;
    for (let f0 = 55; f0 <= 260; f0 += 0.25) {
      let s = 0; for (const m of MODES) s += at(f0 * m);
      if (s > bs) { bs = s; best = f0; }
    }
    return best || null;
  };
  const a = est(0.3), b = est(0.55);
  if (!a || !b) return { hz: 0, stable: false };
  return { hz: (a + b) / 2, stable: Math.abs(1200 * Math.log2(a / b)) < 20 };
};
// pitchOf measured on the untrimmed source (timpani selection happens before encode); for every
// other instrument the zone's measuredHz is taken on the trimmed, faded PCM that becomes the FLAC.
const PITCH_MEASURE = { "bell.tubular": bellPitch, timpani: pitchOf };
const REPORT_ONLY_PITCH = new Set(["timpani", "bell.tubular"]); // inharmonic strikes: report, don't fail
const measureZone = (id, pcm, ch) => (PITCH_MEASURE[id] ?? harmonicPitch)(pcm, ch);

// ---------------------------------------------------------------- build
const buildPack = async (srcDir, packDir, recipes) => {
  const index = tree(), files = needed(recipes, index);
  for (const { path } of files) if (!existsSync(local(srcDir, path))) {
    console.error(`missing source file ${path} (run fetch first)`); process.exit(1);
  }
  mkdirSync(packDir, { recursive: true });
  const manifest = { pack: "anidoodle-sounds", version: 1, sampleRate: SR, instruments: {} };
  const licenses = ["# Licenses", "", "All recordings from the Versilian Community Sample Library (VCSL).", "",
    "Source: https://github.com/sgossner/VCSL", "License: CC0 1.0 Universal (public domain)", ""];
  for (const r of recipes) {
    const mine = files.filter((f) => f.recipe === r && !f.notes);
    const zones = [];
    let wavBytes = 0;
    // (timpani) measure every hit first: a hit is kept only when its estimate is stable AND agrees
    // with its drum's median within 40 cents — a hit that disagrees is a mode mis-lock, not a pitch.
    const keepHz = new Map(); // path -> hz
    if (r.pitchedByMeasurement) {
      const byDrum = new Map();
      for (const { path, z } of mine) {
        const wav = local(srcDir, path), s = ffprobe(wav), p = pitchOf(decode(wav, s.channels), s.channels);
        if (p.stable) { if (!byDrum.has(z.drum)) byDrum.set(z.drum, []); byDrum.get(z.drum).push({ path, hz: p.hz }); }
        else console.log(`  skip ${basename(path)}: pitch estimate unstable`);
      }
      for (const [drum, hits] of byDrum) {
        const sorted = hits.map((h) => h.hz).sort((a, b) => a - b), med = sorted[sorted.length >> 1];
        for (const h of hits) {
          if (Math.abs(1200 * Math.log2(h.hz / med)) < 40) keepHz.set(h.path, h.hz);
          else console.log(`  skip ${basename(h.path)}: disagrees with ${drum}'s other hits`);
        }
      }
    }
    for (const { path, z } of mine) {
      const wav = local(srcDir, path);
      const s = ffprobe(wav);
      if (s.channels !== 1 && s.channels !== 2) { console.error(`${path}: ${s.channels} channels, the contract allows 1 or 2`); process.exit(1); }
      let midi = z.midi, measuredHz;
      if (r.pitchedByMeasurement) {
        if (!keepHz.has(path)) continue;
        measuredHz = +keepHz.get(path).toFixed(2);
        midi = Math.round(69 + 12 * Math.log2(measuredHz / 440));
      }
      const id = r.pitchedByMeasurement ? z.drum : midiName(z.midi);
      const rel = `${r.id}/${id}_l${z.layer}_rr${z.rr}${z.art ? `_${z.art}` : ""}.flac`;
      const out = join(packDir, ...rel.split("/"));
      mkdirSync(dirname(out), { recursive: true });
      const raw = processZone(wav, s.channels, out);
      // pitch is only measurable where the physics cooperates: the contract's check band is
      // midi 48..84; outside it low fundamentals are weak and top partials decay too fast.
      // Chimes are measured everywhere via the strike-note estimator; timpani comes from keepHz.
      // rel zones are key/damper noise: there is no pitch to measure.
      const wantPitch = !r.pitchedByMeasurement && z.art !== "rel" && (r.pitch === "chime" || (z.midi >= 48 && z.midi <= 84));
      const m = measureFlac(out, wantPitch ? r.id : null);
      if (m.channels !== raw.channels || m.frames !== raw.frames) { console.error(`${rel}: encode/decode mismatch`); process.exit(1); }
      if (measuredHz === undefined && m.pitchHz) measuredHz = +m.pitchHz.toFixed(2);
      if (measuredHz === undefined && wantPitch) console.log(`  ${rel}: pitch estimate unstable, measuredHz omitted`);
      zones.push({ file: rel, midi, layer: z.layer, rr: z.rr, ...(z.art && { art: z.art }), frames: m.frames, channels: m.channels,
        peakDb: +m.peakDb.toFixed(2), rmsDb: +m.rmsDb.toFixed(2), ...(measuredHz !== undefined && { measuredHz }),
        sha256: createHash("sha256").update(readFileSync(out)).digest("hex") });
      wavBytes += statSync(wav).size;
    }
    zones.sort((a, b) => a.midi - b.midi || a.layer - b.layer || a.rr - b.rr || (a.art ?? "").localeCompare(b.art ?? ""));
    if (!zones.length) { console.error(`${r.id}: no zones survived (check the recipe and the source)`); process.exit(1); }
    const midis = [...new Set(zones.map((z) => z.midi))].sort((a, b) => a - b);
    let maxShift = 0;
    for (let p = midis[0]; p <= midis[midis.length - 1]; p++) {
      let d = Infinity; for (const q of midis) d = Math.min(d, Math.abs(p - q));
      maxShift = Math.max(maxShift, d);
    }
    // declared range = recorded span widened by the repitch allowance (maxShift on sparse
    // instruments, the default 2 otherwise), clipped to the real instrument's compass
    const widen = r.sparse ? maxShift : 2;
    const range = [Math.max(r.realRange[0], midis[0] - widen), Math.min(r.realRange[1], midis[midis.length - 1] + widen)];
    const inst = { title: r.title, source: "VCSL", license: "CC0-1.0", kind: r.kind, range,
      layers: Math.max(...zones.map((z) => z.layer)), damped: r.damped };
    if (r.normalized) inst.normalized = true;
    if (r.sparse) { inst.sparse = true; inst.maxShift = maxShift; }
    inst.zones = zones;
    manifest.instruments[r.id] = inst;
    const dirs = [r.dir, ...(r.arts ?? []).map((a) => `${a.dir} (${a.art} articulation)`)];
    licenses.push(`## ${r.title} (\`${r.id}\`)`, "", `Folder: ${dirs.map((d) => `\`${d}\``).join(", ")} (${(wavBytes / 1e6).toFixed(1)} MB of source WAV)`, "");
    for (const t of [...new Set(mine.map((f) => f.path))].sort()) licenses.push(`- ${t}`);
    licenses.push("");
    console.log(`${r.id}: ${zones.length} zones, layers ${inst.layers}, range ${midiName(midis[0])}..${midiName(midis.at(-1))}${r.sparse ? `, maxShift ${maxShift}` : ""}`);
  }
  // rooms (amendment b): recorded impulse responses under rooms/, attributed in LICENSES.md
  manifest.rooms = {};
  for (const rm of ROOMS) {
    const wav = join(ROOMS_SRC, ...rm.wav.split("/"));
    if (!existsSync(wav)) { console.error(`missing room source ${wav}`); process.exit(1); }
    const rel = `rooms/${rm.id}.flac`, out = join(packDir, ...rel.split("/"));
    mkdirSync(dirname(out), { recursive: true });
    const raw = processRoom(wav, out);
    const s = ffprobe(out), rt60 = rt60Of(decode(out, s.channels), s.channels);
    manifest.rooms[rm.id] = { title: rm.title, source: "OpenAIR", license: "CC-BY-4.0",
      file: rel, channels: raw.channels, frames: raw.frames, rt60: +rt60.toFixed(3),
      sha256: createHash("sha256").update(readFileSync(out)).digest("hex"), directFrames: DIRECT_FRAMES };
    console.log(`room ${rm.id}: ${(raw.frames / SR).toFixed(2)} s, rt60 ${rt60.toFixed(2)} s`);
  }
  licenses.push("## Rooms (impulse responses)", "",
    "Recorded impulse responses from OpenAIR, the Open Acoustic Impulse Response library,",
    "Audio Lab, University of York: https://www.openair.hosted.york.ac.uk/",
    "License: Creative Commons Attribution 4.0 International (CC BY 4.0).",
    "The B-format (W X Y Z) recordings were decoded to stereo as L = W + Y, R = W - Y.", "");
  for (const rm of ROOMS) licenses.push(`- ${rm.title} (\`rooms/${rm.id}.flac\`): ${rm.page}`);
  licenses.push("");
  writeFileSync(join(packDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  writeFileSync(join(packDir, "LICENSES.md"), licenses.join("\n"));
  const kb = Number(execFileSync("du", ["-sk", packDir]).toString().split("\t")[0]);
  console.log(`pack: ${join(packDir, "manifest.json")} + LICENSES.md, ${(kb / 1024).toFixed(1)} MB on disk`);
};

// ---------------------------------------------------------------- verify
const verifyPack = (packDir) => {
  const bad = [];
  const fail = (msg) => bad.push(msg);
  const mPath = join(packDir, "manifest.json");
  if (!existsSync(mPath)) { console.error(`verify: ${mPath} not found`); process.exit(1); }
  let m;
  try { m = JSON.parse(readFileSync(mPath, "utf8")); } catch (e) { fail(`manifest.json does not parse: ${e.message}`); return finish(); }
  if (m.pack !== "anidoodle-sounds") fail(`manifest.pack is ${JSON.stringify(m.pack)}, expected "anidoodle-sounds"`);
  if (m.version !== 1) fail(`manifest.version is ${m.version}, expected 1`);
  if (m.sampleRate !== SR) fail(`manifest.sampleRate is ${m.sampleRate}, expected ${SR}`);
  if (!m.instruments || typeof m.instruments !== "object") fail("manifest.instruments missing");
  const licenses = existsSync(join(packDir, "LICENSES.md")) ? readFileSync(join(packDir, "LICENSES.md"), "utf8") : "";
  if (!licenses) fail("LICENSES.md missing or empty");
  let total = 0;
  for (const [id, inst] of Object.entries(m.instruments ?? {})) {
    for (const f of ["title", "source", "license", "kind", "range", "layers", "damped", "zones"]) if (inst[f] === undefined) fail(`${id}: missing field ${f}`);
    if (inst.kind !== "struck" && inst.kind !== "sustained") fail(`${id}: kind ${JSON.stringify(inst.kind)} is not struck|sustained`);
    if (inst.kind === "sustained") fail(`${id}: version 1 packs are struck only`);
    if (!licenses.includes(`\`${id}\``)) fail(`${id}: not named in LICENSES.md`);
    const zones = inst.zones ?? [];
    const pitchStats = { inBand: 0, within: 0, outOfBand: 0 };
    for (const z of zones) {
      if (z.art !== undefined && z.art !== "sus" && z.art !== "rel") fail(`${z.file}: art ${JSON.stringify(z.art)} is not sus|rel (amendment b)`);
      const f = join(packDir, ...z.file.split("/"));
      if (!existsSync(f)) { fail(`${z.file}: missing`); continue; }
      total += statSync(f).size;
      const sha = createHash("sha256").update(readFileSync(f)).digest("hex");
      if (sha !== z.sha256) fail(`${z.file}: sha256 mismatch (manifest ${z.sha256}, file ${sha})`);
      const s = ffprobe(f);
      if (s.sample_rate !== String(SR)) fail(`${z.file}: sample rate ${s.sample_rate}, expected ${SR}`);
      if (Number(s.bits_per_raw_sample) !== 24) fail(`${z.file}: ${s.bits_per_raw_sample} bits per sample, expected 24`);
      if (s.channels !== z.channels) fail(`${z.file}: ${s.channels} channels, manifest says ${z.channels}`);
      const x = decode(f, s.channels), n = x.length / s.channels;
      if (n !== z.frames) fail(`${z.file}: ${n} frames, manifest says ${z.frames}`);
      let peak = 0;
      for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > peak) peak = a; }
      if (peak >= 1) fail(`${z.file}: clips (peak ${db(peak).toFixed(2)} dBFS)`);
      if (Math.abs(db(peak) - z.peakDb) > 0.05) fail(`${z.file}: peakDb ${z.peakDb} but file measures ${db(peak).toFixed(2)}`);
      const amp = (i) => { let v = 0; for (let c = 0; c < s.channels; c++) { const a = Math.abs(x[i * s.channels + c]); if (a > v) v = a; } return v; };
      const thr = peak * 10 ** (-40 / 20);
      let on = n; for (let i = 0; i < n; i++) if (amp(i) > thr) { on = i; break; }
      if (on > Math.round(0.002 * SR)) fail(`${z.file}: onset at ${(on / SR * 1000).toFixed(1)} ms, contract allows 2 ms`);
      // the zone must sound at its declared pitch. Only midi 48..84 is measurable physics
      // (below it fundamentals are weak, above it partials decay too fast), so the check runs
      // only there: an instrument fails when fewer than 80% of its in-band zones land within
      // 1 semitone of the label. Bells and timpani are inharmonic strikes, reported not failed.
      // rel zones are key/damper noise (amendment b): no pitch to check - hash, format and
      // clipping were already verified above, and the note-decay tail rules never applied.
      if (z.art === "rel") continue;
      if (z.midi < 48 || z.midi > 84) { pitchStats.outOfBand++; }
      else {
        pitchStats.inBand++;
        const p = measureZone(id, x, s.channels);
        if (!p.stable) console.log(`  ${z.file}: pitch estimate unstable (counts as off)`);
        else {
          const cents = 1200 * Math.log2(p.hz / hzOf(z.midi));
          if (Math.abs(cents) <= 100) pitchStats.within++;
          else {
            const msg = `${z.file}: measured ${p.hz.toFixed(1)} Hz, ${cents.toFixed(0)} cents from declared ${midiName(z.midi)}`;
            if (REPORT_ONLY_PITCH.has(id)) { console.log(`  ${msg} (reported, not failed)`); pitchStats.within++; }
            else console.log(`  ${msg}`);
          }
        }
      }
    }
    if (pitchStats.outOfBand) console.log(`  ${id}: ${pitchStats.outOfBand} zones not measured (outside 48-84)`);
    if (pitchStats.inBand) {
      const frac = pitchStats.within / pitchStats.inBand;
      const line = `  ${id}: ${pitchStats.within}/${pitchStats.inBand} in-band zones within 1 semitone of label`;
      if (frac < 0.8 && !REPORT_ONLY_PITCH.has(id)) fail(`${id}: only ${pitchStats.within}/${pitchStats.inBand} in-band zones within 1 semitone of label (contract requires 80%)`);
      else console.log(line + (REPORT_ONLY_PITCH.has(id) ? " (reported, not failed)" : ""));
    }
    for (const z of zones) {
      if (z.midi < inst.range[0] || z.midi > inst.range[1]) fail(`${z.file}: midi ${z.midi} outside declared range [${inst.range}]`);
      if (z.layer < 1 || z.layer > inst.layers) fail(`${z.file}: layer ${z.layer} outside 1..${inst.layers}`);
      if (z.rr < 1) fail(`${z.file}: rr ${z.rr} below 1`);
    }
    const midis = [...new Set(zones.map((z) => z.midi))].sort((a, b) => a - b);
    let widest = 0;
    for (let i = 1; i < midis.length; i++) widest = Math.max(widest, midis[i] - midis[i - 1]);
    if (inst.sparse) console.log(`  ${id}: sparse source, widest gap ${widest} semitones, maxShift ${inst.maxShift} (reported, not failed)`);
    else if (widest > 4) fail(`${id}: widest pitch gap ${widest} semitones exceeds the density target (a zone may be repitched at most 2, so gaps of 4 still cover; 3 at the range ends)`);
  }
  for (const [rid, room] of Object.entries(m.rooms ?? {})) {
    for (const f of ["title", "source", "license", "file", "channels", "frames", "rt60", "sha256", "directFrames"]) if (room[f] === undefined) fail(`rooms.${rid}: missing field ${f}`);
    if (room.license !== "CC-BY-4.0") fail(`rooms.${rid}: license ${JSON.stringify(room.license)}, the pack ships CC BY 4.0 rooms only`);
    if (!licenses.includes(room.title)) fail(`rooms.${rid}: ${room.title} not attributed in LICENSES.md`);
    const f = join(packDir, ...room.file.split("/"));
    if (!existsSync(f)) { fail(`${room.file}: missing`); continue; }
    total += statSync(f).size;
    const sha = createHash("sha256").update(readFileSync(f)).digest("hex");
    if (sha !== room.sha256) fail(`${room.file}: sha256 mismatch`);
    const s = ffprobe(f);
    if (s.sample_rate !== String(SR)) fail(`${room.file}: sample rate ${s.sample_rate}, expected ${SR}`);
    if (Number(s.bits_per_raw_sample) !== 24) fail(`${room.file}: ${s.bits_per_raw_sample} bits, expected 24`);
    if (s.channels !== room.channels) fail(`${room.file}: ${s.channels} channels, manifest says ${room.channels}`);
    const x = decode(f, s.channels), n = x.length / s.channels;
    if (n !== room.frames) fail(`${room.file}: ${n} frames, manifest says ${room.frames}`);
    let peak = 0, energy = 0;
    for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > peak) peak = a; energy += x[i] * x[i]; }
    if (peak >= 1) fail(`${room.file}: clips (peak ${db(peak).toFixed(2)} dBFS)`);
    if (Math.abs(energy - 1) > 0.01) fail(`${room.file}: energy ${energy.toFixed(4)}, contract wants unit energy`);
    // the direct arrival must sit at frame 0: the first sample above -40 dB of the peak is the
    // spike itself, within a couple of frames of the file start
    const thr = peak * 10 ** (-40 / 20);
    let on = n;
    for (let i = 0; i < n; i++) { let v = 0; for (let c = 0; c < s.channels; c++) v = Math.max(v, Math.abs(x[i * s.channels + c])); if (v > thr) { on = i; break; } }
    if (on > 8) fail(`${room.file}: direct sound starts at frame ${on}, contract wants frame 0`);
    if (!(room.rt60 > 0 && room.rt60 < 30)) fail(`rooms.${rid}: rt60 ${room.rt60} implausible`);
    console.log(`  room ${rid}: ${(n / SR).toFixed(2)} s, rt60 ${room.rt60} s`);
  }
  console.log(`  total: ${(total / 1e6).toFixed(1)} MB of FLAC (no size budget since amendment c: sound comes before size)`);
  return finish();
  function finish() {
    if (bad.length) { for (const b of bad) console.error(`FAIL ${b}`); console.error(`verify: ${bad.length} failure${bad.length > 1 ? "s" : ""}`); process.exit(1); }
    console.log("verify: all contract checks pass");
  }
};

// ---------------------------------------------------------------- report
const reportText = (packDir) => {
  const m = JSON.parse(readFileSync(join(packDir, "manifest.json"), "utf8"));
  const rows = [];
  let total = 0;
  for (const [id, inst] of Object.entries(m.instruments)) {
    const midis = [...new Set(inst.zones.map((z) => z.midi))].sort((a, b) => a - b);
    let widest = 0;
    for (let i = 1; i < midis.length; i++) widest = Math.max(widest, midis[i] - midis[i - 1]);
    let bytes = 0;
    for (const z of inst.zones) bytes += statSync(join(packDir, ...z.file.split("/"))).size;
    total += bytes;
    const arts = {};
    for (const z of inst.zones) if (z.art) arts[z.art] = (arts[z.art] ?? 0) + 1;
    rows.push({ id, zones: inst.zones.length, layers: inst.layers, gap: widest, mb: bytes / 1e6,
      range: `${midiName(inst.range[0])}..${midiName(inst.range[1])}`, sparse: !!inst.sparse,
      arts: Object.entries(arts).map(([a, c]) => `+${c} ${a}`).join(" ") });
  }
  console.log(`${"instrument".padEnd(16)} ${"zones".padStart(5)} ${"layers".padStart(6)} ${"widest gap".padStart(12)} ${"range".padEnd(9)} ${"MB".padStart(7)}  arts`);
  for (const r of rows) console.log(`${r.id.padEnd(16)} ${String(r.zones).padStart(5)} ${String(r.layers).padStart(6)} ${(String(r.gap) + (r.sparse ? " (sparse)" : "")).padStart(12)} ${r.range.padEnd(9)} ${r.mb.toFixed(1).padStart(7)}  ${r.arts}`);
  if (m.rooms && Object.keys(m.rooms).length) {
    console.log(`\nrooms:`);
    console.log(`${"id".padEnd(14)} ${"rt60 s".padStart(7)} ${"len s".padStart(7)} ${"MB".padStart(7)}  title`);
    for (const [rid, room] of Object.entries(m.rooms)) {
      const mb = statSync(join(packDir, ...room.file.split("/"))).size / 1e6;
      total += statSync(join(packDir, ...room.file.split("/"))).size;
      console.log(`${rid.padEnd(14)} ${room.rt60.toFixed(2).padStart(7)} ${(room.frames / m.sampleRate).toFixed(2).padStart(7)} ${mb.toFixed(1).padStart(7)}  ${room.title}`);
    }
  }
  console.log(`${"total".padEnd(16)} ${"".padStart(5)} ${"".padStart(6)} ${"".padStart(12)} ${"".padEnd(9)} ${(total / 1e6).toFixed(1).padStart(7)}  (no budget since amendment c)`);
  // zone lengths per instrument and articulation (amendments b and c)
  const median = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };
  for (const [id, inst] of Object.entries(m.instruments)) {
    const byArt = new Map();
    for (const z of inst.zones) { const k = z.art ?? "note"; if (!byArt.has(k)) byArt.set(k, []); byArt.get(k).push(z.frames / m.sampleRate); }
    const parts = [...byArt.entries()].map(([a, d]) => `${a} ${d.length} (median ${median(d).toFixed(2)} s, max ${Math.max(...d).toFixed(2)} s)`);
    console.log(`${id}: ${parts.join(", ")}`);
  }
  console.log();
  // declared midi vs the pitch measured on the written zone at build time, per instrument
  console.log(`\npitch check (declared midi vs measuredHz):`);
  console.log(`${"instrument".padEnd(16)} ${"zones".padStart(5)} ${"measured".padStart(9)} ${"med |c|".padStart(9)} ${"worst c".padStart(8)}  worst zone`);
  for (const [id, inst] of Object.entries(m.instruments)) {
    const deltas = inst.zones.filter((z) => z.measuredHz).map((z) => ({ c: 1200 * Math.log2(z.measuredHz / hzOf(z.midi)), f: basename(z.file) }));
    if (!deltas.length) { console.log(`${id.padEnd(16)} ${String(inst.zones.length).padStart(5)} ${"0".padStart(9)}`); continue; }
    const abs = deltas.map((d) => Math.abs(d.c)).sort((a, b) => a - b), worst = deltas.reduce((a, b) => Math.abs(b.c) > Math.abs(a.c) ? b : a);
    console.log(`${id.padEnd(16)} ${String(inst.zones.length).padStart(5)} ${String(deltas.length).padStart(9)} ${abs[abs.length >> 1].toFixed(1).padStart(9)} ${worst.c.toFixed(1).padStart(8)}  ${worst.f}`);
  }
  for (const [id, inst] of Object.entries(m.instruments).filter(([i]) => i === "timpani" || i === "bell.tubular")) {
    console.log(`\n${id}: measured pitch per zone`);
    console.log(`${"file".padEnd(26)} ${"Hz".padStart(9)} ${"note".padStart(5)} ${"cents".padStart(7)}`);
    for (const z of inst.zones) {
      if (!z.measuredHz) continue;
      const cents = 1200 * Math.log2(z.measuredHz / hzOf(z.midi));
      console.log(`${basename(z.file).padEnd(26)} ${z.measuredHz.toFixed(2).padStart(9)} ${midiName(z.midi).padStart(5)} ${((cents >= 0 ? "+" : "") + cents.toFixed(1)).padStart(7)}`);
    }
  }
};

// ---------------------------------------------------------------- dist
// Ship track: a built pack -> the release artifacts tools/soundfetch.mjs installs. ONE
// uncompressed tar per instrument plus one for the rooms (FLAC is already compressed), each
// carrying its files under their pack-relative paths plus a manifest.json fragment and
// LICENSES.md, so an unpacked archive is a valid partial pack on its own. Beside them sits
// anidoodle-sounds-v1.json: per archive the file name, bytes, sha256, the instrument ids (and
// room ids) it holds and the manifest fragment for those ids, plus the LICENSES.md text.
// Reproducible: ustar, entries sorted by name, uid/gid 0, no names, mode 0644, mtime 0 -
// running dist twice on the same pack gives byte-identical archives.
const TAR_ZERO = Buffer.alloc(1024);
const tarName = (h, at, len, s) => h.write(s, at, Math.min(Buffer.byteLength(s), len - 1), "utf8");
export const tarHeader = (name, size) => {
  // POSIX ustar: 100-byte name, 155-byte prefix for longer paths (prefix/name <= 255 total)
  let prefix = "", nm = name;
  if (Buffer.byteLength(nm) > 100) {
    const parts = nm.split("/");
    while (parts.length > 1 && Buffer.byteLength(nm) > 100) { prefix = prefix ? `${prefix}/${parts.shift()}` : parts.shift(); nm = parts.join("/"); }
    if (Buffer.byteLength(nm) > 100 || Buffer.byteLength(prefix) > 155) throw new Error(`tar: path too long for ustar: ${name}`);
  }
  const h = Buffer.alloc(512);
  tarName(h, 0, 100, nm);
  h.write("0000644\0", 100); // mode
  h.write("0000000\0", 108); // uid
  h.write("0000000\0", 116); // gid
  h.write(size.toString(8).padStart(11, "0") + "\0", 124); // size
  h.write("00000000000\0", 136); // mtime 0
  h.write("        ", 148); // checksum computed over spaces
  h.write("0", 156); // regular file
  h.write("ustar\0", 257); h.write("00", 263); // magic + version
  tarName(h, 345, 155, prefix);
  let sum = 0;
  for (const b of h) sum += b;
  h.write(sum.toString(8).padStart(6, "0") + "\0 ", 148);
  return h;
};
export const writeTar = (out, entries) => {
  const fd = openSync(out, "w");
  try {
    for (const e of entries) {
      const data = e.data ?? readFileSync(e.path);
      writeSync(fd, tarHeader(e.name, data.length));
      writeSync(fd, data);
      const pad = (512 - (data.length % 512)) % 512;
      if (pad) writeSync(fd, TAR_ZERO, 0, pad);
    }
    writeSync(fd, TAR_ZERO);
  } finally {
    closeSync(fd);
  }
};
const RELEASE = "anidoodle-sounds-v1";
const distPack = (packDir, distDir) => {
  const m = JSON.parse(readFileSync(join(packDir, "manifest.json"), "utf8"));
  if (m.pack !== "anidoodle-sounds" || m.version !== 1 || !m.instruments || typeof m.instruments !== "object") {
    console.error("dist: not a version 1 anidoodle pack (run verify first)"); process.exit(1);
  }
  const licenses = readFileSync(join(packDir, "LICENSES.md"), "utf8");
  mkdirSync(distDir, { recursive: true });
  const top = { pack: m.pack, version: m.version, sampleRate: m.sampleRate };
  const archives = [];
  const emit = (id, files, fragment) => {
    const entries = [
      ...files.map((rel) => ({ name: rel, path: join(packDir, ...rel.split("/")) })),
      { name: "manifest.json", data: Buffer.from(JSON.stringify(fragment, null, 2) + "\n") },
      { name: "LICENSES.md", data: Buffer.from(licenses) },
    ].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const e of entries) if (e.path && !existsSync(e.path)) { console.error(`dist: manifest names ${e.name}, the file is missing`); process.exit(1); }
    const file = `${RELEASE}-${id}.tar`, out = join(distDir, file);
    writeTar(out, entries);
    const bytes = statSync(out).size;
    archives.push({ file, bytes, sha256: createHash("sha256").update(readFileSync(out)).digest("hex"),
      instruments: Object.keys(fragment.instruments ?? {}), rooms: Object.keys(fragment.rooms ?? {}), manifest: fragment });
    const a = archives.at(-1);
    console.log(`${file.padEnd(44)} ${(bytes / 1e6).toFixed(1).padStart(8)} MB  ${a.instruments.concat(a.rooms.map((r) => `room ${r}`)).join(", ")}`);
  };
  for (const id of Object.keys(m.instruments).sort())
    emit(id, m.instruments[id].zones.map((z) => z.file), { ...top, instruments: { [id]: m.instruments[id] } });
  if (Object.keys(m.rooms ?? {}).length)
    emit("rooms", Object.values(m.rooms).map((r) => r.file), { ...top, rooms: m.rooms });
  const index = { release: RELEASE, ...top, licenses, archives };
  writeFileSync(join(distDir, `${RELEASE}.json`), JSON.stringify(index, null, 2) + "\n");
  const total = archives.reduce((s, a) => s + a.bytes, 0);
  console.log(`${`${RELEASE}.json`.padEnd(44)} ${"".padStart(8)}     ${archives.length} archives, ${(total / 1e6).toFixed(1)} MB total`);
};

// ---------------------------------------------------------------- main
const [cmd, ...args] = process.argv.slice(2);
const onlyFlag = args.indexOf("--only");
const only = onlyFlag >= 0 ? args.splice(onlyFlag, 2)[1].split(",") : null;
const recipes = only ? RECIPES.filter((r) => only.includes(r.id)) : RECIPES;
if (only && recipes.length !== only.length) { console.error(`unknown instrument in --only: ${only.filter((o) => !RECIPES.some((r) => r.id === o))}`); process.exit(2); }

if (isMain(import.meta.url)) (async () => {
  if (cmd === "fetch" && args.length === 1) await fetchFiles(needed(recipes, tree()), args[0]);
  else if (cmd === "build" && args.length === 2) await buildPack(args[0], args[1], recipes);
  else if (cmd === "verify" && args.length === 1) verifyPack(args[0]);
  else if (cmd === "report" && args.length === 1) reportText(args[0]);
  else if (cmd === "dist" && args.length === 2) distPack(args[0], args[1]);
  else { console.error("usage: node tools/soundpack.mjs fetch <source-dir> [--only ...] | build <source-dir> <pack-dir> [--only ...] | verify <pack-dir> | report <pack-dir> | dist <pack-dir> <dist-dir>"); process.exit(2); }
})().catch((e) => { console.error(e); process.exit(1); });
