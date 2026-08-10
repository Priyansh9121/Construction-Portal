# Experience language

What using this product should feel like, every day, for years.

`PRODUCT.md` says what the product is. `PRODUCT_SOUL.md` says what it believes.
`VISUAL_PRINCIPLES.md` says what those beliefs require of anything visible.
`VISUAL_IDENTITY.md` says what makes it recognisable. This document sits beside
the last two and answers the question none of them ask:

> Not "how should this look", but **"what is it like to be in here"**.

It governs motion, timing, silence, waiting, arrival, atmosphere, and every
decision about whether something should move at all. `INTERACTION_LANGUAGE.md`
is its peer and takes the question one step further in: not what a moment feels
like, but what happens when a person touches something. Every future route
inherits both. No route may opt out of it, and no route may extend it privately —
if a surface needs a behaviour this document does not describe, the document is
amended first and the surface second.

---

## 1. The thesis

**The product should feel like a site that is running well.**

Not busy. Not exciting. *Running well* — the specific, recognisable quality of
a job where the sequence is right, the setting-out was done properly, nothing
is being hurried that cannot be hurried, and everything that happened has been
written down.

Anyone who has stood on both kinds of site knows the difference immediately,
and it is not visual. A well-run site is **quieter** than a badly-run one. Less
is happening at once. Fewer people are looking for things. Nobody is arguing
about what was agreed. The work is not faster because people are rushing; it is
faster because nothing has to be done twice.

That is the feeling this software is trying to produce at a desk and in a
pocket. Every rule below is downstream of it.

### The emotional target is composure, not delight

Most software aims for delight, and `VISUAL_PRINCIPLES` §13 has already
explained why that word fails here: delight in this product is *the
accumulating realisation that every question you were about to ask has already
been answered*.

This document names the feeling that produces, because it is the thing to
design for:

> **The user should be measurably calmer after ten minutes in the product than
> they were when they opened it.**

They arrived under pressure from other people — that is the state
`PRODUCT_SOUL` §11 describes, and it is the true operating condition. Composure
is what a good instrument gives back. It is produced by exactly four things,
all of them unglamorous:

1. **Nothing surprises them.** The same action does the same thing every time,
   including at the edges.
2. **Nothing is hidden from them.** No state exists that the interface knows
   about and does not show.
3. **Nothing is asked of them twice.** The product remembers where they were,
   what they typed, and what they had already answered.
4. **Nothing is claimed on their behalf.** The product never states more than
   it can show.

A product that does those four things becomes unforgettable without ever being
memorable in the moment — which is exactly the right outcome for a tool someone
uses four hundred times a year.

### The one-sentence test

Any proposed experience decision must survive this:

> **Would this still be right on the five-hundredth time, on a bad day, in
> direct sunlight, with someone waiting?**

Almost everything that is fun to build fails this. That is the point of asking.

---

## 2. Construction, without illustrating construction

The identity must be *felt*, never depicted. `VISUAL_IDENTITY` already carries
the visible half — the Indian numeral, elevation as a claim, warm light on warm
ground. This is the behavioural half.

Construction is not cranes and helmets. Those are its *props*. Its actual
discipline — the part practitioners would recognise as their own — is this:

| the craft | what it becomes here |
|---|---|
| **Setting out** — lines are marked before anything is built | Structure appears before content. A surface reserves its shape before it has data to put in it, so nothing jumps when the data arrives. |
| **Tolerance** — precision is *specified*, not infinite | Every measurement in the system has a stated allowance. "Close enough" is a number somewhere, not a judgement made per case. |
| **Sequence** — you cannot pour before the steel is tied | Order is physical, not preference. Where the product enforces an order it says so plainly, and it never lets you start something it will refuse to finish. |
| **Curing** — some things take time and cannot be hurried | A wait that is genuinely long is *named*, not disguised as progress. Concrete is not "loading"; it is setting, and everyone knows how long. |
| **Snagging** — the last pass that finds the small defects | The product surfaces what is unresolved without dramatising it. A snag list is not an alarm. |
| **Handover** — the moment the record becomes the proof | Exports, archives and closures are treated as the most serious moments in the product, because they are the ones that outlive it. |
| **The day** — site work is bounded by the day | `PRODUCT.md`: the day is the unit. The interface respects that boundary rather than smearing time into a feed. |

**The rule that follows from all seven:**

> **The product may behave like construction. It may never depict
> construction.**

