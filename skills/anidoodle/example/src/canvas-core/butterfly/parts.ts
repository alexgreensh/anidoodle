// THE PARTS OF THE PLATE. Each one draws with a Kit onto whatever target that Kit is bound to,
// and takes only the state it needs. Nothing here knows about caching, films or frames.
import { P, oval, poly, sample } from "../core";
import { width } from "../drafting";
import { B, CX, CY, CYAN, DIM, GROUND, HEAD, K, KC, THORAX, WHITE, WINDOW, Wing, cen, lerp } from "./geom";
import { Kit, PenO } from "./kit";

// element i of a run of n, drawn in order, each taking `dur` of the whole: the hand works
// down the part, it does not fade things up together.
export const stagger = (p: number, n: number, dur = Math.min(1, 2 / n)) => { const step = n > 1 ? (1 - dur) / (n - 1) : 0; return (i: number) => (p >= 1 ? 1 : Math.max(0, Math.min(1, (p - i * step) / dur))); };
// WHERE THE NIB IS. `progress` cuts a stroke on sample INDEX, and samples are not evenly
// spaced in arc length, so a fitting gated on cue progress can appear on bare paper ahead of
// the line it belongs to. This measures the drawn fraction of the actual stroke, and where a
// point sits along it, both in arc length, so a knuckle or a rivet lands as the nib passes it.
export const nib = (pts: P[]) => {
  const s = sample(pts), acc = [0]; let total = 0;
  for (let i = 1; i < s.length; i++) { total += Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]); acc.push(total); }
  const L = total || 1;
  return {
    drawn: (q: number) => { if (q >= 1) return 1; const n = (s.length - 1) * q, i = Math.max(0, Math.min(s.length - 1, Math.floor(n))), f = n - i; return (acc[i] + (i + 1 < s.length ? (acc[i + 1] - acc[i]) * f : 0)) / L; },
    where: (t: P) => { let best = 0, bd = 1e9; for (let i = 0; i < s.length; i++) { const d = (s[i][0] - t[0]) ** 2 + (s[i][1] - t[1]) ** 2; if (d < bd) { bd = d; best = i; } } return acc[best] / L; },
  };
};
export const cut = (p: number, a: number, b: number) => (p >= 1 ? 1 : Math.max(0, Math.min(1, (p - a) / (b - a))));

export type Train = { centre: number; third: number; pinion: number; escape: number; fork: number }; // radians added to the plate's authored phases
export const IDLE: Train = { centre: 0, third: 0, pinion: 0, escape: 0, fork: 0 };

// ---------------------------------------------------------------- the sheet
export const sheet = (k: Kit, W: number, H: number) => {
  const c = k.g.main, e = k.g.env, dw = Math.round(W * e.scale), dh = Math.round(H * e.scale);
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.fillStyle = GROUND; c.fillRect(0, 0, dw, dh); c.restore(); /* the ground fills the FRAME, whatever the camera is doing */
  const glow = c.createRadialGradient(W * 0.5, H * 0.44, 60, W * 0.5, H * 0.5, W * 0.78); glow.addColorStop(0, "rgba(58,120,178,0.34)"); glow.addColorStop(0.55, "rgba(30,84,140,0.1)"); glow.addColorStop(1, "rgba(4,16,36,0.5)"); c.fillStyle = glow; c.fillRect(-W, -H, W * 3, H * 3);
  k.g.paper("blueMottle", 0.55);
  /* two old fold lines: a plate that has lived in a drawer */
  [[W * 0.5 + 3, 0, W * 0.5 - 2, H], [0, H * 0.5 - 4, W, H * 0.5 + 2]].forEach(([x0, y0, x1, y1]) => { c.strokeStyle = "rgba(190,225,245,0.07)"; c.lineWidth = 2.4; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); c.strokeStyle = "rgba(2,10,26,0.16)"; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x0 + 2, y0 + 2); c.lineTo(x1 + 2, y1 + 2); c.stroke(); });
};
// The detail bubble goes on the thorax BEFORE the detail is drawn: a draftsman rings what he is
// about to magnify, and it is the circle the cut to Detail B matches (spec 7).
export const bubble = (k: Kit, p = 1) => { if (p <= 0) return; k.ink(() => { const tc = cen(THORAX); k.ring(tc[0], tc[1] - 6, 62, 1.5, 336, { color: CYAN, opacity: 0.95, progress: cut(p, 0, 0.7) }); /* the circle the cut matches: it has to carry the frame, so it is rung with a confident line */ k.text("B", tc[0] + 50, tc[1] - 70, { cap: 14, seed: 337, w: 1.8, progress: cut(p, 0.6, 1) }); }); };
export const BUBBLE = (): [number, number, number] => { const tc = cen(THORAX); return [tc[0], tc[1] - 6, 62]; };

export const grid = (k: Kit, W: number, H: number, alpha = 1) => k.g.group("plain", () => { const c = k.raw(); c.globalAlpha = alpha; k.g.touch(0, 0, W, H); for (let i = 40; i < W - 30; i += 20) { const major = (i - 40) % 100 === 0; c.strokeStyle = major ? "rgba(150,208,236,0.2)" : "rgba(150,208,236,0.085)"; c.lineWidth = major ? 1 : 0.7; c.beginPath(); c.moveTo(i, 40); c.lineTo(i, H - 40); c.moveTo(40, i); c.lineTo(W - 40, i); c.stroke(); } c.globalAlpha = 1; }, { textures: ["draftTooth"] });
export const border = (k: Kit, W: number, H: number, p = 1) => { if (p <= 0) return; k.ink(() => {
  const q = stagger(cut(p, 0, 0.75), 8, 0.42); /* the sheet is ruled stroke by stroke, outer frame first, inner rule chasing it */
  [[22, 2.6], [34, 1.2]].forEach(([m, w], j) => [[[m, m], [W - m, m]], [[W - m, m], [W - m, H - m]], [[W - m, H - m], [m, H - m]], [[m, H - m], [m, m]]].forEach(([a, b], i) => k.ln(a as P, b as P, w, { seed: 900 + j * 4 + i, taper: 0.15, progress: q(i * 2 + j) })));
  const z = cut(p, 0.7, 1);
  ["A", "B", "C", "D"].forEach((t, i) => { const y = 34 + ((H - 68) * (i + 0.5)) / 4, qq = stagger(z, 8, 0.4)(i); k.text(t, 24.5, y - 4, { cap: 7, seed: 910 + i, color: CYAN, w: 1, progress: qq }); if (i) k.ln([22, 34 + ((H - 68) * i) / 4], [34, 34 + ((H - 68) * i) / 4], 1, { seed: 920 + i, progress: qq }); });
  ["1", "2", "3", "4"].forEach((t, i) => { const x = 34 + ((W - 68) * (i + 0.5)) / 4, qq = stagger(z, 8, 0.4)(i + 4); k.text(t, x, 24.5, { cap: 7, seed: 930 + i, color: CYAN, w: 1, align: "center", progress: qq }); if (i) k.ln([34 + ((W - 68) * i) / 4, 22], [34 + ((W - 68) * i) / 4, 34], 1, { seed: 940 + i, progress: qq }); });
}); };

