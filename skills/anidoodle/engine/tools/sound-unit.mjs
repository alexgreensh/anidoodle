#!/usr/bin/env node
// Unit + end-to-end tests for the sound and project tools that need node's own modules, ffmpeg and real
// files: track.mjs master and listen, the mix sidecar's provenance, cues.mjs and scaffold.mjs from a
// folder whose path has a space, narrate's baked-module staleness and its PATH lookup, and overlay's
// linked-project rule. Each test was written red first, against the bug it names. Temp folder under
// out/, removed afterwards. No paid API is ever called.
//   node tools/sound-unit.mjs
import { strict as assert } from "node:assert";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ENGINE = join(dirname(fileURLToPath(import.meta.url)), ".."), TOOLS = join(ENGINE, "tools");
const root = join(ENGINE, "out", ".sound-unit"); rmSync(root, { recursive: true, force: true }); mkdirSync(root, { recursive: true });
let n = 0, failed = 0;
const t = async (label, fn) => { try { await fn(); n++; console.log(`  PASS  ${label}`); } catch (e) { failed++; console.log(`  FAIL  ${label}\n        ${String(e.message).split("\n").slice(0, 6).join("\n        ")}`); } };
const node = (args, o = {}) => spawnSync(process.execPath, args, { encoding: "utf8", cwd: root, ...o });
const ff = (...a) => execFileSync("ffmpeg", ["-y", "-v", "error", ...a]);
const dur = (f) => Number(execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString().trim());
const sha = (f) => createHash("sha256").update(readFileSync(f)).digest("hex");
const tone = (f, s) => ff("-f", "lavfi", "-i", `sine=frequency=330:sample_rate=48000:duration=${s}`, "-af", "volume=0.3", "-ac", "2", f);
const isWin = process.platform === "win32";

