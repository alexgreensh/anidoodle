// HALFTONE SCENE: the continuous-tone ORIGINAL the newspaper screens. This is the photograph,
// held as two separations (black density, spot density), built by a pinhole camera over a real
// structure in metres. Nothing here is a mark on paper; the marks are made in halftone.ts.
//
// REFERENCE (from knowledge): Ribblehead Viaduct, North Yorkshire: 24 semicircular arches of
// ~13.7 m span on limestone piers ~32 m high, a thicker KING PIER every sixth pier, coursed
// rubble faces with a dressed arch ring, a string course and a plain parapet; the valley of the
// Ribble with dry-stone-walled pasture and a beck under the arches; Whernside's long ridge behind.
// The engine is a mixed-traffic 4-6-0 of the LMS Black Five kind in plain black: smokebox with
// its door and handrail, a stovepipe chimney, a dome midway along the boiler, Belpaire firebox
// with square shoulders, a cab with a roof overhang, 6 ft driving wheels (their tops alone show
// over the parapet), and a high-sided tender with coal heaped at the front; five maroon Mk1
// coaches behind. Structure borrowed, no real locomotive's number or livery detail copied.
//
// LIGHT: golden hour, the sun low (about 12 degrees) off to the RIGHT and a little toward the
// camera. It rakes the viaduct's face so every course of stone throws a hairline shadow, leaves
// the pier returns and the arch barrels in shade, lights the steam plume on its right flank with
// a warm rim and leaves its left side a cool grey, and puts a glow into the right of the sky.
// CAST SHADOWS: the viaduct throws a band of shade on the valley floor BEHIND it (the sun is so
// low that no light gets through the arches), the parapet shades the coaches' lower panels, the
// cornice drops a line of shade across the face, the plume shades itself.
import { fractal, rng, type Env, type P } from "./core";
import { clamp, ks, newTone, over, smoothstep, type Tone } from "./halftoneKit";

type V3 = [number, number, number];
// ---------------------------------------------------------------- the camera (metres)
// on the hillside across the beck, 15 m up (well below the deck, so the train stands against the
// sky and the piers tower), 50 degrees round from face-on: the viaduct recedes to the right.
export const camera = (W: number, H: number) => {
  const C: V3 = [-18, 15, 50], yaw = (50 * Math.PI) / 180, F = W * 1.22, cx = W * 0.52, cy = H * 0.65;
  const fw: V3 = [Math.sin(yaw), 0, -Math.cos(yaw)], rt: V3 = [Math.cos(yaw), 0, Math.sin(yaw)];
  const proj = (p: V3): P => { const dx = p[0] - C[0], dz = p[2] - C[2], xc = dx * rt[0] + dz * rt[2], zc = dx * fw[0] + dz * fw[2]; return [cx + (F * xc) / zc, cy - (F * (p[1] - C[1])) / zc]; };
  const depth = (p: V3) => (p[0] - C[0]) * fw[0] + (p[2] - C[2]) * fw[2];
  // screen -> the ground plane Y = y0 (null above the horizon)
  const ground = (x: number, y: number, y0 = 0): V3 | null => { if (y <= cy + 0.5) return null; const zc = (F * (C[1] - y0)) / (y - cy), xc = ((x - cx) * zc) / F; return [C[0] + xc * rt[0] + zc * fw[0], y0, C[2] + xc * rt[2] + zc * fw[2]]; };
  // screen -> the viaduct's face plane Z = 0
  const face = (x: number, y: number): V3 => { const u = (x - cx) / F, zc = -C[2] / (u * rt[2] + fw[2]); return [C[0] + zc * (u * rt[0] + fw[0]), C[1] - ((y - cy) / F) * zc, 0]; };
  return { C, F, cx, cy, proj, depth, ground, face };
};
export type Cam = ReturnType<typeof camera>;

// ---------------------------------------------------------------- the viaduct (metres)
export const SPAN = 15, NPIER = 16, SPRING = 22.5, DECK = 30.2, CORNICE = 30.75, PARAPET = 31.6, DEPTH = 6.4, RAIL = 30.5;
const halfW = (k: number, y: number) => (k % 6 === 0 && k > 0 ? 2.3 : 1.25) + 0.028 * (SPRING - Math.min(y, SPRING)) ; // battered piers; every 6th a king pier
const LIGHT: V3 = (() => { const v: V3 = [0.9, 0.21, 0.28], l = Math.hypot(...v); return [v[0] / l, v[1] / l, v[2] / l]; })();

