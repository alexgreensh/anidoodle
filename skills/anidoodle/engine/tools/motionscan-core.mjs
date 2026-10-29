// MOTION SCAN DETECTORS. Pure: frames (or layer records) in, findings out, no I/O, so the unit tests
// feed them synthetic frames and the CLIs (motionscan.mjs, layerscan.mjs) feed them a real film.
// Each detector answers one note the director or a critic gave a brand launch film:
//
//   scanSlideCuts   "a LITERAL SLIDE DECK": most of the frame replaced within 6 frames with no camera move
//   scanRepeats     "moves like a carousel": three beats in a row settle into the same layout
//   scanDissolves   "olive mud" cross-dissolves: a region blends linearly from one picture to another
//   speedProfile    how fast the picture moves, frame by frame, for the brand's motion temperament
//   scanTemperament stretches faster than the temperament allows ("violent")
//   scanExits       text that leaves pixels behind ("pixels left for about half a second")
//   scanFastText    type moving faster than half the speed ceiling (reads as a blurred whip)
//   scanFaceCover   a moving shape drawn over a real person's face ("whack-a-mole", "swallowing the head")
//   scanTranslucent brand colours drawn half-transparent
//
// Frames are greyscale Uint8Arrays of width*height (motion.mjs greyFrames decodes them small).

const median = (xs) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[s.length >> 1]; };

// ---------------------------------------------------------------- motion between two frames
/**
 * Block matching between two small grey frames. Returns the 98th-percentile displacement of the
 * coherent textured blocks (analysis px per frame pair), and `matched`: the share of textured blocks
 * that found their content somewhere nearby. A camera move: high matched, real speed. A cut or a slide
 * reset: low matched. A dissolve or a still: matched at speed 0.
 */
export const motionBetween = (A, Z, W, H, { B = 8, R = 8, subpixel = false } = {}) => {
  const vec = new Map(), frac = new Map(), cols = Math.floor((W - 2 * R - B) / B) + 1; let textured = 0, matched = 0;
  for (let by = R, row = 0; by + B + R <= H; by += B, row++) for (let bx = R, col = 0; bx + B + R <= W; bx += B, col++) {
    let mean = 0, v = 0; for (let y = 0; y < B; y++) for (let x = 0; x < B; x++) mean += A[(by + y) * W + bx + x]; mean /= B * B;
    for (let y = 0; y < B; y++) for (let x = 0; x < B; x++) v += (A[(by + y) * W + bx + x] - mean) ** 2;
    if (v / (B * B) < 12) continue; // flat: no motion can be read off it
    textured++;
    let best = Infinity, mx = 0, my = 0, md = Infinity; const cost = new Float64Array((2 * R + 1) ** 2);
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { let sad = 0; for (let y = 0; y < B; y++) for (let x = 0; x < B; x++) sad += Math.abs(A[(by + y) * W + bx + x] - Z[(by + y + dy) * W + bx + x + dx]); cost[(dy + R) * (2 * R + 1) + dx + R] = sad; if (sad < best) best = sad; }
    if (best / (B * B) > 6) continue; // its content went nowhere nearby: changed, not moved
    matched++;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { const c = cost[(dy + R) * (2 * R + 1) + dx + R], d = Math.hypot(dx, dy); if (c <= best * 1.1 + B * B * 0.5 && d < md) { md = d; mx = dx; my = dy; } }
    // a match on content that was already there, unchanged, is not a move: the block was covered (a reveal
    // edge, a bloom's rim) and its look-alike beside it stood still. Text beside text matched a few letters
    // over and read as the fastest thing in the frame (a launch film's end bloom, 51 px a frame).
    if (mx || my) { let still = 0; for (let y = 0; y < B; y++) for (let x = 0; x < B; x++) { const i = (by + y + my) * W + bx + x + mx; still += Math.abs(A[i] - Z[i]); } if (still / (B * B) <= 6) continue; }
    vec.set(row * cols + col, [mx, my]);
    // asked for (`subpixel`, the speed profile), the move between whole pixels: a parabola through the block's
    // cost at its best whole shift and its two neighbours on each axis, about the cheapest shift found. One
    // analysis pixel is 8 to 15 px of the film, and word lines carried at 1.4 pixels a frame read 1 or 2 by
    // turns (and 2 failed a calm brand on a phone frame). Neighbour agreement still uses the whole shifts
    if (subpixel) {
      // (about the shift the block was given, the nearest of the near-best: on a repeating texture the cheapest
      // shift can be a period away, and a parabola there would measure the pattern, not the move)
      const bx0 = mx, by0 = my, at = (dx, dy) => cost[(dy + R) * (2 * R + 1) + dx + R], c0 = at(bx0, by0);
      const sub = (ea, e0, eb) => { const d = ea - 2 * e0 + eb; return d > 1e-9 ? Math.max(-0.5, Math.min(0.5, (ea - eb) / (2 * d))) : 0; };
      const fx = bx0 > -R && bx0 < R ? sub(at(bx0 - 1, by0), c0, at(bx0 + 1, by0)) : 0, fy = by0 > -R && by0 < R ? sub(at(bx0, by0 - 1), c0, at(bx0, by0 + 1)) : 0;
      frac.set(row * cols + col, Math.hypot(bx0 + fx, by0 + fy));
    }
  }
  const disp = [];
  for (const [key, [x, y]] of vec) { const r = Math.floor(key / cols), c = key % cols; let agree = 0; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { if (!dr && !dc) continue; const nb = vec.get((r + dr) * cols + c + dc); if (nb && c + dc >= 0 && c + dc < cols && Math.hypot(nb[0] - x, nb[1] - y) <= 1.5) agree++; } if (agree >= 2) disp.push(subpixel ? frac.get(key) : Math.hypot(x, y)); }
  disp.sort((a, b) => a - b);
  return { speed: disp.length ? disp[Math.min(disp.length - 1, Math.floor(disp.length * 0.98))] : 0, matched: textured ? matched / textured : 1, textured };
};

