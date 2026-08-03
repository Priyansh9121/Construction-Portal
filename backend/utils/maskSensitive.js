/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| Masking for financial and tax identifiers, so a broad list endpoint can
| show that details EXIST without disclosing what they are.
|
| The problem this solves (F-12): GET /api/subcontractors returned every
| counterparty's full account number in one response, because the screen
| needs to show which subcontractors have banking on file. Showing that is
| legitimate; showing the numbers is not.
|
| Responsibilities:
|   - Mask an account number to its last four digits
|   - Mask a BSB to its last three
|   - Mask an IFSC to its branch suffix
|   - Refuse to render a TFN at all
|   - Strip the raw values from a row and replace them with masked ones
|
| Exports:
|   maskAccountNumber, maskBsb, maskIfsc
|   SENSITIVE_FINANCIAL_FIELDS
|   maskFinancialFields(row)
|
| Used by:
|   utils/scopedCrud.js — via the `transformRow` option
|   modules/subcontractors/subcontractor.controller.js
|
| Database tables touched:
|   none. Pure transformation over a row already read.
|
| Security:
|   Masking happens on the way OUT, in the response layer. It is not
|   encryption and not a substitute for it — the values are still plain
|   text in the database, and anyone with database access or the
|   role-gated detail endpoint sees them in full. What it removes is the
|   bulk exposure: one authenticated request no longer yields the whole
|   company's payment details.
|
|   The masked forms are deliberately short. Four trailing digits are
|   enough for a human to confirm "yes, that is the account I expect" and
|   not enough to pay anyone.
|
|   A TFN has no masked form. There is no screen that needs to confirm a
|   tax file number at a glance, so it is simply absent from any response
|   this module touches.
|
| Note:
|   The mask character is U+2022 BULLET, not an asterisk, so a masked value
|   is visually distinct from a wildcard or a redaction marker elsewhere in
|   the UI.
|
*/

const MASK_CHARACTER = "•";

/**
 * Masks an account number to its last four characters.
 *
 * Purpose:
 * The list view needs to show that an account is on file, and to let
 * someone confirm they are looking at the right one. Four digits does
 * both; the full number does more than either requires.
 *
 * Parameters:
 * value - the stored account number, or null
 *
 * Returns:
 * A masked string such as "••••1234", or null when there is nothing
 * stored. A value of four characters or fewer is masked ENTIRELY, because
 * revealing the last four of a four-digit number reveals all of it.
 *
 * Side effects:
 * None.
 *
 * Notes:
 * Non-digits are preserved in the suffix rather than stripped, so an
 * account number stored with spaces or dashes still ends in something
 * recognisable.
 */
const maskAccountNumber = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const text = String(value).trim();

  if (!text) {
    return null;
  }

  /*
   * Four or fewer characters: mask the lot. Showing "the last four" of a
   * four-character value would be the value.
   */
  if (text.length <= 4) {
    return MASK_CHARACTER.repeat(4);
  }

  return `${MASK_CHARACTER.repeat(4)}${text.slice(-4)}`;
};

/**
 * Masks a BSB to its last three digits.
 *
 * Purpose:
 * An Australian BSB is six digits identifying the bank and branch. It is
 * not secret on its own, but combined with an account number it is what
 * makes a payment possible, so the two are masked together.
 *
 * Parameters:
 * value - the stored BSB, or null
 *
 * Returns:
 * "•••-456", or null when nothing is stored. Fully masked when three
 * characters or fewer remain after stripping separators.
 *
 * Notes:
 * Separators are stripped before slicing so "062-000" and "062000" mask
 * identically — otherwise the dash would be counted as one of the visible
 * characters.
 *
 * No column on `subcontractors` currently holds a BSB; this exists for the
 * worker banking fields and for any future column, so that the masking
 * rule is defined once rather than invented again at the point of need.
 */
const maskBsb = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const digits = String(value).replace(/[^0-9A-Za-z]/g, "");

  if (!digits) {
    return null;
  }

  if (digits.length <= 3) {
    return MASK_CHARACTER.repeat(3);
  }

  return `${MASK_CHARACTER.repeat(3)}-${digits.slice(-3)}`;
};

