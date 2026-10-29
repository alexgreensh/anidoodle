// macOS built-in `say`: zero setup, offline, draft quality. Good for timing a cut before a real voice.
// DRAFTS ONLY: Apple's macOS licence allows the system voices for personal, non-commercial content.
// Never publish or commit a `say` take; re-voice with kokoro, files or a cloud provider before shipping.
// voice: { name: "Samantha", rate: 175 }   (`say -v '?'` lists the voices on this Mac)
import { execFileSync } from "node:child_process";
import { which } from "./util.mjs";

export const id = "say", cloud = false;
export const about = "macOS `say` (offline, draft quality; Apple licenses the voices for personal, non-commercial use, so re-voice before publishing)";
export const available = () => (process.platform === "darwin" && which("say") ? { ok: true } : { ok: false, why: "`say` is macOS only; use kokoro, files or a cloud provider" });
export const synth = async ({ text, voice = {}, raw }) => {
  const out = raw + ".aiff", args = ["-o", out];
  if (voice.name) args.push("-v", String(voice.name));
  if (voice.rate) args.push("-r", String(voice.rate));
  // the text goes in on stdin (`-f -`), never as an argument: a line starting with "-" stays a line
  execFileSync("say", [...args, "-f", "-"], { input: text, stdio: ["pipe", "ignore", "pipe"] });
  return out;
};
