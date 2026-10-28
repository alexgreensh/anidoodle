// TYPE 3D. Real letters in a 3D scene, from a TrueType font the film carries (ttf.ts), with no
// typeface JSON, no FontLoader and nothing fetched.
//
//   text3d(env, font, "anidoodle", { size, depth, bevel })   extruded letters: a Group, ONE Mesh per
//        visible glyph in reading order, so a verb can stagger them. Each letter's origin is its own
//        centre (it pops and spins about itself) and its resting place is mesh.userData.home.
//   textPlane(env, "made with anidoodle", { size, color })   flat, crisp type on a plane, drawn from
//        the same outlines onto a 2D layer: labels, captions and URLs placed in 3D space.
//   defaultFont()                                             Poppins Bold (OFL), bundled.
//   layoutText(font, text, opts)                              the pure layout both use (font units).
//
// Holes are found by CONTAINMENT, not by winding: a contour inside an odd number of others is a
// hole (the counter of "o", the bowl of "A"), whatever direction the font drew it. Winding alone
// fails on fonts that mix directions, and three's ShapePath.toShapes guesses from winding.
import * as THREE from "three";
import type { Env } from "../canvas-core/core";
import { memo } from "./stage";
import { parseTTF, type Contour, type Font } from "./ttf";
import { POPPINS_BOLD } from "../../assets/fonts/poppinsBold";

let poppins: Font | null = null;
/** Poppins Bold 4.003 (SIL OFL 1.1), parsed once. The same bytes on every machine. */
export const defaultFont = (): Font => (poppins ??= parseTTF(POPPINS_BOLD));

export type Align = "left" | "center" | "right";
export type LayoutOpts = { letterSpacing?: number; lineHeight?: number; align?: Align; kerning?: boolean };
export type Placed = { ch: string; gid: number; x: number; y: number; advance: number; line: number; index: number };
export type Layout = { glyphs: Placed[]; width: number; height: number; lines: number[] };

/**
 * Where every glyph goes, in FONT UNITS (y up, first baseline at 0). letterSpacing is in ems
 * (0.05 = a twentieth of the size between letters); lineHeight in ems. align shifts each line so
 * the block's x origin is its left edge, centre or right edge. Vertical: the cap-height middle of
 * the first line sits at y 0, so a word centres on its capitals, not on its descenders.
 */
export const layoutText = (font: Font, text: string, o: LayoutOpts = {}): Layout => {
  const em = font.unitsPerEm, track = (o.letterSpacing ?? 0) * em, lh = (o.lineHeight ?? 1.15) * em, align = o.align ?? "center";
  const glyphs: Placed[] = [], lines: number[] = [];
  const rows = text.split("\n");
  rows.forEach((row, li) => {
    const chars = [...row], start = glyphs.length;
    let x = 0, prev = -1;
    chars.forEach((ch, i) => {
      const gid = font.glyphIndex(ch.codePointAt(0)!), g = font.glyph(gid);
      if (prev >= 0 && o.kerning !== false) x += font.kerning(prev, gid);
      glyphs.push({ ch, gid, x, y: -li * lh, advance: g.advance, line: li, index: glyphs.length });
      x += g.advance + (i < chars.length - 1 ? track : 0);
      prev = gid;
    });
    const w = x, shift = align === "left" ? 0 : align === "right" ? -w : -w / 2;
    for (let k = start; k < glyphs.length; k++) glyphs[k].x += shift;
    lines.push(w);
  });
  const mid = font.capHeight / 2;
  for (const g of glyphs) g.y -= mid;
  return { glyphs, width: Math.max(0, ...lines), height: font.capHeight + (rows.length - 1) * lh, lines };
};

/** visible = has ink. Spaces and unmapped control characters make no mesh. */
export const visibleGlyphs = (font: Font, layout: Layout) => layout.glyphs.filter((g) => font.glyph(g.gid).contours.length > 0);