Depiction is the threshold's job and the threshold's only (§7). Everywhere
else, the identity arrives as *order of operations and stated tolerance* — which
is why it will still read as construction in ten years, when every visual trend
in this document's neighbourhood has dated.

---

## 3. Motion

`VISUAL_PRINCIPLES` §9 sets the laws: motion explains relationships, never
entertains, never delays a fact, never dramatises, never hides, and reduced
motion is the same product rather than a lesser one. Those are not restated
here. What follows is the **rhythm** — the part that cannot be expressed as a
duration.

### 3.1 Motion is caused, never scheduled

Every movement in the workspace must trace to one of exactly two causes:

- the user did something, or
- a fact arrived.

There is no third cause. Nothing moves because time passed, because a page
loaded, because an element entered the viewport, or because the screen had been
still for a while. **A timer is not a cause.**

This single rule eliminates, permanently: scroll-triggered reveals, staggered
page-entry choreography, idle animations, looping ambient effects in the
application, attention-seeking pulses on things that are merely present, and
every "the page feels alive" instinct that is really the page feeling nervous.

### 3.2 One event owns motion

At any instant, **one region of the screen is allowed to be moving.** A list is
one region. A dialog and the surface behind it are one event, not two.

This was learned, not assumed: the authentication threshold originally ran a
route transition and a content-region transition over the same moment, and the
result did not read as an arrival — it read as a page that had not finished
loading. Two animations describing one event always read as a fault.

### 3.3 Stillness is the resting state, and it is measured

The screen must return to **complete** stillness within one second of any
action, and stay there until the next cause.

Complete means complete: no residual fade, no lingering highlight, no cursor
blink borrowed as decoration, no progress element still turning after its work
finished. The quality of this motion system is not judged by how good the
motion looks. It is judged by **how quickly and how totally the screen becomes
still again** — because stillness is what a person reading a figure needs, and
reading figures is what this product is for.

### 3.4 Nothing moves under the eye or under the thumb

- Content the user is reading does not reflow, re-order, or re-sort.
- A list does not re-order while a pointer or thumb is on it. New rows arrive
  where they belong and are marked as new; they do not push what is under the
  finger.
- Late-arriving data does not change the position of anything already
  positioned. If the layout will change, the space was reserved (§2, setting
  out).

### 3.5 Entrances and exits are asymmetric

Things arriving decelerate; things leaving accelerate away. A symmetric curve
on an entrance makes an object appear to hesitate before committing, which is
the opposite of the confidence this product needs. This is already encoded in
the system's two curves and must not be flattened into one.

### 3.6 Springs remain forbidden until something is dragged

Settled and unchanged: springs are permitted **only** where the user's pointer
is continuously driving the object at the moment motion begins. Nothing in the
product qualifies today. A machined control does not wobble into position, and
overshoot on an instrument reads as imprecision rather than as life.

If a genuinely draggable surface ever ships — reordering, a resizable split, a
swipe-to-reveal on a field row — springs arrive with it, and only for it.

---

## 4. Time and confirmation

The brief for this document asked six questions about rhythm. These are the
answers, and they are binding.

**How quickly should information appear?**
As fast as it is true. Data never has an entrance animation. A figure that
fades in has spent the user's attention on the fact that it arrived rather than
on what it says.

**How long should a confirmation remain?**
Until its consequence is visible somewhere else on screen — then it leaves
immediately, because it has become redundant. If the consequence is *not*
visible (the row is off-screen, the change was to another record), the
confirmation stays until dismissed. **Time is the wrong variable.** A message
that disappears on a five-second timer disappears while a supervisor is being
spoken to.

**When should motion stop?**
The instant the relationship it exists to explain has been shown. Not at the
end of a duration chosen for feel.

**How much may move at once?**
One region. See §3.2.

**When must the interface be perfectly still?**
While the user is reading. During text entry. While a menu or dialog is open —
including everything behind it. And always within one second of any action.

**When should ambient movement pause?**
It never needs to, because the workspace has none. See §6.

---

## 5. Waiting

Waiting is where products lie most, and this one cannot afford to. Everything
here follows from `PRODUCT_SOUL` §12: *it never fills a gap with a plausible
guess.*

### 5.1 Three honest shapes of a wait

