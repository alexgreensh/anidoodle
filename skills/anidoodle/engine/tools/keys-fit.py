#!/usr/bin/env python3
# Needs numpy (offline research tool, not used by renders): pip install numpy
"""Offline "measured physics" fitter for the keys voices (piano, mallets, organ).

    python3 tools/keys-fit.py <VCSL root> [--json out.json]

Reads CC0 recordings from a local checkout of VCSL (github.com/sgossner/VCSL, CC0 1.0) and fits the
small numeric tables in src/canvas-core/music/keysTables.ts: per-note inharmonicity B and f0 (least
squares on (f_n/n)^2 = f0^2 + f0^2 B n^2), per-partial attack level (dB re partial 1) and a two-stage
decay per partial (prompt slope over the first ~10 dB, aftersound slope later), and for idiophones the
partial ratios and T60s. Nothing recorded is copied into the engine; only these numbers are. numpy only.
"""
import json, os, re, sys, wave
import numpy as np

NOTE = {"C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11}


def midi_of(name, octave_offset=12):
    m = re.match(r"([A-G]#?)(-?\d)", name)
    return NOTE[m.group(1)] + (int(m.group(2)) + 1) * 12 + (octave_offset - 12)


def load(path):
    w = wave.open(path)
    sr, sw, ch, n = w.getframerate(), w.getsampwidth(), w.getnchannels(), w.getnframes()
    raw = w.readframes(n)
    if sw == 2:
        x = np.frombuffer(raw, dtype="<i2").astype(np.float64) / 32768
    else:
        b = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 3)
        v = (b[:, 0].astype(np.int32) | (b[:, 1].astype(np.int32) << 8) | (b[:, 2].astype(np.int32) << 16))
        v = np.where(v >= 1 << 23, v - (1 << 24), v)
        x = v.astype(np.float64) / (1 << 23)
    x = x.reshape(-1, ch).mean(axis=1)
    return x, sr


def onset(x):
    a = np.abs(x)
    thr = 0.1 * a.max()
    return int(np.argmax(a > thr))


def spectrum(seg, sr, pad=4):
    N = len(seg)
    win = np.hanning(N)
    nfft = 1 << int(np.ceil(np.log2(N * pad)))
    S = np.abs(np.fft.rfft(seg * win, nfft))
    return S, sr / nfft


def peak_near(S, df, f, tol):
    lo, hi = max(1, int((f - tol) / df)), min(len(S) - 2, int((f + tol) / df) + 1)
    if hi <= lo:
        return None
    k = lo + int(np.argmax(S[lo:hi]))
    a, b, c = np.log(S[k - 1] + 1e-12), np.log(S[k] + 1e-12), np.log(S[k + 1] + 1e-12)
    d = 0.5 * (a - c) / (a - 2 * b + c) if (a - 2 * b + c) != 0 else 0
    return (k + d) * df, float(np.exp(b - 0.25 * (a - c) * d))


def tone_track(x, sr, f, hop, win):
    """Level (dB) of one frequency over time: a Hann-windowed single-bin DFT per frame."""
    n = len(x)
    frames = (n - win) // hop
    if frames < 2:
        return np.array([])
    w = np.hanning(win)
    ph = np.exp(-2j * np.pi * f * np.arange(win) / sr) * w
    out = np.empty(frames)
    for i in range(frames):
        s = x[i * hop:i * hop + win]
        out[i] = 20 * np.log10(abs(np.dot(s, ph)) * 2 / w.sum() + 1e-12)
    return out


