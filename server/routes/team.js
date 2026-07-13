const express = require("express");
const { db } = require("../db");
const { requireAuth } = require("../auth");

const router = express.Router();
const s = (v) => String(v ?? "").trim();
const validStatus = (x) => (["online", "offline", "atwork"].includes(x) ? x : "online");

// DB row -> API shape consumed by main.js and admin.js
function shape(row) {
  return {
    id: row.id, code: row.code, isBuiltin: !!row.is_builtin,
    name: { en: row.name_en, uk: row.name_uk },
    role: { en: row.role_en, uk: row.role_uk },
    location: { en: row.location_en, uk: row.location_uk },
    bio: { en: row.bio_en, uk: row.bio_uk },
    status: row.status,
    skills: JSON.parse(row.skills || "[]"),
    photo: row.photo_url,
  };
}
const normSkills = (arr) => (Array.isArray(arr) ? arr : []).map((k) => {
  const label = s(k.name || k.label || "").toUpperCase();
  return { label_en: label, label_uk: label, level: Math.max(0, Math.min(10, +k.level || 0)) };
}).filter((k) => k.label_en);

// public: full team, ordered
router.get("/", (_req, res) => {
  res.json(db.prepare("SELECT * FROM team_members ORDER BY sort_order ASC, rowid ASC").all().map(shape));
});

// admin: add a partner (single-language input -> stored in both en/uk)
router.post("/", requireAuth, (req, res) => {
  const b = req.body || {};
  const name = s(b.name) || "PARTNER";
  const role = s(b.role) || "PARTNER";
  const loc = s(b.location) || "—";
  const count = db.prepare("SELECT COUNT(*) AS n FROM team_members").get().n;
  const maxOrder = db.prepare("SELECT COALESCE(MAX(sort_order),-1) AS m FROM team_members").get().m;
  const row = {
    id: "p-" + Date.now().toString(36), sort_order: maxOrder + 1, is_builtin: 0,
    code: "#SV-" + String(count + 1).padStart(3, "0"),
    name_en: name, name_uk: name, role_en: role, role_uk: role,
    location_en: loc, location_uk: loc, bio_en: s(b.bio), bio_uk: s(b.bio),
    status: validStatus(b.status), skills: JSON.stringify(normSkills(b.skills)), photo_url: s(b.photo),
  };
  db.prepare(`INSERT INTO team_members
    (id,sort_order,is_builtin,code,name_en,name_uk,role_en,role_uk,location_en,location_uk,bio_en,bio_uk,status,skills,photo_url)
    VALUES (:id,:sort_order,:is_builtin,:code,:name_en,:name_uk,:role_en,:role_uk,:location_en,:location_uk,:bio_en,:bio_uk,:status,:skills,:photo_url)`).run(row);
  res.status(201).json({ ok: true, id: row.id });
});

// admin: edit a member. For built-ins we only overwrite a language pair when
// the incoming value actually changed from the current EN, so hand-authored
// Ukrainian translations survive an edit that didn't touch that field.
router.put("/:id", requireAuth, (req, res) => {
  const cur = db.prepare("SELECT * FROM team_members WHERE id = ?").get(req.params.id);
  if (!cur) return res.status(404).json({ error: "member not found" });
  const b = req.body || {};
  const fields = {};

  ["name", "role", "location", "bio"].forEach((key) => {
    if (b[key] == null) return;
    const val = s(b[key]);
    if (val === cur[key + "_en"]) return;         // unchanged -> keep bilingual
    fields[key + "_en"] = val; fields[key + "_uk"] = val;
  });
  if (b.status != null) fields.status = validStatus(b.status);
  if (b.skills != null) {
    const next = normSkills(b.skills);
    const curSimple = JSON.parse(cur.skills || "[]").map((k) => ({ name: k.label_en, level: k.level }));
    const nextSimple = next.map((k) => ({ name: k.label_en, level: k.level }));
    if (JSON.stringify(curSimple) !== JSON.stringify(nextSimple)) fields.skills = JSON.stringify(next);
  }
  if (b.photo != null && s(b.photo) !== "") fields.photo_url = s(b.photo);

  const keys = Object.keys(fields);
  if (keys.length) {
    const setSql = keys.map((k) => `${k} = :${k}`).join(", ");
    db.prepare(`UPDATE team_members SET ${setSql} WHERE id = :id`).run({ ...fields, id: req.params.id });
  }
  res.json({ ok: true });
});

// admin: quick status change
router.patch("/:id/status", requireAuth, (req, res) => {
  const cur = db.prepare("SELECT id FROM team_members WHERE id = ?").get(req.params.id);
  if (!cur) return res.status(404).json({ error: "member not found" });
  db.prepare("UPDATE team_members SET status = ? WHERE id = ?").run(validStatus((req.body || {}).status), req.params.id);
  res.json({ ok: true });
});

// admin: delete an added partner (built-ins can't be removed)
router.delete("/:id", requireAuth, (req, res) => {
  const cur = db.prepare("SELECT is_builtin FROM team_members WHERE id = ?").get(req.params.id);
  if (!cur) return res.status(404).json({ error: "member not found" });
  if (cur.is_builtin) return res.status(400).json({ error: "built-in members can't be deleted" });
  db.prepare("DELETE FROM team_members WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
