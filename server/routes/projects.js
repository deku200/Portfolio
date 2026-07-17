const express = require("express");
const { db } = require("../db");
const { requireAuth } = require("../auth");

const router = express.Router();
const s = (v) => String(v ?? "").trim();

// The project link renders into an <a href> on the public site. Only permit
// http(s) (or an empty string) so a stored `javascript:`/`data:` URI can't turn
// into XSS if an admin account is ever misused.
const safeUrl = (v) => {
  const t = s(v);
  if (t === "") return "";
  return /^https?:\/\//i.test(t) ? t : "";
};

function shape(row) {
  return {
    id: row.id, title: row.title, caseLabel: row.case_label, status: row.status,
    tags: row.tags, link: row.link, image: row.image_url,
    desc: { en: row.desc_en, uk: row.desc_uk },
  };
}

// public: the three case files
router.get("/", (_req, res) => {
  res.json(db.prepare("SELECT * FROM projects ORDER BY id ASC").all().map(shape));
});

// admin: edit a project (only provided fields change)
router.put("/:id", requireAuth, (req, res) => {
  const id = +req.params.id;
  const cur = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
  if (!cur) return res.status(404).json({ error: "project not found" });
  const b = req.body || {};
  const map = {
    title: "title", caseLabel: "case_label", status: "status",
    tags: "tags", link: "link", image: "image_url", descEn: "desc_en", descUk: "desc_uk",
  };
  const fields = {};
  for (const [inKey, col] of Object.entries(map)) {
    if (b[inKey] != null) fields[col] = inKey === "link" ? safeUrl(b[inKey]) : s(b[inKey]);
  }
  const keys = Object.keys(fields);
  if (keys.length) {
    const setSql = keys.map((k) => `${k} = :${k}`).join(", ");
    db.prepare(`UPDATE projects SET ${setSql} WHERE id = :id`).run({ ...fields, id });
  }
  res.json({ ok: true });
});

module.exports = router;
