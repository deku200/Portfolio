const express = require("express");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const { UPLOAD_DIR } = require("../db");
const { requireAuth } = require("../auth");

const router = express.Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = (path.extname(file.originalname || "") || ".jpg").toLowerCase();
    cb(null, Date.now().toString(36) + "-" + crypto.randomBytes(4).toString("hex") + ext);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error("only image files are allowed"));
  },
});

// admin: upload an image, returns its served URL
router.post("/", requireAuth, (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "no file uploaded" });
    res.status(201).json({ url: "/uploads/" + req.file.filename });
  });
});

module.exports = router;
