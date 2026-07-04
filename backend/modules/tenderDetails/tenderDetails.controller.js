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
      AND COALESCE(t.is_deleted, FALSE) = FALSE
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
      `
      SELECT *
      FROM tender_documents
      WHERE tender_id = $1
      AND COALESCE(is_deleted, FALSE) = FALSE
      ORDER BY id DESC
      `,
      [id]
    );

    const materials = await pool.query(
      `
      SELECT *
      FROM tender_materials
      WHERE tender_id = $1
      AND COALESCE(is_deleted, FALSE) = FALSE
      ORDER BY id DESC
      `,
      [id]
    );

    const banking = await pool.query(
      `
      SELECT *
      FROM tender_banking
      WHERE tender_id = $1
      AND COALESCE(is_deleted, FALSE) = FALSE
      ORDER BY id DESC
      `,
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
      AND COALESCE(ts.is_deleted, FALSE) = FALSE
      ORDER BY ts.id DESC
      `,
      [id]
    );

    const dailyUpdates = await pool.query(
      `
      SELECT 
        dsl.*,
        w.full_name AS worker_name,
        sc.full_name AS subcontractor_name
      FROM daily_site_logs dsl
      LEFT JOIN workers w ON dsl.worker_id = w.id
      LEFT JOIN subcontractors sc ON dsl.subcontractor_id = sc.id
      WHERE dsl.tender_id = $1
      AND COALESCE(dsl.is_deleted, FALSE) = FALSE
      ORDER BY dsl.log_date DESC, dsl.id DESC
      `,
      [id]
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
    const {
      tender_id,
      document_name,
      document_type = "PDF",
      file_url,
    } = req.body;

    if (!tender_id || !document_name) {
      return res.status(400).json({
        success: false,
        message: "Tender and document name are required.",
      });
    }

    const uploadedBy = req.user?.id || null;

    const result = await pool.query(
      `
      INSERT INTO tender_documents
      (
        tender_id,
        document_name,
        document_type,
        file_url,
        uploaded_by,
        uploaded_by_type,
        is_deleted
      )
      VALUES ($1, $2, $3, $4, $5, 'admin', FALSE)
      RETURNING *
      `,
      [
        tender_id,
        document_name,
        document_type,
        file_url || null,
        uploadedBy,
      ]
    );

    res.status(201).json({
      success: true,
      document: result.rows[0],
    });
  } catch (error) {
    console.error("Add document error:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  }
};

exports.deleteDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    const deletedBy = req.user?.id || null;

    const result = await pool.query(
      `
      UPDATE tender_documents
      SET is_deleted = TRUE,
          deleted_at = NOW(),
          deleted_by = $2
      WHERE id = $1
      AND COALESCE(is_deleted, FALSE) = FALSE
      RETURNING *
      `,
      [documentId, deletedBy]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Document not found",
      });
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
      quantity = 0,
      unit,
      rate = 0,
      vendor_name,
      notes,
    } = req.body;

    if (!tender_id || !section_name || !material_name) {
      return res.status(400).json({
        success: false,
        message: "Tender, section and material name are required.",
      });
    }

    const totalAmount = Number(quantity || 0) * Number(rate || 0);

    const result = await pool.query(
      `
      INSERT INTO tender_materials
      (
        tender_id,
        section_name,
        material_name,
        quantity,
        unit,
        rate,
        total_amount,
        vendor_name,
        notes,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
      `,
      [
        tender_id,
        section_name,
        material_name,
        Number(quantity || 0),
        unit || null,
        Number(rate || 0),
        totalAmount,
        vendor_name || null,
        notes || null,
        req.user?.id || null,
      ]
    );

    res.status(201).json({
      success: true,
      material: result.rows[0],
    });
  } catch (error) {
    console.error("Add material error:", error);
    res.status(500).json({ success: false, message: error.message || "Server error" });
  }
};

exports.deleteMaterial = async (req, res) => {
  try {
    const { materialId } = req.params;
    const deletedBy = req.user?.id || null;

    const result = await pool.query(
      `
      UPDATE tender_materials
      SET is_deleted = TRUE,
          deleted_at = NOW(),
          deleted_by = $2
      WHERE id = $1
      AND COALESCE(is_deleted, FALSE) = FALSE
      RETURNING *
      `,
      [materialId, deletedBy]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Material not found",
      });
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
      amount = 0,
      gst_amount = 0,
      notes,
      payment_date,
      approval_status = "approved",
    } = req.body;

    if (!tender_id || !payment_type || !amount) {
      return res.status(400).json({
        success: false,
        message: "Tender, payment type and amount are required.",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO tender_banking
      (
        tender_id,
        payment_type,
        bank_name,
        account_name,
        account_number,
        amount,
        gst_amount,
        notes,
        payment_date,
        approval_status,
        created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
      `,
      [
        tender_id,
        payment_type,
        bank_name || null,
        account_name || null,
        account_number || null,
        Number(amount || 0),
        Number(gst_amount || 0),
        notes || null,
        payment_date || null,
        approval_status,
        req.user?.id || null,
      ]
    );

    res.status(201).json({
      success: true,
      banking: result.rows[0],
    });
  } catch (error) {
    console.error("Add banking error:", error);
    res.status(500).json({ success: false, message: error.message || "Server error" });
  }
};