/**
 * Masks an IFSC code to its branch suffix.
 *
 * Purpose:
 * An Indian IFSC is eleven characters: four for the bank, a zero, then six
 * identifying the branch. Like a BSB it is routing information rather than
 * a credential, but it is masked alongside the account number because the
 * pair is what enables a transfer.
 *
 * Parameters:
 * value - the stored IFSC, or null
 *
 * Returns:
 * "••••1234", or null. Fully masked when four characters or fewer.
 *
 * Notes:
 * The suffix is enough to distinguish two branches of the same bank, which
 * is the only thing a reviewer needs to check at a glance.
 */
const maskIfsc = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const text = String(value).trim();

  if (!text) {
    return null;
  }

  if (text.length <= 4) {
    return MASK_CHARACTER.repeat(4);
  }

  return `${MASK_CHARACTER.repeat(4)}${text.slice(-4)}`;
};

/**
 * The raw column names this module removes from a response.
 *
 * Anything listed here is deleted from the row and, where a masked form
 * exists, replaced by a `*_masked` sibling.
 *
 * Kept as one list so a new sensitive column is masked everywhere at once
 * rather than at each call site. It intentionally overlaps with
 * REDACTED_KEYS in utils/activityLog.js — that list governs what reaches
 * the audit table, this one governs what reaches an HTTP response, and the
 * two are separate concerns that happen to name similar fields.
 */
const SENSITIVE_FINANCIAL_FIELDS = Object.freeze([
  "account_number",
  "ifsc_code",
  "bsb",
  "tfn",
  "encrypted_account_number",
  "encrypted_bsb",
  "encrypted_tfn",
]);

/**
 * Replaces the sensitive fields on a row with masked equivalents.
 *
 * Purpose:
 * The transformation a broad list endpoint applies before responding.
 *
 * Parameters:
 * row - a database row, or null
 *
 * Returns:
 * A NEW object. The raw sensitive fields are gone; `account_number_masked`
 * and `ifsc_code_masked` are added where a value existed, along with
 * `has_bank_details` so the UI can show a badge without inspecting the
 * masked strings.
 *
 * Side effects:
 * None — the input row is not mutated. That matters because the same row
 * object may be reused by a caller that legitimately needs the full
 * values.
 *
 * Business rules:
 * - `bank_name` and `account_name` are NOT masked. Neither is usable
 *   without the identifiers above, and both are what a person actually
 *   reads to recognise a counterparty.
 * - TFN and the encrypted worker fields are removed with no masked
 *   replacement. No screen needs to confirm them at a glance.
 * - `has_bank_details` is true only when an account number is on file,
 *   since that is the field that makes a payment possible.
 *
 * Security:
 * Deletes rather than overwrites, so a field cannot survive by being
 * spelled differently in the projection. A row passed through this
 * function has no raw identifier left on it.
 */
const maskFinancialFields = (row) => {
  if (!row || typeof row !== "object") {
    return row;
  }

  const masked = { ...row };

  const rawAccountNumber = masked.account_number;
  const rawIfsc = masked.ifsc_code;
  const rawBsb = masked.bsb;

  // Remove every raw identifier first, so nothing survives the copy.
  SENSITIVE_FINANCIAL_FIELDS.forEach((field) => {
    delete masked[field];
  });

  if (rawAccountNumber !== undefined) {
    masked.account_number_masked =
      maskAccountNumber(rawAccountNumber);
  }

  if (rawIfsc !== undefined) {
    masked.ifsc_code_masked = maskIfsc(rawIfsc);
  }

  if (rawBsb !== undefined) {
    masked.bsb_masked = maskBsb(rawBsb);
  }

  /*
   * A single flag the UI can filter and badge on, so a screen never has to
   * infer "has banking" by testing whether a masked string is non-empty.
   */
  masked.has_bank_details = Boolean(
    rawAccountNumber &&
      String(rawAccountNumber).trim()
  );

  return masked;
};

module.exports = {
  MASK_CHARACTER,
  maskAccountNumber,
  maskBsb,
  maskIfsc,
  SENSITIVE_FINANCIAL_FIELDS,
  maskFinancialFields,
};