| duration | what the user sees | why |
|---|---|---|
| **Under ~150ms** | nothing at all | Below the threshold where a person perceives a delay. Anything shown here is a flash, and a flash costs more attention than the wait it describes. |
| **Known shape** | the layout, held | We know what is coming and where it goes, so the space is reserved and the structure is already drawn. This is setting-out, not a placeholder. |
| **Unknown length** | a sentence naming what is being waited for | "Loading" names the act. The user needs the object. |

### 5.2 Rules

- **Never invent progress.** A determinate bar is a promise about time, and the
  product knows how long almost nothing takes. Where it genuinely knows —
  bytes of a known upload — a determinate bar is not merely allowed but
  required, because withholding a known quantity is its own dishonesty.
- **A spinner is never the whole answer.** It says "something is happening" and
  nothing more. It is admissible only *inside* a control the user just pressed,
  where the object of the wait is unambiguous because they chose it.
- **Skeletons must be true.** A skeleton is a claim about the shape of what is
  coming. If the real content does not land in that shape, the skeleton was a
  lie and the page will visibly lurch. Where the shape is not reliably known,
  reserve space without pretending to know what fills it.
- **A wait that fails must say what failed and what survives.** "Could not load
  payments. The rest of this page is current." Partial truth is more useful
  than a whole-page error, and far more useful than a whole-page retry.
- **Nothing that was already true may be taken away to show a wait.** Refreshing
  a table does not blank it. The old figures stay, visibly marked as the
  previous read, until the new ones land.

### 5.3 Stale is a state, and it is designed

A field product on a bad connection is normal, not exceptional. So the product
has a fourth data state alongside full, empty and failed: **stale** — this is
true as of a stated moment, and we have not been able to check since.

Stale is never hidden and never dressed as current. It is the honest position
of a witness who has not been able to see for a while.

---

## 6. Ambient behaviour

**Amended.** This section previously read "the workspace has no ambient
motion", and banned environmental life outright. That was too restrictive, and
the amendment is recorded rather than quietly applied because the original
reasoning still governs the boundary.

### 6.1 The law, restated

> **The data must never pretend. The interface may feel alive.**

Two channels, and the distinction is what everything below turns on:

**Operational motion** represents real state. It moves because a fact moved.
A progress bar, a countdown, a figure changing, a status resolving, a row
arriving — each is a claim, and each must be true at the instant it is made.

**Environmental motion** represents nothing. It is atmosphere: light, weather
in the abstract, structure, depth, the slow drift of a scene. It carries no
information, cannot be mistaken for a reading, and would be equally true on
the company's first day and its last.

The original ban conflated the two. It was right that motion is a claim — but
only *operational* motion makes a claim, because only operational motion is
attached to a number somebody might act on.

### 6.2 What is permitted

Environmental, and welcome:

- slow crane movement, hook sway, tower and obstruction lights
- structural linework assembling, blueprint geometry resolving
- ambient construction lighting, shifting daylight, moving shadows
- atmospheric haze, drift, depth and parallax
- procedural background geometry and animated floor grids
- responsive light sources and route-aware environmental transitions
- mechanical response in controls — the feel of a machined instrument

Operational, and permitted *because they are true*:

- real progress against a measurable quantity
- a real countdown to a real deadline
- a chart that moves because its data moved
- a status that resolves because the server resolved it

### 6.3 What remains forbidden, permanently

- fake worker counts, fake machinery telemetry, fake occupancy
- weather presented as this site's weather when it was never recorded
- invented project progress or completion percentages
- a figure that pulses, counts up, or animates merely to look live
- animated status implying an event that did not occur
- any environmental effect placed close enough to a figure that a reader
  could take it for a reading

**The test.** Point at the moving thing and ask: *if I claimed in writing that
this represents something real, would I be lying?* If yes, it must be
unmistakably atmosphere — far from the data, carrying no units, resembling no
indicator. If it cannot be made unmistakable, it does not ship.

### 6.4 Verifiable adaptation still governs the data channel

The product may adapt to facts it can **verify** — the clock, the viewport,
the connection, the user's motion preference, their own records. It may never
adapt to facts it would have to **imagine**: the weather at the site, who is
on it, whether a project "feels" at risk.

That distinction is unchanged, and it is the reason environmental motion is
safe: a drifting haze claims nothing about the site, whereas a rain animation
keyed to a forecast the product never received claims a great deal.

---

## 7. The two environments

The product has exactly two, and conflating them is the most likely way this
document gets violated.

