/*
|==========================================================================
| FILE PURPOSE
|==========================================================================
|
| Multer configuration and file validation for /api/upload. Everything that
| decides whether a file is acceptable happens here, before the upload
| controller sees it.
|
| Responsibilities:
|   - Hold files in memory rather than on disk
|   - Enforce the size ceiling from config/env.js
|   - Accept only allow-listed MIME types, cross-checked against the
|     file extension
|
| Exports:
|   the configured multer middleware — see the foot of the file
|
| Used by:
|   ./upload.routes.js, in front of upload.controller.js
|
| Depends on:
|   multer
|   config/env.js — MAX_UPLOAD_SIZE_BYTES, MAX_UPLOAD_SIZE_MB
|
| Database tables touched:
|   none. This layer never reaches the database.
|
| Security — this is a security boundary, and worth reading as one:
|
|   MIME type alone is not trustworthy. It is supplied by the client and
|   can say anything, which is why MIME_EXTENSION_MAP cross-checks it
|   against the filename extension: a file claiming to be a PDF but named
|   .exe is rejected. Neither check alone would be sufficient.
|
|   The size limit bounds memory use. Files are buffered in memory rather
|   than written to disk, so an unbounded upload would be a direct route to
|   exhausting the process.
|
|   Memory storage also means no file is ever written to the server's
|   filesystem, which removes path traversal as a category — there is no
|   path to traverse. The buffer goes straight to Supabase Storage.
|
| Note:
|   The upload endpoint is open to every authenticated role, because a
|   supervisor photographing a docket and a subcontractor attaching a
|   document are both legitimate. The controls are these, plus the folder
|   allow-list in config/env.js.
|
*/

const multer = require("multer");

const {
  MAX_UPLOAD_SIZE_BYTES,
  MAX_UPLOAD_SIZE_MB,
} = require("../../config/env");

const MIME_EXTENSION_MAP = Object.freeze({
  "application/pdf": [".pdf"],

  "application/msword": [
    ".doc",
  ],

  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    [".docx"],

  "application/vnd.ms-excel": [
    ".xls",
  ],

  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    [".xlsx"],

  "text/csv": [
    ".csv",
  ],

  "text/plain": [
    ".txt",
  ],

  "application/json": [
    ".json",
  ],

  "image/jpeg": [
    ".jpg",
    ".jpeg",
  ],

  "image/png": [
    ".png",
  ],

  "image/webp": [
    ".webp",
  ],

  "image/heic": [
    ".heic",
  ],

  "image/heif": [
    ".heif",
  ],

  "image/svg+xml": [
    ".svg",
  ],

  "application/zip": [
    ".zip",
  ],

  "application/x-zip-compressed": [
    ".zip",
  ],

  "model/gltf+json": [
    ".gltf",
  ],

  "model/gltf-binary": [
    ".glb",
  ],

  "application/octet-stream": [
    ".glb",
  ],
});

const ALLOWED_MIME_TYPES =
  new Set(
    Object.keys(
      MIME_EXTENSION_MAP
    )
  );

/**
 * Extracts the lowercase file extension.
 */
const getFileExtension = (
  fileName
) => {
  if (
    typeof fileName !==
    "string"
  ) {
    return "";
  }

  const lastDotIndex =
    fileName.lastIndexOf(".");

  if (
    lastDotIndex <= 0 ||
    lastDotIndex ===
      fileName.length - 1
  ) {
    return "";
  }

  return fileName
    .slice(lastDotIndex)
    .toLowerCase();
};

/**
 * Prevents dangerous or misleading filenames.
 */
const hasUnsafeFileName = (
  fileName
) => {
  if (
    typeof fileName !==
      "string" ||
    !fileName.trim()
  ) {
    return true;
  }

  return (
    fileName.includes("\0") ||
    fileName.includes("/") ||
    fileName.includes("\\") ||
    fileName.includes("..")
  );
};

/**
 * Validates that the filename extension matches the reported
 * MIME type.
 */
const extensionMatchesMimeType = (
  file
) => {
  const extension =
    getFileExtension(
      file.originalname
    );

  const allowedExtensions =
    MIME_EXTENSION_MAP[
      file.mimetype
    ];

  if (
    !Array.isArray(
      allowedExtensions
    )
  ) {
    return false;
  }

  return allowedExtensions.includes(
    extension
  );
};

/**
 * Multer file validation.
 *
 * This is not antivirus scanning, but it blocks unsupported
 * MIME types, unsafe names and obvious extension mismatches.
 */
const fileFilter = (
  req,
  file,
  callback
) => {
  if (
    hasUnsafeFileName(
      file.originalname
    )
  ) {
    const error = new Error(
      "The uploaded filename is invalid."
    );

    error.statusCode = 400;
    error.code =
      "INVALID_FILE_NAME";

    return callback(
      error,
      false
    );
  }

  if (
    !ALLOWED_MIME_TYPES.has(
      file.mimetype
    )
  ) {
    const error = new Error(
      `Unsupported file type: ${file.mimetype}`
    );

    error.statusCode = 415;
    error.code =
      "UNSUPPORTED_FILE_TYPE";

    return callback(
      error,
      false
    );
  }

  if (
    !extensionMatchesMimeType(
      file
    )
  ) {
    const error = new Error(
      "The file extension does not match its reported file type."
    );

    error.statusCode = 400;
    error.code =
      "FILE_TYPE_MISMATCH";

    return callback(
      error,
      false
    );
  }

  return callback(
    null,
    true
  );
};

const upload = multer({
  storage:
    multer.memoryStorage(),

  limits: {
    fileSize:
      MAX_UPLOAD_SIZE_BYTES,

    files: 1,

    fields: 20,

    fieldNameSize: 100,

    fieldSize:
      1024 * 1024,
  },

  fileFilter,
});

/**
 * Handles one uploaded file from the multipart field named "file".
 */
const uploadSingleFile =
  upload.single("file");

/**
 * Converts Multer-specific errors into normal application errors
 * handled by the global Express error handler.
 */
const handleUploadErrors = (
  error,
  req,
  res,
  next
) => {
  if (!error) {
    return next();
  }

  if (
    error instanceof
    multer.MulterError
  ) {
    switch (error.code) {
      case "LIMIT_FILE_SIZE":
        error.statusCode =
          413;

        error.publicMessage =
          `The file must be smaller than ${MAX_UPLOAD_SIZE_MB} MB.`;
        break;

      case "LIMIT_FILE_COUNT":
        error.statusCode =
          400;

        error.publicMessage =
          "Only one file can be uploaded at a time.";
        break;

      case "LIMIT_UNEXPECTED_FILE":
        error.statusCode =
          400;

        error.publicMessage =
          'Use the multipart field name "file".';
        break;

      case "LIMIT_FIELD_COUNT":
      case "LIMIT_FIELD_KEY":
      case "LIMIT_FIELD_VALUE":
        error.statusCode =
          400;

        error.publicMessage =
          "The upload form contains too much metadata.";
        break;

      default:
        error.statusCode =
          400;

        error.publicMessage =
          "The file upload request is invalid.";
    }
  }

  return next(error);
};

/**
 * Express middleware array for upload routes.
 *
 * Usage:
 *
 * router.post(
 *   "/",
 *   ...singleFileUpload,
 *   asyncHandler(controller.uploadFile)
 * );
 */
const singleFileUpload = [
  uploadSingleFile,
  handleUploadErrors,
];

module.exports = {
  singleFileUpload,
  uploadSingleFile,
  handleUploadErrors,

  getFileExtension,
  ALLOWED_MIME_TYPES,
  MIME_EXTENSION_MAP,
};