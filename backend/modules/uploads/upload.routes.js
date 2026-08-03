/*
| FILE PURPOSE
|
| URL map for /api/upload — file upload to Supabase Storage.
|
| Mounted by server.js behind authMiddleware with NO role gate. Every role
| legitimately uploads: a supervisor photographs a docket, a subcontractor
| attaches a document, the office adds a contract.
|
| The controls are therefore not role-based. They are:
|   upload.middleware.js  size ceiling, MIME allow-list cross-checked
|                         against the file extension, memory storage
|   config/env.js         ALLOWED_UPLOAD_FOLDERS
|
| Depends on: ./upload.controller.js, ./upload.middleware.js,
|             utils/asyncHandler.js
| Tables: none — an upload returns a URL; storing it is the caller's job
| Frontend: uploadService.js, used by the document tabs, the daily update
|           form and the receipt fields
*/

const express = require("express");

const asyncHandler = require("../../utils/asyncHandler");

const {
  singleFileUpload,
} = require("./upload.middleware");

const uploadController = require("./upload.controller");

const router = express.Router();

/**
 * GET /api/upload
 *
 * Optional query parameters:
 *
 * module
 * record_id
 */
router.get(
  "/",
  asyncHandler(
    uploadController.getFiles
  )
);

/**
 * GET /api/upload/:id
 */
router.get(
  "/:id",
  asyncHandler(
    uploadController.getFileById
  )
);

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
router.post(
  "/",
  ...singleFileUpload,
  asyncHandler(
    uploadController.uploadFile
  )
);

/**
 * DELETE /api/upload/:id
 */
router.delete(
  "/:id",
  asyncHandler(
    uploadController.deleteFile
  )
);

module.exports = router;