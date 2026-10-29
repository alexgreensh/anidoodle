#!/usr/bin/env node
// Unit test for tools/soundfetch.mjs and `soundpack.mjs dist`: builds a TINY synthetic pack in
// the contract's format (2 instruments x 2 zones + 1 room), dists it, then exercises
// get/list/where/verify/remove against a local dist dir, and every refusal path: foreign
// install roots, corrupt archives, tar escapes (traversal, absolute, backslash, link, wrong
// top, oversized size), tampered and oversized indexes, over-long and interrupted downloads,
// and two parallel gets. Needs ffmpeg for the synthetic FLACs. Durable directory required -
// never /tmp. No cp -R: the suite runs on Windows too.
//   node tools/soundfetch-unit.mjs <durable-test-dir>
import { execFileSync, execFile } from "node:child_process";
import { promisify } from "node:util";
import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync, cpSync, statSync, openSync, closeSync, writeSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { tarHeader } from "./soundpack.mjs";
import { soundsDir } from "./soundfetch.mjs";

const TOOLS = import.meta.dirname;
const dir = process.argv[2];
if (!dir) throw new Error("name a durable test directory");
const root = resolve(dir);
mkdirSync(root, { recursive: true });
const sha = (f) => createHash("sha256").update(readFileSync(f)).digest("hex");
const SR = 48000;
const INDEX = "anidoodle-sounds-v1.json";
let pass = 0;
const ok = (name) => console.log(`PASS ${++pass} ${name}`);

