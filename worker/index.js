/* ============================================================================
   slv_visual — Cloudflare Worker backend
   Port of the Express server that ran on Railway.

     server/db.js       -> D1 (env.DB)          same SQLite schema
     multer -> /data    -> KV (env.UPLOADS)
     bcrypt + JWT login -> Cloudflare Access    (Workers free caps CPU at 10ms
                                                 per request, far too tight to
                                                 hash a password safely)
     express.static     -> [assets] for css/js/img; HTML is imported as text so
                           the __V__ cache-busting token can still be swapped.
   ========================================================================== */

import indexHtml from "../index.html";
import adminHtml from "../admin.html";
import projectsHtml from "../projects.html";
import privacyHtml from "../privacy.html";
import termsHtml from "../terms.html";
import robotsTxt from "../robots.txt";
import llmsTxt from "../llms.txt";
import sitemapXml from "../sitemap.xml";
import webmanifest from "../site.webmanifest";

const PAGES = {
  "index.html": indexHtml,
  "admin.html": adminHtml,
  "projects.html": projectsHtml,
  "privacy.html": privacyHtml,
  "terms.html": termsHtml,
};

/* ---------------------------------------------------------------- helpers */
const CSP =
  "default-src 'self'; script-src 'self'; " +
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
  "font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; " +
  "connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; " +
  "frame-ancestors 'self'";

const SECURITY_HEADERS = {
  "Content-Security-Policy": CSP,
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Frame-Options": "SAMEORIGIN",
};

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...SECURITY_HEADERS, ...extra },
  });

const s = (v) => String(v ?? "").trim();
// project links render into an <a href>: http(s) only, never javascript:/data:
const safeUrl = (v) => (/^https?:\/\//i.test(s(v)) ? s(v) : "");

function readCookie(request, name) {
  const raw = request.headers.get("Cookie") || "";
  for (const part of raw.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return null;
}

/* ------------------------------------------------- Cloudflare Access auth */
/* Access sits in front of /admin and every mutating /api route, so a request
   that reaches those handlers has already been authenticated at the edge. The
   JWT is still verified here as defence in depth. */
let jwks = null;
let jwksAt = 0;

const b64urlBytes = (str) => {
  const bin = atob(str.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};
const b64urlJson = (str) => JSON.parse(new TextDecoder().decode(b64urlBytes(str)));

async function accessIdentity(request, env) {
  const token =
    request.headers.get("Cf-Access-Jwt-Assertion") || readCookie(request, "CF_Authorization");
  if (!token) return null;

  const [h, p, sig] = token.split(".");
  if (!h || !p || !sig) return null;

  let header, payload;
  try {
    header = b64urlJson(h);
    payload = b64urlJson(p);
  } catch (_) {
    return null;
  }
  if (!payload.exp || payload.exp * 1000 < Date.now()) return null;
  if (env.ACCESS_AUD && ![].concat(payload.aud || []).includes(env.ACCESS_AUD)) return null;
  if (!env.ACCESS_TEAM_DOMAIN) return null;

  const now = Date.now();
  if (!jwks || now - jwksAt > 3600000) {
    const res = await fetch("https://" + env.ACCESS_TEAM_DOMAIN + "/cdn-cgi/access/certs");
    if (!res.ok) return null;
    jwks = await res.json();
    jwksAt = now;
  }
  const jwk = (jwks.keys || []).find((k) => k.kid === header.kid);
  if (!jwk) return null;

  try {
    const key = await crypto.subtle.importKey(
      "jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]
    );
    const ok = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5", key, b64urlBytes(sig), new TextEncoder().encode(h + "." + p)
    );
    return ok ? payload : null;
  } catch (_) {
    return null;
  }
}

/* --------------------------------------------------------- rate limiting */
/* express-rate-limit kept counters in memory; Worker isolates are short-lived,
   so the contact form's limit lives in D1 instead. */
async function rateLimited(env, bucket, max, windowMs) {
  const cutoff = Date.now() - windowMs;
  await env.DB.prepare("DELETE FROM rate_hits WHERE ts < ?").bind(cutoff).run();
  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM rate_hits WHERE bucket = ? AND ts >= ?"
  ).bind(bucket, cutoff).first();
  if ((row && row.n ? row.n : 0) >= max) return true;
  await env.DB.prepare("INSERT INTO rate_hits (bucket, ts) VALUES (?, ?)")
    .bind(bucket, Date.now()).run();
  return false;
}

/* ------------------------------------------------------------- row shapes */
const shapeProject = (r) => ({
  id: r.id, title: r.title, caseLabel: r.case_label, status: r.status,
  tags: r.tags, link: r.link, image: r.image_url,
  desc: { en: r.desc_en, uk: r.desc_uk },
});

const shapeMember = (r) => ({
  id: r.id, code: r.code, isBuiltin: !!r.is_builtin,
  name: { en: r.name_en, uk: r.name_uk },
  role: { en: r.role_en, uk: r.role_uk },
  location: { en: r.location_en, uk: r.location_uk },
  bio: { en: r.bio_en, uk: r.bio_uk },
  status: r.status,
  skills: JSON.parse(r.skills || "[]"),
  photo: r.photo_url,
});

const validStatus = (x) => (["online", "offline", "atwork"].includes(x) ? x : "online");
const normSkills = (arr) =>
  (Array.isArray(arr) ? arr : []).map((k) => {
    const label = s(k.name || k.label || "").toUpperCase();
    return { label_en: label, label_uk: label, level: Math.max(0, Math.min(10, +k.level || 0)) };
  }).filter((k) => k.label_en);

/* ------------------------------------------------------------- uploads/KV */
const MIME_EXT = {
  "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif",
};

// magic bytes are the only trustworthy signal: filename and mimetype are both
// attacker-controlled
function sniffMime(b) {
  if (b.length < 12) return null;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "image/gif";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}

/* ------------------------------------------------------------------ pages */
function servePage(file, env) {
  const version =
    (env.CF_VERSION && env.CF_VERSION.id ? String(env.CF_VERSION.id).slice(0, 8) : null) ||
    env.ASSET_V || "dev";
  const html = PAGES[file].replace(/__V__/g, version);
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache",
      ...SECURITY_HEADERS,
    },
  });
}

