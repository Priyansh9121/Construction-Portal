# Interaction language

What happens when a person touches this product.

`EXPERIENCE_LANGUAGE.md` answers *what should using this feel like*. This
document answers the question underneath it: **what should happen when I do
something** — before appearance, before motion, before any decision about how a
thing is drawn.

It is mandatory reading before implementing any component. Where a component's
behaviour is not described here, the behaviour is derived from §2 and §3 and
the document is amended in the same commit. No component may hold a private
interaction rule.

This is the last philosophy document. Everything after it is production work.

---

## 1. The witness, as a way of behaving

`PRODUCT_SOUL` §6 establishes that this system is not the author of the record.
It is the **witness**. Every other product in the comparison set is the author
of what it stores; this one is not, and that single difference is the source of
every rule below.

So the useful question is not *how should software behave* but **how does a
witness behave**:

- **A witness does not act.** It never does something on the record's behalf,
  never fills a gap it inferred, never completes a sentence somebody else
  started.
- **A witness does not interrupt.** It waits for the person to finish, however
  long that takes, and it does not hurry testimony.
- **A witness answers what was asked**, at the level of detail asked for, and
  does not volunteer an opinion alongside the answer.
- **A witness is precise about what it did not see.** Silence about a gap is
  worse than the gap.
- **A witness does not change its account under pressure.** The same question
  gets the same answer, on the first day and the five-hundredth.
- **A witness is not dramatic.** Nothing in its manner suggests the events
  matter more or less than they do.

Everything from here is those six sentences, applied.

---

## 2. Temperament

Five statements. Where two rules collide and neither §3 nor `PRODUCT.md`
settles it, these decide.

### Instant to acknowledge. Patient to complete.

Every input is acknowledged within a frame. Nothing else about the interaction
is promised to be fast, and nothing is rushed to appear fast.

These are two different promises and merging them is the most common
interaction failure in software: a control that waits until it has finished to
admit it heard you, so the user presses it again. Acknowledgement says *I have
your instruction*. Completion says *it is done*. The product always makes the
first immediately and the second only when it is true.

### Forgiving about input. Strict about time.

You may mistype anything, in any order, and fix it later. You may not record
yesterday's work next week.

This asymmetry is not an accident of implementation — it *is* the product.
`PRODUCT.md` lists the two-day rule first among the controls that make the
record trustworthy. Every other kind of strictness is negotiable; this one is
the thing being sold. An interface that is fussy about a phone number's format
and relaxed about when an entry was made has the asymmetry exactly backwards.

### Silent when things are fine. Plain when they are not.

The product's default is to say nothing. `PRODUCT_SOUL` Law 6: ask for
attention only when something is contested, unresolved or late.

When it does speak it is plain, complete and unapologetic. It does not soften,
does not exclaim, and does not imply the user was careless.

### Interruptible always. Persistent never.

Any action may be abandoned at any point, and abandoning is never punished. The
product does not ask again, does not nag, does not re-open what was dismissed,
and does not treat an unfinished task as an outstanding request.

### It refuses rarely, and does not negotiate.

Most of what the product does is accept things. Where it refuses, it refuses
completely and says which rule applies. It never implies an exception might be
available, because — `PRODUCT_SOUL` §12 — **a rule that sounds negotiable is
already broken.**

---

## 3. The permanent laws

Twelve. Each is a refusal that holds regardless of surface, decade or fashion.

**1 · The user's action is the only author.**
The product never performs an action nobody took, and never completes an action
differently from how it was begun. No auto-approving, no inferred values
written into fields, no "we did this for you."

**2 · Acknowledgement and completion are separate promises.**
See §2. A control that shows nothing until it succeeds has broken the first
one; a control that claims success before the server agrees has broken the
second.

**3 · A refusal states the rule, and states it before the effort.**
Not after the form is filled. Not in a dialog that appears once the decision
has been made. If an action will be refused, that is knowable at the point of
offering it, and the user finds out then.

