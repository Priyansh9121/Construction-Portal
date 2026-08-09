# Visual principles

The visual constitution of the product.

Sits below `PRODUCT_SOUL.md` and above `VISUAL_IDENTITY.md`. The soul document
says what the product believes. This one says what those beliefs require of
anything the user can see — on any page, in any release, after any redesign.

`EXPERIENCE_LANGUAGE.md` and `INTERACTION_LANGUAGE.md` are its companions and
answer different questions: not what the product looks like, but what it is
like to be in, and what happens when a person touches it. The three are peers —
this one governs the frame, the second governs time, the third governs
behaviour. None outranks the others; a decision usually needs all three, and
where they collide the priority persona decides.

Nothing here is specific to a screen. If a law below stops being true because a
page changed, the page is wrong.

This document contains no values, no names and no mechanisms. It answers *why*
only. Every *how* lives downstream.

---

## 1. Purpose

The soul document establishes that this product's real output is **credibility**
— that a contractor who uses it should find their numbers are believed.

Credibility that cannot be seen does not work.

The moment that matters is not a user reading their own screen. It is a user
**turning the screen around**: showing a client why an invoice is right, showing
a subcontractor what was recorded, showing an auditor when a photograph was
taken. In that moment the interface is not a tool being used. It is **in the
room, as a co-witness**, and it is being judged by someone who has every
incentive to disbelieve it.

That is why visual design exists here. Not to express a brand. Not to make work
pleasant. To make the record *look* as trustworthy as it actually is, to a
stranger, in a few seconds, under hostile reading.

Everything below follows from a single observation about how trust reads:

> **An interface that argues cannot be a witness.**

A witness who embellishes is impeached. A record that has been dramatised,
flattered or decorated invites the question *what else was adjusted?* — and once
that question is asked, the evidence is gone, whatever the numbers say.

So restraint here is not taste. It is **evidentiary**. Every principle in this
document is downstream of the need to look like something that is not trying to
convince you.

---

## 2. Visual truth

The interface may reveal importance. It may never manufacture it.

**Visual weight must be proportional to consequence.** Not to how interesting
something is, not to how much computation produced it, not to how proud anyone
is of it. A figure that changes nothing gets no emphasis, however hard it was to
derive.

**A calm screen is a finding, not a failure.** When nothing is wrong, the
product must look like nothing is wrong. The instinct to make a quiet page
"engaging" is the instinct to overstate, and it is the most common way a
trustworthy product becomes an untrustworthy one. Quiet is the correct rendering
of a good day.

**Nothing routine may be made to look like an event.** Recording a payment is
ordinary. A month closing is ordinary. If the product treats the ordinary as
notable, the user loses the ability to tell — from the page alone — whether
something actually happened.

**Absence is stated, never styled away.** Where the product does not know
something, the interface says so plainly. It does not fill the gap with a
plausible-looking arrangement of pixels. A gap that has been made comfortable is
a gap someone will forget to ask about.

---

## 3. Hierarchy

Hierarchy exists to answer one question: **what needs me now?**

Not *what is biggest*, which is a fact about the layout. Not *what is most
important in general*, which is a fact about the domain. What needs me *now*,
which is a fact about the data as it stands this morning.

This has a consequence most interfaces do not accept: **hierarchy must be able
to change.** A section that is always the loudest thing on the page is not
expressing hierarchy; it is furniture. If the state of the business changes and
the visual emphasis does not, the emphasis was decorative all along.

The order in which signals should carry hierarchy, strongest first:

**Position.** What is encountered first is read first, and cannot be declined.
Position is the only hierarchy signal that survives every screen size, every
impairment and every reproduction. It should carry the most weight, and it is
also the most expensive to change — which is correct, because the ordering of
the user's questions should not be casually revised.

**Scale.** Perceived instantly, before reading. Reserved for the few things
whose size claim is honest.

**Weight and density.** Fine-grained, sturdy, works at small sizes where scale
has run out of room.

**Material.** Says what *kind* of thing something is, which is a different
question from how important it is. Useful, but slower to read.

**Colour.** Last, always. See §8.

A hierarchy that requires colour to be legible is not a hierarchy. It is a
legend.

---

## 4. Elevation

The most consequential section in this document.

**A surface earns elevation. It is never granted by category.**

Raising a surface is a claim, and the claim is specific:

> **This object may require your judgement.**

Not *this is a section*. Not *this is a card*. Not *this is important in the
abstract*. Something here may need you to decide, and until you have looked, you
do not know whether it does.

