# Fonts bundled with the engine

## Poppins Bold (the default 3D type face)

- File: `Poppins-Bold.ttf`, TrueType outlines (glyf), 155996 bytes
- sha256: `983676516167748b74de6f4771fb384c664fd913acb8b471122ecacf5da5ea6c`
- Version: Poppins 4.003, Copyright 2020 The Poppins Project Authors (https://github.com/itfoundry/Poppins)
- Licence: SIL Open Font License 1.1, full text in `Poppins-OFL.txt` (sha256 `6be04893d770899a015649c7aa3b582f871b272f8747a92b78b17c3e5c8b2573`). The font's own name table says the same (nameID 13/14), and test/threeType.test.ts checks it.
- Source: `https://github.com/google/fonts/raw/main/ofl/poppins/Poppins-Bold.ttf` and `.../OFL.txt`, fetched 2026-10-28.
- Why this face: a geometric bold sans that reads well extruded, and the face Alex's own sites use.
- Note: Poppins carries no kerning (no `kern` table, no GPOS `kern` feature, in every release). The parser reads both when a font has them; with Poppins, letter spacing is the only spacing control.

`poppinsBold.ts` is the same bytes as a base64 string module, which is how films carry the font
(no file is read and nothing is fetched at draw time). Regenerate it after replacing the .ttf with:

```
node -e 'const fs=require("fs"),b=fs.readFileSync("assets/fonts/Poppins-Bold.ttf");let h=0x811c9dc5;for(const x of b){h^=x;h=Math.imul(h,0x01000193)}h=(h>>>0).toString(16);const sha=require("crypto").createHash("sha256").update(b).digest("hex");fs.writeFileSync("assets/fonts/poppinsBold.ts",`// POPPINS BOLD as base64 (see PROVENANCE.md). sha256 ${sha}\nexport const POPPINS_BOLD_FNV = 0x${h};\nexport const POPPINS_BOLD_BYTES = ${b.length};\nexport const POPPINS_BOLD = "${b.toString("base64")}";\n`)'
```

The OFL allows bundling and redistribution with software; the font may not be sold on its own, and
a modified version may not use the reserved name. We ship it unmodified.

## Lora Bold and Instrument Sans Regular and Bold (the launch template's look example, launchExampleBrand)

- `Lora-Bold.ttf`, 133828 bytes, sha256 `7d74015e950c2fb66519c7295b8155621d22200ae2ca2a4c6b43ce3c490cac87`.
  Copyright 2011 The Lora Project Authors, SIL Open Font License 1.1, full text in `Lora-OFL.txt`
  (sha256 `62e37a82d3f1ef2a70712885fa8b3144b65fd144d8e748d6196b690a354d792c`). Reserved Font Name "Lora".
- `InstrumentSans-Regular.ttf`, 68028 bytes, sha256 `a22cb26e48fd79bcb01bf2fc92d36785474dce36d9c544ab0a8868c2657c4a87`.
  Copyright 2022 The Instrument Sans Project Authors, SIL Open Font License 1.1, full text in
  `InstrumentSans-OFL.txt` (sha256 `bf4dc6d13a8cccd4807133c77a1ee9619a16b92cb23322258725ab6731c2f6e5`).
- `InstrumentSans-Bold.ttf`, 68084 bytes, sha256 `444f85bf1c4b0e1ce1ca624f6be54bcd832207714ccaf4ea99ee531341683bdf`.
  Same family, copyright and licence as the Regular above.
- Source: copied unmodified from a local copy of Anthropic's canvas-design skill font folder (the same
  Google Fonts releases), 2026-10-29; nothing fetched.
- Why: a serif display face and a plain text face for the worked example of a custom look, so the template
  is proven on fonts that are not ours. A film imports them by path (`import f from ".../Lora-Bold.ttf"`);
  tools/overlay.mjs inlines the bytes, so the page carries them and nothing is read or fetched at draw time.
