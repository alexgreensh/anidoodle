// BRAND SVG. The pure half of brand.mjs (no files, no browser), so it is unit-tested. It reads an SVG
// export (from Figma, a site or a brand pack) into the exact paths a film draws: every fill, gradient,
// transform and <use> resolved, each part with its bounding box. Nothing is redrawn or simplified,
// because a brand element approximated by eye is a different element in the owner's eyes.
// It also measures what the marks can do in motion: rotational and mirror symmetry (a mark that looks
// the same after a half turn can land from a spin without a jump) and repeat periods (a frieze that
// repeats every N units tiles without a seam).

// ------------------------------------------------------------------ XML, small and strict enough
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const unent = (s) => String(s).replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => e[0] === "#" ? String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e] ?? m);
/** -> root node { tag, attrs, kids, text } of the first <svg>. Throws on input with no <svg>. */
export const parseXml = (src) => {
  const s = String(src).replace(/<!--[\s\S]*?-->/g, "").replace(/<\?[\s\S]*?\?>/g, "").replace(/<!DOCTYPE[\s\S]*?>/gi, "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_, t) => t.replace(/</g, "&lt;"));
  const root = { tag: "#root", attrs: {}, kids: [], text: "" }, stack = [root], TAG = /<(\/?)([\w:.-]+)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/g;
  for (const m of s.matchAll(TAG)) {
    const top = stack[stack.length - 1];
    if (m[5] !== undefined) { top.text += unent(m[5]); continue; }
    if (m[1]) { while (stack.length > 1 && stack.pop().tag !== m[2]); continue; }
    const attrs = {}; for (const a of m[3].matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[a[1]] = unent(a[2] ?? a[3]);
    const node = { tag: m[2].replace(/^svg:/, ""), attrs, kids: [], text: "", parent: top };
    top.kids.push(node); if (!m[4]) stack.push(node);
  }
  const find = (n) => n.tag === "svg" ? n : n.kids.map(find).find(Boolean);
  const svg = find(root); if (!svg) throw new Error("not an SVG: no <svg> element found");
  return svg;
};

// ------------------------------------------------------------------ affine matrices [a b c d e f]
export const I = [1, 0, 0, 1, 0, 0];
export const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
export const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
export const isIdentity = (m) => m.every((v, i) => Math.abs(v - I[i]) < 1e-9);
const nums = (s) => (String(s).match(/-?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) ?? []).map(Number);
/** SVG transform attribute -> one matrix. */
export const parseTransform = (t) => {
  let m = I;
  for (const [, fn, args] of String(t ?? "").matchAll(/(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g)) {
    const a = nums(args), r = (d) => (d * Math.PI) / 180;
    let n = I;
    if (fn === "matrix" && a.length === 6) n = a;
    else if (fn === "translate") n = [1, 0, 0, 1, a[0] ?? 0, a[1] ?? 0];
    else if (fn === "scale") n = [a[0] ?? 1, 0, 0, a[1] ?? a[0] ?? 1, 0, 0];
    else if (fn === "rotate") { const c = Math.cos(r(a[0] ?? 0)), s = Math.sin(r(a[0] ?? 0)), cx = a[1] ?? 0, cy = a[2] ?? 0; n = mul(mul([1, 0, 0, 1, cx, cy], [c, s, -s, c, 0, 0]), [1, 0, 0, 1, -cx, -cy]); }
    else if (fn === "skewX") n = [1, 0, Math.tan(r(a[0] ?? 0)), 1, 0, 0];
    else if (fn === "skewY") n = [1, Math.tan(r(a[0] ?? 0)), 0, 1, 0, 0];
    m = mul(m, n);
  }
  return m;
};

// ------------------------------------------------------------------ path data -> absolute commands -> points
/** d -> [[cmd, ...absolute numbers]] with M L C Q A Z only (H V S T and relatives resolved). */
export const parsePath = (d) => {
  const src = String(d ?? ""), out = []; let i = 0, cmd = "", x = 0, y = 0, sx = 0, sy = 0, lc = null, lq = null;
  const ws = () => { while (i < src.length && /[\s,]/.test(src[i])) i++; };
  const num = () => { ws(); const m = /^[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/.exec(src.slice(i)); if (!m) throw new Error(`bad path data near "${src.slice(i, i + 12)}"`); i += m[0].length; return Number(m[0]); };
  const flag = () => { ws(); const c = src[i++]; if (c !== "0" && c !== "1") throw new Error(`bad arc flag near "${src.slice(i - 1, i + 10)}"`); return c === "1" ? 1 : 0; };
  for (;;) {
    ws(); if (i >= src.length) break;
    if (/[a-zA-Z]/.test(src[i])) cmd = src[i++]; else if (!cmd) throw new Error("path data must start with a command");
    const rel = cmd === cmd.toLowerCase() && cmd !== "z" ? true : cmd === "z", C = cmd.toUpperCase(), ox = rel && C !== "Z" ? x : 0, oy = rel && C !== "Z" ? y : 0;
    if (C === "Z") { out.push(["Z"]); x = sx; y = sy; lc = lq = null; continue; }
    if (C === "M") { x = num() + ox; y = num() + oy; sx = x; sy = y; out.push(["M", x, y]); cmd = rel ? "l" : "L"; lc = lq = null; continue; }
    if (C === "L") { x = num() + ox; y = num() + oy; out.push(["L", x, y]); lc = lq = null; continue; }
    if (C === "H") { x = num() + ox; out.push(["L", x, y]); lc = lq = null; continue; }
    if (C === "V") { y = num() + oy; out.push(["L", x, y]); lc = lq = null; continue; }
    if (C === "C" || C === "S") {
      let x1, y1; if (C === "C") { x1 = num() + ox; y1 = num() + oy; } else [x1, y1] = lc ? [2 * x - lc[0], 2 * y - lc[1]] : [x, y];
      const x2 = num() + ox, y2 = num() + oy; x = num() + ox; y = num() + oy; out.push(["C", x1, y1, x2, y2, x, y]); lc = [x2, y2]; lq = null; continue;
    }
    if (C === "Q" || C === "T") {
      let x1, y1; if (C === "Q") { x1 = num() + ox; y1 = num() + oy; } else [x1, y1] = lq ? [2 * x - lq[0], 2 * y - lq[1]] : [x, y];
      x = num() + ox; y = num() + oy; out.push(["Q", x1, y1, x, y]); lq = [x1, y1]; lc = null; continue;
    }
    if (C === "A") { const rx = num(), ry = num(), rot = num(), la = flag(), sw = flag(); x = num() + ox; y = num() + oy; out.push(["A", rx, ry, rot, la, sw, x, y]); lc = lq = null; continue; }
    throw new Error(`unknown path command "${cmd}"`);
  }
  return out;
};

// endpoint arc -> centre form (SVG spec F.6.5), sampled
const arcPoints = (x0, y0, rx, ry, rotDeg, la, sw, x, y, n = 16) => {
  if (!rx || !ry) return [[x, y]];
  rx = Math.abs(rx); ry = Math.abs(ry); const phi = (rotDeg * Math.PI) / 180, c = Math.cos(phi), s = Math.sin(phi);
  const dx = (x0 - x) / 2, dy = (y0 - y) / 2, x1 = c * dx + s * dy, y1 = -s * dx + c * dy;
  const L = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry); if (L > 1) { rx *= Math.sqrt(L); ry *= Math.sqrt(L); }
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1, den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  const k = (la === sw ? -1 : 1) * Math.sqrt(Math.max(0, num / den)), cx1 = (k * rx * y1) / ry, cy1 = (-k * ry * x1) / rx;
  const cx = c * cx1 - s * cy1 + (x0 + x) / 2, cy = s * cx1 + c * cy1 + (y0 + y) / 2;
  const ang = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t0 = ang(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry); let dt = ang((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry);
  if (!sw && dt > 0) dt -= 2 * Math.PI; else if (sw && dt < 0) dt += 2 * Math.PI;
  const pts = []; for (let j = 1; j <= n; j++) { const t = t0 + (dt * j) / n; pts.push([cx + rx * Math.cos(t) * c - ry * Math.sin(t) * s, cy + rx * Math.cos(t) * s + ry * Math.sin(t) * c]); }
  return pts;
};
/** d -> subpaths of points (curves sampled), each point through matrix m. */
export const flatten = (d, m = I, steps = 16) => {
  const subs = []; let cur = null, x = 0, y = 0, x0 = 0, y0 = 0;
  const put = (px, py) => cur.push(apply(m, px, py));
  for (const c of parsePath(d)) {
    if (c[0] === "M") { cur = []; subs.push(cur); x = x0 = c[1]; y = y0 = c[2]; put(x, y); continue; }
    if (!cur) { cur = []; subs.push(cur); put(x, y); }
    if (c[0] === "L") { x = c[1]; y = c[2]; put(x, y); }
    else if (c[0] === "C") { for (let j = 1; j <= steps; j++) { const t = j / steps, u = 1 - t; put(u * u * u * x + 3 * u * u * t * c[1] + 3 * u * t * t * c[3] + t * t * t * c[5], u * u * u * y + 3 * u * u * t * c[2] + 3 * u * t * t * c[4] + t * t * t * c[6]); } x = c[5]; y = c[6]; }
    else if (c[0] === "Q") { for (let j = 1; j <= steps; j++) { const t = j / steps, u = 1 - t; put(u * u * x + 2 * u * t * c[1] + t * t * c[3], u * u * y + 2 * u * t * c[2] + t * t * c[4]); } x = c[3]; y = c[4]; }
    else if (c[0] === "A") { for (const p of arcPoints(x, y, c[1], c[2], c[3], c[4], c[5], c[6], c[7], steps)) put(p[0], p[1]); x = c[6]; y = c[7]; }
    else if (c[0] === "Z") { if (cur.length) cur.push([cur[0][0], cur[0][1]]); x = x0; y = y0; cur = null; }
  }
  return subs.filter((s) => s.length > 1);
};
export const bboxOf = (subs) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of subs) for (const [x, y] of s) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  return x0 === Infinity ? [0, 0, 0, 0] : [x0, y0, x1 - x0, y1 - y0];
};
/** Signed shoelace area per subpath, summed: an outline with counter-wound holes gives its ink area. */
export const signedArea = (sub) => { let a = 0; for (let i = 0; i < sub.length; i++) { const [x0, y0] = sub[i], [x1, y1] = sub[(i + 1) % sub.length]; a += x0 * y1 - x1 * y0; } return a / 2; };
/** Ink area of one part under its fill rule (holes subtract when wound the other way; evenodd: holes subtract when nested). */
export const inkArea = (subs, rule = "nonzero") => {
  if (rule !== "evenodd") return Math.abs(subs.reduce((s, p) => s + signedArea(p), 0));
  // even-odd: a subpath inside an odd number of others is a hole
  return subs.reduce((s, p, i) => { const depth = subs.filter((q, j) => j !== i && inside(p[0], q)).length; return s + (depth % 2 ? -1 : 1) * Math.abs(signedArea(p)); }, 0);
};
/** Ray-cast point-in-polygon. */
export const inside = ([x, y], poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };

// ------------------------------------------------------------------ shapes -> d
const n0 = (v, d = 0) => { const x = parseFloat(v); return Number.isFinite(x) ? x : d; };
export const shapeToD = (node) => {
  const a = node.attrs, t = node.tag;
  if (t === "path") return a.d ?? null;
  if (t === "rect") {
    const x = n0(a.x), y = n0(a.y), w = n0(a.width), h = n0(a.height); if (!w || !h) return null;
    let rx = a.rx != null ? n0(a.rx) : a.ry != null ? n0(a.ry) : 0, ry = a.ry != null ? n0(a.ry) : rx; rx = Math.min(rx, w / 2); ry = Math.min(ry, h / 2);
    if (!rx || !ry) return `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
    return `M${x + rx} ${y}H${x + w - rx}A${rx} ${ry} 0 0 1 ${x + w} ${y + ry}V${y + h - ry}A${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}H${x + rx}A${rx} ${ry} 0 0 1 ${x} ${y + h - ry}V${y + ry}A${rx} ${ry} 0 0 1 ${x + rx} ${y}Z`;
  }
  if (t === "circle" || t === "ellipse") {
    const cx = n0(a.cx), cy = n0(a.cy), rx = t === "circle" ? n0(a.r) : n0(a.rx), ry = t === "circle" ? n0(a.r) : n0(a.ry); if (!rx || !ry) return null;
    return `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`;
  }
  if (t === "polygon" || t === "polyline") { const p = nums(a.points); if (p.length < 4) return null; let d = `M${p[0]} ${p[1]}`; for (let i = 2; i + 1 < p.length; i += 2) d += `L${p[i]} ${p[i + 1]}`; return t === "polygon" ? d + "Z" : d; }
  if (t === "line") return `M${n0(a.x1)} ${n0(a.y1)}L${n0(a.x2)} ${n0(a.y2)}`;
  return null;
};

// ------------------------------------------------------------------ styles: attributes, style="", <style> classes, inheritance
const NAMED = { white: "#ffffff", black: "#000000", red: "#ff0000", green: "#008000", lime: "#00ff00", blue: "#0000ff", yellow: "#ffff00", orange: "#ffa500", purple: "#800080", magenta: "#ff00ff", fuchsia: "#ff00ff", cyan: "#00ffff", aqua: "#00ffff", gray: "#808080", grey: "#808080", silver: "#c0c0c0", navy: "#000080", teal: "#008080", maroon: "#800000", olive: "#808000", pink: "#ffc0cb", none: "none", transparent: "none" };
export const normColor = (c) => {
  const s = String(c ?? "").trim().toLowerCase(); if (!s) return null;
  if (NAMED[s]) return NAMED[s];
  const h = s.match(/^#([0-9a-f]{3,8})$/); if (h) { const v = h[1]; return "#" + (v.length === 3 || v.length === 4 ? v.slice(0, 3).split("").map((ch) => ch + ch).join("") : v.slice(0, 6)); }
  const r = s.match(/^rgba?\(([^)]*)\)$/); if (r) { const [R, G, B] = r[1].split(/[\s,/]+/).map((v) => (v.endsWith("%") ? (parseFloat(v) * 255) / 100 : parseFloat(v))); return "#" + [R, G, B].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join(""); }
  return s;
};
const INHERIT = ["fill", "fill-rule", "fill-opacity", "stroke", "stroke-width", "stroke-opacity", "stroke-linecap", "stroke-linejoin", "font-family", "color"];
const styleOf = (node, classes) => {
  const st = {};
  for (const cls of String(node.attrs.class ?? "").split(/\s+/).filter(Boolean)) Object.assign(st, classes[cls] ?? {});
  for (const k of [...INHERIT, "opacity", "stop-color", "stop-opacity", "clip-path", "mask", "display", "visibility"]) if (node.attrs[k] != null) st[k] = node.attrs[k];
  for (const decl of String(node.attrs.style ?? "").split(";")) { const [k, ...v] = decl.split(":"); if (k && v.length) st[k.trim()] = v.join(":").trim(); }
  return st;
};
const parseClasses = (svg) => {
  const out = {}, walk = (n) => { if (n.tag === "style") for (const m of n.text.matchAll(/([^{}]+)\{([^}]*)\}/g)) { const decls = {}; for (const d of m[2].split(";")) { const [k, ...v] = d.split(":"); if (k && v.length) decls[k.trim()] = v.join(":").trim(); } for (const sel of m[1].split(",")) { const c = sel.trim().match(/^\.([\w-]+)$/); if (c) out[c[1]] = { ...(out[c[1]] ?? {}), ...decls }; } } n.kids.forEach(walk); };
  walk(svg); return out;
};

// ------------------------------------------------------------------ the import
const pct = (v, d) => (v == null ? d : String(v).trim().endsWith("%") ? parseFloat(v) / 100 : parseFloat(v));
const urlRef = (v) => String(v ?? "").match(/url\(\s*['"]?#([^'")\s]+)['"]?\s*\)/)?.[1];
const round = (v) => Math.round(v * 100) / 100;

/**
 * SVG text -> { w, h, parts, fonts, warnings }. Each part: { d, fill, rule, op, bb, m? , stroke?, clip? }.
 * fill: { type: "solid", c } | { type: "lin", x1, y1, x2, y2, stops, m? } | { type: "rad", cx, cy, r, fx, fy, stops, m? }.
 * m is the part's own matrix (transforms and the viewBox folded in); the path data is never rewritten.
 */
export const importSvg = (text) => {
  const svg = parseXml(text), classes = parseClasses(svg), byId = new Map(), warnings = new Set(), fonts = new Set();
  const index = (n) => { if (n.attrs.id) byId.set(n.attrs.id, n); n.kids.forEach(index); }; index(svg);
  const vb = nums(svg.attrs.viewBox ?? svg.attrs.viewbox ?? ""), w = n0(svg.attrs.width, vb[2] ?? 0), h = n0(svg.attrs.height, vb[3] ?? 0);
  let root = I; if (vb.length === 4 && vb[2] && vb[3]) { const s = Math.min(w / vb[2], h / vb[3]); root = [s, 0, 0, s, -vb[0] * s + (w - vb[2] * s) / 2, -vb[1] * s + (h - vb[3] * s) / 2]; }
  const stopsOf = (g, seen = new Set()) => {
    const own = g.kids.filter((k) => k.tag === "stop"); if (own.length || seen.has(g)) return own.map((s) => { const st = styleOf(s, classes); return [pct(s.attrs.offset, 0), normColor(st["stop-color"] ?? "#000"), pct(st["stop-opacity"], 1)]; });
    seen.add(g); const ref = byId.get(String(g.attrs["xlink:href"] ?? g.attrs.href ?? "").replace(/^#/, "")); return ref ? stopsOf(ref, seen) : [];
  };
  const paint = (v, bbLocal) => {
    if (v == null || v === "none") return null;
    const id = urlRef(v);
    if (!id) { const c = normColor(v === "currentColor" ? "#000" : v); return c === "none" ? null : { type: "solid", c }; }
    const g = byId.get(id); if (!g) { warnings.add(`a fill points at #${id}, which the file does not define; drawn black`); return { type: "solid", c: "#000000" }; }
    if (g.tag === "pattern") { warnings.add(`#${id} is a pattern fill (often an embedded image); not imported, check the contact sheet`); return null; }
    const stops = stopsOf(g), obb = (g.attrs.gradientUnits ?? "objectBoundingBox") === "objectBoundingBox";
    let gm = g.attrs.gradientTransform ? parseTransform(g.attrs.gradientTransform) : I;
    if (obb) gm = mul([bbLocal[2], 0, 0, bbLocal[3], bbLocal[0], bbLocal[1]], gm);
    const f = g.tag === "radialGradient"
      ? { type: "rad", cx: pct(g.attrs.cx, 0.5), cy: pct(g.attrs.cy, 0.5), r: pct(g.attrs.r, 0.5), fx: pct(g.attrs.fx ?? g.attrs.cx, 0.5), fy: pct(g.attrs.fy ?? g.attrs.cy, 0.5), stops }
      : { type: "lin", x1: pct(g.attrs.x1, 0), y1: pct(g.attrs.y1, 0), x2: pct(g.attrs.x2, 1), y2: pct(g.attrs.y2, 0), stops };
    if (!isIdentity(gm)) f.m = gm.map(round6);
    return f;
  };
  const parts = [];
  const visit = (node, m, inh, op, clipOuter) => {
    const t = node.tag; if (["defs", "symbol", "clipPath", "mask", "linearGradient", "radialGradient", "pattern", "style", "title", "desc", "metadata", "filter", "marker"].includes(t)) return;
    const own = styleOf(node, classes); if (own.display === "none" || own.visibility === "hidden") return;
    const st = { ...inh }; for (const k of INHERIT) if (own[k] != null) st[k] = own[k];
    let mm = node.attrs.transform ? mul(m, parseTransform(node.attrs.transform)) : m, o = op * pct(own.opacity, 1);
    let clipFromMask = null;
    if (own.mask) {
      // a mask made only of solid white shapes is a clip (Figma exports simple masks this way); a soft or grey mask is not
      const mk = byId.get(urlRef(own.mask)), shapes = mk ? mk.kids.filter((k) => shapeToD(k)) : [];
      const hard = mk && shapes.length && shapes.length === mk.kids.length && shapes.every((k) => { const ks = styleOf(k, classes); return ["#ffffff"].includes(normColor(ks.fill ?? "#000")) && pct(ks.opacity, 1) === 1 && pct(ks["fill-opacity"], 1) === 1; });
      if (hard) clipFromMask = { paths: shapes.map((k) => ({ d: shapeToD(k), m: (k.attrs.transform ? mul(mm, parseTransform(k.attrs.transform)) : mm).map(round6) })) };
      else warnings.add(`an element uses a soft or grey mask (${own.mask}); the import draws it unmasked, check the contact sheet`);
    }
    if (own.filter || node.attrs.filter) warnings.add("an element uses an SVG filter (blur, shadow); the import leaves it out, the film draws shadows itself");
    let clip = clipFromMask ?? clipOuter; const cid = urlRef(own["clip-path"]);
    if (cid) { const cp = byId.get(cid); const ds = cp ? cp.kids.map((k) => shapeToD(k) && { d: shapeToD(k), m: k.attrs.transform ? mul(mm, parseTransform(k.attrs.transform)) : mm }).filter(Boolean) : []; if (ds.length) clip = { paths: ds.map((x) => ({ d: x.d, m: x.m.map(round6) })) }; else warnings.add(`clip-path #${cid} could not be read; drawn unclipped`); }
    if (t === "text") { warnings.add("the file has live text: export with text outlined (Figma: svgOutlineText) or supply the font file, never set it in a stand-in face silently"); fonts.add(own["font-family"] ?? st["font-family"] ?? "(unnamed)"); return; }
    if (t === "image") { warnings.add("the file embeds a raster image; it is not a path, so it is not imported (bring it as an asset pinned by sha256)"); return; }
    if (t === "use") {
      const ref = byId.get(String(node.attrs["xlink:href"] ?? node.attrs.href ?? "").replace(/^#/, ""));
      if (!ref) { warnings.add(`a <use> points at a missing element`); return; }
      const um = mul(mm, [1, 0, 0, 1, n0(node.attrs.x), n0(node.attrs.y)]);
      if (ref.tag === "symbol") { ref.kids.forEach((k) => visit(k, um, st, o, clip)); return; }
      visit({ ...ref, attrs: { ...ref.attrs, id: undefined } }, um, st, o, clip); return;
    }
    if (t === "g" || t === "svg" || t === "a" || t === "switch") { node.kids.forEach((k) => visit(k, mm, st, o, clip)); return; }
    const d = shapeToD(node); if (!d) return;
    let local; try { local = bboxOf(flatten(d)); } catch (e) { warnings.add(`skipped a ${t} with unreadable path data (${e.message})`); return; }
    const isLine = t === "line" || t === "polyline";
    const fill = isLine ? null : paint(st.fill ?? "#000", local), stroke = paint(st.stroke, local);
    if (!fill && !stroke) return;
    const subs = flatten(d, mm), bb = bboxOf(subs), sw = n0(st["stroke-width"], 1) * Math.sqrt(Math.abs(mm[0] * mm[3] - mm[1] * mm[2]));
    const part = { d, fill: fill ?? { type: "none" }, rule: st["fill-rule"] === "evenodd" ? "evenodd" : "nonzero", op: round(o * pct(st["fill-opacity"], 1)), bb: (stroke ? [bb[0] - sw / 2, bb[1] - sw / 2, bb[2] + sw, bb[3] + sw] : bb).map(round) };
    if (!isIdentity(mm)) part.m = mm.map(round6);
    if (stroke) { part.stroke = { paint: stroke, w: n0(st["stroke-width"], 1), cap: st["stroke-linecap"] ?? "butt", join: st["stroke-linejoin"] ?? "miter", op: round(o * pct(st["stroke-opacity"], 1)) }; warnings.add("the file has strokes; they are drawn as strokes (export with outlined strokes for an exact match at every scale)"); }
    if (clip) part.clip = clip;
    parts.push(part);
  };
  svg.kids.forEach((k) => visit(k, root, {}, 1, null));
  return { w, h, parts, fonts: [...fonts], warnings: [...warnings] };
};
const round6 = (v) => Math.round(v * 1e6) / 1e6;

// ------------------------------------------------------------------ what the marks can do in motion
/** Outline points of a whole element, resampled so long curves and short lines weigh the same. */
export const outline = (el, spacing) => {
  const pts = [];
  for (const p of el.parts) for (const s of flatten(p.d, p.m ?? I)) for (let i = 1; i < s.length; i++) {
    const [x0, y0] = s[i - 1], [x1, y1] = s[i], L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(L / spacing));
    for (let j = 0; j < n; j++) pts.push([x0 + ((x1 - x0) * j) / n, y0 + ((y1 - y0) * j) / n]);
  }
  return pts;
};
const grid = (pts, cell) => { const g = new Map(); for (const p of pts) { const k = `${Math.floor(p[0] / cell)},${Math.floor(p[1] / cell)}`; (g.get(k) ?? g.set(k, []).get(k)).push(p); } return g; };
const nearest = (g, cell, [x, y]) => { let best = Infinity; const cx = Math.floor(x / cell), cy = Math.floor(y / cell); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const q of g.get(`${cx + i},${cy + j}`) ?? []) best = Math.min(best, Math.hypot(q[0] - x, q[1] - y)); return best; };
/** Worst distance from the mapped outline back to the outline, as a share of the diagonal. */
const mismatch = (pts, map, tol) => { const g = grid(pts, tol); let worst = 0; for (const p of pts) { const d = nearest(g, tol, map(p)); if (d > worst) worst = d; if (worst === Infinity) break; } return worst; };
/**
 * Symmetry of an element about its bounding-box centre. -> { rotational: n (1 = none; 2 = same after a half turn), mirrorX, mirrorY }
 * A tolerance of 1% of the diagonal: exports carry rounding, a real asymmetry is far larger.
 */
export const symmetry = (el, tolShare = 0.01) => {
  const bb = bboxOf(el.parts.map((p) => flatten(p.d, p.m ?? I)).flat()), diag = Math.hypot(bb[2], bb[3]) || 1, tol = diag * tolShare;
  const pts = outline(el, tol / 2), cx = bb[0] + bb[2] / 2, cy = bb[1] + bb[3] / 2;
  const rot = (a) => ([x, y]) => [cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)];
  const holds = (map) => mismatch(pts, map, tol) <= tol;
  let rotational = 1; for (const n of [6, 5, 4, 3, 2]) if (holds(rot((2 * Math.PI) / n))) { rotational = n; break; }
  return { rotational, mirrorX: holds(([x, y]) => [2 * cx - x, y]), mirrorY: holds(([x, y]) => [x, 2 * cy - y]) };
};
/**
 * Repeats inside an element: parts with the same shape (same size, fill and outline) placed at a constant step.
 * -> [{ copies, step: [dx, dy], seamless }]; seamless when copies x step spans the element's own width or height, so it tiles end to end.
 */
export const repeats = (el, tol = 0.5) => {
  // a gradient's coordinates move with each copy, so a copy is matched by its colours, not by its gradient vector
  const colours = (f) => (f.type === "solid" ? f.c : f.type === "none" ? "none" : JSON.stringify(f.stops));
  const shapeSig = (p) => `${Math.round(p.bb[2] / tol)}x${Math.round(p.bb[3] / tol)}|${parsePath(p.d).length}`;
  const out = [], seen = new Set();
  for (const [what, sig] of [["shape", shapeSig], ["pattern", (p) => `${shapeSig(p)}|${colours(p.fill)}`]]) {
    const groups = new Map(); for (const p of el.parts) { const k = sig(p); (groups.get(k) ?? groups.set(k, []).get(k)).push(p); }
    for (const g of groups.values()) {
      if (g.length < 2) continue;
      for (const axis of [0, 1]) {
        const pos = g.map((p) => p.bb[axis]).sort((a, b) => a - b), steps = pos.slice(1).map((v, i) => v - pos[i]);
        if (!steps.every((s) => s > tol && Math.abs(s - steps[0]) <= tol)) continue;
        const step = round(steps[0]), span = axis ? el.h : el.w, key = `${what}|${axis}|${step}`;
        if (seen.has(key) || (what === "pattern" && seen.has(`shape|${axis}|${step}`))) continue; seen.add(key);
        out.push({ what, copies: g.length, step: axis ? [0, step] : [step, 0], seamless: Math.abs(g.length * step - span) <= Math.max(1, span * 0.005) });
      }
    }
  }
  return out;
};

/** Every colour an element uses, from fills, strokes and gradient stops. */
export const coloursOf = (el) => {
  const out = new Map(), add = (c, area) => { if (!c || c === "none") return; out.set(c, (out.get(c) ?? 0) + area); };
  const fromPaint = (f, area) => { if (!f) return; if (f.type === "solid") add(f.c, area); else for (const s of f.stops ?? []) add(s[1], area / (f.stops.length || 1)); };
  for (const p of el.parts) { const area = p.bb[2] * p.bb[3]; fromPaint(p.fill, area); if (p.stroke) fromPaint(p.stroke.paint, area * 0.1); }
  return out;
};

/**
 * Logo metrics for sizing a strip of logos so they read equally: ink area (outline area under the fill rule),
 * ink bbox, and overlapping outlines between separate parts (flagged "check with the owner": shared strokes in a
 * wordmark may be the design, so they are never auto-fixed).
 */
export const logoMetrics = (el) => {
  const shapes = el.parts.map((p) => ({ subs: flatten(p.d, p.m ?? I), rule: p.rule, bb: p.bb }));
  const ink = shapes.reduce((s, x) => s + inkArea(x.subs, x.rule), 0), bb = bboxOf(shapes.map((x) => x.subs).flat());
  let overlaps = 0;
  for (let i = 0; i < shapes.length; i++) for (let j = i + 1; j < shapes.length; j++) {
    const a = shapes[i].bb, b = shapes[j].bb; if (a[0] > b[0] + b[2] || b[0] > a[0] + a[2] || a[1] > b[1] + b[3] || b[1] > a[1] + a[3]) continue;
    // a vertex of one outline strictly inside the other's outer ring means the shapes cross or share a stroke
    const outer = (s) => s.subs.reduce((m, p) => (Math.abs(signedArea(p)) > Math.abs(signedArea(m)) ? p : m), s.subs[0]);
    const A = outer(shapes[i]), B = outer(shapes[j]);
    if (A && B && (A.some((p) => inside(p, B)) || B.some((p) => inside(p, A)))) overlaps++;
  }
  return { ink: round(ink), bbox: bb.map(round), aspect: bb[3] ? round(bb[2] / bb[3]) : 0, overlaps };
};
/** Recolour every paint of an element to one colour (a logo for a dark or light ground). Gradients become the colour too. */
export const monochrome = (el, colour) => ({ ...el, parts: el.parts.map((p) => ({ ...p, fill: p.fill.type === "none" ? p.fill : { type: "solid", c: colour }, ...(p.stroke ? { stroke: { ...p.stroke, paint: { type: "solid", c: colour } } } : {}) })) });
/** Write an element back out as a standalone SVG (tight viewBox around its ink, for logos). */
export const toSvg = (el, { tight = false, pad = 0 } = {}) => {
  const bb = tight ? bboxOf(el.parts.map((p) => flatten(p.d, p.m ?? I)).flat()) : [0, 0, el.w, el.h];
  const vb = [bb[0] - pad, bb[1] - pad, bb[2] + 2 * pad, bb[3] + 2 * pad].map(round);
  const defs = [], paintAttr = (f) => {
    if (!f || f.type === "none") return "none"; if (f.type === "solid") return f.c;
    const id = `g${defs.length}`, stops = f.stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join(""), gt = f.m ? ` gradientTransform="matrix(${f.m.join(" ")})"` : "";
    defs.push(f.type === "lin" ? `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${f.x1}" y1="${f.y1}" x2="${f.x2}" y2="${f.y2}"${gt}>${stops}</linearGradient>` : `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${f.cx}" cy="${f.cy}" r="${f.r}" fx="${f.fx}" fy="${f.fy}"${gt}>${stops}</radialGradient>`);
    return `url(#${id})`;
  };
  const body = el.parts.map((p) => `<path d="${p.d}" fill="${paintAttr(p.fill)}" fill-rule="${p.rule}"${p.op !== 1 ? ` opacity="${p.op}"` : ""}${p.m ? ` transform="matrix(${p.m.join(" ")})"` : ""}${p.stroke ? ` stroke="${paintAttr(p.stroke.paint)}" stroke-width="${p.stroke.w}"` : ""}/>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${vb[2]}" height="${vb[3]}" viewBox="${vb.join(" ")}">${defs.length ? `<defs>${defs.join("")}</defs>` : ""}${body}</svg>`;
};

// ------------------------------------------------------------------ outputs
/** The TS module a film imports. brandMeta goes into meta.brand so the gate knows the brand's colours and elements. */
export const brandModule = (brand, kitImport) => [
  `// Written by tools/brand.mjs import from ${Object.keys(brand.elements).length} source file(s); never edit by hand, re-import instead.`,
  "// These are the brand's exact paths: move, rotate, scale evenly, clip and layer them (brandKit.ts), never redraw them.",
  kitImport ? `import type { BrandElement } from "${kitImport}";` : "type BrandElement = { w: number; h: number; parts: any[] };",
  "",
  `export const BRAND: { elements: Record<string, BrandElement>; palette: { hex: string; share: number }[]; fonts: string[]; motion: Record<string, any> } = ${JSON.stringify({ elements: brand.elements, palette: brand.palette, fonts: brand.fonts, motion: brand.motion ?? {} })};`,
  "",
  `/** For the film's meta.brand: the brand's colours (never drawn translucent outside a declared exception) and its element names. */`,
  `export const brandMeta = ${JSON.stringify({ colors: brand.palette.map((p) => p.hex).filter((h) => /^#[0-9a-f]{6}$/.test(h)), elements: Object.keys(brand.elements) })};`,
  "/** For the film's meta.motion: layerscan fails a brand colour filled half-transparent. Spread it: meta.motion = { ...brandMotion, temperament: \"calm\" }. */",
  `export const brandMotion = ${JSON.stringify({ brandColors: brand.palette.map((p) => p.hex).filter((h) => /^#[0-9a-f]{6}$/.test(h)) })};`,
  "",
].join("\n");

/** Size every logo so its ink matches the median logo's ink at the strip height: equal visual weight, not equal boxes. */
export const equaliseLogos = (logos, height = 80) => {
  // ink per unit of height squared, so logos of different heights compare
  const dens = logos.map((l) => l.ink / (l.h * l.h)), sorted = [...dens].sort((a, b) => a - b), median = sorted[Math.floor(sorted.length / 2)] || 1;
  return logos.map((l, i) => ({ ...l, density: Math.round(dens[i] * 1000) / 1000, height: Math.round(height * Math.sqrt(median / (dens[i] || median))) }));
};