That is the entire meaning. Depth is a scarce, non-renewable attention
currency: if everything is raised, nothing is, and the user learns — correctly —
that elevation on this product predicts nothing.

Three rules follow, and they are strict:

**Elevation is revocable.** When an object stops needing judgement, it must stop
being raised. An item that was actionable yesterday and is resolved today should
visibly return to the canvas. Depth that persists after its reason has gone is
worse than depth that was never used, because it has taught the user to ignore
it.

**Elevation is not granted to containers for containing things.** A group of
resolved items is not itself a decision. Grouping is a layout act; elevation is
a semantic one, and they must not be confused.

**Nothing floats because floating is current.** If a contributor cannot state
what judgement the raised object requires, the object does not get raised. The
question is not "does this look better raised?" — it always does, briefly, which
is exactly why the question is forbidden.

Everything that is not awaiting judgement belongs to the canvas: present,
legible, checkable, and quiet.

---

## 5. Light

Light replaces borders because of what each one *says* about who is speaking.

**A border is the designer speaking.** It says: *I have drawn a line here.* It
is an assertion by the interface about where one thing ends. It is visible as an
act of authorship.

**Light is the object existing.** It says: *this occupies space, and you are
seeing the consequence.* Nobody drew it. It is a by-product of the thing being
there.

For a product whose entire claim is *I am not arguing, I am showing*, objects
that simply exist are more credible than objects someone outlined. That is the
whole argument, and it is not an aesthetic preference — it follows directly from
§1.

Two practical consequences reinforce it:

**Lines are a scarce signal and should be spent on meaning.** In this product a
line between two records genuinely means something: these are separate entries,
separately recorded, separately defensible. If every surface is also outlined,
the meaningful lines are lost in the decorative ones.

**Light must be consistent to be believed.** A page lit from several directions
reads as a collage — assembled rather than observed. One implied source,
everywhere, or the effect collapses into noise and it would have been better to
use nothing.

Where light cannot do the job — small elements, dense lists, poor viewing
conditions — a line is correct and honest. Light is preferred, not mandatory.
Dogma about the mechanism would violate §2.

---

## 6. Material

The product has very few materials, and each one is an answer to a question the
user is implicitly asking: **what kind of thing am I looking at?**

A material tells you: is this the ground, or an object on it? Is this something I
act on, or something I read? Is this a place where content lives, or a place
where content is missing?

Because materials are semantic, three rules hold:

**A surface belongs to exactly one material.** A surface that is partly one
thing and partly another is a surface whose author had not decided what it was.

**Materials are few, and adding one is a serious act.** Each new material
subdivides the user's mental model. The right number is the smallest number that
can express the distinctions the product actually makes — and no more, because
distinctions the product does not make must not be implied.

**A new surface must be able to name its material.** If it cannot, the surface
does not yet have a reason to exist, and no amount of styling will give it one.
This is the cheapest available test for whether a design decision is real.

---

## 7. Typography

**Typography carries hierarchy before colour because typography survives.**

The record in this product does not stay on a good screen in a good room. It is
read in direct sunlight on a phone. It is screenshotted and compressed and sent
over a messaging app. It is printed. It is forwarded to someone with colour
vision deficiency. It is shown to a client at arm's length, at an angle, on a
cracked display.

Type survives all of that. Colour survives almost none of it. A product whose
hierarchy is typographic still works in every one of those conditions; a product
whose hierarchy is chromatic has quietly restricted its evidence to ideal
viewing.

That is not an accessibility footnote. For a product whose output is
credibility, an evidentiary record that only reads correctly under good
conditions is a weaker record.

### Numbers are the identity

Money is what is contested. It is what the user came for, what they show other
people, and what they will be argued with about. Every session, in every role,
the eye goes to a figure.

So figures are not labels that happen to contain digits. They are the product's
primary typographic object, and they deserve the authority normally reserved for
display type: deliberate scale, deliberate alignment, deliberate weight, and
absolute stability. **A number that shifts as it changes cannot be compared, and
comparison is the only reason it is on the screen.**

The **Indian numbering system is identity, not decoration.** The product groups
figures the way its users count. That is not a localisation setting that happens
to be enabled; it is the visible fact that the product was built for the place
it is used, and it is the single most recognisable thing on any screen.

It earns that status by being *honest*. A grouping convention cannot be styled
into meaning something it does not mean. It is identity that costs the user
nothing and misleads them in no way — which is the only kind of identity this
product is permitted to have.

---

## 8. Colour

**Colour confirms meaning. Colour never creates it.**

