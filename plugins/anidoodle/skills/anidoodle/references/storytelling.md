# The story is the point

> Doctrine earned making MECHANICAL LEPIDOPTERA, the worked example in `example/`. Every rule
> below was paid for on that film; where a mistake was the director's own it says so, because
> a rule with its scar attached is one people keep.

**The mistake.** The brief we started from was "one clockwork butterfly, drawn four ways": blueprint, risograph, watercolour, editorial cutaway. Four acts, four lovely looks. We built three of them. Each one opened on a blank sheet, made its picture, flapped five times and held. It was a style reel with a butterfly in it. Nobody was moved, because nothing happened to anybody. The client's correction was one sentence, and it is the best note in this document: *it is BUILT, then it comes ALIVE and outgrows its own blueprint.* The editorial act was cut whole. The riso act was cut a few hours later. The film got better each time something beautiful was removed.

**Why it works this way.** An audience forgives a rough drawing in a story and resents a gorgeous one without. Style is how you say it. If there is no "it", style is a screensaver.

**What a film needs, even at 60 seconds:**

- **A transformation you can state as two words with an arrow.** Ours: built → alive. If yours is a list ("then we see it in riso"), it is not a story yet.
- **A hook in the first three seconds.** Ours: a bare sheet starts drawing itself. A question is planted: what is it making? No logos, no blank holds, no "establishing" anything.
- **A turn you can point to on the timeline.** Ours is frame 545: one drop of water lands on the blueprint. Everything before is a hand making a drawing; everything after is the drawing doing what no hand did. The turn should be caused by something IN the world of the film. Water develops cyanotypes and lifts their blue, so water is an honest bridge from blueprint to watercolour. We had no honest bridge from printer's ink to watercolour, which is how we knew the riso act did not belong.
- **An escalation that is physical.** Ours is one continuous pull-back, macro to wide, and every widening is released by a take-off. The camera is not decorating the story, it IS the story: the world gets bigger because the creature does.
- **A visual token that comes back changed.** Ours: the blueprint sheet. It is the whole world in Act 1. At the end it is a small blue rectangle lying in the grass with a butterfly-shaped blank where the drawing used to be, and the winding key left on it, no longer needed. Nobody points at it. The audience finds it, and that is the payoff. Plant the token early, never explain it, bring it back small.
- **A flaw that heals.** In Act 1 one wing panel never seats. It hangs on its projection lines through the whole blueprint. When the creature wakes, that panel slides home and stays a different colour for ever: the blueprint's blue, carried into life. One imperfection, set up and paid off, does more than any amount of polish.
- **A resolve, then room.** The signature lands on the final downbeat and then there are five beats to read it. End on the beat, then let it breathe. Never end ON the last event.

**Before / after.**

| | Before | After |
|---|---|---|
| Logline | One creature drawn four ways | It is built, then it comes alive and leaves its blueprint behind |
| Structure | 4 acts x (blank, build, flap, hold) | Act 1 builds it. One unbroken shot brings it to life and opens the world |
| Medium changes | 3, because we had 4 styles | 1, because the story has 2 states |
| Ending | Hold on finished print | The sheet in the grass, the key left behind, a signature |

**Tests before you build.** Say it in three sentences. Name the frame of the turn. Name the token and the two frames where it appears. For every shot ask "what changed for the character"; a shot where the answer is "the rendering style" is a shot to cut. And: every element in frame gets a one-line reason. In our meadow each flower colour, the footpath and the sun all had one. The oval bokeh blobs had none, and they were the first thing the eye caught as fake.

**No dead air.** The first riso and watercolour acts were static for half their length and opened on three seconds of empty stock. The rule since: something visibly moves in every second, from frame 0, and a "hold" means the camera creeps while the subject keeps living. Check it with a tool (per-frame changed-pixel fraction, no identical consecutive frames, no 15-frame window under half a percent) and ALSO by eye: a creeping camera changes every pixel and satisfies the tool while the eye sees a still. We shipped a second of exactly that before I caught it on the contact sheet.

## Launch, brand and event films: a story, not a list