// ---------------------------------------------------------------- the camera's own move
const down = (f, W, H, k) => { const w = Math.floor(W / k), h = Math.floor(H / k), o = new Float32Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0; for (let yy = 0; yy < k; yy++) for (let xx = 0; xx < k; xx++) s += f[(y * k + yy) * W + x * k + xx]; o[y * w + x] = s / (k * k); } return { o, w, h }; };
// mean absolute difference of A against Z seen through a zoom s about the centre and a shift (dx, dy), over the overlap
const warpErr = (A, Z, w, h, s, dx, dy) => { let e = 0, n = 0; const cx = w / 2, cy = h / 2; for (let y = 1; y < h - 1; y += 1) for (let x = 1; x < w - 1; x += 1) { const u = Math.round(cx + (x - cx) * s + dx), v = Math.round(cy + (y - cy) * s + dy); if (u < 0 || v < 0 || u >= w || v >= h) continue; e += Math.abs(A[y * w + x] - Z[v * w + u]); n++; } return n > (w * h) / 4 ? e / n : Infinity; };
/**
 * The camera's move between two frames as ONE zoom and shift for the whole picture (coarse to fine, up
 * to a third of the frame per step). `explained`: how much of the difference that move accounts for
 * (1 - err / err at rest). A pan, a push-in or a pull-out explains most of it; a cut or a swapped slide
 * explains none, whatever the texture: flat cards on a flat ground still move as one.
 */
