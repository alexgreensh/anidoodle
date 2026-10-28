#!/usr/bin/env python3
# Needs numpy (offline research tool, not used by renders): pip install numpy
"""Spectral A/B of rendered piano notes vs the CC0 VCSL Steinway B (offline, numpy only).

    python3 tools/keys-compare.py <VCSL root> <probe dir>   (probe dir holds old-<note>_vl<k>.wav / v2-<note>_vl<k>.wav)

Per note: partial-envelope error (mean |dB| over partials 1-20 above -60 dB), log-mel distance over the first
3 s (loudness-normalised, dB), spectral-centroid trajectory error (first 2 s, cents), fundamental aftersound T60.
Gate on moving TOWARD the reference, not on matching it (research sec. 9.1).
"""
import importlib.util, os, sys, numpy as np
spec = importlib.util.spec_from_file_location("kf", os.path.join(os.path.dirname(__file__), "keys-fit.py")); kf = importlib.util.module_from_spec(spec); spec.loader.exec_module(kf)

def mel_fb(sr, nfft, nm=48, fmin=40, fmax=12000):
    mel = lambda f: 2595 * np.log10(1 + f / 700); imel = lambda m: 700 * (10 ** (m / 2595) - 1)
    pts = imel(np.linspace(mel(fmin), mel(fmax), nm + 2)); bins = np.fft.rfftfreq(nfft, 1 / sr)
    fb = np.zeros((nm, len(bins)))
    for i in range(nm):
        a, c, b = pts[i], pts[i + 1], pts[i + 2]
        fb[i] = np.clip(np.minimum((bins - a) / (c - a), (b - bins) / (b - c)), 0, None)
    return fb

def logmel(x, sr, secs=3.0):
    x = x[kf.onset(x):][: int(secs * sr)]
    x = np.pad(x, (0, max(0, int(secs * sr) - len(x))))
    nfft, hop = 2048, 882
    fb = mel_fb(sr, nfft)
    frames = [x[i:i + nfft] * np.hanning(nfft) for i in range(0, len(x) - nfft, hop)]
    S = np.abs(np.fft.rfft(np.array(frames), axis=1)) ** 2
    M = 10 * np.log10(fb @ S.T + 1e-10)
    return M - M.max()

def centroid_traj(x, sr, secs=2.0):
    x = x[kf.onset(x):][: int(secs * sr)]
    out = []
    for i in range(0, len(x) - 4096, 2205):
        s = np.abs(np.fft.rfft(x[i:i + 4096] * np.hanning(4096))); f = np.fft.rfftfreq(4096, 1 / sr)
        out.append((s * f).sum() / (s.sum() + 1e-12))
    return np.array(out)

def env(r):
    return np.array([p["rel"] for p in r["partials"][:20]])

if __name__ == "__main__":
    root, probe = sys.argv[1], sys.argv[2]
    ref_dir = os.path.join(root, "Chordophones/Zithers/Grand Piano, Steinway B/NoSus")
    rows = []
    for fn in sorted(os.listdir(probe)):
        if not fn.startswith("v2-") or not fn.endswith(".wav"): continue
        tag = fn[3:-4]; note, vl = tag.split("_")
        ref = os.path.join(ref_dir, f"JHPiano_NoSus_Close_{note}_{vl}_rr1.wav")
        if not os.path.exists(ref): continue
        midi = kf.midi_of(note)
        rr = kf.fit_string(ref, midi); xr, sr = kf.load(ref); Mr = logmel(xr, sr); Cr = centroid_traj(xr, sr)
        res = {}
        for which in ["old", "v2"]:
            p = os.path.join(probe, f"{which}-{tag}.wav")
            if not os.path.exists(p): continue
            r = kf.fit_string(p, midi); x, _ = kf.load(p)
            a, b = env(r), env(rr); k = min(len(a), len(b)); sel = (b[:k] > -60) | (a[:k] > -60)
            envErr = float(np.mean(np.abs(np.maximum(a[:k][sel], -60) - np.maximum(b[:k][sel], -60))))
            Mx = logmel(x, sr); mel = float(np.mean(np.abs(np.maximum(Mx, -80) - np.maximum(Mr, -80))))
            C = centroid_traj(x, sr); kk = min(len(C), len(Cr)); cen = float(np.mean(np.abs(1200 * np.log2(C[:kk] / Cr[:kk]))))
            t60 = [pp["afterDbS"] for pp in r["partials"][:2] if pp["afterDbS"]]
            res[which] = (envErr, mel, cen, -60 / np.mean(t60) if t60 else None, r["B"])
        t60r = [pp["afterDbS"] for pp in rr["partials"][:2] if pp["afterDbS"]]
        rows.append((tag, res, -60 / np.mean(t60r) if t60r else None, rr["B"]))
    print(f"{'note':9} {'env dB old->new':>16} {'log-mel dB old->new':>20} {'centroid c old->new':>21} {'T60 s old/new/ref':>20}  B new/ref")
    tot = {"old": np.zeros(3), "v2": np.zeros(3)}
    for tag, res, t60r, Br in rows:
        o, v = res.get("old"), res.get("v2")
        f = lambda x: "-" if x is None else f"{x:.1f}"
        print(f"{tag:9} {o[0]:7.1f} -> {v[0]:5.1f}   {o[1]:8.1f} -> {v[1]:6.1f}   {o[2]:8.0f} -> {v[2]:6.0f}    {f(o[3])}/{f(v[3])}/{f(t60r)}   {v[4]:.1e}/{Br:.1e}")
        for w in tot: tot[w] += np.array(res[w][:3])
    n = len(rows)
    print(f"{'MEAN':9} {tot['old'][0]/n:7.1f} -> {tot['v2'][0]/n:5.1f}   {tot['old'][1]/n:8.1f} -> {tot['v2'][1]/n:6.1f}   {tot['old'][2]/n:8.0f} -> {tot['v2'][2]/n:6.0f}")