// CONSTRUCTION. What the draftsman lays down before he inks: the centre line, the envelope each
// wing has to fit, the thorax ellipse. It is drawn in DIM, and later it is taken away the same
// way it arrived, by UN-drawing, because a construction line is erased and never faded.
export const construction = (k: Kit, w: { LF: Wing; RF: Wing; LH: Wing; RH: Wing }, p: number) => { if (p <= 0) return; k.ink(() => {
  const q = stagger(p, 7, 0.4), o: PenO = { color: DIM, opacity: 0.8, seed: 0 };
  k.chain([CX, CY - 300], [CX, CY + 380], 1, { ...o, seed: 960, progress: q(0) });
  [w.LF, w.RF, w.LH, w.RH].forEach((wg, i) => k.pen(wg.out, 1.2, { ...o, seed: 961 + i, closed: true, wobble: 1.6, progress: q(1 + i) }));
  k.pen(k.oval(CX, CY - 10, 58, 92, 12), 1.2, { ...o, seed: 966, closed: true, progress: q(5) });
  k.pen(k.oval(CX, CY - 100, 26, 22, 10), 1.1, { ...o, seed: 967, closed: true, progress: q(6) });
}); };

// ---------------------------------------------------------------- the wings
export type WingP = { skin: boolean; lift?: number; liftT?: number; line?: number; skinP?: number };
export const drawWing = (k: Kit, w: Wing, side: number, seed: number, o: WingP) => {
  const { h, ends, out, panels, spar, sparLine } = w, line = o.line ?? 1, skinP = o.skinP ?? 1;
  if (line <= 0 && skinP <= 0) return;
  // a membrane panel is a MADE part: it arrives whole along its projection lines, seats, and is
  // veined and then shaded afterwards, in that order
  const drawPanel = (pn: P[], i: number, dx = 0, dy = 0, q = 1) => {
    if (q <= 0) return;
    const p = pn.map(([x, y]) => [x + dx, y + dy] as P), base = lerp(p[0], p[6], 0.5), tip = p[3], c0 = cen(p);
    const vein = cut(q, 0.45, 0.8), tone = cut(q, 0.8, 1);
    k.fill(p, CYAN, 0.085); k.pen(p, 1.15, { seed: seed + 300 + i, closed: true, color: CYAN, wobble: 0.3 });
    if (vein <= 0) return;
    /* veining: a midrib that forks, and cross-veins running out to the panel's edges */
    const mid = (t: number): P => lerp(lerp(base, c0, t), lerp(c0, tip, t), t), vq = stagger(vein, 9, 0.45);
    k.pen([0, 0.25, 0.5, 0.75, 0.96].map(mid), 1.05, { seed: seed + 320 + i, color: WHITE, opacity: 0.85, progress: vq(0) });
    [0.28, 0.46, 0.64, 0.8].forEach((t, j) => [1, 5].forEach((e, r) => { const from = mid(t), to = lerp(lerp(p[e], p[e === 1 ? 2 : 4], t), from, 0.12); k.pen([from, lerp(lerp(from, to, 0.5), c0, -0.1), to], 0.8, { seed: seed + 340 + i * 9 + j * 2 + r, color: CYAN, opacity: 0.78, taper: 0.9, progress: vq(1 + j * 2 + r) }); }));
    if (tone > 0) k.hatch([p[6], p[5], p[4], lerp(p[4], c0, 0.34), lerp(p[5], c0, 0.3), lerp(p[6], c0, 0.3)], Math.atan2(p[4][1] - p[6][1], p[4][0] - p[6][0]) + 0.9, 4.6, 0.75, seed + 360 + i, { opacity: 0.6, progress: tone });
  };
  if (o.skin && skinP > 0) { const sq = stagger(skinP, panels.length, 0.5); panels.forEach((pn, i) => { if (i === o.lift) return; const a = cut(sq(i), 0, 0.45), f = 1 - a * a * (3 - 2 * a); drawPanel(pn, i, side * 58 * f, -60 * f, sq(i)); }); }
  if (line <= 0) return;
  const mq = cut(line, 0, 0.3), sq = stagger(cut(line, 0.2, 0.92), ends.length, 0.45), bq = cut(line, 0.85, 1);
  k.pen(out, 2.7, { seed: seed + 1, closed: true, wobble: 0.6, progress: mq }); /* the wing margin: the heaviest line on the wing, and the first */
  ends.forEach((_, i) => {
    const q = sq(i); if (q <= 0) return;
    const nrm = (t: number): P => { const a = spar(i, t - 0.02), b = spar(i, t + 0.02), l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [-(b[1] - a[1]) / l, (b[0] - a[0]) / l]; }, tw = i === 0 ? 3.4 : 2.3;
    [-1, 1].forEach((sd) => k.pen(sparLine(i, 0.04, 0.985).map((p, j, arr) => { const t = 0.04 + (0.945 * j) / (arr.length - 1), n = nrm(Math.min(0.97, Math.max(0.03, t))), wv = tw * (1 - t * 0.55); return [p[0] + n[0] * wv * sd, p[1] + n[1] * wv * sd] as P; }), i === 0 ? 1.7 : 1.05, { seed: seed + 40 + i * 2 + sd, color: i === 0 ? WHITE : CYAN, opacity: i === 0 ? 0.95 : 0.85, progress: q })); /* a spar is a tapering TUBE: two lines, not one */
    const kn = spar(i, 0.44), n = nrm(0.44), nb = nib(sparLine(i, 0.04, 0.985)), tip = nb.drawn(q), hq = q >= 1 ? 1 : cut(tip - nb.where(kn), 0, 0.1); /* the knuckle rings on as the NIB passes it, not when the cue says so */
    if (hq > 0) { k.ring(kn[0], kn[1], 5.2, 1.5, seed + 60 + i, { progress: hq }); k.ring(kn[0], kn[1], 1.8, 1.1, seed + 70 + i, { progress: hq }); k.ln([kn[0] - n[0] * 8, kn[1] - n[1] * 8], [kn[0] + n[0] * 8, kn[1] + n[1] * 8], 1.1, { seed: seed + 80 + i, progress: hq }); }
    for (let j = 1; j <= (i === 0 ? 9 : 3); j++) { const t = i === 0 ? 0.08 + j * 0.095 : 0.2 + j * 0.2, p = spar(i, t), rq = q >= 1 ? 1 : cut(tip - nb.where(p), 0, 0.08); if (rq <= 0) continue; k.ring(p[0], p[1], 1.7, 0.9, seed + 100 + i * 12 + j, { color: WHITE, progress: rq }); } /* rivets, each one as the nib reaches it */
    if (i && bq > 0) [0.44, 0.74].forEach((t, j) => k.pen([spar(i - 1, t), lerp(lerp(spar(i - 1, t), spar(i, t), 0.5), h, -0.03), spar(i, t)], 1.15, { seed: seed + 200 + i * 2 + j, color: WHITE, opacity: 0.85, progress: stagger(bq, 2, 0.7)(j) })); /* cross-braces last */
  });
  const jq = cut(line, 0.1, 0.3);
  if (jq > 0) { k.ring(h[0], h[1], 8.5, 2, seed + 90, { progress: jq }); k.ring(h[0], h[1], 3.2, 1.4, seed + 91, { progress: jq }); if (jq >= 1) k.stipple(oval(h[0], h[1], 8, 8, 10), 60, seed + 92, () => 0.5); }
  if (o.skin && o.lift !== undefined && skinP > 0) { /* the lifted panel goes on last and is knocked out, so it reads as a plate floating above the wing */
    const t = o.liftT ?? 1, pn = panels[o.lift], dx = side * 58 * t, dy = -60 * t, up = pn.map(([x, y]) => [x + dx, y + dy] as P), lq = stagger(skinP, panels.length, 0.5)(o.lift);
    if (lq > 0) {
      if (t > 0.02) { k.pen(pn, 0.9, { seed: seed + 380, closed: true, color: DIM, opacity: 0.6, progress: lq }); k.fill(up.map((q) => lerp(q, cen(up), -0.04)), GROUND, 0.94); [0, 2, 4, 6].forEach((j) => k.dash(pn[j], up[j], 7, 5, 1, { seed: seed + 390 + j, color: CYAN, opacity: 0.9, progress: lq })); }
      drawPanel(pn, o.lift, dx, dy, lq); k.pen(up, 1.9, { seed: seed + 399, closed: true, wobble: 0.3, progress: lq });
    }
  }
};

