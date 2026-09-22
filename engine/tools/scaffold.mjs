// SCAFFOLD. Turn the skill's engine into a working project: a still, a film, or both.
//
//   node <skill>/engine/tools/scaffold.mjs <dir> [--still myPicture] [--film myFilm] [--example]
//
// The engine ships as parts, not as a project: `engine/src` holds the portable art core and the
// one page host, `example/src` holds the worked butterfly. A film needs them in ONE tree, because
// every tool here resolves `src/canvas-core/<film>.ts` and `src/hosts/page-<film>.ts` against the
// working directory. That is the whole job.
//
//   --still <name>  write a one-frame picture module (a still is a film one frame long, so every
//                   tool works on it unchanged) and its host page, ready to render
//   --film <name>   write a minimal film module and its host page, ready to render
//   --example       copy the mechanical-butterfly in as well, to READ. It is proof of craft, not
//                   a template: copying it gets you somebody else's film with your title on it.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ENGINE = resolve(HERE, "..");
const SKILL = resolve(ENGINE, "..");

const VAL = new Set(["film", "still"]);
const pos = [], opt = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith("--")) opt[a.slice(2)] = VAL.has(a.slice(2)) ? process.argv[++i] : true; else pos.push(a); }
const die = (m) => { console.error(`scaffold: ${m}`); process.exit(1); };
const target = resolve(pos[0] ?? die("usage: node tools/scaffold.mjs <dir> [--still myPicture] [--film myFilm] [--example]"));
const name = (flag) => { const v = opt[flag] && opt[flag] !== true ? String(opt[flag]) : null; if (v && !/^[a-zA-Z][a-zA-Z0-9]*$/.test(v)) die(`--${flag} '${v}' must be a bare identifier: it becomes a module name and an export name`); return v; };
const film = name("film"), still = name("still");
if (film && still && film === still) die("--film and --still need different names");

mkdirSync(target, { recursive: true });
cpSync(join(ENGINE, "src"), join(target, "src"), { recursive: true });
cpSync(join(ENGINE, "tools"), join(target, "tools"), { recursive: true });
for (const f of ["package.json", "package-lock.json", "tsconfig.json"]) if (existsSync(join(ENGINE, f))) cpSync(join(ENGINE, f), join(target, f));

if (opt.example) {
  const ex = join(SKILL, "example", "src");
  if (!existsSync(ex)) die(`--example asked for, but ${ex} is not there`);
  cpSync(ex, join(target, "src"), { recursive: true });
}

// A film is data: meta, an empty asset manifest, and shots that tile [0, duration). The starter
// draws something that MOVES on every frame, because a film whose first frame is blank teaches
// the wrong habit and fails the dead-air gate on day one.
if (film) {
  const mod = join(target, "src/canvas-core", `${film}.ts`);
  if (existsSync(mod)) die(`${mod} already exists; refusing to overwrite a film module`);
  writeFileSync(mod, `import { Ctx, Env, rng } from "./core";
import { Film } from "./film";

// 120 bpm at 30 fps is a 15-frame beat. Cuts land on multiples of 15, events on multiples of 5.
const FPS = 30, BPM = 120, BEAT = (60 / BPM) * FPS, DURATION = BEAT * 32;

const draw = (ctx: Ctx, local: number, env: Env) => {
  const W = env.W * env.scale, H = env.H * env.scale, r = rng(1);
  ctx.fillStyle = "#12161c"; ctx.fillRect(0, 0, W, H);
  // Everything below is a pure function of \`local\`. No clock, no Math.random, no assets.
  const t = local / DURATION;
  for (let i = 0; i < 90; i++) {
    const a = r() * Math.PI * 2, rad = (0.08 + r() * 0.36) * Math.min(W, H);
    const x = W / 2 + Math.cos(a + t * Math.PI * 2) * rad, y = H / 2 + Math.sin(a + t * Math.PI * 2) * rad;
    ctx.globalAlpha = 0.25 + r() * 0.6;
    ctx.fillStyle = "#e8e3d2";
    ctx.beginPath(); ctx.arc(x, y, (1 + r() * 2.5) * env.scale, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
};

export const ${film}: Film = {
  meta: { title: "${film}", W: 1080, H: 1080, fps: FPS, bpm: BPM, durationFrames: DURATION },
  assets: { images: {} },
  shots: [{ id: "one", start: 0, end: DURATION, draw }],
  // audio: (sampleRate) => [left, right],   // see references/music-recipe.md before writing a note
};
`);
  writeFileSync(join(target, "src/hosts", `page-${film}.ts`), `import { ${film} } from "../canvas-core/${film}";\nimport { mountFilm } from "./page";\nmountFilm(${film});\n`);
}