Anything a user must understand has to be understandable before colour is
applied — through position, wording, scale, order or material. Colour then
arrives as a *second* statement of something already said.

Two independent reasons, either sufficient:

**Colour is the least reliable channel.** It is the first thing lost to
impairment, sunlight, cheap displays, compression and print. Meaning carried
only in colour is meaning withdrawn from some users entirely, and — per §7 — it
is meaning that vanishes precisely when the record is being shown to a stranger.

**Semantic colour is a currency with a fixed supply.** There are only so many
colours a person can hold as *meaning something specific*. Spend them on
ordinary categories and there is nothing distinctive left for the genuinely
urgent. A product where routine bookkeeping is already painted in alarm colours
has no way to signal an actual alarm, and this codebase has been through exactly
that failure once already.

Therefore:

**Status colour belongs to status.** Late, blocked, failed, resolved — real
operational conditions, and nothing else. A category is not a status. A quantity
is not a status. The sign of a number is not a status.

**Identity colour belongs to identity.** It may create atmosphere, mark what is
ours, and indicate interactivity. It may never be used to say something is good
or bad.

**Facts stay neutral.** An amount is a fact. A name is a fact. A date is a fact.
Colouring facts is how a product starts editorialising its own evidence, which
§1 forbids.

The enforceable version of this whole section: **the page must be fully
understandable in greyscale.** If removing colour removes information, colour
was creating meaning rather than confirming it, and the design is wrong.

---

## 9. Motion

Motion exists to explain **relationships**: where something came from, what
caused what, what changed and what did not, what is the same object it was a
moment ago.

Used that way, motion reduces the work of understanding. Used any other way it
adds work while pretending to add polish.

**Motion never entertains.** Nothing moves to be enjoyed.

**Motion never delays a fact.** Information must be readable and actionable from
the first frame. An animation the user has to wait out has made the product
slower in exchange for nothing, and speed here is not a nicety: the person on
site is standing up, in the sun, with someone waiting.

**Motion never dramatises.** This is the §2 rule applied to time. A figure that
animates into place performs significance the figure may not have. Routine
change must look routine while it happens, not only after it settles.

**Motion never hides.** Nothing may be concealed behind a transition, and no
state may exist only during one.

**Reduced motion is a first-class experience, not a fallback.** It is not the
product with the good part removed; it is the same product, complete, arriving
without travel. If reduced motion loses information or looks unfinished, then
the motion was carrying meaning it should never have been given sole custody
of — the same error as §8, in a different channel.

---

## 10. Empty space

Space is **rhythm**, and rhythm is how a page is understood before it is read.

It is not padding. Padding is a measurement; rhythm is a structure of pause and
grouping that tells the eye what belongs together and where one thought ends.

**Restraint increases confidence because a crowded page implies the product does
not know what matters.** A screen showing everything it could show is a screen
whose author declined to make a judgement, and it transfers that judgement to a
user who has less time and less context than the author did.

**Space is the visible evidence of a decision.** It is where things were left
out on purpose. That is why generous space reads as certainty rather than
emptiness — it says: *there was more, and it was not needed.*

**Space is not distributed evenly.** Even spacing is regular, but regular is not
composed. The gaps should express how the content actually groups: tight where
things are one thought, generous where the subject changes. Uniform spacing
across dissimilar content is the same failure as §12 — repetition mistaken for
consistency.

---

## 11. Components

**Components are not visual units. They are expressions of principles.**

A component is the current best answer to a question the product is asking on
behalf of the user. The question is durable. The answer is not.

Any component in this product may be replaced entirely — different structure,
different behaviour, different everything — and nothing above is affected. That
is the correct relationship, and it is the reason this document never names one.

The test for whether a component is right is not whether it looks good. It is:

- Which question does it answer?
- Which material is it, and why?
- What earns any elevation it has?
- What does it look like when there is nothing to show?
- Does it survive greyscale?

A component that cannot answer these has not been designed yet, regardless of
how finished it looks.

### A symbol is not free

**When a word is clearer than a symbol, use the word.**

An icon looks cheaper than a word and is not. One glyph obliges the product to
answer a family, a stroke weight, an optical size, a negated form and a
localised meaning — and to answer them consistently everywhere afterwards.
Establishing all of that for a single control is how a product acquires an icon
set that nobody designed, assembled one emergency at a time.