// ---- contours -> shapes with holes
const flatten = (c: Contour, steps = 4): [number, number][] => {
  const out: [number, number][] = []; let x = 0, y = 0;
  for (const s of c) {
    if (s[0] === "M" || s[0] === "L") { x = s[1]; y = s[2]; out.push([x, y]); }
    else { const [, cx, cy, ex, ey] = s; for (let k = 1; k <= steps; k++) { const t = k / steps, u = 1 - t; out.push([u * u * x + 2 * u * t * cx + t * t * ex, u * u * y + 2 * u * t * cy + t * t * ey]); } x = ex; y = ey; }
  }
  return out;
};
const area = (p: [number, number][]) => { let a = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] - p[i][0]) * (p[j][1] + p[i][1]); return a / 2; };
const inside = (pt: [number, number], poly: [number, number][]) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < ((b[0] - a[0]) * (pt[1] - a[1])) / (b[1] - a[1]) + a[0]) c = !c; }
  return c;
};
/**
 * Group a glyph's contours into outer outlines and their holes, by nesting depth. Returns indices:
 * [{ outer, holes }]. A contour's depth is how many others contain its test point; even depth is
 * ink, odd is a hole, and a hole belongs to the smallest contour one level up that contains it.
 */
export const nestContours = (contours: Contour[]): { outer: number; holes: number[] }[] => {
  const polys = contours.map((c) => flatten(c)), areas = polys.map((p) => Math.abs(area(p)));
  // test point: a vertex of the contour nudged a hair toward its own interior side is overkill for
  // fonts; a plain on-curve point is inside every true container and outside every sibling
  const probe = polys.map((p) => p[0]);
  const containers = polys.map((_, i) => polys.map((q, j) => (j !== i && areas[j] > areas[i] && inside(probe[i], q) ? j : -1)).filter((j) => j >= 0));
  const depth = containers.map((c) => c.length);
  const groups = new Map<number, { outer: number; holes: number[] }>();
  depth.forEach((d, i) => { if (d % 2 === 0) groups.set(i, { outer: i, holes: [] }); });
  depth.forEach((d, i) => {
    if (d % 2 === 0) return;
    const parent = containers[i].filter((j) => depth[j] === d - 1).sort((a, b) => areas[a] - areas[b])[0];
    if (parent !== undefined) groups.get(parent)!.holes.push(i);
  });
  return [...groups.values()];
};

const tracePath = (p: THREE.Path, c: Contour, k: number, dx: number, dy: number) => {
  for (const s of c) {
    if (s[0] === "M") p.moveTo(s[1] * k + dx, s[2] * k + dy);
    else if (s[0] === "L") p.lineTo(s[1] * k + dx, s[2] * k + dy);
    else p.quadraticCurveTo(s[1] * k + dx, s[2] * k + dy, s[3] * k + dx, s[4] * k + dy);
  }
};
/** a glyph's outline as THREE.Shapes in world units (k = world units per font unit), offset by dx, dy */
export const glyphShapes = (font: Font, gid: number, k: number, dx = 0, dy = 0): THREE.Shape[] => {
  const { contours } = font.glyph(gid);
  return nestContours(contours).map(({ outer, holes }) => {
    const s = new THREE.Shape(); tracePath(s, contours[outer], k, dx, dy);
    for (const h of holes) { const p = new THREE.Path(); tracePath(p, contours[h], k, dx, dy); s.holes.push(p); }
    return s;
  });
};

/**
 * Smooth normals across soft edges, keep them sharp across hard ones (the face and the side of a
 * letter). ExtrudeGeometry gives one flat normal per triangle, so the curved side of an "o" shows
 * every facet; averaging only the neighbours within `angle` of each other rounds it off.
 */
export const creaseNormals = (geo: THREE.BufferGeometry, angle = (35 * Math.PI) / 180) => {
  const pos = geo.getAttribute("position"), n = pos.count, faceN: THREE.Vector3[] = [], cos = Math.cos(angle);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let i = 0; i < n; i += 3) { a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2); const f = new THREE.Vector3().subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b)); const len = f.length(); faceN.push(len > 0 ? f.multiplyScalar(1 / len) : f.set(0, 0, 1)); }
  const key = (i: number) => `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`;
  const at = new Map<string, number[]>();
  for (let i = 0; i < n; i++) { const k = key(i); const l = at.get(k); if (l) l.push(i); else at.set(k, [i]); }
  const out = new Float32Array(n * 3), s = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const fi = faceN[(i / 3) | 0]; s.set(0, 0, 0);
    for (const j of at.get(key(i))!) { const fj = faceN[(j / 3) | 0]; if (fi.dot(fj) >= cos) s.add(fj); }
    if (s.lengthSq() === 0) s.copy(fi); s.normalize(); out.set([s.x, s.y, s.z], i * 3);
  }
  geo.setAttribute("normal", new THREE.BufferAttribute(out, 3));
  return geo;
};