export const globalMotion = (A, Z, W, H, { between = false, subpixel = false } = {}) => {
  const k = Math.max(1, Math.floor(W / 48)), a = down(A, W, H, k), z = down(Z, W, H, k), R = Math.ceil(a.w / 6);
  const e0 = warpErr(a.o, z.o, a.w, a.h, 1, 0, 0);
  let best = { e: e0, s: 1, dx: 0, dy: 0 };
  for (const sc of [1, 0.94, 0.97, 1.03, 1.06]) for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { const e = warpErr(a.o, z.o, a.w, a.h, sc, dx, dy); if (e < best.e - 1e-9) best = { e, s: sc, dx, dy }; }
  // refine the shift at full size within one coarse cell: a 3 px pan must read as 3, not as a whole cell
  const f0 = Float32Array.from(A), f1 = Float32Array.from(Z); let fine = { e: warpErr(f0, f1, W, H, best.s, best.dx * k, best.dy * k), dx: best.dx * k, dy: best.dy * k };
  for (let dy = -k; dy <= k; dy++) for (let dx = -k; dx <= k; dx++) { const e = warpErr(f0, f1, W, H, best.s, best.dx * k + dx, best.dy * k + dy); if (e < fine.e - 1e-9) fine = { e, dx: best.dx * k + dx, dy: best.dy * k + dy }; }
  // and, asked for (`between`), the zooms between the coarse steps, at full size and sub-pixel shifts: a camera
  // leaning in at about 1 % a frame matched neither 1 nor 1.03, so its push-in explained under half the
  // change and read as a slide cut (a clean chat's lean onto its answer card, thin type on a sparse frame,
  // where a shift off by half a pixel misses every stroke). Slide cuts ask for it on the few frames they judge.
  let sc = best.s;
  if (between) {
    // (both frames softened by a 3 x 3 box first: a stroke one pixel wide resampled half a pixel over is a
    // different set of pixels, and the fit would judge the sampling, not the move)
    const soft = (F) => { const o = new Float32Array(W * H); for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { let t = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) t += F[(y + j) * W + x + i]; o[y * W + x] = t / 9; } return o; };
    const s0 = soft(f0), s1 = soft(f1);
    const lin = (F, x, y) => { const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, i = y0 * W + x0; return (1 - fy) * ((1 - fx) * F[i] + fx * F[i + 1]) + fy * ((1 - fx) * F[i + W] + fx * F[i + W + 1]); };
    const err = (s2, dx, dy) => { let e = 0, n = 0; const cx = W / 2, cy = H / 2; for (let y = 3; y < H - 3; y++) for (let x = 3; x < W - 3; x++) { const u = cx + (x - cx) * s2 + dx, v = cy + (y - cy) * s2 + dy; if (u < 2 || v < 2 || u >= W - 3 || v >= H - 3) continue; e += Math.abs(s0[y * W + x] - lin(s1, u, v)); n++; } return n > (W * H) / 4 ? e / n : Infinity; };
    const rest2 = err(1, 0, 0);
    let b2 = { e: err(best.s, fine.dx, fine.dy), s: best.s, dx: fine.dx, dy: fine.dy };
    for (let ds = -0.02; ds <= 0.0201; ds += 0.0025) for (let dy = -1.5; dy <= 1.5; dy += 0.25) for (let dx = -1.5; dx <= 1.5; dx += 0.25) { const e = err(best.s + ds, fine.dx + dx, fine.dy + dy); if (e < b2.e - 1e-9) b2 = { e, s: best.s + ds, dx: fine.dx + dx, dy: fine.dy + dy }; }
    // judged on the softened frames, so both errors are: the share of the change the move explains
    // (its speed is the fastest point of the frame, a corner, under the zoom and the shift together: a lean that
    // pans as it zooms moves its corners by both, and neither alone says how far the picture moved)
    const corner = Math.max(...[[0, 0], [W, 0], [0, H], [W, H]].map(([x, y]) => Math.hypot((b2.s - 1) * (x - W / 2) + b2.dx, (b2.s - 1) * (y - H / 2) + b2.dy)));
    if (rest2 > 0 && 1 - b2.e / rest2 > 1 - fine.e / warpErr(f0, f1, W, H, 1, 0, 0)) return { speed: corner, explained: Math.max(0, 1 - b2.e / rest2), dx: b2.dx, dy: b2.dy, scale: +b2.s.toFixed(4), err: b2.e, rest: warpErr(f0, f1, W, H, 1, 0, 0) };
  }
  // the shift between whole pixels: a parabola through the error at the best whole shift and its two
  // neighbours, on each axis. One analysis pixel is 8 to 15 px of the film, and a travel at 1.46 pixels a frame
  // read as 1 or 2 by turns: its 2s failed a calm brand's limit on a phone frame, which the move never reached.
  // The speed profile asks for it (`subpixel`); slide cuts keep whole pixels, their "it moved" floor is one
  const sub = (ea, e0, eb) => { const d = ea - 2 * e0 + eb; return d > 1e-9 ? Math.max(-0.5, Math.min(0.5, (ea - eb) / (2 * d))) : 0; };
  const ox = subpixel ? sub(warpErr(f0, f1, W, H, sc, fine.dx - 1, fine.dy), fine.e, warpErr(f0, f1, W, H, sc, fine.dx + 1, fine.dy)) : 0;
  const oy = subpixel ? sub(warpErr(f0, f1, W, H, sc, fine.dx, fine.dy - 1), fine.e, warpErr(f0, f1, W, H, sc, fine.dx, fine.dy + 1)) : 0;
  const rest = warpErr(f0, f1, W, H, 1, 0, 0), shift = Math.hypot(fine.dx + ox, fine.dy + oy), zoom = Math.abs(sc - 1) * W / 2;
  return { speed: Math.max(shift, zoom), explained: rest > 0.05 ? Math.max(0, 1 - fine.e / rest) : 0, dx: fine.dx, dy: fine.dy, scale: sc, err: fine.e, rest };
};