exports.deleteBanking = async (req, res) => {
  try {
    const { bankingId } = req.params;
    const deletedBy = req.user?.id || null;

    const result = await pool.query(
      `
      UPDATE tender_banking
      SET is_deleted = TRUE,
          deleted_at = NOW(),
          deleted_by = $2
      WHERE id = $1
      AND COALESCE(is_deleted, FALSE) = FALSE
      RETURNING *
      `,
      [bankingId, deletedBy]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Banking entry not found",
      });
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
      assigned_amount = 0,
      status = "active",
    } = req.body;

    if (!tender_id || !subcontractor_id) {
      return res.status(400).json({
        success: false,
        message: "Tender and subcontractor are required.",
      });
    }

    const existing = await pool.query(
      `
      SELECT id
      FROM tender_subcontractors
      WHERE tender_id = $1
      AND subcontractor_id = $2
      AND COALESCE(is_deleted, FALSE) = FALSE
      `,
      [tender_id, subcontractor_id]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Subcontractor is already assigned to this tender.",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO tender_subcontractors
      (
        tender_id,
        subcontractor_id,
        work_description,
        assigned_amount,
        status,
        assigned_by,
        is_deleted
      )
      VALUES ($1, $2, $3, $4, $5, $6, FALSE)
      RETURNING *
      `,
      [
        tender_id,
        subcontractor_id,
        work_description || "",
        Number(assigned_amount || 0),
        status,
        req.user?.id || null,
      ]
    );

    res.status(201).json({
      success: true,
      tenderSubcontractor: result.rows[0],
    });
  } catch (error) {
    console.error("Assign subcontractor error:", error);
    res.status(500).json({ success: false, message: error.message || "Server error" });
  }
};

exports.updateTenderSubcontractor = async (req, res) => {
  try {
    const { tenderSubcontractorId } = req.params;

    const {
      work_description,
      assigned_amount = 0,
      status = "active",
    } = req.body;

    const result = await pool.query(
      `
      UPDATE tender_subcontractors
      SET work_description = $1,
          assigned_amount = $2,
          status = $3,
          updated_at = NOW()
      WHERE id = $4
      AND COALESCE(is_deleted, FALSE) = FALSE
      RETURNING *
      `,
      [
        work_description || "",
        Number(assigned_amount || 0),
        status,
        tenderSubcontractorId,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Assigned subcontractor not found",
      });
    }

    res.status(200).json({
      success: true,
      tenderSubcontractor: result.rows[0],
    });
  } catch (error) {
    console.error("Update assigned subcontractor error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.removeSubcontractor = async (req, res) => {
  try {
    const { tenderSubcontractorId } = req.params;
    const deletedBy = req.user?.id || null;

    const result = await pool.query(
      `
      UPDATE tender_subcontractors
      SET is_deleted = TRUE,
          deleted_at = NOW(),
          deleted_by = $2,
          updated_at = NOW()
      WHERE id = $1
      AND COALESCE(is_deleted, FALSE) = FALSE
      RETURNING *
      `,
      [tenderSubcontractorId, deletedBy]
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