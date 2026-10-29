#!/usr/bin/env python3
# Needs numpy (offline research tool, not used by renders): pip install numpy
"""Anti-MIDI metrics for the keys phrases (research sec. 9.2): per-band inter-channel correlation
(< 0.9 above 500 Hz = real width; ~1 below 120 Hz = mono lows), click detector (sample steps far above the
local signal), spectral flux in sustains (a static oscillator is ~flat). numpy only.
    python3 tools/keys-metrics.py <dir with before-*.wav / after-*.wav>
"""
import os, sys, wave, numpy as np

def load(p):
    w = wave.open(p); x = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(float).reshape(-1, 2) / 32768
    return x[:, 0], x[:, 1], w.getframerate()

def band(x, sr, lo, hi):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / sr); X[(f < lo) | (f >= hi)] = 0; return np.fft.irfft(X, len(x))

def corr(a, b):
    return float(np.dot(a, b) / (np.sqrt(np.dot(a, a) * np.dot(b, b)) + 1e-20))

def clicks(x, sr):
    """Impulsive steps: |2nd difference| more than 12x its own local RMS (10 ms). Steady bright tones do not count."""
    d2 = np.abs(np.diff(x, 2)); w = int(0.01 * sr)
    loc = np.sqrt(np.convolve(d2 * d2, np.ones(w) / w, mode="same")) + 1e-6
    hits = np.where((d2 > 12 * loc) & (d2 > 1e-3))[0]
    return int(np.sum(np.diff(hits) > int(0.005 * sr)) + (1 if len(hits) else 0))

def flux(x, sr):
    n = 2048; fr = [np.abs(np.fft.rfft(x[i:i + n] * np.hanning(n))) for i in range(0, len(x) - n, 1024)]
    fr = np.array(fr); fr /= fr.sum(axis=1, keepdims=True) + 1e-12
    return float(np.mean(np.abs(np.diff(fr, axis=0)).sum(axis=1)))

d = sys.argv[1]
print(f"{'phrase':28} {'ICC<120':>8} {'ICC.5-2k':>9} {'ICC>2k':>8} {'clicks':>7} {'flux':>6}")
for fn in sorted(os.listdir(d)):
    if not fn.endswith(".wav") or not (fn.startswith("before-") or fn.startswith("after-")): continue
    L, R, sr = load(os.path.join(d, fn))
    row = [corr(band(L, sr, a, b), band(R, sr, a, b)) for a, b in [(20, 120), (500, 2000), (2000, 16000)]]
    print(f"{fn[:-4]:28} {row[0]:8.2f} {row[1]:9.2f} {row[2]:8.2f} {clicks((L + R) / 2, sr):7d} {flux((L + R) / 2, sr):6.3f}")
