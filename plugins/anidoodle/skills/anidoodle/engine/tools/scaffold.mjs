// SCAFFOLD. Turn the skill's engine into a working project: a still, a film, or both.
//
//   node <skill>/engine/tools/scaffold.mjs <dir> [--still myPicture] [--film myFilm] [--duration seconds] [--size WxH | --format 9x16] [--fps N] [--bpm N] [--example]
//   node <skill>/engine/tools/scaffold.mjs <dir> --linked --film myFilm [--world] [...]   a project that USES the engine, no copy;
//                   --world starts the film as one world under one camera (worldfilm.mjs), the default for launch films
//
// The engine ships as parts, not as a project: `engine/src` holds the portable art core and the
// one page host, `example/src` holds the worked butterfly. A film needs them in ONE tree, because
// every tool here resolves `src/canvas-core/<film>.ts` and `src/hosts/page-<film>.ts` against the
// working directory. That is the whole job.
//
//   --still <name>  write a one-frame picture module (a still is a film one frame long, so every
//                   tool works on it unchanged) and its host page, ready to render
//   --film <name>   write a minimal film module and its host page, ready to render
//   --example       copy the mechanical-butterfly in as well, to READ, and anidoodle's own launch
//                   films (launch, launch2, launch3, launchClip, which are built on it). They are
//                   proof of craft, not a template: copying one gets you somebody else's film with
//                   your title on it. Without --example they stay out, with every module only they
//                   use; the launch KIT (launchKit, kinetic, launchCut, launchTemplate, launchExample)
//                   always ships, because that is what your own launch film is built on.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { PROJECT_MARKER } from "./overlay.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ENGINE = resolve(HERE, "..");
const SKILL = resolve(ENGINE, "..");

const VAL = new Set(["film", "still", "duration", "size", "format", "fps", "bpm"]);
const pos = [], opt = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith("--")) opt[a.slice(2)] = VAL.has(a.slice(2)) ? process.argv[++i] : true; else pos.push(a); }
const die = (m) => { console.error(`scaffold: ${m}`); process.exit(1); };
const target = resolve(pos[0] ?? die("usage: node tools/scaffold.mjs <dir> [--still name] [--film name] [--duration seconds] [--size WxH | --format 1x1|9x16|16x9|4x5] [--fps N] [--bpm N] [--example]"));
const name = (flag) => { const v = opt[flag] && opt[flag] !== true ? String(opt[flag]) : null; if (v && !/^[a-zA-Z][a-zA-Z0-9]*$/.test(v)) die(`--${flag} '${v}' must be a bare identifier: it becomes a module name and an export name`); return v; };
const film = name("film"), still = name("still");
if (film && still && film === still) die("--film and --still need different names");
const formats = { "1x1": [1080, 1080], "9x16": [1080, 1920], "16x9": [1920, 1080], "4x5": [1080, 1350] };
if (opt.format && !formats[opt.format]) die("--format must be 1x1, 9x16, 16x9 or 4x5");
if (opt.size && opt.format) die("choose --size or --format");
const size = opt.size ? String(opt.size).match(/^(\d+)x(\d+)$/i)?.slice(1).map(Number) : formats[opt.format ?? "1x1"];
if (!size || size.some((x) => !Number.isSafeInteger(x) || x < 2)) die("--size must be positive WxH dimensions");
const fps = Number(opt.fps ?? 30), bpm = Number(opt.bpm ?? 60), duration = Number(opt.duration ?? 8);
if (!Number.isSafeInteger(fps) || fps < 1) die("--fps must be a positive integer");
if (!Number.isFinite(bpm) || bpm <= 0 || !Number.isInteger(60 * fps / bpm)) die("--bpm must give a whole-frame beat at this fps");
if (!Number.isFinite(duration) || duration <= 0 || !Number.isSafeInteger(Math.round(duration * fps))) die("--duration must be positive seconds with a finite frame count");
const durationFrames = Math.max(1, Math.round(duration * fps));

