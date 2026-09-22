// node tools/deadair.mjs <film|path.mp4> [--win 15] [--min 0.5] [--exempt a:b]
// GATE G-AIR. Decodes the rendered MP4 and measures, per frame, the fraction of pixels that
// changed since the previous frame. Two identical frames anywhere, or any window of `win`
// frames whose changed area never reaches `min` percent, is dead air and fails.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const a0 = process.argv[2];
if (!a0) { console.error("usage: node tools/deadair.mjs <film|path.mp4> [--win 15] [--min 0.5] [--exempt 525:540]"); process.exit(2); }
const file = resolve(a0.endsWith(".mp4") ? a0 : `out/${a0}.mp4`);
if (!existsSync(file)) { console.error(`no such file: ${file}`); process.exit(2); }
const WIN = Number(arg("win", 15)), MIN = Number(arg("min", 0.5)) / 100, THRESH = Number(arg("thresh", 4)), SIZE = Number(arg("size", 270));
const exempt = (arg("exempt", "") || "").split(",").filter(Boolean).map((s) => s.split(":").map(Number));

// decode small: 135x135 grey is plenty to see whether anything moved, and it keeps this honest
const W = SIZE, H = SIZE, px = W * H;
const out = spawnSync("ffmpeg", ["-v", "error", "-i", file, "-vf", `scale=${W}:${H}`, "-pix_fmt", "gray", "-f", "rawvideo", "-"], { maxBuffer: 1 << 30 });
if (out.status) { console.error(out.stderr.toString()); process.exit(2); }
const buf = out.stdout, n = Math.floor(buf.length / px);
const probe = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=nb_frames,duration", "-of", "csv=p=0", file]).toString().trim();
console.log(`${file}\n  ${n} frames decoded at ${W}x${H} grey, threshold ${THRESH}/255 (${probe})`);

const changed = [0];
for (let f = 1; f < n; f++) {
  const a = buf.subarray((f - 1) * px, f * px), b = buf.subarray(f * px, (f + 1) * px);
  let c = 0; for (let i = 0; i < px; i++) if (Math.abs(a[i] - b[i]) > THRESH) c++;
  changed.push(c / px);
}
const inExempt = (f) => exempt.some(([a, b]) => f >= a && f < b);
const still = [], windows = [];
for (let f = 1; f < n; f++) if (changed[f] === 0 && !inExempt(f)) still.push(f);
for (let f = 1; f + WIN <= n; f++) { let m = 0; for (let k = f; k < f + WIN; k++) m = Math.max(m, changed[k]); if (m < MIN && !inExempt(f)) windows.push([f, f + WIN, m]); }
const merged = []; windows.forEach(([a, b, m]) => { const last = merged[merged.length - 1]; if (last && a <= last[1]) { last[1] = Math.max(last[1], b); last[2] = Math.max(last[2], m); } else merged.push([a, b, m]); });

const stat = (xs) => { const s = [...xs].sort((x, y) => x - y); return { med: s[s.length >> 1], min: s[0], max: s[s.length - 1] }; };
const st = stat(changed.slice(1));
console.log(`  changed area per frame: median ${(st.med * 100).toFixed(2)}%  min ${(st.min * 100).toFixed(2)}%  max ${(st.max * 100).toFixed(2)}%`);
if (still.length) console.log(`  FAIL: ${still.length} frame(s) identical to the one before: ${still.slice(0, 12).join(", ")}${still.length > 12 ? " ..." : ""}`);
if (merged.length) merged.forEach(([a, b, m]) => console.log(`  FAIL: frames ${a}-${b} never exceed ${(m * 100).toFixed(2)}% changed area (floor ${(MIN * 100).toFixed(1)}%)`));
const ok = !still.length && !merged.length;
console.log(ok ? "  G-AIR: PASS" : "  G-AIR: FAIL");
process.exit(ok ? 0 : 1);
