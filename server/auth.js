/* Admin auth: bcrypt password hashing + JWT in an httpOnly cookie. */
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "dev-insecure-secret-change-me";
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
