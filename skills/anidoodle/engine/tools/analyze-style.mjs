// ANALYZE A STYLE. Read a reference image the user brought and print what its HAND is doing:
// palette, value, line, fill texture, stroke length, speckle, halftone, edges, then the nearest
// existing plates with reasons.
//
//   node tools/analyze-style.mjs <image> [--json out/profile.json] [--max 1400] [--signatures tools/style-signatures.json]
//   node tools/analyze-style.mjs --calibrate <plate-still.png>... --out tools/style-signatures.json
//
// READ THIS BEFORE TRUSTING A NUMBER. Every statistic here measures the PICTURE, and a picture is
// subject + composition + lighting + medium all at once. A reference that is mostly empty paper
// reads "light key, few edges" whatever hand drew it; text reads as "line". These are
// DIAGNOSTICS that tell you where to look, never a verdict. The verdict is the medium recipe you
// write in words and a side-by-side of a DIFFERENT subject drawn in that hand
// (references/workflows/adapt-a-style.md). Nothing here can certify "not a copy" either: that is
// the no-copy rule, kept by construction (new subject, new composition), not by a threshold.
//
// Tools read the reference; the art core never does. Decoding goes through ffmpeg (raw RGBA),
// so any still ffmpeg reads works: png, jpg, webp, a frame of an mp4 (--frame N).
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const VAL = new Set(["json", "max", "signatures", "out", "frame", "exclude", "crop"]);
const pos = [], opt = {};
for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith("--")) opt[a.slice(2)] = VAL.has(a.slice(2)) ? process.argv[++i] : true; else pos.push(a); }
const die = (m) => { console.error(`analyze-style: ${m}`); process.exit(1); };
if (!pos.length) die("usage: node tools/analyze-style.mjs <image> [--json out.json] | --calibrate <stills...> --out tools/style-signatures.json");

// ---------------------------------------------------------------- decode
const decode = (file) => {
  if (!existsSync(file)) die(`no such file: ${file}`);
  const probe = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", file]).toString().trim().split("\n")[0].split(",").map(Number);
  let [w, h] = probe; if (!w || !h) die(`ffprobe could not size ${file}`);
  if (opt.crop) { const c = opt.crop.split(",").map(Number); w = c[2]; h = c[3]; }
  const vf = [opt.frame ? `select=eq(n\\,${Number(opt.frame)})` : "", opt.crop ? `crop=${opt.crop.split(",").slice(2, 4).join(":")}:${opt.crop.split(",").slice(0, 2).join(":")}` : ""].filter(Boolean), pre = vf.length ? ["-vf", vf.join(",")] : [];
  const raw = execFileSync("ffmpeg", ["-v", "error", "-i", file, ...pre, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgba", "-"], { maxBuffer: 1 << 30 });
  if (raw.length < w * h * 4) die(`decoded ${raw.length} bytes, expected ${w * h * 4}`);
  return { w, h, rgba: raw, sha256: createHash("sha256").update(readFileSync(file)).digest("hex") };
};

// ---------------------------------------------------------------- colour science (OKLab, Ottosson 2020)
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const LIN = Float32Array.from({ length: 256 }, (_, i) => lin(i));
const toLab = (r, g, b) => {
  const R = LIN[r], G = LIN[g], B = LIN[b];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B), m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B), s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
};
const toRgb = (L, a, b) => {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const R = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, G = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, B = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const e = (c) => Math.round(255 * Math.max(0, Math.min(1, c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)));
  return [e(R), e(G), e(B)];
};
const hex = ([r, g, b]) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// ---------------------------------------------------------------- image plumbing
const toPlanes = ({ w, h, rgba }) => { // composite alpha over white, then OKLab planes
  const n = w * h, L = new Float32Array(n), A = new Float32Array(n), B = new Float32Array(n);
  for (let i = 0; i < n; i++) { const al = rgba[i * 4 + 3] / 255, f = (c) => Math.round(c * al + 255 * (1 - al)); const [l, a, b] = toLab(f(rgba[i * 4]), f(rgba[i * 4 + 1]), f(rgba[i * 4 + 2])); L[i] = l; A[i] = a; B[i] = b; }
  return { w, h, L, A, B };
};
const shrink = (P, max) => { // area-average down so the long side is <= max
  const k = Math.max(1, Math.ceil(Math.max(P.w, P.h) / max)); if (k === 1) return { ...P, k: 1 };
  const w = Math.floor(P.w / k), h = Math.floor(P.h / k), out = { w, h, k, L: new Float32Array(w * h), A: new Float32Array(w * h), B: new Float32Array(w * h) };
  for (const ch of ["L", "A", "B"]) { const s = P[ch], d = out[ch]; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let t = 0; for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) t += s[(y * k + j) * P.w + x * k + i]; d[y * w + x] = t / (k * k); } }
  return out;
};
const boxBlur = (src, w, h, r, passes = 3) => { // three box passes ~ a gaussian, separable, edge-clamped
  let a = Float32Array.from(src), b = new Float32Array(src.length);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) { let s = 0; for (let i = -r; i <= r; i++) s += a[y * w + Math.min(w - 1, Math.max(0, i))]; for (let x = 0; x < w; x++) { b[y * w + x] = s / (2 * r + 1); s += a[y * w + Math.min(w - 1, x + r + 1)] - a[y * w + Math.max(0, x - r)]; } }
    for (let x = 0; x < w; x++) { let s = 0; for (let i = -r; i <= r; i++) s += b[Math.min(h - 1, Math.max(0, i)) * w + x]; for (let y = 0; y < h; y++) { a[y * w + x] = s / (2 * r + 1); s += b[Math.min(h - 1, y + r + 1) * w + x] - b[Math.max(0, y - r) * w + x]; } }
  }
  return a;
};
const bilin = (F, w, h, x, y) => { x = Math.max(0, Math.min(w - 1.001, x)); y = Math.max(0, Math.min(h - 1.001, y)); const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, i = y0 * w + x0; return F[i] * (1 - fx) * (1 - fy) + F[i + 1] * fx * (1 - fy) + F[i + w] * (1 - fx) * fy + F[i + w + 1] * fx * fy; };
const pct = (arr, q) => { const s = Float32Array.from(arr).sort(); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : NaN; };
const median = (arr) => pct(arr, 0.5);
const r2 = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
// image-convention angle: 0 = horizontal, +45 = rising to the right (y is down in pixels)
const angOf = (dx, dy) => { let a = (-Math.atan2(dy, dx) * 180) / Math.PI; while (a <= -90) a += 180; while (a > 90) a -= 180; return a; };

