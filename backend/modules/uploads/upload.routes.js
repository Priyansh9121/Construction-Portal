const express = require("express");
const multer = require("multer");
const path = require("path");

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },

  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() + "-" + Math.round(Math.random() * 1e9);

    cb(null, uniqueName + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

router.post("/", upload.single("photo"), (req, res) => {
  res.status(200).json({
    success: true,
    fileUrl: `http://127.0.0.1:5051/uploads/${req.file.filename}`,
  });
});

module.exports = router;