**The threshold** — authentication. Dusk, structure standing, one crane still.
Seen once per session, for seconds, carrying no data. It may depict. It may
have atmosphere, weight, and an ambient life the rest of the product refuses.

**The workspace** — everything after sign-in. Daylight, light surfaces,
hairline structure, no depiction whatsoever. Seen for hours. It may only
*structure*.

### Login is not the special page

This is important enough to state as a rule, because the risk is real: a
product with one beautiful screen and forty ordinary ones is worse than a
product with forty consistent ones.

> **What the threshold contributes to the product is its GRAMMAR, not its
> picture.**

The grammar is inherited by every route without exception: the elevation rule,
the plane as the one raised object, the control and focus system, the material
vocabulary, the departure behaviour, the rhythm in §3–§5, the refusal to
celebrate. The *picture* — the sky, the silhouettes, the rig — is inherited by
nothing, because depiction belongs to the threshold alone.

If a future route feels flat next to Login, the answer is never to give that
route a picture. It is to check whether it inherited the grammar properly,
because in every case so far, that is what was actually missing.

---

## 8. Transitions

Only three relationships exist in this product. Each has one grammar, and the
grammars must not borrow from each other.

**Entering** — the threshold. The dark lifts and the workspace is revealed
already standing. It happens once per session and it is the only transition
permitted to feel like an event.

**Moving within** — a route change. The chrome is continuous and only the
content region changes, because that is what is true: the user did not go
anywhere, they turned to a different page of the same document. A route change
must never feel like an arrival, because arriving twice makes the first arrival
a lie.

**Changing in place** — a row updates, a status resolves, a figure recalculates.
The object stays the same object and its change is legible without travel.
Nothing is destroyed and rebuilt where it could be updated.

**The test before animating anything:** name the relationship in one sentence.
If the sentence needs the word "nice", there is no relationship and there is no
transition.

---

## 9. Interaction

### 9.1 Response

Feedback belongs on the press, not the release. The moment latency appears, the
sense of directness collapses — and the person operating the control may be
wearing a glove and standing in the sun.

Adopted from `apple-design` and non-negotiable: respond on pointer-down; be
hostile to every artificial delay on the input path; never make a user wait to
find out whether their tap landed.

### 9.2 Words over symbols

Settled in `VISUAL_PRINCIPLES` §11 and law 17: a control is labelled with a
word until a symbol grammar exists to draw from. A lone glyph must communicate
whether it names the current state or the resulting action, and many of the
most familiar ones cannot.

### 9.3 Irreversibility is disclosed before the action

Some things in this product are deliberately not undoable — that is what makes
the record worth trusting. Where an action cannot be reversed, the interface
says so **before** it is taken, in the same breath as the action, and not in a
dialog that appears after the user has already decided.

Where an action *can* be reversed, prefer undo over confirmation. A confirmation
dialog spends the user's attention every time to prevent a mistake they make
rarely.

### 9.4 Nothing primary is hidden

No primary action lives behind hover, a long-press, a swipe, or a menu on a
surface a field user operates. `PRODUCT.md` states the trade-off: obvious
actions over hidden menus, large targets over compact controls. Hover is an
enhancement for a pointer, never a requirement.

### 9.5 Errors correct, they do not scold

An error message names what happened, what is still true, and what to do next.
It never apologises, never exclaims, and never implies the user was careless.
Where the product blocked something on purpose — the two-day rule — it states
the rule plainly and does not imply an exception might be available. A rule that
sounds negotiable is already broken.

---

## 10. Emptiness

`PRODUCT_SOUL`: zero data is not an error, it is the beginning of a workflow.

Every empty state answers three questions and nothing else:

1. **What would be here.**
2. **Why it is not here yet** — and "you have not done it yet" is a legitimate,
   non-judgemental answer.
3. **The one action that changes it** — one, not a menu of them.

An empty state is never an illustration, never a mascot, never an apology, and
never a celebration of the fresh start. A brand-new company looking at an empty
product should feel what a contractor feels looking at a cleared site: not
disappointment, and not excitement — **readiness.**

---

## 11. Artificial intelligence

The brief for this document invited AI to be used aggressively. `PRODUCT_SOUL`
§9 explicitly rejects forecasting, on the grounds that the product has no honest
basis for prediction and that pretending otherwise trades its one real asset —
evidentiary credibility — for the appearance of insight.

Both are right, because they are about different things. The distinction is the
rule:

> **AI is a studio tool, not a narrator.**

### 11.1 Build time — permitted, and encouraged