export type Text3dOpts = LayoutOpts & {
  /** em size in world units (the height a capital "H" gets is about 0.7 of it). Default 1 */
  size?: number;
  /** extrusion depth, in ems. Default 0.22 */
  depth?: number;
  /** bevel size in ems (0 = a hard edge). Default 0.018: enough to catch a rim light */
  bevel?: number;
  bevelSegments?: number;
  /** segments per quadratic curve. Default 10: smooth at 1080p for letters up to half the frame */
  curveSegments?: number;
  /** one material for every letter, or a list cycled letter by letter. Default: satin warm white */
  material?: THREE.Material | THREE.Material[];
};
export type Letter = THREE.Mesh & { userData: { char: string; index: number; home: THREE.Vector3 } };

/**
 * Extruded 3D text: a Group of one Mesh per visible glyph, in reading order. Built once per
 * (font, text, options) and kept (stage.ts memo), so call it from a shot's draw freely; the same
 * call returns the same Group (clone() it for a second copy). Animate letters by SETTING their
 * transforms from the frame, starting from userData.home: never nudge what the last frame left.
 */
export const text3d = (env: Env, font: Font, text: string, o: Text3dOpts = {}): THREE.Group & { userData: { letters: Letter[]; width: number; height: number } } => {
  const mats = o.material === undefined ? [] : Array.isArray(o.material) ? o.material : [o.material];
  const key = `text3d:${font.id}:${JSON.stringify(text)}:${JSON.stringify({ ...o, material: mats.map((m) => m.uuid) })}`;
  return memo(env, key, () => {
    const size = o.size ?? 1, k = size / font.unitsPerEm, depth = (o.depth ?? 0.22) * size, bevel = (o.bevel ?? 0.018) * size;
    const layout = layoutText(font, text, o);
    const fallback = mats.length ? mats : [new THREE.MeshPhysicalMaterial({ color: "#f4efe6", roughness: 0.5, specularIntensity: 0.35, sheen: 0.25, sheenRoughness: 0.6 })];
    const group = new THREE.Group() as THREE.Group & { userData: { letters: Letter[]; width: number; height: number } };
    const letters: Letter[] = [];
    for (const p of visibleGlyphs(font, layout)) {
      const g = font.glyph(p.gid), cx = (g.advance / 2) * k; // the letter's own centre: half its advance, cap middle, mid depth
      const geo = memo(env, `text3d:glyph:${font.id}:${p.gid}:${size}:${depth}:${bevel}:${o.bevelSegments ?? 3}:${o.curveSegments ?? 10}`, () => {
        const ge = new THREE.ExtrudeGeometry(glyphShapes(font, p.gid, k, -cx, -(font.capHeight / 2) * k), {
          depth, curveSegments: o.curveSegments ?? 10, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel,
          // pull the bevel INSIDE the outline: the letter keeps the font's exact footprint and thin parts never fatten into each other
          bevelOffset: -bevel, bevelSegments: o.bevelSegments ?? 3,
        });
        ge.translate(0, 0, -depth / 2);
        return creaseNormals(ge);
      });
      const m = new THREE.Mesh(geo, fallback[letters.length % fallback.length]) as unknown as Letter;
      // the geometry's origin is font y = capHeight / 2 above this glyph's baseline (p.y)
      const home = new THREE.Vector3(p.x * k + cx, (p.y + font.capHeight / 2) * k, 0);
      m.position.copy(home); m.name = `letter:${letters.length}:${p.ch}`;
      m.userData = { char: p.ch, index: letters.length, home };
      group.add(m); letters.push(m);
    }
    group.userData = { letters, width: layout.width * k, height: layout.height * k };
    return group;
  });
};