// ---------------------------------------------------------------- 1. palette: k-means in OKLab
const palette = (P, keep, K = 8) => {
  const n = P.w * P.h, step = Math.max(1, Math.floor(n / 60000)), S = [];
  for (let i = 0; i < n; i += step) if (keep[i]) S.push([P.L[i], P.A[i], P.B[i]]);
  const r = rng(7), d2 = (p, c) => (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
  const C = [S[Math.floor(r() * S.length)].slice()]; // k-means++
  while (C.length < K) { const D = S.map((p) => Math.min(...C.map((c) => d2(p, c)))), tot = D.reduce((a, b) => a + b, 0); let t = r() * tot, i = 0; while (i < D.length - 1 && (t -= D[i]) > 0) i++; C.push(S[i].slice()); }
  const lab = new Int32Array(S.length);
  for (let it = 0; it < 25; it++) {
    const sum = C.map(() => [0, 0, 0, 0]);
    S.forEach((p, i) => { let best = 0, bd = 1e9; C.forEach((c, k) => { const d = d2(p, c); if (d < bd) { bd = d; best = k; } }); lab[i] = best; const s = sum[best]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++; });
    sum.forEach((s, k) => { if (s[3]) C[k] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; });
  }
  let cl = C.map((c, k) => ({ lab: c, share: 0, k })); lab.forEach((k) => cl[k].share++); cl.forEach((c) => (c.share /= S.length));
  // merge near-duplicates (dE_ok < 0.035): k is an upper bound, not a claim about the palette
  cl.sort((a, b) => b.share - a.share); const out = [];
  for (const c of cl) { const m = out.find((o) => Math.sqrt(d2(o.lab, c.lab)) < 0.035); if (m) { const t = m.share + c.share; m.lab = m.lab.map((v, i) => (v * m.share + c.lab[i] * c.share) / t); m.share = t; } else out.push({ ...c }); }
  return out.filter((c) => c.share > 0.002).map((c) => { const [L, a, b] = c.lab, C2 = Math.hypot(a, b); return { hex: hex(toRgb(L, a, b)), L: r2(L), C: r2(C2, 3), hue: Math.round(((Math.atan2(b, a) * 180) / Math.PI + 360) % 360), share: r2(c.share, 3) }; }).sort((a, b) => b.share - a.share);
};

// ---------------------------------------------------------------- 2..8: the measurements
const analyze = (file) => {
  const img = decode(file), full = toPlanes(img), P = shrink(full, Number(opt.max ?? 1400)), { w, h } = P, n = w * h, short = Math.min(w, h);
  // --exclude "x,y,w,h;x,y,w,h" (reference px, after --crop): UI, captions, a photo pasted in: things that are not the hand
  const rects = (opt.exclude ? String(opt.exclude).split(";") : []).map((r) => r.split(",").map(Number)).filter((r) => r.length === 4);
  const keep = new Uint8Array(n).fill(1); for (const [rx, ry, rw, rh] of rects) for (let y = Math.max(0, Math.floor(ry / P.k)); y < Math.min(h, Math.ceil((ry + rh) / P.k)); y++) for (let x = Math.max(0, Math.floor(rx / P.k)); x < Math.min(w, Math.ceil((rx + rw) / P.k)); x++) keep[y * w + x] = 0;
  const kept = []; for (let i = 0; i < n; i++) if (keep[i]) kept.push(i); const nk = kept.length || 1;
  const clear = boxBlur(Float32Array.from(keep), w, h, 6, 1); // a margin round every excluded box: its border is not the hand either
  const ok = (i) => clear[i] > 0.999;
  const L = P.L, Lk = Float32Array.from(kept, (i) => L[i]);
  const pal = palette(P, keep);
  // paper: the biggest field if it dominates, else the biggest LIGHT field; ink: the darkest colour that is really used
  const light = pal.filter((c) => c.L > 0.72), paper = pal[0].share > 0.3 ? pal[0] : (light.sort((a, b) => b.share - a.share)[0] ?? pal[0]);
  const inks = pal.filter((c) => c !== paper && c.share > 0.004).sort((a, b) => a.L - b.L), ink = inks[0] ?? pal[pal.length - 1];
  let chromaSum = 0, chromaN = 0; for (const i of kept) { const c = Math.hypot(P.A[i], P.B[i]); if (Math.abs(P.L[i] - paper.L) > 0.04 || Math.abs(c - paper.C) > 0.02) { chromaSum += c; chromaN++; } }

  // value
  const hist = [0, 0, 0, 0, 0]; for (const v of Lk) hist[Math.min(4, Math.floor(v * 5))]++;
  const meanL = Lk.reduce((a, b) => a + b, 0) / nk, p03 = pct(Lk, 0.03), p97 = pct(Lk, 0.97);
  const value = { key: meanL > 0.75 ? "high" : meanL > 0.5 ? "middle" : "low", meanL: r2(meanL), contrast: r2(p97 - p03), p03: r2(p03), p97: r2(p97), bands: hist.map((v) => r2(v / nk)), bandsNote: "share of pixels in L 0-.2, .2-.4, .4-.6, .6-.8, .8-1" };

  // gradients on a lightly smoothed L
  const Ls = boxBlur(L, w, h, 1, 1), gx = new Float32Array(n), gy = new Float32Array(n), gm = new Float32Array(n);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; gx[i] = (Ls[i + 1] - Ls[i - 1]) / 2; gy[i] = (Ls[i + w] - Ls[i - w]) / 2; gm[i] = Math.hypot(gx[i], gy[i]); }

  // edges: transition width = contrast across the edge / gradient at the edge (a step is ~2 px wide at pixel scale)
  const edgeMask = new Uint8Array(n); let hard = 0, soft = 0, lost = 0, rim = 0, rimN = 0;
  for (let y = 9; y < h - 9; y++) for (let x = 9; x < w - 9; x++) {
    const i = y * w + x, g = gm[i]; if (g < 0.012 || !ok(i)) continue;
    const nx = gx[i] / g, ny = gy[i] / g; if (g < bilin(gm, w, h, x + nx, y + ny) || g < bilin(gm, w, h, x - nx, y - ny)) continue; // thin to the ridge
    const hi = bilin(Ls, w, h, x + nx * 8, y + ny * 8), lo = bilin(Ls, w, h, x - nx * 8, y - ny * 8), dL = hi - lo; if (dL < 0.05) continue;
    edgeMask[i] = 1; const width = dL / g;
    if (width < 2.6) hard++; else if (width < 7) soft++; else lost++;
    // pooled rim: on the dark side, is the band right at the edge darker than the body further in?
    if (dL > 0.07) { rimN++; if (bilin(Ls, w, h, x - nx * 10, y - ny * 10) - bilin(Ls, w, h, x - nx * 3, y - ny * 3) > 0.012) rim++; }
  }
  const eN = hard + soft + lost || 1;
  const near = boxBlur(Float32Array.from(edgeMask), w, h, 3, 1); // "near an edge" = inside 3 px of one
  const edges = { density: r2(eN / nk, 4), hard: r2(hard / eN), soft: r2(soft / eN), lost: r2(lost / eN), pooledRim: rimN > 30 ? r2(rim / rimN) : null, note: "hard < 2.6 px transition, soft 2.6-7, lost > 7 (at analysis size); pooledRim = share of strong edges whose dark side is darkest AT the edge (watercolour pigment settling)" };

  // line: thin marks darker than their surroundings, width from the shorter run through each line pixel
  const bg = boxBlur(L, w, h, Math.max(4, Math.round(short / 60))), lineMask = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (bg[i] - L[i] > 0.09) lineMask[i] = 1;
  const runH = new Uint16Array(n), runV = new Uint16Array(n);
  for (let y = 0; y < h; y++) { let x = 0; while (x < w) { if (!lineMask[y * w + x]) { x++; continue; } let e = x; while (e < w && lineMask[y * w + e]) e++; for (let k = x; k < e; k++) runH[y * w + k] = e - x; x = e; } }
  for (let x = 0; x < w; x++) { let y = 0; while (y < h) { if (!lineMask[y * w + x]) { y++; continue; } let e = y; while (e < h && lineMask[e * w + x]) e++; for (let k = y; k < e; k++) runV[k * w + x] = e - y; y = e; } }
  const widths = []; let thin = 0; const thinMax = Math.max(3, short * 0.012);
  for (let i = 0; i < n; i++) if (lineMask[i] && ok(i)) { const wd = Math.min(runH[i], runV[i]); if (wd <= thinMax) { thin++; if (i % 3 === 0) widths.push(wd); } }
  const line = { presence: r2(thin / nk, 4), widthMedianPx: widths.length ? r2(median(widths) * P.k, 1) : null, widthP90Px: widths.length ? r2(pct(widths, 0.9) * P.k, 1) : null, widthVariation: widths.length ? r2((pct(widths, 0.9) - pct(widths, 0.1)) / Math.max(1, median(widths))) : null, note: "presence = share of pixels in thin dark marks; lettering counts as line; widths in reference pixels" };

  // fill texture: structure tensor of the fine grain, AWAY from edges
  const hp = new Float32Array(n); { const b2 = boxBlur(L, w, h, 2); for (let i = 0; i < n; i++) hp[i] = L[i] - b2[i]; }
  // the tensor is built on the GRAIN (L minus its blur), not on L: a smooth wash gradient is perfectly
  // "coherent" and says nothing about which way the pencil or brush moved
  const Jxx = new Float32Array(n), Jxy = new Float32Array(n), Jyy = new Float32Array(n);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x, hx = (hp[i + 1] - hp[i - 1]) / 2, hy = (hp[i + w] - hp[i - w]) / 2; Jxx[i] = hx * hx; Jxy[i] = hx * hy; Jyy[i] = hy * hy; }
  const tw = Math.max(4, Math.round(short / 120)), bxx = boxBlur(Jxx, w, h, tw), bxy = boxBlur(Jxy, w, h, tw), byy = boxBlur(Jyy, w, h, tw);
  const bins = new Float64Array(36); let cohSum = 0, cohW = 0, cohHigh = 0, cohN = 0; const interior = new Uint8Array(n);
  for (let y = 6; y < h - 6; y += 2) for (let x = 6; x < w - 6; x += 2) {
    const i = y * w + x; if (near[i] > 0.02 || lineMask[i] || !ok(i)) continue; const tr = bxx[i] + byy[i]; if (tr < 4e-7) continue; // below that there is no grain to have a direction
    interior[i] = 1; const coh = Math.sqrt((bxx[i] - byy[i]) ** 2 + 4 * bxy[i] ** 2) / tr, th = 0.5 * Math.atan2(2 * bxy[i], bxx[i] - byy[i]); // gradient direction; strokes run across it
    const sa = angOf(-Math.sin(th), Math.cos(th)), b = Math.min(35, Math.floor((sa + 90) / 5)), wt = coh * Math.sqrt(tr);
    bins[b] += wt; cohSum += coh * Math.sqrt(tr); cohW += Math.sqrt(tr); cohN++; if (coh > 0.5) cohHigh++;
  }
  let pk = 0; bins.forEach((v, i) => { if (v > bins[pk]) pk = i; }); const tot = bins.reduce((a, b) => a + b, 0) || 1; let near15 = 0; for (let d = -3; d <= 3; d++) near15 += bins[(pk + d + 36) % 36];
  const dom = pk * 5 - 90 + 2.5, u = [Math.cos((dom * Math.PI) / 180), -Math.sin((dom * Math.PI) / 180)];
  // stroke length: autocorrelation of the grain along the dominant direction versus across it
  const pts = []; for (let i = 0; i < n; i += 7) if (interior[i]) pts.push(i);
  let v0 = 0; pts.forEach((i) => (v0 += hp[i] * hp[i])); v0 = v0 / (pts.length || 1) || 1e-9;
  const corr = (dx, dy) => { let s = 0, c = 0; for (const i of pts) { const x = i % w, y = (i / w) | 0; if (x + dx < 0 || x + dx >= w - 1 || y + dy < 0 || y + dy >= h - 1) continue; s += hp[i] * bilin(hp, w, h, x + dx, y + dy); c++; } return s / (c || 1) / v0; };
  const reach = (vx, vy) => { for (let d = 1; d <= 60; d++) if (corr(vx * d, vy * d) < 0.3) return d; return 60; };
  const along = reach(u[0], u[1]), across = reach(-u[1], u[0]);
  let fine = 0, lightSpeck = 0, darkSpeck = 0; pts.forEach((i) => { fine += hp[i] * hp[i]; if (hp[i] > 0.035) lightSpeck++; if (hp[i] < -0.035) darkSpeck++; });
  const grain = Math.sqrt(fine / (pts.length || 1)) >= 0.006; // below this the "direction" is quantisation noise
  const texture = { sampled: pts.length, grain, dominantStrokeAngle: grain ? r2(dom, 0) : null, peakShare: grain ? r2(near15 / tot) : null, coherence: grain && cohW ? r2(cohSum / cohW) : null, coherentShare: cohN ? r2(cohHigh / cohN) : null, strokeLengthPx: r2(along * P.k, 0), grainWidthPx: r2(across * P.k, 0), elongation: r2(along / across, 1), grainRms: r2(Math.sqrt(fine / (pts.length || 1)), 3), speckleLight: r2(lightSpeck / (pts.length || 1), 3), speckleDark: r2(darkSpeck / (pts.length || 1), 3),
    note: "measured on interior pixels only (no edges, no lines). dominantStrokeAngle 0 = horizontal, +45 = rising right; peakShare = weight within +-15 deg of it (1/12 = no preference); speckleLight = paper showing through the colour (tooth)" };

  // spectrum at FULL resolution: power-law slope + a halftone lattice if there is one
  const spectrum = fftStats(full, rects);
  return { file: basename(file), sha256: img.sha256, size: [img.w, img.h], analysedAt: [w, h], palette: pal, paper: { hex: paper.hex, L: paper.L, share: paper.share }, ink: { hex: ink.hex, L: ink.L, share: ink.share }, chroma: r2(chromaN ? chromaSum / chromaN : 0, 3), colours: pal.filter((c) => c.share > 0.02).length, value, line, texture, edges, spectrum };
};

