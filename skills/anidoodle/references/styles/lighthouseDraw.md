# Risograph, pulled drum by drum (`lighthouseDraw.ts` over `lighthouse.ts`)

A riso print is not drawn, it is fed: the same sheet goes through the machine once per ink, a
different drum loaded each time. `lighthouse.ts` only gained `export` on its three plate
functions (md5 of the hero still checked before and after: unchanged). Frame 0 is the bare sheet
with its trim marks. Yellow first: the ink lands at the nip, a straight front travelling down the
sheet at constant feed speed (a short grip and release at the ends) with the drum's shadow riding
just ahead of it. A breath while the drum is swapped. Pink over the dry yellow at its own
registration offset, so every overprint is born at the nip line (coral sky, orange sun). Swap.
Blue last, the key plate: dusk violet, green turf, the shadow side of every form and the crayon
key lines arrive in one sweep. Each ink's swatch in the colour bar prints with its own drum. The
held finish is `drawLighthouse` itself, so the last second is the hero still byte for byte.
Motion grammar: the only moving thing is the nip line. Never a fade.