AI may author anything that ships as a **fixed artifact**: vector scenes,
structural drawings, geometry, exploratory directions, probes, copy drafts,
test data shapes. The output is frozen at build time, is identical for every
user, has been reviewed by a person, and asserts nothing about anybody's
business.

The dusk skyline on the sign-in screen is exactly this. It is a drawing. It says
nothing about the company, and it would be equally true on the day the company
was founded and the day it closes.

### 11.2 Run time — the gate

An AI feature that produces output *at run time*, about *this company's data*,
is admissible only if all three hold:

1. **Derived** — it is computed from records this company already owns.
2. **Explainable** — the interface can show the records it came from, on
   demand, without the user asking anyone.
3. **Labelled** — it is presented as an inference, visibly distinct from a
   recorded fact, and it never enters the audit trail as one.

Nothing in the product passes that gate today, and nothing should be built to
pass it in order to be built. The gate exists so that when the question comes
back — and it will — it is answered by a standard rather than by enthusiasm.

### 11.3 The line, stated once

Anything AI generates that a user could mistake for something the site
recorded is a forgery, regardless of accuracy or intent. A product whose entire
value is being a credible witness cannot ship a component that invents
testimony.

---

## 12. Signature moments

Identified, not designed. Each is a moment the product should *own* — where the
right feeling is worth deliberate work in a later phase. Implementation belongs
to whichever phase owns the surface; this list only fixes the intent.

None of them is a celebration. Several of them are deliberately quiet, and the
quiet is the design.

| # | moment | what it should feel like |
|---|---|---|
| 1 | First sign-in of the day | Arriving on site. The light comes up on a place that was already there. |
| 2 | Authentication succeeding | Crossing a threshold — once, briefly, and never again that session. |
| 3 | A brand-new company, entirely empty | A set-out grid before anything is built. Ready, not blank. |
| 4 | The first tender created | The first line marked. Small, and the whole job follows from it. |
| 5 | The first site under a tender | Ground broken. The abstract becomes a place. |
| 6 | The first worker on the books | Someone is now accounted for, by name. |
| 7 | **The first daily update sent from site** | The notebook opened at today's page. This is the moment the product's premise becomes true, and it is the most important moment in the list. |
| 8 | A photo's provenance being visible | The difference between captured and uploaded, shown without accusing anyone. |
| 9 | Backdating blocked by the two-day rule | A door that does not argue. Firm, unembarrassed, and not sorry. |
| 10 | Backdating access granted, and spent | A key handed over, used once, and gone. The single use should be *felt*, not just enforced. |
| 11 | An approval decided | A queue getting shorter. Motion in the right direction, undramatised. |
| 12 | The approval queue reaching zero | Stillness. Nothing is waiting. The product should say nothing at all. |
| 13 | The first payment recorded | The ledger opened. |
| 14 | The cash position showing a real figure for the first time | The number becomes *yours* rather than a placeholder. |
| 15 | Obligations deducted — held becoming owned | The honest number. The single most valuable thing the product tells anyone. |
| 16 | An invoice issued | A claim made, and now standing on the record. |
| 17 | A payment settling against an invoice | Two records meeting. Reconciliation as a small physical click. |
| 18 | A worker's outstanding balance reaching zero | Nobody is owed. Quiet, and complete. |
| 19 | A month closing | The day boundary, at scale. Something is now finished. |
| 20 | An export produced | The record leaving the building intact — and still true outside it. |
| 21 | A project handed over / archived | The file closing. The most serious moment in the product; it should feel heavier than anything else here. |
| 22 | A session expiring mid-task, and returning | Your place was kept. Relief, not apology. |
| 23 | Recording on a weak connection | The record is safe even though the office cannot see it yet. |
| 24 | A notification arriving mid-task | Noticed, not interrupted. |
| 25 | Search finding a half-remembered thing | Being anticipated. `VISUAL_PRINCIPLES` §13, in one interaction. |
| 26 | Signing out | Leaving site. Nothing left open, nothing left running. |

---

## 13. What this product never does

Each of these is a permanent refusal, not a current preference.

- **Never celebrates.** Nothing is congratulated for having merely happened.
- **Never animates a figure into place.** A number that counts up performs a
  significance the number may not have.
- **Never invents progress**, a percentage, an estimate, or a remaining time it
  cannot compute.
- **Never fabricates** weather, presence, activity, morale, forecast, or any
  state of the world it did not record.
