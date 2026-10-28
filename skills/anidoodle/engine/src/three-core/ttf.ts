// TTF. A small TrueType reader with no library behind it, so 3D type needs nothing fetched and
// nothing new vendored: the font arrives as bytes inside the film (a base64 string module) and is
// parsed here, the same on every machine. It reads only what extruded and flat type need:
//
//   cmap        character -> glyph (format 4 for the BMP, format 12 for the rest)
//   head/maxp   units per em, how loca is stored, glyph count
//   loca/glyf   outlines: simple glyphs (quadratic curves, implied on-curve points) and composites
//   hhea/hmtx   advance widths
//   kern / GPOS pair kerning (kern format 0; GPOS lookup type 2, formats 1 and 2, via extensions too)
//   OS/2, name  cap height, and the family / licence strings so a test can check what was bundled
//
// Outlines come out in FONT UNITS, y up, as contours of quadratic segments. CFF fonts (.otf with
// PostScript outlines) are refused by name: they hold cubic curves in a different program format.
//
//   const font = parseTTF(bytes)          bytes: Uint8Array | ArrayBuffer | base64 string
//   font.glyphIndex("A".codePointAt(0)!)  -> glyph id (0 = .notdef, the font has no such letter)
//   font.glyph(id)                        -> { contours, advance, lsb, bbox }
//   font.kerning(left, right)             -> font units to add between two glyph ids

export type Seg = ["M", number, number] | ["L", number, number] | ["Q", number, number, number, number];
/** one closed outline: an "M" then L/Q segments, ending back at the start */
export type Contour = Seg[];
export type GlyphOutline = { id: number; contours: Contour[]; advance: number; lsb: number; bbox: [xMin: number, yMin: number, xMax: number, yMax: number] };
export type Font = {
  /** a short stable id (family, style, byte length, checksum): the cache key for anything built from it */
  id: string;
  family: string; style: string; copyright: string; license: string; licenseUrl: string;
  unitsPerEm: number; ascender: number; descender: number; lineGap: number; capHeight: number; xHeight: number;
  numGlyphs: number;
  glyphIndex(codePoint: number): number;
  glyph(id: number): GlyphOutline;
  kerning(left: number, right: number): number;
};

const fail = (msg: string): never => { throw new Error(`ttf: ${msg}`); };

/** bytes from a Uint8Array, an ArrayBuffer or a base64 string (how films carry the font) */
export const fontBytes = (src: Uint8Array | ArrayBuffer | string): Uint8Array => {
  if (src instanceof Uint8Array) return src;
  if (src instanceof ArrayBuffer) return new Uint8Array(src);
  const bin = atob(src.replace(/\s+/g, "")), u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
};

