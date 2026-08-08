/* Seeds the built-in team members and projects on first run (idempotent).
   Mirrors the defaults that used to live in js/main.js. */
const { db } = require("./db");

const TEAM = [
  { id: "sv-001", sort_order: 0, is_builtin: 1, code: "#SV-001",
    name_en: "YAROSLAV", name_uk: "ЯРОСЛАВ",
    role_en: "FOUNDER / DEVELOPER", role_uk: "ЗАСНОВНИК / РОЗРОБНИК",
    location_en: "UKRAINE", location_uk: "УКРАЇНА", status: "online",
    bio_en: "BUILDS FAST, DETAILED WEBSITES AND AUTOMATION — FROM DESIGN TO DEPLOYED PRODUCT.",
    bio_uk: "СТВОРЮЄ ШВИДКІ, ДЕТАЛЬНІ САЙТИ ТА АВТОМАТИЗАЦІЮ — ВІД ДИЗАЙНУ ДО ГОТОВОГО ПРОДУКТУ.",
    skills: [
      { label_en: "FRONTEND", label_uk: "FRONTEND", level: 9 },
      { label_en: "DESIGN", label_uk: "ДИЗАЙН", level: 10 },
      { label_en: "BACKEND", label_uk: "BACKEND", level: 9 },
      { label_en: "AI / AUTOMATION", label_uk: "AI / АВТОМАТИЗАЦІЯ", level: 8 },
      { label_en: "DEVOPS", label_uk: "DEVOPS", level: 10 },
    ],
    photo_url: "img/yaroslav.jpg" },
  { id: "sv-002", sort_order: 1, is_builtin: 1, code: "#SV-002",
    name_en: "OLEKSANDR", name_uk: "ОЛЕКСАНДР",
    role_en: "COLLABORATOR", role_uk: "ПАРТНЕР",
    location_en: "UKRAINE", location_uk: "УКРАЇНА", status: "online",
    bio_en: "FULL-STACK DEVELOPER WITH A FOCUS ON AUTOMATION AND QUALITY.",
    bio_uk: "FULL-STACK РОЗРОБНИК З ФОКУСОМ НА АВТОМАТИЗАЦІЮ ТА ЯКІСТЬ.",
    skills: [
      { label_en: "FRONTEND", label_uk: "FRONTEND", level: 7 },
      { label_en: "BACKEND", label_uk: "BACKEND", level: 8 },
      { label_en: "DEVOPS", label_uk: "DEVOPS", level: 6 },
      { label_en: "DESIGN", label_uk: "ДИЗАЙН", level: 6 },
    ],
    photo_url: "img/oleksandr.jpg" },
  { id: "sv-003", sort_order: 2, is_builtin: 1, code: "#SV-003",
    name_en: "ROMAN", name_uk: "РОМАН",
    role_en: "PARTNER", role_uk: "ПАРТНЕР",
    location_en: "UKRAINE", location_uk: "УКРАЇНА", status: "online",
    bio_en: "FRONT-END DEVELOPER BUILDING FAST, PIXEL-PERFECT INTERFACES.",
    bio_uk: "FRONT-END РОЗРОБНИК, СТВОРЮЄ ШВИДКІ, ПІКСЕЛЬ-ПЕРФЕКТНІ ІНТЕРФЕЙСИ.",
    skills: [
      { label_en: "FRONTEND", label_uk: "FRONTEND", level: 10 },
      { label_en: "BACKEND", label_uk: "BACKEND", level: 8 },
      { label_en: "DESIGN", label_uk: "ДИЗАЙН", level: 6 },
      { label_en: "DEVOPS", label_uk: "DEVOPS", level: 8 },
    ],
    photo_url: "img/roman.jpg" },
];

const PROJECTS = [
  { id: 0, title: "GREENING AFRICA", case_label: "CASE 001 — 2026", status: "■ DESIGN",
    tags: "FIGMA, GSAP, LANDING", link: "", image_url: "img/greening-africa.png",
    desc_en: "LANDING PAGE FOR A COLLECTIVE REFORESTATION INITIATIVE.",
    desc_uk: "ЛЕНДІНГ ДЛЯ КОЛЕКТИВНОЇ ІНІЦІАТИВИ ВІДНОВЛЕННЯ ЛІСІВ." },
  { id: 1, title: "МЕЛМАН", case_label: "CASE 002 — 2026", status: "● LIVE",
    tags: "E-COMMERCE, JS, NETLIFY", link: "https://melman.shop/", image_url: "img/melman.png",
    desc_en: "MERCH STORE FOR THE #1 OSTRICH IN UKRAINIAN TIKTOK.",
    desc_uk: "МАГАЗИН МЕРЧУ СТРАУСА №1 В УКРАЇНСЬКОМУ ТІКТОК." },
  { id: 2, title: "MOCLAME HOME", case_label: "CASE 003 — 2026", status: "■ IN DEV",
    tags: "3D, THREE.JS, SHOP", link: "", image_url: "img/moclame-home.png",
    desc_en: "E-COMMERCE FOR 3D-PRINTED HOME DECOR WITH LIVE 3D PREVIEWS.",
    desc_uk: "МАГАЗИН 3D-ДРУКОВАНОГО ДЕКОРУ З ЖИВИМ 3D-ПЕРЕГЛЯДОМ." },
];

function seed() {
  const teamCount = db.prepare("SELECT COUNT(*) AS n FROM team_members").get().n;
  if (teamCount === 0) {
    const ins = db.prepare(`INSERT INTO team_members
      (id, sort_order, is_builtin, code, name_en, name_uk, role_en, role_uk,
       location_en, location_uk, bio_en, bio_uk, status, skills, photo_url)
      VALUES (:id,:sort_order,:is_builtin,:code,:name_en,:name_uk,:role_en,:role_uk,
       :location_en,:location_uk,:bio_en,:bio_uk,:status,:skills,:photo_url)`);
    for (const m of TEAM) ins.run({ ...m, skills: JSON.stringify(m.skills) });
    console.log(`[seed] inserted ${TEAM.length} team members`);
  }

  // Projects are seeded exactly once, tracked by a marker row. Without the
  // marker, an admin who deletes every project would see the built-in three
  // reappear on the next restart (the old "table is empty -> seed" check).
  const seeded = db.prepare("SELECT value FROM meta WHERE key = 'projects_seeded'").get();
  const projCount = db.prepare("SELECT COUNT(*) AS n FROM projects").get().n;
  if (!seeded) {
    if (projCount === 0) {
      const ins = db.prepare(`INSERT INTO projects
        (id, title, case_label, status, tags, link, image_url, desc_en, desc_uk)
        VALUES (:id,:title,:case_label,:status,:tags,:link,:image_url,:desc_en,:desc_uk)`);
      for (const p of PROJECTS) ins.run(p);
      console.log(`[seed] inserted ${PROJECTS.length} projects`);
    }
    // mark as seeded either way: an existing DB has already been through this
    db.prepare("INSERT INTO meta (key, value) VALUES ('projects_seeded', ?)").run(new Date().toISOString());
  }
}

module.exports = { seed };

if (require.main === module) { seed(); console.log("[seed] done"); }
