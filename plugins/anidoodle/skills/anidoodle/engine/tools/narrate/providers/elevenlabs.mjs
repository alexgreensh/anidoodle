// ElevenLabs text to speech. CLOUD: the line's text is sent to ElevenLabs. Key: ELEVENLABS_API_KEY.
// voice: { id: "<voice_id>", model: "eleven_multilingual_v2", stability: 0.5, similarity: 0.75, seed: 7 }
import { writeFileSync } from "node:fs";
import { envKey, pcm16Wav, post } from "./util.mjs";

export const id = "elevenlabs", cloud = true;
export const about = "ElevenLabs (cloud: text goes to ElevenLabs)";
export const available = () => (envKey("ELEVENLABS_API_KEY") ? { ok: true } : { ok: false, why: "set ELEVENLABS_API_KEY in the environment" });
export const synth = async ({ text, voice = {}, raw }) => {
  const key = envKey("ELEVENLABS_API_KEY");
  if (!voice.id) throw new Error("elevenlabs: voice.id (a voice_id from your ElevenLabs voice library) is required");
  const body = { text, model_id: voice.model ?? "eleven_multilingual_v2", voice_settings: { stability: voice.stability ?? 0.5, similarity_boost: voice.similarity ?? 0.75 }, ...(voice.seed !== undefined ? { seed: voice.seed } : {}) };
  // pcm_24000: raw 16-bit mono, no codec in the way
  const pcm = await post(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice.id)}?output_format=pcm_24000`, { "Content-Type": "application/json", "xi-api-key": key.value }, body, "elevenlabs");
  const out = raw + ".wav"; writeFileSync(out, pcm16Wav(pcm, 24000)); return out;
};