**Correction, on measurement.** This section previously said "a control is
labelled with a word until a symbol system already exists to draw it from",
and justified the password control's `Show` / `Hide` on the grounds that no
such system existed here. That premise was false when it was written. A
36-glyph family has existed in this codebase throughout — one grid, one stroke
weight, `currentColor`, decorative by default — and it was already in use by
the shell, the dashboard, both portals and the audit trail at the moment the
claim was made. It was asserted without checking, and an audit of the primitive
against this system's own rules later passed on every count.

The conclusion is unchanged and the principle is not weakened; only its
reasoning is corrected. **The existence of a symbol grammar is not an argument
for spending it.** A family makes an icon cheap to draw; it does not make the
icon clearer than the word it would replace, and clarity is the only thing that
decides.

There is a second cost, and it is the one that decides borderline cases: a
symbol standing alone must communicate whether it names the **current state**
or the **resulting action**, and many of the most familiar ones do not. The
crossed-out eye is the standard example — half of all users read it as "the
password is hidden" and half as "press to hide". A word cannot be misread that
way.

So the order is: a word first; a symbol where it is genuinely clearer than the
word — a direction, a chevron, a state that has no short name; a symbol with a
word when the control is dense or the word is long. Never a symbol because a
word looked plain, and never because the family happens to be there.

---

## 12. Consistency

**Consistency is repeated reasoning, not repeated appearance.**

This distinction is the one most often got wrong, and getting it wrong is
expensive in both directions.

Two objects that answer different questions **should** look different. Giving
them the same treatment is not discipline; it is a failure to think, wearing
discipline's clothes. It also destroys hierarchy, because identical treatment
asserts equal importance — which is a claim, and usually a false one.

Two objects that answer the *same* question must look the same, everywhere,
without exception. That is where consistency is genuinely owed.

The test is never *do these look alike?* It is **would the same reasoning
produce both?** If yes, they are consistent even if they look nothing alike. If
no, they are inconsistent even if they are pixel-identical.

The failure this product has already demonstrated is instructive: several
sections were built with different structural languages, and there was no rule
determining which applied. The inconsistency was not that they differed — some
of them *should* differ. It was that nothing decided.

---

## 13. Delight

Delight is real and worth pursuing. It just is not what the word usually means.

**In this product, surprise is a defect.** The soul document is explicit: what
should remain after closing the application is the certainty that nothing is
waiting that you have not seen. A product built to eliminate surprise cannot
locate its delight in surprising people.

So novelty is rejected outright. Not because it is frivolous — because it is
*contradictory*. An interface that delights by being unexpected is an interface
that has trained the user to expect the unexpected, which is the precise
opposite of the feeling being sold.

**Delight here is the accumulating realisation that every question you were
about to ask has already been answered.** It arrives slowly and it compounds.
The edge case is handled. The empty state says something useful. The figure is
already net of what you owe. The thing you were about to look for is where you
would have looked.

That feeling has a name in every other craft: **it is the sense of having been
anticipated.** It is what a well-made tool feels like in the hand — not
exciting, but immediately and permanently trusted.

Its components are unglamorous and entirely achievable: precision,
predictability, consistency of reasoning, and evidence of care in the places
nobody photographs.

**Nothing is celebrated for having merely happened.** Congratulating a user for
recording a payment is the product mistaking its own operation for their
achievement. It also, per §2, dramatises the routine.

---

## 14. Anti-goals

Each is rejected for the same underlying reason — it makes the interface look
like it wants something — but the mechanism differs, and the mechanism is what
makes the rule enforceable.

**Trend-following.** A product recognisable as *of a particular year* is a
product that will look untrustworthy in five, and this record must still be
credible when it is produced as evidence years later. Trends also import
someone else's reasoning wholesale, which §12 forbids.

**Glass and heavy translucency.** It puts a surface in front of content and
makes the surface the subject. It also degrades badly in exactly the conditions
this product is used in — bright light, poor screens — so it optimises for the
demo and taxes the site.

**Decorative gradients.** A gradient the eye can locate is the interface asking
to be looked at. Attention spent on a surface is attention taken from the
record on it.

**Decorative animation.** Motion is a claim that something happened. Animating
where nothing happened is a false claim, and false claims are the one thing a
witness cannot afford (§1, §9).

**Meaningless shadows.** Depth is a claim about judgement (§4). Applying it
everywhere is inflation: the currency still exists but no longer buys attention.

**Card grids as a default.** A grid of identical containers asserts that its
contents are equally important. That is almost never true, and stating it
anyway is a lie told by layout rather than by words — harder to notice and
therefore worse.

**Colour as branding.** It spends the semantic supply on recognition (§8). A
product that must be recognisable by its colour has failed to be recognisable by
its substance.