**4 · Friction must be specific, or it is not friction.**
A safeguard that is identical every time is a keystroke. The product's delete
challenge currently asks every user, for every record, to type the last three
letters of the word DELETE — the answer is the constant `ETE`. That is not a
gate; it is a formality with a gate's costume, and after the third delete it
protects nothing at all. **A challenge must name the specific thing being
destroyed**, so that the answer cannot be reached by habit.

**5 · Every interruption is a withdrawal from one finite account.**
Modals, toasts, badges, confirmations and empty-state prompts all draw on the
same balance: the user's willingness to believe the next one matters. Nothing
in the product is free because it is small.

**6 · Nothing disappears without leaving its address.**
Deleted, archived, approved, moved, merged, filtered out — the interface says
where it went and how to reach it. A thing that vanishes silently teaches the
user to distrust their own memory, which is the exact injury this product
exists to prevent.

**7 · A destination is never reached by accident.**
No navigation on hover. No gesture that navigates. No control whose effect
differs from its label. The user always knows where pressing will take them
before they press.

**8 · The keyboard does everything the pointer does.**
Not as an accessibility obligation — as a working requirement. An office user
reconciling forty rows is faster and more accurate on the keyboard, and any
path that exists only for a pointer is a path that is slow for the person who
uses it most.

**9 · State survives interruption.**
A phone call, a lock screen, a dropped signal, an expired session. The user
returns to what they had: their text, their scroll position, their place in the
task. Losing typed work is the one failure this product may never commit,
because the work is a record of something that happened and re-typing it moves
it further from the event.

**10 · The product never asks a question it can answer.**
If the system knows the company, the date, the site or the role, it does not
ask. Every avoidable question is a small accusation that the product was not
paying attention.

**11 · Two identical actions produce two identical outcomes.**
No hidden modes. No behaviour that depends on how recently something else
happened. Predictability is not a nicety here; it is what lets someone operate
the product without looking at it closely, which is the field condition.

**12 · Nothing is offered that will fail.**
A control that is present and available works. If the action would be refused —
by permission, by rule, by state — the interface says so at the point of
offering, per Law 3. A button that exists to produce an error message is a trap.

---

## 4. Controls

### 4.1 Press and release are different events

Feedback belongs to the press; commitment belongs to the release. The control
responds the instant it is touched and acts when it is let go.

This is not stylistic. It gives cancellation away for free — a finger that
lands on the wrong control can slide off it — and it satisfies §2's first
promise without committing anything.

### 4.2 Disabled is almost always the wrong answer

A disabled control is a refusal with the explanation removed. The user is left
to work out what they did wrong, and on a phone in the sun they will not.

The default is: **the control is enabled, and pressing it explains.** That
converts a silent dead end into a sentence.

Two exceptions, both narrow:

- **While the same action is in flight**, to prevent a second submission of a
  record that would become a duplicate payment. The label says so.
- **Where the disabled state is itself the information** and is labelled as
  such — a rule that visibly applies, not a mystery.

### 4.3 Working preserves the label

A control that is working keeps its size and its words. Replacing "Record
payment" with a spinner removes the only text confirming what is happening, at
the exact moment the user most wants confirmation, and collapsing the control
shifts everything beside it.

### 4.4 Dangerous actions are slower paths, not redder buttons

Colour is not a safeguard — it cannot be read by everyone, it is unreliable in
sunlight, and it becomes invisible through familiarity within a week.

The safeguard is Law 4: name the specific thing. What makes a destructive
action safe is that completing it requires knowing *which* record you are
destroying, which a habitual keystroke cannot supply.

### 4.5 One primary action per surface

More than one primary is no primary. If two things are equally the point, the
surface has not decided what it is for.

---

## 5. Tables

The product lives in tables, so this section decides more than any other.

### 5.1 A table here is a ledger, not a spreadsheet

That distinction settles nearly every sub-question, so it is worth stating
precisely.

A **spreadsheet** is a workspace: the user authors values in it, the cell is
the unit, and editing in place is the whole point. A **ledger** is a record of
things that already happened: you read it, scan it, compare within it and cite
from it. The row is the unit, and changing one is an *amendment* — an event
with a reason and a time, not a keystroke.