// one arch opening in the plane Z = z, between pier k and k+1, as a world outline
const opening = (k: number, z: number): V3[] => {
  const a = k * SPAN + halfW(k, SPRING), b = (k + 1) * SPAN - halfW(k + 1, SPRING), r = (b - a) / 2, m = (a + b) / 2, out: V3[] = [];
  out.push([k * SPAN + halfW(k, 0), 0, z]);
  for (let i = 0; i <= 28; i++) { const t = Math.PI - (i / 28) * Math.PI; out.push([m + Math.cos(t) * r, SPRING + Math.sin(t) * r, z]); }
  out.push([(k + 1) * SPAN - halfW(k + 1, 0), 0, z]);
  return out;
};

// ---------------------------------------------------------------- the train (metres)
// side elevation of the engine and tender, x measured BACK from the buffer beam, y above rail.
// The engine runs toward -X (toward the near end), so world X = X0 + x.
export const X0 = 25;
const ENGINE: P[] = [ // outline of the whole side, clockwise from the front buffer beam foot
  [0, 0.9], [0, 1.35], [0.25, 1.35], [0.3, 2.0], [0.45, 2.3], [0.62, 3.25], [0.8, 3.55], [1.0, 3.62],       // smokebox front, its door bulging
  [1.12, 3.62], [1.12, 4.02], [1.08, 4.08], [1.58, 4.08], [1.54, 4.02], [1.54, 3.64],                        // stovepipe chimney with a lip
  [2.05, 3.63], [4.25, 3.6], [4.35, 3.78], [4.5, 3.93], [4.95, 3.93], [5.1, 3.78], [5.2, 3.59],               // boiler, dome
  [7.4, 3.56], [7.5, 3.72], [7.65, 3.78], [9.1, 3.78], [9.2, 3.72],                                          // Belpaire firebox shoulders
  [9.25, 3.95], [9.3, 4.02], [11.55, 4.02], [11.6, 3.95],                                                    // cab roof, overhang at the back
  [11.55, 1.4], [11.75, 1.4], [11.75, 3.35], [19.6, 3.35], [19.6, 1.2], [11.75, 1.2],                          // tender
  [11.6, 0.9],
];
const COACH = 20.2, COACHES = 5, GAP = 0.7;
// the plume's source: chimney top, world
export const CHIMNEY: V3 = [X0 + 1.33, RAIL + 4.1, -DEPTH / 2];

// ---------------------------------------------------------------- the valley behind (2D, screen)
// Whernside's long whaleback on the left and a nearer fell with a limestone scar on the right,
// both hazed toward the light. Heights are screen y at logical width 1080, scaled.
const ridgeFar = (x: number, W: number) => { const u = x / W; return W * (0.458 + 0.05 * u + 0.018 * Math.sin(u * 5.2 + 0.6) + 0.012 * (fractal(401, x, 0, 3 / W, 3 / W, 3) - 0.5) - 0.03 * smoothstep(0.55, 1.0, u)); };
const ridgeNear = (x: number, W: number) => { const u = x / W; return W * (0.545 + 0.022 * Math.sin(u * 3.1 + 2.2) - 0.035 * Math.exp(-Math.pow((u - 0.78) / 0.12, 2)) + 0.01 * (fractal(402, x, 0, 6 / W, 6 / W, 3) - 0.5)); };