export const parseTTF = (src: Uint8Array | ArrayBuffer | string): Font => {
  const u8 = fontBytes(src);
  if (u8.length < 12) fail(`only ${u8.length} bytes: this is not a font file (truncated?)`);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const tag = (o: number) => String.fromCharCode(u8[o], u8[o + 1], u8[o + 2], u8[o + 3]);
  const sig = tag(0);
  if (sig === "OTTO") fail("this font has CFF outlines; use a TrueType .ttf");
  if (sig === "ttcf") fail("this is a font collection (.ttc); export the one face you want as a .ttf");
  if (sig === "wOFF" || sig === "wOF2") fail(`this is a ${sig === "wOFF" ? "WOFF" : "WOFF2"} web font (compressed); use the TrueType .ttf it was made from`);
  if (dv.getUint32(0) !== 0x00010000 && sig !== "true") fail(`unknown font signature '${sig}'; use a TrueType .ttf`);

  // ---- table directory. Every read below is bounds-checked by DataView, but a truncated file
  // would throw a bare RangeError: check each table fits first and say which one is cut short.
  const tables = new Map<string, { off: number; len: number }>();
  const n = dv.getUint16(4);
  if (12 + n * 16 > u8.length) fail(`the table directory is cut short (${n} tables, ${u8.length} bytes): truncated file`);
  for (let i = 0; i < n; i++) {
    const o = 12 + i * 16, t = tag(o), off = dv.getUint32(o + 8), len = dv.getUint32(o + 12);
    if (off + len > u8.length) fail(`table '${t}' runs past the end of the file (needs ${off + len} bytes, has ${u8.length}): truncated file`);
    tables.set(t, { off, len });
  }
  if (tables.has("CFF ") || tables.has("CFF2")) fail("this font has CFF outlines; use a TrueType .ttf");
  const need = (t: string) => tables.get(t) ?? fail(`missing required table '${t}'`);
  const u16 = (o: number) => dv.getUint16(o), i16 = (o: number) => dv.getInt16(o), u32 = (o: number) => dv.getUint32(o);

  const head = need("head").off, maxp = need("maxp").off, hhea = need("hhea").off, hmtx = need("hmtx").off;
  const loca = need("loca").off, glyf = need("glyf"), cmapT = need("cmap").off;
  const unitsPerEm = u16(head + 18), longLoca = i16(head + 50) === 1, numGlyphs = u16(maxp + 4);
  const ascender = i16(hhea + 4), descender = i16(hhea + 6), lineGap = i16(hhea + 8), nHM = u16(hhea + 34);

  // ---- name: family, style, copyright, licence (Windows Unicode first, then Mac Roman)
  const names: Record<number, string> = {};
  const nameT = tables.get("name");
  if (nameT) {
    const base = nameT.off, count = u16(base + 2), strs = base + u16(base + 4);
    for (let i = 0; i < count; i++) {
      const r = base + 6 + i * 12, plat = u16(r), enc = u16(r + 2), id = u16(r + 6), len = u16(r + 8), off = strs + u16(r + 10);
      if (off + len > u8.length) continue;
      if (plat === 3 && (enc === 1 || enc === 10)) { let s = ""; for (let k = 0; k < len; k += 2) s += String.fromCharCode(u16(off + k)); names[id] = s; }
      else if (plat === 1 && enc === 0 && names[id] === undefined) { let s = ""; for (let k = 0; k < len; k++) s += String.fromCharCode(u8[off + k]); names[id] = s; }
    }
  }

  // ---- glyph locations and outlines
  const glyphRange = (id: number): [number, number] => {
    if (id < 0 || id >= numGlyphs) return [0, 0];
    const a = longLoca ? u32(loca + id * 4) : u16(loca + id * 2) * 2, b = longLoca ? u32(loca + id * 4 + 4) : u16(loca + id * 2 + 2) * 2;
    if (b < a || a > glyf.len) fail(`loca entry for glyph ${id} is out of order or past glyf: damaged file`);
    return [glyf.off + a, glyf.off + Math.min(b, glyf.len)];
  };
  const advanceOf = (id: number) => u16(hmtx + Math.min(id, nHM - 1) * 4);
  const lsbOf = (id: number) => (id < nHM ? i16(hmtx + id * 4 + 2) : i16(hmtx + nHM * 4 + (id - nHM) * 2));

  type Pt = { x: number; y: number; on: boolean };
  // raw points per contour, before curves are made; composites concatenate their parts' contours
  const points = (id: number, depth = 0): Pt[][] => {
    if (depth > 8) fail(`glyph ${id}: composite glyphs nest deeper than 8 (a loop?)`);
    const [a, b] = glyphRange(id);
    if (b - a < 10) return []; // an empty glyph (space): no outline at all
    const nc = i16(a);
    if (nc >= 0) {
      const ends: number[] = []; for (let i = 0; i < nc; i++) ends.push(u16(a + 10 + i * 2));
      const np = nc ? ends[nc - 1] + 1 : 0;
      let p = a + 10 + nc * 2; p += 2 + u16(p); // skip the hinting instructions
      const flags: number[] = [];
      while (flags.length < np) { const f = u8[p++]; flags.push(f); if (f & 8) { let r = u8[p++]; while (r-- > 0) flags.push(f); } }
      const xs: number[] = [], ys: number[] = [];
      let v = 0;
      for (const f of flags) { if (f & 2) { const d = u8[p++]; v += f & 16 ? d : -d; } else if (!(f & 16)) { v += i16(p); p += 2; } xs.push(v); }
      v = 0;
      for (const f of flags) { if (f & 4) { const d = u8[p++]; v += f & 32 ? d : -d; } else if (!(f & 32)) { v += i16(p); p += 2; } ys.push(v); }
      if (p > b + 3) fail(`glyph ${id}: outline data runs past its slot: damaged file`);
      const out: Pt[][] = []; let s = 0;
      for (const e of ends) { const c: Pt[] = []; for (let k = s; k <= e; k++) c.push({ x: xs[k], y: ys[k], on: !!(flags[k] & 1) }); out.push(c); s = e + 1; }
      return out;
    }
    // composite: each component is another glyph, moved (and maybe scaled) into place
    const out: Pt[][] = [];
    let p = a + 10, more = true;
    while (more) {
      const fl = u16(p), gid = u16(p + 2); p += 4;
      let dx: number, dy: number;
      if (fl & 1) { dx = i16(p); dy = i16(p + 2); p += 4; } else { dx = dv.getInt8(p); dy = dv.getInt8(p + 1); p += 2; }
      // ARGS_ARE_XY_VALUES unset means "match point numbers": rare in Latin fonts, placed at 0, 0
      if (!(fl & 2)) { dx = 0; dy = 0; }
      let m = [1, 0, 0, 1];
      const f2 = (o: number) => i16(o) / 16384;
      if (fl & 8) { const s = f2(p); m = [s, 0, 0, s]; p += 2; }
      else if (fl & 0x40) { m = [f2(p), 0, 0, f2(p + 2)]; p += 4; }
      else if (fl & 0x80) { m = [f2(p), f2(p + 2), f2(p + 4), f2(p + 6)]; p += 8; }
      for (const c of points(gid, depth + 1)) out.push(c.map((q) => ({ x: m[0] * q.x + m[2] * q.y + dx, y: m[1] * q.x + m[3] * q.y + dy, on: q.on })));
      more = !!(fl & 0x20);
    }
    return out;
  };

  const cache = new Map<number, GlyphOutline>();
  const glyph = (id: number): GlyphOutline => {
    const hit = cache.get(id); if (hit) return hit;
    const contours = points(id).filter((c) => c.length > 1).map(toQuads);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of contours) for (const s of c) for (let k = 1; k < s.length; k += 2) { const x = s[k] as number, y = s[k + 1] as number; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const g: GlyphOutline = { id, contours, advance: advanceOf(id), lsb: lsbOf(id), bbox: contours.length ? [x0, y0, x1, y1] : [0, 0, 0, 0] };
    cache.set(id, g); return g;
  };

  // ---- cmap: prefer the full-Unicode format 12 table, else format 4
  let sub4 = -1, sub12 = -1;
  for (let i = 0, nt = u16(cmapT + 2); i < nt; i++) {
    const r = cmapT + 4 + i * 8, plat = u16(r), enc = u16(r + 2), off = cmapT + u32(r + 4), fmt = u16(off);
    const unicode = plat === 0 || (plat === 3 && (enc === 1 || enc === 10));
    if (!unicode) continue;
    if (fmt === 12 && sub12 < 0) sub12 = off;
    if (fmt === 4 && sub4 < 0) sub4 = off;
  }
  if (sub4 < 0 && sub12 < 0) fail("no Unicode character map (cmap format 4 or 12)");
  const cmapCache = new Map<number, number>();
  const glyphIndex = (cp: number): number => {
    const hit = cmapCache.get(cp); if (hit !== undefined) return hit;
    let g = 0;
    if (sub12 >= 0) {
      for (let i = 0, ng = u32(sub12 + 12); i < ng; i++) { const r = sub12 + 16 + i * 12, s = u32(r), e = u32(r + 4); if (cp >= s && cp <= e) { g = u32(r + 8) + cp - s; break; } }
    } else if (cp <= 0xffff) {
      const segX2 = u16(sub4 + 6), ends = sub4 + 14, starts = ends + segX2 + 2, deltas = starts + segX2, ranges = deltas + segX2;
      for (let i = 0; i < segX2 / 2; i++) {
        if (cp > u16(ends + i * 2)) continue;
        const s = u16(starts + i * 2); if (cp < s) break;
        const delta = u16(deltas + i * 2), ro = u16(ranges + i * 2);
        if (ro === 0) g = (cp + delta) & 0xffff;
        else { const at = ranges + i * 2 + ro + (cp - s) * 2, v = u16(at); g = v ? (v + delta) & 0xffff : 0; }
        break;
      }
    }
    if (g >= numGlyphs) g = 0;
    cmapCache.set(cp, g); return g;
  };

  // ---- kerning: kern format 0 pairs, then GPOS pair adjustments for the 'kern' feature
  const kern = new Map<number, number>();
  const kernT = tables.get("kern");
  if (kernT && u16(kernT.off) === 0) {
    let p = kernT.off + 4;
    for (let t = 0, nt = u16(kernT.off + 2); t < nt; t++) {
      const len = u16(p + 2), cov = u16(p + 4);
      if (cov >> 8 === 0 && cov & 1) for (let i = 0, np = u16(p + 6); i < np; i++) { const r = p + 14 + i * 6; kern.set((u16(r) << 16) | u16(r + 2), i16(r + 4)); }
      p += len;
    }
  }
  type Pair = (l: number, r: number) => number | undefined;
  const gposPairs: Pair[] = [];
  const gposT = tables.get("GPOS");
  if (gposT && kern.size === 0) {
    const G = gposT.off, featList = G + u16(G + 6), lookList = G + u16(G + 8);
    const lookups = new Set<number>();
    for (let i = 0, nf = u16(featList); i < nf; i++) { const r = featList + 2 + i * 6; if (tag(r) !== "kern") continue; const f = featList + u16(r + 4); for (let k = 0, nl = u16(f + 2); k < nl; k++) lookups.add(u16(f + 4 + k * 2)); }
    // coverage: glyph -> index in the table, or -1
    const coverage = (c: number) => { const fmt = u16(c), m = new Map<number, number>(); if (fmt === 1) for (let i = 0, n2 = u16(c + 2); i < n2; i++) m.set(u16(c + 4 + i * 2), i); else for (let i = 0, n2 = u16(c + 2); i < n2; i++) { const r = c + 4 + i * 6, s = u16(r), e = u16(r + 2), si = u16(r + 4); for (let gq = s; gq <= e; gq++) m.set(gq, si + gq - s); } return m; };
    const classDef = (c: number) => { const fmt = u16(c), m = new Map<number, number>(); if (fmt === 1) { const s = u16(c + 2); for (let i = 0, n2 = u16(c + 4); i < n2; i++) m.set(s + i, u16(c + 6 + i * 2)); } else for (let i = 0, n2 = u16(c + 2); i < n2; i++) { const r = c + 4 + i * 6; for (let gq = u16(r); gq <= u16(r + 2); gq++) m.set(gq, u16(r + 4)); } return m; };
    // ValueRecord: only XAdvance matters for horizontal kerning; the other fields are skipped by size
    const vSize = (f: number) => { let s = 0; for (let b = 0; b < 8; b++) if (f & (1 << b)) s += 2; return s; };
    const xAdv = (o: number, f: number) => { if (!(f & 4)) return 0; let p = o; if (f & 1) p += 2; if (f & 2) p += 2; return i16(p); };
    const pairSub = (st: number) => {
      const fmt = u16(st), cov = coverage(st + u16(st + 2)), vf1 = u16(st + 4), vf2 = u16(st + 6), rec = vSize(vf1) + vSize(vf2);
      if (fmt === 1) {
        gposPairs.push((l, r) => { const ci = cov.get(l); if (ci === undefined) return undefined; const set = st + u16(st + 10 + ci * 2); for (let i = 0, nv = u16(set); i < nv; i++) { const pr = set + 2 + i * (2 + rec); if (u16(pr) === r) return xAdv(pr + 2, vf1); } return undefined; });
      } else if (fmt === 2) {
        const c1 = classDef(st + u16(st + 8)), c2 = classDef(st + u16(st + 10)), n1 = u16(st + 12), n2 = u16(st + 14);
        gposPairs.push((l, r) => { if (!cov.has(l)) return undefined; const a = c1.get(l) ?? 0, b2 = c2.get(r) ?? 0; if (a >= n1 || b2 >= n2) return undefined; return xAdv(st + 16 + (a * n2 + b2) * rec, vf1); });
      }
    };
    for (const li of [...lookups].sort((a, b) => a - b)) {
      const L = lookList + u16(lookList + 2 + li * 2), type = u16(L);
      for (let s = 0, ns = u16(L + 4); s < ns; s++) {
        let st = L + u16(L + 6 + s * 2);
        if (type === 9) { if (u16(st + 2) !== 2) continue; st = st + u32(st + 4); } // extension wrapping a pair lookup
        else if (type !== 2) continue;
        pairSub(st);
      }
    }
  }
  const kernCache = new Map<number, number>();
  const kerning = (l: number, r: number) => {
    const k = (l << 16) | r, hit = kern.get(k) ?? kernCache.get(k); if (hit !== undefined) return hit;
    let v = 0; for (const f of gposPairs) { const x = f(l, r); if (x !== undefined) { v = x; break; } }
    kernCache.set(k, v); return v;
  };

  // ---- OS/2 cap and x height (version 2+), else measured from H and x
  const os2 = tables.get("OS/2");
  const yMaxOf = (ch: string) => glyph(glyphIndex(ch.codePointAt(0)!)).bbox[3];
  const capHeight = os2 && u16(os2.off) >= 2 && os2.len >= 90 ? i16(os2.off + 88) : yMaxOf("H");
  const xHeight = os2 && u16(os2.off) >= 2 && os2.len >= 88 ? i16(os2.off + 86) : yMaxOf("x");

  let sum = 0; for (let i = 0; i < u8.length; i += 97) sum = (Math.imul(sum, 31) + u8[i]) >>> 0;
  const family = names[16] ?? names[1] ?? "unnamed", style = names[17] ?? names[2] ?? "";
  return {
    id: `${family}-${style}-${u8.length}-${sum.toString(36)}`.replace(/\s+/g, ""),
    family, style, copyright: names[0] ?? "", license: names[13] ?? "", licenseUrl: names[14] ?? "",
    unitsPerEm, ascender, descender, lineGap, capHeight: capHeight || unitsPerEm * 0.7, xHeight: xHeight || unitsPerEm * 0.5,
    numGlyphs, glyphIndex, glyph, kerning,
  };
};