// ---- flat type: the same outlines filled on a 2D layer
export type PlaneStyle = LayoutOpts & {
  font?: Font;
  /** em size in world units. Default 0.3 */
  size?: number;
  color?: string;
  /** texture pixels per em: 160 keeps 1080p captions sharp when the plane fills a fifth of the frame */
  px?: number;
  opacity?: number;
};
/** draw a laid-out text's outlines onto a 2D context, em = pixels per em, baseline origin at (ox, oy) */
export const fillText2d = (ctx: CanvasRenderingContext2D, font: Font, layout: Layout, em: number, ox: number, oy: number) => {
  const k = em / font.unitsPerEm;
  ctx.beginPath();
  for (const p of layout.glyphs) for (const c of font.glyph(p.gid).contours) for (const s of c) {
    const X = (x: number) => ox + (p.x + x) * k, Y = (y: number) => oy - (p.y + y) * k;
    if (s[0] === "M") ctx.moveTo(X(s[1]), Y(s[2])); else if (s[0] === "L") ctx.lineTo(X(s[1]), Y(s[2])); else ctx.quadraticCurveTo(X(s[1]), Y(s[2]), X(s[3]), Y(s[4]));
  }
  ctx.fill("nonzero"); // TrueType outlines are drawn to the nonzero rule
};
/**
 * Flat, crisp text on a plane for labels, captions and URLs in 3D space. Unlit (it reads the same
 * under any light rig) and outside tone mapping (its colour is the colour asked for). Built once per
 * (text, style) and kept. The plane is centred per align like text3d.
 */
export const textPlane = (env: Env, text: string, style: PlaneStyle = {}): THREE.Mesh => {
  const font = style.font ?? defaultFont();
  const key = `textPlane:${font.id}:${JSON.stringify(text)}:${JSON.stringify({ ...style, font: undefined })}`;
  return memo(env, key, () => {
    const em = style.px ?? 160, size = style.size ?? 0.3, layout = layoutText(font, text, style);
    const asc = font.ascender / font.unitsPerEm, desc = -font.descender / font.unitsPerEm, pad = 0.08;
    const wEm = layout.width / font.unitsPerEm + 2 * pad, hEm = (layout.height - font.capHeight) / font.unitsPerEm + asc + desc + 2 * pad;
    const W = Math.ceil(wEm * em), H = Math.ceil(hEm * em), layer = env.canvas(W, H), ctx = layer.ctx;
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = style.color ?? "#ffffff";
    // layoutText put the cap middle at y 0 and x 0 at the block's left edge, centre or right edge
    const align = style.align ?? "center", ink = layout.width / font.unitsPerEm;
    const ax = align === "left" ? 0 : align === "right" ? ink : ink / 2;
    fillText2d(ctx, font, layout, em, (pad + ax) * em, (pad + asc) * em - (font.capHeight / 2 / font.unitsPerEm) * em);
    const tex = new THREE.CanvasTexture(layer.canvas as unknown as HTMLCanvasElement);
    tex.colorSpace = THREE.SRGBColorSpace; tex.premultiplyAlpha = true; tex.anisotropy = 8;
    tex.minFilter = THREE.LinearMipmapLinearFilter; tex.generateMipmaps = true;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, premultipliedAlpha: true, depthWrite: false, toneMapped: false, opacity: style.opacity ?? 1 });
    const geo = new THREE.PlaneGeometry(wEm * size, hEm * size);
    // align: the plane's origin is the text block's left edge, centre or right edge, at cap middle
    const x0 = align === "left" ? -pad : align === "right" ? -ink - pad : -ink / 2 - pad;
    const capMidFromTop = pad + asc - font.capHeight / 2 / font.unitsPerEm;
    geo.translate((x0 + wEm / 2) * size, (capMidFromTop - hEm / 2) * size, 0);
    const mesh = new THREE.Mesh(geo, mat); mesh.name = `textPlane:${text}`;
    return mesh;
  });
};