const changedShare = (a, b, thresh) => { let n = 0; for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > thresh) n++; return n / a.length; };
// the ground: the most common grey level (a dark or a paper background), read off a 32-level histogram
const groundOf = (f) => { const h = new Uint32Array(32); for (let i = 0; i < f.length; i += 3) h[f[i] >> 3]++; let b = 0; for (let k = 1; k < 32; k++) if (h[k] > h[b]) b = k; return b * 8 + 4; };
/**
 * Of the pixels that hold CONTENT in either frame (not the plain ground), the share that changed. A deck
 * on a dark ground keeps most pixels dark from slide to slide; what it replaces is the content.
 */
export const contentReplaced = (a, b, thresh = 16) => {
  const ga = groundOf(a), gb = groundOf(b); let content = 0, changed = 0;
  for (let i = 0; i < a.length; i++) { if (Math.abs(a[i] - ga) <= 12 && Math.abs(b[i] - gb) <= 12) continue; content++; if (Math.abs(a[i] - b[i]) > thresh) changed++; }
  return content < a.length * 0.01 ? 0 : changed / content;
};

// ---------------------------------------------------------------- slide cuts
/**
 * A slide cut: more than `replaced` of the frame's CONTENT pixels (contentReplaced: the plain ground
 * does not count) change within `win` frames while the camera is not travelling (the content did not
 * move there, it was swapped). Fades count: a dissolve between two layouts is the same deck transition, slower. Fails when any 60 s stretch holds more than
 * `perMinute` (2) of them. `allow`: [from, to] frame ranges that are deliberate (a hard cut on a beat).
 */
export const scanSlideCuts = (frames, { width: W, height: H, fps, win = 6, replaced = 0.6, thresh = 16, perMinute = 2, allow = [] } = {}) => {
  const n = frames.length, rep = new Float64Array(n);
  for (let f = win; f < n; f++) rep[f] = contentReplaced(frames[f - win], frames[f], thresh);
  const events = [];
  for (let f = win; f < n; f++) {
    if (rep[f] < replaced) continue;
    let peak = f; while (f + 1 < n && rep[f + 1] >= replaced) { f++; if (rep[f] > rep[peak]) peak = f; }
    const a = Math.max(1, peak - win), pairs = [];
    for (let g = a; g <= peak; g++) pairs.push(globalMotion(frames[g - 1], frames[g], W, H, { between: true }));
    // the camera carried it: on the pairs where the picture changed, one zoom and shift explains most of the change
    // (a change spread so thin that no single step shows it is a slow drift or a fade: dissolve's business, not a cut)
    const changing = pairs.filter((p) => p.rest > 0.05), travel = !changing.length || (median(changing.map((p) => p.explained)) >= 0.5 && median(changing.map((p) => p.speed)) >= 1);
    if (travel || allow.some(([x, y]) => peak >= x && peak < y)) continue;
    events.push({ frame: peak, from: a, replaced: +rep[peak].toFixed(3), explained: +median(changing.map((p) => p.explained)).toFixed(2) });
  }
  const span = Math.round(60 * fps), dense = [];
  for (let i = 0; i < events.length; i++) { const inWin = events.filter((e) => e.frame >= events[i].frame && e.frame < events[i].frame + span); if (inWin.length > perMinute) { dense.push(inWin.map((e) => e.frame)); } }
  return { events, fail: dense.length > 0, worst: dense.sort((a, b) => b.length - a.length)[0] ?? [], perMinute };
};

