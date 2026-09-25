# Folk-tale storybook painting

Module: `engine/src/canvas-core/folkTale.ts` (kit: `folkTaleKit.ts`, process runner from `sumiEKit.ts`).
Hero: a boy carrying a rooster along the path through a village kitchen garden at the edge of a birch wood.
Format: 16:9, 1920 x 1080 (W and H from `meta`).

**The tradition.** Russian folk-tale book illustration in the storybook-painting manner: gouache and
watercolour over a full pencil drawing, where the painting is carried only as far forward as it
is needed and the back of the picture is left as the bare drawing.

**The medium, physically.** An HB graphite drawing on warm cream cartridge paper, then paint:
opaque gouache (body colour) laid with a half-dry round brush in the foreground, and thin,
transparent watercolour washes in the middle distance. The cream sheet shows through everywhere
the paint is thin, which gives the whole picture its glow.

**Depth is the medium.** This is the signature, and the rule every mark follows. Each mark takes
a depth `d`, from 0 at the viewer's feet to 1 at the horizon:
- **Foreground (d ≈ 0):** opaque, saturated, textured. Leaves have two-tone halves split at the
  midrib, a brush lay-in pulled out along the side veins, painted veins and dry-brush flecks.
  Sunflower rays are laid one at a time, each one creased and streaked. Grass is thousands of
  single blades, clumped.
- **Middle distance (d ≈ 0.3 to 0.6):** colour is mixed toward the warm haze (`far()`), the paint
  thins, the texture drops out, and the paint stops short of its own pencil line. Big middle
  things (the cottage, the haystack, the mid birches) dissolve into their drawing through a
  gradient mask (`faded()`).
- **Far (d ≥ 0.9):** no paint at all. Onion domes, bell tower, post mill, log houses and trees
  are pencil line on the cream sheet, the trees as scalloped crowns.
- **The golden haze** is a soft warm band laid over the middle distance before the foreground is
  painted, so the near things stand in front of the light.

**The mark.** In pencil, a soft line whose weight and darkness breathe with the pressure of the
hand, lighter where it lands and lifts, gone over a second time slightly off. In paint, an opaque
fill with a wobbling brush-cut edge, dry-brush drags inside it (three or four bristle lines that
break), and a slightly darker rim where the gouache settles.

**The edge.** In the foreground the edge is crisp and a little darker. In the middle it is soft,
and the paint misses the line. At the back the edge is the pencil line itself.

**Order.** Bare sheet → the whole scene in pencil, big shapes first (horizon and village, birch
trunks, haystack, cottage, fence, path, figure, garden, sunflowers, leaves) → the sky glow → the
meadow, back to front → the birch wood from far (line only) to near (paint) → the cottage,
thinning out into its drawing → the haystack → the golden haze → the middle sunflowers → the
wattle fence → the birch canopy → the path → the middle grass and daisies → the boy and his
rooster (trousers and bast shoes, shirt, tail, bird, head and comb, hands, head, face last) →
foreground grass → pumpkin leaves, pumpkins, tendrils → the big sunflowers → dog-rose,
bellflowers, burdock → a front fringe of grass → near daisies → the seeding umbels.

**Palette.** Cream paper `#f4edda`, warm haze `#f2e9c9`, sap and olive greens, yellow ochre,
cadmium yellow and orange (sunflowers, pumpkins), vermilion (the shirt and the comb), cobalt
violet (bellflowers), burnt umber, and graphite `#6f665a` for the line.

**Characters.** Warm caricature. Round heads with rosy cheeks (a soft radial blush), dot eyes with
a catchlight, a button nose, a small smile. Big, simple costume shapes carry the folk pattern: an
embroidered hem and placket, a sash with tassels, leg wrappings laced with bast, woven bast shoes.
Proportions stay true to age: the boy is about six, a little under six heads tall.

**Not its nearest neighbour (`storybook`, pencil and gentle watercolour).** `storybook` paints
everything at the same thin transparency. `folkTale` changes the medium with distance: opaque,
dry-brushed gouache at the front, a pale wash in the middle, bare pencil at the back. Its
foreground is dense with separately painted leaves, rays and blades, where `storybook` lays
washes that pool.

**Motion grammar.** The drawing is made. The pencil lay-in comes first, each line paced by its
length. Then the paint goes on from back to front: big washes sweep across behind a noisy wet
front (`reveal()`), leaves grow out from their stalks and then take their veins, sunflower rays
land one by one before the disc is laid, and grass is laid clump by clump. There is a short
pause between passes. Nothing fades or scales in. The last 30 frames hold the finished still.

**Kit primitives written for this plate** (candidates for core): `pencil`/`sketch`, `gouache`,
`reveal`, `faded` (+ `ramp`/`radial` masks), `leaf`/`lineLeaf`, `petal`/`sunflower`, `daisy`,
`bell`, `dogRose`, `umbel`, `grass` (clumped, with skip regions), `limb`/`lineLimb`, `pumpkin`,
`gourdLeaf`, `tendril`.