// ---------------------------------------------------------------- body: abdomen, thorax, head
export const bodyMask = (k: Kit, on = true) => { if (!on) return; k.g.group("plain", () => { k.fill(THORAX, GROUND, 1); k.fill(HEAD, GROUND, 1); }); }; // the body sits OVER the wing roots
export const abdomen = (k: Kit, p = 1) => { if (p <= 0) return; k.ink(() => {
  const segs = 7, y0 = 70, y1 = 238, hw = (t: number) => 23 * (1 - t) ** 0.8 + 6.5;
  const edge = (sd: number): P[] => B(Array.from({ length: 15 }, (_, j) => { const t = j / 14; return [sd * (hw(t) + Math.sin(t * segs * Math.PI) * 1.6), y0 + (y1 - y0) * t] as P; }), 34 + sd);
  const L = edge(-1), R = edge(1), wq = cut(p, 0, 0.3), sq = stagger(cut(p, 0.22, 0.72), segs, 0.4), tq = cut(p, 0.6, 0.94), eq = cut(p, 0.9, 1);
  if (p >= 1) k.g.group("plain", () => k.fill([...L, ...[...R].reverse()], GROUND, 1)); else if (wq >= 1) k.g.group("plain", () => k.fill([...L, ...[...R].reverse()], GROUND, 1));
  k.pen(L, 2.4, { seed: 35, progress: wq }); k.pen(R, 2.8, { seed: 36, progress: wq }); /* both flanks run down from the thorax */
  for (let a = 1; a < segs; a++) { const q = sq(a - 1); if (q <= 0) continue; const t = a / segs, y = y0 + (y1 - y0) * t, w = hw(t); k.pen(B([[-w, y], [0, y + 5.5], [w, y]], 40 + a), 1.5, { seed: 40 + a, progress: q }); k.pen(B([[-w * 0.94, y + 4], [0, y + 9], [w * 0.94, y + 4]], 50 + a), 0.9, { seed: 50 + a, color: CYAN, opacity: 0.8, progress: q }); [-0.55, 0.55].forEach((r, j) => { const c0 = B([[w * r, y - 8]], 60 + a * 2 + j)[0]; k.ring(c0[0], c0[1], 1.8, 0.9, 60 + a * 2 + j, { progress: cut(q, 0.6, 1) }); }); } /* segments stack, rivets ripple after each */
  if (tq > 0) for (let a = 0; a < segs; a++) { const t0 = a / segs, t1 = (a + 1) / segs, ya = y0 + (y1 - y0) * t0 + 7, yb = y0 + (y1 - y0) * t1 + 1, q = stagger(tq, segs, 0.45)(a); if (q <= 0) continue; k.hatch(B([[hw(t0) * 0.34, ya], [hw(t0) * 0.98, ya], [hw(t1) * 0.98, yb], [hw(t1) * 0.34, yb + 3]], 70 + a), 0.78, 3.4, 0.75, 70 + a, { opacity: 0.7, progress: q }); if (a % 2 === 0) k.hatch(B([[hw(t0) * 0.62, ya], [hw(t0) * 0.98, ya], [hw(t1) * 0.98, yb], [hw(t1) * 0.62, yb + 3]], 80 + a), -0.78, 3.6, 0.7, 80 + a, { opacity: 0.6, progress: q }); }
  if (eq > 0) { const tip = B([[0, 238], [0, 262]], 90); [-1, 1].forEach((sd) => k.ln([tip[0][0] + sd * 3.4, tip[0][1] - 3], [tip[1][0] + sd * 2.6, tip[1][1]], 1.5, { seed: 91 + sd, progress: eq })); k.ln([tip[1][0] - 2.6, tip[1][1]], [tip[1][0] + 2.6, tip[1][1]], 1.4, { seed: 93, progress: cut(eq, 0.6, 1) }); } /* winding spindle, squared end */
}); };

