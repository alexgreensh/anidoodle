// Shared bits for the providers: PATH lookup, a key read from the environment (never printed), and a
// POST that returns bytes and reports a failure WITHOUT echoing headers (the key lives there).
import { accessSync, constants, statSync } from "node:fs";
import { delimiter, join } from "node:path";

/**
 * A program's full path from the PATH, or null. Read in node rather than by running `which`, which
 * Windows does not have: there every PATHEXT ending (.EXE, .CMD, ...) is tried, and a folder with a space
 * is just a folder. `o` overrides the PATH, PATHEXT and platform (the tests use it).
 */
export const which = (cmd, o = {}) => {
  const win = o.win ?? process.platform === "win32", path = o.path ?? process.env.PATH ?? process.env.Path ?? "";
  const exts = win ? [...String(o.pathext ?? process.env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM").split(";").filter(Boolean)] : [""];
  for (const dir of path.split(delimiter).filter(Boolean)) for (const e of exts) {
    const f = join(dir.replace(/^"(.*)"$/, "$1"), cmd + e);
    try { if (!statSync(f).isFile()) continue; if (!win) accessSync(f, constants.X_OK); return f; } catch { /* not here */ }
  }
  return null;
};
export const envKey = (...names) => { for (const n of names) if (process.env[n]?.trim()) return { name: n, value: process.env[n].trim() }; return null; };
export const post = async (url, headers, body, what) => {
  const r = await fetch(url, { method: "POST", headers, body: typeof body === "string" ? body : JSON.stringify(body) });
  if (!r.ok) { const t = (await r.text()).slice(0, 400).replace(/[A-Za-z0-9_-]{32,}/g, "<redacted>"); throw new Error(`${what}: HTTP ${r.status} ${t}`); }
  return Buffer.from(await r.arrayBuffer());
};
// raw 16-bit little-endian mono PCM -> a WAV container ffmpeg can read
export const pcm16Wav = (pcm, sr, ch = 1) => {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVEfmt ", 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(ch, 22);
  h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 2 * ch, 28); h.writeUInt16LE(2 * ch, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
};
