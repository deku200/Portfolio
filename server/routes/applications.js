const express = require("express");
const { db } = require("../db");
const { requireAuth } = require("../auth");

const router = express.Router();
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const clean = (v, max) => String(v ?? "").trim().slice(0, max);

// public: submit an application (contact form)
router.post("/", (req, res) => {
  const b = req.body || {};
  const name = clean(b.name, 200), email = clean(b.email, 200), message = clean(b.message, 5000);
  if (!name || !email || !message) return res.status(400).json({ error: "name, email and message are required" });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: "invalid email address" });

  const row = {
    id: genId(), name, email, message,
    budget: clean(b.budget, 100), source: clean(b.source, 200),
    created_at: new Date().toISOString(),
  };
  db.prepare(`INSERT INTO applications (id,name,email,budget,source,message,created_at)
    VALUES (:id,:name,:email,:budget,:source,:message,:created_at)`).run(row);
  res.status(201).json({ ok: true });
});

// admin: list newest first
router.get("/", requireAuth, (_req, res) => {
  res.json(db.prepare("SELECT * FROM applications ORDER BY created_at DESC").all());
});

// admin: delete one / all
router.delete("/:id", requireAuth, (req, res) => {
  db.prepare("DELETE FROM applications WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});
router.delete("/", requireAuth, (_req, res) => {
  db.prepare("DELETE FROM applications").run();
  res.json({ ok: true });
});

module.exports = router;
