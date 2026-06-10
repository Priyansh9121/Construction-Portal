const express = require("express");
const multer = require("multer");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

router.post("/", upload.single("photo"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const bucket = process.env.SUPABASE_BUCKET || "construction-files";

    const fileExt = path.extname(req.file.originalname);
    const fileName = `${Date.now()}-${Math.round(
      Math.random() * 1e9
    )}${fileExt}`;

    const filePath = `tender-documents/${fileName}`;

    const { error } = await supabase.storage
      .from(bucket)
      .upload(filePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (error) {
      return res.status(500).json({
        success: false,
        message: error.message,
      });
    }

    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    res.status(200).json({
      success: true,
      fileUrl: data.publicUrl,
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