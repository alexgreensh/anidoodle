// HUMAN CANON. Proportions are data, declared per character and CHECKED, never eyeballed.
//
// Sources (standard figure-drawing canon, cross-checked): Loomis, "Figure Drawing for All It's
// Worth" (1943), the heads-by-age chart and the 8-head ideal; Hogarth "Dynamic Anatomy" for
// the 7.5 average adult; anthropometric segment ratios from Winter, "Biomechanics and Motor
// Control of Human Movement" (4th ed., table 4.1: segment lengths as fractions of height,
// segment masses and centre-of-mass positions). Those are the numbers below.
//
// Every landmark is a height above the floor IN HEAD UNITS (hh = chin to crown). A stylised
// canon (storybook, rubber hose) is a declared ROW here, never an exception in drawing code.

export type CanonRow = {
  id: string; label: string; age: number; stylised: boolean; note: string;
  heads: number;          // crown height / head height
  eyeLine: number;        // eye line above chin, as a fraction of head height (0.5 adult, lower in children)
  // landmark heights above the floor (hh)
  root: number; hip: number; knee: number; ankle: number; lumbar: number; chest: number; neckBase: number; pivot: number; shoulder: number;
  hipX: number; shoulderX: number;
  upperArm: number; forearm: number; hand: number; foot: number; heel: number;
  build: number;          // 0 = slight, 1 = heavy; scales girths
};

// heads tall by age: the reference column (Loomis' age chart; the average adult is 7.5).
export const HEADS_BY_AGE: [number, number][] = [[1, 4], [3, 5], [6, 5.75], [8, 6], [9, 6.2], [12, 7], [15, 7.25], [25, 7.5]];
export const headsForAge = (age: number) => { const t = HEADS_BY_AGE; if (age <= t[0][0]) return t[0][1]; for (let i = 1; i < t.length; i++) if (age <= t[i][0]) { const [a0, h0] = t[i - 1], [a1, h1] = t[i]; return h0 + ((h1 - h0) * (age - a0)) / (a1 - a0); } return t[t.length - 1][1]; };
// eye line sinks toward the chin in children: the cranium is proportionally bigger
export const EYE_LINE_BY_AGE: [number, number][] = [[1, 0.38], [3, 0.4], [6, 0.42], [9, 0.44], [12, 0.46], [16, 0.49], [25, 0.5]];
export const eyeLineForAge = (age: number) => { const t = EYE_LINE_BY_AGE; if (age <= t[0][0]) return t[0][1]; for (let i = 1; i < t.length; i++) if (age <= t[i][0]) { const [a0, h0] = t[i - 1], [a1, h1] = t[i]; return h0 + ((h1 - h0) * (age - a0)) / (a1 - a0); } return t[t.length - 1][1]; };

export const CANON: Record<string, CanonRow> = {
  // The average adult, 7.5 heads: crotch at half height, elbow at the waist, wrist at the crotch,
  // hand = face, foot = forearm.
  adult: {
    id: "adult", label: "Adult, realistic (7.5 heads)", age: 30, stylised: false, note: "Hogarth / Loomis average adult",
    heads: 7.5, eyeLine: 0.5,
    root: 4.12, hip: 3.9, knee: 2.1, ankle: 0.36, lumbar: 4.5, chest: 5.0, neckBase: 6.24, pivot: 6.74, shoulder: 6.12,
    hipX: 0.42, shoulderX: 0.76, upperArm: 1.42, forearm: 1.12, hand: 0.8, foot: 1.1, heel: 0.24, build: 0.5,
  },
  // A nine-year-old is about 6.2 heads in life. Storybook enlarges the head (the reader looks at
  // the face) so the same child reads 5.2 heads tall. Limb ratios below the neck are the real
  // child's, rescaled: legs are 46% of height, not the adult 50%.
  storybookChild: {
    id: "storybookChild", label: "Child 9 y, storybook (5.2 heads, declared stylisation of 6.2)", age: 9, stylised: true, note: "head enlarged 1.19x over the age-9 canon; body ratios kept",
    heads: 5.2, eyeLine: 0.44,
    root: 2.72, hip: 2.62, knee: 1.42, ankle: 0.22, lumbar: 2.9, chest: 3.12, neckBase: 3.98, pivot: 4.44, shoulder: 3.9,
    hipX: 0.28, shoulderX: 0.6, upperArm: 0.9, forearm: 0.72, hand: 0.5, foot: 0.72, heel: 0.15, build: 0.35,
  },
};

// The canon rules a figure is checked against. Each returns [ok, measured, wanted].
export type CanonCheck = { id: string; rule: string; ok: boolean; got: number; want: number; tol: number };