// ---------------------------------------------------------------- repeated layouts (the carousel)
const pool = (f, W, H, k) => { const w = Math.floor(W / k), h = Math.floor(H / k), o = new Float32Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let s = 0; for (let yy = 0; yy < k; yy++) for (let xx = 0; xx < k; xx++) s += f[(y * k + yy) * W + x * k + xx]; o[y * w + x] = s / (k * k); } return { o, w, h }; };
/** Where a settled frame has content: a cols x rows grid of cells with edges in them (text, photos, shapes). */
export const layoutOf = (f, W, H, { cols = 32, rows = 18, edge = 10 } = {}) => {
  const occ = new Uint8Array(cols * rows), e = new Float64Array(cols * rows), cnt = new Uint32Array(cols * rows);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { const g = Math.abs(f[y * W + x + 1] - f[y * W + x - 1]) + Math.abs(f[(y + 1) * W + x] - f[(y - 1) * W + x]); const c = Math.min(rows - 1, Math.floor((y * rows) / H)) * cols + Math.min(cols - 1, Math.floor((x * cols) / W)); e[c] += g; cnt[c]++; }
  for (let i = 0; i < occ.length; i++) occ[i] = cnt[i] && e[i] / cnt[i] > edge ? 1 : 0;
  return occ;
};
export const layoutIoU = (a, b) => { let i = 0, u = 0; for (let k = 0; k < a.length; k++) { if (a[k] && b[k]) i++; if (a[k] || b[k]) u++; } return u ? i / u : 1; };
/**
 * Beats that settle into the same layout with new content, three or more in a row: the template ran
 * again. A beat is a settled stretch (under `still` of the frame changing per frame, judged on a coarse
 * copy so a breathing camera still counts as settled) at least `hold` seconds long.
 */
export const scanRepeats = (frames, { width: W, height: H, fps, hold = 0.4, still = 0.01, same = 0.75, newContent = 0.05, run = 3 } = {}) => {
  const k = Math.max(1, Math.floor(W / 64)), small = frames.map((f) => pool(f, W, H, k)), sw = small[0]?.w ?? 0, sh = small[0]?.h ?? 0, minLen = Math.max(2, Math.round(hold * fps));
  const holds = []; let start = 0;
  const settledAt = (f) => { let n = 0; const a = small[f - 1].o, b = small[f].o; for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 6) n++; return n / a.length < still; };
  for (let f = 1; f <= frames.length; f++) { if (f < frames.length && settledAt(f)) continue; if (f - start >= minLen) holds.push([start, f]); start = f; }
  const beats = holds.map(([a, b]) => { const m = (a + b) >> 1; return { from: a, to: b, mid: m, layout: layoutOf(frames[m], W, H) }; });
  const links = []; // beat i and i+1 share a layout and show new content
  for (let i = 1; i < beats.length; i++) links.push(layoutIoU(beats[i - 1].layout, beats[i].layout) >= same && contentReplaced(frames[beats[i - 1].mid], frames[beats[i].mid]) >= newContent);
  const runs = []; let i = 0;
  while (i < links.length) { if (!links[i]) { i++; continue; } let j = i; while (j < links.length && links[j]) j++; if (j - i + 1 >= run) runs.push(beats.slice(i, j + 1).map((b) => [b.from, b.to])); i = j; }
  return { beats: beats.map(({ from, to }) => [from, to]), runs, fail: runs.length > 0, size: [sw, sh] };
};

