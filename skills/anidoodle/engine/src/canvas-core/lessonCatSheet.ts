// The cat lesson's step sheet: one panel per step, earlier marks pale, the step's marks strong.
import { catScore } from "./lessonCat";
import { lessonSheet } from "./lesson";

export const lessonCatSheet = lessonSheet(catScore, { crop: [180, 150, 960, 950] });
