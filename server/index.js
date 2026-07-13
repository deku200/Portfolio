require("dotenv").config();
const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");

const { db, UPLOAD_DIR } = require("./db");
const { seed } = require("./seed");
const {
  verifyPassword, signToken, setAuthCookie, clearAuthCookie, requireAuth,
} = require("./auth");

seed(); // idempotent — inserts built-in team + projects on first run

const app = express();
const ROOT = path.join(__dirname, "..");        // the Portfolio folder (static site)
app.set("trust proxy", 1);                       // correct client IPs behind a PaaS proxy

// security headers + a CSP that still allows the site's inline styles & Google Fonts
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
app.use(express.json({ limit: "8mb" }));
app.use(cookieParser());

/* ---------- auth ---------- */
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

app.post("/api/login", loginLimiter, (req, res) => {
  const { username, password } = req.body || {};
  const admin = db.prepare("SELECT * FROM admins WHERE username = ?").get(String(username || "").trim());
  if (!admin || !verifyPassword(String(password || ""), admin.password_hash)) {
    return res.status(401).json({ error: "invalid credentials" });
  }
  setAuthCookie(res, signToken({ uid: admin.id, username: admin.username }));
  res.json({ ok: true, username: admin.username });
});
app.post("/api/logout", (_req, res) => { clearAuthCookie(res); res.json({ ok: true }); });
app.get("/api/me", requireAuth, (req, res) => res.json({ username: req.admin.username }));

/* ---------- api ---------- */
const applyLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });
app.use("/api/applications", (req, res, next) => (req.method === "POST" ? applyLimiter(req, res, next) : next()));
app.use("/api/applications", require("./routes/applications"));
app.use("/api/team", require("./routes/team"));
app.use("/api/projects", require("./routes/projects"));
app.use("/api/upload", require("./routes/upload"));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

/* ---------- static site (explicit paths only — never expose server/ or node_modules) ---------- */
app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "7d" }));
app.use("/css", express.static(path.join(ROOT, "css")));
app.use("/js", express.static(path.join(ROOT, "js")));
app.use("/img", express.static(path.join(ROOT, "img"), { maxAge: "7d" }));
app.get(["/", "/index.html"], (_req, res) => res.sendFile(path.join(ROOT, "index.html")));
app.get(["/admin", "/admin.html"], (_req, res) => res.sendFile(path.join(ROOT, "admin.html")));

app.use((_req, res) => res.status(404).json({ error: "not found" }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`slv_visual backend on http://localhost:${PORT}`));
