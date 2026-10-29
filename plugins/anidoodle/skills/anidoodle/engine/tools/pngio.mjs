// PNG IO. Just enough PNG to trim a logo's transparent margins and measure its ink, with no
// dependency: 8-bit greyscale, grey+alpha, RGB, RGBA and palette images, not interlaced. Anything else
// gets a message naming the fix (re-export as 8-bit RGBA), never a wrong answer.
import { deflateSync, inflateSync } from "node:zlib";

const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

/** PNG bytes -> { w, h, data: RGBA Uint8Array }. */
export const decodePng = (buf) => {
  if (!Buffer.isBuffer(buf) || buf.length < 8 || !buf.subarray(0, 8).equals(SIG)) throw new Error("not a PNG file");
  let pos = 8, w = 0, h = 0, depth = 0, type = 0, interlace = 0, palette = null, trns = null; const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), kind = buf.toString("latin1", pos + 4, pos + 8), body = buf.subarray(pos + 8, pos + 8 + len); pos += 12 + len;
    if (kind === "IHDR") { w = body.readUInt32BE(0); h = body.readUInt32BE(4); depth = body[8]; type = body[9]; interlace = body[12]; }
    else if (kind === "PLTE") palette = body; else if (kind === "tRNS") trns = body; else if (kind === "IDAT") idat.push(body); else if (kind === "IEND") break;
  }
  if (depth !== 8) throw new Error(`PNG bit depth ${depth} is not read here: re-export the logo as an 8-bit RGBA PNG (or bring the SVG)`);
  if (interlace) throw new Error("interlaced PNGs are not read here: re-export without interlacing (or bring the SVG)");
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type]; if (!ch) throw new Error(`PNG colour type ${type} is not supported`);
  const raw = inflateSync(Buffer.concat(idat)), stride = w * ch, px = new Uint8Array(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), row = y * stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? px[row + x - ch] : 0, b = y ? px[row - stride + x] : 0, c = x >= ch && y ? px[row - stride + x - ch] : 0;
      let v = src[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[row + x] = v & 255;
    }
  }
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const s = i * ch, d = i * 4;
    if (type === 6) { data[d] = px[s]; data[d + 1] = px[s + 1]; data[d + 2] = px[s + 2]; data[d + 3] = px[s + 3]; }
    else if (type === 2) { data[d] = px[s]; data[d + 1] = px[s + 1]; data[d + 2] = px[s + 2]; data[d + 3] = 255; }
    else if (type === 0) { data[d] = data[d + 1] = data[d + 2] = px[s]; data[d + 3] = 255; }
    else if (type === 4) { data[d] = data[d + 1] = data[d + 2] = px[s]; data[d + 3] = px[s + 1]; }
    else { const k = px[s]; data[d] = palette[k * 3]; data[d + 1] = palette[k * 3 + 1]; data[d + 2] = palette[k * 3 + 2]; data[d + 3] = trns && k < trns.length ? trns[k] : 255; }
  }
  return { w, h, data };
};
/** { w, h, data: RGBA } -> PNG bytes (filter 0, which is plenty for logos). */
export const encodePng = ({ w, h, data }) => {
  const raw = Buffer.alloc((w * 4 + 1) * h); for (let y = 0; y < h; y++) Buffer.from(data.buffer, data.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  const chunk = (kind, body) => { const len = Buffer.alloc(4); len.writeUInt32BE(body.length); const kb = Buffer.concat([Buffer.from(kind, "latin1"), body]), c = Buffer.alloc(4); c.writeUInt32BE(crc32(kb)); return Buffer.concat([len, kb, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([SIG, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
};
/** Box of pixels with alpha over `min` (a PNG's transparent margin removed). -> [x, y, w, h], or null when it is empty. */
export const alphaBox = ({ w, h, data }, min = 8) => {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[(y * w + x) * 4 + 3] > min) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
};
export const crop = (img, [x, y, w, h]) => { const data = new Uint8Array(w * h * 4); for (let r = 0; r < h; r++) data.set(img.data.subarray(((y + r) * img.w + x) * 4, ((y + r) * img.w + x + w) * 4), r * w * 4); return { w, h, data }; };
/** Ink: the summed alpha, in whole-pixel units (a half-transparent pixel counts half). */
export const inkOf = ({ data }) => { let s = 0; for (let i = 3; i < data.length; i += 4) s += data[i]; return s / 255; };
/** Paint every visible pixel one colour, keeping its alpha (a white logo for a dark ground). */
export const tint = (img, [r, g, b]) => { const data = new Uint8Array(img.data); for (let i = 0; i < data.length; i += 4) { data[i] = r; data[i + 1] = g; data[i + 2] = b; } return { ...img, data }; };
/** Does the image have a solid (non-transparent) background? Corner pixels all opaque means yes. */
export const opaqueCorners = ({ w, h, data }) => [0, w - 1, (h - 1) * w, h * w - 1].every((i) => data[i * 4 + 3] > 245);
