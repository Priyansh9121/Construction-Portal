/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| File upload to Supabase Storage. Takes the buffer multer produced, puts
| it in the bucket, and returns the URL for a caller to store on a record.
|
| Nothing here writes to the database. An upload produces a URL; attaching
| that URL to a tender document, a site log or a receipt is the job of
| whichever module owns that record.
|
| Responsibilities:
|   - Accept a validated file from upload.middleware
|   - Choose a storage path within an allow-listed folder
|   - Upload to Supabase and return the public URL
|   - Delete a previously uploaded object
|
| Exports:
|   see module.exports at the foot of the file
|
| Used by:
|   ./upload.routes.js, mounted at /api/upload
|
| Depends on:
|   config/supabase.js — the storage client
|   config/env.js      — SUPABASE_BUCKET, ALLOWED_UPLOAD_FOLDERS,
|                        STORAGE_CONFIGURED
|   utils/asyncHandler.js, utils/requestContext.js
|
| Database tables touched:
|   none.
|
| API surface:
|   /api/upload, open to every authenticated role. That is deliberate — a
|   supervisor photographs a delivery docket, a subcontractor attaches a
|   document — and the controls are the folder allow-list here plus the
|   size and MIME checks in upload.middleware.js.
|
| Frontend consumers:
|   uploadService.js, used by the document tabs, the daily update form and
|   the receipt fields.
|
| Security:
|   The folder allow-list is what stops a caller writing anywhere in the
|   bucket. Filenames are generated rather than taken from the client, so
|   a name like "../../secret" cannot escape its folder.
|
|   Uploaded objects are NOT removed when the record referencing them is
|   deleted — a soft-deleted tender document leaves its file in the bucket,
|   still reachable by anyone holding the URL. Noted on the documents
|   section of tenderQueries.js.
|
| Note:
|   Storage is optional. When SUPABASE_* is unconfigured the readiness
|   probe reports "degraded" rather than "unhealthy", and these endpoints
|   fail while the rest of the application continues to work.
|
*/

const crypto = require("crypto");
const path = require("path");

const pool = require("../../database/pool");

const {
  SUPABASE_BUCKET,
  ALLOWED_UPLOAD_FOLDERS,
} = require("../../config/env");

const {
  uploadStorageFile,
  deleteStorageFiles,
} = require("../../config/supabase");

const {
  requireCompanyId,
  getUserId,
  toPositiveInteger,
  cleanText,
} = require("../../utils/requestContext");

const {
  FILE_MODULES,
} = require("../../config/constants");

const ALLOWED_MODULES = new Set(
  Object.values(FILE_MODULES)
);

/**
 * Converts a filename into a safe storage filename.
 *
 * The original filename is not stored separately in the current
 * database schema, so file_name keeps the readable safe version.
 */
const sanitiseFileName = (fileName) => {
  const parsed = path.parse(
    String(fileName || "")
  );

  const safeBaseName = parsed.name
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "")
    .slice(0, 120);

  const safeExtension = parsed.ext
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, "")
    .slice(0, 15);

  return `${
    safeBaseName || "file"
  }${safeExtension}`;
};

/**
 * Prevents storage path traversal and malformed folder names.
 */
const sanitiseFolder = (folder) => {
  const cleaned = cleanText(folder)
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "");

  if (
    !cleaned ||
    !ALLOWED_UPLOAD_FOLDERS.includes(
      cleaned
    )
  ) {
    return null;
  }

  return cleaned;
};

/**
 * Builds a unique and company-isolated storage path.
 */
const buildStoragePath = ({
  companyId,
  folder,
  module,
  recordId,
  fileName,
}) => {
  const timestamp = Date.now();

  const randomPart = crypto
    .randomBytes(8)
    .toString("hex");

  const recordSegment = recordId
    ? `records/${recordId}`
    : "unlinked";

  return [
    `companies/${companyId}`,
    folder,
    module,
    recordSegment,
    `${timestamp}-${randomPart}-${fileName}`,
  ].join("/");
};

/**
 * Calculates a SHA-256 checksum for duplicate and integrity checks.
 */
const calculateChecksum = (buffer) =>
  crypto
    .createHash("sha256")
    .update(buffer)
    .digest("hex");

/**
 * Confirms the selected record belongs to the current company.
 *
 * Only modules backed by known company-owned records are accepted.
 */
