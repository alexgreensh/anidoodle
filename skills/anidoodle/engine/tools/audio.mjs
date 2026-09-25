// Interleaved stereo Float32 transport stays unclipped until the final AAC encoder.
export const float32Wav = ({ sampleRate, frames, float32 }) => {
  const pcm = Buffer.from(float32, "base64");
  if (!Number.isSafeInteger(sampleRate) || sampleRate < 1 || pcm.length !== frames * 8) throw new Error("invalid stereo Float32 audio payload");
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVEfmt ", 8);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(3, 20); h.writeUInt16LE(2, 22);
  h.writeUInt32LE(sampleRate, 24); h.writeUInt32LE(sampleRate * 8, 28);
  h.writeUInt16LE(8, 32); h.writeUInt16LE(32, 34);
  h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
};
