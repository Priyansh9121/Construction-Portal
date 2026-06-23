const pool = require("../../database/pool");

const VALID_FINANCE_TYPES = [
  "INVESTOR",
  "GOVERNMENT_BILL",
  "SUBCONTRACTOR",
  "OFFICE",
  "COMPANY_CHARGE",
  "COMPANY_CHARGE_PAYMENT",
  "TDS",
  "GST_RETURN",
];

function toNumber(value) {
  return Number(value || 0);
}

exports.getFinanceRecords = async (req, res) => {
  try {
    const { tenderId } = req.params;

    const result = await pool.query(
      `
      SELECT *
      FROM tender_finance_records
      WHERE tender_id = $1
      AND COALESCE(is_deleted, FALSE) = FALSE
      ORDER BY record_date DESC NULLS LAST, id DESC
      `,
      [tenderId]
    );

    res.status(200).json({
      success: true,
      records: result.rows,
    });
  } catch (error) {
    console.error("Get finance records error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.createFinanceRecord = async (req, res) => {
  try {
    const {
      site_id = null,
      tender_id,
      record_type,
      source_name,
      payment_mode,
      amount = 0,
      interest_percent = 0,
      gst_percent = 0,
      gst_total = 0,
      gst_done = 0,
      company_charge_percent = 0,
      company_charge_total = 0,
      company_charge_done = 0,
      tds_amount = 0,
      record_date,
      notes,
      status = "active",
    } = req.body;

    if (!tender_id || !record_type) {
      return res.status(400).json({
        success: false,
        message: "Tender and finance type are required",
      });
    }

    if (!VALID_FINANCE_TYPES.includes(record_type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid finance type",
      });
    }

    const finalGstTotal =
      record_type === "GOVERNMENT_BILL" && toNumber(gst_total) === 0
        ? (toNumber(amount) * toNumber(gst_percent)) / 100
        : toNumber(gst_total);

    const finalGstDone =
      record_type === "GST_RETURN" && toNumber(gst_done) === 0
        ? toNumber(amount)
        : toNumber(gst_done);

    const finalGstLeft = finalGstTotal - finalGstDone;

    const finalCompanyChargeTotal =
      record_type === "COMPANY_CHARGE" && toNumber(company_charge_total) === 0
        ? (toNumber(amount) * toNumber(company_charge_percent)) / 100
        : toNumber(company_charge_total);

    const finalCompanyChargeDone = toNumber(company_charge_done);
    const finalCompanyChargeLeft =
      finalCompanyChargeTotal - finalCompanyChargeDone;

    const result = await pool.query(
      `
      INSERT INTO tender_finance_records
      (
        site_id,
        tender_id,
        record_type,
        source_name,
        payment_mode,
        amount,
        interest_percent,
        gst_percent,
        gst_total,
        gst_done,
        gst_left,
        company_charge_percent,
        company_charge_total,
        company_charge_done,
        company_charge_left,
        tds_amount,
        record_date,
        notes,
        status
      )
      VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
       $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *
      `,
      [
        site_id,
        tender_id,
        record_type,
        source_name || null,
        payment_mode || null,
        toNumber(amount),
        toNumber(interest_percent),
        toNumber(gst_percent),
        finalGstTotal,
        finalGstDone,
        finalGstLeft,
        toNumber(company_charge_percent),
        finalCompanyChargeTotal,
        finalCompanyChargeDone,
        finalCompanyChargeLeft,
        toNumber(tds_amount),
        record_date || null,
        notes || null,
        status,
      ]
    );

    res.status(201).json({
      success: true,
      record: result.rows[0],
    });
  } catch (error) {
    console.error("Create finance record error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.updateFinanceRecord = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      site_id = null,
      tender_id,
      record_type,
      source_name,
      payment_mode,
      amount = 0,
      interest_percent = 0,
      gst_percent = 0,
      gst_total = 0,
      gst_done = 0,
      company_charge_percent = 0,
      company_charge_total = 0,
      company_charge_done = 0,
      tds_amount = 0,
      record_date,
      notes,
      status = "active",
    } = req.body;

    if (!tender_id || !record_type) {
      return res.status(400).json({
        success: false,
        message: "Tender and finance type are required",
      });
    }

    if (!VALID_FINANCE_TYPES.includes(record_type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid finance type",
      });
    }

    const finalGstTotal =
      record_type === "GOVERNMENT_BILL" && toNumber(gst_total) === 0
        ? (toNumber(amount) * toNumber(gst_percent)) / 100
        : toNumber(gst_total);

    const finalGstDone =
      record_type === "GST_RETURN" && toNumber(gst_done) === 0
        ? toNumber(amount)
        : toNumber(gst_done);

    const finalGstLeft = finalGstTotal - finalGstDone;

    const finalCompanyChargeTotal =
      record_type === "COMPANY_CHARGE" && toNumber(company_charge_total) === 0
        ? (toNumber(amount) * toNumber(company_charge_percent)) / 100
        : toNumber(company_charge_total);

    const finalCompanyChargeDone = toNumber(company_charge_done);
    const finalCompanyChargeLeft =
      finalCompanyChargeTotal - finalCompanyChargeDone;

    const result = await pool.query(
      `
      UPDATE tender_finance_records
      SET
        site_id = $1,
        tender_id = $2,
        record_type = $3,
        source_name = $4,
        payment_mode = $5,
        amount = $6,
        interest_percent = $7,
        gst_percent = $8,
        gst_total = $9,
        gst_done = $10,
        gst_left = $11,
        company_charge_percent = $12,
        company_charge_total = $13,
        company_charge_done = $14,
        company_charge_left = $15,
        tds_amount = $16,
        record_date = $17,
        notes = $18,
        status = $19,
        updated_at = NOW()
      WHERE id = $20
      AND COALESCE(is_deleted, FALSE) = FALSE
      RETURNING *
      `,
      [
        site_id,
        tender_id,
        record_type,
        source_name || null,
        payment_mode || null,
        toNumber(amount),
        toNumber(interest_percent),
        toNumber(gst_percent),
        finalGstTotal,
        finalGstDone,
        finalGstLeft,
        toNumber(company_charge_percent),
        finalCompanyChargeTotal,
        finalCompanyChargeDone,
        finalCompanyChargeLeft,
        toNumber(tds_amount),
        record_date || null,
        notes || null,
        status,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Finance record not found",
      });
    }

    res.status(200).json({
      success: true,
      record: result.rows[0],
    });
  } catch (error) {
    console.error("Update finance record error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.deleteFinanceRecord = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      UPDATE tender_finance_records
      SET
        is_deleted = TRUE,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
      `,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Finance record not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Finance record deleted successfully",
    });
  } catch (error) {
    console.error("Delete finance record error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

exports.getTenderFinanceSummary = async (req, res) => {
  try {
    const { tenderId } = req.params;

    const result = await pool.query(
      `
      SELECT *
      FROM tender_finance_records
      WHERE tender_id = $1
      AND COALESCE(is_deleted, FALSE) = FALSE
      `,
      [tenderId]
    );

    const records = result.rows;

    const gstTotal = records
      .filter((r) => r.record_type === "GOVERNMENT_BILL")
      .reduce((sum, r) => sum + toNumber(r.gst_total), 0);

    const gstDone = records
      .filter((r) => r.record_type === "GST_RETURN")
      .reduce((sum, r) => sum + toNumber(r.amount), 0);

    const companyChargeTotal = records
      .filter((r) => r.record_type === "COMPANY_CHARGE")
      .reduce((sum, r) => sum + toNumber(r.company_charge_total), 0);

    const companyChargeDone = records
      .filter((r) => r.record_type === "COMPANY_CHARGE_PAYMENT")
      .reduce((sum, r) => sum + toNumber(r.amount), 0);

    const overallTotal = records.reduce(
      (sum, r) => sum + toNumber(r.amount),
      0
    );

    const overallDone = gstDone + companyChargeDone;

    res.status(200).json({
      success: true,
      summary: {
        gst_total: gstTotal,
        gst_done: gstDone,
        gst_left: gstTotal - gstDone,

        company_charge_total: companyChargeTotal,
        company_charge_done: companyChargeDone,
        company_charge_left: companyChargeTotal - companyChargeDone,

        overall_total: overallTotal,
        overall_done: overallDone,
        overall_left: overallTotal - overallDone,
      },
    });
  } catch (error) {
    console.error("Get tender finance summary error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};