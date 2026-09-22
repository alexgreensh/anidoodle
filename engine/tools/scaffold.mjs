// SCAFFOLD. Turn the skill's engine into a working film project.
//
//   node <skill>/engine/tools/scaffold.mjs <dir> [--film myFilm] [--example]
//
// The engine ships as parts, not as a project: `engine/src` holds the portable art core and the
// one page host, `example/src` holds the worked butterfly. A film needs them in ONE tree, because
// every tool here resolves `src/canvas-core/<film>.ts` and `src/hosts/page-<film>.ts` against the
// working directory. That is the whole job.
//
//   --film <name>   write a minimal film module and its host page, ready to render
//   --example       copy the mechanical-butterfly in as well, to READ. It is proof of craft, not
//                   a template: copying it gets you somebody else's film with your title on it.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ENGINE = resolve(HERE, "..");
const SKILL = resolve(ENGINE, "..");

const VAL = new Set(["film"]);
const pos = [], opt = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith("--")) opt[a.slice(2)] = VAL.has(a.slice(2)) ? process.argv[++i] : true; else pos.push(a); }
const die = (m) => { console.error(`scaffold: ${m}`); process.exit(1); };
const target = resolve(pos[0] ?? die("usage: node tools/scaffold.mjs <dir> [--film myFilm] [--example]"));
const film = opt.film && opt.film !== true ? String(opt.film) : null;
if (film && !/^[a-zA-Z][a-zA-Z0-9]*$/.test(film)) die(`--film '${film}' must be a bare identifier: it becomes a module name and an export name`);

mkdirSync(target, { recursive: true });
cpSync(join(ENGINE, "src"), join(target, "src"), { recursive: true });
cpSync(join(ENGINE, "tools"), join(target, "tools"), { recursive: true });
for (const f of ["package.json", "tsconfig.json"]) if (existsSync(join(ENGINE, f))) cpSync(join(ENGINE, f), join(target, f));

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

const tree = (dir, depth = 0) => readdirSync(dir, { withFileTypes: true }).filter((e) => e.name !== "node_modules").slice(0, 6).map((e) => `${"  ".repeat(depth + 1)}${e.name}${e.isDirectory() ? "/" : ""}`).join("\n");
console.log(`scaffolded ${target}\n${tree(target)}\n`);
console.log(`next:\n  cd ${target}\n  npm install`);
if (film) console.log(`  node tools/still.mjs ${film} --out out/look.png      # the ONE look still\n  node tools/gate.mjs ${film} --mp4 out/${film.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()}.mp4`);
if (opt.example) console.log(`  node tools/gate.mjs mechanicalLepidoptera --mp4 out/mechanical-lepidoptera.mp4   # the worked example`);
