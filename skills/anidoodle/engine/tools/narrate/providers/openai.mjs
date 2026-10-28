// OpenAI speech endpoint. CLOUD: the line's text is sent to OpenAI. Key: OPENAI_API_KEY.
// voice: { name: "alloy", model: "gpt-4o-mini-tts", instructions: "calm, warm", speed: 1 }
import { writeFileSync } from "node:fs";
import { envKey, post } from "./util.mjs";

export const id = "openai", cloud = true;
export const about = "OpenAI speech (cloud: text goes to OpenAI)";
export const available = () => (envKey("OPENAI_API_KEY") ? { ok: true } : { ok: false, why: "set OPENAI_API_KEY in the environment" });
export const synth = async ({ text, voice = {}, raw }) => {
  const key = envKey("OPENAI_API_KEY");
  const body = { model: voice.model ?? "gpt-4o-mini-tts", voice: voice.name ?? "alloy", input: text, response_format: "wav", ...(voice.instructions ? { instructions: voice.instructions } : {}), ...(voice.speed ? { speed: voice.speed } : {}) };
  const out = raw + ".wav";
  writeFileSync(out, await post("https://api.openai.com/v1/audio/speech", { "Content-Type": "application/json", Authorization: `Bearer ${key.value}` }, body, "openai"));
  return out;
};
