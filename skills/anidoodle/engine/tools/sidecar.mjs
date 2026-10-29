// SIDECAR. A rendered file says which film it is in <file>.film.json beside it, so a file that has been
// renamed or versioned (out/brandLaunch-v12.mp4 from the film brandHook) still resolves. On a brand launch film verify-export inferred the film from the file name, failed with "unknown film
// 'brandFilm-v2-frozen'", and was never run again. Tools read the sidecar first, the name second.
// render.mjs writes it after the encode ({ film, file, sha256, frames: [from, to], scale, blur, poster, meta }).
//   readSidecar(file)          -> the record, or null when there is none
//   filmOfFile(file, known)    -> { film, how } | { film: null, why } (sidecar, then the name, then nothing)
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";

export const sidecarPath = (file) => `${file}.film.json`;
const sha = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");

/** The sidecar beside `file`, with `stale: true` when the file changed after it was written. */
export const readSidecar = (file) => {
  const p = sidecarPath(file); if (!existsSync(p)) return null;
  try { const rec = JSON.parse(readFileSync(p, "utf8")); return { ...rec, stale: existsSync(file) && rec.sha256 ? rec.sha256 !== sha(file) : false }; } catch (e) { return { error: `unreadable sidecar ${p}: ${e.message}` }; }
};

/** Which film a file is: its sidecar, else its name (out/<film>[.<from>-<to>].<ext>). `known` lists the films that exist. */
export const filmOfFile = (file, known) => {
  const sc = readSidecar(file);
  if (sc?.film) return { film: sc.film, how: sc.stale ? "sidecar (STALE: the file changed after render wrote it)" : "sidecar", sidecar: sc };
  const byName = basename(file).split(".")[0];
  if (known.includes(byName)) return { film: byName, how: "file name" };
  return { film: null, why: `'${basename(file)}' has no sidecar (${basename(sidecarPath(file))}) and its name is not a film. Name the film: node tools/verify-export.mjs <film> --file ${file}` };
};

/**
 * EXTERNAL MUSIC PROVENANCE (X3). A film whose music is a supplied or generated track declares the
 * track's manifest (meta.checks.music.track: the <take>.track.json that `track.mjs import` writes, with
 * its sha256, provider, cost and licence). The delivered file's mix sidecar (<file>.mix.json, written by
 * `track.mjs mix` and copied by `master`) must have been made from that take: its music is the take
 * itself, or a bar cut whose <cut>.cut.json names the take's sha256 as its source. The mix must also
 * have been made from the cue sheet as it is now (cuesSha256), so the effects are on the current frames.
 * -> { ok, detail }
 */
export const trackProvenance = (trackJson, file) => {
  if (!existsSync(trackJson)) return { ok: false, detail: `no track manifest ${trackJson}: pin the take with node tools/track.mjs import <take> --provider ...` };
  let man, mix; try { man = JSON.parse(readFileSync(trackJson, "utf8")); } catch (e) { return { ok: false, detail: `unreadable ${trackJson}: ${e.message}` }; }
  if (!man.sha256 || !man.provider) return { ok: false, detail: `${trackJson} has no sha256 or provider` };
  const mixJson = `${file}.mix.json`;
  if (!existsSync(mixJson)) return { ok: false, detail: `no mix sidecar ${basename(mixJson)}: master the file with node tools/track.mjs master <picture> <mix.wav> -o ${basename(file)}` };
  try { mix = JSON.parse(readFileSync(mixJson, "utf8")); } catch (e) { return { ok: false, detail: `unreadable ${mixJson}: ${e.message}` }; }
  // The effects in the mix land on the cue sheet it was made from: a sheet changed since then (or a mix
  // record that never named its sheet) is a stale mix, whatever the music says.
  if (!mix.cuesSha256 || !mix.cues) return { ok: false, detail: `${basename(mixJson)} names no cue sheet, so the effects in the mix cannot be checked: re-mix with node tools/track.mjs mix --cues out/<film>.cues.json` };
  if (!existsSync(mix.cues)) return { ok: false, detail: `the cue sheet the mix was made from (${basename(String(mix.cues))}) is gone: export it (node tools/cues.mjs <film>) and re-mix` };
  if (sha(mix.cues) !== mix.cuesSha256) return { ok: false, detail: `the cue sheet ${basename(String(mix.cues))} changed after the mix was made, so its effects land on the old frames: re-mix (node tools/track.mjs mix ...) and master again` };
  if (mix.musicSha256 === man.sha256) return { ok: true, detail: `the mix plays the pinned take itself (${man.provider}${man.licence ? `, ${man.licence}` : ""})` };
  const cutJson = `${mix.music}.cut.json`;
  if (!existsSync(cutJson)) return { ok: false, detail: `the mix's music ${basename(String(mix.music))} is not the pinned take and has no cut record (${basename(cutJson)})` };
  const cut = JSON.parse(readFileSync(cutJson, "utf8"));
  if (cut.sourceSha256 !== man.sha256) return { ok: false, detail: `the mix was cut from a different take (sha ${String(cut.sourceSha256).slice(0, 12)}, the manifest pins ${man.sha256.slice(0, 12)})` };
  if (existsSync(mix.music) && sha(mix.music) !== mix.musicSha256) return { ok: false, detail: `the cut ${basename(mix.music)} changed after the mix was made: re-mix` };
  return { ok: true, detail: `the mix plays a bar cut of the pinned take (${man.provider}${man.licence ? `, ${man.licence}` : ""}${man.costUsd != null ? `, $${man.costUsd}` : ""})` };
};
