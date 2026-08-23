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
import priceHtml from "../price.html";
import landingHtml from "../landing.html";
import storeHtml from "../online-store.html";
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
  "price.html": priceHtml,
  "landing.html": landingHtml,
  "online-store.html": storeHtml,
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

/* ------------------------------------------------------- language routing */
/* Ukrainian lives at the root, English under /en/. Both are real URLs served
   with their own <html lang>, <title>, description and canonical: a language a
   crawler can only reach by running JavaScript and clicking a toggle is a
   language it will not index as a separate page. Every page therefore exists
   exactly twice, and each copy points at the other with hreflang. */
const ORIGIN = "https://www.slv-visual.online";

const PAGE_PATH = {
  "index.html": "/",
  "projects.html": "/projects",
  "privacy.html": "/privacy",
  "terms.html": "/terms",
  "price.html": "/price",
  "landing.html": "/landing",
  "online-store.html": "/online-store",
};
const PAGE_OF = {
  "": "index.html", "index": "index.html",
  "projects": "projects.html",
  "privacy": "privacy.html",
  "terms": "terms.html",
  "price": "price.html",
  "landing": "landing.html",
  "online-store": "online-store.html",
};

/* Title and description are the two strongest on-page signals, so they are
   written per language rather than translated by script after load. */
const META = {
  "index.html": {
    uk: {
      title: "Розробка та створення сайтів під ключ від $400 — slv_visual",
      desc: "Створення сайтів під ключ по всій Україні: лендінг від $400, інтернет-магазин від $900. Порахуйте вартість за 30 секунд — без дзвінків. Перший місяць підтримки безкоштовно.",
    },
    en: {
      title: "Website Development from $400 — Landing Pages &amp; Online Stores",
      desc: "Ukrainian studio building landing pages from $400 and online stores from $900. Price your own build in 30 seconds, no call needed. First month of support free.",
    },
  },
  "projects.html": {
    uk: {
      title: "Портфоліо: наші сайти, лендінги та інтернет-магазини — slv_visual",
      desc: "Портфоліо slv_visual: розробка сайтів, лендінгів та інтернет-магазинів під ключ. Реальні кейси, запущені в роботу. Розрахуйте вартість свого сайту онлайн за 30 секунд.",
    },
    en: {
      title: "Portfolio: Websites, Landing Pages &amp; Online Stores — slv_visual",
      desc: "The slv_visual portfolio: websites, landing pages and online stores built end to end, all live in production. Price a build like these in 30 seconds with the calculator.",
    },
  },
  /* The three search-landing pages. Their titles lead with the phrase people
     actually type — "скільки коштує сайт", "лендінг під ключ", "створення
     інтернет-магазину" — and carry the price, because a visible figure is
     what earns the click against agencies that all say "індивідуально". */
  "price.html": {
    uk: {
      title: "Скільки коштує сайт — ціни на створення сайту під ключ від $400",
      desc: "Скільки коштує створення сайту в Україні: лендінг від $400, інтернет-магазин від $900. Повний прайс на блоки, оплату, SEO та інтеграції. Розрахунок за 30 секунд.",
    },
    en: {
      title: "How Much Does a Website Cost? Full Price List from $400",
      desc: "Website development pricing, itemised: landing pages from $400, online stores from $900. Every block, payment option and integration priced. Estimate in 30 seconds.",
    },
  },
  "landing.html": {
    uk: {
      title: "Лендінг під ключ — створення односторінкового сайту від $400",
      desc: "Замовити лендінг під ключ: дизайн, код, тексти, домен і запуск від $400, строк від 4 днів. Перший місяць підтримки безкоштовно. Порахуйте ціну за 30 секунд.",
    },
    en: {
      title: "Landing Page Development — One-Page Sites from $400",
      desc: "Landing page development end to end: design, code, copy, domain and launch from $400, live in 4 days. First month of support free. Price it yourself in 30 seconds.",
    },
  },
  "online-store.html": {
    uk: {
      title: "Створення інтернет-магазину під ключ — розробка від $900",
      desc: "Розробка інтернет-магазину під ключ від $900: каталог, кошик, оплата карткою, Нова Пошта, адмін-панель. Сайт для Instagram- і TikTok-магазину. Ціна за 30 секунд.",
    },
    en: {
      title: "Online Store Development — E-commerce Sites from $900",
      desc: "Custom online store development from $900: catalogue, cart, card payments, delivery and an admin panel. Built for Instagram and TikTok sellers. Price it in 30 seconds.",
    },
  },
  "privacy.html": {
    uk: {
      title: "Політика конфіденційності — slv_visual",
      desc: "Політика конфіденційності slv_visual (slv-visual.online): які дані ми збираємо через форму заявки й калькулятор вартості, як зберігаємо і захищаємо їх.",
    },
    en: {
      title: "Privacy Policy — slv_visual",
      desc: "Privacy Policy for slv_visual (slv-visual.online) — what data the contact form and the price calculator collect, and how we use, store and protect it.",
    },
  },
  "terms.html": {
    uk: {
      title: "Умови використання — slv_visual",
      desc: "Умови використання сайту slv_visual (slv-visual.online): правила користування, інтелектуальна власність, заявки, розрахунки вартості й відповідальність.",
    },
    en: {
      title: "Terms of Use — slv_visual",
      desc: "Terms of Use for slv_visual (slv-visual.online) — the rules for using this site, intellectual property, enquiries, cost estimates and our liability to you.",
    },
  },
};