try {
  // ---------------------------------------------------------------- track.mjs master (H5, M10)
  const pic = join(root, "picture.mp4"); ff("-f", "lavfi", "-i", "color=c=gray:s=64x36:r=30:d=6", "-c:v", "mpeg4", pic);
  const short = join(root, "short.wav"), full = join(root, "full.wav"), long = join(root, "long.wav"); tone(short, 4); tone(full, 6); tone(long, 8);
  const master = (mix, out) => node([join(TOOLS, "track.mjs"), "master", pic, mix, "-o", out]);
  await t("RED (H5): a 4 s mix under a 6 s picture is refused, and no file shorter than the picture is written", () => {
    const out = join(root, "h5.mp4"), r = master(short, out);
    assert.notEqual(r.status, 0, r.stdout); assert.match(r.stdout + r.stderr, /shorter than the picture/);
    assert.ok(!existsSync(out) || dur(out) >= 5.9, `a ${existsSync(out) ? dur(out).toFixed(2) : "?"} s file was written for a 6 s picture`);
  });
  await t("GREEN (H5): a mix as long as the picture masters to the full 6 s", () => { const out = join(root, "h5ok.mp4"), r = master(full, out); assert.equal(r.status, 0, r.stdout + r.stderr); assert.ok(Math.abs(dur(out) - 6) < 0.15, `${dur(out)} s`); });
  await t("H5: a mix longer than the picture is trimmed to the picture, never the other way round", () => { const out = join(root, "h5long.mp4"), r = master(long, out); assert.equal(r.status, 0, r.stdout + r.stderr); assert.ok(Math.abs(dur(out) - 6) < 0.15, `${dur(out)} s`); });
  await t("RED (M10): mastering again from a mix with no sidecar removes the old <out>.mix.json", () => {
    const out = join(root, "m10.mp4"), a = join(root, "a.wav"), b = join(root, "b.wav"); cpSync(full, a); cpSync(full, b);
    writeFileSync(a + ".mix.json", JSON.stringify({ music: "x", musicSha256: "old", quiet: [] }));
    master(a, out); assert.ok(existsSync(out + ".mix.json"), "the first master did not copy the sidecar");
    const r = master(b, out); assert.ok(!existsSync(out + ".mix.json"), "the previous mix's record is still beside the new file"); assert.match(r.stdout, /no mix sidecar/);
  });
  await t("RED (M5): master carries the picture's film sidecar to the output, re-hashed, so ship scans with the film's settings", async () => {
    const { readSidecar } = await import(pathToFileURL(join(TOOLS, "sidecar.mjs")).href);
    const p2 = join(root, "m5pic.mp4"), out = join(root, "m5.mp4"); cpSync(pic, p2);
    writeFileSync(p2 + ".film.json", JSON.stringify({ film: "m5Film", file: "m5pic.mp4", sha256: sha(p2), frames: [0, 180], meta: { fps: 30, motion: { temperament: "calm" } } }));
    const r2 = node([join(TOOLS, "track.mjs"), "master", p2, full, "-o", out]);
    assert.equal(r2.status, 0, r2.stdout + r2.stderr);
    const sc = readSidecar(out); assert.ok(sc, "no <out>.film.json beside the mastered file");
    assert.equal(sc.film, "m5Film"); assert.equal(sc.meta.motion.temperament, "calm"); assert.equal(sc.stale, false, "the sidecar still carries the picture's hash"); assert.equal(sc.file, "m5.mp4");
  });
  await t("master leaves no .master.wav temp file behind", () => assert.deepEqual(readdirSync(root).filter((f) => f.endsWith(".master.wav")), []));

  // ---------------------------------------------------------------- the mix sidecar names its cue sheet (H6)
  const { trackProvenance } = await import(pathToFileURL(join(TOOLS, "sidecar.mjs")).href);
  const take = join(root, "take.wav"); cpSync(full, take);
  const man = join(root, "take.wav.track.json"); writeFileSync(man, JSON.stringify({ sha256: sha(take), provider: "test" }));
  const cues = join(root, "film.cues.json"), file = join(root, "film.mp4"); writeFileSync(file, "x");
  writeFileSync(cues, JSON.stringify({ film: "film", fps: 30, durationFrames: 180, cues: [{ name: "hit", frame: 30, t: 1, sound: "tap:tock" }] }));
  const mixRec = (extra) => writeFileSync(file + ".mix.json", JSON.stringify({ music: take, musicSha256: sha(take), cues, cuesSha256: sha(cues), quiet: [], ...extra }));
  await t("GREEN (H6): a mix made from the current cue sheet passes provenance", () => { mixRec(); const p = trackProvenance(man, file); assert.ok(p.ok, p.detail); });
  await t("RED (H6): the cue sheet changed after the mix was made, so the effects are stale and provenance fails", () => {
    mixRec(); writeFileSync(cues, JSON.stringify({ film: "film", fps: 30, durationFrames: 180, cues: [{ name: "hit", frame: 60, t: 2, sound: "tap:tock" }] }));
    const p = trackProvenance(man, file); assert.ok(!p.ok, p.detail); assert.match(p.detail, /cue sheet/);
  });
  await t("RED (H6): a mix record with no cue sheet hash cannot be checked, so it fails", () => { mixRec({ cuesSha256: undefined }); const p = trackProvenance(man, file); assert.ok(!p.ok, p.detail); });
  await t("RED (H6): a mix whose cue sheet is gone fails", () => { mixRec(); rmSync(cues); const p = trackProvenance(man, file); assert.ok(!p.ok, p.detail); });

  // ---------------------------------------------------------------- track.mjs listen without a shell rm (M11)
  await t("RED (M11): listen runs with no rm on the PATH (as on Windows) and leaves no temp WAVs", () => {
    const dir = join(root, "listen"), r = node([join(TOOLS, "track.mjs"), "listen", dir, "--mix", full, "--at", "0", "--len", "2"], { env: { ...process.env, PATH: dirname(execFileSync(isWin ? "where" : "which", ["ffmpeg"]).toString().split(/\r?\n/)[0]) } });
    assert.equal(r.status, 0, r.stderr); assert.deepEqual(readdirSync(dir).filter((f) => f.endsWith(".wav")), []);
  });

  // ---------------------------------------------------------------- narrate (M6, M11)
  const { bakedStale } = await import(pathToFileURL(join(TOOLS, "narrate.mjs")).href);
  const timing = { totalFrames: 120, lines: [{ hash: "a".repeat(64) }] }, mod = (frames, hash = "a".repeat(64)) => `export const v = {"timing":{"totalFrames":${frames},"lines":[{"hash":"${hash}"}]}}`;
  await t("RED (M6): narrate all may re-bake after the script's length changed (ignoreStale covers frames too)", () => assert.equal(bakedStale(mod(100), timing, true), false));
  await t("M6: check still calls a module baked at another length stale", () => assert.equal(bakedStale(mod(100), timing, false), true));
  await t("M6: check still calls a module baked from other takes stale", () => assert.equal(bakedStale(mod(120, "b".repeat(64)), timing, false), true));
  await t("M6: a module baked from these takes at this length is current", () => assert.equal(bakedStale(mod(120), timing, false), false));
  const { which } = await import(pathToFileURL(join(TOOLS, "narrate", "providers", "util.mjs")).href);
  const bin = join(root, "bin dir"); mkdirSync(bin); const exe = join(bin, isWin ? "kokoro-x.cmd" : "kokoro-x"); writeFileSync(exe, isWin ? "@echo off\r\n" : "#!/bin/sh\n"); chmodSync(exe, 0o755);
  await t("RED (M11): which finds a program on PATH with no /usr/bin/env or which (a folder with a space)", () => { const was = process.env.PATH; process.env.PATH = bin; try { assert.equal(which("kokoro-x"), exe); } finally { process.env.PATH = was; } });
  await t("M11: which reads Windows PATHEXT, so kokoro-x finds kokoro-x.CMD", () => {
    const win = join(root, "win"); mkdirSync(win); writeFileSync(join(win, "whisper-cli.CMD"), "");
    assert.equal(which("whisper-cli", { path: [join(root, "nope"), win].join(delimiter), pathext: ".EXE;.CMD", win: true }), join(win, "whisper-cli.CMD"));
  });
  await t("M11: which says null for a program that is not there", () => assert.equal(which("no-such-program-xyz", { path: bin }), null));

  // ---------------------------------------------------------------- a copy of the engine in a folder with a space (M11, L9, L11)
  const spaced = join(root, "my engine", "engine"); mkdirSync(spaced, { recursive: true });
  for (const d of ["tools", "src"]) cpSync(join(ENGINE, d), join(spaced, d), { recursive: true });
  cpSync(join(ENGINE, "package.json"), join(spaced, "package.json"));
  await t("RED (M11): cues.mjs builds its cue module from an engine whose path has a space", async () => {
    const { loadCues } = await import(pathToFileURL(join(spaced, "tools", "cues.mjs")).href);
    const m = await loadCues(); assert.equal(typeof m.diffSheets, "function");
  });
  const proj = join(root, "my film project");
  await t("RED (L9): scaffold --linked quotes the engine path in package.json, so the scripts survive a space", () => {
    const r = node([join(spaced, "tools", "scaffold.mjs"), proj, "--linked", "--film", "spaceFilm"]); assert.equal(r.status, 0, r.stdout + r.stderr);
    const scripts = JSON.parse(readFileSync(join(proj, "package.json"), "utf8")).scripts;
    for (const [k, cmd] of Object.entries(scripts)) {
      assert.match(cmd, /^node /, k);
      if (isWin) { assert.match(cmd, /^node "[^"]+" spaceFilm$/, cmd); continue; }
      // npm runs a script through sh: the first word after node must be the whole tool path
      const words = execFileSync("sh", ["-c", `printf '%s\\n' ${cmd.slice(5)}`]).toString().trim().split("\n");
      assert.equal(words[0], join(spaced, "tools", `${k}.mjs`), `${k}: sh split the path into ${JSON.stringify(words)}`);
      assert.equal(words[1], "spaceFilm");
    }
  });
  const overlayRoots = (cwd) => { const r = node(["--input-type=module", "-e", `const o = await import(${JSON.stringify(pathToFileURL(join(TOOLS, "overlay.mjs")).href)}); console.log(JSON.stringify({ roots: o.ROOTS, page: o.enginePath("src/hosts/page.ts") }));`], { cwd }); assert.equal(r.status, 0, r.stderr); return JSON.parse(r.stdout); };
  await t("RED (L11): another repo's src/hosts/page.ts never replaces the engine's (no linked-project marker)", () => {
    const other = join(root, "other repo"); mkdirSync(join(other, "src", "hosts"), { recursive: true }); writeFileSync(join(other, "src", "hosts", "page.ts"), "// not ours\n");
    const o = overlayRoots(other); assert.equal(o.page, join(ENGINE, "src", "hosts", "page.ts")); assert.ok(!o.roots.includes(join(other, "src")), JSON.stringify(o.roots));
  });
  await t("GREEN (L11): a project made by scaffold --linked joins the tree first", () => {
    assert.ok(existsSync(join(proj, "src")), "the L9 test did not scaffold the project");
    const o = overlayRoots(proj); assert.equal(o.roots[0], join(proj, "src"));
  });
} finally { rmSync(root, { recursive: true, force: true }); }
console.log(`\nSOUND-UNIT: ${failed ? "FAIL" : "PASS"}   ${n} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