// A still is a film one frame long. The starter is a small study done the way the gallery plates
// are: one named light, a cast shadow, the form washed in, then the pencil, then the paper. It is
// there to show the ORDER of the marks; replace the pear, keep the order.
if (still) {
  const mod = join(target, "src/canvas-core", `${still}.ts`);
  if (existsSync(mod)) die(`${mod} already exists; refusing to overwrite a picture module`);
  writeFileSync(mod, `import { Gfx, PENCIL, line, oval, type Ctx, type Env, type P } from "./core";
import { Film } from "./film";

// ONE light for the whole picture, upper left. Every form is lit from it and every shadow falls
// away from it: this one decision is most of what makes a drawing read as solid.
const LIGHT: P = [-7, -9];

// Hand-placed control points round a pear: a narrow shoulder, a waist, a heavy seat. Placed by
// eye over the real fruit, never built from ellipses; that is the difference between a pear and
// the icon of one.
const PEAR: P[] = [[536, 318], [566, 330], [584, 372], [590, 430], [616, 482], [660, 540], [684, 612], [674, 690], [630, 748], [556, 776], [478, 766], [420, 722], [396, 652], [410, 574], [452, 510], [484, 452], [494, 384], [508, 336]];
const STEM: P[] = [[532, 324], [528, 286], [540, 246], [556, 228]];
const LEAF: P[] = [[532, 272], [566, 236], [620, 218], [666, 226], [636, 258], [586, 276]];
const SHADE: P[] = [[586, 420], [612, 480], [656, 540], [680, 612], [670, 688], [628, 744], [572, 766], [604, 716], [628, 650], [622, 574], [596, 500]]; // the core shadow, hugging the side away from the light

export const draw${still[0].toUpperCase() + still.slice(1)} = (ctx: Ctx, _frame: number, env: Env) => {
  // A still has no line boil across frames: its only randomness is the seeded geometry below.
  const g = new Gfx(ctx, env, 0, PENCIL);
  ctx.setTransform(env.scale, 0, 0, env.scale, 0, 0);
  ctx.fillStyle = "#fbf6ec"; ctx.fillRect(0, 0, env.W, env.H);

  // 1. the cast shadow first, so the fruit sits ON the table and never floats over it
  g.group("paint", () => g.wash(oval(600, 772, 190, 34, 16), "#a79db8", { seed: 3, alpha: 0.42, dx: 0, dy: 0, shrink: 1 }));
  // 2. the form: a shadow colour under, the lit colour pushed toward the light, one lifted highlight
  g.group("paint", () => {
    g.form(PEAR, "#e2c15c", "#8f8a3c", { seed: 5, light: LIGHT, hi: [486, 590, 12, 30, -24] });
    g.wash(SHADE, "#7d6a2e", { seed: 6, alpha: 0.26, dx: 0, dy: 0, shrink: 1, rim: false });
    g.wash(oval(492, 668, 74, 96, 12), "#d9804f", { seed: 8, alpha: 0.09, dx: 0, dy: 0, shrink: 1, rim: false }); // a blush, lost at every edge
    g.form(LEAF, "#98ad6f", "#5d7454", { seed: 7, light: LIGHT, alpha: 0.95 });
  });
  // 3. the pencil, over the paint: a contour that swells and lifts, then the few lines that matter
  g.group("ink", () => {
    g.pen(PEAR, { seed: 11, closed: true, w: 1.3, opacity: 0.78, wobble: 0.8, boil: 0 });
    g.pen(STEM, { seed: 12, w: 2.6, opacity: 0.9, boil: 0, taper: 0.6 });
    g.pen(LEAF, { seed: 13, closed: true, w: 0.9, opacity: 0.55, boil: 0 });
    g.pen(line([536, 270], [660, 230], -6), { seed: 14, w: 0.6, opacity: 0.45, boil: 0, retrace: false });
  });
  // 4. the sheet itself, over everything
  g.paper("paper", 0.12);
  g.paper("coldpress", 0.18);
};

export const ${still}: Film = {
  meta: { title: "${still}", W: 1080, H: 1080, fps: 30, bpm: 120, durationFrames: 1 },
  assets: { images: {} },
  shots: [{ id: "${still}", start: 0, end: 1, draw: draw${still[0].toUpperCase() + still.slice(1)} }],
};
`);
  writeFileSync(join(target, "src/hosts", `page-${still}.ts`), `import { ${still} } from "../canvas-core/${still}";\nimport { mountFilm } from "./page";\nmountFilm(${still});\n`);
}

const tree = (dir, depth = 0) => readdirSync(dir, { withFileTypes: true }).filter((e) => e.name !== "node_modules").slice(0, 6).map((e) => `${"  ".repeat(depth + 1)}${e.name}${e.isDirectory() ? "/" : ""}`).join("\n");
console.log(`scaffolded ${target}\n${tree(target)}\n`);
console.log(`next:\n  cd ${target}\n  npm install`);
if (still) console.log(`  node tools/still.mjs ${still} --out out/${still}.png      # the picture; --scale 2 for print size`);
if (film) console.log(`  node tools/still.mjs ${film} --out out/look.png      # the ONE look still\n  node tools/gate.mjs ${film} --mp4 out/${film.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()}.mp4`);
if (opt.example) console.log(`  node tools/gate.mjs mechanicalLepidoptera --mp4 out/mechanical-lepidoptera.mp4   # the worked example`);