// ---------------------------------------------------------------- dissolves
/**
 * A cross-dissolve or fade: inside a tile, frame t equals A + a(t) (B - A) for a rising a(t), over at
 * least `minFrames` frames, where A and B are the pictures before and after: pixels blending, nothing
 * moving. Findings are merged across tiles per stretch of frames, with `area` (share of the frame) and
 * `share` (of the tiles that changed at all in that stretch, how many blended). It FAILS when the blend
 * is how the stretch changes (share >= 0.5) over at least `minArea` of the frame: a dissolve seam, or a
 * card faded in instead of moved in (motion-grammar bans both). Small fades (a caption) are listed.
 */
export const scanDissolves = (frames, { width: W, height: H, grid = 8, minFrames = 6, minDelta = 10, fit = 0.25, minArea = 0.05, allow = [] } = {}) => {
  const n = frames.length, tiles = [];
  for (let ty = 0; ty < grid; ty++) for (let tx = 0; tx < grid; tx++) tiles.push([Math.floor((tx * W) / grid), Math.floor((ty * H) / grid), Math.floor(((tx + 1) * W) / grid), Math.floor(((ty + 1) * H) / grid)]);
  const tdiff = (a, b, [x0, y0, x1, y1]) => { let s = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) s += Math.abs(a[y * W + x] - b[y * W + x]); return s / ((x1 - x0) * (y1 - y0)); };
  const hits = [], diffs = [];
  tiles.forEach((t, ti) => {
    const d = new Float64Array(n); for (let f = 1; f < n; f++) d[f] = tdiff(frames[f - 1], frames[f], t); diffs.push(d);
    for (let f = 1; f < n; f++) {
      if (d[f] < 0.4) continue;
      const a = f; while (f + 1 < n && d[f + 1] >= 0.4) f++;
      const b = f; if (b - a + 1 < minFrames) continue;
      const A = frames[a - 1], Bf = frames[b], [x0, y0, x1, y1] = t;
      let dd = 0, cnt = 0; for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const q = Bf[y * W + x] - A[y * W + x]; dd += q * q; cnt++; }
      if (Math.sqrt(dd / cnt) < minDelta) continue;
      let ok = true, mid = 0, last = -Infinity;
      for (let g = a; g < b; g++) {
        let num = 0, res = 0; const F = frames[g];
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = y * W + x; num += (F[i] - A[i]) * (Bf[i] - A[i]); }
        const al = num / dd;
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = y * W + x, p = A[i] + al * (Bf[i] - A[i]); res += (F[i] - p) ** 2; }
        if (Math.sqrt(res / cnt) > fit * Math.sqrt(dd / cnt) || al < last - 0.05) { ok = false; break; }
        last = al; if (al > 0.1 && al < 0.9) mid++;
      }
      if (ok && mid >= Math.min(4, minFrames - 2)) hits.push({ tile: ti, from: a, to: b + 1 });
    }
  });
  // merge tiles whose stretches overlap into one finding per seam
  hits.sort((p, q) => p.from - q.from); const out = [];
  for (const h of hits) { const g = out.find((o) => h.from < o.to && h.to > o.from); if (g) { g.from = Math.min(g.from, h.from); g.to = Math.max(g.to, h.to); g.tiles.add(h.tile); } else out.push({ from: h.from, to: h.to, tiles: new Set([h.tile]) }); }
  const findings = out.map((o) => {
    let moving = 0; for (const d of diffs) { let any = false; for (let f = o.from; f < Math.min(n, o.to); f++) if (d[f] >= 0.4) { any = true; break; } if (any) moving++; }
    const area = +(o.tiles.size / tiles.length).toFixed(3), share = +(o.tiles.size / Math.max(1, moving)).toFixed(2);
    return { from: o.from, to: o.to, area, share, seam: area >= minArea && share >= 0.5, allowed: allow.some(([x, y]) => o.from < y && o.to > x) };
  });
  return { findings, fail: findings.some((f) => f.seam && !f.allowed), minArea };
};