def fit_string(path, midi):
    x, sr = load(path)
    i0 = onset(x)
    x = x[i0:]
    f_nom = 440 * 2 ** ((midi - 69) / 12)
    dur = min(len(x) / sr - 0.1, max(1.0, 3.0 * (262 / f_nom) ** 0.5))
    seg = x[int(0.03 * sr):int((0.03 + dur) * sr)]
    S, df = spectrum(seg, sr)
    # comb search: the (f0, B) whose predicted partials sit on the most spectral energy (log), then a
    # least-squares refinement on the peaks found near the prediction
    logS = np.log(S + 1e-9 * S.max())
    def score(f0, B):
        tot, cnt = 0.0, 0
        for n in range(1, 40):
            fn = n * f0 * np.sqrt(1 + B * n * n)
            if fn > min(0.45 * sr, 9000):
                break
            k = int(round(fn / df))
            tot += logS[max(0, k - 1):k + 2].max(); cnt += 1
        return tot / max(cnt, 1) if cnt >= 3 else -1e9
    best = (-1e18, f_nom, 3e-4)
    for c in np.arange(-60, 61, 4):
        for B in np.geomspace(2e-5, 3e-2, 60):
            sc = score(f_nom * 2 ** (c / 1200), B)
            if sc > best[0]:
                best = (sc, f_nom * 2 ** (c / 1200), B)
    _, f0, B = best
    for it in range(2):
        found = []
        for n in range(1, 60):
            fn = n * f0 * np.sqrt(1 + B * n * n)
            if fn > min(0.45 * sr, 12000):
                break
            pk = peak_near(S, df, fn, min(0.08 * f0, 25))
            if pk:
                found.append((n, pk[0], pk[1]))
        if len(found) < 3:
            break
        nn = np.array([p[0] for p in found], float)
        ff = np.array([p[1] for p in found])
        A = np.vstack([np.ones_like(nn), nn * nn]).T
        wts = 1 / nn
        c, *_ = np.linalg.lstsq(A * wts[:, None], (ff / nn) ** 2 * wts, rcond=None)
        f0 = float(np.sqrt(max(c[0], 1)))
        B = float(max(c[1] / c[0], 1e-6))
    # attack levels from the first 60 ms (dB re partial 1) and per-partial decays
    hop, win = int(0.01 * sr), int(max(0.04, 6 / f0) * sr)
    partials = []
    for n in range(1, 121):
        fn = n * f0 * np.sqrt(1 + B * n * n)
        if fn > min(0.45 * sr, 12000):
            break
        tr = tone_track(x, sr, fn, hop, win)
        if len(tr) < 10:
            continue
        t = np.arange(len(tr)) * hop / sr + win / 2 / sr
        peak_i = int(np.argmax(tr[: int(0.15 * sr / hop) + 1]))
        L0 = tr[peak_i]
        floor = np.percentile(tr, 3)
        # prompt: slope over the first 12 dB (or 0.8 s); aftersound: slope after that down to floor + 8 dB
        idx = np.arange(peak_i, len(tr))
        def slope(sel):
            if len(sel) < 4:
                return None
            p = np.polyfit(t[sel], tr[sel], 1)
            return p
        drop = tr[idx] < L0 - 12
        k12 = idx[np.argmax(drop)] if drop.any() else idx[-1]
        k12 = min(k12, peak_i + int(0.8 * sr / hop))
        pp = slope(np.arange(peak_i + 1, max(k12, peak_i + 5)))
        late = np.arange(k12, len(tr))
        late = late[tr[late] > floor + 8]
        pa = slope(late) if len(late) > 20 else None
        partials.append({"n": n, "f": round(fn, 2), "L0": round(float(L0), 2),
                         "promptDbS": None if pp is None else round(float(pp[0]), 2),
                         "afterDbS": None if pa is None else round(float(pa[0]), 2),
                         "afterAt0Db": None if pa is None else round(float(pa[1] - L0), 2)})
    L1 = partials[0]["L0"] if partials else 0
    for p in partials:
        p["rel"] = round(p["L0"] - L1, 2)
    # attack centroid (first 100 ms) and the attack's inharmonic "noise" floor between partials
    a = x[: int(0.1 * sr)]
    Sa, dfa = spectrum(a, sr, 2)
    fr = np.arange(len(Sa)) * dfa
    cen = float((Sa * fr).sum() / Sa.sum())
    return {"midi": midi, "f0": round(f0, 3), "B": B, "cents": round(1200 * np.log2(f0 / f_nom), 2), "centroid100ms": round(cen, 1), "partials": partials}