// thorax housing, its opened window with the train running inside, head and antennae.
// One ink block, exactly as the approved plate draws it, so the halo matches.
export const thoraxShell = (k: Kit, p: { shell?: number; head?: number } = {}) => { const sp = p.shell ?? 1, hp = p.head ?? 1; if (sp <= 0 && hp <= 0) return; k.ink(() => {
  if (sp > 0) {
    const cq = cut(sp, 0, 0.28), wq = cut(sp, 0.22, 0.45), bq = cut(sp, 0.42, 0.66), tq = cut(sp, 0.62, 1);
    k.pen(THORAX, 3.1, { seed: 100, closed: true, progress: cq });
    const wall = THORAX.map((q, i) => lerp(q, cen(THORAX), 0.13 + (i % 3) * 0.006)); k.pen(wall, 1.2, { seed: 101, closed: true, color: CYAN, progress: wq });
    k.pen(WINDOW, 1.25, { seed: 102, closed: true, wobble: 2.4, progress: bq }); /* the break line is drawn freehand, on purpose, and slower than the rest */
    k.hatch([...THORAX.slice(2, 8), ...wall.slice(2, 8).reverse()], 0.78, 3.6, 0.85, 103, { opacity: 0.85, progress: stagger(tq, 2, 0.75)(0) }); k.hatch([...THORAX.slice(8), THORAX[0], wall[0], ...wall.slice(8).reverse()], 0.78, 3.6, 0.85, 104, { opacity: 0.6, progress: stagger(tq, 2, 0.75)(1) });
  }
  if (hp <= 0) return;
  /* head: compound eyes stippled, a hairspring proboscis, coiled-wire antennae ending in a flat spiral club */
  const hq = cut(hp, 0, 0.25), eq = cut(hp, 0.2, 0.45), pq = cut(hp, 0.4, 0.6), aq = cut(hp, 0.5, 1);
  k.pen(HEAD, 2.5, { seed: 150, closed: true, progress: hq });
  if (eq > 0) [-1, 1].forEach((sd) => { const e = B(k.oval(sd * 17, -112, 8.5, 12, 9), 151 + sd), q = stagger(eq, 2, 0.8)(sd < 0 ? 0 : 1); k.pen(e, 1.5, { seed: 152 + sd, closed: true, progress: q }); if (q >= 1) k.stipple(e, 150, 153 + sd, (x, y) => 0.25 + 0.6 * Math.max(0, (x - e[0][0]) / 20 + (y - e[0][1]) / 40)); });
  if (pq > 0) { const pr = B([[0, -146]], 155)[0]; k.pen(k.spiral(pr[0], pr[1], 1.5, 11.5, 3.2, 1.4), 1.2, { seed: 156, progress: pq }); k.ln([pr[0], pr[1] + 11], [pr[0], pr[1] + 17], 1.2, { seed: 157, progress: cut(pq, 0.7, 1) }); }
  if (aq > 0) [-1, 1].forEach((sd) => { const q = stagger(aq, 2, 0.85)(sd < 0 ? 0 : 1); if (q <= 0) return; const a0 = B([[sd * 8, -127]], 160)[0], a1 = B([[sd * 56, -206]], 161)[0], a2 = B([[sd * 124, -246]], 162)[0], qq = (u: number): P => lerp(lerp(a0, a1, u), lerp(a1, a2, u), u), pts: P[] = []; for (let j = 0; j <= 150; j++) { const u = (j / 150) * 0.9, pt = qq(u), p2 = qq(u + 0.01), dx = p2[0] - pt[0], dy = p2[1] - pt[1], l = Math.hypot(dx, dy) || 1, ph = j * 0.92, amp = 3.6 - u * 1.4; pts.push([pt[0] + (-dy / l) * Math.sin(ph) * amp + (dx / l) * Math.cos(ph) * amp * 0.55, pt[1] + (dx / l) * Math.sin(ph) * amp + (dy / l) * Math.cos(ph) * amp * 0.55]); } k.pen(pts.filter((_, j) => j % 2 === 0), 1.05, { seed: 163 + sd, wobble: 0.1, taper: 0.3, progress: cut(q, 0, 0.8) }); const e = qq(0.9), cl = qq(1); k.pen(k.spiral(cl[0], cl[1], 1.2, 9.5, 2.6, Math.atan2(e[1] - cl[1], e[0] - cl[0])).reverse(), 1.3, { seed: 165 + sd, progress: cut(q, 0.75, 1) }); }); /* the wire coils out from the base, the club winds on at the end */
}); };

// the three wheels seen through the broken-out window: the same train Detail B magnifies, so
// they turn by the same angles. Its own layer, because the housing around it never moves.
export const thoraxTrain = (k: Kit, t: Train, p = 1) => { if (p <= 0) return; k.ink(() => {
  const c = k.raw(), o = cen(THORAX), q = stagger(p, 4, 0.5); c.save(); k.g.path(c, WINDOW); c.clip();
  k.gear(o[0] + 2, o[1] + 4, 23, 16, 0.2 + t.centre, 110, { spokes: 4, w: 1.5, progress: q(1) }); k.gear(o[0] - 14, o[1] - 33, 13, 10, 0.5 + t.third, 120, { spokes: 3, w: 1.3, progress: q(2) }); k.gear(o[0] + 21, o[1] - 26, 9, 8, 0.1 + t.pinion, 130, { spokes: 3, w: 1.2, progress: q(3) }); k.pen(k.spiral(o[0] - 4, o[1] + 34, 2, 13, 3.4, -t.centre * 0.25), 1, { seed: 140, color: CYAN, progress: q(0) });
  c.restore(); k.g.touch(o[0] - 50, o[1] - 80, o[0] + 50, o[1] + 70);
}); };