// ---------------------------------------------------------------- FFT: slope and halftone lattice
const fft1 = (re, im, N) => { // in place, radix 2
  for (let i = 1, j = 0; i < N; i++) { let bit = N >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= N; len <<= 1) { const a = (-2 * Math.PI) / len, wr = Math.cos(a), wi = Math.sin(a); for (let i = 0; i < N; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr; re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } } }
};
const fftStats = (F, rects = []) => {
  for (const N of [256, 128]) { const r = fftAt(F, rects, N); if (r) return r; }
  return { powerSlope: null, halftone: null, note: "no crop of 128 px clear of exclusions: spectrum skipped" };
};
const fftAt = (F, rects, N) => {
  if (F.w < N || F.h < N) return null;
  // pick the four busiest 256 crops (most variance): halftone lives in the inked parts, not the margins
  const cands = []; for (let y = 0; y + N <= F.h; y += N / 2) for (let x = 0; x + N <= F.w; x += N / 2) { if (rects.some(([rx, ry, rw, rh]) => x < rx + rw && x + N > rx && y < ry + rh && y + N > ry)) continue; let s = 0, s2 = 0, c = 0; for (let j = 0; j < N; j += 4) for (let i = 0; i < N; i += 4) { const v = F.L[(y + j) * F.w + x + i]; s += v; s2 += v * v; c++; } const m = s / c; cands.push({ x, y, v: s2 / c - m * m }); }
  if (!cands.length) return null;
  cands.sort((a, b) => b.v - a.v); const crops = cands.slice(0, 4), pow = new Float64Array(N * N);
  const han = Float32Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
  for (const c of crops) {
    const re = new Float64Array(N * N), im = new Float64Array(N * N); let m = 0; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) m += F.L[(c.y + j) * F.w + c.x + i]; m /= N * N;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) re[j * N + i] = (F.L[(c.y + j) * F.w + c.x + i] - m) * han[i] * han[j];
    const rr = new Float64Array(N), ii = new Float64Array(N);
    for (let j = 0; j < N; j++) { for (let i = 0; i < N; i++) { rr[i] = re[j * N + i]; ii[i] = im[j * N + i]; } fft1(rr, ii, N); for (let i = 0; i < N; i++) { re[j * N + i] = rr[i]; im[j * N + i] = ii[i]; } }
    for (let i = 0; i < N; i++) { for (let j = 0; j < N; j++) { rr[j] = re[j * N + i]; ii[j] = im[j * N + i]; } fft1(rr, ii, N); for (let j = 0; j < N; j++) pow[j * N + i] += rr[j] * rr[j] + ii[j] * ii[j]; }
  }
  const at = (u, v) => pow[((v + N) % N) * N + ((u + N) % N)];
  const ring = new Float64Array(N / 2), cnt = new Float64Array(N / 2);
  for (let v = -N / 2; v < N / 2; v++) for (let u = -N / 2; u < N / 2; u++) { const r = Math.round(Math.hypot(u, v)); if (r > 0 && r < N / 2) { ring[r] += at(u, v); cnt[r]++; } }
  // slope of log power against log frequency, 4..100 cycles: ~-2 natural/soft, flatter = grainy/noisy, steeper = smooth washes
  let sx = 0, sy = 0, sxx = 0, sxy = 0, k = 0; for (let r = Math.round(N / 64); r <= Math.round(N * 0.39); r++) { const x = Math.log(r), y = Math.log(ring[r] / cnt[r] + 1e-12); sx += x; sy += y; sxx += x * x; sxy += x * y; k++; }
  const slope = (k * sxy - sx * sy) / (k * sxx - sx * sx);
  // halftone: a lattice is isolated peaks far above their own ring, at two angles 90 (or 60) degrees apart
  const peaks = [];
  for (let v = -N / 2 + 1; v < N / 2 - 1; v++) for (let u = 1; u < N / 2 - 1; u++) {
    const r = Math.hypot(u, v); if (r < N * 0.047 || r > N * 0.46) continue; const p = at(u, v), base = ring[Math.round(r)] / cnt[Math.round(r)];
    if (p < base * 25) continue; let isMax = true; for (let dv = -1; dv <= 1 && isMax; dv++) for (let du = -1; du <= 1; du++) if ((du || dv) && at(u + du, v + dv) > p) { isMax = false; break; }
    if (isMax && Math.abs(u) > 1 && Math.abs(v) > 1) peaks.push({ u, v, r, ratio: p / base }); // skip the axes: window leakage and ruled lines live there
  }
  peaks.sort((a, b) => b.ratio - a.ratio);
  let lattice = null;
  if (peaks.length >= 2) { const a = peaks[0], b = peaks.slice(1).find((q) => Math.abs(q.r - a.r) / a.r < 0.12 && Math.abs(((Math.atan2(q.v, q.u) - Math.atan2(a.v, a.u)) * 180) / Math.PI) % 180 > 50); if (b) lattice = { pitchPx: r2(N / a.r, 1), angles: [angOf(a.u, a.v), angOf(b.u, b.v)].map((x) => r2(x, 0)), strength: r2(Math.min(a.ratio, b.ratio), 0) }; }
  return { powerSlope: r2(slope), halftone: lattice, note: "powerSlope ~ -3 smooth washes, ~ -2 natural texture, flatter than -1.6 grainy/speckled; halftone = FFT lattice (pitch in reference px), null when none" };
};

