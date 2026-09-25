// STIPPLE KIT. The sectioned nautilus as a TONE FIELD: no drawing here, only the question
// "how much ink belongs at this point?", answered from the shell's real structure and one lamp.
// The stipple plate turns this raster into dots.
//
// Geometry (median section of Nautilus pompilius):
//   outer wall  R(phi) = A * exp(B * phi), B = ln 3 / 2pi (whorl expansion ~3 per turn), phi <= 0
//   a whorl at angle phi spans radii [R(phi - 2pi), R(phi)]: involute, it sits on the last one
//   s in [0,1]: 0 on the dorsal (inner) side of the tube, 1 on the ventral (outer) wall
//   septa every DELTA of phi, each bowed back toward the apex in its middle
//   the last BODY of phi is the open body chamber; the aperture is the end of the tube
import { fractal } from "./core";

export const NAUT = {
  A: 0.418,                  // outer radius at the aperture, fraction of W
  B: Math.log(3) / (2 * Math.PI),
  POLE: [0.415, 0.405] as [number, number],
  SENSE: -1,                 // screen angle runs against phi: the coil grows counter-clockwise
  TH0: 0.52,                 // screen angle of the aperture (radians, y down)
  BODY: 2 * Math.PI * 0.36,  // body chamber, a third of a whorl and a bit
  DELTA: (2 * Math.PI) / 11, // camerae per whorl
  BOW: 0.5,                 // how far a septum bows back at its middle, in chamber lengths
  SIPH: 0.47,                // the siphuncle's place across the tube
  WIDTH: 0.44,               // tube half-width (depth below the cut) as a fraction of its in-plane height
  RMIN: 7,                   // inside this radius the protoconch whorls are below the pen's resolution
};
export type Tone = { raster: Float32Array };

const L = (() => { const x = -0.6, y = -0.66, z = 1.0, l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; })();   // to the lamp: upper left, ~48 degrees up
const LXY = Math.hypot(L[0], L[1]), UL: [number, number] = [L[0] / LXY, L[1] / LXY], COT = LXY / L[2];
const Hh = (() => { const x = L[0], y = L[1], z = L[2] + 1, l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; })();  // half vector for the nacre's flash
const TAU = Math.PI * 2, clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);

// kind: 0 paper, 1 cut face (wall, septum, neck), 2 chamber floor, 3 siphuncle trough, 4 outer rim sliver, 5 umbilical core
type Hit = { kind: number; id: number; s: number; q: number; h: number; r: number; th: number; v: number; body: boolean; phi: number };
const septumBow = (s: number) => NAUT.BOW * Math.sin(Math.PI * Math.pow(clamp(s), 0.85));
const apertureAt = (s: number) => -0.1 * s * s + 0.05 * (1 - s);           // the lip: a shallow ventral sinus

const locate = (W: number, x: number, y: number, o: Hit): Hit => {
  const A = NAUT.A * W, px = NAUT.POLE[0] * W, py = NAUT.POLE[1] * W, dx = x - px, dy = y - py, r = Math.hypot(dx, dy), th = Math.atan2(dy, dx);
  o.r = r; o.th = th; o.kind = 0; o.id = 0; o.body = false;
  if (r < NAUT.RMIN) { o.kind = 5; return o; }
  const u = Math.log(r / A) / NAUT.B, pth = NAUT.SENSE * (th - NAUT.TH0);
  let phi = pth + TAU * Math.ceil((u - pth) / TAU); if (phi < u) phi += TAU;
  const R1 = A * Math.exp(NAUT.B * phi), R0 = R1 / 3, h = R1 - R0, s = (r - R0) / h;
  o.phi = phi; o.s = s; o.h = h;
  const lip = apertureAt(clamp(s));
  if (phi > lip) {                                                          // beyond the last whorl: paper, or the rounded outer surface seen as a sliver
    const Rin = R0, rim = 3 + 0.016 * Rin, beyond = r - Rin;               // the whorl inside is the outermost one here
    const ph2 = phi - TAU; if (ph2 <= apertureAt(0.99) && beyond < rim && beyond >= 0) { o.kind = 4; o.phi = ph2; o.q = beyond / rim; return o; }
    return o;
  }
  const tw = 0.026 * R1 + 1.1, td = 0.006 * R1 + 0.7, lipPx = (lip - phi) * r;
  if (R1 - r < tw || r - R0 < td || lipPx < tw * 0.9) { o.kind = 1; return o; }       // outer wall, dorsal layer, the aperture's lip
  const last = -NAUT.BODY, v = (phi + NAUT.DELTA * septumBow(s) - last) / NAUT.DELTA, D = NAUT.DELTA;
  o.v = v;
  const ts = 0.0042 * R1 + 1.25;
  if (v > 0) { o.body = true; o.id = 1; o.q = v; if (v * D * r < ts) { o.kind = 1; return o; } o.kind = 2; return o; }
  const c = Math.floor(v), q = v - c; o.id = c - 10; o.q = q;
  if (Math.min(q, 1 - q) * D * r * 0.93 < ts) { o.kind = 1; return o; }
  // the siphuncle: a trough (the tube cut open) with its wall, and the septal neck pointing back from each septum
  const ds = Math.abs(s - NAUT.SIPH) * h, rho = 0.036 * h + 1.6;
  if (ds < rho) { o.kind = 3; return o; }
  if (ds < rho + 2.1 + (q > 0.72 ? 1.6 + 0.016 * h : 0)) { o.kind = 1; return o; }  // connecting ring; thicker where it is the neck
  o.kind = 2; return o;
};