// ---------------------------------------------------------------- the key, on its centre line
// y: 0 withdrawn (the approved plate), 1 seated on the spindle. turn: radians about the spindle
// axis, which in PLAN VIEW foreshortens the two bows to a line and back, never an in-plane spin.
export const key = (k: Kit, s: { y: number; turn: number; axis?: number; body?: number; note?: number }) => {
  const dy = -38 * s.y, cs = Math.cos(s.turn), still = s.y === 0 && s.turn === 0, ax = s.axis ?? 1, bp = s.body ?? 1, np = s.note ?? 1;
  if (ax <= 0 && bp <= 0 && np <= 0) return;
  const T = (p: P): P => (still ? p : [KC[0] + (p[0] - KC[0]) * cs, p[1] + dy]);
  k.ink(() => {
    k.chain([CX, CY - 168 * K], [CX, CY + 372 * K], 0.9, { seed: 170, color: DIM, opacity: 0.85, progress: ax }); /* the axis of symmetry: long dash, short dash */
    if (bp > 0) {
      const kc: P = still ? KC : [KC[0], KC[1] + dy], sq = cut(bp, 0, 0.3), rq = cut(bp, 0.25, 0.45), wq = cut(bp, 0.4, 1);
      [-1, 1].forEach((sd) => k.ln([kc[0] + sd * 3.2, kc[1] - 34], [kc[0] + sd * 3.2, kc[1] - 6], 1.6, { seed: 171 + sd, progress: sq })); k.ln([kc[0] - 3.2, kc[1] - 34], [kc[0] + 3.2, kc[1] - 34], 1.4, { seed: 173, progress: sq }); k.ring(kc[0], kc[1], 6.5, 1.8, 174, { progress: rq });
      [-1, 1].forEach((sd) => { const q = stagger(wq, 2, 0.75)(sd < 0 ? 0 : 1); if (q <= 0) return; const bow = k.jitter(k.oval(KC[0] + sd * 21, KC[1] + 3, 16, 21, 11, 0.4), 0.9, 175 + sd).map(T); k.pen(bow, 2.2, { seed: 176 + sd, closed: true, progress: cut(q, 0, 0.5) }); k.pen(bow.map((pt) => lerp(pt, cen(bow), 0.42)), 1.3, { seed: 178 + sd, closed: true, progress: cut(q, 0.4, 0.75) }); k.hatch([...bow.slice(3, 9), ...bow.slice(3, 9).map((pt) => lerp(pt, cen(bow), 0.42)).reverse()], 0.78, 3.2, 0.75, 180 + sd, { opacity: 0.75, progress: cut(q, 0.7, 1) }); });
    }
    if (np > 0) { const a: P = [CX + 30, CY + 268 * K], b: P = [CX + 30, CY + 292 * K]; k.ln(b, a, 1.1, { seed: 182, color: CYAN, progress: np }); if (np >= 1) k.arrow(a, -Math.PI / 2, 10, CYAN); } /* INSERT: the note stays put while the key moves */
  });
};

// ---------------------------------------------------------------- drafting furniture on the view
export const furniture = (k: Kit, w: { LF: Wing; RF: Wing; RH: Wing }, p = 1) => { if (p <= 0) return; k.ink(() => {
  const { LF, RF, RH } = w, N = 10, q = stagger(p, N, 0.32); /* the draftsman dimensions the drawing in the order he would: overall size, details, then the notes */
  const a0q = q(0), a1q = q(1), a2q = q(2), a3q = q(3), a4q = q(4);
  /* overall span, with witness lines that stand clear of the object */
  const la = LF.ends[0], ra = RF.ends[0], y = 102; k.ln([la[0], la[1] - 8], [la[0], y - 8], 0.95, { seed: 300, color: CYAN, progress: cut(a0q, 0, 0.4) }); k.ln([ra[0], ra[1] - 8], [ra[0], y - 8], 0.95, { seed: 301, color: CYAN, progress: cut(a0q, 0.2, 0.6) });
  const t = "WINGSPAN 184", tw = width(t, 12.5); k.ln([la[0], y], [CX - tw / 2 - 10, y], 0.95, { seed: 302, color: CYAN, progress: cut(a0q, 0.4, 0.8) }); k.ln([CX + tw / 2 + 10, y], [ra[0], y], 0.95, { seed: 303, color: CYAN, progress: cut(a0q, 0.4, 0.8) }); if (a0q >= 1) { k.arrow([la[0], y], Math.PI, 13); k.arrow([ra[0], y], 0, 13); } k.text(t, CX, y - 6.5, { cap: 12.5, align: "center", seed: 304, progress: cut(a0q, 0.7, 1) });
  /* key width, arrows outside the witness lines because the space between is too tight for them */
  const ky = KC[1] + 46, kx0 = KC[0] - 38, kx1 = KC[0] + 38; k.ln([kx0, KC[1] + 28], [kx0, ky + 6], 0.9, { seed: 310, color: CYAN, progress: cut(a1q, 0, 0.4) }); k.ln([kx1, KC[1] + 28], [kx1, ky + 6], 0.9, { seed: 311, color: CYAN, progress: cut(a1q, 0.2, 0.6) }); k.ln([kx0 - 30, ky], [kx1 + 30, ky], 0.95, { seed: 312, color: CYAN, progress: cut(a1q, 0.4, 0.8) }); if (a1q >= 1) { k.arrow([kx0, ky], 0, 11); k.arrow([kx1, ky], Math.PI, 11); } k.text("22", kx1 + 36, ky - 6, { cap: 11, seed: 314, progress: cut(a1q, 0.7, 1) });
  /* hinge sweep: the folded position in phantom line, and the arc between */
  const rh = RF.h, re = RF.ends[0], b0 = Math.atan2(re[1] - rh[1], re[0] - rh[0]), b1 = b0 - 1.0, R = 150; k.dash(rh, [rh[0] + Math.cos(b1) * 205, rh[1] + Math.sin(b1) * 205], 12, 6, 0.95, { seed: 320, color: DIM, opacity: 0.8, progress: cut(a2q, 0, 0.45) }); k.pen(k.arc(rh[0], rh[1], R, R, b1, b0, 9), 0.95, { seed: 321, color: CYAN, progress: cut(a2q, 0.35, 0.8) }); if (a2q >= 1) { k.arrow([rh[0] + Math.cos(b0) * R, rh[1] + Math.sin(b0) * R], b0 + Math.PI / 2, 10, CYAN); k.arrow([rh[0] + Math.cos(b1) * R, rh[1] + Math.sin(b1) * R], b1 - Math.PI / 2, 10, CYAN); } k.text("57o SWEEP", rh[0] + 12, rh[1] - 226, { cap: 10.5, seed: 322, progress: cut(a2q, 0.75, 1) });
  /* cutting plane A-A through the third abdominal segment, and the detail bubble on the thorax */
  const ya = CY + 146 * K; k.chain([CX - 92, ya], [CX + 92, ya], 1.7, { seed: 330, progress: cut(a3q, 0, 0.5) }); [-1, 1].forEach((sd) => { const qq = cut(a3q, 0.45, 0.85); k.ln([CX + sd * 92, ya], [CX + sd * 92, ya + 26], 2, { seed: 331 + sd, progress: qq }); if (a3q >= 1) k.arrow([CX + sd * 92, ya + 30], Math.PI / 2, 13); k.text("A", CX + sd * 92 + (sd < 0 ? -22 : 10), ya - 4, { cap: 15, seed: 333 + sd, w: 1.9, progress: cut(a3q, 0.8, 1) }); });
  const tc = cen(THORAX); /* the detail bubble is drawn earlier, with the thorax it rings */
  /* parts balloons, in number order */
  const bq = q(5), bs = stagger(bq, 6, 0.45);
  k.balloon("1", [118, 250], LF.spar(1, 0.62), 340, bs(0)); k.balloon("2", [92, 470], cen(LF.panels[3]), 342, bs(1)); k.balloon("3", [968, 128], RF.spar(0, 0.44), 344, bs(2)); k.balloon("4", [676, 700], [tc[0] + 16, tc[1] + 8], 346, bs(3)); k.balloon("5", [420, 742], [KC[0] - 24, KC[1] + 8], 348, bs(4)); k.balloon("6", [960, 640], RH.spar(2, 0.44), 350, bs(5));
  /* notes in the draftsman hand, one line at a time */
  const cq = stagger(Math.max(0, Math.min(1, (p - 0.6) / 0.4)), 6, 0.35);
  k.callout("ANTENNA - COILED WIRE, 2 OFF", [690, 140], [CX + 116 * K, CY - 236 * K], 360, "left", cq(0)); k.callout("PROBOSCIS HAIRSPRING", [468, 140], [CX - 10, CY - 150 * K], 362, "right", cq(1));
  k.callout("PANEL LIFTED", [930, 400], [cen(RF.panels[2])[0] + 84, cen(RF.panels[2])[1] - 30], 364, "left", cq(2)); k.callout("MEMBRANE OMITTED THIS SIDE", [776, 756], RH.spar(4, 0.78), 366, "left", cq(3)); k.callout("INSERT KEY & WIND 7 TURNS", [250, 700], [KC[0] - 40, KC[1] - 4], 368, "right", cq(4));
  k.callout("RIVETS x 96", [176, 140], LF.spar(0, 0.62), 370, "right", cq(5));
}); };