const verifyModuleRecord = async ({
  companyId,
  module,
  recordId,
}) => {
  if (!recordId) {
    return true;
  }

  const moduleQueries = {
    tender: {
      table: "tenders",
      companyColumn: "company_id",
    },

    site: {
      table: "sites",
      companyColumn: "company_id",
    },

    worker: {
      table: "workers",
      companyColumn: "company_id",
    },

    subcontractor: {
      table: "subcontractors",
      companyColumn: "company_id",
    },

    invoice: {
      table: "invoices",
      companyColumn: "company_id",
    },

    daily_update: {
      table: "daily_site_logs",
      companyColumn: "company_id",
    },

    inspection: {
      table: "site_inspections",
      companyColumn: "company_id",
    },

    model: {
      table: "site_3d_models",
      companyColumn: "company_id",
    },
  };

  const definition =
    moduleQueries[module];

  if (!definition) {
    return false;
  }

  const result = await pool.query(
    `
    SELECT id
    FROM public.${definition.table}
    WHERE id = $1
      AND ${definition.companyColumn} = $2
      AND COALESCE(is_deleted, FALSE) = FALSE
    LIMIT 1
    `,
    [recordId, companyId]
  );

  return result.rows.length > 0;
};

/**
 * POST /api/upload
 *
 * Multipart fields:
 *
 * file      required
 * folder    required
 * module    required
 * record_id optional
 */
exports.uploadFile = async (
  req,
  res
) => {
  const companyId =
    requireCompanyId(req, res);

  if (!companyId) {
    return;
  }

  const uploadedBy =
    getUserId(req);

  if (!req.file) {
    return res.status(400).json({
      success: false,
      message:
        "Select a file to upload.",
    });
  }

  const folder =
    sanitiseFolder(req.body.folder);

  if (!folder) {
    return res.status(400).json({
      success: false,
      message:
        "Select a valid upload folder.",
    });
  }

  const moduleName = cleanText(
    req.body.module
  ).toLowerCase();

  if (
    !ALLOWED_MODULES.has(
      moduleName
    )
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Select a valid file module.",
    });
  }

  const rawRecordId =
    req.body.record_id;

  const recordId =
    rawRecordId === undefined ||
    rawRecordId === null ||
    rawRecordId === ""
      ? null
      : toPositiveInteger(
          rawRecordId
        );

  if (
    rawRecordId &&
    !recordId
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Invalid related record ID.",
    });
  }

  const recordIsValid =
    await verifyModuleRecord({
      companyId,
      module: moduleName,
      recordId,
    });

  if (!recordIsValid) {
    return res.status(404).json({
      success: false,
      message:
        "The related record was not found in your company.",
    });
  }

  const safeFileName =
    sanitiseFileName(
      req.file.originalname
    );

  const checksum =
    calculateChecksum(
      req.file.buffer
    );

  /*
   * Prevent uploading the same file repeatedly to the same module
   * and record while the previous file is active.
   */
  const duplicateResult =
    await pool.query(
      `
      SELECT
        id,
        file_name,
        file_url
      FROM public.files
      WHERE company_id = $1
        AND module = $2
        AND record_id IS NOT DISTINCT FROM $3
        AND checksum = $4
        AND COALESCE(is_deleted, FALSE) = FALSE
      LIMIT 1
      `,
      [
        companyId,
        moduleName,
        recordId,
        checksum,
      ]
    );

  if (
    duplicateResult.rows.length >
    0
  ) {
    return res.status(409).json({
      success: false,
      message:
        "This file has already been uploaded for the selected record.",
      file:
        duplicateResult.rows[0],
    });
  }

  const storagePath =
    buildStoragePath({
      companyId,
      folder,
      module: moduleName,
      recordId,
      fileName: safeFileName,
    });

  let uploadedFile = null;

  try {
    uploadedFile =
      await uploadStorageFile({
        filePath: storagePath,
        buffer: req.file.buffer,
        contentType:
          req.file.mimetype,
        upsert: false,
      });

    const result =
      await pool.query(
        `
        INSERT INTO public.files
        (
          company_id,
          uploaded_by,
          module,
          record_id,
          file_name,
          storage_bucket,
          storage_path,
          file_url,
          mime_type,
          size_bytes,
          checksum,
          is_deleted
        )
        VALUES
        (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, FALSE
        )
        RETURNING *
        `,
        [
          companyId,
          uploadedBy,
          moduleName,
          recordId,
          safeFileName,
          SUPABASE_BUCKET,
          uploadedFile.path ||
            storagePath,
          uploadedFile.publicUrl,
          req.file.mimetype,
          req.file.size,
          checksum,
        ]
      );

    return res.status(201).json({
      success: true,
      message:
        "File uploaded successfully.",
      file: result.rows[0],
    });
  } catch (error) {
    /*
     * If storage succeeded but the database insert failed,
     * remove the orphaned storage object.
     */
    if (
      uploadedFile?.path ||
      uploadedFile?.fullPath
    ) {
      try {
        await deleteStorageFiles(
          uploadedFile.path ||
            storagePath
        );
      } catch (
        cleanupError
      ) {
        console.error(
          "Failed to remove orphaned uploaded file:",
          cleanupError
        );
      }
    }

    throw error;
  }
};

