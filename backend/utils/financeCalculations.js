/*
|--------------------------------------------------------------------------
| Finance derivation for tender finance records
|--------------------------------------------------------------------------
|
| A tender finance record arrives from the client as a record_type plus a
| handful of amounts, most of which are optional. This module turns that
| loose payload into the full set of columns the table expects, deriving
| anything the caller left out.
|
| Why derivation happens here rather than in the controller: the same
| record can be created and later updated, and both paths must agree on
| what "GST left" means. Computing it in one function means an update
| cannot produce a row that a create never could.
|
| The rule throughout is *derive only when the caller supplied nothing*.
| A zero is treated as "not supplied" rather than as a deliberate zero,
| which is the one sharp edge in this file — see the note on
| calculateFinanceValues below.
|
| Depends on:
|   nothing — pure arithmetic, no database and no I/O
|
| Exports:
|   toNumber()                coercion helper
|   calculateFinanceValues()  the derivation itself
|
| Used by:
|   backend/modules/tenders/tender.service.js — the only consumer, on both
|   the create and the update path for tender finance records.
|
| Note:
|   The record_type strings compared here are the uppercase finance record
|   types (GOVERNMENT_BILL, GST_RETURN, COMPANY_CHARGE, TDS), which are a
|   different set from the title-case payment types in config/constants.js.
|
*/

/**
 * Coerces a possibly-missing, possibly-string amount to a number.
 *
 * Purpose:
 * Money arrives from two directions that disagree on type — JSON request
 * bodies carry strings, and node-pg returns NUMERIC columns as strings too.
 * Arithmetic on either would concatenate instead of add.
 *
 * Parameters:
 * value - anything; typically a number, a numeric string, null or undefined
 *
 * Returns:
 * A number. Missing, null, empty-string and NaN-ish input all become 0.
 *
 * Notes:
 * `value || 0` collapses null, undefined, "" and 0 alike, so this can never
 * return NaN for absent input — which is what keeps a missing optional field
 * from poisoning every later subtraction with NaN.
 */
function toNumber(value) {
    return Number(value || 0);
  }

  /**
   * Expands a partial finance payload into the full set of stored columns.
   *
   * Purpose:
   * Each finance record_type implies one figure that the user should not have
   * to type twice. A government bill already states its amount and GST
   * percentage, so the GST total follows; a GST return *is* the GST being
   * paid, so its amount is the GST done. This fills in whichever figure the
   * record type implies, then computes the two "left" balances.
   *
   * Parameters:
   * payload - the client-supplied record. Recognised keys:
   *   record_type             which of the four derivations applies
   *   amount                  the headline figure of the record
   *   gst_percent             GST rate, used only for GOVERNMENT_BILL
   *   gst_total               total GST owed; derived if omitted
   *   gst_done                GST already paid; derived if omitted
   *   company_charge_percent  the company's cut, as a percentage
   *   company_charge_total    total company charge; derived if omitted
   *   company_charge_done     company charge already taken; never derived
   *   tds_amount              tax deducted at source; derived if omitted
   *
   * Returns:
   * A flat object with every finance column resolved to a number, including
   * the two derived balances gst_left and company_charge_left.
   *
   * Side effects:
   * None. The input payload is not mutated.
   *
   * Business rules:
   * - GOVERNMENT_BILL derives gst_total as amount x gst_percent / 100, and
   *   also derives company_charge_total the same way — a government bill is
   *   the one record type that carries both.
   * - GST_RETURN sets gst_done to the full amount: the record exists
   *   precisely to say that this much GST has now been paid.
   * - COMPANY_CHARGE derives company_charge_total from the percentage.
   * - TDS sets tds_amount to the full amount, for the same reason as
   *   GST_RETURN.
   * - company_charge_done is never derived. Only an explicit payment reduces
   *   what is outstanding, so it is passed through as given.
   * - gst_left and company_charge_left are always recomputed here rather than
   *   trusted from the client, so a stored balance can never contradict the
   *   totals stored beside it.
   *
   * Notes:
   * Derivation triggers on `toNumber(x) === 0`, not on `x === undefined`.
   * A caller who deliberately sends gst_total: 0 for a GOVERNMENT_BILL will
   * therefore have it recomputed from the percentage rather than kept at
   * zero. To force a genuine zero, send gst_percent: 0 as well.
   */
  function calculateFinanceValues(payload) {
    const {
      record_type,
      amount = 0,
      gst_percent = 0,
      gst_total = 0,
      gst_done = 0,
      company_charge_percent = 0,
      company_charge_total = 0,
      company_charge_done = 0,
      tds_amount = 0,
    } = payload;
  
    // A government bill states its amount and GST rate, so the GST owed
    // follows from them. Any other record type is expected to carry its own
    // gst_total, and an explicitly supplied total always wins.
    const finalGstTotal =
      record_type === "GOVERNMENT_BILL" && toNumber(gst_total) === 0
        ? (toNumber(amount) * toNumber(gst_percent)) / 100
        : toNumber(gst_total);

    // A GST return records GST being paid, so its whole amount is GST done.
    // Without this the return would be stored with gst_done 0 and the
    // outstanding balance below would never fall.
    const finalGstDone =
      record_type === "GST_RETURN" && toNumber(gst_done) === 0
        ? toNumber(amount)
        : toNumber(gst_done);

    // Both a standalone company charge and a government bill carry the
    // company's percentage cut, so both derive the same way. The other two
    // record types have no company charge and fall through to the supplied
    // value, which is normally zero.
    const finalCompanyChargeTotal =
      (record_type === "COMPANY_CHARGE" || record_type === "GOVERNMENT_BILL") &&
      toNumber(company_charge_total) === 0
        ? (toNumber(amount) * toNumber(company_charge_percent)) / 100
        : toNumber(company_charge_total);

    // Deliberately never derived: how much of the company charge has actually
    // been collected is a fact about payments received, not something any
    // record type implies.
    const finalCompanyChargeDone = toNumber(company_charge_done);

    // A TDS record is the deduction itself, so its amount is the TDS figure.
    const finalTdsAmount =
      record_type === "TDS" && toNumber(tds_amount) === 0
        ? toNumber(amount)
        : toNumber(tds_amount);

    return {
      amount: toNumber(amount),
      gst_percent: toNumber(gst_percent),
      gst_total: finalGstTotal,
      gst_done: finalGstDone,
      gst_left: finalGstTotal - finalGstDone,
      company_charge_percent: toNumber(company_charge_percent),
      company_charge_total: finalCompanyChargeTotal,
      company_charge_done: finalCompanyChargeDone,
      // Recomputed rather than accepted from the client, so the stored
      // balance can never disagree with the totals stored alongside it.
      company_charge_left: finalCompanyChargeTotal - finalCompanyChargeDone,
      tds_amount: finalTdsAmount,
    };
  }
  
  module.exports = {
    toNumber,
    calculateFinanceValues,
  };