// ---------------------------------------------------------------- SECTION A-A
export const sectionAA = (k: Kit, p = 1) => { if (p <= 0) return; k.ink(() => {
  const c: P = [142, 880], q = stagger(p, 7, 0.36);
  k.ring(c[0], c[1], 56, 2.6, 400, { progress: q(0) }); k.ring(c[0], c[1], 45, 1.5, 401, { progress: q(1) }); k.hatch([...k.oval(c[0], c[1], 56, 56, 28), ...k.oval(c[0], c[1], 45, 45, 28).reverse()], 0.78, 4.2, 0.85, 402, { opacity: 0.9, progress: q(2) }); /* the shell, cut: section-lined */
  k.ring(c[0], c[1], 13, 1.8, 403, { progress: q(3) }); k.hatch(k.oval(c[0], c[1], 13, 13, 16), -0.78, 3.4, 0.8, 404, { opacity: 0.9, progress: q(3) }); /* the shaft is a different part, so its lines run the other way */
  k.gear(c[0], c[1], 30, 14, 0.3, 405, { spokes: 0, w: 1.4, progress: q(4) }); [[-32, -32], [32, -32], [-32, 32], [32, 32]].forEach(([x, y], i) => { k.ring(c[0] + x * 1.13, c[1] + y * 1.13, 3, 1.1, 410 + i, { progress: stagger(q(5), 4, 0.6)(i) }); });
  k.ln([c[0] - 70, c[1]], [c[0] + 70, c[1]], 0.85, { seed: 415, color: DIM, progress: q(5) }); k.ln([c[0], c[1] - 70], [c[0], c[1] + 70], 0.85, { seed: 416, color: DIM, progress: q(5) });
  k.text("SECTION A-A", c[0], c[1] + 70, { cap: 12, align: "center", seed: 417, progress: q(6) }); k.text("SCALE 4 : 1", c[0], c[1] + 92, { cap: 9, align: "center", seed: 418, color: CYAN, progress: cut(q(6), 0.5, 1) });
  k.ln([c[0] - 54, c[1] + 87], [c[0] + 54, c[1] + 87], 1, { seed: 419, progress: cut(q(6), 0.4, 0.9) });
}); };

const DB: P = [392, 898], DR = 100;
const wheels = (): { g1: P; g2: P; g3: P; ew: P; br: P } => { const g1: P = [DB[0] - 22, DB[1] + 16], a2 = -0.87, g2: P = [g1[0] + Math.cos(a2) * 72, g1[1] + Math.sin(a2) * 72]; return { g1, g2, g3: [g2[0] + Math.cos(0.35) * 40, g2[1] + Math.sin(0.35) * 40], ew: [DB[0] + 56, DB[1] + 50], br: [DB[0] - 56, DB[1] - 62] }; };

// DETAIL B, the going train, at 8:1. Live: the four wheels, the mainspring coil and the fork.
export const detailTrain = (k: Kit, t: Train, p = 1) => { if (p <= 0) return; k.ink(() => {
  const { g1, g2, g3, ew, br } = wheels(), cg = k.raw(), q = stagger(p, 6, 0.42); /* one part per beat, in the order a watchmaker lays a train down */
  cg.save(); k.g.path(cg, k.oval(DB[0], DB[1], DR - 3, DR - 3, 40)); cg.clip();
  k.pen(k.spiral(br[0], br[1], 3, 26, 5.2, 0.6 - t.centre * 0.25), 1.15, { seed: 442, progress: q(0) }); /* the mainspring unwinds as the train runs */
  k.gear(g1[0], g1[1], 46, 24, 0.12 + t.centre, 450, { spokes: 5, progress: q(1) }); k.gear(g2[0], g2[1], 26, 14, 0.36 + t.third, 460, { spokes: 4, progress: q(2) }); k.gear(g3[0], g3[1], 14, 8, 0.2 + t.pinion, 470, { spokes: 0, progress: q(3) }); k.gear(ew[0], ew[1], 23, 15, 0.1 + t.escape, 480, { spokes: 4, spike: true, progress: q(4) }); /* centre wheel, third wheel, pinion, escape wheel */
  /* pallet fork astride the escape wheel: it rocks to the opposite side on every tick */
  const fq = q(5); if (fq > 0) { const pv: P = [ew[0] + 4, ew[1] - 36], fc = Math.cos(t.fork), fs = Math.sin(t.fork), F = (x: number, y: number): P => (t.fork === 0 ? [pv[0] + x, pv[1] + y] : [pv[0] + x * fc - y * fs, pv[1] + x * fs + y * fc]);
    k.ring(pv[0], pv[1], 3.4, 1.4, 490, { progress: cut(fq, 0, 0.3) }); [[-25, 16, -21, 25], [24, 12, 27, 22]].forEach(([x, y, x2, y2], i) => { const aq = stagger(cut(fq, 0.25, 1), 2, 0.7)(i); k.pen([pv, F(x * 0.55, y * 0.2), F(x, y)], 1.9, { seed: 491 + i, progress: aq }); k.ln(F(x, y), F(x2, y2), 2.6, { seed: 493 + i, taper: 0.2, progress: cut(aq, 0.7, 1) }); }); }
  cg.restore(); k.g.touch(DB[0] - DR, DB[1] - DR, DB[0] + DR, DB[1] + DR);
}); };

