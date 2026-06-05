const pool = require("../../database/pool");

exports.getTenderDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const tenderResult = await pool.query(
      `
      SELECT 
        t.*,
        s.site_name,
        s.address,
        s.site_type
      FROM tenders t
      LEFT JOIN sites s ON t.site_id = s.id
      WHERE t.id = $1
      `,
      [id]
    );

    if (tenderResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Tender not found",
      });
    }

    const documents = await pool.query(
      "SELECT * FROM tender_documents WHERE tender_id = $1 ORDER BY id DESC",
      [id]
    );

    const materials = await pool.query(
      "SELECT * FROM tender_materials WHERE tender_id = $1 ORDER BY id DESC",
      [id]
    );

    const banking = await pool.query(
      "SELECT * FROM tender_banking WHERE tender_id = $1 ORDER BY id DESC",
      [id]
    );

    const subcontractors = await pool.query(
      `
      SELECT 
        ts.id,
        ts.tender_id,
        ts.subcontractor_id,
        sc.full_name,
        sc.phone,
        sc.email,
        sc.business_name,
        sc.gst_number,
        sc.bank_name,
        sc.account_name,
        sc.account_number,
        ts.work_description,
        ts.assigned_amount,
        ts.status,
        ts.created_at
      FROM tender_subcontractors ts
      LEFT JOIN subcontractors sc ON ts.subcontractor_id = sc.id
      WHERE ts.tender_id = $1
      ORDER BY ts.id DESC
      `,
      [id]
    );

    const dailyUpdates = await pool.query(
      `
      SELECT 
        dsl.*,
        w.full_name AS worker_name
      FROM daily_site_logs dsl
      LEFT JOIN workers w ON dsl.worker_id = w.id
      WHERE dsl.site_id = $1
      ORDER BY dsl.log_date DESC, dsl.id DESC
      `,
      [tenderResult.rows[0].site_id]
    );

    res.status(200).json({
      success: true,
      tender: tenderResult.rows[0],
      documents: documents.rows,
      materials: materials.rows,
      banking: banking.rows,
      subcontractors: subcontractors.rows,
      dailyUpdates: dailyUpdates.rows,
    });
  } catch (error) {
    console.error("Get tender details error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.addDocument = async (req, res) => {
  try {
    const { tender_id, document_name, document_type, file_url, uploaded_by } = req.body;

    const result = await pool.query(
      `
      INSERT INTO tender_documents
      (tender_id, document_name, document_type, file_url, uploaded_by)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [tender_id, document_name, document_type, file_url, uploaded_by]
    );

    res.status(201).json({
      success: true,
      document: result.rows[0],
    });
  } catch (error) {
    console.error("Add document error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.deleteDocument = async (req, res) => {
  try {
    const { documentId } = req.params;

    const result = await pool.query(
      "DELETE FROM tender_documents WHERE id = $1 RETURNING *",
      [documentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Document not found" });
    }

    res.status(200).json({
      success: true,
      message: "Document deleted successfully",
    });
  } catch (error) {
    console.error("Delete document error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.addMaterial = async (req, res) => {
  try {
    const {
      tender_id,
      section_name,
      material_name,
      quantity,
      unit,
      rate,
      notes,
    } = req.body;

    const totalAmount = Number(quantity || 0) * Number(rate || 0);

    const result = await pool.query(
      `
      INSERT INTO tender_materials
      (tender_id, section_name, material_name, quantity, unit, rate, total_amount, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
      `,
      [tender_id, section_name, material_name, quantity, unit, rate, totalAmount, notes]
    );

    res.status(201).json({
      success: true,
      material: result.rows[0],
    });
  } catch (error) {
    console.error("Add material error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.deleteMaterial = async (req, res) => {
  try {
    const { materialId } = req.params;

    const result = await pool.query(
      "DELETE FROM tender_materials WHERE id = $1 RETURNING *",
      [materialId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Material not found" });
    }

    res.status(200).json({
      success: true,
      message: "Material deleted successfully",
    });
  } catch (error) {
    console.error("Delete material error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.addBanking = async (req, res) => {
  try {
    const {
      tender_id,
      payment_type,
      bank_name,
      account_name,
      account_number,
      amount,
      gst_amount,
      notes,
      payment_date,
    } = req.body;

    const result = await pool.query(
      `
      INSERT INTO tender_banking
      (tender_id, payment_type, bank_name, account_name, account_number, amount, gst_amount, notes, payment_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
      `,
      [
        tender_id,
        payment_type,
        bank_name,
        account_name,
        account_number,
        amount,
        gst_amount,
        notes,
        payment_date,
      ]
    );

    res.status(201).json({
      success: true,
      banking: result.rows[0],
    });
  } catch (error) {
    console.error("Add banking error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.deleteBanking = async (req, res) => {
  try {
    const { bankingId } = req.params;

    const result = await pool.query(
      "DELETE FROM tender_banking WHERE id = $1 RETURNING *",
      [bankingId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Banking entry not found" });
    }

    res.status(200).json({
      success: true,
      message: "Banking entry deleted successfully",
    });
  } catch (error) {
    console.error("Delete banking error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.assignSubcontractor = async (req, res) => {
  try {
    const {
      tender_id,
      subcontractor_id,
      work_description,
      assigned_amount,
      status,
    } = req.body;

    const result = await pool.query(
      `
      INSERT INTO tender_subcontractors
      (tender_id, subcontractor_id, work_description, assigned_amount, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [tender_id, subcontractor_id, work_description, assigned_amount, status || "active"]
    );

    res.status(201).json({
      success: true,
      tenderSubcontractor: result.rows[0],
    });
  } catch (error) {
    console.error("Assign subcontractor error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.removeSubcontractor = async (req, res) => {
  try {
    const { tenderSubcontractorId } = req.params;

    const result = await pool.query(
      "DELETE FROM tender_subcontractors WHERE id = $1 RETURNING *",
      [tenderSubcontractorId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Tender subcontractor not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Subcontractor removed from tender successfully",
    });
  } catch (error) {
    console.error("Remove subcontractor error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};