// ---------------------------------------------------------------- nearest plates
// The features the matcher compares, with the spread over which a difference stops mattering.
const FEATS = { linePresence: 0.05, hard: 0.3, pooledRim: 0.35, coherence: 0.25, peakShare: 0.2, speckleLight: 0.12, chroma: 0.06, paperL: 0.25, contrast: 0.35, colours: 4, halftone: 0.6 };
const featuresOf = (p) => ({ linePresence: p.line.presence, hard: p.edges.hard, pooledRim: p.edges.pooledRim, coherence: p.texture.coherence, peakShare: p.texture.peakShare, speckleLight: p.texture.speckleLight, chroma: p.chroma, paperL: p.paper.L, contrast: p.value.contrast, colours: p.colours, halftone: p.spectrum.halftone ? 1 : 0 });
const NAME = { linePresence: "thin-line share", hard: "hard-edge share", pooledRim: "pooled-rim share", coherence: "stroke coherence", peakShare: "one-direction share", speckleLight: "paper-through-colour", chroma: "chroma", paperL: "ground lightness", contrast: "value contrast", colours: "colours", halftone: "periodic lattice" };
const nearest = (p, sigs) => {
  const f = featuresOf(p);
  return Object.entries(sigs).map(([id, s]) => {
    // a feature the reference has no reading for (no grain, too few edges) is left out, not scored as zero
    const diffs = Object.entries(FEATS).filter(([k]) => f[k] != null && s.features[k] != null).map(([k, spread]) => ({ k, d: Math.abs(f[k] - s.features[k]) / spread, ref: f[k], plate: s.features[k] }));
    const dist = Math.sqrt(diffs.reduce((a, x) => a + Math.min(3, x.d) ** 2, 0) / diffs.length);
    const fmt = (v) => (v == null ? "-" : Number.isInteger(v) ? String(v) : String(r2(v, 3)));
    const shares = diffs.filter((x) => x.d < 0.35).sort((a, b) => a.d - b.d).slice(0, 3).map((x) => `${NAME[x.k]} ${fmt(x.ref)} ~ ${fmt(x.plate)}`);
    const differs = diffs.filter((x) => x.d > 1).sort((a, b) => b.d - a.d).slice(0, 3).map((x) => `${NAME[x.k]} ${fmt(x.ref)} here vs ${fmt(x.plate)}`);
    return { id, module: s.module, dist: r2(dist), medium: s.medium, shares, differs };
  }).sort((a, b) => a.dist - b.dist);
};

