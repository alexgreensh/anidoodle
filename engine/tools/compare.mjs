// COMPARE. The reference and the new piece side by side, same height, labelled: the step of
// adapt-a-style.md where the agent LOOKS. (Tool output for review, not art: the labels use a
// system font through ffmpeg, which the art core never may.)
//   node tools/compare.mjs <reference> <new.png> --out <side-by-side.png> [--left "label"] [--right "label"] [--height 800] [--exclude x,y,w,h]
// --exclude greys out a box of the reference (UI, captions) so the eye reads only the hand.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const VAL = new Set(["out", "left", "right", "height", "exclude"]);
const pos = [], opt = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith("--")) opt[a.slice(2)] = VAL.has(a.slice(2)) ? process.argv[++i] : true; else pos.push(a); }
if (pos.length < 2 || !opt.out) { console.error("usage: node tools/compare.mjs <reference> <new.png> --out <file.png> [--left ..] [--right ..] [--height 800] [--exclude x,y,w,h]"); process.exit(1); }
const H = Number(opt.height ?? 800), hasText = / drawtext /.test(execFileSync("ffmpeg", ["-hide_banner", "-filters"]).toString()), font = hasText ? ["/System/Library/Fonts/Supplemental/Courier New Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"].find(existsSync) : undefined;
if (!font) console.warn("compare: this ffmpeg has no drawtext (or no font): panels are unlabelled, reference LEFT, new RIGHT");
const esc = (s) => s.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\u2019");
const label = (t) => (font && t ? `,drawtext=fontfile='${font}':text='${esc(t)}':x=24:y=34:fontsize=28:fontcolor=0x3a3434` : "");
const ex = opt.exclude ? `drawbox=${opt.exclude.split(",").join(":")}:color=0x8a8580@0.85:t=fill,` : "";
const fc = `[0]${ex}scale=-2:${H}:flags=lanczos,pad=iw+40:ih+110:20:90:color=0xf3efe6${label(opt.left ?? "REFERENCE (the hand)")}[a];[1]scale=-2:${H}:flags=lanczos,pad=iw+40:ih+110:20:90:color=0xf3efe6${label(opt.right ?? "NEW SUBJECT, ADAPTED HAND")}[b];[a][b]hstack=inputs=2`;
mkdirSync(dirname(resolve(opt.out)), { recursive: true });
execFileSync("ffmpeg", ["-v", "error", "-y", "-i", resolve(pos[0]), "-i", resolve(pos[1]), "-filter_complex", fc, "-frames:v", "1", resolve(opt.out)]);
console.log(`-> ${resolve(opt.out)}`);
