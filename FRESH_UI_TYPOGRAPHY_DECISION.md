# Bilingual Typography Decision — English + Gujarati

> Written 2026-08-07, **before implementation**, as the directive requires.
> Nothing in this decision is implemented yet.

## The requirement

PRODUCT.md records a user-confirmed commitment to a bilingual English +
Gujarati interface. Gujarati is not decorative in this product: the seeded
materials catalog and labour categories carry Gujarati names because that is
what the site actually calls them.

**The problem:** IBM Plex Sans, the currently self-hosted face, does **not**
cover the Gujarati script (U+0A80–U+0AFF). Without a companion face the
browser silently substitutes whatever the OS supplies, which the directive
explicitly forbids: *"Do not fake Gujarati rendering using browser
fallbacks."* That fallback also differs per device, so a supervisor on a
budget Android and an owner on a Mac would see materially different type.

## Measurement

Real files fetched from Google Fonts and measured on disk, Gujarati subset
only (`unicode-range: U+0A80-0AFF`).

| Face | Subset size | Weight model | Cost for 4 weights | Requests |
|---|---|---|---|---|
| **Noto Sans Gujarati** | **112,492 B** | **variable, 100–900** | **110 kB** | **1** |
| Hind Vadodara | 27,716 B / weight | static | ~108 kB | 4 |
| Mukta Vaani | 57,356 B / weight | static | ~224 kB | 4 |

Current baseline for comparison:

| Existing file | Size |
|---|---|
| ibm-plex-sans-var-latin.woff2 | 40,240 B |
| ibm-plex-sans-var-latin-ext.woff2 | 25,868 B |
| **Total today** | **66,108 B** |

## Decision

**Noto Sans Gujarati, variable, self-hosted, loaded under
`unicode-range: U+0A80-0AFF`.**

### Why

1. **Payload is conditional, not unconditional.** `unicode-range` means the
   browser fetches the file only when it actually has to render a Gujarati
   codepoint. An English-only session downloads **zero** extra bytes. This is
   the single most important performance fact here, and it is why the raw
   110 kB figure overstates the real cost.
2. **One file covers every weight.** Hind Vadodara is cheaper per weight but
   costs four requests and four files to reach the same range, landing at
   effectively the same total while losing weight interpolation. On the field
   device class, four extra requests on a weak connection is the worse trade.
3. **Variable pairs with variable.** IBM Plex Sans is already a variable face.
   Matching variable to variable means the weight axis interpolates
   consistently across scripts, so a semibold label is genuinely the same
   weight in both scripts rather than approximately so.
4. **Coverage and maintenance.** Noto's remit is complete script coverage, and
   it is the most actively maintained of the three.
5. **Licensing.** SIL Open Font License, self-hostable, no runtime dependency
   and no third-party request at render time. This matches how Plex is already
   served: zero network calls to a font CDN.

### The honest caveat

**No Gujarati face is purpose-designed to pair with IBM Plex Sans.** Noto Sans
Gujarati is drawn to harmonise with Noto Sans, not Plex. Hind Vadodara is
drawn to harmonise with Hind. Choosing Noto is choosing the best available
pairing, not a designed one.

The consequence is that vertical metrics will not match out of the box, and
mixed-script lines will sit unevenly. That is corrected with measured
`ascent-override`, `descent-override` and `size-adjust` on the `@font-face`
block. **Those values must be measured in a real browser against real mixed
strings, not guessed.** Until they are measured, no bilingual UI ships.

### What is NOT decided

- The override values, which require in-browser measurement.
- Whether bilingual applies to every screen or field-role screens first. This
  is still open in PRODUCT.md and the user has not answered it.
- Whether Gujarati numerals or Latin numerals are used for figures. This is a
  product question with real consequences for the tabular-figure rule, and it
  needs a user answer rather than a designer's guess.

## Verification plan

1. Self-host the subset into `frontend/public/fonts/`.
2. Declare `@font-face` with the Gujarati `unicode-range` only.
3. Measure the metric overrides in a browser against real mixed strings drawn
   from the seeded materials catalog.
4. Confirm with a network-panel check that an English-only route fetches zero
   Gujarati bytes.
5. Re-run the axe and contrast suites; mixed-script rendering must not
   regress any contrast gate.