This product's tables are ledgers. Every rule below follows.

### 5.2 The row is the unit

Interaction targets rows, not cells. A row refers to one record and never
changes what it refers to: when the underlying data changes the row updates in
place, and it does not become a different row.

### 5.3 No inline editing of the record

Editing a recorded fact is an amendment. An amendment needs somewhere to say
what changed and why, and it needs to be deliberate. Both are impossible in a
cell that turns into an input on a double-click.

Editing therefore happens in a form. This is slower on purpose, and it is the
same trade the two-day rule makes: friction that protects the record is craft
(`PRODUCT_SOUL` Law 5).

Non-record state — a filter, a sort, a column choice, a saved view — may be
changed in place freely, because none of it is testimony.

### 5.4 Hover reveals nothing

Actions on a row are visible or they are behind an explicit affordance the user
can see. A control that appears on hover does not exist for the supervisor on a
phone, does not exist for a keyboard user, and cannot be found by anyone who
has not already found it.

### 5.5 Sorting and filtering are views, never changes

They alter what is shown, never what is stored, and they say so. A sort never
re-orders a list while a pointer or thumb is on it — the new order applies, but
what is under the finger does not move out from under it.

### 5.6 Selection only exists where a bulk action exists

Checkboxes with nowhere to go are an invitation to a dead end. If nothing can
be done to many records at once, nothing offers to select many.

Where bulk actions do exist, the count and the scope are stated in words before
the action, and "all" always means *all matching the current filter*, stated
explicitly, never *all loaded so far*.

### 5.7 Expansion shows more of the same record

An expanding row reveals detail belonging to that record. If it would show a
different record, it is a link and it navigates. Conflating the two teaches the
user that expansion is unpredictable.

### 5.8 A table states its own scope

Always: what it is showing, how many, filtered by what, as of when.

A ledger with an unstated scope is not evidence. This is the single most
important table rule in a product whose output is credibility, and it is the
one most often skipped because it looks like chrome.

### 5.9 Density is chosen per scene

The same table has an office density and a field density. Neither is a fallback
for the other, and the field one is not the office one with rows removed.

---

## 6. Forms

### 6.1 The product does not correct people while they type

Validation never runs on keystroke. Correcting someone mid-word is the
interface arguing with them, and it is worst exactly where this product is most
used: a rupee figure being entered digit by digit is invalid for every keypress
until the last one, and a Gujarati name is not a spelling mistake.

### 6.2 Three moments, three jobs

| moment | what happens | why |
|---|---|---|
| **On leaving a field** | a field that has been *visited and left* may confirm a problem | The user has finished the thought. A field never visited says nothing — pre-emptive complaint is an accusation before the fact. |
| **On submit** | everything is checked at once, and focus moves to the first problem | The only place focus movement is justified: the user asked to finish and the product is showing them what stands in the way. |
| **On the server's answer** | the truth | Client-side checking is a courtesy that saves a round trip. It is never authority. |

The product currently has no field-level validation at all — zero blur handlers
across every page — so this is a decision being taken, not a habit being
inherited.

**Client validation must never block a submit the server would accept.** A form
that refuses to send something the backend considers valid has invented a rule,
and invented rules are how an interface starts implying authority it does not
have (`PRODUCT.md` Principle 4).

### 6.3 An error returns to the field, never to a banner

The problem is displayed at the thing that has the problem. A message at the
top of a long form, describing a field below the fold, has moved the
information away from the place it is needed — which is the same failure as a
toast, in a different costume.

### 6.4 Nothing the user typed is ever discarded

Not on validation failure, not on a server error, not on reconnect, not on
session expiry, not on navigating away and back. This is Law 9 at its sharpest.

### 6.5 Success is the record appearing

If the new row is visible, the product says nothing else. A confirmation
alongside visible evidence is the product congratulating itself for working.

Where the consequence is *not* visible — the record was created somewhere else,
or a list is not on screen — then and only then is a confirmation warranted,
and it names what was created and where it went (Law 6).

### 6.6 Required is stated in words

Not by an asterisk with a legend elsewhere, and not discovered on submit.

