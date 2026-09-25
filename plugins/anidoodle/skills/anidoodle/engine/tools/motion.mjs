import { spawn } from "node:child_process";

// Read one small grayscale frame at a time. A ten-minute film must not need a gigabyte buffer.
export const changedArea = async (file, width, height, threshold = 4) => {
  const px = width * height, changed = [0];
  const ff = spawn("ffmpeg", ["-v", "error", "-i", file, "-vf", `scale=${width}:${height}`, "-pix_fmt", "gray", "-f", "rawvideo", "-"]);
  let pending = Buffer.alloc(0), previous = null, error = "";
  ff.stderr.on("data", (chunk) => { error += chunk.toString(); });
  const closed = new Promise((resolve, reject) => { ff.on("error", reject); ff.on("close", (code) => code ? reject(new Error(error || `ffmpeg exited ${code}`)) : resolve()); });
  for await (const chunk of ff.stdout) {
    pending = pending.length ? Buffer.concat([pending, chunk]) : chunk;
    while (pending.length >= px) {
      const frame = pending.subarray(0, px);
      if (previous) { let count = 0; for (let i = 0; i < px; i++) if (Math.abs(frame[i] - previous[i]) > threshold) count++; changed.push(count / px); }
      previous = Buffer.from(frame);
      pending = pending.subarray(px);
    }
  }
  await closed;
  if (pending.length) throw new Error(`incomplete decoded frame: ${pending.length} bytes`);
  return changed;
};
