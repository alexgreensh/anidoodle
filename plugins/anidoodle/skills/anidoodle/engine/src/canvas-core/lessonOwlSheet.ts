// The owl lesson's step sheet: a 3 x 3 grid sized to read at README width (lessonOwlLayout.ts).
import { owlScore } from "./lessonOwl";
import { owlSheet } from "./lessonOwlLayout";

export const lessonOwlSheet = owlSheet(owlScore, { crop: [96, 50, 904, 1134], subtitle: "1. Draw some circles.  2. Draw the rest of the owl.  The seven steps the meme skips are in between.", medium: "Graphite 2B to 6B, blue col-erase pencil, kneaded eraser" });