// ---------------------------------------------------------------- speed and temperament
// the temperaments' top speeds as shares of speedCeiling, as motionKit.ts defines them (kept here so the
// tool needs no bundler); test/motionscan.test.ts holds the two equal
export const TEMPERAMENT_MAX = { calm: 0.35, lively: 0.55, snappy: 0.8 };
/** Per-frame on-screen speed in FULL-SIZE px per frame (scale = full width / analysis width). Frame 0 is 0. */
export const speedProfile = (frames, { width: W, height: H, scale = 1, R = 8 } = {}) => {
  const out = [0];
  for (let f = 1; f < frames.length; f++) { const g = globalMotion(frames[f - 1], frames[f], W, H, { subpixel: true }), cam = g.explained >= 0.5 ? g.speed : 0; out.push(Math.max(cam, motionBetween(frames[f - 1], frames[f], W, H, { R, subpixel: true }).speed) * scale); } // the camera's move, or the fastest coherent element
  return out;
};
/** Stretches of at least `min` frames moving faster than `maxPx` per frame: past the temperament ("violent"). */
export const scanTemperament = (speeds, { maxPx, min = 3 } = {}) => {
  const out = []; for (let f = 0; f < speeds.length; f++) { if (speeds[f] <= maxPx) continue; const a = f; let top = speeds[f]; while (f + 1 < speeds.length && speeds[f + 1] > maxPx) { f++; top = Math.max(top, speeds[f]); } if (f - a + 1 >= min) out.push({ from: a, to: f + 1, top: +top.toFixed(1) }); }
  return { stretches: out, fail: out.length > 0, maxPx };
};

// ---------------------------------------------------------------- layer-record detectors (layerscan)
const lineLabel = (r) => r.kind === "text" && (r.src === "probe" || r.label.trim().length > 1);
/**
 * Text that leaves pixels behind. `series`: per text line, [{ frame, ink }] (visible ink, px) over its
 * life. Its residue is the run at the END of its life where it shows ink but under `tail` (35 %) of its
 * peak: slivers of letters lingering at a clip edge. `max` seconds of that fails (0.2 s, 6 frames at 30
 * fps). An ease-in sink over 1.3x the size crosses that band in about 2 frames; the ease-out 1.0x sink
 * of a brand launch film sat in it for half its exit and left a fifth of the letters showing.
 */
export const scanExits = (series, { fps, tail = 0.35, max = 0.2 } = {}) => {
  const limit = Math.max(2, Math.round(max * fps)), out = [];
  for (const [label, pts] of Object.entries(series)) {
    const peak = Math.max(0, ...pts.map((p) => p.ink)); if (!peak) continue;
    let k = pts.length - 1; while (k >= 0 && pts[k].ink === 0) k--; // frames where it is drawn but fully clipped show nothing: not residue
    let n = 0; const end = k; while (k >= 0 && pts[k].ink > 0 && pts[k].ink <= tail * peak) { n++; k--; }
    if (n >= limit) out.push({ label, from: pts[k + 1].frame, to: pts[end].frame + 1, frames: n, seconds: +(n / fps).toFixed(2), peak, last: pts[end].ink });
  }
  return { findings: out, fail: out.length > 0, limit };
};
/** Each line of text's box per frame, keyed by label: { label: [{ frame, x0, y0, x1, y1 }] } (lines, not per-character fills). */
export const textLines = (layers) => { const out = {}; for (const { frame, recs } of layers) { const seen = new Set(); for (const r of recs) { if (!lineLabel(r) || seen.has(r.label)) continue; seen.add(r.label); (out[r.label] ??= []).push({ frame, x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1 }); } } return out; };
/**
 * Type moving faster than `ratio` x speedCeiling (2.5 frame widths a second) on consecutive checked frames:
 * a whip, not a read. `step`: the frames were sampled every `step` frames (layerscan --every), so two
 * checked frames `step` apart are neighbours and the move between them is shared over `step` frames.
 * Without it a sampled scan never saw two neighbours and could not fire.
 */