const textResponse = (body, type, cache = "public, max-age=3600") =>
  new Response(body, {
    headers: { "Content-Type": type, "Cache-Control": cache, ...SECURITY_HEADERS },
  });

/* =========================================================================== */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      /* CSRF defence in depth: reject cross-origin mutations. Cookies are
         SameSite=Lax, but an explicit check closes anything a browser sends. */
      if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
        const origin = request.headers.get("Origin");
        if (origin) {
          try {
            if (new URL(origin).host !== url.host) {
              return json({ error: "cross-origin request blocked" }, 403);
            }
          } catch (_) {
            return json({ error: "invalid origin" }, 403);
          }
        }
      }

      if (path.startsWith("/api/")) return await api(request, env, path, method);
      if (path.startsWith("/uploads/")) return await serveUpload(env, path);

      /* ---------------- pages + SEO files ---------------- */
      if (path === "/" || path === "/index.html") return servePage("index.html", env);
      if (path === "/admin" || path === "/admin.html") return servePage("admin.html", env);
      if (path === "/projects" || path === "/projects.html") return servePage("projects.html", env);
      if (path === "/privacy" || path === "/privacy.html") return servePage("privacy.html", env);
      if (path === "/terms" || path === "/terms.html") return servePage("terms.html", env);

      if (path === "/robots.txt") return textResponse(robotsTxt, "text/plain; charset=utf-8");
      if (path === "/llms.txt") return textResponse(llmsTxt, "text/plain; charset=utf-8");
      if (path === "/sitemap.xml") return textResponse(sitemapXml, "application/xml; charset=utf-8");
      if (path === "/site.webmanifest") return textResponse(webmanifest, "application/manifest+json");

      /* css / js / img / favicons come straight off the edge */
      const asset = await env.ASSETS.fetch(request);
      if (asset.status !== 404) {
        const out = new Response(asset.body, asset);
        for (const k of Object.keys(SECURITY_HEADERS)) out.headers.set(k, SECURITY_HEADERS[k]);
        return out;
      }
      return json({ error: "not found" }, 404);
    } catch (err) {
      console.error("[error]", err && err.stack ? err.stack : err);
      return json({ error: "internal server error" }, 500);
    }
  },
};