---

## 7. Navigation

### 7.1 Navigation is structural, not spatial

Pages do not slide. Sliding asserts a spatial relationship — that Payments is
to the left of Workers — and no such relationship exists. The user did not
travel; they turned to a different page of the same document.

What changes is the content region. What stays is everything that tells them
they are still in the same place. That continuity *is* the navigation model,
and it is why a route change must never feel like an arrival: arriving twice
makes the first arrival (§8 of `EXPERIENCE_LANGUAGE`) a lie.

### 7.2 Location is always answered

Where am I, what is this, and how do I get back — visible at all times, without
interaction, on every width including the narrowest.

### 7.3 Back always works and always means back

Every route is reachable by URL and every state worth returning to is in the
URL. A filtered register, an open record, a chosen tab: if the user would send
it to a colleague, it has an address.

### 7.4 The product does not move the user without being asked

No redirect after an action, except where completing the action genuinely ends
the task and staying would leave the user on a surface that no longer means
anything. Where it does move them, it says so.

---

## 8. Search and filtering

Search is among the highest-frequency interactions in a register-heavy product,
and it is where the difference between a tool and a toy shows fastest.

### 8.1 Progressive to narrow, explicit to act

Results narrow as the user types. Typing never *does* anything else — it never
navigates, never selects, never triggers a write. Refining a search must be
free of consequence, or people stop refining.

### 8.2 Zero results is an answer, not a failure

"No tenders match *shreeji*" is information a witness gives, and it is often
the answer the user came for. It carries no apology, no illustration, and no
suggestion that they did something wrong.

It always states **what was searched** — the scope — because "no results" alone
is indistinguishable from a broken search, and the difference matters to
somebody deciding whether a record exists.

### 8.3 Filters are visible as a sentence

The active filter set is always readable in plain language, and it is
unambiguous that filters combine narrowly. A user who cannot see why a list is
short will conclude data is missing — and in this product, "data is missing" is
the most damaging wrong conclusion available.

### 8.4 Clearing is one action, always present

And clearing a filter never also clears the search term, or vice versa. Each
control undoes exactly its own effect.

---

## 9. Saving

The most consequential section, because "saved" is the promise the entire
product rests on.

### 9.1 What saved means

> **Saved means the record exists somewhere the user cannot lose it, and the
> interface has been told so.**

Not "the request was sent". Not "it probably worked". The interface never says
saved on its own authority.

### 9.2 Optimistic updates are forbidden for anything evidentiary

An optimistic update displays a fact before it is a fact. For a canvas or a
task list that is a reasonable trade — the worst case is a moment of confusion.
Here the worst case is that the product showed testimony that does not exist,
and a witness that does that once is finished.

So: **no optimistic writes for payments, approvals, daily updates, allocations,
material entries, worker money, or anything that enters the audit trail.**

Optimistic behaviour is fine for view state — a filter, a sort, a collapsed
panel, a chosen tab — because none of it is a claim about the world.

### 9.3 Four states, always distinguishable

**Unsaved** — the user has changes the product does not have.
**Saving** — sent, not yet confirmed.
**Saved** — confirmed by the server.
**Held** — recorded on the device, not yet delivered. The field state.

The user must never have to guess which one they are in, and if the interface
does not know, it says it does not know. "Cannot confirm" is a legitimate and
often correct thing to display.

### 9.4 No autosave on a record

Autosave is authorship without intent. It decides on the user's behalf *when*
the record was made — and *when* is the whole product (`PRODUCT.md`: the day is
the unit; the two-day rule). A record must be committed by a person, at a
moment they chose.

Autosave is right for a **draft** of a long form, and a draft is explicitly not
a record: it is labelled as one, it is private to the user, it carries no
timestamp that means anything, and it never appears in a register.

### 9.5 Retry is silent for reads, explicit for writes

Re-fetching failed data is harmless and should happen without narration.
Re-sending a write can create a second payment. Writes are retried only when a
person asks, and the interface makes clear whether the first attempt is known
to have failed or merely unconfirmed — those are different situations and only
one of them is safe to repeat.

