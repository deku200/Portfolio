/* Create or update the admin account. Run this yourself so your password
   is never seen by anyone else — it is bcrypt-hashed before being stored.

   Usage:
     npm run setup:admin -- <username> <password>
   or via env:
     ADMIN_USERNAME=you ADMIN_PASSWORD=secret node server/setup-admin.js
*/
require("dotenv").config();
const { db } = require("./db");
const { hashPassword } = require("./auth");

const username = process.argv[2] || process.env.ADMIN_USERNAME;
const password = process.argv[3] || process.env.ADMIN_PASSWORD;

if (!username || !password) {
  console.error("Usage: npm run setup:admin -- <username> <password>");
  process.exit(1);
}
if (password.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

const hash = hashPassword(password);
db.prepare(`
  INSERT INTO admins (username, password_hash) VALUES (:u, :h)
  ON CONFLICT(username) DO UPDATE SET password_hash = :h
`).run({ u: username, h: hash });

console.log(`✓ admin "${username}" is ready. (password stored as a bcrypt hash)`);