// anidoodle's own launch films: our film, not starter content. They import the worked example, so
// they only come in with it. Everything that imports them (their type sheets) goes with them, and
// so does every module nothing else imports; a plain scaffold then typechecks and renders.
const OWN_FILMS = ["launch", "launch2", "launch3", "launchClip"];
const ownFilmFiles = () => {
  const SRC = join(ENGINE, "src");
  const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") ? [p] : []; });
  const files = walk(SRC);
  const res = (from, spec) => { const b = resolve(dirname(from), spec); for (const e of ["", ".ts", "/index.ts"]) { const c = resolve(b + e); if (existsSync(c) && statSync(c).isFile()) return c; } return null; }; // resolve(): on Windows "dir/index.ts" must become "dir\index.ts" to match the walked file list
  const known = new Set(files); // a film can import a font or a JSON file by path: only .ts modules are graph nodes
  const imp = new Map(files.map((f) => [f, new Set([...readFileSync(f, "utf8").matchAll(/(?:from|import)\s*\(?\s*"(\.[^"]+)"/g)].map((m) => res(f, m[1])).filter((t) => t && known.has(t)))]));
  const page = (f) => join(SRC, "hosts", `page-${f.slice(f.lastIndexOf(sep) + 1)}`);
  const out = new Set(OWN_FILMS.map((n) => join(SRC, "canvas-core", `${n}.ts`)));
  for (let grew = true; grew;) { grew = false; for (const f of files) if (!out.has(f) && [...imp.get(f)].some((t) => out.has(t))) { out.add(f); grew = true; } }
  for (const f of [...out]) if (f.includes(`${sep}canvas-core${sep}`) && existsSync(page(f))) out.add(page(f));
  const users = (f) => files.filter((g) => imp.get(g).has(f));
  const roots = files.filter((f) => !out.has(f) && users(f).length === 0), reach = new Set(), st = [...roots];
  while (st.length) { const f = st.pop(); if (reach.has(f) || out.has(f)) continue; reach.add(f); st.push(...imp.get(f)); }
  for (const f of files) if (!reach.has(f)) out.add(f);
  return out;
};
// --linked: a project of the person's own, beside their brand files and photos, that USES the installed
// engine instead of copying it. Only the film, its host page, a tsconfig that sees the engine's modules
// and a package.json whose scripts call the engine's tools are written. The tools run from the project
// folder (cwd); overlay.mjs puts the project's src/ in front of the engine's, so "./core" resolves to the
// engine. An engine update reaches every linked project; nothing is forked (lesson X4 from a brand launch film).
if (opt.linked) {
  if (still || opt.example) die("--linked takes --film only (a still or the example need the full copy)");
  if (!film) die("--linked needs --film <name>");
  const mod = join(target, "src/canvas-core", `${film}.ts`), host = join(target, "src/hosts", `page-${film}.ts`);
  if (existsSync(mod) || existsSync(host)) die(`${film} already exists in ${target}; refusing to overwrite`);
  mkdirSync(join(target, "src/canvas-core"), { recursive: true }); mkdirSync(join(target, "src/hosts"), { recursive: true });
  const rel = (p) => relative(target, p).split(sep).join("/");
  if (opt.world) { const { worldFilmSource } = await import("./worldfilm.mjs"); writeFileSync(mod, worldFilmSource(film, { format: opt.format ?? "16x9", fps, ...(opt.bpm ? { bpm } : {}) })); } // the one-world starter (worldfilm.mjs): the default for a motion or launch film
  else writeFileSync(mod, `// ${film}: a film in a linked project. "./core", "./film" and every kit module come from the engine at
// ${rel(join(ENGINE, "src"))} (tools/overlay.mjs). Keep this folder for the film's own modules, assets and facts.
import { rng, type Ctx, type Env } from "./core";
import type { Film } from "./film";

const FPS = ${fps}, BPM = ${bpm}, DURATION = ${durationFrames};
const draw = (ctx: Ctx, local: number, env: Env) => {
  const W = env.W * env.scale, H = env.H * env.scale, r = rng(1), t = local / DURATION;
  ctx.fillStyle = "#12161c"; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 90; i++) { const a = r() * Math.PI * 2, rad = (0.08 + r() * 0.36) * Math.min(W, H); ctx.globalAlpha = 0.25 + r() * 0.6; ctx.fillStyle = "#e8e3d2"; ctx.beginPath(); ctx.arc(W / 2 + Math.cos(a + t * Math.PI * 2) * rad, H / 2 + Math.sin(a + t * Math.PI * 2) * rad, (1 + r() * 2.5) * env.scale, 0, Math.PI * 2); ctx.fill(); }
  ctx.globalAlpha = 1;
};
export const ${film}: Film = {
  meta: { title: "${film}", W: ${size[0]}, H: ${size[1]}, fps: FPS, bpm: BPM, durationFrames: DURATION },
  assets: { images: {} },
  shots: [{ id: "one", start: 0, end: DURATION, draw }],
};
`);
  writeFileSync(host, `import { ${film} } from "../canvas-core/${film}";\nimport { mountFilm } from "./page";\nmountFilm(${film});\n`);
  const eng = rel(ENGINE);
  if (!existsSync(join(target, "tsconfig.json"))) writeFileSync(join(target, "tsconfig.json"), JSON.stringify({ compilerOptions: { target: "ES2022", module: "ESNext", moduleResolution: "bundler", strict: true, ...(existsSync(join(ENGINE, "vendor/three/types")) ? {} : { noImplicitAny: false }), noEmit: true, skipLibCheck: true, lib: ["DOM", "ES2022"], rootDirs: ["src", `${eng}/src`], paths: { three: [`${eng}/vendor/three/types/Three.d.ts`, `${eng}/vendor/three/three-untyped.d.ts`] } }, include: ["src"] }, null, 2) + "\n");
  // npm runs a script through a shell (sh, or cmd.exe on Windows): the tool path is quoted so a folder
  // with a space stays one word. Single quotes on sh (nothing inside expands), double quotes on cmd.exe.
  const quote = (p) => (process.platform === "win32" ? `"${p}"` : `'${p.replace(/'/g, `'\\''`)}'`);
  const tool = (t) => `node ${quote(join(ENGINE, "tools", t))}`;
  // the marker that makes this folder a linked project: overlay.mjs puts its src/ in front of the engine's
  // only when this file is here, so another repo that happens to have a src/ never replaces engine files
  if (!existsSync(join(target, PROJECT_MARKER))) writeFileSync(join(target, PROJECT_MARKER), JSON.stringify({ linked: true, film, engine: ENGINE }, null, 2) + "\n");
  if (!existsSync(join(target, "package.json"))) writeFileSync(join(target, "package.json"), JSON.stringify({ name: film.toLowerCase(), private: true, type: "module", dependencies: { three: "0.170.0" }, scripts: { still: `${tool("still.mjs")} ${film}`, render: `${tool("render.mjs")} ${film}`, framecheck: `${tool("framecheck.mjs")} ${film}`, ship: `${tool("ship.mjs")} ${film}` } }, null, 2) + "\n");
  console.log(`linked project ${target}\n  src/canvas-core/${film}.ts, src/hosts/page-${film}.ts, tsconfig.json, package.json, ${PROJECT_MARKER}\n  engine: ${ENGINE}\nnext (from ${target}):\n  ${tool("still.mjs")} ${film} --out out/look.png\n  ${tool("render.mjs")} ${film}\n  ${tool("ship.mjs")} ${film}`);
  process.exit(0);
}
const skip = opt.example ? new Set() : ownFilmFiles();

mkdirSync(target, { recursive: true });
cpSync(join(ENGINE, "src"), join(target, "src"), { recursive: true, filter: (f) => !skip.has(f) });
cpSync(join(ENGINE, "tools"), join(target, "tools"), { recursive: true });
for (const f of ["package.json", "package-lock.json", "tsconfig.json"]) if (existsSync(join(ENGINE, f))) cpSync(join(ENGINE, f), join(target, f));
// three.js for 3D shots: the vendored, hash-pinned build and its types where the install has them; the
// plugin install has neither, and npm install brings the same pinned release (package.json, overlay.mjs)
if (existsSync(join(ENGINE, "vendor"))) cpSync(join(ENGINE, "vendor"), join(target, "vendor"), { recursive: true });
// fonts, brand files and narration scripts the engine's films import by path (../../assets/...)
if (existsSync(join(ENGINE, "assets"))) cpSync(join(ENGINE, "assets"), join(target, "assets"), { recursive: true, filter: (f) => !f.includes(`${sep}assets${sep}refs`) });

if (opt.example) {
  const ex = join(SKILL, "example", "src");
  if (!existsSync(ex)) die(`--example: the worked film is not in this install (the directory copy leaves it out to stay small). Run scaffold.mjs --example from a clone of the anidoodle repository: see Links in the plugin README.`);
  cpSync(ex, join(target, "src"), { recursive: true });
}

// Reference images (public-domain paintings with their PROVENANCE.json) come along when a module
// in the tree names one as an asset; a film loads its assets relative to the project root.
const tsIn = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? tsIn(p) : p.endsWith(".ts") ? [p] : []; });
if (tsIn(join(target, "src")).some((f) => readFileSync(f, "utf8").includes('"assets/refs/'))) cpSync(join(ENGINE, "assets", "refs"), join(target, "assets", "refs"), { recursive: true });

// A film is data: meta, an empty asset manifest, and shots that tile [0, duration). The starter
// draws something that MOVES on every frame, because a film whose first frame is blank teaches
// the wrong habit and fails the dead-air gate on day one.
if (film) {
  const mod = join(target, "src/canvas-core", `${film}.ts`);
  if (existsSync(mod)) die(`${mod} already exists; refusing to overwrite a film module`);
  writeFileSync(mod, `import { Ctx, Env, rng } from "./core";
import { Film } from "./film";

const FPS = ${fps}, BPM = ${bpm}, DURATION = ${durationFrames};

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
  meta: { title: "${film}", W: ${size[0]}, H: ${size[1]}, fps: FPS, bpm: BPM, durationFrames: DURATION },
  assets: { images: {} },
  shots: [{ id: "one", start: 0, end: DURATION, draw }],
  // audio: (sampleRate) => [left, right],   // see references/music/README.md before writing a note
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
  const fit = Math.min(env.W, env.H) / 1080;
  g.push((env.W - 1080 * fit) / 2, (env.H - 1080 * fit) / 2, fit);

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
  g.pop();
  // 4. the sheet itself, over everything
  g.paper("paper", 0.12);
  g.paper("coldpress", 0.18);
};

export const ${still}: Film = {
  meta: { title: "${still}", W: ${size[0]}, H: ${size[1]}, fps: ${fps}, bpm: ${bpm}, durationFrames: 1 },
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
if (film) console.log(`  node tools/still.mjs ${film} --out out/look.png\n  node tools/render.mjs ${film}                      # the gate measures the MP4\n  node tools/gate.mjs ${film}`);
if (opt.example) console.log(`  node tools/gate.mjs mechanicalLepidoptera --mp4 out/mechanical-lepidoptera.mp4   # the worked example`);
