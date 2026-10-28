// Bring your own recordings: one audio file per line id in voice.dir (relative to the script), named
// <id>.wav (or .aiff, .flac, .mp3, .m4a). Nothing is synthesised; the takes still go through trim,
// level, timing and the round-trip check like any other voice.
import { existsSync } from "node:fs";
import { join } from "node:path";

export const id = "files", cloud = false;
export const about = "your own recordings, one file per line id";
export const available = () => ({ ok: true });
export const synth = async ({ voice = {}, lineId, scriptDir }) => {
  const dir = join(scriptDir, voice.dir ?? "takes");
  for (const ext of ["wav", "aiff", "flac", "mp3", "m4a"]) { const f = join(dir, `${lineId}.${ext}`); if (existsSync(f)) return f; }
  throw new Error(`files: no recording for line '${lineId}' in ${dir} (want ${lineId}.wav)`);
};