// ---------------------------------------------------------------- building the original
export const buildTone = (env: Env): Tone => {
  const key = `halftone:tone:${env.W}x${env.H}`; const hit = env.cache.get(key) as Tone | undefined; if (hit) return hit;
  const W = env.W, H = env.H, cam = camera(W, H), tw = Math.round(W / 2), th = Math.round(H / 2), T = newTone(tw, th, W, H);
  const sun = cam.proj([cam.C[0] + LIGHT[0] * 1e4, cam.C[1] + LIGHT[1] * 1e4, cam.C[2] + LIGHT[2] * 1e4]);
  const sx = W / tw, sy = H / th;
  // 1. sky, hills, valley floor: per pixel
  for (let j = 0; j < th; j++) for (let i = 0; i < tw; i++) {
    const x = (i + 0.5) * sx, y = (j + 0.5) * sy, q = j * tw + i;
    let k: number, s: number;
    const glow = Math.exp(-Math.pow(Math.hypot((x - sun[0]) * 0.55, y - sun[1]) / (W * 0.5), 2));
    const up = clamp(1 - y / cam.cy);
    const halo = Math.exp(-Math.pow(Math.hypot((x - sun[0]) * 0.45, (y - sun[1]) * 1.4) / (W * 0.62), 2));
    k = 0.3 + 0.26 * Math.pow(up, 1.2) - 0.24 * halo * (1 - up * 0.6); s = 0.22 + 0.3 * (1 - up) + 0.5 * halo - 0.12 * up;
    // strata of cloud low in the west, their undersides lit
    const band = (yc: number, w: number, seed: number) => { const n = fractal(seed, x, y, 0.004, 0.03, 3); return clamp((n - 0.5) * 4) * Math.exp(-Math.pow((y - yc - (n - 0.5) * 30) / w, 2)); };
    const cl = band(H * 0.3, H * 0.022, 411) * 0.9 + band(H * 0.37, H * 0.015, 412) * 0.7 + band(H * 0.19, H * 0.03, 413) * 0.5;
    const rimLit = clamp((fractal(414, x, y + 6, 0.004, 0.03, 3) - fractal(414, x, y, 0.004, 0.03, 3)) * 40); k += cl * 0.3 - rimLit * cl * 0.3; s += cl * 0.15 * (0.5 + halo) + rimLit * cl * 0.4 * halo;
    const rf = ridgeFar(x, W), rn = ridgeNear(x, W);
    if (y > rf) { const d = (y - rf) / (H * 0.1); k = 0.2 + 0.08 * clamp(d) + 0.05 * (fractal(421, x, y, 0.02, 0.05, 3) - 0.5); s = 0.36 - 0.06 * clamp(d) + 0.1 * glow; }
    if (y > rn) { // the nearer fell: rough pasture, a pale limestone scar near its top, walls running down it
      const d = clamp((y - rn) / (H * 0.07)), n = fractal(431, x, y, 0.015, 0.04, 3), scar = Math.exp(-Math.pow((y - rn - H * 0.012) / (H * 0.006), 2)) * smoothstep(0.55, 0.7, x / W) * clamp((n - 0.35) * 3);
      k = 0.3 + 0.12 * d + 0.12 * (n - 0.5) - 0.2 * scar; s = 0.3 - 0.05 * d + 0.12 * scar + 0.06 * glow;
      const wall = Math.abs(((x * 0.9 + y * 2.1 + fractal(432, x, y, 0.01, 0.01, 2) * 60) % 70) - 35) < 0.9; if (wall) k += 0.04;
    }
    const g = cam.ground(x, y);
    if (g && y > rn + H * 0.045) {
      // valley floor: walled pasture in perspective, the beck, the viaduct's long shade behind it
      const X = g[0], Z = g[2], dist = Math.hypot(X - cam.C[0], Z - cam.C[2]), haze = clamp((dist - 60) / 900);
      const fx = Math.floor((X + 13 * Math.sin(Z * 0.011)) / 70), fz = Math.floor((Z + 9 * Math.sin(X * 0.017)) / 55), rr = rng(fx * 7919 + fz * 131 + 5)(), field = 0.26 + rr * 0.14;
      const wallX = Math.abs((((X + 13 * Math.sin(Z * 0.011)) % 70) + 70) % 70 - 35) > 34.3, wallZ = Math.abs((((Z + 9 * Math.sin(X * 0.017)) % 55) + 55) % 55 - 27.5) > 27.0;
      const grass = fractal(441, X, Z, 0.08, 0.08, 3) - 0.5;
      k = field + grass * 0.14 + (wallX || wallZ ? 0.12 * (1 - haze) * (fractal(443, X, Z, 0.3, 0.3, 1) > 0.42 ? 1 : 0) : 0); s = 0.36 - rr * 0.08;
      const beckX = 47 + 9 * Math.sin(Z * 0.045 + 1) + 5 * Math.sin(Z * 0.11) + 0.18 * Z, dB = Math.abs(X - beckX) * 0.9;
      if (dB < 2.6) { const ripple = fractal(442, X, Z * 0.35, 0.9, 0.9, 2); k = 0.04 + 0.4 * clamp((0.56 - ripple) * 4); s = 0.25 + 0.35 * glow; } // the beck throws back the bright western sky
      else if (dB < 5.5) { k += 0.12; } // the beck's shadowed banks and alders
      const shade = Z < 0 && Z > -34 - 6 * Math.sin(X * 0.05); // the viaduct's own shadow, thrown back across the floor
      if (shade) { k = k * 0.8 + 0.3; s *= 0.35; } else if (Z >= 0) { s += 0.08; } // sunlit pasture on our side of it
      k = k * (1 - haze * 0.55) + 0.2 * haze; s = s * (1 - haze * 0.4) + 0.3 * haze;
    }
    T.k[q] = clamp(k); T.s[q] = clamp(s);
  }

  // 2. the viaduct and the train, painted as geometry onto a separation surface, then laid over
  const L = env.canvas(tw, th), c = L.ctx; c.setTransform(tw / W, 0, 0, th / H, 0, 0);
  const pth = (pts: P[]) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); };
  const pr = (pts: V3[]) => pts.map((p) => cam.proj(p));
  const visible = (k: number) => { const a = cam.proj([k * SPAN, 0, 0]), b = cam.proj([(k + 1) * SPAN, 0, 0]); return b[0] > -80 && a[0] < W + 80; };
  // 2a. inside each arch: the pier return (in shade) and the barrel soffit (shade, warmed by the
  // bounce off the sunlit pasture), then the far opening knocked back out so the valley shows.
  for (let k = -1; k < NPIER; k++) {
    if (!visible(k)) continue;
    const front = pr(opening(k, 0)), back = pr(opening(k, -DEPTH));
    c.save(); pth(front); c.clip();
    const top = cam.proj([(k + 0.5) * SPAN, SPRING + 6, 0]), bot = cam.proj([(k + 0.5) * SPAN, 0, 0]);
    const gr = c.createLinearGradient(0, top[1], 0, bot[1]); gr.addColorStop(0, ks(0.6, 0.1, 20)); gr.addColorStop(0.35, ks(0.5, 0.16, 20)); gr.addColorStop(1, ks(0.4, 0.24, 20));
    c.fillStyle = gr; c.fillRect(-50, -50, W + 100, H + 100);
    c.globalCompositeOperation = "destination-out"; pth(back); c.fill(); c.globalCompositeOperation = "source-over";
    // the springing line where the barrel meets the pier return: a hard crease of shade
    c.strokeStyle = ks(0.8, 0.05, 21); c.lineWidth = 1.4; const s0 = cam.proj([(k + 1) * SPAN - halfW(k + 1, SPRING), SPRING, 0]), s1 = cam.proj([(k + 1) * SPAN - halfW(k + 1, SPRING), SPRING, -DEPTH]); c.beginPath(); c.moveTo(s0[0], s0[1]); c.lineTo(s1[0], s1[1]); c.stroke();
    c.restore();
  }
  // 2b. the face: one plane of coursed stone, arches cut through it (even-odd)
  const faceTop = pr([[-SPAN, CORNICE, 0], [NPIER * SPAN, CORNICE, 0]]), faceBot = pr([[NPIER * SPAN, 0, 0], [-SPAN, 0, 0]]);
  c.beginPath(); [faceTop[0], faceTop[1], faceBot[0], faceBot[1]].forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath();
  for (let k = -1; k < NPIER; k++) { const o = pr(opening(k, 0)); o.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); }
  c.fillStyle = ks(0.2, 0.44, 10); c.fill("evenodd");
  // arch rings: the dressed voussoirs, a band a little paler than the rubble, each ring stone jointed
  for (let k = -1; k < NPIER; k++) {
    if (!visible(k)) continue;
    const a = k * SPAN + halfW(k, SPRING), b = (k + 1) * SPAN - halfW(k + 1, SPRING), r = (b - a) / 2, m = (a + b) / 2, R = r + 0.95;
    const ring: V3[] = []; for (let i = 0; i <= 30; i++) { const t = Math.PI - (i / 30) * Math.PI; ring.push([m + Math.cos(t) * R, SPRING + Math.sin(t) * R, 0]); } for (let i = 30; i >= 0; i--) { const t = Math.PI - (i / 30) * Math.PI; ring.push([m + Math.cos(t) * r, SPRING + Math.sin(t) * r, 0]); }
    pth(pr(ring)); c.fillStyle = ks(0.13, 0.46, 11); c.fill();
    c.strokeStyle = ks(0.42, 0.3, 12); c.lineWidth = 0.7;
    for (let i = 1; i < 26; i++) { const t = Math.PI - (i / 26) * Math.PI, p0 = cam.proj([m + Math.cos(t) * r, SPRING + Math.sin(t) * r, 0]), p1 = cam.proj([m + Math.cos(t) * R, SPRING + Math.sin(t) * R, 0]); c.beginPath(); c.moveTo(p0[0], p0[1]); c.lineTo(p1[0], p1[1]); c.stroke(); }
  }
  // the cornice: a projecting string course, lit on its top lip, throwing a line of shade under it
  const strip = (y0: number, y1: number, z: number): P[] => pr([[-SPAN, y0, z], [NPIER * SPAN, y0, z], [NPIER * SPAN, y1, z], [-SPAN, y1, z]]);
  pth(strip(CORNICE - 0.55, CORNICE - 0.15, 0)); c.fillStyle = ks(0.55, 0.18, 13); c.fill();              // its cast shade on the face
  pth(strip(CORNICE - 0.15, CORNICE + 0.25, 0.3)); c.fillStyle = ks(0.3, 0.38, 13); c.fill();              // the course's face
  pth(strip(CORNICE + 0.25, CORNICE + 0.33, 0.3)); c.fillStyle = ks(0.02, 0.55, 13); c.fill();             // its lit top lip
  pth(strip(CORNICE + 0.33, PARAPET, 0.05)); c.fillStyle = ks(0.24, 0.42, 14); c.fill();                   // the parapet
  pth(strip(PARAPET, PARAPET + 0.12, 0.05)); c.fillStyle = ks(0.05, 0.58, 13); c.fill();                   // coping, catching the sun

  // 2c. the train, behind the parapet: coaches first (far to near), then tender and engine
  const side = -DEPTH / 2 + 1.45, at = (x: number, y: number): P => cam.proj([X0 + x, RAIL + y, side]);
  const poly = (pts: P[], dx = 0) => pr(pts.map(([x, y]) => [X0 + x + dx, RAIL + y, side] as V3));
  const parTop = (x: number) => cam.proj([x, PARAPET + 0.12, 0.05])[1];
  c.save(); c.beginPath(); // clip to above the parapet coping: the train stands behind it
  { const pts: P[] = []; for (let X = -SPAN; X <= NPIER * SPAN; X += 2) pts.push([cam.proj([X, 0, 0.05])[0], parTop(X)]); c.moveTo(-50, -50); pts.forEach(([x, y]) => c.lineTo(x, y)); c.lineTo(W + 50, pts[pts.length - 1][1]); c.lineTo(W + 50, -50); c.closePath(); }
  c.clip();
  for (let n = COACHES - 1; n >= 0; n--) {
    const x0 = 19.6 + GAP + n * (COACH + GAP), x1 = x0 + COACH;
    const body = poly([[x0, 1.0], [x1, 1.0], [x1, 3.3], [x1 - 0.3, 3.62], [x1 - 1.2, 3.86], [x0 + 1.2, 3.86], [x0 + 0.3, 3.62], [x0, 3.3]]);
    pth(body); c.fillStyle = ks(0.5, 0.36, 50); c.fill();                                                       // maroon side, raked by the sun
    pth(poly([[x0, 3.3], [x1, 3.3], [x1 - 0.3, 3.62], [x1 - 1.2, 3.86], [x0 + 1.2, 3.86], [x0 + 0.3, 3.62]])); c.fillStyle = ks(0.28, 0.4, 51); c.fill(); // the roof's curve, turned up to the light
    pth(poly([[x0, 3.3], [x1, 3.3], [x1, 3.36], [x0, 3.36]])); c.fillStyle = ks(0.85, 0.1, 51); c.fill();       // cantrail shadow line
    for (let w = 0; w < 8; w++) { const wx = x0 + 1.5 + w * 2.25; pth(poly([[wx, 2.05], [wx + 1.55, 2.05], [wx + 1.55, 2.95], [wx, 2.95]])); c.fillStyle = ks(0.12 + 0.5 * (w % 3 === 1 ? 1 : 0), 0.42, 52); c.fill(); } // windows: most throw back the western sky, some see through to dark
    pth(poly([[x0, 1.0], [x1, 1.0], [x1, 1.7], [x0, 1.7]])); c.fillStyle = ks(0.68, 0.2, 53); c.fill();          // lower panels in the parapet's shade
    pth(poly([[x1, 1.0], [x1 + GAP, 1.0], [x1 + GAP, 3.4], [x1, 3.4]])); c.fillStyle = ks(0.85, 0.05, 54); c.fill(); // gangway
  }
  pth(poly(ENGINE)); c.fillStyle = ks(0.84, 0.07, 40); c.fill();                                                  // engine and tender: black
  // the boiler's round: a narrow band of glint where its curve turns up toward the low sun
  const glint = (x0: number, x1: number, y: number, w: number, k: number, s: number) => { pth(poly([[x0, y], [x1, y], [x1, y + w], [x0, y + w]])); c.fillStyle = ks(k, s, 41); c.fill(); };
  glint(2.1, 7.35, 3.08, 0.34, 0.02, 0.78); glint(2.1, 7.35, 2.9, 0.18, 0.4, 0.45); glint(0.75, 1.95, 3.1, 0.3, 0.08, 0.7);
  glint(7.7, 9.05, 3.38, 0.3, 0.05, 0.74); glint(11.8, 19.5, 3.05, 0.25, 0.12, 0.62); glint(4.5, 4.95, 3.6, 0.28, 0.02, 0.8);
  glint(9.3, 11.55, 3.82, 0.18, 0.1, 0.66); glint(0.3, 11.5, 1.3, 0.16, 0.25, 0.5);                              // cab roof edge, running plate edge
  pth(poly([[1.15, 3.98], [1.55, 3.98], [1.55, 4.06], [1.15, 4.06]])); c.fillStyle = ks(0.2, 0.62, 41); c.fill();   // chimney lip
  pth(poly([[9.7, 2.3], [10.9, 2.3], [10.9, 3.4], [9.7, 3.4]])); c.fillStyle = ks(0.25, 0.7, 42); c.fill();     // cab side window, the fire's glow behind it
  pth(poly([[11.9, 3.35], [15.4, 3.35], [14.9, 3.72], [12.4, 3.78]])); c.fillStyle = ks(0.72, 0.16, 43); c.fill();   // coal heaped at the front of the tender
  // driving wheels: only their tops clear the parapet; splashers over them, a coupling rod
  [3.1, 5.2, 7.3].forEach((wx) => { const cen = at(wx, 0.94), rim = at(wx + 0.94, 0.94), R = Math.abs(rim[0] - cen[0]); c.strokeStyle = ks(0.9, 0.05, 44); c.lineWidth = R * 0.14; c.beginPath(); c.ellipse(cen[0], cen[1], R * 0.93, R * 0.93 * 1.02, 0, Math.PI, 2 * Math.PI); c.stroke(); c.strokeStyle = ks(0.2, 0.55, 44); c.lineWidth = R * 0.05; c.beginPath(); c.ellipse(cen[0], cen[1], R, R, 0, Math.PI * 1.1, Math.PI * 1.6); c.stroke(); });
  c.restore();

  // 2c'. a dry-stone wall running from the viaduct's foot toward us: its sunlit top, its shaded side
  { const path: V3[] = []; for (let t = 0; t <= 1.0001; t += 0.05) path.push([64 - 26 * t + 4 * Math.sin(t * 3), 0, 1 + 34 * t]);
    const top = (h: number, dz: number) => path.map(([x, , z]) => cam.proj([x, h, z + dz]));
    const a = top(1.35, 0), b = top(1.35, 0.7), g0 = top(0, 0.7);
    pth([...b, ...g0.reverse()]); c.fillStyle = ks(0.62, 0.12, 63); c.fill();         // the face toward us, turned from the sun
    pth([...a, ...b.reverse()]); c.fillStyle = ks(0.14, 0.5, 64); c.fill();            // its cope stones, lit
    const r = rng(465); c.fillStyle = ks(0.78, 0.08, 65); for (let i = 0; i < 90; i++) { const t = r(), p = cam.proj([64 - 26 * t + 4 * Math.sin(t * 3), 0.2 + r() * 1.0, 1.7 + 34 * t]), w = 2 + (1 - t) * 4; c.fillRect(p[0], p[1], w, 1 + (1 - t)); } // the dark gaps between the stones
  }
  // 2d. the near bank we stand on: a dark sloping foreground with rushes, their tips caught by the sun
  const bank: P[] = [[-10, H * 0.86], [W * 0.12, H * 0.872], [W * 0.26, H * 0.9], [W * 0.4, H * 0.925], [W * 0.55, H * 0.955], [W * 0.7, H * 0.985], [W * 0.8, H + 10], [-10, H + 10]];
  pth(bank); c.fillStyle = ks(0.72, 0.1, 60); c.fill();
  const rr = rng(451);
  for (let i = 0; i < 110; i++) { const u = Math.pow(rr(), 0.9) * 0.78, bx = u * W, by = H * (0.86 + u * 0.17) + 4 + rr() * 40, h = (18 + rr() * 34) * (1 - u), lean = (rr() - 0.3) * 0.5; c.strokeStyle = ks(0.78, 0.1, 61); c.lineWidth = 1.4; c.beginPath(); c.moveTo(bx, by); c.quadraticCurveTo(bx + lean * h * 0.3, by - h * 0.6, bx + lean * h, by - h); c.stroke(); c.strokeStyle = ks(0.1, 0.62, 62); c.lineWidth = 1; c.beginPath(); c.moveTo(bx + lean * h * 0.8, by - h * 0.8); c.lineTo(bx + lean * h, by - h); c.stroke(); }

  // 3. lay it over, with the stone given its courses and weather
  over(T, L, (x, y, mat, k, s) => {
    if (Math.abs(mat - 10) < 2 || Math.abs(mat - 20) < 2) {
      const f = mat < 15 ? cam.face(x, y) : null, X = f ? f[0] : x * 0.05, Y = f ? f[1] : y * 0.05;
      const course = Math.floor(Y / 0.46), cy = Y / 0.46 - course, joint = cy < 0.12 ? 1 : 0, stone = Math.floor((X + rng(course * 31 + 7)() * 1.4) / (0.7 + (course % 3) * 0.25));
      const tone = (rng(course * 977 + stone * 13 + 3)() - 0.5) * 0.12, weather = (fractal(461, X * 3, Y * 0.3, 0.6, 0.12, 3) - 0.5) * 0.22, rise = f ? clamp((6 - Y) / 6) * 0.1 : 0;
      if (!f) { k += (fractal(462, x, y, 0.01, 0.004, 2) - 0.5) * 0.08; return [clamp(k), clamp(s)]; } // the shaded returns: damp, mottled, no sun to pick out the joints
      const pier = Math.round(X / SPAN), streak = Math.pow(fractal(463, X * 4, Y * 0.08, 0.5, 0.5, 2), 3) * 0.5 * clamp((CORNICE - Y) / 8); // lime and rain run down from the string course
      const damp = clamp((3.5 - Y) / 3.5) * 0.18, age = (rng(pier * 17 + 3)() - 0.5) * 0.07;
      k = k + tone + weather + joint * 0.2 + rise * 0.3 + streak * 0.25 + damp + age; s = s - joint * 0.12 - tone * 0.5 - damp * 0.5;
    }
    return [clamp(k), clamp(s)];
  });

  // 4. the plume, a density field shaded by marching toward the sun (see plume())
  plume(T, cam);
  // 5. newsprint cannot print a full black nor hold a clean white: the tone curve of the press
  for (let q = 0; q < T.k.length; q++) { { const v = T.k[q]; T.k[q] = 0.92 * (0.45 * v + 0.55 * v * v * (3 - 2 * v)); } T.s[q] = 0.62 * Math.pow(T.s[q], 1.35); } // the spot is a warmth, not a colour: only the sunlit and the glow carry much of it
  env.cache.set(key, T); return T;
};