// ---------------------------------------------------------------- a tiny pack (contract format)
const pack = join(root, "tiny-pack");
const mkFlac = (file, frames, ch, seed0) => {
  const pcm = Buffer.alloc(frames * ch * 4);
  let seed = seed0;
  for (let i = 0; i < frames * ch; i++) { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; pcm.writeFloatLE(((seed >>> 0) / 4294967296 - 0.5) * 0.4, i * 4); }
  execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "f32le", "-ar", String(SR), "-ac", String(ch), "-i", "pipe:0",
    "-map_metadata", "-1", "-c:a", "flac", "-sample_fmt", "s32", "-bits_per_raw_sample", "24", file], { input: pcm });
};
const zone = (id, i, midi) => {
  const file = `${id}/z${i}.flac`, p = join(pack, ...file.split("/")), frames = 4800 * (i + 1);
  mkdirSync(dirname(p), { recursive: true });
  mkFlac(p, frames, 2, 11 + i);
  return { file, midi, layer: 1, rr: 1, frames, channels: 2, peakDb: -8, rmsDb: -20, sha256: sha(p) };
};
const inst = (id, title, midis) => ({ title, source: "test", license: "CC0-1.0", kind: "struck", range: [midis[0], midis.at(-1)], layers: 1, damped: true, zones: midis.map((m, i) => zone(id, i, m)) });
const manifest = { pack: "anidoodle-sounds", version: 1, sampleRate: SR, instruments: {
  piano: inst("piano", "Tiny Piano", [60, 62]),
  harp: inst("harp", "Tiny Harp", [55, 57]),
} };
{
  const f = "rooms/test-room.flac", p = join(pack, "rooms", "test-room.flac"), frames = 2400;
  mkdirSync(dirname(p), { recursive: true });
  mkFlac(p, frames, 2, 99);
  manifest.rooms = { "test-room": { title: "Test Room, Nowhere", source: "test", license: "CC-BY-4.0", file: f, channels: 2, frames, rt60: 0.05, sha256: sha(p), directFrames: 120 } };
}
writeFileSync(join(pack, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
writeFileSync(join(pack, "LICENSES.md"), "# Licenses\n\n- Tiny Piano (`piano`), Tiny Harp (`harp`): synthetic test zones, CC0-1.0\n- Test Room, Nowhere (`rooms/test-room.flac`): CC-BY-4.0\n");
ok("tiny synthetic pack: piano, harp, test-room");

// ---------------------------------------------------------------- dist
const dist = join(root, "dist");
execFileSync("node", [join(TOOLS, "soundpack.mjs"), "dist", pack, dist], { stdio: "pipe" });
const indexSha = sha(join(dist, INDEX));
assert(existsSync(join(dist, "anidoodle-sounds-v1-piano.tar")) && existsSync(join(dist, "anidoodle-sounds-v1-rooms.tar")), "dist wrote archives");
ok("dist: archives + index written");

const install = join(root, "install");
rmSync(install, { recursive: true, force: true }); // re-runs start from a clean install
process.env.ANIDOODLE_SOUNDS = install; // the exported soundsDir() resolves through the env
const ENV = { ANIDOODLE_SOUNDS: install, ANIDOODLE_SOUNDS_URL: dist, ANIDOODLE_SOUNDS_INDEX_SHA256: indexSha };
// async spawn: the in-process http servers below need the event loop free to answer
const execFileP = promisify(execFile);
const run = async (args, env = {}) => (await execFileP("node", [join(TOOLS, "soundfetch.mjs"), ...args], { env: { ...process.env, ...ENV, ...env }, encoding: "utf8" })).stdout;
const runFail = async (args, env = {}) => { try { await run(args, env); } catch (e) { return e; } throw new Error(`expected nonzero exit: soundfetch ${args.join(" ")}`); };
const merged = () => JSON.parse(readFileSync(join(install, "manifest.json"), "utf8"));
// foreign dotfiles are NOT leftovers - only this tool's own .anidoodle-* temps may appear
const noLeftovers = () => assert.deepEqual(readdirSync(install).filter((e) => e.startsWith(".anidoodle-")), [], "no staging/download leftovers");

// ---------------------------------------------------------------- happy path
assert.equal((await run(["where"])).trim(), install, "where prints the resolved install dir");
assert.equal(soundsDir(), null, "soundsDir() null before install");
ok("where + soundsDir() before install");

await run(["get", "piano"]);
assert(existsSync(join(install, "piano", "z0.flac")), "piano flacs unpacked");
assert(existsSync(join(install, "LICENSES.md")), "LICENSES.md written");
assert.deepEqual(Object.keys(merged().instruments), ["piano"]);
assert.equal(soundsDir(), install, "soundsDir() resolves once installed");
noLeftovers();
ok("get piano: unpacked, merged manifest, soundsDir() resolves");

const list1 = await run(["list"]);
assert(list1.includes("anidoodle-sounds-v1-piano.tar") && /piano\.tar.*installed/s.test(list1.replace(/\n/g, " ")) && list1.includes("available"), "list shows installed + available");
ok("list: available vs installed with sizes");

await run(["get", "harp"]);
assert.deepEqual(Object.keys(merged().instruments).sort(), ["harp", "piano"], "second get merged into one manifest");
ok("two instruments in two calls -> one valid merged manifest");

assert((await run(["verify"])).includes("all sha256 match"), "verify passes");
ok("verify: re-hashes everything installed");

await run(["remove", "harp"]);
assert.deepEqual(Object.keys(merged().instruments), ["piano"]);
assert(!existsSync(join(install, "harp")), "harp dir removed");
assert((await run(["verify"])).includes("all sha256 match"), "verify still passes after remove");
ok("remove: manifest updated, files gone, verify still clean");

// remove an inherited-property name: constructor is truthy on a plain object, must not match
{
  const e = await runFail(["remove", "constructor"]);
  assert.match(String(e.stderr), /not installed/, "constructor is not an installed instrument");
}
ok("remove constructor: inherited props are not instruments (Object.hasOwn)");

// ---------------------------------------------------------------- finding 1: a foreign root is off-limits
{
  const foreign = join(root, "foreign");
  mkdirSync(foreign, { recursive: true });
  writeFileSync(join(foreign, "keep.txt"), "precious");
  writeFileSync(join(foreign, ".old-dotfiles"), "precious2"); // the old sweep regex would eat these
  writeFileSync(join(foreign, ".tmp-anything"), "precious3");
  for (const c of [["list"], ["get", "piano"], ["verify"], ["remove", "piano"], ["where"]]) {
    const e = await runFail(c, { ANIDOODLE_SOUNDS: foreign });
    assert.match(String(e.stderr), /refusing to touch/, `soundfetch ${c[0]} must refuse a foreign root`);
  }
  assert.equal(readFileSync(join(foreign, "keep.txt"), "utf8"), "precious");
  assert.equal(readFileSync(join(foreign, ".old-dotfiles"), "utf8"), "precious2");
  assert.equal(readFileSync(join(foreign, ".tmp-anything"), "utf8"), "precious3");
  assert.equal(readdirSync(foreign).length, 3, "nothing was created, renamed or deleted");
  process.env.ANIDOODLE_SOUNDS = foreign;
  assert.equal(soundsDir(), null, "soundsDir() is null on a foreign root");
  process.env.ANIDOODLE_SOUNDS = install;
}
ok("foreign-content root: every command refuses, nothing touched");

// and inside an OWNED dir, sweep only ever removes this tool's own .anidoodle-* names
{
  writeFileSync(join(install, ".old-dotfiles"), "mine");
  writeFileSync(join(install, ".tmp-user"), "mine2");
  writeFileSync(join(install, ".anidoodle-dl-stale-1"), "leftover"); // stale tool temp: fair game
  await run(["get", "rooms"]);
  assert.equal(readFileSync(join(install, ".old-dotfiles"), "utf8"), "mine");
  assert.equal(readFileSync(join(install, ".tmp-user"), "utf8"), "mine2");
  assert(!existsSync(join(install, ".anidoodle-dl-stale-1")), "stale tool temp swept");
}
ok("sweep removes only .anidoodle-* tool temps, foreign dotfiles survive");

// ---------------------------------------------------------------- finding 5: partial get keeps its licence
{
  const install2 = join(root, "install-partial");
  const distMiss = join(root, "dist-missing");
  cpSync(dist, distMiss, { recursive: true });
  rmSync(join(distMiss, "anidoodle-sounds-v1-harp.tar"));
  const e = await runFail(["get", "piano", "harp"], { ANIDOODLE_SOUNDS: install2, ANIDOODLE_SOUNDS_URL: distMiss });
  assert(e, "missing archive fails");
  assert(existsSync(join(install2, "LICENSES.md")), "licence written before the archive loop");
  assert((await run(["verify"], { ANIDOODLE_SOUNDS: install2 })).includes("all sha256 match"), "partial install still verifies");
  rmSync(install2, { recursive: true, force: true });
}
ok("failed second archive: first stays installed with LICENSES.md, verify clean");

// ---------------------------------------------------------------- refusal paths
// corrupt archive: same length, different bytes - the sha256 the index pins no longer matches
const distBad = join(root, "dist-corrupt");
rmSync(distBad, { recursive: true, force: true });
cpSync(dist, distBad, { recursive: true });
{
  const f = join(distBad, "anidoodle-sounds-v1-harp.tar");
  const b = readFileSync(f);
  b[b.length >> 1] ^= 0xff;
  writeFileSync(f, b);
}
{
  const e = await runFail(["get", "harp"], { ANIDOODLE_SOUNDS_URL: distBad });
  assert.match(String(e.stderr), /sha256 mismatch/, "corrupt archive refused on hash");
}
assert(!existsSync(join(install, "harp")), "corrupt archive left no files");
assert.deepEqual(Object.keys(merged().instruments), ["piano"]);
noLeftovers();
assert((await run(["verify"])).includes("all sha256 match"));
ok("corrupted archive refused, nothing left behind");

// tar escape vectors: each archive is honestly sha256'd by its own index, so the refusal has
// to come from the entry checks - a tampered index or archive hash would be a different bug
const rawTar = (file, entries) => {
  const fd = openSync(file, "w");
  try {
    for (const e of entries) {
      const h = tarHeader(e.name, e.size ?? e.data.length);
      if (e.type !== undefined) h[156] = e.type; // forge a link etc.
      writeSync(fd, h);
      writeSync(fd, e.data);
      const pad = (512 - (e.data.length % 512)) % 512;
      if (pad) writeSync(fd, Buffer.alloc(pad));
    }
    writeSync(fd, Buffer.alloc(1024));
  } finally {
    closeSync(fd);
  }
};
const evilDist = (name, entries) => {
  const d = join(root, name);
  rmSync(d, { recursive: true, force: true });
  cpSync(dist, d, { recursive: true });
  rawTar(join(d, "anidoodle-sounds-v1-harp.tar"), entries);
  const index = JSON.parse(readFileSync(join(dist, INDEX), "utf8"));
  const harp = index.archives.find((a) => a.instruments.includes("harp"));
  const f = join(d, "anidoodle-sounds-v1-harp.tar");
  harp.bytes = statSync(f).size;
  harp.sha256 = sha(f);
  writeFileSync(join(d, INDEX), JSON.stringify(index, null, 2) + "\n");
  return { ANIDOODLE_SOUNDS_URL: d, ANIDOODLE_SOUNDS_INDEX_SHA256: sha(join(d, INDEX)) };
};
const blob = Buffer.alloc(64, 1);
for (const [label, entries, re] of [
  ["traversal ../", [{ name: "../evil.flac", data: blob }], /unsafe entry/],
  ["absolute path", [{ name: "/tmp/evil.flac", data: blob }], /unsafe entry/],
  ["backslash", [{ name: "harp\\..\\evil.flac", data: blob }], /unsafe entry/],
  ["link typeflag", [{ name: "harp/x.flac", data: blob, type: 0x32 }], /link or non-file/],
  ["wrong top folder", [{ name: "other/x.flac", data: blob }], /unsafe entry/],
  ["oversized size", [{ name: "harp/x.flac", data: blob, size: 0x7fffffff }], /past the archive's real length/],
]) {
  const e = await runFail(["get", "harp"], evilDist(`dist-evil-${label.replace(/\W+/g, "-")}`, entries));
  assert.match(String(e.stderr), re, `${label}: expected refusal via ${re}`);
  assert(!existsSync(join(install, "harp")), `${label}: nothing installed`);
}
assert(!existsSync(join(root, "evil.flac")), "traversal payload never escaped");
assert(!existsSync(join(install, "evil.flac")), "traversal payload never reached the install");
assert(!existsSync("/tmp/evil.flac"), "absolute payload never written");
noLeftovers();
ok("tar escapes refused: ../, absolute, backslash, link, wrong top, oversized size");

// tampered index: pinned sha256 does not match
{
  const e = await runFail(["get", "harp"], { ANIDOODLE_SOUNDS_INDEX_SHA256: "0".repeat(64) });
  assert.match(String(e.stderr), /tampered index/, "index pin enforced");
}
noLeftovers();
ok("tampered index refused before any download");

// the REAL pinned hash path: no override at all, so the hard-coded INDEX_SHA256 is consulted.
// Negative leg first - the tiny index cannot match the release pin and must be refused.
{
  const e = await runFail(["get", "harp"], { ANIDOODLE_SOUNDS_INDEX_SHA256: "" });
  assert.match(String(e.stderr), /tampered index/, "without the override the release pin guards the index");
}
ok("no env override: the compiled-in pin is what refuses");

// Positive leg, when the real release dist is on this machine: fetch through the actual pin.
// the maintainer's built pack, when ANIDOODLE_SOUNDPACK_DIR points at the sound-pack work folder (skipped otherwise)
const REAL_DIST = join(process.env.ANIDOODLE_SOUNDPACK_DIR ?? "/nonexistent", "dist-v1");
if (existsSync(join(REAL_DIST, INDEX))) {
  const installReal = join(root, "install-real");
  let e = null;
  try {
    await run(["get", "marimba"], { ANIDOODLE_SOUNDS: installReal, ANIDOODLE_SOUNDS_URL: REAL_DIST, ANIDOODLE_SOUNDS_INDEX_SHA256: "" });
  } catch (x) {
    e = x;
  }
  assert.equal(e, null, "get marimba through the real pin succeeded");
  const m = JSON.parse(readFileSync(join(installReal, "manifest.json"), "utf8"));
  assert(Object.hasOwn(m.instruments, "marimba"), "marimba installed via the pinned index");
  ok("real pinned hash path: get marimba installs without any override");
} else {
  console.log("SKIP real pinned hash path (dist-v1 not on this machine)");
}

// oversized index: over the cap, refused before the hash is even compared
{
  const distBig = join(root, "dist-bigindex");
  cpSync(dist, distBig, { recursive: true });
  writeFileSync(join(distBig, INDEX), Buffer.alloc(9 * 1024 * 1024, 0x20));
  const e = await runFail(["get", "harp"], { ANIDOODLE_SOUNDS_URL: distBig, ANIDOODLE_SOUNDS_INDEX_SHA256: sha(join(distBig, INDEX)) });
  assert.match(String(e.stderr), /index cap/, "oversized index refused");
}
ok("oversized index refused before parsing");

// malformed index fields, reachable only with the pin overridden: an archive name that is not
// the release's own, and a zone file escaping its instrument dir
for (const [label, mutate, re] of [
  ["bad archive name", (ix) => { ix.archives.find((a) => a.instruments.includes("harp")).file = "../../etc/harp.tar"; }, /unsafe archive name/],
  ["bad zone file", (ix) => { ix.archives.find((a) => a.instruments.includes("harp")).manifest.instruments.harp.zones[0].file = "../x.flac"; }, /unsafe zone/],
]) {
  const d = join(root, `dist-ix-${label.replace(/\W+/g, "-")}`);
  cpSync(dist, d, { recursive: true });
  const ix = JSON.parse(readFileSync(join(d, INDEX), "utf8"));
  mutate(ix);
  writeFileSync(join(d, INDEX), JSON.stringify(ix, null, 2) + "\n");
  const e = await runFail(["get", "harp"], { ANIDOODLE_SOUNDS_URL: d, ANIDOODLE_SOUNDS_INDEX_SHA256: sha(join(d, INDEX)) });
  assert.match(String(e.stderr), re, `${label}: shape check refuses`);
}
ok("index shape checks: archive name and zone file validated");

// over-long stream: the server keeps sending past the declared bytes - the download is cut
{
  const server = createServer((req, res) => {
    const name = decodeURIComponent(req.url.split("?")[0].slice(1));
    const f = join(dist, name);
    if (!name || !existsSync(f)) { res.writeHead(404); return void res.end(); }
    const data = name.includes("harp") ? Buffer.concat([readFileSync(f), Buffer.of(0xaa)]) : readFileSync(f);
    res.writeHead(200, { "content-length": data.length });
    res.end(data);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  try {
    const e = await runFail(["get", "harp"], { ANIDOODLE_SOUNDS_URL: `http://127.0.0.1:${server.address().port}/` });
    assert.match(String(e.stderr ?? e.stdout), /more than the declared|bytes/, "over-long stream cut");
  } finally {
    server.close();
  }
  assert(!existsSync(join(install, "harp")));
  noLeftovers();
}
ok("over-long stream cut at the declared bytes");

// interrupted download: a live http server drops the connection mid-body
const server = createServer((req, res) => {
  const name = decodeURIComponent(req.url.split("?")[0].slice(1));
  const f = join(dist, name);
  if (!name || !existsSync(f)) { res.writeHead(404); return void res.end(); }
  const data = readFileSync(f);
  res.writeHead(200, { "content-length": data.length });
  if (name.includes("harp")) { res.write(data.subarray(0, data.length >> 1)); return void res.socket.destroy(); }
  res.end(data);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
try {
  const e = await runFail(["get", "harp"], { ANIDOODLE_SOUNDS_URL: `http://127.0.0.1:${server.address().port}/` });
  assert(e, "interrupted download fails");
} finally {
  server.close();
}
assert.deepEqual(Object.keys(merged().instruments), ["piano"], "old install untouched");
noLeftovers();
assert((await run(["verify"])).includes("all sha256 match"), "previous state still verifies");
ok("interrupted download leaves the old install working");

// ---------------------------------------------------------------- two parallel gets
await Promise.all([run(["get", "harp"]), run(["get", "rooms"])]);
{
  const m = merged();
  assert(Object.hasOwn(m.instruments, "harp"), "parallel get: harp landed");
  assert.equal(Object.keys(m.rooms ?? {}).length, 1, "parallel get: rooms landed");
  assert(existsSync(join(install, "harp")) && existsSync(join(install, "rooms")), "both trees on disk");
}
noLeftovers();
ok("two parallel gets: both archives land, one merged manifest");

// ---------------------------------------------------------------- get all to finish
const out = await run(["get", "all"]);
assert(out.includes("already installed"), "installed ids skipped");
assert.deepEqual(Object.keys(merged().instruments).sort(), ["harp", "piano"]);
assert((await run(["verify"])).includes("all sha256 match"));
const list2 = await run(["list"]);
assert(!list2.includes("available"), "everything installed");
ok("get all: skips installed, installs the rest, merged manifest verifies");

{ // the offer is made once: list says to ask, decline is remembered, a later get clears it
  const home = join(dir, "decline-home"), e = { HOME: home, ANIDOODLE_SOUNDS: join(home, "pack") };
  mkdirSync(home, { recursive: true });
  assert((await run(["list"], e)).includes("ASK THE USER"));
  await run(["decline"], e);
  assert(existsSync(join(home, ".anidoodle", "sounds-declined")));
  assert((await run(["list"], e)).includes("declined by the user"));
  await run(["get", "harp"], e);
  assert(!existsSync(join(home, ".anidoodle", "sounds-declined")));
  ok("offer, decline, later yes: asked once, remembered, cleared by get");
}

console.log(`\n${pass} checks passed`);
