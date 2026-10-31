import { rng } from "../core";
import { SVF, Biquad } from "./dsp";
import { Bus, buf, secs, filt, pink, white } from "./sfxCore";
import { smallRoom } from "./roomSmall";

export type PhysicsKind = "click" | "pop" | "pop-in" | "whoosh-short" | "whoosh-long" | "dark-riser" | "impact" | "cut-hit" | "sub-drop" | "typing" | "notification" | "toggle-on" | "toggle-off";
export const PHYSICS_KINDS: PhysicsKind[] = ["click", "pop", "pop-in", "whoosh-short", "whoosh-long", "dark-riser", "impact", "cut-hit", "sub-drop", "typing", "notification", "toggle-on", "toggle-off"];
export type PhysicsOptions = { seed?: number; lengthS?: number; pitch?: number; keyHz?: number; dir?: 1 | -1 };
const tau = Math.PI * 2;
const env = (t: number, attack: number, hold: number, decay: number) => t < 0 ? 0 : t < attack ? (1 - Math.cos(Math.PI * t / attack)) / 2 : t < attack + hold ? 1 : Math.exp(-(t - attack - hold) / decay);
// Raised-cosine contact force drives second-order damped resonators.
const strike = (sr: number, n: number, f: number, ratios: number[], decay: number, contact: number, r: () => number) => {
  const out = buf(n), count = Math.max(2, secs(sr, contact));
  for (let k = 0; k < ratios.length; k++) {
    const freq = f * ratios[k] * (1 + (r() - 0.5) * 0.006), rad = Math.exp(-1 / (sr * decay / Math.sqrt(ratios[k]))), a = 2 * rad * Math.cos(tau * freq / sr), b = rad * rad;
    let y1 = 0, y2 = 0;
    for (let i = 0; i < n; i++) { const force = i < count ? (1 - Math.cos(tau * i / count)) / count : 0; const y = a * y1 - b * y2 + force; y2 = y1; y1 = y; out[i] += y / (1 + k * 0.9); }
  }
  return out;
};
const room = (bus: Bus, input: Float64Array, seed: number, mix = 0.08) => {
  const [l, r] = smallRoom(input, input, bus.sr, { rt60: 0.22, size: 0.4, er: 0.55, late: 0.55, predelay: 0.004, hp: 600, lp: 9500, damp: 6500, seed });
  bus.add2(l, r, 0, mix);
};
const click = (bus: Bus, at: number, sr: number, r: () => number, freq = 2200, gain = 1) => {
  const n = secs(sr, 0.065), snap = white(r, n), grit = white(r, n);
  filt(snap, sr, { hp: 2500, lp: 11000 }); filt(grit, sr, { bp: 4600, q: 0.8 });
  for (let i = 0; i < n; i++) { const t = i / sr; snap[i] *= env(t, 0.0002, 0, 0.0006); grit[i] *= env(t, 0.0003, 0, 0.002); }
  const tink = strike(sr, n, freq, [1, 1.62, 2.16], 0.005, 0.0003, r), body = strike(sr, n, 550, [1, 1.7], 0.009, 0.001, r);
  const transient = buf(n); for (let i = 0; i < n; i++) transient[i] = snap[i] * 0.4 + grit[i] * 0.1;
  bus.add(transient, at, gain); bus.add(tink, at, gain * 0.5); bus.add(body, at, gain * 0.1);
  return transient;
};
export const makePhysics = (kind: PhysicsKind, options: PhysicsOptions, sr: number) => {
  const seed = options.seed ?? 1, r = rng(seed), pitch = Math.pow(2, (options.pitch ?? 0) / 12), length = options.lengthS ?? (kind === "whoosh-short" ? 0.55 : kind === "whoosh-long" ? 1.2 : kind === "dark-riser" ? 2 : kind === "typing" ? 1.3 : kind === "impact" ? 3.8 : kind === "sub-drop" ? 1.5 : kind === "pop" ? 0.16 : 0.3);
  const n = secs(sr, length + (kind.startsWith("whoosh") ? 0.45 : kind === "typing" ? 0.2 : 0)); const bus = new Bus(sr, n); let hit = 0;
  if (kind === "click" || kind.startsWith("toggle")) {
    const t = click(bus, 0, sr, r); room(bus, t, seed);
    if (kind.startsWith("toggle")) click(bus, secs(sr, 0.052), sr, r, 2200 * (kind === "toggle-on" ? 1.15 : 1 / 1.15), 0.7);
    for (const channel of [bus.L, bus.R]) { const hp = Biquad.make(sr, "hp", 200, 0.707), dip = Biquad.make(sr, "peak", 3200, 1, -3); for (let i = 0; i < n; i++) channel[i] = dip.tick(hp.tick(channel[i])); }
  } else if (kind === "typing") {
    let at = 0, previous = -1;
    while (at < length - 0.14) { let key = Math.floor(r() * 12); if (key === previous) key = (key + 1) % 12; previous = key;
      click(bus, secs(sr, at), sr, r, 1800 + key * 105, 0.65 + r() * 0.25);
      bus.add(strike(sr, secs(sr, 0.055), 1050 + key * 37, [1, 1.23, 1.57, 1.93, 2.35, 2.82, 3.34], 0.0045, 0.000076, r), secs(sr, at), 0.13);
      bus.add(strike(sr, secs(sr, 0.09), 120 + key * 9, [1, 1.8], 0.018, 0.000076, r), secs(sr, at + 0.02), 0.15);
      bus.add(strike(sr, secs(sr, 0.06), 9000, [1], 0.001, 0.000076, r), secs(sr, at + 0.003), 0.008);
      click(bus, secs(sr, at + 0.07 + r() * 0.04), sr, r, 2900 + key * 70, 0.12); at += 0.062 + r() * 0.086;
    }
    const floor = pink(r, n); for (let i = 0; i < n; i++) floor[i] *= 0.0006 * Math.min(1, i / (sr * 0.005)); bus.add(floor);
  } else if (kind === "pop" || kind === "pop-in") {
    const a = buf(n), breath = pink(r, n); let phase = 0;
    filt(breath, sr, { bp: kind === "pop" ? 620 : 1800, q: 0.8 });
    // A 30 ms lead gives the UI cue its measured onset while hit still marks picture sync.
    if (kind === "pop") hit = secs(sr, 0.033);
    for (let i = 0; i < n; i++) { const t = i / sr - (kind === "pop" ? 0.03 : 0); if (t < 0) continue; const e = env(t, kind === "pop" ? 0.024 : 0.004, kind === "pop" ? 0.015 : 0, kind === "pop" ? 0.041 : 0.045);
      const f = kind === "pop" ? 370 * Math.pow(2, 0.7 / 12 * Math.exp(-t / 0.0075)) : 108 * (1 + 0.35 * Math.exp(-t / 0.025)); phase += tau * f * pitch / sr;
      a[i] = e * (Math.sin(phase) + (kind === "pop" ? 0.57 * Math.sin(2 * phase) + 0.35 * Math.sin(3 * phase) + 0.12 * Math.sin(1.72 * phase) : 0)) + breath[i] * e * 0.2 + Math.sin(tau * 129 * t) * env(t, 0.005, 0, 0.025) * 0.16;
    }
    filt(a, sr, { hp: 112, lp: 3500 }); bus.add(a);
    if (kind === "pop-in") click(bus, 0, sr, r, 3500, 0.18);
  } else if (kind.startsWith("whoosh")) {
    const N = secs(sr, length), apex = length * 0.48, source = pink(r, N), sig = buf(N), fs = [new SVF(sr), new SVF(sr), new SVF(sr)], lp = new SVF(sr); hit = secs(sr, apex);
    for (let i = 0; i < N; i++) { const t = i / sr, d = t < apex ? -30 * Math.pow((apex - t) / apex, 0.7) : -30 * Math.pow((t - apex) / (length - apex), 1.3), amp = Math.pow(10, d / 20), wake = t > apex ? Math.pow(2, -0.6 * (1 - Math.exp(-(t - apex) / 0.25))) : 1;
      const f = 420 * (0.35 + 2.5 * Math.sqrt(amp)) * wake * Math.pow(2, -0.35 * Math.tanh((t - apex) / 0.06)); let x = 0;
      for (let j = 0; j < 3; j++) { fs[j].set(f * [1, 1.6, 2.5][j], 1); fs[j].tick(source[i]); x += fs[j].bp / (1 + j); }
      lp.set(f * 4, 0.7); lp.tick(x); sig[i] = lp.lp * amp * Math.min(1, i / (sr * 0.008)) * Math.min(1, (N - i - 1) / (sr * 0.015));
    }
    bus.add(sig, 0, 1, i => (options.dir ?? 1) * 0.06 * Math.tanh((i / sr - apex) / 0.06)); room(bus, sig, seed, 0.06);
  } else if (kind === "dark-riser") {
    const N = secs(sr, length), noise = pink(r, N), sig = buf(N), sv = new SVF(sr, 150, 1); hit = N;
    for (let i = 0; i < N; i++) { const t = i / sr, u = t / length, amp = Math.pow(10, -42 * Math.pow(1 - u, 1.4) / 20); sv.set(150 + 350 * u, 1); sv.tick(noise[i]);
      const back = length - 0.03 - t, phase = tau * (20 * back - 6 * back * back / Math.max(0.001, 0.3 * length - 0.03)); const depth = Math.min(1, Math.max(0, (u - 0.7) * length / 0.02)); const gate = u < 0.7 || back <= 0 ? 1 : 1 - depth * (0.5 - 0.5 * Math.cos(phase));
      sig[i] = amp * (sv.bp + 0.28 * Math.sin(tau * 48 * t)) * gate * Math.min(1, (N - 1 - i) / (sr * 0.025)); }
    bus.add(sig);
  } else if (kind === "impact" || kind === "cut-hit" || kind === "sub-drop") {
    const a = buf(n), noise = pink(r, n); filt(noise, sr, { lp: 140 }); let ph = 0; const root = (options.keyHz ?? 44) * pitch;
    let kickPhase = 0;
    for (let i = 0; i < n; i++) { const t = i / sr, f = kind === "sub-drop" ? root * (1 + 0.45 * Math.exp(-t / 0.75)) : 46 + (kind === "cut-hit" ? 179 : 94) * Math.exp(-t / 0.048); ph += tau * f / sr;
      const e = env(t, 0.003, kind === "sub-drop" ? 0.15 : 0, kind === "sub-drop" ? 0.45 : 0.19); let v = Math.sin(ph) * e;
      if (kind === "cut-hit") { kickPhase += tau * (93 + 82 * Math.exp(-t / 0.04)) / sr; v += 0.5 * Math.sin(kickPhase) * env(t, 0.002, 0, 0.06); }
      if (kind === "sub-drop") for (let h = 2; h <= 6; h++) v += Math.sin(ph * h) * e * 0.23 / h;
      if (kind === "impact") v += noise[i] * 8 * env(t, 0.04, 3.0, 0.18);
      a[i] = v;
    }
    bus.add(a); if (kind !== "sub-drop") {
      bus.add(strike(sr, n, 140, [1, 1.59, 2.14, 2.30], 0.14, 0.001, r), 0, 0.08); click(bus, 0, sr, r, 2200, 0.25);
      if (kind === "impact") { const blast = pink(r, secs(sr, 0.35)); filt(blast, sr, { bp: 900, q: 0.8 }); for (let i = 0; i < blast.length; i++) blast[i] *= env(i / sr, 0.002, 0, 0.06); bus.add(blast, 0, 0.8); room(bus, blast, seed, 0.1); }
    }
  } else {
    const a = strike(sr, n, 1820 * pitch, [1, 3.42, 0.5], 0.14, 0.0003, r);
    for (let i = 0; i < n; i++) { const t = i / sr; a[i] *= (t < 0.032 ? 1 : 0.063 + 0.937 * Math.exp(-(t - 0.032) / 0.002)) * (1 + 0.08 * Math.sin(tau * 24 * t)); } bus.add(a);
  }
  // Fade the constructed end; the audit also examines the pre-fade level separately.
  const fade = Math.min(n, secs(sr, kind === "impact" ? 0.25 : kind === "pop" ? 0.025 : 0.035));
  let peak = 0, tail = 0;
  for (const channel of [bus.L, bus.R]) for (let i = 0; i < n; i++) { const x = Math.abs(channel[i]); peak = Math.max(peak, x); if (i >= Math.max(0, n - fade - secs(sr, 0.005)) && i < n - fade) tail = Math.max(tail, x); }
  const fadeStartDb = 20 * Math.log10(Math.max(tail, 1e-20) / Math.max(peak, 1e-20));
  for (const c of [bus.L, bus.R]) for (let i = 0; i < fade; i++) c[n - 1 - i] *= (1 - Math.cos(Math.PI * i / fade)) / 2;
  return { bus, hit, fadeStartDb };
};