// depth of the chamber floor below the cut, and its gradient across (s, q)
const depthSQ = (s: number, q: number, h: number, body: boolean, r: number): number => {
  const ss = clamp(s), across = Math.sqrt(Math.max(0, 1 - Math.pow(2 * Math.pow(ss, 1.08) - 1, 2)));
  const along = body ? Math.sqrt(clamp((q * NAUT.DELTA * r) / (0.32 * h))) : Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(2 * q - 1), 2.6)));
  return NAUT.WIDTH * h * across * along;
};

export const shellTone = (W: number, H: number): Tone => {
  const raster = new Float32Array(W * H), hit: Hit = { kind: 0, id: 0, s: 0, q: 0, h: 0, r: 0, th: 0, v: 0, body: false, phi: 0 }, h2: Hit = { ...hit };
  const A = NAUT.A * W, D = NAUT.DELTA;
  // THE CAST SHADOW. The half shell lies on its flank with the cut face as its flat top, so every
  // point of the section is the same height above the table: half the shell's width (~0.5 of its
  // diameter, so a quarter). The shadow is the silhouette swept away from the lamp by up to
  // HT * cot(elevation); its far edge is soft because the flank rolls under toward the table.
  const G = 3, gw = Math.ceil(W / G), gh = Math.ceil(H / G), solid = new Uint8Array(gw * gh);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { locate(W, i * G + 1, j * G + 1, hit); solid[j * gw + i] = hit.kind ? 1 : 0; }
  const HT = 0.2 * A * 1.58, TMAX = HT * COT;
  const inS = (x: number, y: number) => { const i = Math.round((x - 1) / G), j = Math.round((y - 1) / G); return i >= 0 && j >= 0 && i < gw && j < gh && solid[j * gw + i] === 1; };
  const shadow = new Float32Array(gw * gh);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    if (solid[j * gw + i]) continue; const x = i * G + 1, y = j * G + 1; let near = -1;
    for (let t = 1.5; t < TMAX + 40; t += 1.5) if (inS(x + UL[0] * t, y + UL[1] * t)) { near = t; break; }
    if (near < 0) continue;
    const f = near / TMAX, body = clamp((1.12 - f) / 0.5), contact = Math.exp(-near / 9);
    shadow[j * gw + i] = clamp(body * (0.5 - 0.14 * f) + 0.32 * contact);
  }
  const shAt = (x: number, y: number) => { const fx = (x - 1) / G, fy = (y - 1) / G, i = Math.floor(fx), j = Math.floor(fy), a = fx - i, b = fy - j, g = (ii: number, jj: number) => (ii < 0 || jj < 0 || ii >= gw || jj >= gh ? 0 : shadow[jj * gw + ii]); return (g(i, j) * (1 - a) + g(i + 1, j) * a) * (1 - b) + (g(i, j + 1) * (1 - a) + g(i + 1, j + 1) * a) * b; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const k = y * W + x; locate(W, x + 0.5, y + 0.5, hit); let t = 0;
    switch (hit.kind) {
      case 0: t = shAt(x, y); break;
      case 5: t = 0.42; break;
      case 1: t = 0.035 + (fractal(71, x, y, 0.02, 0.05, 2) - 0.5) * 0.05; break;            // sawn, polished nacre: the lightest thing on the sheet
      case 3: t = 0.66; break;
      case 4: {                                                                             // the rounded outside of the shell, turning away
        const nx = Math.cos(hit.th), ny = Math.sin(hit.th), face = clamp(-(nx * UL[0] + ny * UL[1]) * 0.5 + 0.5), stripe = hit.phi < -1.4 ? clamp(Math.sin(hit.phi * 7.5 + 2.2 * fractal(9, x, y, 0.03, 0.03, 2)) * 3 - 1.6) : 0;
        t = clamp(0.1 + 0.55 * face * face + 0.3 * stripe + 0.25 * hit.q); break; }
      default: {
        const { s, q, h, body, r } = hit, e = 0.02, d0 = depthSQ(s, q, h, body, r);
        const ds_ = (depthSQ(s + e, q, h, body, r) - depthSQ(s - e, q, h, body, r)) / (2 * e * h), dq_ = (depthSQ(s, q + e, h, body, r) - depthSQ(s, q - e, h, body, r)) / (2 * e * D * r);
        const c = Math.cos(hit.th), sn = Math.sin(hit.th), tx = -sn * NAUT.SENSE, ty = c * NAUT.SENSE;
        let nx = ds_ * c + dq_ * tx, ny = ds_ * sn + dq_ * ty, nz = 1; const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
        const lam = clamp(nx * L[0] + ny * L[1] + nz * L[2]);
        // is this floor point in the shadow of the rim nearer the lamp? follow the ray up to the cut plane
        locate(W, x + 0.5 + L[0] / L[2] * d0, y + 0.5 + L[1] / L[2] * d0, h2);
        const lit = h2.kind === 2 && h2.id === hit.id ? 1 : 0;
        const spec = Math.pow(clamp(nx * Hh[0] + ny * Hh[1] + nz * Hh[2]), 60) * lit;
        const deep = clamp(d0 / (NAUT.WIDTH * h));
        t = lit ? 0.1 + 0.62 * Math.pow(1 - clamp(lam / L[2]), 1.15) + 0.08 * deep - 0.5 * spec * (body ? 1 : 0) : 0.66 + 0.24 * deep - 0.1 * (1 - lam);
        // the innermost camerae are too small for the pen to model: a stippler gives each one a
        // plain dark cup, lighter on the far side, and lets the pale septa carry the spiral
        const small = clamp((60 - h) / 35); t = t * (1 - small) + small * (0.62 - 0.3 * clamp((q - 0.45) / 0.5));
        t = clamp(t);
      }
    }
    raster[k] = t;
  }
  return { raster };
};