// the single URL each page+language is allowed to answer on
const canonicalPath = (file, lang) =>
  (lang === "en" ? "/en" : "") + (PAGE_PATH[file] || "/");

/* Resolves a request path to a page and a language, accepting the shapes that
   should merely redirect (/projects.html, /en) as well as the canonical ones. */
function routePage(path) {
  let lang = "uk";
  let p = path;
  if (p === "/en" || p.indexOf("/en/") === 0) {
    lang = "en";
    p = p.slice(3) || "/";
  }
  const slug = p.replace(/^\/+/, "").replace(/\.html$/, "");
  const file = PAGE_OF[slug];
  return file ? { file, lang } : null;
}

const redirect = (location) =>
  new Response(null, { status: 301, headers: { Location: location, ...SECURITY_HEADERS } });

/* Structured data, per language. The entity @ids stay identical across the two
   URLs on purpose — it is one studio, described twice, not two organisations. */
const LD = {
  uk: {
    desc: "slv_visual — студія веброзробки з України: розробка сайтів під ключ, лендінги, корпоративні сайти та інтернет-магазини українською й англійською.",
    slogan: "Розробка сайтів під ключ для тих, хто цінує якість і швидкість.",
    jobTitle: "Веброзробник і продуктовий дизайнер",
    siteDesc: "Сайт студії slv_visual — розробка сайтів, інтернет-магазинів і продуктовий дизайн.",
    serviceType: ["Розробка сайтів", "Створення сайтів під ключ", "Створення лендінгів", "Створення інтернет-магазинів", "Продуктовий дизайн", "SEO-оптимізація", "Брендинг", "Автоматизація бізнесу"],
    knowsAbout: ["Розробка сайтів", "Створення сайтів під ключ", "Лендінги", "Інтернет-магазини", "Продуктовий дизайн", "Frontend-розробка", "E-commerce", "SEO"],
  },
  en: {
    desc: "slv_visual is a Ukraine-based web development and product design studio building fast, high-quality websites, online stores and brand experiences in English and Ukrainian.",
    slogan: "Comprehensive website development for those who value quality and speed.",
    jobTitle: "Web Developer & Product Designer",
    siteDesc: "Portfolio and studio site of slv_visual — web development and product design.",
    serviceType: ["Web development", "Product design", "Creative development", "E-commerce development", "Brand identity", "Automation"],
    knowsAbout: ["Web development", "Product design", "Front-end engineering", "E-commerce", "Creative development"],
  },
};

/* --------------------------------------------------------------- FAQ schema */
/* Read out of the page's own FAQ markup rather than kept as a second copy of
   the questions, so the two cannot drift apart. Parsed once when the isolate
   boots — never per request, because the free plan caps CPU at 10ms. */
