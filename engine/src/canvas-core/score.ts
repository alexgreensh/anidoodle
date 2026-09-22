// A tiny pure-JS score for the fixtures film: plucks on the beat, a bell on the last cut.
// No Web Audio, no Node APIs: just maths into two Float32Arrays, so it runs under ANY backend.
export const fixturesScore = (fps: number, bpm: number, frames: number) => (sr: number): [Float32Array, Float32Array] => {
  const n = Math.ceil((frames / fps) * sr), L = new Float32Array(n), R = new Float32Array(n), beat = 60 / bpm;
  const note = (t0: number, hz: number, dur: number, gain: number, pan: number, bell = false) => {
    const i0 = Math.floor(t0 * sr), len = Math.floor(dur * sr);
    for (let i = 0; i < len && i0 + i < n; i++) { const t = i / sr, env = Math.exp(-t * (bell ? 2.2 : 7)) * Math.min(1, t * 400), v = (Math.sin(2 * Math.PI * hz * t) + (bell ? 0.5 * Math.sin(2 * Math.PI * hz * 2.76 * t) + 0.25 * Math.sin(2 * Math.PI * hz * 5.4 * t) : 0.3 * Math.sin(2 * Math.PI * hz * 2 * t))) * env * gain; L[i0 + i] += v * (1 - pan); R[i0 + i] += v * pan; }
  };
  const scale = [261.63, 329.63, 392.0, 329.63, 293.66, 349.23, 440.0, 349.23, 392.0, 523.25];
  for (let b = 0; b * beat < frames / fps; b++) { note(b * beat, scale[b % scale.length], 0.5, 0.22, 0.35 + 0.3 * (b % 2)); if (b % 2 === 0) note(b * beat, scale[b % scale.length] / 2, 0.7, 0.16, 0.5); }
  note(6 * beat, 1046.5, 2.2, 0.2, 0.5, true); // DING on the cut into the last shot
  for (let i = 0; i < n; i++) { L[i] = Math.tanh(L[i] * 1.4); R[i] = Math.tanh(R[i] * 1.4); }
  return [L, R];
};