// ---------------------------------------------------------------- CLI
if (opt.calibrate) {
  // Build plate signatures from the plates' OWN rendered stills: measured, not guessed.
  const MEDIUM = JSON.parse(readFileSync(resolve(HERE, "style-media.json"), "utf8"));
  const out = {}; for (const f of pos) { const id = basename(f).replace(/(-plate)?(-still)?\.png$/, "").replace(/Draw$/, ""); const p = analyze(resolve(f)); out[id] = { module: `engine/src/canvas-core/${MEDIUM[id]?.module ?? id + ".ts"}`, medium: MEDIUM[id]?.medium ?? "", source: basename(f), sha256: p.sha256, features: featuresOf(p) }; console.log(`${id.padEnd(16)} ${JSON.stringify(out[id].features)}`); }
  const dest = resolve(opt.out ?? resolve(HERE, "style-signatures.json")); writeFileSync(dest, JSON.stringify({ note: "features measured by analyze-style.mjs --calibrate on each plate's own rendered still; subject and composition are baked into these numbers, so treat the match as a hint", plates: out }, null, 1)); console.log(`-> ${dest}`);
  process.exit(0);
}

const p = analyze(resolve(pos[0]));
const sigFile = resolve(opt.signatures ?? resolve(HERE, "style-signatures.json"));
const sigs = existsSync(sigFile) ? JSON.parse(readFileSync(sigFile, "utf8")).plates : {};
p.nearest = nearest(p, sigs).slice(0, 4);

