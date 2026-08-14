require("dotenv").config();
const fs = require("fs");
const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");

const { db, UPLOAD_DIR } = require("./db");
const { seed } = require("./seed");
const {
  verifyPassword, signToken, setAuthCookie, clearAuthCookie, requireAuth, hashPassword,
} = require("./auth");

seed(); // idempotent — inserts built-in team + projects on first run

// bootstrap the first admin from env vars (handy on a PaaS with no shell):
// if ADMIN_USERNAME + ADMIN_PASSWORD are set and no admin exists yet, create one.
(function bootstrapAdmin() {
  const u = (process.env.ADMIN_USERNAME || "").trim();
  const p = process.env.ADMIN_PASSWORD || "";
  if (!u || !p) return;
  if (db.prepare("SELECT COUNT(*) AS n FROM admins").get().n > 0) return; // never overwrite
  db.prepare("INSERT INTO admins (username, password_hash) VALUES (?, ?)").run(u, hashPassword(p));
  console.log(`[bootstrap] created admin "${u}" from env vars`);
})();

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
// JSON bodies are only ever small metadata payloads; images go through multipart
// upload. A tight limit shrinks the memory-exhaustion (DoS) surface.
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

// Defense-in-depth CSRF: reject state-changing requests whose Origin isn't us.
// Cookies are SameSite=Lax already, but an explicit same-origin check on
// mutations closes the gap for any request a browser is willing to send.
// (Missing Origin = non-browser client like curl/health-checks — allowed.)
app.use((req, res, next) => {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
  const origin = req.get("origin");
  if (!origin) return next();
  try {
    if (new URL(origin).host !== req.get("host")) {
      return res.status(403).json({ error: "cross-origin request blocked" });
    }
  } catch (_) {
    return res.status(403).json({ error: "invalid origin" });
  }
  next();
});

/* ---------- auth ---------- */
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

app.post("/api/login", loginLimiter, (req, res) => {
  const { username, password } = req.body || {};
  const uname = String(username || "").trim();
  const admin = db.prepare("SELECT * FROM admins WHERE username = ?").get(uname);
  if (!admin || !verifyPassword(String(password || ""), admin.password_hash)) {
    console.warn(`[auth] failed login for "${uname}" from ${req.ip}`);
    return res.status(401).json({ error: "invalid credentials" });
  }
  console.log(`[auth] successful login for "${admin.username}" from ${req.ip}`);
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

/* One-click backup: every table as a single JSON file. Added so the database
   can be rescued without anyone handling credentials on the command line. */
app.get("/api/export", requireAuth, (_req, res) => {
  const dump = {
    exportedAt: new Date().toISOString(),
    applications: db.prepare("SELECT * FROM applications ORDER BY created_at ASC").all(),
    projects: db.prepare("SELECT * FROM projects ORDER BY id ASC").all(),
    team_members: db.prepare("SELECT * FROM team_members ORDER BY sort_order ASC").all(),
  };
  res.set("Content-Disposition", 'attachment; filename="slv-visual-backup.json"');
  res.json(dump);
});

/* ---------- static site (explicit paths only — never expose server/ or node_modules) ---------- */
app.use("/uploads", express.static(UPLOAD_DIR, {
  maxAge: "7d",
  // user-supplied files: never let the browser sniff/execute them, and force a
  // download rather than in-page rendering as a last line of defense
  setHeaders: (res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Content-Security-Policy", "default-src 'none'; sandbox");
  },
}));
app.use("/css", express.static(path.join(ROOT, "css")));
app.use("/js", express.static(path.join(ROOT, "js")));
app.use("/img", express.static(path.join(ROOT, "img"), { maxAge: "7d" }));
/* Cache-busting for CSS/JS.
   Cloudflare tells browsers to cache .css/.js for 4h, so after a deploy visitors
   could keep an old stylesheet and render a broken page (this bit us three times).
   Each HTML page references its assets as `style.css?v=__V__`; we swap __V__ for a
   token that changes every deploy, so a new build is always a new URL = always
   fresh, with no cache purge needed. The HTML itself is served no-cache. */
const ASSET_V = (process.env.RAILWAY_GIT_COMMIT_SHA || "").slice(0, 8) || String(Date.now());
const htmlCache = new Map();
function sendHtml(res, file) {
  let html = htmlCache.get(file);
  if (html == null) {
    html = fs.readFileSync(path.join(ROOT, file), "utf8").replace(/__V__/g, ASSET_V);
    htmlCache.set(file, html);
  }
  res.set("Cache-Control", "no-cache").type("html").send(html);
}

app.get(["/", "/index.html"], (_req, res) => sendHtml(res, "index.html"));
app.get(["/admin", "/admin.html"], (_req, res) => sendHtml(res, "admin.html"));
app.get(["/projects", "/projects.html"], (_req, res) => sendHtml(res, "projects.html"));
app.get(["/privacy", "/privacy.html"], (_req, res) => sendHtml(res, "privacy.html"));
app.get(["/terms", "/terms.html"], (_req, res) => sendHtml(res, "terms.html"));

// SEO / GEO root files
app.get("/robots.txt", (_req, res) => res.type("text/plain").sendFile(path.join(ROOT, "robots.txt")));
app.get("/sitemap.xml", (_req, res) => res.type("application/xml").sendFile(path.join(ROOT, "sitemap.xml")));
app.get("/site.webmanifest", (_req, res) => res.type("application/manifest+json").sendFile(path.join(ROOT, "site.webmanifest")));
app.get("/llms.txt", (_req, res) => res.type("text/plain").sendFile(path.join(ROOT, "llms.txt")));
app.get("/favicon.ico", (_req, res) => res.type("image/x-icon").sendFile(path.join(ROOT, "favicon.ico")));
app.get("/favicon.svg", (_req, res) => res.type("image/svg+xml").sendFile(path.join(ROOT, "favicon.svg")));

app.use((_req, res) => res.status(404).json({ error: "not found" }));

// Generic error handler: log the real error server-side, return a safe message.
// Never leak stack traces or internal detail to the client.
app.use((err, _req, res, _next) => {
  console.error("[error]", err && err.stack ? err.stack : err);
  if (res.headersSent) return;
  res.status(500).json({ error: "internal server error" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`slv_visual backend on http://localhost:${PORT}`));
