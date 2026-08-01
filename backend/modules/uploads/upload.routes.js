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