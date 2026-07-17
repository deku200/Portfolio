const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { UPLOAD_DIR } = require("../db");
const { requireAuth } = require("../auth");

const router = express.Router();

// Allowlist of raster image types we accept. The extension is derived from the
// (server-verified) content, NOT from the user-supplied filename — that stops an
// admin (or anyone with a stolen session cookie) from planting a .svg or .html
// file that would execute script when served back from our own origin.
const MIME_EXT = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

// Magic-byte signatures — the real proof of file type. mimetype/extension are
// both attacker-controllable; the leading bytes are not.
function sniffMime(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return "image/gif";
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return "image/webp";
  return null;
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = MIME_EXT[file.mimetype] || ".bin"; // provisional; re-checked after write
    cb(null, Date.now().toString(36) + "-" + crypto.randomBytes(8).toString("hex") + ext);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 4 }, // 5 MB, single file
  fileFilter: (_req, file, cb) => {
    if (MIME_EXT[file.mimetype]) cb(null, true);
    else cb(new Error("only PNG, JPEG, WEBP or GIF images are allowed"));
  },
});

// admin: upload an image, returns its served URL
router.post("/", requireAuth, (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "no file uploaded" });

    // Verify the bytes actually match a known image type, and that the on-disk
    // extension matches those bytes. Anything else gets deleted, not served.
    const full = path.join(UPLOAD_DIR, req.file.filename);
    let realMime = null;
    try {
      const fd = fs.openSync(full, "r");
      const head = Buffer.alloc(12);
      fs.readSync(fd, head, 0, 12, 0);
      fs.closeSync(fd);
      realMime = sniffMime(head);
    } catch (_) { /* fall through to cleanup */ }

    const wantExt = realMime && MIME_EXT[realMime];
    if (!wantExt) {
      fs.unlink(full, () => {});
      return res.status(400).json({ error: "file is not a valid PNG/JPEG/WEBP/GIF image" });
    }
    // if the sniffed type disagrees with the provisional extension, rename to the truthful one
    let filename = req.file.filename;
    if (path.extname(filename).toLowerCase() !== wantExt) {
      const renamed = filename.replace(/\.[^.]+$/, "") + wantExt;
      try { fs.renameSync(full, path.join(UPLOAD_DIR, renamed)); filename = renamed; }
      catch (_) { fs.unlink(full, () => {}); return res.status(500).json({ error: "could not store file" }); }
    }
    res.status(201).json({ url: "/uploads/" + filename });
  });
});

module.exports = router;