function faqItems(html, lang) {
  const strip = (t) => t
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ").trim();

  const inLang = (chunk) => {
    const re = new RegExp('<span data-lang-block="' + lang + '">([\\s\\S]*?)</span>', "g");
    const out = [];
    let m;
    while ((m = re.exec(chunk))) out.push(strip(m[1]));
    return out.filter(Boolean).join(" ");
  };

  const out = [];
  for (const block of html.match(/<details class="faq-item"[^>]*>[\s\S]*?<\/details>/g) || []) {
    const summary = (block.match(/<summary>([\s\S]*?)<\/summary>/) || [])[1] || "";
    const answer = (block.match(/<div class="faq-a">([\s\S]*?)<\/div>/) || [])[1] || "";
    const q = inLang(summary);
    const a = inLang(answer);
    if (q && a) out.push({ q, a });
  }
  return out;
}

function faqScript(lang) {
  const items = faqItems(indexHtml, lang);
  // never inject a half-parsed block: broken schema is worse than none
  if (items.length < 2) return "";
  const json = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": ORIGIN + (lang === "en" ? "/en/" : "/") + "#faq",
    inLanguage: lang,
    mainEntity: items.map((i) => ({
      "@type": "Question",
      name: i.q,
      acceptedAnswer: { "@type": "Answer", text: i.a },
    })),
  }).replace(/</g, "\\u003c"); // cannot end the <script> early
  return '  <script type="application/ld+json">' + json + "</script>";
}

const FAQ_LD = { uk: faqScript("uk"), en: faqScript("en") };

/* ------------------------------------------- structured data: service pages */
/* Everything a rich result or an AI answer needs about the three commercial
   pages: what the service is, what it costs, and the questions the page already
   answers. The prices are stated here as well as in the page's own tables —
   unavoidable, because a table is prose to a parser — so if a price changes,
   both move together. The FAQ, by contrast, is read back out of the page so it
   cannot drift; see pageFaq(). */

/* Where we actually take work. Named explicitly rather than left as
   "Worldwide", which tells a search engine nothing: the cities are the ones
   people put in the query ("розробка сайтів Київ"), and everything is remote,
   so this is a statement about clients served, not about offices held. */
const AREA_SERVED = [
  { "@type": "Country", name: "Ukraine" },
  { "@type": "City", name: "Kyiv" },
  { "@type": "City", name: "Kharkiv" },
  { "@type": "City", name: "Odesa" },
  { "@type": "City", name: "Dnipro" },
  { "@type": "City", name: "Lviv" },
  { "@type": "City", name: "Zaporizhzhia" },
  { "@type": "City", name: "Vinnytsia" },
  { "@type": "Country", name: "Poland" },
  { "@type": "Country", name: "Germany" },
  { "@type": "Country", name: "United States" },
  { "@type": "Country", name: "Canada" },
  { "@type": "Country", name: "United Kingdom" },
];

