// Google Gemini TTS over REST. CLOUD: the line's text is sent to Google. Key: GEMINI_API_KEY or GOOGLE_API_KEY.
// voice: { name: "Alnilam", style: "a warm storyteller...", model: "gemini-3.8-flash-tts" }
// The request is the one the ghost film recorded with (clawd-ghost-of-last-session/voice/tts.py). Lesson 51:
// this voice dropped an ALL-CAPS word without a sound; write such a word plain, in quotes, and let `check` prove it.
import { writeFileSync } from "node:fs";
import { envKey, pcm16Wav, post } from "./util.mjs";

export const id = "gemini", cloud = true;
export const about = "Google Gemini TTS (cloud: text goes to Google)";
export const available = () => (envKey("GEMINI_API_KEY", "GOOGLE_API_KEY") ? { ok: true } : { ok: false, why: "set GEMINI_API_KEY (or GOOGLE_API_KEY) in the environment" });
export const synth = async ({ text, voice = {}, raw }) => {
  const key = envKey("GEMINI_API_KEY", "GOOGLE_API_KEY"), model = voice.model ?? "gemini-3.8-flash-tts";
  const part = { text, ...(voice.style ? { speech_metadata: { style: voice.style } } : {}) };
  const body = { contents: [{ role: "user", parts: [part] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice.name ?? "Alnilam" } } } } };
  const res = JSON.parse((await post(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, { "Content-Type": "application/json", "x-goog-api-key": key.value }, body, "gemini")).toString("utf8"));
  const data = res?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData?.data;
  if (!data) throw new Error("gemini: the answer carried no audio");
  const audio = Buffer.from(data, "base64"), out = raw + ".wav";
  // Gemini answers raw 24 kHz 16-bit mono PCM (sometimes already a RIFF file)
  writeFileSync(out, audio.subarray(0, 4).toString() === "RIFF" ? audio : pcm16Wav(audio, 24000));
  return out;
};