- **Never uses a spinner as its whole answer** to a wait.
- **Never moves anything the user is reading**, or anything under their thumb.
- **Never plays two animations for one event.**
- **Never carries state in colour alone.**
- **Never makes the field user pay for the office user's density.**
- **Never treats an empty state as an error**, or a fresh start as an
  achievement.
- **Never asks for attention on behalf of something that is fine.**
- **Never lets a decorative layer outlive its own transition**, or accept a
  pointer event at any point in its life.
- **Never implies an authority it does not have** — the backend decides
  permission; the interface only reflects it.
- **Never softens a number.**
- **Never uses a symbol where a word is unambiguous** and no symbol grammar
  exists.
- **Never puts a surface in front of the record** — no glass, no heavy
  translucency, no decorative gradient, no texture over data.
- **Never looks like a particular year.** A record produced as evidence in 2034
  must not be undermined by the interface it came from looking dated.

---

## 14. What every future route inherits

A route is not ready to ship until every line here is answered. This is the
contract; it is short on purpose.

1. **Name the route's one question.** The question the user opened it to
   answer. If it has three, it is three routes or one route with a decided
   priority — never an even split.
2. **Name every surface's material.** Canvas, raised, inset, interactive,
   overlay. A surface that cannot name its material has not been designed.
3. **Design five states, not three.** Full, empty, loading, failed — and
   **stale**. Any state left undesigned will be encountered by a supervisor
   before it is encountered by a designer.
4. **Density is chosen per scene, not per page.** Office density and field
   density are different answers to the same content, and the same route may
   need both.
5. **Usable at 320px, in sunlight, one-handed, with a glove.** Every route.
   Including the ones only administrators will ever open — because that
   assumption is how field surfaces become unusable by increments.
6. **Nothing moves that the user did not cause and no fact caused.**
7. **Reduced motion is designed at the same time**, not adapted afterwards.
8. **Every claim on the route can be traced to a record**, and the route can
   show it.
9. **The route ships its own verification.** Assertions on this product have
   repeatedly passed while a surface was visually wrong; screenshots have
   repeatedly looked right while a measurement was wrong. Both are required,
   and the probe is written before the surface is called finished.
10. **Nothing on the route may be the only place a behaviour exists.** If it is
    good, it belongs to the system. If it belongs only here, it is probably
    decoration.

---

## 15. Sources — adopted, rejected, and why

Craft sources answer *how well*, never *why*. Where one conflicts with
`PRODUCT_SOUL` or `PRODUCT.md`, the conflict is resolved against the source and
the reasoning is recorded here rather than left as a silent omission.