### 9.6 Offline: the largest gap in the product today

`PRODUCT.md` states that field work happens on weak connectivity. There is
currently no offline handling anywhere in the frontend. That is the widest
distance between what this product claims to be and how it behaves, and this
document names it so it cannot be quietly inherited.

The behaviour, when it is built:

- An entry made without signal is **held**, visibly, and is never discarded.
- It keeps **its own capture time**. The moment of the event is the evidence;
  the moment of delivery is logistics. Re-stamping a held record on delivery
  would destroy the exact property the two-day rule exists to protect.
- It is delivered when possible, **once**, with duplicate protection — a
  supervisor must not create two ledger entries by walking back into signal.
- The user is told what is held and what has landed, in a place they can check
  without hunting.
- Nothing about being offline is presented as an error. It is a condition of
  the work.

---

## 10. Failure

"Something went wrong" is the only message in software that carries no
information at all. It is banned.

Ten situations, ten behaviours. They are genuinely different and treating them
alike is why most products' errors are useless.

| situation | what it means | how it behaves |
|---|---|---|
| **Mistake** | the input cannot be accepted as typed | Corrected in place. Everything kept. No blame, no exclamation. |
| **Invalid** | well-formed, but not allowed | States the *rule*, not the failure. "Entries older than two days need approval" beats "invalid date". |
| **Missing** | a required fact absent | Points at the field. Never an abstract list of what is wrong somewhere below. |
| **Duplicate** | this already exists | Shows the existing record and offers to open it. Never a bare rejection — the user's goal is almost always the record they already made. |
| **Conflict** | someone else changed it first | Shows both versions. Never auto-merges, never silently overwrites. A conflict is two people's testimony and the product does not choose between them. |
| **Permission** | you may not do this | Named as a permission, not a fault. Where concealing a record's existence is the security guarantee, concealment holds and the message does not leak it by implication. |
| **Expired** | the session ran out | The place is kept, the typed content is kept, and returning resumes rather than restarts. Already how this product behaves; it is now a rule. |
| **Unavailable** | the service is down | Says what still works. Never blanks a whole page because one region failed. |
| **Offline** | the device cannot reach the server | Not an error. See §9.6. |
| **Failure** | something broke that should not have | Says so plainly, keeps every input, offers one retry, and never suggests the user caused it. |

Two rules across all ten:

- **An error never destroys work.**
- **An error belongs to the thing that failed**, not to a corner of the screen.
  The product currently raises 157 error toasts against 64 success toasts —
  which means failure is overwhelmingly its most common form of speech, and
  almost all of it is displayed away from where it happened. Both facts are
  defects.

---

## 11. Undo and confirmation

> **Confirmation for the irreversible. Undo for the reversible. Never both for
> the same action.**

Both together is the product hedging: it has not decided whether the action is
serious, so it charges the user twice.

**Confirmation** costs attention every single time, in order to prevent a
mistake that happens rarely. That trade is only worth making when the mistake
cannot be repaired — a deletion that cascades, an approval that is audited, a
grant of backdating access that is spent on use.

**Undo** costs nothing until it is needed. Wherever an action can genuinely be
reversed, undo is correct and confirmation is waste.

**And undo must be real.** If reversing leaves a trace saying the thing happened
and was reversed, that is not undo — it is a second recorded event, and the user
must be told that before they rely on it. In a product whose value is an
auditable record, the honest answer is often "this cannot be undone", said
plainly, in advance.

---

## 12. Notifications

Notifications spend trust, and this product's currency is trust.

The most applicable body of practice here comes from industrial alarm
management rather than from software: the discipline that **every alarm must
have a defined operator response, and an alarm nobody acts on is removed**. An
alarm system that cries constantly is not a cautious alarm system; it is a
disabled one, because operators learn to ignore it and then miss the real
event.

### 12.1 The test

Every notification must answer: **what is the person supposed to do about
this?** If there is no answer, it is not a notification. It is noise, and it is
removed rather than made quieter.

### 12.2 What each channel is for