/* ------------------------------------------------------------- KV serving */
async function serveUpload(env, path) {
  const key = decodeURIComponent(path.slice("/uploads/".length));
  if (!key || key.indexOf("..") !== -1) return json({ error: "not found" }, 404);
  const { value, metadata } = await env.UPLOADS.getWithMetadata(key, { type: "arrayBuffer" });
  if (!value) return json({ error: "not found" }, 404);
  return new Response(value, {
    headers: {
      "Content-Type": (metadata && metadata.contentType) || "application/octet-stream",
      "Cache-Control": "public, max-age=604800",
      // user-supplied bytes: never let a browser sniff or execute them
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}

/* ---------------------------------------------------------------- the API */
async function api(request, env, path, method) {
  const seg = path.split("/").filter(Boolean); // ["api", resource, ...rest]
  const resource = seg[1] || "";
  const rest = seg.slice(2);

  if (resource === "health" && method === "GET") return json({ ok: true });

  /* everything that mutates, plus reading applications, is admin-only */
  const needsAdmin =
    resource === "me" ||
    resource === "export" ||
    resource === "upload" ||
    (resource === "applications" && method !== "POST") ||
    (resource === "estimates" && method !== "POST") ||
    (["projects", "team"].indexOf(resource) !== -1 && method !== "GET");

  let identity = null;
  if (needsAdmin) {
    identity = await accessIdentity(request, env);
    if (!identity) return json({ error: "not authenticated" }, 401);
  }

  if (resource === "me") return json({ username: identity.email || "admin" });

  /* one-click backup of every table, same shape as the Express version */
  if (resource === "export" && method === "GET") {
    const [apps, projects, team, estimates] = await Promise.all([
      env.DB.prepare("SELECT * FROM applications ORDER BY created_at ASC").all(),
      env.DB.prepare("SELECT * FROM projects ORDER BY id ASC").all(),
      env.DB.prepare("SELECT * FROM team_members ORDER BY sort_order ASC").all(),
      env.DB.prepare("SELECT * FROM estimates ORDER BY created_at ASC").all(),
    ]);
    return json({
      exportedAt: new Date().toISOString(),
      applications: apps.results || [],
      projects: projects.results || [],
      team_members: team.results || [],
      estimates: estimates.results || [],
    }, 200, { "Content-Disposition": 'attachment; filename="slv-visual-backup.json"' });
  }

  /* ------------------------------------------------------------ projects */
  if (resource === "projects") {
    if (method === "GET" && !rest.length) {
      const { results } = await env.DB.prepare("SELECT * FROM projects ORDER BY id ASC").all();
      return json((results || []).map(shapeProject));
    }
    if (method === "POST" && !rest.length) {
      const b = await request.json().catch(() => ({}));
      const title = s(b.title);
      if (!title) return json({ error: "title is required" }, 400);
      const maxRow = await env.DB.prepare("SELECT COALESCE(MAX(id), -1) AS m FROM projects").first();
      const countRow = await env.DB.prepare("SELECT COUNT(*) AS n FROM projects").first();
      const id = (maxRow && typeof maxRow.m === "number" ? maxRow.m : -1) + 1;
      const n = (countRow && countRow.n ? countRow.n : 0) + 1;
      await env.DB.prepare(
        "INSERT INTO projects (id,title,case_label,status,tags,link,image_url,desc_en,desc_uk)" +
        " VALUES (?,?,?,?,?,?,?,?,?)"
      ).bind(
        id, title,
        s(b.caseLabel) || "CASE " + String(n).padStart(3, "0") + " — " + new Date().getFullYear(),
        s(b.status) || "■ IN DEV", s(b.tags), safeUrl(b.link), s(b.image),
        s(b.descEn), s(b.descUk) || s(b.descEn)
      ).run();
      return json({ ok: true, id }, 201);
    }
    if (method === "PUT" && rest.length === 1) {
      const id = +rest[0];
      const cur = await env.DB.prepare("SELECT id FROM projects WHERE id = ?").bind(id).first();
      if (!cur) return json({ error: "project not found" }, 404);
      const b = await request.json().catch(() => ({}));
      const map = {
        title: "title", caseLabel: "case_label", status: "status", tags: "tags",
        link: "link", image: "image_url", descEn: "desc_en", descUk: "desc_uk",
      };
      const cols = [], vals = [];
      for (const k of Object.keys(map)) {
        if (b[k] == null) continue;
        cols.push(map[k] + " = ?");
        vals.push(k === "link" ? safeUrl(b[k]) : s(b[k]));
      }
      if (cols.length) {
        await env.DB.prepare("UPDATE projects SET " + cols.join(", ") + " WHERE id = ?")
          .bind(...vals, id).run();
      }
      return json({ ok: true });
    }
    if (method === "DELETE" && rest.length === 1) {
      const id = +rest[0];
      const cur = await env.DB.prepare("SELECT id FROM projects WHERE id = ?").bind(id).first();
      if (!cur) return json({ error: "project not found" }, 404);
      await env.DB.prepare("DELETE FROM projects WHERE id = ?").bind(id).run();
      return json({ ok: true });
    }
  }

  /* ---------------------------------------------------------------- team */
  if (resource === "team") {
    if (method === "GET" && !rest.length) {
      const { results } = await env.DB.prepare(
        "SELECT * FROM team_members ORDER BY sort_order ASC, rowid ASC"
      ).all();
      return json((results || []).map(shapeMember));
    }
    if (method === "POST" && !rest.length) {
      const b = await request.json().catch(() => ({}));
      const name = s(b.name) || "PARTNER";
      const role = s(b.role) || "PARTNER";
      const loc = s(b.location) || "—";
      const countRow = await env.DB.prepare("SELECT COUNT(*) AS n FROM team_members").first();
      const orderRow = await env.DB.prepare(
        "SELECT COALESCE(MAX(sort_order),-1) AS m FROM team_members"
      ).first();
      const id = "p-" + Date.now().toString(36);
      const code = "#SV-" + String((countRow && countRow.n ? countRow.n : 0) + 1).padStart(3, "0");
      await env.DB.prepare(
        "INSERT INTO team_members" +
        " (id,sort_order,is_builtin,code,name_en,name_uk,role_en,role_uk," +
        "  location_en,location_uk,bio_en,bio_uk,status,skills,photo_url)" +
        " VALUES (?,?,0,?,?,?,?,?,?,?,?,?,?,?,?)"
      ).bind(
        id, (orderRow && typeof orderRow.m === "number" ? orderRow.m : -1) + 1,
        code, name, name, role, role, loc, loc, s(b.bio), s(b.bio),
        validStatus(b.status), JSON.stringify(normSkills(b.skills)), s(b.photo)
      ).run();
      return json({ ok: true, id }, 201);
    }
    if (method === "PUT" && rest.length === 1) {
      const cur = await env.DB.prepare("SELECT * FROM team_members WHERE id = ?")
        .bind(rest[0]).first();
      if (!cur) return json({ error: "member not found" }, 404);
      const b = await request.json().catch(() => ({}));
      const cols = [], vals = [];
      for (const key of ["name", "role", "location", "bio"]) {
        if (b[key] == null) continue;
        const val = s(b[key]);
        if (val === cur[key + "_en"]) continue; // unchanged -> keep the UK translation
        cols.push(key + "_en = ?", key + "_uk = ?");
        vals.push(val, val);
      }
      if (b.status != null) { cols.push("status = ?"); vals.push(validStatus(b.status)); }
      if (b.skills != null) {
        const next = normSkills(b.skills);
        const curSimple = JSON.parse(cur.skills || "[]")
          .map((k) => ({ name: k.label_en, level: k.level }));
        const nextSimple = next.map((k) => ({ name: k.label_en, level: k.level }));
        if (JSON.stringify(curSimple) !== JSON.stringify(nextSimple)) {
          cols.push("skills = ?"); vals.push(JSON.stringify(next));
        }
      }
      if (b.photo != null && s(b.photo) !== "") { cols.push("photo_url = ?"); vals.push(s(b.photo)); }
      if (cols.length) {
        await env.DB.prepare("UPDATE team_members SET " + cols.join(", ") + " WHERE id = ?")
          .bind(...vals, rest[0]).run();
      }
      return json({ ok: true });
    }
    if (method === "PATCH" && rest.length === 2 && rest[1] === "status") {
      const cur = await env.DB.prepare("SELECT id FROM team_members WHERE id = ?")
        .bind(rest[0]).first();
      if (!cur) return json({ error: "member not found" }, 404);
      const b = await request.json().catch(() => ({}));
      await env.DB.prepare("UPDATE team_members SET status = ? WHERE id = ?")
        .bind(validStatus(b.status), rest[0]).run();
      return json({ ok: true });
    }
    if (method === "DELETE" && rest.length === 1) {
      const cur = await env.DB.prepare("SELECT is_builtin FROM team_members WHERE id = ?")
        .bind(rest[0]).first();
      if (!cur) return json({ error: "member not found" }, 404);
      if (cur.is_builtin) return json({ error: "built-in members can't be deleted" }, 400);
      await env.DB.prepare("DELETE FROM team_members WHERE id = ?").bind(rest[0]).run();
      return json({ ok: true });
    }
  }

  /* -------------------------------------------------------- applications */
  if (resource === "applications") {
    if (method === "POST" && !rest.length) {
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      if (await rateLimited(env, "apply:" + ip, 30, 3600000)) {
        return json({ error: "too many requests, please try again later" }, 429);
      }
      const b = await request.json().catch(() => ({}));
      /* The form asks for one way to reach someone — a phone number or a
         Telegram handle — instead of a name and an email. name/email/source
         stay in the table so applications taken before the change still read
         correctly in the admin panel; they are simply no longer written. */
      const contact = s(b.contact).slice(0, 200);
      const message = s(b.message).slice(0, 5000);
      if (!contact || !message) {
        return json({ error: "a contact and a message are required" }, 400);
      }
      if (contact.length < 4) {
        return json({ error: "invalid contact" }, 400);
      }
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      await env.DB.prepare(
        "INSERT INTO applications (id,contact,budget,message,created_at)" +
        " VALUES (?,?,?,?,?)"
      ).bind(
        id, contact, s(b.budget).slice(0, 100),
        message, new Date().toISOString()
      ).run();
      return json({ ok: true }, 201);
    }
    if (method === "GET" && !rest.length) {
      const { results } = await env.DB.prepare(
        "SELECT * FROM applications ORDER BY created_at DESC"
      ).all();
      return json(results || []);
    }
    if (method === "DELETE" && rest.length === 1) {
      await env.DB.prepare("DELETE FROM applications WHERE id = ?").bind(rest[0]).run();
      return json({ ok: true });
    }
    if (method === "DELETE" && !rest.length) {
      await env.DB.prepare("DELETE FROM applications").run();
      return json({ ok: true });
    }
  }

  /* ----------------------------------------------------------- estimates */
  /* Written by the price calculator on the home page. Everything here is
     visitor-supplied and nothing downstream charges from it — the stored total
     is a lead signal, not an invoice, and the real price is fixed after the
     briefing. So the defence is containment rather than trust: every field is
     length-capped, the item list is capped at 40 rows, and the total is
     recomputed from those rows so a hand-crafted POST cannot store a total
     that disagrees with its own line items. */
  if (resource === "estimates") {
    if (method === "POST" && !rest.length) {
      const ip = request.headers.get("CF-Connecting-IP") || "unknown";
      if (await rateLimited(env, "estimate:" + ip, 60, 3600000)) {
        return json({ error: "too many requests, please try again later" }, 429);
      }
      const b = await request.json().catch(() => ({}));

      // the itemised list is display data only — cap it hard so a single
      // request can never write an unbounded blob into D1
      const items = (Array.isArray(b.items) ? b.items : []).slice(0, 40).map((it) => ({
        label: s(it && it.label).slice(0, 120),
        // negative on purpose: a discount is a line item like any other
        price: Math.max(-100000, Math.min(100000, Math.round(+(it && it.price) || 0))),
      }));
      const sum = items.reduce((a, it) => a + it.price, 0);

      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      await env.DB.prepare(
        "INSERT INTO estimates (id,lang,developer,category,niche,total,monthly,days,items,created_at)" +
        " VALUES (?,?,?,?,?,?,?,?,?,?)"
      ).bind(
        id,
        b.lang === "en" ? "en" : "uk",
        s(b.developer).slice(0, 80),
        s(b.category).slice(0, 120),
        s(b.niche).slice(0, 120),
        sum, // recomputed from the line items, never taken from the client
        Math.max(0, Math.min(100000, Math.round(+b.monthly || 0))),
        s(b.days).slice(0, 40),
        JSON.stringify(items),
        new Date().toISOString()
      ).run();
      return json({ ok: true }, 201);
    }
    if (method === "GET" && !rest.length) {
      const { results } = await env.DB.prepare(
        "SELECT * FROM estimates ORDER BY created_at DESC LIMIT 500"
      ).all();
      return json(results || []);
    }
    if (method === "DELETE" && rest.length === 1) {
      await env.DB.prepare("DELETE FROM estimates WHERE id = ?").bind(rest[0]).run();
      return json({ ok: true });
    }
    if (method === "DELETE" && !rest.length) {
      await env.DB.prepare("DELETE FROM estimates").run();
      return json({ ok: true });
    }
  }

  /* -------------------------------------------------------------- upload */
  if (resource === "upload" && method === "POST") {
    const form = await request.formData().catch(() => null);
    const file = form && form.get("file");
    if (!file || typeof file === "string") return json({ error: "no file uploaded" }, 400);
    if (file.size > 5 * 1024 * 1024) return json({ error: "file too large (max 5 MB)" }, 400);

    const bytes = new Uint8Array(await file.arrayBuffer());
    const real = sniffMime(bytes);
    const ext = real && MIME_EXT[real];
    if (!ext) return json({ error: "file is not a valid PNG/JPEG/WEBP/GIF image" }, 400);

    const rand = Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((n) => n.toString(16).padStart(2, "0")).join("");
    const key = Date.now().toString(36) + "-" + rand + ext;
    await env.UPLOADS.put(key, bytes, { metadata: { contentType: real } });
    return json({ url: "/uploads/" + key }, 201);
  }

  return json({ error: "not found" }, 404);
}