def fit_bar(path, f_nom, maxRatio=40):
    """Idiophone: the strongest peaks, their ratios to the fundamental and their T60s."""
    x, sr = load(path)
    x = x[onset(x):]
    seg = x[int(0.005 * sr):int(min(len(x) / sr - 0.05, 1.5) * sr)]
    S, df = spectrum(seg, sr)
    f0 = peak_near(S, df, f_nom, 0.06 * f_nom)[0]
    Sd = 20 * np.log10(S / S.max() + 1e-12)
    # prominent local maxima: above -55 dB and 12 dB over the local median
    from numpy.lib.stride_tricks import sliding_window_view as swv
    W = max(5, int(40 / df)) | 1
    med = np.median(swv(np.pad(Sd, W // 2, mode="edge"), W), axis=1)
    pk = [k for k in range(2, len(S) - 2) if Sd[k] > -55 and Sd[k] - med[k] > 12 and S[k] == S[k - 2:k + 3].max() and k * df > 0.8 * f0 and k * df < min(maxRatio * f0, 18000)]
    pk.sort(key=lambda k: -S[k])
    modes = []
    hop, win = int(0.005 * sr), int(max(0.02, 8 / f0) * sr)
    for k in pk[:24]:
        f = peak_near(S, df, k * df, 2 * df)[0]
        if any(abs(f - m["f"]) < 0.01 * f for m in modes):
            continue
        tr = tone_track(x, sr, f, hop, win)
        t = np.arange(len(tr)) * hop / sr
        i = int(np.argmax(tr[:40]))
        floor = np.percentile(tr, 5)
        sel = np.arange(i, len(tr))
        sel = sel[tr[sel] > max(floor + 6, tr[i] - 40)]
        sel = sel[: np.argmax(np.diff(sel) > 1) + 1] if len(sel) > 1 and (np.diff(sel) > 1).any() else sel
        slope = np.polyfit(t[sel], tr[sel], 1)[0] if len(sel) > 5 else None
        modes.append({"f": round(f, 2), "ratio": round(f / f0, 4), "db": round(float(Sd[k]), 1), "t60": None if not slope or slope >= 0 else round(-60 / slope, 3)})
        if len(modes) >= 12:
            break
    modes.sort(key=lambda m: m["f"])
    return {"f0": round(f0, 2), "modes": modes}


if __name__ == "__main__":
    root = sys.argv[1]
    out = {"source": "VCSL (github.com/sgossner/VCSL), CC0 1.0", "piano": {}, "upright": {}, "bars": {}}
    g = os.path.join(root, "Chordophones/Zithers/Grand Piano, Steinway B/NoSus")
    for fn in sorted(os.listdir(g)):
        m = re.match(r"JHPiano_NoSus_Close_([A-G]#?\d)_vl(\d)_rr1\.wav", fn)
        if not m:
            continue
        midi = midi_of(m.group(1))
        r = fit_string(os.path.join(g, fn), midi)
        r["file"] = fn
        out["piano"][f"{midi}_v{m.group(2)}"] = r
        print(f"grand {m.group(1)} vl{m.group(2)} midi {midi}: f0 {r['f0']} ({r['cents']:+.1f} c) B {r['B']:.2e} partials {len(r['partials'])} centroid {r['centroid100ms']}", file=sys.stderr)
    u = os.path.join(root, "Chordophones/Zithers/Upright Piano, Yamaha/Sustains")
    for fn in sorted(os.listdir(u)):
        m = re.match(r"Upright1_Sus_([A-G]#?\d)_vl(\d)_rr1\.wav", fn)
        if not m:
            continue
        midi = midi_of(m.group(1))
        r = fit_string(os.path.join(u, fn), midi)
        r["file"] = fn
        out["upright"][f"{midi}_v{m.group(2)}"] = r
        print(f"upright {m.group(1)} midi {midi}: f0 {r['f0']} ({r['cents']:+.1f} c) B {r['B']:.2e} centroid {r['centroid100ms']}", file=sys.stderr)
    bars = {
        "glock": ("Idiophones/Struck Idiophones/Glockenspiel", r"glock_(loud|medium)_([A-G]#?\d)_01\.wav", 24),
        "marimba": ("Idiophones/Struck Idiophones/Marimba", r"Marimba_hit_Outrigger_([A-G]#?\d)_(loud|med)_01\.wav", 24),
        "vibes": ("Idiophones/Struck Idiophones/Vibraphone/Hard Mallets", r"Vibes_hard_([A-G]#?\d)_v2_rr1_Main\.wav", 24),
        "chimes": ("Idiophones/Struck Idiophones/Tubular Bells 1", r"chimes_([A-G]#?\d)_ff_rr\d\.wav", 12),
        "organ": ("Aerophones/Edge-blown Aerophones/Pipe Organ", None, 40),
    }
    for name, (d, pat, mr) in bars.items():
        base = os.path.join(root, d)
        for dp, _, fs in os.walk(base):
            for fn in sorted(fs):
                if not fn.endswith(".wav"):
                    continue
                notes = re.findall(r"_([A-G]#?\d)[_.]", fn)
                if not notes:
                    continue
                midi = midi_of(notes[0])
                r = fit_bar(os.path.join(dp, fn), 440 * 2 ** ((midi - 69) / 12), mr)
                r["file"] = fn
                out["bars"][f"{name}:{fn}"] = r
                print(f"{name} {fn}: f0 {r['f0']} modes {[(m['ratio'], m['db'], m['t60']) for m in r['modes']]}", file=sys.stderr)
    if "--json" in sys.argv:
        json.dump(out, open(sys.argv[sys.argv.index("--json") + 1], "w"), indent=1)