> Earned on a brand launch film that went through twelve versions. Its first board was nine facts,
> one per frame, and the note was "the whole thing literally looks like a deck". `tools/board.mjs`
> checks every rule below on the board, before anything is drawn.

- **A row is an action, never a fact.** Each storyboard row says what MOVES and what it becomes, and
  what it **carries** in from the row before (an object, a shape, the camera). Two rows in a row that
  carry nothing are two slide cuts. "You talk to AI all day" on its own frame is a slide; the AI's
  typing dots falling out of the chat into a crowd is a film.
- **A message, not just information.** Write the line the viewer should leave repeating ("AI is
  changing marketing. Nobody has a prompt for that.") beside the story sentence. A film that only
  informs plays as a promo deck.
- **The brand arrives as the answer.** After the problem line, the brand is shown as an action (the
  crowd wiring itself into a network) and the mark is **built from the thing that just acted** (the
  network's thread becomes the logo's neck). Test: "why does the logo appear now?" answered in one
  sentence from what is on screen. A thesis line followed by a logo, with no bridge, is a cut to an ad.
- **One actor carries the film.** Name it in the brief (the AI's three typing dots: its face, its
  fall, the crowd, the logo's dots, the last reply). It crosses every seam it can.
- **Counts change for a reason.** Three dots becoming two "for no reason" reads as noise. Keep the
  count, or show why it changes (one dot hops up and joins the network).
- **A count on screen is a claim.** Six "?" dots promise six more speakers. Use one symbol for "more
  to come", or source the number (`facts.md`).
- **The promise is what the viewer does and leaves with.** "Multiply your marketing intelligence"
  meant nothing to anyone; "Half a day with marketers who already figured it out. Leave with real
  systems that get real results." did. A brand tagline goes in only if it passes that test.
- **Say each thing once.** "About 400 of them" in the hook and "400+" on a numbers card is one fact
  told twice; cut one (`facts.mjs` fails a repeated number without a `reuse` reason).
- **One landing.** The last thing on screen is the end card OR the stinger, never card, stinger,
  card again. "Started with a conversation, end with a conversation." A stinger answers something
  visible in the three seconds before it.
- **Text that is not meant to be read must look unreadable.** Fast filler replies in real words make
  the eye try to read them; use "blah blah", greeked lines, or one real line then blah.
- **Events list their people.** Hosts and organisers, speakers (all of them, name, role and logo,
  no talk titles), sponsors and partners are brief fields, each present or excluded by the person.
  The hosts' own beat ("who's running this thing?") was the one viewers loved most.

## Comedy

> Same film. Its comedy scored 8 and 9 with critics, then most new jokes were "not funny, try harder",
> because every joke had one shape: the AI chimes in with a quip.

- **Pain first, then gags.** List the audience's lived pain points (the em-dash habit, "Great
  question!", "Compacting conversation...", "You've reached your limit, try again in 4 hours"), then
  write one gag per pain. Specific nouns beat generic AI jokes.
- **Punch at the situation or the habit, never at the tool the audience relies on, and never at a
  real person.** "Make it funnier without making AI look stupid": the AI became a witty wingman.
- **Pitch across devices.** A batch of pitches spans at least four: verbal, visual pun (an "I'm not a
  robot" box ticked beside "100% in person"), interaction (the user types "make no mistakes"),
  physical comedy, structural (self-editing copy, an empty chair). Each pitch names its device and
  where it lands. An observation (true, with no twist) is not a joke. Constraints you set yourself
  ("jokes only when the AI talks") are said out loud so the person can lift them.
- **Who gets it, in one line.** Every gag carries a note of who laughs and why. A gag that needs
  explaining to the client ("cameras can't be off"?) is cut or rewritten ("Nobody's on mute.").
- **A character keeps its visual voice.** A line spoken by the AI always looks like the AI's bubble
  (dots, then its type), even when it is the person's favourite joke dropped in late.
- **Self-aware hosts land.** "Three humans. I just take notes." The people behind the thing, laughing
  at their own role, beat any clever line about the product.

`board.mjs` holds the checkable half: each joke has a device, a "who gets it", and a butt that is a
situation or a habit; no device carries more than 60% of the jokes; pitches span four devices and
each has a twist; every speaking character has a registered visual voice.