- **Nothing.** The default. If the consequence is visible on screen, the
  product says nothing at all.
- **In place.** A change to a thing is shown on the thing. This is where most
  of the product's current toast traffic belongs.
- **A transient message.** Only for something that completed which the user
  *cannot see*, or something that arrived which they *did not cause*. Nothing
  actionable, because a message that disappears cannot carry an action.
- **A persistent item.** Something waiting for this person. It stays until
  resolved, and it is reachable from wherever they are.
- **An interruption.** Only when continuing would make the situation worse. Not
  when it would merely be untidy.

### 12.3 Badges count what is waiting for you

Not what exists, not what is new, not what is unread. A number that counts
things nobody must act on trains the user to ignore the number — and then the
one that matters is invisible.

### 12.4 Failures are not notifications

They are state, and they belong to the thing that failed. See §10.

---

## 13. Waiting, as an interaction

`EXPERIENCE_LANGUAGE` §5 defines the shapes of a wait. This is what a wait may
do to the person.

- **A refresh never blanks.** Data already on screen stays, marked as the
  previous read, until new data replaces it. Taking away something true to
  indicate that something truer is coming is a net loss of information.
- **A navigation may blank**, because the previous content was about something
  else.
- **A wait never steals focus**, and an arriving result never moves what the
  user is reading or typing into.
- **A wait never disables the way out.** Cancel, back and navigation remain
  available throughout. A user who cannot leave a loading state will reload the
  page, and reloading is how typed work gets lost.
- **The scope of a wait matches the scope of the change.** One region loading
  freezes one region.

---

## 14. If artificial intelligence ever ships

`EXPERIENCE_LANGUAGE` §11 sets the gate: derived from this company's own
records, explainable by showing them, labelled as inference rather than fact.
This is how such a feature would have to *behave*.

- **It proposes; a person commits.** Always. There is no automatic action, no
  matter how confident, because Law 1 has no AI exception.
- **Nothing is pre-filled by inference.** A suggestion appears beside the
  field, never inside it. A pre-filled value is authorship — the user has to
  notice it to reject it, and people do not reliably notice.
- **Confidence is expressed as evidence, never as a percentage.** "Based on 14
  similar entries" can be checked. "87% confident" cannot, and a number that
  cannot be checked is exactly the kind of unverifiable claim this product
  refuses everywhere else.
- **Explanation is one action away and shows records**, not prose about
  reasoning. The product's answer to "why do you think that" is always the
  evidence, because that is its answer to every other question.
- **It never initiates.** No proactive suggestions, no "we noticed", no
  unprompted analysis. A witness that volunteers opinions is no longer a
  witness.
- **Its output never enters the audit trail as a fact**, and never appears in an
  export as though it had been recorded by a person.
- **One visible error retires the feature.** Not fixes it — retires it, until it
  can be shown to be right. The product has one asset and it cannot be spent on
  convenience.

---

## 15. Accessibility as a consequence

This section deliberately does not restate WCAG. `PRODUCT.md` already commits
to 2.2 AA, verified rather than asserted, and the test suite enforces it.

What belongs here is the more useful observation: **almost every accessibility
property this product needs falls out of designing for a gloved supervisor in
direct sunlight.** They are the same requirements arrived at from a different
direction.

| interaction principle | what it produces for free |
|---|---|
| No hover-only affordance (§5.4) | keyboard and screen-reader parity |
| Keyboard does everything (Law 8) | full operability without a pointer |
| Predictability, no hidden modes (Law 11) | the largest single reduction in cognitive load |
| Errors attached to the thing (§6.3, §10) | programmatic association between a field and its message |
| Every control states its state in words | screen readers get the state without an ARIA workaround |
| Confirmations that persist until consequence is visible (§12) | no timing-dependent message to miss |
| Nothing carried by colour alone | colour-blind and sunlight legibility, in one rule |
| State survives interruption (Law 9) | recovery for anyone whose input takes longer |
| Large targets, obvious actions | motor impairment, gloves, and a moving vehicle |

The claim being made is not that compliance is automatic. It is that a product
designed for the hardest real user is already most of the way there, and that
treating accessibility as a separate pass is how it ends up bolted on and
brittle.

