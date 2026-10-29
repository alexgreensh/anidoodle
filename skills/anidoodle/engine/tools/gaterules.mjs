// GATE RULES. The decisions gate.mjs makes that can be made without a browser, as pure functions, so each
// is unit-tested with a case that must fail (test/gaterules.test.ts).

/**
 * CHECK 5, 3D: what the page's runChecks returned on the frames asked. A 3D film with no frame that registers
 * anything to check (no grip, no rig) did not look: that FAILS, unless the film declares why there is
 * nothing to check in meta.checks.none["3d"] (a turntable with no characters and nothing held). It used to
 * print a note, count nothing, and let the gate say PASS without one 3D check having run.
 * -> { counted, ok, label, detail }: counted false is a listed note with the film's reason.
 */
export const threeDVerdict = ({ recs, sampled, fill, meta }) => {
  if (!recs.length) {
    const why = meta?.checks?.none?.["3d"];
    if (typeof why === "string" && why.trim()) return { counted: false, ok: true, label: `no frame registers anything to check (${sampled} sampled)`, detail: `declared in meta.checks.none["3d"]: ${why.trim()}` };
    return { counted: true, ok: false, label: `a 3D film with no frame registering anything to check (${sampled} sampled): the 3D checks could not look`, detail: 'register its characters and held props (three-core/checks3d.ts runChecks, registerGrip), or declare meta.checks.none["3d"] = "<reason>" when there is truly nothing to check' };
  }
  const findings = recs.flatMap((r) => r.findings), withGrip = recs.filter((r) => r.grips.length).length;
  return { counted: true, ok: findings.length === 0, label: `${recs.length} frames checked (${sampled} sampled + ${fill} in grip windows), ${withGrip} with a grip`, detail: findings.length ? `${findings.length} finding(s): ` + findings.slice(0, 6).map((x) => `${x.frame} ${x.kind} ${x.where}: ${x.detail}`).join(" | ") : "no finding" };
};

/**
 * The findings that belong to one grip (still.mjs --grips labels each crop with them). A grip is named
 * "<holder>/<prop>"; checkGrip's findings say "<holder> holding <prop>" and its proximity finding
 * "<holder> / <prop> at ...". Every crop used to carry every grip finding on the frame.
 */
export const gripFindings = (grip, findings) => {
  const name = String(grip.name), heads = [];
  for (let i = name.indexOf("/"); i >= 0; i = name.indexOf("/", i + 1)) { const h = name.slice(0, i), p = name.slice(i + 1); heads.push(`${h} holding ${p}`, `${h} / ${p} `); }
  return findings.filter((x) => (x.kind.startsWith("grip") || x.kind === "proximity") && heads.some((h) => String(x.where).startsWith(h)));
};

/**
 * CHECK 3, DEAD AIR, one row ("gate:identical" identical consecutive frames, "gate:still" a still window).
 * A film made before the check existed (a frozen source of a published film, whose pace was approved)
 * may declare the row in meta.checks.none with its reason: the row is then listed with the reason and its
 * findings, and not counted. Undeclared, it is a PASS or a FAIL as it was.
 * -> { counted, ok, detail }
 */
export const deadAirVerdict = (key, ok, detail, meta) => {
  const why = meta?.checks?.none?.[key];
  if (!ok && typeof why === "string" && why.trim()) return { counted: false, ok: true, detail: `declared in meta.checks.none["${key}"]: ${why.trim()}; found: ${detail}` };
  return { counted: true, ok, detail };
};