const line = (k, v) => console.log(`  ${k.padEnd(14)} ${v}`);
console.log(`STYLE PROFILE  ${p.file}  ${p.size.join("x")} (analysed at ${p.analysedAt.join("x")})  sha256 ${p.sha256.slice(0, 16)}`);
console.log(`\npalette (OKLab k-means, area share):`);
p.palette.forEach((c) => console.log(`  ${c.hex}  L ${c.L.toFixed(2)}  C ${c.C.toFixed(3)}  h ${String(c.hue).padStart(3)}  ${(c.share * 100).toFixed(1).padStart(5)}%${c.hex === p.paper.hex ? "  <- paper" : c.hex === p.ink.hex ? "  <- darkest ink" : ""}`));
line("chroma", `${p.chroma} mean OKLab chroma off the paper; ${p.colours} colours above 2%`);
console.log(`\nvalue:`); line("key", `${p.value.key} (mean L ${p.value.meanL}), contrast ${p.value.contrast} (L ${p.value.p03}..${p.value.p97})`); line("bands", p.value.bands.join("  ") + "   (dark .. light)");
console.log(`\nline:`); line("presence", `${(p.line.presence * 100).toFixed(2)}% of pixels in thin dark marks`); line("width", p.line.widthMedianPx == null ? "no line found" : `median ${p.line.widthMedianPx} px, p90 ${p.line.widthP90Px} px, variation ${p.line.widthVariation}`);
console.log(`\nfill texture (interior only, ${p.texture.sampled} samples):`); line("direction", p.texture.grain ? `${p.texture.dominantStrokeAngle} deg, ${(p.texture.peakShare * 100).toFixed(0)}% of the weight within 15 deg of it (8% = none)` : "no measurable grain: the fills are smooth (washes, flat colour or a soft/upscaled image)"); line("coherence", `${p.texture.coherence} mean, ${p.texture.coherentShare} of samples above 0.5`); line("stroke", `~${p.texture.strokeLengthPx} px long x ${p.texture.grainWidthPx} px across (elongation ${p.texture.elongation})`); line("speckle", `light ${p.texture.speckleLight}, dark ${p.texture.speckleDark}, grain rms ${p.texture.grainRms}`);
console.log(`\nedges:`); line("hardness", `hard ${p.edges.hard}  soft ${p.edges.soft}  lost ${p.edges.lost}  (density ${p.edges.density})`); line("pooled rim", p.edges.pooledRim == null ? "too few strong edges" : `${p.edges.pooledRim} of strong edges darkest at the edge`);
console.log(`\nspectrum:`); line("slope", p.spectrum.powerSlope ?? p.spectrum.note); line("lattice", p.spectrum.halftone ? `periodic lattice (a halftone screen, or regular ruling/cross-hatch): pitch ${p.spectrum.halftone.pitchPx} px at ${p.spectrum.halftone.angles.join(" / ")} deg (peak ${p.spectrum.halftone.strength}x its ring)` : "none");
console.log(`\nnearest plates (a HINT: subject and layout are in these numbers too; see adapt-a-style.md):`);
if (!p.nearest.length) console.log("  no signatures: node tools/analyze-style.mjs --calibrate <plate stills...>");
p.nearest.forEach((m, i) => { console.log(`  ${i + 1}. ${m.id.padEnd(15)} dist ${m.dist}  ${m.medium}`); if (m.shares.length) console.log(`       shares:  ${m.shares.join("; ")}`); if (m.differs.length) console.log(`       differs: ${m.differs.join("; ")}`); });
if (opt.json) { const dest = resolve(opt.json); mkdirSync(dirname(dest), { recursive: true }); writeFileSync(dest, JSON.stringify(p, null, 1)); console.log(`\n-> ${dest}`); }
