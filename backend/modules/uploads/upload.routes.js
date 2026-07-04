const express = require("express");
const multer = require("multer");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const allowedFolders = [
  "tender-documents",
  "worker-updates",
  "subcontractor-updates",
  "worker-expenses",
  "invoices",
  "reports",
  "general",
];

router.post("/", upload.single("file"), async (req, res) => {
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({
        success: false,
        message: "Supabase storage is not configured.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const requestedFolder = req.body.folder || req.query.folder || "general";
    const folder = allowedFolders.includes(requestedFolder)
      ? requestedFolder
      : "general";

    const bucket = process.env.SUPABASE_BUCKET || "construction-files";
    const fileExt = path.extname(req.file.originalname);
    const safeName = path
      .basename(req.file.originalname, fileExt)
      .replace(/[^a-zA-Z0-9-_]/g, "-");

    const fileName = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${safeName}${fileExt}`;
    const filePath = `${folder}/${fileName}`;

    const { error } = await supabase.storage.from(bucket).upload(filePath, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: false,
    });

    if (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);

    res.status(200).json({
      success: true,
      fileUrl: data.publicUrl,
      filePath,
      folder,
    });
  } catch (error) {
    console.error("Supabase upload error:", error);
    res.status(500).json({
      success: false,
      message: "File upload failed",
    });
  }
});

module.exports = router;