const SERVICE_LD = {
  "price.html": {
    uk: {
      name: "Розробка сайтів під ключ",
      desc: "Створення сайтів під ключ: лендінги від $400 та інтернет-магазини від $900. Дизайн, розробка, домен, запуск, базове SEO і перший місяць підтримки безкоштовно.",
      crumb: "Ціни на створення сайту",
      offers: [
        ["Лендінг / корпоративний сайт під ключ", 400],
        ["Інтернет-магазин під ключ", 900],
        ["Повна SEO-оптимізація сайту", 300],
        ["Підключення оплати на сайті", 400],
        ["Адмін-панель для самостійних правок", 300],
        ["Щомісячна підтримка сайту", 100],
      ],
    },
    en: {
      name: "Website development",
      desc: "Custom website development: landing pages from $400 and online stores from $900. Design, build, domain, launch, SEO basics and the first month of support free.",
      crumb: "Website pricing",
      offers: [
        ["Landing / corporate website", 400],
        ["Online store", 900],
        ["Full SEO optimisation", 300],
        ["Online payment integration", 400],
        ["Admin panel for self-service edits", 300],
        ["Monthly website support", 100],
      ],
    },
  },
  "landing.html": {
    uk: {
      name: "Створення лендінга під ключ",
      desc: "Розробка односторінкового сайту (лендінга) під ключ від $400: дизайн, верстка, тексти, домен, запуск і перший місяць підтримки безкоштовно. Строк від 4 днів.",
      crumb: "Лендінг під ключ",
      offers: [["Лендінг під ключ", 400], ["Копірайтинг для лендінга", 100], ["Онлайн-запис на послугу", 100]],
    },
    en: {
      name: "Landing page development",
      desc: "One-page landing site built end to end from $400: design, build, copy, domain, launch and the first month of support free. Live in four days.",
      crumb: "Landing page development",
      offers: [["Landing page", 400], ["Landing page copywriting", 100], ["Online booking", 100]],
    },
  },
  "online-store.html": {
    uk: {
      name: "Створення інтернет-магазину під ключ",
      desc: "Розробка інтернет-магазину під ключ від $900: каталог товарів, кошик, оформлення замовлення, оплата карткою, Нова Пошта та адмін-панель.",
      crumb: "Інтернет-магазин під ключ",
      offers: [
        ["Інтернет-магазин під ключ", 900],
        ["Оплата карткою, Google Pay, Apple Pay", 400],
        ["Інтеграція Нової Пошти", 200],
        ["Адмін-панель магазину", 300],
      ],
    },
    en: {
      name: "Online store development",
      desc: "Custom e-commerce store from $900: product catalogue, cart, checkout, card payments, delivery integration and an admin panel.",
      crumb: "Online store development",
      offers: [
        ["Online store", 900],
        ["Card, Google Pay and Apple Pay payments", 400],
        ["Delivery integration", 200],
        ["Store admin panel", 300],
      ],
    },
  },
};

/* The service pages keep each language in one big [data-lang-block] wrapper
   rather than per-sentence spans, so the two halves are split on the comment
   banners in the markup — a fixed anchor we control — instead of trying to
   regex-match a closing tag across nested divs. */
function pageFaq(html, lang) {
  const UK = "<!-- ==================== УКРАЇНСЬКА ==================== -->";
  const EN = "<!-- ==================== ENGLISH ==================== -->";
  const iUk = html.indexOf(UK);
  const iEn = html.indexOf(EN);
  if (iUk === -1 || iEn === -1) return [];
  const part = lang === "en"
    ? html.slice(iEn, html.indexOf("</main>", iEn))
    : html.slice(iUk, iEn);

  const strip = (t) => t
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&mdash;/g, "—")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .replace(/\s+/g, " ").trim();

  const out = [];
  for (const d of part.match(/<details[^>]*>[\s\S]*?<\/details>/g) || []) {
    const q = strip((d.match(/<summary>([\s\S]*?)<\/summary>/) || [])[1] || "");
    const a = (d.match(/<p>[\s\S]*?<\/p>/g) || []).map(strip).filter(Boolean).join(" ");
    if (q && a) out.push({ q, a });
  }
  return out;
}

function pageLd(file, lang) {
  const cfg = SERVICE_LD[file] && SERVICE_LD[file][lang];
  if (!cfg) return "";
  const base = ORIGIN + (lang === "en" ? "/en" : "");
  const self = base + (PAGE_PATH[file] || "/");
  const graph = [
    {
      "@type": "Service",
      "@id": self + "#service",
      name: cfg.name,
      description: cfg.desc,
      serviceType: cfg.name,
      provider: { "@id": ORIGIN + "/#studio" },
      areaServed: AREA_SERVED,
      availableLanguage: ["uk", "en"],
      url: self,
      offers: cfg.offers.map(([name, price]) => ({
        "@type": "Offer",
        name,
        price: String(price),
        priceCurrency: "USD",
        priceSpecification: {
          "@type": "PriceSpecification",
          price: String(price),
          priceCurrency: "USD",
          valueAddedTaxIncluded: false,
          // every figure on these pages is a floor, never a ceiling
          minPrice: String(price),
        },
        availability: "https://schema.org/InStock",
        url: self,
      })),
    },
    {
      "@type": "BreadcrumbList",
      "@id": self + "#crumbs",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "slv_visual", item: base + "/" },
        { "@type": "ListItem", position: 2, name: cfg.crumb, item: self },
      ],
    },
  ];

  const faq = pageFaq(PAGES[file], lang);
  if (faq.length >= 2) {
    graph.push({
      "@type": "FAQPage",
      "@id": self + "#faq",
      inLanguage: lang,
      mainEntity: faq.map((i) => ({
        "@type": "Question",
        name: i.q,
        acceptedAnswer: { "@type": "Answer", text: i.a },
      })),
    });
  }

  const json = JSON.stringify({ "@context": "https://schema.org", "@graph": graph })
    .replace(/</g, "\\u003c");
  return '  <script type="application/ld+json">' + json + "</script>";
}

