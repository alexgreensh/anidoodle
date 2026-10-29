# Facts: every claim has a source

Any film that makes a claim, on screen or spoken, keeps a `facts.json`. It is the explainer's
research ledger (`explainer.md`) made general, and the launch film's list of approved claims
(`launch-video.md`). A viewer cannot check a film; this is how you can.

## The rule

- **Every claim is listed**: each line of words, each number, each label that asserts something,
  and each narrated sentence.
- **Each has its source**: the exact sentence it comes from, copied, and a URL or a file path.
- **Nothing is invented.** No testimonial, rating, review, price, result, user count or real
  person that the sources do not give. A quote needs its speaker and its page.
- **What the film generates is labelled.** A slogan, a drawn scene, a mock screen, made-up sample
  data: `generated: true` with a note saying what it is. A generated entry states no number; a
  number needs a source.
- **A claim you cannot source is cut**, or shown plainly as a metaphor.
- **A count drawn on screen is a number.** Six "?" dots claim six more speakers; three seats claim
  three places left. List it with digits ("6 more speakers") so it needs a source, or draw one symbol.
- **Say each fact once.** The same line twice, or the same number on two cards ("about 400" and
  "400+"), fails; the later entry may carry `reuse: "<why the repeat earns its place>"` (a date on
  the hook and the end card, say). Single digits are counting words and never flagged.
- **A live site is a source with a date.** `"source": { "kind": "site", "url": "...", "fetched":
  "2026-10-27", "sentence": "..." }`: sites change, and the date says what was true when you read it.

## The file

```json
{ "version": 1, "claims": [
  { "claim": "Setup takes 40 minutes.", "where": "on-screen",
    "source": { "sentence": "Setup takes about 40 minutes.", "url": "https://example.com/docs/start" } },
  { "claim": "IDEA IN. ART OUT.", "where": "on-screen", "generated": true, "note": "slogan written for this film, states no fact" },
  { "claim": "It runs offline.", "where": "narration",
    "source": { "sentence": "No network is needed after install.", "file": "brief/readme.md#offline" } } ] }
```

`where` is `on-screen` or `narration`. `launch.mjs new <name>` writes an empty one beside the
project and never overwrites one that is there; `node tools/facts.mjs init` does the same for
any project. A film with a ledger of its own in `facts/<film>.json` is checked against that one
instead (the shipped examples keep theirs there, so they never seed your `facts.json`).

## The check

`node tools/facts.mjs <film>` (and `launch.mjs ship`, once per film) reads the claims the film
declares. A launch template film declares its type-frame words, its split words and its tagline,
and any `claims: [...]` in its spec; any other film sets `film.claims`. It fails when:

- a declared claim is not in `facts.json` (matched ignoring case, spacing and end punctuation);
- a sourced entry lacks the sentence, or a URL (http/https) or file;
- a generated entry has no note, or states a number;
- a number in a sourced claim is not in its source sentence;
- a claim is still a TODO;
- a line is declared twice, or two entries state the same number (10 or more, or with %, + or x),
  and the later one has no `reuse` reason;
- a `site` source has no URL or no `fetched` date.

A film that declares no claims reports `N/A`, never a pass. The check is light on purpose: it
cannot know a sentence is true. The critic does that by reading each source beside the film
(`review.md`), and the delivery says which facts were independently checked.