/**
 * TrueType points -> quadratic segments. Two off-curve points in a row imply an on-curve point
 * halfway between them; a contour may even start off-curve (then it starts at such a midpoint,
 * or at the first on-curve point found further on).
 */
export const toQuads = (pts: { x: number; y: number; on: boolean }[]): Contour => {
  const n = pts.length;
  let start = pts.findIndex((p) => p.on);
  let sx: number, sy: number;
  if (start < 0) { start = 0; sx = (pts[0].x + pts[1 % n].x) / 2; sy = (pts[0].y + pts[1 % n].y) / 2; }
  else { sx = pts[start].x; sy = pts[start].y; }
  const out: Contour = [["M", sx, sy]];
  // walk every point once after the start; an all-off contour starts at the midpoint of its first
  // two points, so its first point comes round again at k = n as the closing control
  let ctrl: { x: number; y: number } | null = null;
  for (let k = 1; k <= n; k++) {
    const p = pts[(start + k) % n];
    if (p.on) { if (ctrl) out.push(["Q", ctrl.x, ctrl.y, p.x, p.y]); else out.push(["L", p.x, p.y]); ctrl = null; }
    else if (ctrl) { const mx = (ctrl.x + p.x) / 2, my = (ctrl.y + p.y) / 2; out.push(["Q", ctrl.x, ctrl.y, mx, my]); ctrl = { x: p.x, y: p.y }; }
    else ctrl = { x: p.x, y: p.y };
  }
  if (ctrl) out.push(["Q", ctrl.x, ctrl.y, sx, sy]);
  // a closing "L" back onto the start adds a zero-length edge that triangulators dislike
  const last = out[out.length - 1];
  if (out.length > 2 && last[0] === "L" && last[1] === sx && last[2] === sy) out.pop();
  return out;
};