| source | adopted | rejected, and why |
|---|---|---|
| **Impeccable** | Mode is **Operate** for every workspace surface: scanability, consistency and the real usage scene outrank expression; brand lives in precise details. Bounded verification passes rather than open-ended self-QA. | Its "dream big and bold" register, as a *goal*. Resolved the same way `VISUAL_IDENTITY` §3 resolved it: expression is permitted only in channels that cost no scanability. |
| **Taste** (`design-taste-frontend`) | Anti-default discipline. The colour-consistency lock and shape-consistency lock. The button-contrast check. The CTA-wrap ban. Realistic content over placeholder names and round numbers. | Its three dials (variance / motion / density). They are calibrated for landing pages and portfolios; here density is set by the *scene* and motion is set by *cause*, and a global dial would let one page be more expressive than another for no reason a user could name. Its serif discipline is moot — this product has one self-hosted sans, chosen for Gujarati metric matching. |
| **apple-design** | Response on pointer-down. Continuous feedback during a gesture rather than only at its end. Interruptibility. Reduced motion as a first-class experience. Depth communicating hierarchy rather than decorating. | **Springs**, until something is genuinely dragged (§3.6). **Translucent materials** — banned by `VISUAL_PRINCIPLES` §14 and independently by glare: a frosted surface in direct sunlight is a surface you cannot read through. |
| **emil-design-eng** | Specify exact properties, never `transition: all`. Ease-out on entrances, never ease-in. Nothing appears from nothing — scale from 0.95, not from 0. Sub-300ms UI motion. Focus never animates. The compounding value of details nobody consciously notices. | "Beauty is leverage" as the differentiator. Here **credibility** is the leverage; beauty is how credibility is made legible, not the goal it serves. |
| **animation-vocabulary** | Adopted wholesale as *vocabulary* — a shared name for an effect makes review faster and disagreement precise. | Nothing. It is a glossary and holds no position to reject. Naming an effect is never an argument for using it. |
| **industrial-brutalist-ui** | Structural discipline: rigid modular grids, visible dividing lines, typography as infrastructure rather than ornament, high data density treated as a virtue. This is the closest external source to Architectural Instrument. | Its entire surface treatment: CRT scanlines, halftones, dithering, phosphor glow, simulated analog degradation, "declassified blueprint" framing, dark-mode exclusivity, and primary red as an accent — which would collide directly with the danger hue the status system already owns. Also its `border-radius: 0` dogma: square corners on a 56px target operated by a gloved thumb are a hostile surface. |
| **high-end-visual-design** | Obsessive micro-detail. The instinct to decide art direction before implementation. Its refusal of generic defaults. | Nearly all of its material: OLED black, mesh and aurora gradients, heavy `backdrop-blur`, film-grain overlays, "cinematic spatial rhythm", parallax stacks, its banned/required font lists, and its mandate to never produce the same aesthetic twice — which is *the opposite* of what a product used daily for years requires. Consistency of reasoning is the goal; visual novelty is a landing-page virtue. |
| **redesign-existing-projects** | State completeness — loading, empty and error designed rather than assumed. Real hover and pressed states. Realistic content instead of `Lorem`, `Acme Corp` and round numbers. Focus rings as a requirement. `min-height: 100dvh` over `100vh`. Grid over flexbox percentage maths. | Subtle noise and grain overlays. Background imagery behind sections. Placeholder image services. Spring physics on all interactive elements. Smooth-scroll inertia. Glassmorphism and spotlight borders. Variable-font and text-mask reveals. And specifically its "dashboards always have a left sidebar — try top navigation instead": the sidebar here is a decided answer to a real navigation depth, not an unexamined default. |
| **design-system** | Three-layer token thinking — primitive → semantic → component — which this product already follows, with a deliberately thin component layer. Validation of token usage as a build step. | Its generator and sync scripts. `PRODUCT.md` forbids new runtime dependencies, and a token pipeline that only one project uses is more surface than the problem. |
| **ui-styling** | Nothing. | Rejected in full: it is built on shadcn/ui and Tailwind, both explicitly forbidden by `PRODUCT.md`. Recorded so the absence is not mistaken for an oversight. |
| **ui-ux-pro-max** | Its accessibility guidance and its data-visualisation guidance, applied selectively — direct-labelled series over legends, chart chrome kept subordinate. | Its style, palette and font-pairing databases as a source of *identity*. Identity is settled in `VISUAL_IDENTITY` and was derived from this product's own artifact, not selected from a catalogue. A palette chosen from a list is a palette that belongs to no one. |
| **prototype** | Adopted as a *method*, for decisions that are genuinely open: build several defensible directions and compare them before committing. The Phase 1 direction round was exactly this and it worked. | Using it to avoid deciding. Divergence is a tool for resolving a question, not a substitute for having one. |
| **imagegen-frontend-web** | Only its underlying premise: art direction should be settled before implementation. | Its entire output contract — one horizontal image per landing-page section — which describes a marketing site this product is not. Generated imagery is admissible **only** at build time and **only** for the threshold (§11.1). It may never depict data, a workflow, or a state. |
| **brand** | Voice consistency as something maintained rather than assumed. | Its asset pipeline, colour extraction and guideline sync. `PRODUCT.md` is explicit: there is no logo, no wordmark, no brand guideline, no customers, no testimonials and no marketing copy — and *nothing in this product may imply otherwise*. A brand system built on absent assets would be the first thing in here to fabricate. |

**External research beyond the above: none, and none required.** Every question
this document asks was answerable from `PRODUCT.md`, `PRODUCT_SOUL.md` and the
behaviour of the surfaces already built. Reaching outward would have imported
another product's operating conditions, and the operating conditions — sunlight,
gloves, weak signal, a disputed record — are the entire reason this language is
different from anyone else's.

---

## 16. Status

Language defined. Nothing implemented.

This document does not authorise any change on its own. It is the standard the
next change is judged against, and the first place to look when a future
decision feels arbitrary — because a decision that cannot be traced to something
above is, by definition, decoration.

Where implementation later disproves something written here, **this document is
corrected**, in the same commit, with the measurement that disproved it. That
has already happened twice to its neighbours, and both times the measurement was
right.