/* Built once per isolate: the free plan caps CPU at 10ms per request, which is
   nowhere near enough to re-serialise this on every hit. */
const PAGE_LD = {};
for (const file of Object.keys(SERVICE_LD)) {
  PAGE_LD[file] = { uk: pageLd(file, "uk"), en: pageLd(file, "en") };
}

/* ------------------------------------------------------------------ pages */
function servePage(file, env, lang) {
  const version =
    (env.CF_VERSION && env.CF_VERSION.id ? String(env.CF_VERSION.id).slice(0, 8) : null) ||
    env.ASSET_V || "dev";

  const p = PAGE_PATH[file] || "/";
  const altUk = ORIGIN + p;
  const altEn = ORIGIN + "/en" + p;
  const meta = (META[file] && META[file][lang]) || null;

  let html = PAGES[file]
    .replace(/__V__/g, version)
    .replace(/__LANG__/g, lang)
    // "" or "/en": turns every in-site link into the copy in the same language
    .replace(/__BASE__/g, lang === "en" ? "/en" : "")
    .replace(/__CANON__/g, lang === "en" ? altEn : altUk)
    .replace(/__ALT_UK__/g, altUk)
    .replace(/__ALT_EN__/g, altEn)
    // anchors use the path alone: absolute URLs in an href would send anyone on
    // a preview or a staging host straight to production
    .replace(/__PATH_UK__/g, p)
    .replace(/__PATH_EN__/g, "/en" + p)
    .replace(/__OGLOCALE__/g, lang === "en" ? "en_US" : "uk_UA")
    .replace(/__OGALT__/g, lang === "en" ? "uk_UA" : "en_US");
  // function replacements, not strings: every title here contains "$400", and
  // String.replace reads "$4" in a replacement as a capture-group reference.
  if (meta) {
    html = html.replace(/__TITLE__/g, () => meta.title).replace(/__DESC__/g, () => meta.desc);
  }

  const ld = LD[lang] || LD.en;
  html = html
    .replace(/__LD_DESC__/g, ld.desc)
    .replace(/__LD_SLOGAN__/g, ld.slogan)
    .replace(/__LD_JOBTITLE__/g, ld.jobTitle)
    .replace(/__LD_SITEDESC__/g, ld.siteDesc)
    .replace(/__LD_SERVICETYPE__/g, JSON.stringify(ld.serviceType))
    .replace(/__LD_KNOWSABOUT__/g, JSON.stringify(ld.knowsAbout))
    .replace(/__LD_AREA__/g, () => JSON.stringify(AREA_SERVED))
    .replace(/__FAQ_LD__/g, file === "index.html" ? FAQ_LD[lang] || "" : "")
    .replace(/__PAGE_LD__/g, () => (PAGE_LD[file] && PAGE_LD[file][lang]) || "");

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Language": lang,
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
      if (path === "/admin" || path === "/admin.html") return servePage("admin.html", env, "en");

      const route = routePage(path);
      if (route) {
        /* One page, one URL. /projects.html and /en (without the slash) resolve
           to the same content, so they are folded into the canonical form
           rather than left as duplicates for Google to pick between. */
        const canonical = canonicalPath(route.file, route.lang);
        if (path !== canonical) return redirect(canonical + url.search);
        return servePage(route.file, env, route.lang);
      }

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