// ---------------------------------------------------------------- the plume
// Coal smoke leaves the chimney as a dense dark column, is thrown up by the blast and bent back
// over the train by its speed, rolls into billows that grow as it rises, whitens to steam, and
// thins to nothing over the fourth coach. Density is a string of puffs along that path, bitten
// into cauliflower by domain-warped noise. Shading: from each point, march toward the sun and
// add up the smoke in the way; the more there is, the less light arrives (the lit rim on the
// right, the grey body on the left). Where it is thin it lets the sky through.
const plume = (T: Tone, cam: Cam) => {
  const W = T.W, puffs: { x: number; y: number; r: number; d: number; z: number }[] = [], R = rng(471);
  // the path: straight up out of the chimney (the blast), bent back by the train's speed, still
  // climbing, then levelling and spreading as it cools. Billows along it, bigger as it goes: each
  // billow a round mass (a sphere, for its shading), the whole a union of them.
  for (let s = 0; s < 100; s += 0.22 + s * 0.04) {
    const up = 3.4 * (1 - Math.exp(-s / 1.5)) + 10 * (1 - Math.exp(-s / 20)), back = s * 0.95 - 1.9 * (1 - Math.exp(-s / 1.5));
    const X = CHIMNEY[0] + back, Y = CHIMNEY[1] + up, Z = CHIMNEY[2] - 0.12 * s, r = 0.26 + 0.44 * Math.pow(s, 0.8);
    const p = cam.proj([X, Y, Z]), q = cam.proj([X + r, Y, Z]), rp = Math.abs(q[0] - p[0]), n = s < 2 ? 1 : 3, j = s < 2 ? 0.15 : 1;
    for (let m = 0; m < n; m++) { const k = 0.35 + Math.pow(R(), 1.6) * 0.95; puffs.push({ x: p[0] + (R() - 0.5) * rp * 1.3 * j, y: p[1] + (R() - 0.5) * rp * 1.1 * j, r: rp * k, d: clamp(1.25 - s / 95) * (0.8 + R() * 0.3), z: -s * 0.6 + R() * rp * 0.5 }); }
  }
  const gw = Math.round(T.w / 1.25), gh = Math.round(T.h / 1.25), gs = W / gw, A = new Float32Array(gw * gh), NX = new Float32Array(gw * gh), NY = new Float32Array(gw * gh), NZ = new Float32Array(gw * gh), DN = new Float32Array(gw * gh);
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; puffs.forEach((p) => { x0 = Math.min(x0, p.x - p.r * 1.5); x1 = Math.max(x1, p.x + p.r * 1.5); y0 = Math.min(y0, p.y - p.r * 1.5); y1 = Math.max(y1, p.y + p.r * 1.5); });
  const ci0 = Math.max(1, Math.floor(x0 / gs)), ci1 = Math.min(gw - 2, Math.ceil(x1 / gs)), cj0 = Math.max(1, Math.floor(y0 / gs)), cj1 = Math.min(gh - 2, Math.ceil(y1 / gs));
  for (let j = cj0; j <= cj1; j++) for (let i = ci0; i <= ci1; i++) {
    const x = (i + 0.5) * gs, y = (j + 0.5) * gs, wx = x + (fractal(481, x, y, 0.01, 0.01, 3) - 0.5) * 22, wy = y + (fractal(482, x, y, 0.01, 0.01, 3) - 0.5) * 22;
    const fz = (fractal(483, x, y, 0.045, 0.045, 3) - 0.5) * 0.5;                // the fluff on each billow's edge
    let best = -1e9, cover = 0, q = j * gw + i;
    for (const p of puffs) { const e = ((wx - p.x) ** 2 + (wy - p.y) ** 2) / (p.r * p.r) + fz; if (e >= 1) continue; const nz = Math.sqrt(1 - e), h = p.z + p.r * nz; cover = Math.max(cover, clamp((1 - e) * 5) * p.d); if (h > best) { best = h; NX[q] = (wx - p.x) / p.r; NY[q] = (wy - p.y) / p.r; NZ[q] = nz; DN[q] = p.d; } }
    A[q] = cover;
  }
  const Lv = [0.84, -0.4, 0.36], root = cam.proj(CHIMNEY), PK = new Float32Array(gw * gh), PS = new Float32Array(gw * gh);
  const Aat = (i: number, j: number) => (i < 0 || j < 0 || i >= gw || j >= gh ? 0 : A[j * gw + i]);
  for (let j = cj0; j <= cj1; j++) for (let i = ci0; i <= ci1; i++) {
    const q = j * gw + i; if (A[q] <= 0) continue;
    const lam = clamp(NX[q] * Lv[0] + NY[q] * Lv[1] + NZ[q] * Lv[2]);
    let occ = 0; for (let m = 1; m <= 14; m++) occ += Aat(Math.round(i + 0.92 * m * 2.5), Math.round(j - 0.39 * m * 2.5));
    const x = (i + 0.5) * gs, y = (j + 0.5) * gs, shade = Math.exp(-occ * 0.3), rim = clamp(1 - NZ[q]) * clamp(NX[q] * 0.92 - NY[q] * 0.39) * clamp(1 - occ * 0.25);
    const lit = clamp(0.02 + 1.1 * lam * (0.15 + 0.85 * shade) + 0.8 * rim), coal = clamp(1 - Math.hypot(x - root[0], (y - root[1]) * 1.3) / (W * 0.12)), thin = 1 - DN[q];
    PK[q] = (0.44 * Math.pow(1 - lit, 1.3) * (1 - 0.35 * thin) + 0.3 * coal * (1 - 0.6 * lit)) * A[q]; PS[q] = (0.04 + 0.42 * lit * (1 - lit * 0.45) * (1 - 0.5 * coal) + 0.1 * (1 - lit)) * A[q];
  }
  const sx = W / T.w, sy = T.H / T.h, bl = (M: Float32Array, fx: number, fy: number) => { const a = Math.floor(fx), b = Math.floor(fy), u = fx - a, v = fy - b, g = (i: number, j: number) => (i < 0 || j < 0 || i >= gw || j >= gh ? 0 : M[j * gw + i]); return g(a, b) * (1 - u) * (1 - v) + g(a + 1, b) * u * (1 - v) + g(a, b + 1) * (1 - u) * v + g(a + 1, b + 1) * u * v; };
  for (let j = 0; j < T.h; j++) for (let i = 0; i < T.w; i++) {
    const x = (i + 0.5) * sx, y = (j + 0.5) * sy; if (x < x0 || x > x1 || y < y0 || y > y1) continue;
    const fx = x / gs - 0.5, fy = y / gs - 0.5, al = bl(A, fx, fy); if (al <= 0.003) continue;
    const q = j * T.w + i; T.k[q] = T.k[q] * (1 - al) + clamp(bl(PK, fx, fy) / al) * al; T.s[q] = T.s[q] * (1 - al) + clamp(bl(PS, fx, fy) / al) * al;
  }
};