// Static: the boundary, the barrel shell, the bridge over the arbors, the tone and the notes.
export const detailPlate = (k: Kit, p = 1, notes = 1) => { if (p <= 0) return; k.ink(() => {
  const { g1, g2, br, ew } = wheels(), cg = k.raw(), q = stagger(p, 6, 0.4);
  k.pen(k.jitter(k.oval(DB[0], DB[1], DR, DR, 16), 1.2, 430), 1.5, { seed: 430, closed: true, wobble: 1.2, progress: q(0) });
  cg.save(); k.g.path(cg, k.oval(DB[0], DB[1], DR - 3, DR - 3, 40)); cg.clip();
  const bq = q(1); k.ring(br[0], br[1], 31, 2, 440, { progress: cut(bq, 0, 0.4) }); k.ring(br[0], br[1], 27, 1, 441, { color: CYAN, progress: cut(bq, 0.3, 0.6) }); k.ring(br[0], br[1], 3.4, 1.4, 443, { progress: cut(bq, 0.5, 0.7) }); k.hatch([...k.oval(br[0], br[1], 31, 31, 24), ...k.oval(br[0], br[1], 27, 27, 24).reverse()], 0.78, 3, 0.7, 444, { progress: cut(bq, 0.6, 1) }); /* mainspring barrel */
  const gq = q(2), bridge: P[] = [[g1[0] - 8, g1[1] - 9], [g2[0] - 6, g2[1] - 10], [g2[0] + 8, g2[1] + 6], [g1[0] + 9, g1[1] + 9]]; k.pen(poly(bridge, 3), 1.3, { seed: 496, closed: true, color: CYAN, wobble: 0.3, progress: cut(gq, 0, 0.6) }); [lerp(g1, g2, 0.33), lerp(g1, g2, 0.67)].forEach((pt, i) => { const sq = stagger(cut(gq, 0.5, 1), 2, 0.7)(i); k.ring(pt[0], pt[1], 3.6, 1.2, 497 + i, { progress: sq }); k.ln([pt[0] - 2.6, pt[1] - 1.4], [pt[0] + 2.6, pt[1] + 1.4], 1.1, { seed: 499 + i, progress: cut(sq, 0.6, 1) }); }); /* the bridge that carries the arbors, with its two screws */
  if (q(3) >= 1) { k.stipple(k.oval(g1[0], g1[1], 12, 12, 12), 120, 500, () => 0.55); k.stipple(k.oval(g2[0], g2[1], 7, 7, 10), 60, 501, () => 0.55); }
  cg.restore(); k.g.touch(DB[0] - DR, DB[1] - DR, DB[0] + DR, DB[1] + DR);
  const lq = q(4); k.text("DETAIL B", DB[0] + DR + 6, DB[1] - 100, { cap: 12, seed: 510, progress: cut(lq, 0, 0.5) }); k.text("SCALE 8 : 1", DB[0] + DR + 6, DB[1] - 79, { cap: 9, seed: 511, color: CYAN, progress: cut(lq, 0.4, 0.8) }); k.ln([DB[0] + DR + 4, DB[1] - 83.5], [DB[0] + DR + 92, DB[1] - 83.5], 1, { seed: 512, progress: cut(lq, 0.7, 1) });
  const cq = stagger(notes, 4, 0.5); /* the tooth counts are notes, and notes are written in the notes phase */
  k.callout("24 T", [DB[0] + DR + 14, DB[1] + 4], [g1[0] + 44, g1[1] + 14], 513, "left", cq(0)); k.callout("14 T", [DB[0] + DR + 14, DB[1] - 36], [g2[0] + 22, g2[1] + 4], 515, "left", cq(1)); k.callout("ESCAPE WHEEL 15 T", [DB[0] + DR - 4, DB[1] + 86], [ew[0] + 18, ew[1] + 14], 517, "left", cq(2)); k.callout("MAINSPRING", [DB[0] - DR - 6, DB[1] - 112], [br[0] - 8, br[1] - 24], 519, "left", cq(3));
}); };

// ---------------------------------------------------------------- scale bar, parts list, cartouche
export const scaleBar = (k: Kit, p = 1) => { if (p <= 0) return; k.ink(() => { const x = 64, y = 1016, u = 26, q = stagger(p, 7, 0.4); for (let i = 0; i < 5; i++) { const a: P = [x + i * u, y], b: P = [x + (i + 1) * u, y], qq = q(i); if (qq <= 0) continue; if (i % 2 === 0 && qq >= 1) k.fill([[a[0], y - 7], [b[0], y - 7], [b[0], y], [a[0], y]], WHITE, 0.92); k.ln([a[0], y - 7], [b[0], y - 7], 1.2, { seed: 600 + i, progress: qq }); k.ln(a, b, 1.2, { seed: 610 + i, progress: qq }); k.ln([b[0], y - 11], [b[0], y], 1.2, { seed: 620 + i, progress: qq }); } k.ln([x, y - 11], [x, y], 1.2, { seed: 630, progress: q(0) }); ["0", "10", "20", "30", "40", "50"].forEach((t, i) => k.text(t, x + i * u, y - 26, { cap: 8, align: "center", seed: 640 + i, color: CYAN, w: 1, progress: stagger(q(5), 6, 0.5)(i) })); k.text("MM", x + 5 * u + 14, y - 9, { cap: 8.5, seed: 650, color: CYAN, w: 1, progress: q(6) }); }); };