**Novelty for screenshots.** It optimises for people who will never use the
product at the expense of people who use it daily. It also produces the specific
failure of a screen that presents well and works badly, which is the opposite of
this product's entire proposition.

**"Premium" through ornament.** Ornament is persuasion. A witness that persuades
is impeached. Whatever premium means here, it must be reachable through
precision — and it is, because precision is visible.

---

## 15. Immutable laws

Short enough to remember. Specific enough to reject an idea with.

1. **An interface that argues cannot be a witness.**
2. **A surface earns elevation. It is never granted.**
3. **Elevation is revocable — when the judgement is gone, so is the depth.**
4. **Visual weight is proportional to consequence, never to effort or interest.**
5. **Typography outranks colour.**
6. **Colour confirms meaning. It never creates it.**
7. **The page must be fully understandable in greyscale.**
8. **Light describes objects; borders describe the designer.**
9. **Hierarchy answers "what needs me now", and must change when the answer does.**
10. **Motion explains a relationship, or it does not run.**
11. **Reduced motion is the same product, not a lesser one.**
12. **Space is the visible evidence of a decision.**
13. **Consistency is repeated reasoning, not repeated appearance.**
14. **Nothing is celebrated for having merely happened.**
15. **Surprise is a defect; therefore delight is never surprise.**
16. **Every surface must be able to name its material.**
17. **When a word is clearer than a symbol, use the word — a symbol grammar existing is not a reason to spend it.**
18. **No visual decision may contradict `PRODUCT_SOUL.md`.**

---

## 16. Sources

**`PRODUCT_SOUL.md` and `PRODUCT.md`** — the whole document derives from them.
§1 is the bridge: the soul says the output is credibility, and everything here
is what credibility requires of a surface. Where a principle here appears
severe, the severity comes from upstream, not from taste.

**Impeccable** — adopted. Its classification of this kind of surface as one
where scanability, consistency and the real usage scene outrank expression is
the basis of §3 and §10. Its instruction that brand lives in precise details is
§13's definition of delight, restated in this product's terms.

**Taste** — adopted, with a conflict resolved below. Its anti-default
discipline, its insistence that shape and colour be *systems* with rules rather
than repeated constants, and its warning against reaching for whatever is
current, all appear in §12 and §14.

**Emil Kowalski's motion principles** — adopted. §9's demands that motion be
short, purposeful, unnoticed and never in the way are a restatement of them.
Rejected: spring physics for interface chrome. Springs describe direct
manipulation, and almost nothing in this product is dragged; a spring on
something the user did not physically move is decoration pretending to be
physics.

**Apple's deference principle** — genuinely aligned and adopted: content is the
interface, chrome recedes. It supports §4 and §5 independently of my own
reasoning, which is why it is recorded rather than assumed.

**Material 3 — a real conflict, resolved.** Material 3 ties elevation to a
component's *role*: a thing of a certain kind is raised because of what kind of
thing it is. §4 says the opposite — elevation is earned by *state*, and is
revoked when the state resolves.

These cannot both hold, and averaging them produces the worst outcome: elevation
that is neither predictable by category nor meaningful by state.

**This document chooses state.** Role-based elevation is defensible in a general
component library, where the framework cannot know what any given instance
means. This product does know. Its entire purpose is directing attention to
what is contested, and depth is its strongest instrument for doing so. Spending
that instrument on "this is a card" wastes it. Material 3's tonal-elevation
mechanism is separately rejected for reasons already recorded in
`VISUAL_IDENTITY.md`.

**Taste versus Impeccable — resolved rather than averaged.** Taste pushes toward
compositional variation and against uniform repetition. Impeccable, for this
kind of surface, pushes toward predictability and consistent scanning. Taken
naively they conflict.

The resolution is §12: **variation must be earned by a difference in kind, never
taken for visual interest.** Things that answer different questions may and
should differ — Taste satisfied. Things that answer the same question never
differ — Impeccable satisfied. Neither is diluted, because the disagreement was
never really about variation; it was about what licenses it.

**21st.dev** — contributed nothing. Searched during direction exploration and
returned marketing heroes and stat-card grids at low confidence; nothing was
adopted. Its corpus answers *what is currently common*, which §14 explicitly
rejects as a reason to do anything. Noted so the absence is not mistaken for an
oversight.

**External research beyond the above** — none, and none required. Every
question this document asks is a question about *this* product's obligations.
Importing further outside opinion would have meant importing outside
convictions, and per the source-of-truth order those rank below the documents
this one is derived from.
