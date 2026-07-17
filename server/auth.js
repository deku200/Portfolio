/* Admin auth: bcrypt password hashing + JWT in an httpOnly cookie. */
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

// The JWT secret is what makes an admin session unforgeable. It must NEVER fall
// back to a value that lives in the (public) source tree — anyone reading the
// repo could then mint their own admin cookie. Fail hard in production if it's
// missing/weak; in dev, mint a random ephemeral one so `npm run dev` still works
// (sessions just won't survive a restart, which is fine locally).
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  if (process.env.NODE_ENV === "production") {
    console.error("FATAL: JWT_SECRET must be set to a strong random value (>=32 chars) in production.");
    process.exit(1);
  }
  JWT_SECRET = crypto.randomBytes(48).toString("hex");
  console.warn("[auth] JWT_SECRET unset/short — using a random ephemeral dev secret (sessions reset on restart).");
}
const COOKIE = "slv_token";
const MAX_AGE = 1000 * 60 * 60 * 8; // 8 hours

const hashPassword = (pw) => bcrypt.hashSync(pw, 12);
const verifyPassword = (pw, hash) => bcrypt.compareSync(pw, hash);
const signToken = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: "8h" });

function setAuthCookie(res, token) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE,
  });
}
const clearAuthCookie = (res) => res.clearCookie(COOKIE);

function requireAuth(req, res, next) {
  const token = req.cookies && req.cookies[COOKIE];
  if (!token) return res.status(401).json({ error: "not authenticated" });
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch (_) {
    return res.status(401).json({ error: "invalid or expired session" });
  }
}

module.exports = {
  hashPassword, verifyPassword, signToken,
  setAuthCookie, clearAuthCookie, requireAuth, COOKIE,
};
