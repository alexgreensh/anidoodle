// macOS built-in `say`: zero setup, offline, draft quality. Good for timing a cut before a real voice.
// voice: { name: "Samantha", rate: 175 }   (`say -v '?'` lists the voices on this Mac)
import { execFileSync } from "node:child_process";
import { which } from "./util.mjs";

export const id = "say", cloud = false;
export const about = "macOS `say` (offline, draft quality)";
export const available = () => (process.platform === "darwin" && which("say") ? { ok: true } : { ok: false, why: "`say` is macOS only; use kokoro, files or a cloud provider" });
export const synth = async ({ text, voice = {}, raw }) => {
  const out = raw + ".aiff", args = ["-o", out];
  if (voice.name) args.push("-v", String(voice.name));
  if (voice.rate) args.push("-r", String(voice.rate));
  // the text goes in on stdin (`-f -`), never as an argument: a line starting with "-" stays a line
  execFileSync("say", [...args, "-f", "-"], { input: text, stdio: ["pipe", "ignore", "pipe"] });
  return out;
};
