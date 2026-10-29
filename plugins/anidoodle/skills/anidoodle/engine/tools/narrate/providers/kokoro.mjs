// Kokoro (hexgrad/kokoro, Apache-2.0 code and weights), local and offline, only when a CLI is on PATH:
// `kokoro-tts` (pip install kokoro-tts; usage `kokoro-tts in.txt out.wav --voice af_heart --speed 1`).
// voice: { name: "af_heart", speed: 1, lang: "en-us" }
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { which } from "./util.mjs";

export const id = "kokoro", cloud = false;
export const about = "Kokoro (local, Apache-2.0)";
const cli = () => which("kokoro-tts") ?? which("kokoro");
export const available = () => (cli() ? { ok: true } : { ok: false, why: "no kokoro CLI on PATH. Get one with `pipx install kokoro-tts` (it downloads the Apache-2.0 Kokoro-82M model and voices on first run), then check `kokoro-tts --help`" });
export const synth = async ({ text, voice = {}, raw }) => {
  const txt = raw + ".txt", out = raw + ".wav";
  writeFileSync(txt, text);
  execFileSync(cli(), [txt, out, "--voice", String(voice.name ?? "af_heart"), "--speed", String(voice.speed ?? 1), ...(voice.lang ? ["--lang", String(voice.lang)] : [])], { stdio: ["ignore", "ignore", "pipe"] });
  return out;
};
