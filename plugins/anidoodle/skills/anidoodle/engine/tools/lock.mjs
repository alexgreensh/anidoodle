// node tools/lock.mjs <film> --shot <id>          print the approval sha of a shot (every frame hashed)
// node tools/lock.mjs <film> [--unlock a,b]       check every approved shot (meta.motion.approved) still draws the same
// APPROVED SHOTS STAY APPROVED. On a brand launch film the logo shot the director approved ("the elements flying
// together, rotating. It was actually good") was replaced by a "better" idea while iterating, and had to
// be rebuilt exactly. Once a shot is approved its sha goes in the film:
//   meta.motion.approved: [["logo", "<sha>", "director 2026-10-27 16:50"]]
// and any change to its frames fails here until it is unlocked on purpose (--unlock logo), which is the
// moment to ask the person again. The sha is over every frame's pixel hash, drawn sharp in the page.
// Exit 0 pass, 1 a locked shot changed (or is missing), 2 usage.
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { buildPage } from "./build-page.mjs";
import { detect } from "./detect.mjs";
import * as playwright from "./adapters/playwright.mjs";
import { requireFilm } from "./names.mjs";
import { isMain } from "./is-main.mjs";

/** The approval sha of each shot asked for: sha256 over the pixel hash of every frame, in order. */
export const shotShas = async (film, ids) => {
  const page = await buildPage({ entry: `src/hosts/page-${film}.ts`, out: resolve(`dist/${film}.html`), title: film });
  const s = await playwright.open(detect(), page.out, { workers: 1, bakeCache: false }), meta = await s.info(), out = {};
  try {
    for (const id of ids) {
      const shot = meta.shots.find((x) => x.id === id); if (!shot) { out[id] = { missing: true, shots: meta.shots.map((x) => x.id) }; continue; }
      const h = createHash("sha256"); for (let f = shot.start; f < shot.end; f++) h.update(`${f - shot.start}:${await s.hash(f)}\n`);
      out[id] = { sha: h.digest("hex").slice(0, 16), frames: shot.end - shot.start };
    }
  } finally { await s.close(); }
  return { meta, shas: out };
};

/** Check every approved shot. Returns { checked: [{ shot, status: "same" | "changed" | "missing" | "unlocked", ... }], fail }. */
// `approved` overrides the film's own list (the self-test checks a live sha and a wrong one without editing a film)
export const checkLocks = async (film, { unlock = [], approved: given } = {}) => {
  let approved = given;
  if (!approved) { const page = await buildPage({ entry: `src/hosts/page-${film}.ts`, out: resolve(`dist/${film}.html`), title: film }); const s0 = await playwright.open(detect(), page.out, { workers: 1, bakeCache: false }); approved = (await s0.info()).motion?.approved ?? []; await s0.close(); }
  if (!approved.length) return { checked: [], fail: false, none: true };
  const { shas } = await shotShas(film, approved.map(([id]) => id)), checked = [];
  for (const [shot, sha, note] of approved) {
    const got = shas[shot];
    if (unlock.includes(shot)) checked.push({ shot, status: "unlocked", note, sha: got.sha });
    else if (got.missing) checked.push({ shot, status: "missing", note, shots: got.shots });
    else checked.push({ shot, status: got.sha === sha ? "same" : "changed", note, sha: got.sha, want: sha });
  }
  return { checked, fail: checked.some((c) => c.status === "changed" || c.status === "missing") };
};

if (isMain(import.meta.url)) {
  const pos = [], opt = {};
  for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith("--")) opt[a.slice(2)] = process.argv[++i]; else pos.push(a); }
  const usage = "node tools/lock.mjs <film> --shot <id>   |   node tools/lock.mjs <film> [--unlock a,b]";
  const film = requireFilm(pos[0], "lock", usage);
  if (opt.shot) {
    const { shas } = await shotShas(film, String(opt.shot).split(","));
    for (const [id, r] of Object.entries(shas)) { if (r.missing) { console.error(`lock: no shot "${id}"; this film's shots are ${r.shots.join(", ")}`); process.exit(2); } console.log(`${id}: ${r.sha} (${r.frames} frames)\n  meta.motion.approved: [["${id}", "${r.sha}", "<who approved it, when>"]]`); }
    process.exit(0);
  }
  const r = await checkLocks(film, { unlock: opt.unlock ? String(opt.unlock).split(",") : [] });
  if (r.none) { console.log("LOCKS: N/A   no approved shots (meta.motion.approved); lock one with --shot <id> once the person approves it"); process.exit(0); }
  for (const c of r.checked) console.log(`  ${c.status === "same" ? "PASS" : c.status === "unlocked" ? "NOTE" : "FAIL"}  ${c.shot} (${c.note}): ${c.status === "same" ? "unchanged" : c.status === "unlocked" ? `unlocked for this run, now ${c.sha}: show the person before re-approving` : c.status === "missing" ? `no such shot any more (shots: ${c.shots.join(", ")})` : `CHANGED (${c.sha}, approved ${c.want}): restore it, or ask the person and run with --unlock ${c.shot}`}`);
  console.log(`LOCKS: ${r.fail ? "FAIL" : "PASS"}`);
  process.exit(r.fail ? 1 : 0);
}