/**
 * GET /api/upload
 *
 * Optional query parameters:
 *
 * module
 * record_id
 */
exports.getFiles = async (
  req,
  res
) => {
  const companyId =
    requireCompanyId(req, res);

  if (!companyId) {
    return;
  }

  const moduleName = cleanText(
    req.query.module
  ).toLowerCase();

  const recordId =
    req.query.record_id
      ? toPositiveInteger(
          req.query.record_id
        )
      : null;

  if (
    req.query.module &&
    !ALLOWED_MODULES.has(
      moduleName
    )
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Invalid file module.",
    });
  }

  if (
    req.query.record_id &&
    !recordId
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Invalid related record ID.",
    });
  }

  const result = await pool.query(
    `
    SELECT
      f.id,
      f.company_id,
      f.uploaded_by,
      f.module,
      f.record_id,
      f.file_name,
      f.storage_bucket,
      f.storage_path,
      f.file_url,
      f.mime_type,
      f.size_bytes,
      f.checksum,
      f.created_at,
      u.full_name AS uploaded_by_name
    FROM public.files f
    LEFT JOIN public.users u
      ON u.id = f.uploaded_by
    WHERE f.company_id = $1
      AND COALESCE(f.is_deleted, FALSE) = FALSE
      AND (
        $2::VARCHAR IS NULL
        OR f.module = $2
      )
      AND (
        $3::BIGINT IS NULL
        OR f.record_id = $3
      )
    ORDER BY f.created_at DESC, f.id DESC
    `,
    [
      companyId,
      moduleName || null,
      recordId,
    ]
  );

  return res.status(200).json({
    success: true,
    files: result.rows,
  });
};

/**
 * GET /api/upload/:id
 */
exports.getFileById = async (
  req,
  res
) => {
  const companyId =
    requireCompanyId(req, res);

  if (!companyId) {
    return;
  }

  const fileId =
    toPositiveInteger(
      req.params.id
    );

  if (!fileId) {
    return res.status(400).json({
      success: false,
      message:
        "Invalid file ID.",
    });
  }

  const result = await pool.query(
    `
    SELECT
      f.*,
      u.full_name AS uploaded_by_name
    FROM public.files f
    LEFT JOIN public.users u
      ON u.id = f.uploaded_by
    WHERE f.id = $1
      AND f.company_id = $2
      AND COALESCE(f.is_deleted, FALSE) = FALSE
    LIMIT 1
    `,
    [fileId, companyId]
  );

  if (
    result.rows.length === 0
  ) {
    return res.status(404).json({
      success: false,
      message:
        "File not found.",
    });
  }

  return res.status(200).json({
    success: true,
    file: result.rows[0],
  });
};

/**
 * DELETE /api/upload/:id
 *
 * Removes the object from Supabase Storage and soft-deletes
 * the PostgreSQL metadata row.
 */
exports.deleteFile = async (
  req,
  res
) => {
  const companyId =
    requireCompanyId(req, res);

  if (!companyId) {
    return;
  }

  const fileId =
    toPositiveInteger(
      req.params.id
    );

  if (!fileId) {
    return res.status(400).json({
      success: false,
      message:
        "Invalid file ID.",
    });
  }

  const fileResult =
    await pool.query(
      `
      SELECT *
      FROM public.files
      WHERE id = $1
        AND company_id = $2
        AND COALESCE(is_deleted, FALSE) = FALSE
      LIMIT 1
      `,
      [fileId, companyId]
    );

  if (
    fileResult.rows.length ===
    0
  ) {
    return res.status(404).json({
      success: false,
      message:
        "File not found.",
    });
  }

  const file =
    fileResult.rows[0];

  if (file.storage_path) {
    await deleteStorageFiles(
      file.storage_path
    );
  }

  const deleteResult =
    await pool.query(
      `
      UPDATE public.files
      SET is_deleted = TRUE
      WHERE id = $1
        AND company_id = $2
        AND COALESCE(is_deleted, FALSE) = FALSE
      RETURNING *
      `,
      [fileId, companyId]
    );

  return res.status(200).json({
    success: true,
    message:
      "File deleted successfully.",
    file:
      deleteResult.rows[0],
  });
};