export const partsList = (k: Kit, p = 1) => { if (p <= 0) return; k.ink(() => {
  const x0 = 650, x1 = 1026, y0 = 772, rowH = 15.5, rows: [string, string, string][] = [["1", "WING SPAR, HINGED", "13"], ["2", "MEMBRANE PANEL", "11"], ["3", "KNUCKLE HINGE & PIN", "13"], ["4", "GOING TRAIN ASSY", "1"], ["5", "WINDING KEY", "1"], ["6", "SPAR, HINDWING", "7"]];
  const yb = y0 + rowH * (rows.length + 1), fq = cut(p, 0, 0.3), hq = cut(p, 0.25, 0.45), rq = cut(p, 0.4, 1);
  [[[x0, y0], [x1, y0]], [[x1, y0], [x1, yb]], [[x1, yb], [x0, yb]], [[x0, yb], [x0, y0]]].forEach(([a, b], i) => k.ln(a as P, b as P, 1.7, { seed: 700 + i, taper: 0.15, progress: stagger(fq, 4, 0.5)(i) })); k.ln([x0, y0 + rowH], [x1, y0 + rowH], 1.5, { seed: 705, progress: hq }); [x0 + 34, x1 - 48].forEach((x, i) => k.ln([x, y0], [x, yb], 1, { seed: 706 + i, color: CYAN, progress: hq }));
  [["NO.", x0 + 17], ["DESCRIPTION", (x0 + 34 + x1 - 48) / 2], ["QTY", x1 - 24]].forEach(([t, x], i) => k.text(t as string, x as number, y0 + 3.2, { cap: 8.5, align: "center", seed: 710 + i, color: CYAN, w: 1.05, progress: stagger(hq, 3, 0.6)(i) }));
  const rs = stagger(rq, rows.length, 0.4);
  rows.forEach(([n, d, q], i) => { const y = y0 + rowH * (i + 1), qq = rs(i); if (qq <= 0) return; if (i) k.ln([x0, y], [x1, y], 0.8, { seed: 720 + i, color: DIM, opacity: 0.7, progress: cut(qq, 0, 0.3) }); k.text(n, x0 + 17, y + 3.4, { cap: 8.5, align: "center", seed: 730 + i, w: 1.05, progress: cut(qq, 0.2, 0.45) }); k.text(d, x0 + 42, y + 3.4, { cap: 8.5, seed: 740 + i, w: 1.05, progress: cut(qq, 0.3, 0.85) }); k.text(q, x1 - 24, y + 3.4, { cap: 8.5, align: "center", seed: 750 + i, w: 1.05, progress: cut(qq, 0.8, 1) }); });
}); };

// A draftsman rules the title block early and letters it last of all, so the box and the
// lettering are two different jobs on two different cues.
export const cartouche = (k: Kit, box = 1, text = 1) => { if (box <= 0 && text <= 0) return; k.ink(() => {
  const x0 = 650, x1 = 1026, y0 = 890, y1 = 1026, bq = cut(box, 0, 0.55), lq = cut(box, 0.45, 1);
  [[0, 2.8], [5, 1.1]].forEach(([m, w], j) => [[[x0 + m, y0 + m], [x1 - m, y0 + m]], [[x1 - m, y0 + m], [x1 - m, y1 - m]], [[x1 - m, y1 - m], [x0 + m, y1 - m]], [[x0 + m, y1 - m], [x0 + m, y0 + m]]].forEach(([a, b], i) => k.ln(a as P, b as P, w, { seed: 800 + j * 4 + i, taper: 0.12, progress: stagger(bq, 8, 0.42)(i * 2 + j) })));
  k.ln([x0 + 5, y0 + 62], [x1 - 5, y0 + 62], 1.2, { seed: 812, progress: cut(lq, 0, 0.5) }); k.ln([x0 + 5, y0 + 99], [x1 - 5, y0 + 99], 1, { seed: 813, color: CYAN, progress: cut(lq, 0.3, 0.8) }); [x0 + 128, x0 + 252].forEach((x, i) => k.ln([x, y0 + 62], [x, y1 - 5], 1, { seed: 814 + i, color: CYAN, progress: cut(lq, 0.5, 1) }));
  if (text <= 0) return;
  /* fields first, then the strapline, and the plate's name last of all */
  const f1 = cut(text, 0, 0.3), f2 = cut(text, 0.25, 0.55), sq = cut(text, 0.5, 0.72), tq = cut(text, 0.68, 1);
  ([["PLATE", "I", x0 + 66], ["SCALE", "2 : 1", x0 + 190], ["SHEET", "1 OF 1", x0 + 314]] as [string, string, number][]).forEach(([a, v, x], i) => { const qq = stagger(f1, 3, 0.55)(i); k.text(a, x, y0 + 67, { cap: 7, align: "center", seed: 820 + i, color: CYAN, w: 0.95, progress: cut(qq, 0, 0.5) }); k.text(v, x, y0 + 79, { cap: 12.5, align: "center", seed: 823 + i, w: 1.6, progress: cut(qq, 0.4, 1) }); });
  ([["DRAWN", "F.B.", x0 + 66], ["DIMENSIONS", "MILLIMETRES", x0 + 190], ["DATE", "20 IX 2026", x0 + 314]] as [string, string, number][]).forEach(([a, v, x], i) => { const qq = stagger(f2, 3, 0.55)(i); k.text(a, x, y0 + 104, { cap: 7, align: "center", seed: 830 + i, color: CYAN, w: 0.95, progress: cut(qq, 0, 0.5) }); k.text(v, x, y0 + 116, { cap: 9.5, align: "center", seed: 833 + i, w: 1.2, progress: cut(qq, 0.4, 1) }); });
  k.text("CLOCKWORK BUTTERFLY - GENERAL ARRANGEMENT", (x0 + x1) / 2, y0 + 45, { cap: 8.6, align: "center", seed: 811, color: CYAN, w: 1.05, progress: sq });
  k.text("MECHANICAL LEPIDOPTERA", (x0 + x1) / 2, y0 + 16, { cap: 17, align: "center", seed: 810, w: 2.1, progress: tq });
}); };

// ---------------------------------------------------------------- the surface: dust, then tooth
export const dust = (k: Kit, W: number, H: number) => k.g.group("plain", () => { const c = k.raw(), r = k.rng(77); k.g.touch(0, 0, W, H); for (let i = 0; i < 260; i++) { c.globalAlpha = 0.1 + r() * 0.3; c.fillStyle = r() < 0.75 ? "#dff1fb" : "#06142c"; c.beginPath(); c.arc(r() * W, r() * H, 0.4 + r() * r() * 1.8, 0, Math.PI * 2); c.fill(); } c.globalAlpha = 1; });
export const tooth = (k: Kit) => { k.g.paper("paper", 0.34); k.g.paper("coldpress", 0.2); };