**Reduced motion is not in this table because it is not a consequence — it is a
first-class mode**, designed at the same time as the default, per
`VISUAL_PRINCIPLES` §9.

---

## 16. Earned spectacle

A new concept, and the one most easily got wrong, so the boundary is drawn
tightly.

### 16.1 The apparent contradiction, resolved

`PRODUCT_SOUL` Law: *nothing is celebrated for having merely happened*. That
stands. It bans the product celebrating **its own operation** — recording a
payment, approving an update, adding a worker. The product did its job; a job
being done is not an achievement.

But some events are not the product's operation. They are the **business's**
events, and a handful of them genuinely change what is true about the company
rather than what is in the database.

### 16.2 What qualifies

All three, or it does not qualify:

1. **Rare.** A handful of times in a project's life, not a handful of times a
   week.
2. **It changes what is true about the business**, not what is in a table.
3. **The user would tell someone else about it** — out loud, that evening.

Qualifying, and this list is deliberately short:

- A project handed over and closed.
- The final payment on a project reconciled — the job is finished financially,
  not just physically.
- The first tender won.
- Every worker on a completed job paid to zero. Nobody is owed anything.
- A full financial year closed.

### 16.3 What never qualifies

First login. A first record of any kind. Any count reaching a round number. A
streak. An export. An approval. A login milestone. Anything the *product* did
rather than the business. Anything that recurs monthly.

If a user sees earned spectacle more than a few times a year, the qualification
is wrong and the list is corrected — not the frequency tuned.

### 16.4 The treatment: stillness, not motion

This is the part that inverts the usual answer, and it is the reason the
concept survives in a product this restrained.

In a product whose resting state is already calm, **more motion cannot signal
significance** — everything else is quiet, so louder is merely out of
character. What signals significance in a quiet room is that everything else
**stops**.

So the product's spectacle is subtraction:

- The surrounding interface clears. Chrome, counters, secondary panels recede.
- The fact — the figure, the record, the name — is given the whole surface at a
  scale it never otherwise gets.
- The moment holds longer than any other moment in the product, and it is
  dismissed by the user rather than by a timer.
- Nothing animates. Nothing counts up. Nothing is congratulated.

The feeling to aim for is the moment a document is signed: slower, stiller and
more deliberate than everything around it. Not applause — **weight**.

No confetti, no sound, no mascot, no badge, no shareable card. Those celebrate
the software. This marks the work.

---

## 17. What this product never does

Interaction-specific, and additional to the refusals in
`EXPERIENCE_LANGUAGE` §13.

- **Never acts on the user's behalf.**
- **Never says "something went wrong."**
- **Never discards typed input**, for any reason.
- **Never optimistically displays an evidentiary record.**
- **Never autosaves a record.**
- **Never re-timestamps a held entry on delivery.**
- **Never silently retries a write.**
- **Never hides a primary action behind hover, long-press or a gesture.**
- **Never disables a control instead of explaining it**, outside §4.2's two
  exceptions.
- **Never gates a destructive action behind a challenge that is the same every
  time.**
- **Never shows a notification with no defined response.**
- **Never puts an error anywhere but on the thing that failed.**
- **Never asks for confirmation of something reversible.**
- **Never offers undo for something that is not genuinely reversible.**
- **Never blanks data on refresh.**
- **Never steals focus**, except to the first problem on an attempted submit.
- **Never moves a target under a finger or a cursor.**
- **Never invents a client-side rule the server does not have.**
- **Never lets AI initiate, pre-fill, or enter the record.**
- **Never celebrates its own operation.**

---

## 18. Studied from outside construction

Behaviour, not appearance. Recorded with what was taken and what was refused,
because an unexamined borrowing is how a product acquires someone else's
operating conditions.

**Industrial alarm management (ISA-18.2 and its practice).** The most directly
applicable body of work to this product's hardest interaction problem, and it
is not from software at all. Adopted: every alarm has a defined response;
alarms nobody acts on are removed rather than made quieter; a chattering alarm
system is a disabled one. §12 is essentially this, applied.

