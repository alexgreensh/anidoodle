// Shared bits for the providers: PATH lookup, a key read from the environment (never printed), and a
// POST that returns bytes and reports a failure WITHOUT echoing headers (the key lives there).
import { spawnSync } from "node:child_process";

export const which = (cmd) => { const r = spawnSync("/usr/bin/env", ["which", cmd], { encoding: "utf8" }); return r.status === 0 ? r.stdout.trim() : null; };
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