export const scanFastText = (layers, { W, fps, scale = 1, ratio = 0.5, min = 2, step = 1 } = {}) => {
  const cap = ((2.5 * W) / fps) * ratio * scale, lines = textLines(layers), out = [];
  for (const [label, pts] of Object.entries(lines)) {
    let run = [];
    const flush = () => { if (run.length >= min) out.push({ label, from: run[0].frame, to: run[run.length - 1].frame + 1, top: +Math.max(...run.map((r) => r.v)).toFixed(1) }); run = []; };
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i]; if (b.frame !== a.frame + step) { flush(); continue; }
      const v = Math.hypot((b.x0 + b.x1 - a.x0 - a.x1) / 2, (b.y0 + b.y1 - a.y0 - a.y1) / 2) / step;
      if (v > cap) run.push({ frame: b.frame, v: v / scale }); else flush();
    }
    flush();
  }
  return { findings: out, fail: out.length > 0, cap: +(cap / scale).toFixed(1) };
};
const overlap = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
/**
 * A real person's face covered by a moving shape. The face is the top `face` (30 %) of a photo's box
 * (cut-outs are framed head-first); a box drawn AFTER the photo that covers more than `min` of the
 * face, and moved against the photo since the frame before, is the "whack-a-mole" the critic named.
 * The person enters and leaves WITH their stage; nothing slides across them.
 */
export const scanFaceCover = (layers, { face = 0.3, min = 0.1 } = {}) => {
  const out = new Map(); let prev = null;
  for (const { frame, recs } of layers) {
    const photos = recs.filter((r) => r.kind === "photo"), boxes = recs.filter((r) => r.kind === "box");
    for (const p of photos) {
      const fb = { x0: p.x0, y0: p.y0, x1: p.x1, y1: p.y0 + (p.y1 - p.y0) * face }, area = (fb.x1 - fb.x0) * (fb.y1 - fb.y0); if (!(area > 0)) continue;
      for (const b of boxes) {
        if (b.order < p.order || overlap(fb, b) / area < min) continue;
        const pp = prev?.recs.find((r) => r.kind === "photo" && r.label === p.label), pb = prev?.recs.find((r) => r.kind === "box" && r.label === b.label);
        const moved = pp && pb ? Math.hypot((b.x0 - p.x0) - (pb.x0 - pp.x0), (b.y0 - p.y0) - (pb.y0 - pp.y0)) > 0.5 : false;
        if (!moved) continue;
        const k = `${p.label}|${b.label}`, e = out.get(k) ?? { photo: p.label, shape: b.label, frames: [] }; e.frames.push(frame); out.set(k, e);
      }
    }
    prev = { frame, recs };
  }
  const findings = [...out.values()];
  return { findings, fail: findings.length > 0 };
};
/** Frames where a brand colour was filled at a translucent alpha, outside the film's declared fades. */
export const scanTranslucent = (layers, { allow = [] } = {}) => {
  const out = new Map();
  for (const { frame, translucent } of layers) for (const t of translucent ?? []) { if (allow.some(([a, b]) => frame >= a && frame < b)) continue; const e = out.get(t.colour) ?? { colour: t.colour, frames: [], alphas: new Set() }; if (e.frames[e.frames.length - 1] !== frame) e.frames.push(frame); e.alphas.add(Math.round(t.alpha * 100)); out.set(t.colour, e); }
  const findings = [...out.values()].map((e) => ({ colour: e.colour, frames: e.frames, alphas: [...e.alphas].sort((a, b) => a - b) }));
  return { findings, fail: findings.length > 0 };
};

/** The file a motion scan reads: a path to any video file as given, else out/<film>.mp4 (a .mov or .m4v was rewritten to out/x.mov.mp4). */
export const scanTarget = (arg) => (/\.(mp4|mov|m4v|mkv|webm)$/i.test(String(arg)) ? String(arg) : `out/${arg}.mp4`);