**Bloomberg Terminal.** The closest interaction relative to the office half of
this product. Adopted: extreme density with almost nothing moving; an expert
path that is faster than the discoverable one; a refusal to redesign for the
novice at the expert's expense. Rejected: its assumption that the user was
trained. A site supervisor did not choose this software and will not be trained
on it.

**CAD and BIM (AutoCAD, Revit).** Adopted: constraints are visible and
overridable, and the user can always see what state they are in. Rejected:
modal editing. A product operated one-handed while interrupted cannot have
modes, which is why Law 11 forbids them outright.

**Linear.** Adopted: keyboard parity as a genuine first path rather than an
accessibility afterthought; the discipline that every state has an address.
Rejected: its optimistic write model. It is correct for a task list, where the
worst case is a moment of confusion, and wrong here, where the worst case is
displayed testimony that does not exist (§9.2).

**Figma.** Adopted: presence and activity as ambient information rather than as
notifications — you can see that someone else is there without being told.
Rejected: its optimistic canvas model, for the same reason as Linear, and its
assumption of a stable connection.

**Apple platforms.** Adopted: respond on press; interruptible everything;
typed text is never lost across an interruption. Rejected: spring physics
(settled — nothing here is continuously pointer-driven), and translucent
materials, which fail in sunlight and put a surface in front of the record.

**Vehicle and drone HMIs (Tesla, Rivian, DJI).** Adopted: critical state is
always visible and never behind a menu, and the interface never demands
attention while the operator's hands are busy with something that matters more.
That is precisely the supervisor's condition. Rejected: their appetite for
animated renders of the machine, which is depiction (`EXPERIENCE_LANGUAGE` §2).

**Arc.** Rejected wholesale. Novel navigation and spatial metaphors require
learning, and a product used by someone who did not choose it and cannot be
trained on it may not require learning. Recorded so the absence is not mistaken
for an oversight.

---

## 19. Source hierarchy

When two documents conflict, this resolves it. It is short and it is absolute.

1. **`PRODUCT.md`** — frozen behaviour, the authority model, the priority
   persona, the untouchable controls. Nothing overrides it.
2. **`PRODUCT_SOUL.md`** — what the product believes. Overrides every design
   document.
3. **`VISUAL_PRINCIPLES.md`, `EXPERIENCE_LANGUAGE.md`, this document** — peers.
   Three channels of one position: the frame, time, and behaviour.
4. **`VISUAL_IDENTITY.md`** — what makes the product recognisable. Yields to
   the three above where they collide.
5. **`ARCHITECTURE.md`** — how it is actually built, and the behavioural
   contracts implementation may not break.
6. **Craft skills** — Impeccable, Taste, apple-design, emil-design-eng,
   animation-vocabulary, design-system, prototype, ui-styling,
   redesign-existing-projects, industrial-brutalist-ui, UI/UX Pro Max. They
   answer *how well*, never *why*. Adoption and rejection for each is recorded
   in `VISUAL_IDENTITY` §3 and `EXPERIENCE_LANGUAGE` §15 and is not repeated
   here; where one of them recommends a behaviour that conflicts with §3, §3
   wins and the rejection is written down.

**Tie-break between the three peers:** the priority persona decides. The site
supervisor, on a phone, outdoors, interrupted, wins the argument
(`PRODUCT.md`). Not because their needs matter more in general, but because
theirs is the condition under which a design flaw actually breaks something.

---

## 20. Status

Interaction language defined. Nothing implemented, and no further philosophy
document is required or permitted.

Three things in this document describe the product as it should be rather than
as it is, and are recorded as open work rather than as descriptions:

- **Offline behaviour does not exist** (§9.6). The largest gap between what the
  product claims and how it behaves.
- **The delete challenge is a constant** (Law 4). It gates nothing after the
  third use.
- **Failure is the product's most common form of speech** — 157 error messages
  to 64 successes, nearly all displayed away from what failed (§10).

Each is a defect this document now forbids. None is fixed by writing it down.
Implementation resumes.
