/* ==========================================================
   KVS-style portfolio — boot, splash, ascii hero, glitch,
   scramble text, typewriter, tabs, terminal form.
   ========================================================== */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

/* ---------- 0. LOCALIZATION (EN / UK) ---------- */
// builds the interactive service rows: index / name / hover tag / click-to-expand description
const SVC_ROWS = rows => rows.map(([name, tag, desc], i) =>
  `<li><div class="s-row"><span class="s-idx">00${i + 1}</span><span class="s-name">&lt;${name}&gt;</span><span class="s-tag">${tag}</span><span class="s-plus">+</span></div><div class="s-desc"><p>${desc}</p></div></li>`).join("");

// builds a team member "dossier": data rows + bio + animated ASCII skill bars
const DOSSIER = ({ rows, bio, skills }) =>
  rows.map(([k, v]) => `<div class="d-row"><span>${k}</span><b>${v}</b></div>`).join("") +
  `<p class="d-bio">${bio}</p>` +
  skills.map(([k, lv]) =>
    `<div class="d-skill" data-lv="${lv}"><span>${k}</span><i></i><em>${lv}/10</em></div>`).join("");

// ---- team model (source of truth for the founder + partners) --------------
const readLS = (k, fb) => { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch (_) { return fb; } };

// the three status states the admin can pick, with their dossier styling
const STATUSES = {
  online:  { label: { en: "● ONLINE",  uk: "● ОНЛАЙН" },  cls: "d-online" },
  offline: { label: { en: "● OFFLINE", uk: "● ОФЛАЙН" },  cls: "d-offline" },
  atwork:  { label: { en: "● AT WORK", uk: "● В РОБОТІ" }, cls: "d-atwork" },
};
// localized dossier row labels
const ROW_L = {
  id:       { en: "ID", uk: "ID" },
  role:     { en: "ROLE", uk: "РОЛЬ" },
  location: { en: "LOCATION", uk: "ЛОКАЦІЯ" },
  status:   { en: "STATUS", uk: "СТАТУС" },
};

// built-in members — structured so the admin page can edit every field
const TEAM_DEFAULTS = [
  { name: { en: "YAROSLAV", uk: "ЯРОСЛАВ" }, id: "#SV-001",
    role: { en: "FOUNDER / DEVELOPER", uk: "ЗАСНОВНИК / РОЗРОБНИК" },
    location: { en: "UKRAINE", uk: "УКРАЇНА" }, status: "online",
    bio: { en: "BUILDS FAST, DETAILED WEBSITES AND AUTOMATION — FROM DESIGN TO DEPLOYED PRODUCT.",
           uk: "СТВОРЮЄ ШВИДКІ, ДЕТАЛЬНІ САЙТИ ТА АВТОМАТИЗАЦІЮ — ВІД ДИЗАЙНУ ДО ГОТОВОГО ПРОДУКТУ." },
    skills: [{ label: { en: "FRONTEND", uk: "FRONTEND" }, level: 9 }, { label: { en: "DESIGN", uk: "ДИЗАЙН" }, level: 10 },
             { label: { en: "BACKEND", uk: "BACKEND" }, level: 9 }, { label: { en: "AI / AUTOMATION", uk: "AI / АВТОМАТИЗАЦІЯ" }, level: 8 },
             { label: { en: "DEVOPS", uk: "DEVOPS" }, level: 10 }],
    photo: "img/yaroslav.jpg" },
  { name: { en: "OLEKSANDR", uk: "ОЛЕКСАНДР" }, id: "#SV-002",
    role: { en: "COLLABORATOR", uk: "ПАРТНЕР" },
    location: { en: "UKRAINE", uk: "УКРАЇНА" }, status: "online",
    bio: { en: "FULL-STACK DEVELOPER WITH A FOCUS ON AUTOMATION AND QUALITY.",
           uk: "FULL-STACK РОЗРОБНИК З ФОКУСОМ НА АВТОМАТИЗАЦІЮ ТА ЯКІСТЬ." },
    skills: [{ label: { en: "FRONTEND", uk: "FRONTEND" }, level: 7 }, { label: { en: "BACKEND", uk: "BACKEND" }, level: 8 },
             { label: { en: "DEVOPS", uk: "DEVOPS" }, level: 6 }, { label: { en: "DESIGN", uk: "ДИЗАЙН" }, level: 6 }],
    photo: "img/oleksandr.jpg" },
  { name: { en: "ROMAN", uk: "РОМАН" }, id: "#SV-003",
    role: { en: "PARTNER", uk: "ПАРТНЕР" },
    location: { en: "UKRAINE", uk: "УКРАЇНА" }, status: "online",
    bio: { en: "FRONT-END DEVELOPER BUILDING FAST, PIXEL-PERFECT INTERFACES.",
           uk: "FRONT-END РОЗРОБНИК, СТВОРЮЄ ШВИДКІ, ПІКСЕЛЬ-ПЕРФЕКТНІ ІНТЕРФЕЙСИ." },
    skills: [{ label: { en: "FRONTEND", uk: "FRONTEND" }, level: 10 }, { label: { en: "BACKEND", uk: "BACKEND" }, level: 8 },
             { label: { en: "DESIGN", uk: "ДИЗАЙН" }, level: 6 }, { label: { en: "DEVOPS", uk: "DEVOPS" }, level: 8 }],
    photo: "img/roman.jpg" },
];

// admin edits are single-language strings → apply to both en/uk when set
const mergeMember = (def, ov) => {
  if (!ov) return def;
  const pick = (pair, v) => (v != null && v !== "") ? { en: v, uk: v } : pair;
  return {
    name: pick(def.name, ov.name), id: def.id,
    role: pick(def.role, ov.role),
    location: pick(def.location, ov.location),
    status: ov.status || def.status,
    bio: pick(def.bio, ov.bio),
    skills: (ov.skills && ov.skills.length)
      ? ov.skills.map(s => ({ label: { en: (s.name || "").toUpperCase(), uk: (s.name || "").toUpperCase() }, level: +s.level || 0 }))
      : def.skills,
    photo: (ov.photo != null && ov.photo !== "") ? ov.photo : def.photo,
  };
};

// render a member (built-in or added partner) into a dossier for one language
const memberDossier = (m, lang) => {
  const st = STATUSES[m.status] || STATUSES.online;
  return DOSSIER({
    rows: [
      [ROW_L.id[lang], m.id],
      [ROW_L.role[lang], m.role[lang]],
      [ROW_L.location[lang], m.location[lang]],
      [ROW_L.status[lang], `<span class="${st.cls}">${st.label[lang]}</span>`],
    ],
    bio: m.bio[lang],
    skills: m.skills.map(s => [s.label[lang], s.level]),
  });
};

// builds the "how we work" process timeline shown in the contact sidebar
const PROCESS = (steps, title) =>
  `<div class="p-title">${title}</div>` +
  steps.map(([name, desc], i) =>
    `<div class="p-step"><span class="p-num">0${i + 1}</span><div class="p-body"><b>${name}</b><p>${desc}</p></div></div>`).join("");

// builds the client ledger rows: year / name / project type / hover id
const CLI_ROWS = rows => rows.map(([year, name, type, note]) =>
  `<li><span class="c-year">${year}</span><span class="c-name">&lt;${name}&gt;</span>${note ? `<span class="muted c-note">${note}</span>` : ""}<span class="c-type">${type}</span><span class="c-id"></span></li>`).join("");

const I18N = {
  enter:        { en: "CLICK TO ENTER", uk: "НАТИСНИ, ЩОБ УВІЙТИ" },
  tagline:      { en: "&lt;COMPREHENSIVE WEBSITE DEVELOPMENT<br>FOR THOSE WHO VALUE<br>QUALITY AND SPEED&gt;",
                  uk: "&lt;КОМПЛЕКСНА РОЗРОБКА САЙТІВ<br>ДЛЯ ТИХ, ХТО ЦІНУЄ<br>ЯКІСТЬ І ШВИДКІСТЬ&gt;" },
  calcBtn:      { en: "CALCULATE THE PRICE", uk: "РОЗРАХУВАТИ ВАРТІСТЬ" },
  heroLine:     { en: "&lt;PRICE YOUR FUTURE WEBSITE IN 30 SECONDS.<br>PICK THE DEVELOPER, THE BLOCKS AND THE INTEGRATIONS —<br>AND <b>SEE AN HONEST FIGURE</b>, WITH NO CALLS AND NO WAITING.<br>WEBSITES FROM $400&gt;",
                  uk: "&lt;РОЗРАХУЙ ВАРТІСТЬ СВОГО МАЙБУТНЬОГО САЙТУ ЗА 30 СЕКУНД.<br>ОБЕРИ РОЗРОБНИКА, БЛОКИ ТА ІНТЕГРАЦІЇ —<br>І <b>ПОБАЧ ЧЕСНУ ЦІНУ</b>, БЕЗ ДЗВІНКІВ І ОЧІКУВАННЯ.<br>САЙТИ — ВІД $400&gt;" },
  breakBtn:     { en: "CLICK TO BREAK", uk: "НАТИСНИ — РОЗБИЙ" },
  tgBtn:        { en: "→ TELEGRAM", uk: "→ ТЕЛЕГРАМ" },
  descGreening: { en: "LANDING PAGE FOR A COLLECTIVE REFORESTATION INITIATIVE.",
                  uk: "ЛЕНДІНГ ДЛЯ КОЛЕКТИВНОЇ ІНІЦІАТИВИ ВІДНОВЛЕННЯ ЛІСІВ." },
  descMelman:   { en: "MERCH STORE FOR THE #1 OSTRICH IN UKRAINIAN TIKTOK.",
                  uk: "МАГАЗИН МЕРЧУ СТРАУСА №1 В УКРАЇНСЬКОМУ ТІКТОК." },
  descMoclame:  { en: "E-COMMERCE FOR 3D-PRINTED HOME DECOR WITH LIVE 3D PREVIEWS.",
                  uk: "МАГАЗИН 3D-ДРУКОВАНОГО ДЕКОРУ З ЖИВИМ 3D-ПЕРЕГЛЯДОМ." },
  quoteLabel:   { en: "&lt;STRAIGHT FROM THE CLIENT&gt;", uk: "&lt;ПРЯМА МОВА КЛІЄНТА&gt;" },
  qMeta:        { en: "INCOMING TRANSMISSION // SRC: TIKTOK", uk: "ВХІДНА ПЕРЕДАЧА // ДЖЕРЕЛО: TIKTOK" },
  qStamp:       { en: "✓ VERIFIED CLIENT · 10,000%", uk: "✓ ПІДТВЕРДЖЕНИЙ КЛІЄНТ · 10 000%" },
  qReplay:      { en: "↻ REPLAY", uk: "↻ ВІДТВОРИТИ ЩЕ РАЗ" },
  quoteText:    { en: '"THE WEBSITE IS EXCEPTIONALLY WELL-MADE, NOTHING GLITCHES, EVERYTHING WORKS GREAT, AND MOST IMPORTANTLY — IT\'S FAST. VERY FAST. THANK YOU FOR YOUR WORK! IT\'S 10,000% PERFECT. I HIGHLY RECOMMEND THIS DEVELOPER — HE\'S A VERY TALENTED GUY."',
                  uk: '"САЙТ ЗРОБЛЕНИЙ НАДЗВИЧАЙНО ЯКІСНО, НІЧОГО НЕ ГЛЮЧИТЬ, УСЕ ПРАЦЮЄ ЧУДОВО, А ГОЛОВНЕ — ШВИДКО. ДУЖЕ ШВИДКО. ДЯКУЮ ЗА РОБОТУ! ЦЕ ІДЕАЛЬНО НА 10 000%. ДУЖЕ РЕКОМЕНДУЮ ЦЬОГО РОЗРОБНИКА — ВІН ДУЖЕ ТАЛАНОВИТИЙ."' },
  quoteAuthor:  { en: '<a data-tip="TIKTOK: @VALERICH_OFFICIAL ↗" href="https://www.tiktok.com/@valerich_official" target="_blank" rel="noopener noreferrer">&lt;@VALERICH_OFFICIAL&gt; ↗</a><br>&lt;BLOGGER AND OWNER / OSTRICH FARM&gt;',
                  uk: '<a data-tip="TIKTOK: @VALERICH_OFFICIAL ↗" href="https://www.tiktok.com/@valerich_official" target="_blank" rel="noopener noreferrer">&lt;@VALERICH_OFFICIAL&gt; ↗</a><br>&lt;БЛОГЕР І ВЛАСНИК / СТРАУСИНА ФЕРМА&gt;' },
  // member0-2 / bio0-2 are generated from TEAM_DEFAULTS (+ admin overrides)
  // by renderBuiltinTeam() below, so status/info edits flow through one model.
  servicesLabel:{ en: "&lt;WHAT WE'RE CAPABLE OF&gt;", uk: "&lt;НА ЩО МИ ЗДАТНІ&gt;" },
  servicesList: { en: SVC_ROWS([
                    ["WEB DESIGN", "LANDINGS / UI",
                     "LANDING PAGES, PORTFOLIOS AND MARKETING SITES DESIGNED IN FIGMA — WITH STRUCTURE, TYPOGRAPHY AND MOTION THOUGHT THROUGH BEFORE A SINGLE LINE OF CODE."],
                    ["MOTION &amp; INTERACTION DESIGN", "GSAP / 3D / WEBGL",
                     "SCROLL CHOREOGRAPHY, 3D SCENES, GLITCH AND ASCII EFFECTS — THE KIND OF DETAILS THAT MAKE A SITE MEMORABLE INSTEAD OF JUST FUNCTIONAL."],
                    ["FRONTEND DEVELOPMENT", "REACT / VUE / TS",
                     "FAST, RESPONSIVE, PIXEL-ACCURATE INTERFACES IN REACT, VUE OR VANILLA JS/TS. CLEAN CODE, SEO BASICS AND PERFORMANCE BUDGETS INCLUDED."],
                    ["BACKEND DEVELOPMENT", "NODE / API / DB",
                     "APIS, DATABASES, AUTH, PAYMENTS AND INTEGRATIONS ON NODE.JS — THE INVISIBLE PART THAT KEEPS EVERYTHING RELIABLE AND SECURE."],
                    ["WEB APPS", "PWA / SPA",
                     "FULL PRODUCTS, NOT JUST PAGES: DASHBOARDS, STORES, BOOKING SYSTEMS AND PWAS THAT WORK OFFLINE AND FEEL NATIVE."],
                    ["AI AGENTS", "AUTOMATION / BOTS",
                     "CHATBOTS, LLM INTEGRATIONS AND WORKFLOW AUTOMATION THAT ANSWER CLIENTS, FILL SPREADSHEETS AND SAVE YOU HOURS EVERY WEEK."],
                  ]),
                  uk: SVC_ROWS([
                    ["ВЕБДИЗАЙН", "ЛЕНДІНГИ / UI",
                     "ЛЕНДІНГИ, ПОРТФОЛІО ТА МАРКЕТИНГОВІ САЙТИ, СПРОЄКТОВАНІ У FIGMA — ЗІ СТРУКТУРОЮ, ТИПОГРАФІКОЮ Й АНІМАЦІЄЮ, ПРОДУМАНИМИ ЩЕ ДО ПЕРШОГО РЯДКА КОДУ."],
                    ["МОУШН ТА ІНТЕРАКТИВНИЙ ДИЗАЙН", "GSAP / 3D / WEBGL",
                     "СКРОЛ-ХОРЕОГРАФІЯ, 3D-СЦЕНИ, ГЛІТЧ- ТА ASCII-ЕФЕКТИ — ДЕТАЛІ, ЯКІ РОБЛЯТЬ САЙТ ЗАПАМ'ЯТОВУВАНИМ, А НЕ ПРОСТО ФУНКЦІОНАЛЬНИМ."],
                    ["FRONTEND-РОЗРОБКА", "REACT / VUE / TS",
                     "ШВИДКІ, АДАПТИВНІ, ПІКСЕЛЬ-ТОЧНІ ІНТЕРФЕЙСИ НА REACT, VUE АБО ЧИСТОМУ JS/TS. ЧИСТИЙ КОД, БАЗОВЕ SEO ТА КОНТРОЛЬ ПРОДУКТИВНОСТІ ВКЛЮЧЕНО."],
                    ["BACKEND-РОЗРОБКА", "NODE / API / БД",
                     "API, БАЗИ ДАНИХ, АВТОРИЗАЦІЯ, ОПЛАТИ ТА ІНТЕГРАЦІЇ НА NODE.JS — НЕВИДИМА ЧАСТИНА, ЩО ТРИМАЄ ВСЕ НАДІЙНИМ І БЕЗПЕЧНИМ."],
                    ["ВЕБЗАСТОСУНКИ", "PWA / SPA",
                     "ПОВНОЦІННІ ПРОДУКТИ, А НЕ ПРОСТО СТОРІНКИ: ДАШБОРДИ, МАГАЗИНИ, СИСТЕМИ БРОНЮВАННЯ ТА PWA, ЩО ПРАЦЮЮТЬ ОФЛАЙН І ВІДЧУВАЮТЬСЯ ЯК НАТИВНІ."],
                    ["AI-АГЕНТИ", "АВТОМАТИЗАЦІЯ / БОТИ",
                     "ЧАТ-БОТИ, ІНТЕГРАЦІЇ LLM ТА АВТОМАТИЗАЦІЯ ПРОЦЕСІВ, ЩО ВІДПОВІДАЮТЬ КЛІЄНТАМ, ЗАПОВНЮЮТЬ ТАБЛИЦІ Й ЕКОНОМЛЯТЬ ГОДИНИ ЩОТИЖНЯ."],
                  ]) },
  servicesCta:  { en: "→ START A PROJECT — FROM $400", uk: "→ ПОЧАТИ ПРОЄКТ — ВІД $400" },
  clientsLabel: { en: "&lt;WE'RE BEING ELECTED&gt;", uk: "&lt;НАС ОБИРАЮТЬ&gt;" },
  clientsList:  { en: CLI_ROWS([
                    ["2026", "MOCLAME HOME", "E-COMMERCE"],
                    ["2026", "MELMAN", "BRAND / LANDING PAGE"],
                    ["2026", "DROPZONE", "E-COMMERCE / REDESIGN"],
                    ["2026", "KRUTA", "E-COMMERCE / REDESIGN"],
                    ["2025", "SLV.VISUAL", "LANDING PAGE / PORTFOLIO", "our product :)"],
                  ]),
                  uk: CLI_ROWS([
                    ["2026", "MOCLAME HOME", "E-COMMERCE"],
                    ["2026", "MELMAN", "БРЕНД / ЛЕНДІНГ"],
                    ["2026", "DROPZONE", "E-COMMERCE / РЕДИЗАЙН"],
                    ["2026", "KRUTA", "E-COMMERCE / РЕДИЗАЙН"],
                    ["2025", "SLV.VISUAL", "ЛЕНДІНГ / ПОРТФОЛІО", "наш продукт :)"],
                  ]) },
  contactLabel: { en: "TELL US WHAT CAN WE DO FOR YOU?", uk: "РОЗКАЖИ, ЩО МИ МОЖЕМО ЗРОБИТИ ДЛЯ ТЕБЕ?" },
  process:      { en: PROCESS([
                    ["BRIEFING", "WE DISCUSS YOUR GOALS, AUDIENCE AND BUDGET. FREE AND WITH NO OBLIGATIONS."],
                    ["FRONTEND DESIGN", "LAYOUT, TYPOGRAPHY, ANIMATIONS AND RESPONSIVENESS — THE VISUAL PART OF YOUR SITE, BUILT DIRECTLY IN CODE AND APPROVED BY YOU AT EVERY STAGE."],
                    ["DEVELOPMENT", "CODE, ANIMATIONS AND INTEGRATIONS, WITH DEMO LINKS ALONG THE WAY."],
                    ["TESTING", "SPEED, MOBILE, FORMS AND SEO BASICS — EVERYTHING CHECKED BEFORE RELEASE."],
                    ["LAUNCH", "DEPLOY, DOMAIN SETUP AND 30 DAYS OF FREE SUPPORT AFTER GO-LIVE."],
                  ], "// HOW WE WORK"),
                  uk: PROCESS([
                    ["БРИФІНГ", "ОБГОВОРЮЄМО ЦІЛІ, АУДИТОРІЮ ТА БЮДЖЕТ. БЕЗКОШТОВНО І БЕЗ ЗОБОВ'ЯЗАНЬ."],
                    ["FRONTEND-ДИЗАЙН", "СТРУКТУРА, ТИПОГРАФІКА, АНІМАЦІЇ ТА АДАПТИВНІСТЬ — ВІЗУАЛЬНА ЧАСТИНА САЙТУ, СТВОРЕНА ОДРАЗУ В КОДІ, І ТИ ЗАТВЕРДЖУЄШ КОЖЕН ЕТАП."],
                    ["РОЗРОБКА", "КОД, АНІМАЦІЇ ТА ІНТЕГРАЦІЇ, З ДЕМО-ПОСИЛАННЯМИ ПО ХОДУ РОБОТИ."],
                    ["ТЕСТУВАННЯ", "ШВИДКІСТЬ, МОБІЛЬНІ, ФОРМИ ТА БАЗОВЕ SEO — УСЕ ПЕРЕВІРЯЄТЬСЯ ДО РЕЛІЗУ."],
                    ["ЗАПУСК", "ДЕПЛОЙ, НАЛАШТУВАННЯ ДОМЕНУ ТА 30 ДНІВ БЕЗКОШТОВНОЇ ПІДТРИМКИ."],
                  ], "// ЯК МИ ПРАЦЮЄМО") },
  fContact:     { en: "&gt; PHONE NUMBER OR TELEGRAM", uk: "&gt; НОМЕР ТЕЛЕФОНУ АБО НІК В ТЕЛЕГРАМ" },
  fBudget:      { en: "&gt; WHAT IS YOUR BUDGET FOR THE PROJECT?", uk: "&gt; ЯКИЙ БЮДЖЕТ ПРОЄКТУ?" },
  fMessage:     { en: "&gt; MESSAGE", uk: "&gt; ПОВІДОМЛЕННЯ" },
  transmit:     { en: "TRANSMIT", uk: "НАДІСЛАТИ" },
  viewAll:      { en: "VIEW ALL PROJECTS →", uk: "ДИВИТИСЯ ВСІ ПРОЄКТИ →" },
  footerName:   { en: "&lt;YAROSLAV / slv_visual&gt;", uk: "&lt;ЯРОСЛАВ / slv_visual&gt;" },
  footerPrivacy:{ en: "PRIVACY POLICY", uk: "КОНФІДЕНЦІЙНІСТЬ" },
  footerTerms:  { en: "TERMS OF USE", uk: "УМОВИ ВИКОРИСТАННЯ" },
  footerContact:{ en: "CONTACT", uk: "КОНТАКТ" },
};
const TERMINAL_LINES = {
  en: ["INITIALISING SECURE CONNECTION...", "ENCRYPTING PAYLOAD...",
       "TRANSMITTING TO SERVER...", "VERIFYING RECEIPT...",
       "> MESSAGE SENT. WE'LL BE IN TOUCH."],
  uk: ["ІНІЦІАЛІЗАЦІЯ ЗАХИЩЕНОГО З'ЄДНАННЯ...", "ШИФРУВАННЯ ДАНИХ...",
       "ПЕРЕДАЧА НА СЕРВЕР...", "ПЕРЕВІРКА ОТРИМАННЯ...",
       "> ПОВІДОМЛЕННЯ НАДІСЛАНО. МИ НА ЗВ'ЯЗКУ."],
};

let lang = localStorage.getItem("lang") || "en";
let quoteTyped = false;
function setLang(next) {
  lang = next;
  localStorage.setItem("lang", lang);
  document.documentElement.lang = lang;
  // drives the [data-lang-block] sections (why / CTA), which are plain markup
  // rather than I18N dict entries — same mechanism as the info pages
  document.documentElement.setAttribute("data-lang", lang);
  $$("[data-i18n]").forEach(el => {
    const t = I18N[el.dataset.i18n];
    if (!t) return;
    el.innerHTML = t[lang];
    delete el.dataset.original; delete el.dataset.originalHtml; // reset scramble cache
  });
  $$(".lang-btn").forEach(b => b.classList.toggle("is-active", b.dataset.lang === lang));
  // if the quote already finished typing, swap it instantly
  if (quoteTyped) $("#typewriter").textContent = I18N.quoteText[lang];
}
document.addEventListener("click", e => {
  const btn = e.target.closest(".lang-btn");
  if (btn) setLang(btn.dataset.lang);
});

// generate the built-in members' i18n from TEAM_DEFAULTS + admin overrides,
// and publish the structured defaults so the admin page shows accurate values
function renderBuiltinTeam() {
  const ov = readLS("slv_team_overrides", {});
  TEAM_DEFAULTS.forEach((def, i) => {
    const m = mergeMember(def, ov[i]);
    I18N["member" + i] = { en: `&lt;${m.name.en}&gt;`, uk: `&lt;${m.name.uk}&gt;` };
    I18N["bio" + i] = { en: memberDossier(m, "en"), uk: memberDossier(m, "uk") };
  });
  try { localStorage.setItem("slv_team_defaults", JSON.stringify(TEAM_DEFAULTS)); } catch (_) {}
}
renderBuiltinTeam();
setLang(lang);

/* ---------- 1. BOOT LOADER ---------- */
const bootEl = $("#boot");
const pctEl = $("#boot-pct");
let pct = 0;
const bootTimer = setInterval(() => {
  pct = Math.min(100, pct + Math.ceil(Math.random() * 9));
  pctEl.textContent = pct;
  if (pct >= 100) {
    clearInterval(bootTimer);
    setTimeout(showSplash, 400);
  }
}, 90);

/* ---------- 2. SPLASH (ASCII logo + enter) ---------- */
const SPLASH_LOGO = String.raw`
 ██████╗ ██╗   ██╗
██╔════╝ ██║   ██║
╚█████╗  ██║   ██║
 ╚═══██╗ ╚██╗ ██╔╝
██████╔╝  ╚████╔╝
╚═════╝    ╚═══╝
    slv_visual
`;

function showSplash() {
  bootEl.hidden = true;
  const splash = $("#splash");
  splash.hidden = false;
  // halftone-ish reveal: draw logo line by line with noise chars
  const target = SPLASH_LOGO;
  const pre = $("#splash-logo");
  let frame = 0;
  const noise = "░▒▓█▚▞·:+*";
  const anim = setInterval(() => {
    frame++;
    pre.textContent = target
      .split("")
      .map((c, i) =>
        c === "\n" || c === " " ? c
        : i < frame * 14 ? c
        : noise[(Math.random() * noise.length) | 0])
      .join("");
    if (frame * 14 > target.length) { clearInterval(anim); pre.textContent = target; }
  }, 40);
}

let entering = false;
function enterSite() {
  const splash = $("#splash");
  if (splash.hidden || entering) return;
  entering = true;
  splash.classList.add("is-exiting");
  setTimeout(() => {
    splash.hidden = true;
    const site = $("#site");
    site.hidden = false;
    requestAnimationFrame(() => site.classList.add("is-on"));
    startHero();
    observeSections();
  }, 650);
}
$("#enter-btn").addEventListener("click", enterSite);
addEventListener("keydown", e => {
  if (e.key === "Enter" && !$("#splash").hidden) enterSite();
});

/* ---------- old-TV flicker: random bands, looping forever ---------- */
{
  const band = document.createElement("div");
  band.className = "tv-flicker";
  document.body.appendChild(band);
  (function loop() {
    band.style.top = Math.random() * 90 + "vh";
    band.style.height = 30 + Math.random() * 120 + "px";
    band.classList.remove("is-on");
    void band.offsetWidth; // restart animation
    band.classList.add("is-on");
    setTimeout(loop, 600 + Math.random() * 2500);
  })();
}

/* ---------- 2b. CURSOR TRAIL (sparse dim symbols following the mouse) ---------- */
{
  const cv = document.createElement("canvas");
  cv.style.cssText = "position:fixed;inset:0;z-index:85;pointer-events:none;";
  document.body.appendChild(cv);
  const ctx = cv.getContext("2d");
  const TRAIL_CHARS = "·:;+*x%#?!<>[]{}=~^";
  const parts = [];
  let lastSpawn = 0;

  function fit() { cv.width = innerWidth; cv.height = innerHeight; }
  fit();
  addEventListener("resize", fit);

  addEventListener("pointermove", e => {
    const now = performance.now();
    // +30% spawn rate vs before (~38ms window, 78% chance)
    if (now - lastSpawn < 38 || Math.random() > 0.78) return;
    lastSpawn = now;
    parts.push({
      x: e.clientX + (Math.random() - 0.5) * 46,
      y: e.clientY + (Math.random() - 0.5) * 46,
      vx: (Math.random() - 0.5) * 0.6,
      vy: 0.2 + Math.random() * 0.4,   // initial fall speed
      sway: Math.random() * Math.PI * 2, // phase for side-to-side wobble
      c: TRAIL_CHARS[(Math.random() * TRAIL_CHARS.length) | 0],
      life: 1,
      size: 10 + Math.random() * 5,
    });
    if (parts.length > 78) parts.shift();
  });

  (function draw() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    const onSplash = !$("#splash").hidden || !$("#boot").hidden;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= 0.016;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      // falling debris: gravity pulls down, symbols sway like leaves
      p.vy += 0.045;
      p.sway += 0.12;
      p.x += p.vx + Math.sin(p.sway) * 0.8;
      p.y += p.vy;
      // +20% brighter than before (max ~36% alpha)
      const a = (p.life * 0.36).toFixed(3);
      ctx.fillStyle = onSplash ? `rgba(20,20,20,${a})` : `rgba(232,60,50,${a})`;
      ctx.font = `${p.size | 0}px monospace`;
      ctx.fillText(p.c, p.x, p.y);
    }
    requestAnimationFrame(draw);
  })();
}

/* ---------- 2c. SPINNING 3D LOGO on the hero ---------- */
function startHeroLogo() {
  const pre = $("#hero-logo");
  // the SV art from the splash, without the caption line
  const target = SPLASH_LOGO
    .split("\n")
    .filter(l => l.trim() && !l.includes("slv_visual"))
    .join("\n");

  // real 3D: stack copies of the text along Z so the spinning logo has an
  // actual extruded side face when seen edge-on. On phones, fewer slices — 8
  // preserve-3d layers spinning is a heavy composite there; 3 still reads as 3D.
  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const LOW = REDUCED || matchMedia("(max-width:768px), (hover:none), (pointer:coarse)").matches;
  const LAYERS = LOW ? 3 : 8, GAP = 4; // slices 4px apart
  const layers = [];
  for (let i = 0; i < LAYERS; i++) {
    const l = document.createElement("pre");
    l.className = "logo-layer";
    l.style.transform = `translateZ(${-i * GAP}px)`;
    pre.appendChild(l);
    layers.push(l);
  }
  const setText = t => layers.forEach(l => (l.textContent = t));

  // "printed out as code": characters appear one chunk at a time as random
  // digits/code glyphs, then resolve into the art; spin starts when done.
  const CODE = "0123456789<>/{}[]=+#$%&";
  let printed = 0;                 // how many chars are on screen so far
  let frame = 0;
  const SPEED = 1.5;               // chars added per frame (halved = slower print)
  const SETTLE = 26;               // chars behind the print head still scrambling
  (function print() {
    frame++;
    printed = Math.floor(frame * SPEED);
    setText(target
      .split("")
      .map((c, i) => {
        if (/\s/.test(c)) return c;          // keep the art's shape
        if (i >= printed) return " ";        // not printed yet
        return i < printed - SETTLE ? c      // settled into the real glyph
          : CODE[(Math.random() * CODE.length) | 0]; // still scrambling
      })
      .join(""));
    if (printed < target.length + SETTLE) requestAnimationFrame(print);
    else {
      setText(target);
      pre.classList.add("is-spinning");
      startBitFlicker();
    }
  })();

  // constant subtle noise: ~5% of the glyphs flip to 0/1 at random spots,
  // a fresh 5% every tick, so the logo always quietly "recomputes" itself
  function startBitFlicker() {
    if (REDUCED) return;                 // honor reduced-motion: hold the glyphs still
    setInterval(() => {
      setText(target
        .split("")
        .map(c => (/\s/.test(c) || Math.random() > 0.05)
          ? c
          : (Math.random() < 0.5 ? "0" : "1"))
        .join(""));
    }, LOW ? 600 : 300);                 // half the rewrite rate on phones
  }
  // extra layer between wrap (perspective) and pre (spin) that carries the tilt
  const tilt = document.createElement("div");
  tilt.className = "hero-logo-tilt";
  pre.parentElement.appendChild(tilt);
  tilt.appendChild(pre);
  // tilt toward the mouse — desktop pointer only (touch has no hover, and
  // reacting to touch-scroll here just thrashes the transform)
  if (!LOW) addEventListener("pointermove", e => {
    const rx = (e.clientY / innerHeight - 0.5) * -24; // deg
    const ry = (e.clientX / innerWidth - 0.5) * 24;
    tilt.style.transform = `rotateX(${rx.toFixed(1)}deg) rotateY(${ry.toFixed(1)}deg)`;
  });
}

/* ---------- 3. ASCII PARTICLE FLOOR (hero) ---------- */
let broken = false;
function startHero() {
  startHeroLogo();
  const canvas = $("#ascii-floor");
  const ctx = canvas.getContext("2d");
  const CHARS = "·:+*#%@$&";
  let W, H, cols, rows, t = 0;
  const CELL = 16;
  const mouse = { x: -1e4, y: -1e4 };
  const shards = []; // for "break" effect
  // mobile/low-power tuning: shrink the backing store and cap the framerate,
  // and (below) pause the whole loop when the hero is off-screen or tab hidden
  const LOW = matchMedia("(max-width:768px), (hover:none), (pointer:coarse)").matches
           || matchMedia("(prefers-reduced-motion: reduce)").matches;
  const DPR = Math.min(devicePixelRatio || 1, LOW ? 1 : 2);

  function resize() {
    W = canvas.width = canvas.offsetWidth * DPR;
    H = canvas.height = canvas.offsetHeight * DPR;
    cols = Math.ceil(canvas.offsetWidth / CELL);
    rows = Math.ceil(canvas.offsetHeight / CELL);
  }
  resize();
  addEventListener("resize", resize);
  canvas.addEventListener("pointermove", e => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
  });

  $("#break-btn").addEventListener("click", () => {
    broken = true;
    for (let i = 0; i < 260; i++) {
      shards.push({
        x: Math.random() * canvas.offsetWidth,
        y: canvas.offsetHeight * (0.62 + Math.random() * 0.35),
        vx: (Math.random() - 0.5) * 7,
        vy: -Math.random() * 9 - 2,
        c: CHARS[(Math.random() * CHARS.length) | 0],
      });
    }
    setTimeout(() => { broken = false; shards.length = 0; }, 2600);
  });

  function draw() {
    t += 0.02;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
    ctx.font = `${CELL - 3}px monospace`;

    if (!broken) {
      // undulating ascii "floor" on lower part of screen
      const horizon = rows * 0.62;
      for (let y = horizon | 0; y < rows; y++) {
        const depth = (y - horizon) / (rows - horizon); // 0..1
        for (let x = 0; x < cols; x++) {
          const wave =
            Math.sin(x * 0.25 + t * 2) * Math.cos(y * 0.3 - t) +
            Math.sin((x + y) * 0.12 + t * 1.4);
          const px = x * CELL, py = y * CELL;
          const dm = Math.hypot(px - mouse.x, py - mouse.y);
          const boost = dm < 130 ? (1 - dm / 130) * 2.4 : 0;
          const v = (wave + 2 + boost) / 4.4; // 0..1ish
          if (v < 0.42) continue;
          const idx = Math.min(CHARS.length - 1, (v * CHARS.length) | 0);
          const red = v > 0.72 || boost > 0.4;
          ctx.fillStyle = red
            ? `rgba(232,35,26,${0.35 + depth * 0.65})`
            : `rgba(130,22,16,${0.15 + depth * 0.4})`;
          ctx.fillText(CHARS[idx], px, py);
        }
      }
    } else {
      // exploded shards
      ctx.fillStyle = "rgba(232,35,26,.9)";
      for (const s of shards) {
        s.x += s.vx; s.y += s.vy; s.vy += 0.3;
        ctx.fillText(s.c, s.x, s.y);
      }
    }
  }

  // run only while visible: pause off-screen and when the tab is hidden so the
  // floor doesn't keep burning cycles behind the rest of the page (mobile jank)
  let visible = true, running = false, last = 0;
  const minDelta = LOW ? 33 : 0;          // ~30fps cap on mobile, uncapped on desktop
  function frame(now) {
    if (!visible || document.hidden) { running = false; return; }
    if (now - last >= minDelta) { last = now; draw(); }
    requestAnimationFrame(frame);
  }
  function start() { if (!running) { running = true; requestAnimationFrame(frame); } }
  new IntersectionObserver(es => {
    visible = es[0].isIntersecting;
    if (visible) start();
  }, { threshold: 0 }).observe(canvas);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && visible) start(); });
  start();
}

/* ---------- 4. SCRAMBLE TEXT ---------- */
const SCRAMBLE_CHARS = "!<>-_\\/[]{}—=+*^?#$%&";
function scramble(el) {
  // remember the real markup (with <br>s) so it can be restored after the effect
  const html = el.dataset.originalHtml ?? (el.dataset.originalHtml = el.innerHTML);
  const original = el.dataset.original ?? (el.dataset.original = el.textContent);
  let frame = 0;
  const total = 24;
  const tick = () => {
    frame++;
    const reveal = Math.floor((frame / total) * original.length);
    el.textContent = original
      .split("")
      .map((c, i) =>
        /\s/.test(c) ? c
        : i <= reveal ? c
        : SCRAMBLE_CHARS[(Math.random() * SCRAMBLE_CHARS.length) | 0])
      .join("");
    if (frame < total) requestAnimationFrame(tick);
    else el.innerHTML = html; // restore markup incl. line breaks
  };
  tick();
}
$$(".scramble-hover").forEach(el =>
  el.addEventListener("mouseenter", () => scramble(el)));

// service rows: scramble the name whenever the cursor enters a row
document.addEventListener("mouseover", e => {
  const li = e.target.closest(".services-list li");
  if (!li || li.contains(e.relatedTarget)) return;
  const name = li.querySelector(".s-name");
  if (name) scramble(name);
});

/* ---------- 4b. CUSTOM TOOLTIP (terminal chip following the cursor) ---------- */
// desktop only — no cursor-following hints on tablet/mobile/touch (there's no
// cursor to anchor them to, and tap-fired mouseover leaves them stuck)
if (matchMedia("(min-width: 1025px) and (hover: hover) and (pointer: fine)").matches) {
  const tip = document.createElement("div");
  tip.className = "tip";
  document.body.appendChild(tip);
  let target = null;

  function place(e) {
    const pad = 14;
    let x = e.clientX + pad, y = e.clientY + pad + 6;
    const r = tip.getBoundingClientRect();
    if (x + r.width > innerWidth - 8) x = e.clientX - r.width - pad;   // flip left
    if (y + r.height > innerHeight - 8) y = e.clientY - r.height - pad; // flip up
    tip.style.left = x + "px";
    tip.style.top = y + "px";
  }
  document.addEventListener("mouseover", e => {
    const el = e.target.closest("[data-tip]");
    if (el === target) return;
    target = el;
    if (el) { tip.textContent = el.dataset.tip; tip.classList.add("is-on"); place(e); }
    else tip.classList.remove("is-on");
  });
  document.addEventListener("mousemove", e => { if (target) place(e); });
}

// client ledger: decrypt the name + stamp a fresh random ID on every hover
document.addEventListener("mouseover", e => {
  const li = e.target.closest(".clients-list li");
  if (!li || li.contains(e.relatedTarget)) return;
  const name = li.querySelector(".c-name");
  if (name) scramble(name);
  const id = li.querySelector(".c-id");
  if (id) id.textContent = "#" + Math.random().toString(16).slice(2, 8).toUpperCase();
});

// click a row to expand its description (one open at a time)
document.addEventListener("click", e => {
  const row = e.target.closest(".services-list .s-row");
  if (!row) return;
  const li = row.parentElement;
  const wasOpen = li.classList.contains("is-open");
  $$(".services-list li.is-open").forEach(o => o.classList.remove("is-open"));
  if (!wasOpen) li.classList.add("is-open");
});

/* ---------- 5. SECTION OBSERVERS (scramble-in + typewriter) ---------- */
function observeSections() {
  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      if (e.target.classList.contains("scramble-in")) scramble(e.target);
      if (e.target.id === "typewriter") typewrite(e.target);
      io.unobserve(e.target);
    }
  }, { threshold: 0.4 });
  $$(".scramble-in, #typewriter").forEach(el => io.observe(el));

  // glitch canvases over work media
  $$(".glitchable").forEach(installGlitch);

  setupReveals();
}

/* ---------- 5b. SCROLL-REVEAL (fade + rise, staggered) ---------- */
function setupReveals() {
  const targets = $$(
    ".hero-corner, .work-item, .quote-label, .quote-author, " +
    ".team-tabs, .team-panels, .services-label, .services-list li, .services-cta, " +
    ".clients-label, .clients-list li, .contact-label, .contact-form label, " +
    ".contact-form button, .site-footer > div"
  );
  const io = new IntersectionObserver(entries => {
    for (const en of entries) {
      if (!en.isIntersecting) continue;
      en.target.classList.add("is-visible");
      io.unobserve(en.target);
    }
  }, { threshold: 0.15 });
  targets.forEach(el => {
    el.classList.add("reveal");
    // stagger siblings that reveal together (lists, form fields, footer)
    const i = [...el.parentElement.children].indexOf(el);
    el.style.transitionDelay = `${Math.min(i, 8) * 70}ms`;
    io.observe(el);
  });
}

/* ---------- 6. TYPEWRITER (client quote) ---------- */
let typingActive = false;
function typewrite(el) {
  if (typingActive) return;
  typingActive = true;
  const text = I18N.quoteText[lang];
  const wave = $("#q-wave"), stamp = $("#q-stamp");
  const WAVE_CHARS = "▁▂▃▄▅▆▇";
  stamp.classList.remove("is-on");
  // audio-style waveform runs while the transmission is "coming in"
  const waveIv = setInterval(() => {
    wave.textContent = Array.from({ length: 22 },
      () => WAVE_CHARS[(Math.random() * WAVE_CHARS.length) | 0]).join("");
  }, 80);
  let i = 0;
  const tick = () => {
    el.textContent = text.slice(0, ++i);
    if (i < text.length) setTimeout(tick, 18 + Math.random() * 30);
    else {
      quoteTyped = true;
      typingActive = false;
      clearInterval(waveIv);
      wave.textContent = "▁".repeat(22); // signal flatlines
      stamp.classList.add("is-on");      // verified stamp slams in
    }
  };
  tick();
}
$("#q-replay").addEventListener("click", () => {
  if (typingActive) return;
  quoteTyped = false;
  typewrite($("#typewriter"));
});

/* ---------- 7. MATRIX RAIN reveal + 3D tilt on work media ---------- */
function installGlitch(media) {
  const cv = document.createElement("canvas");
  cv.className = "glitch-canvas";
  media.appendChild(cv);
  const ctx = cv.getContext("2d");
  const GC = "アイウエオカキクケコ01ABCDEFXYZ#$%&";
  const CELL = 18;
  let running = false;

  // matrix rain: black cover erased column-by-column by falling green code.
  // replays every time the image scrolls into view.
  function matrixReveal() {
    if (running) return;
    cv.width = media.offsetWidth;
    cv.height = media.offsetHeight;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.font = `bold ${CELL - 4}px monospace`;

    const cols = Math.ceil(cv.width / CELL);
    // stagger column start times and speeds so the reveal feels organic
    const drops = Array.from({ length: cols }, () => ({
      y: -Math.random() * 30,               // rows above the top
      speed: 0.55 + Math.random() * 0.75,   // rows per frame
    }));
    const TRAIL = 7; // rows behind the head that stay black before clearing

    running = true;
    function step() {
      let alive = false;
      for (let i = 0; i < cols; i++) {
        const d = drops[i];
        d.y += d.speed;
        const headRow = Math.floor(d.y);
        const x = i * CELL;

        // erase the cell TRAIL rows above the head → image shows through
        const clearRow = headRow - TRAIL;
        if (clearRow >= 0) ctx.clearRect(x, 0, CELL, clearRow * CELL);

        // draw the glowing head + a couple of trailing glyphs
        if (headRow * CELL < cv.height + TRAIL * CELL) {
          alive = true;
          for (let t = 0; t < TRAIL; t++) {
            const row = headRow - t;
            if (row < 0 || row * CELL > cv.height) continue;
            ctx.fillStyle = "#000";
            ctx.fillRect(x, row * CELL, CELL, CELL);
            ctx.fillStyle = t === 0 ? "#eaffea"
              : `rgba(157,255,158,${1 - t / TRAIL})`;
            ctx.fillText(GC[(Math.random() * GC.length) | 0], x + 3, row * CELL + CELL - 5);
          }
        }
      }
      if (alive) requestAnimationFrame(step);
      else {
        ctx.clearRect(0, 0, cv.width, cv.height); // fully revealed
        running = false;
      }
    }
    step();
  }

  new IntersectionObserver(es => {
    es.forEach(e => { if (e.isIntersecting) matrixReveal(); });
  }, { threshold: 0.35 }).observe(media);

  // 3D tilt following the cursor (МЕЛМАН gets 10% more tilt)
  const tiltBoost = media.closest(".work-item")?.dataset.title?.includes("МЕЛМАН") ? 1.1 : 1;
  media.addEventListener("pointermove", e => {
    const r = media.getBoundingClientRect();
    const rx = ((e.clientY - r.top) / r.height - 0.5) * -10 * tiltBoost; // deg
    const ry = ((e.clientX - r.left) / r.width - 0.5) * 12 * tiltBoost;
    media.style.transform = `rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(1.02)`;
  });
  media.addEventListener("pointerleave", () => {
    media.style.transform = "rotateX(0deg) rotateY(0deg) scale(1)";
  });
}

/* ---------- 7b. HORIZONTAL BLOCK SCROLLER ---------- */
/* From the quote block on, the wheel moves block by block sideways.
   Inside a tall block it scrolls that block vertically first; only at the
   block's end does the next wheel tick advance horizontally. */
(function setupHScroll() {
  const hs = $("#hscroll"), track = $("#htrack");
  if (!hs) return;
  const panels = $$(".hpanel", track);
  // wheel-driven, so only enable on a real pointer (mouse) — touch tablets
  // don't fire wheel events and would get stuck at the 100vh hscroll section
  const desktop = matchMedia("(min-width: 769px) and (hover: hover) and (pointer: fine)");
  let idx = 0, lockUntil = 0;

  // progress dots
  const dots = document.createElement("div");
  dots.className = "hdots";
  panels.forEach(() => dots.appendChild(document.createElement("span")));
  hs.appendChild(dots);

  const apply = () => {
    track.style.transform = `translateX(${-idx * 100}vw)`;
    [...dots.children].forEach((d, i) => d.classList.toggle("is-active", i === idx));
  };
  apply();

  hs.addEventListener("wheel", e => {
    if (!desktop.matches) return;
    // not docked yet: drive the page scroll manually — the panel's
    // overscroll-behavior would otherwise swallow the wheel and freeze
    if (hs.getBoundingClientRect().top > 2) {
      e.preventDefault();
      window.scrollBy({ top: e.deltaY, behavior: "instant" });
      return;
    }

    const panel = panels[idx];
    const down = e.deltaY > 0;
    const canDown = panel.scrollTop + panel.clientHeight < panel.scrollHeight - 2;
    const canUp = panel.scrollTop > 2;

    if (down) {
      if (canDown) return;                    // let the block scroll vertically
      e.preventDefault();
      if (idx < panels.length - 1 && performance.now() > lockUntil) {
        idx++; lockUntil = performance.now() + 750; apply();
      }
    } else {
      if (canUp) return;                      // scroll back up inside the block
      if (idx > 0) {
        e.preventDefault();
        if (performance.now() > lockUntil) {
          idx--; lockUntil = performance.now() + 750; apply();
        }
      } else {
        // first block: hand the scroll back to the page (overscroll-behavior
        // on the panel blocks native chaining, so do it manually)
        e.preventDefault();
        window.scrollBy({ top: e.deltaY, behavior: "instant" });
      }
    }
  }, { passive: false });

  // any #contact link (header button, services CTA) -> dock + jump to last block
  $$('a[href="#contact"]').forEach(link => link.addEventListener("click", e => {
    if (!desktop.matches) return; // mobile keeps native anchor scroll
    e.preventDefault();
    hs.scrollIntoView({ behavior: "smooth" });
    idx = panels.length - 1;
    apply();
  }));
})();

/* ---------- 8. TECH-TAG MARQUEE ---------- */
{
  const tags = ["&lt;FIGMA&gt;", "&lt;HTML/CSS&gt;", "&lt;REACT&gt;", "&lt;JAVASCRIPT&gt;", "&lt;TYPESCRIPT&gt;",
    "&lt;NODE&gt;", "&lt;THREE.JS&gt;", "&lt;GSAP&gt;", "001", "&lt;QUICK&gt;"];
  const track = $("#tag-marquee");
  const half = `<span class="marquee-half">` + tags.map(t =>
    `<span${t === "&lt;QUICK&gt;" || t === "001" ? ' class="hl"' : ""}>${t}</span>`).join("") + `</span>`;
  track.innerHTML = half + half; // two identical halves -> seamless -50% loop
}

/* ---------- 9. TEAM TABS ---------- */
$("#team-tabs").addEventListener("click", e => {
  const btn = e.target.closest(".team-tab");
  if (!btn) return;
  $$(".team-tab").forEach(b => b.classList.toggle("is-active", b === btn));
  const i = +btn.dataset.member;
  $$(".team-panel").forEach((p, j) => p.classList.toggle("is-active", i === j));
  animateSkills($(".team-panel.is-active"));
});

// ASCII skill bars fill up ▓ by ▓ when a dossier becomes visible
function animateSkills(root) {
  if (!root) return;
  $$(".d-skill", root).forEach((row, n) => {
    const lv = +row.dataset.lv, bar = row.querySelector("i");
    let k = 0;
    bar.textContent = "░".repeat(10);
    setTimeout(() => {
      const iv = setInterval(() => {
        k++;
        bar.textContent = "▓".repeat(k) + "░".repeat(10 - k);
        if (k >= lv) clearInterval(iv);
      }, 55);
    }, n * 140); // stagger the bars
  });
}
// first fill when the team block scrolls into view
new IntersectionObserver((es, ob) => {
  es.forEach(e => { if (e.isIntersecting) { animateSkills($(".team-panel.is-active")); ob.unobserve(e.target); } });
}, { threshold: 0.3 }).observe($(".team"));

/* ---------- 10b. LIVE SESSION STATUS (contact terminal) ---------- */
(function termStatus() {
  const form = $("#contact-form"), panel = $("#term-status");
  if (!form || !panel) return;
  const fields = $$("input, textarea", form);

  // budget: a fixed "$" prefix that can't be removed or moved
  const budget = form.budget;
  budget.value = "$";
  const budgetAmount = () => parseFloat(budget.value.slice(1).replace(/[^\d.]/g, "")) || 0;
  budget.addEventListener("input", () => {
    if (!budget.value.startsWith("$"))
      budget.value = "$" + budget.value.replace(/\$/g, "");
    // minimum project budget: $400
    budget.setCustomValidity(budget.value.trim().length > 1 && budgetAmount() < 400
      ? (lang === "uk" ? "Мінімальний бюджет проєкту — $400" : "The minimum project budget is $400")
      : "");
  });
  budget.addEventListener("keydown", e => {
    // block deleting the $ or stepping the caret in front of it
    if ((e.key === "Backspace" && budget.selectionStart <= 1 && budget.selectionEnd <= 1) ||
        (e.key === "ArrowLeft" && budget.selectionStart <= 1)) e.preventDefault();
  });

  /* One field now carries the whole way of reaching someone, so it has to
     accept both shapes people actually type: a phone number in any punctuation,
     or a Telegram handle with or without the @ / t.me prefix. Anything looser
     would let a single stray character through as a valid contact. */
  const contact = form.contact;
  const contactOk = (v) => {
    const t = v.trim();
    if (!t) return false;
    if (/^\+?[\d][\d\s().-]{6,}$/.test(t)) return true;            // phone
    if (/^(https?:\/\/)?(t\.me|telegram\.me)\/\w{4,}$/i.test(t)) return true; // link
    return /^@?[a-zA-Z0-9_]{4,32}$/.test(t);                        // @handle
  };
  contact.addEventListener("input", () => {
    contact.setCustomValidity(contact.value.trim() && !contactOk(contact.value)
      ? (lang === "uk"
          ? "Вкажіть номер телефону або нік у Telegram"
          : "Enter a phone number or a Telegram handle")
      : "");
  });

  // custom terminal-style validation messages instead of browser bubbles
  form.noValidate = true;
  let submitAttempted = false;
  const errFor = f => {
    let e = f.parentElement.querySelector(".f-err");
    if (!e) { e = document.createElement("em"); e.className = "f-err"; f.parentElement.appendChild(e); }
    return e;
  };
  function showErrors() {
    fields.forEach(f => {
      let msg = "";
      if (f.validity.customError) msg = f.validationMessage;
      else if (f.validity.valueMissing && submitAttempted)
        msg = lang === "uk" ? "ЦЕ ПОЛЕ ОБОВ'ЯЗКОВЕ" : "THIS FIELD IS REQUIRED";
      else if (!f.validity.valid && submitAttempted) msg = f.validationMessage;
      errFor(f).textContent = msg ? "! " + msg.toUpperCase() : "";
    });
  }
  form.addEventListener("input", showErrors);
  form.validateTerminal = () => {           // used by the submit handler
    submitAttempted = true;
    showErrors();
    const bad = fields.find(f => !f.validity.valid);
    if (bad) bad.focus();
    return !bad;
  };

  const filled = f =>
    f === contact ? contactOk(f.value)
    : f === budget ? budgetAmount() >= 400      // at least $400
    : !!f.value.trim();

  function render() {
    const done = fields.filter(filled).length;
    const rows = fields.map(f => {
      const label = f.previousElementSibling.textContent.replace(/^>\s*/, "");
      const cls = f === document.activeElement ? "st-row is-focus"
        : filled(f) ? "st-row is-done" : "st-row";
      const mark = f === document.activeElement ? "&gt;" : filled(f) ? "█" : "░";
      const ok = filled(f) ? " [OK]" : "";
      return `<div class="${cls}">${mark} ${label}${ok}</div>`;
    }).join("");
    const bar = "▓".repeat(done * 2) + "░".repeat((fields.length - done) * 2);
    panel.innerHTML =
      `<div class="st-title">// SESSION STATUS</div>${rows}` +
      `<div class="st-bar">[${bar}] ${Math.round(done / fields.length * 100)}%</div>`;
  }
  ["input", "focusin", "focusout"].forEach(ev => form.addEventListener(ev, render));
  render();
  // re-render when the language switches (labels change)
  document.addEventListener("click", e => {
    if (!e.target.closest(".lang-btn")) return;
    setTimeout(() => {
      // revalidate in the new language so error texts switch too
      contact.dispatchEvent(new Event("input"));
      budget.dispatchEvent(new Event("input"));
      showErrors();
      render();
    });
  });
})();

/* ---------- 11. TERMINAL CONTACT FORM ---------- */
$("#contact-form").addEventListener("submit", async e => {
  e.preventDefault();
  if (!e.target.validateTerminal()) return; // show inline errors, no transmit

  const f = e.target.elements; // use .elements — form.name would shadow the field
  const val = n => (f[n] && f[n].value || "").trim();
  const payload = { contact: val("contact"), budget: val("budget"), message: val("message") };

  // submit to the backend; fall back to localStorage only if the API is unreachable
  try {
    const r = await fetch("/api/applications", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error("api " + r.status);
  } catch (_) {
    try {
      const apps = JSON.parse(localStorage.getItem("slv_applications") || "[]");
      apps.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ts: new Date().toISOString(), ...payload });
      localStorage.setItem("slv_applications", JSON.stringify(apps));
    } catch (_) { /* offline + no storage — nothing else we can do */ }
  }

  const log = $("#terminal-log");
  const lines = TERMINAL_LINES[lang];
  log.textContent = "";
  let i = 0;
  const next = () => {
    if (i >= lines.length) return;
    log.textContent += lines[i++] + "\n";
    setTimeout(next, 500 + Math.random() * 500);
  };
  next();
  // NOTE: hook this up to a real backend / form service (e.g. Formspree) later.
});

/* ---------- 11. HIDE HEADER ON SCROLL DOWN ---------- */
(function hideHeaderOnScroll() {
  const header = $(".site-header");
  if (!header) return;
  const THRESH = 8;    // ignore tiny jitters
  const TOP = 40;      // always show near the very top (over the hero)
  let lastY = window.scrollY;

  const setHidden = h => header.classList.toggle("is-hidden", h);

  // NOTE: scroll events don't fire reliably on this page (body's computed
  // overflow-y is `auto` from overflow-x:hidden), so poll scrollY on a frame
  // loop instead. Covers the vertical hero/work/team stretch and mobile.
  (function tick() {
    const y = window.scrollY;
    if (y < TOP) setHidden(false);                 // over the hero -> always show
    else if (Math.abs(y - lastY) >= THRESH) {
      setHidden(y > lastY);                        // down -> hide, up -> show
      lastY = y;
    }
    requestAnimationFrame(tick);
  })();

  // wheel drives every desktop scroll (vertical hero/work/team AND the docked
  // horizontal #hscroll, where scrollY is frozen) — read its direction directly
  window.addEventListener("wheel", e => {
    if (window.scrollY < TOP) { setHidden(false); return; }
    if (Math.abs(e.deltaY) < THRESH) return;
    setHidden(e.deltaY > 0); // down -> hide, up -> show
  }, { passive: true });

  // mobile: no wheel events, so read the finger's vertical travel instead
  let touchY = null;
  window.addEventListener("touchstart", e => { touchY = e.touches[0].clientY; }, { passive: true });
  window.addEventListener("touchmove", e => {
    const y = e.touches[0].clientY;
    if (touchY === null) { touchY = y; return; }
    const dy = touchY - y;   // finger up (page scrolls down) -> dy > 0
    touchY = y;
    if (window.scrollY < TOP) { setHidden(false); return; }
    if (Math.abs(dy) < THRESH) return;
    setHidden(dy > 0); // down -> hide, up -> show
  }, { passive: true });
})();

/* ---------- 12. ADMIN DATA INTEGRATION (localStorage overrides) ----------
   The admin page (admin.html) writes to these localStorage keys; the live
   site reads them here so added partners and edited projects show up.
   Client-only: data lives in this browser only.                            */
// OFFLINE FALLBACK: apply any legacy localStorage admin data. Only runs if the
// backend API is unreachable (see hydrateFromServer). When online, the server
// is the source of truth and this is skipped.
function applyLocalOverrides() {
  const read = (k, fb) => { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch (_) { return fb; } };

  // --- edited projects: override the 3 hardcoded case files ---------------
  const projects = read("slv_projects", {});
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  $$(".work-item").forEach((art, i) => {
    const o = projects[i];
    if (!o) return;
    const has = v => v != null && v !== "";

    // title + optional external link render together into .work-title
    const titleEl = $(".work-title", art);
    if (titleEl && (has(o.title) || o.link != null)) {
      const curLink = $(".work-title a", art);
      const curLabel = (art.dataset.title || (titleEl.textContent || "")).replace(/\s*↗\s*$/, "");
      const label = has(o.title) ? `&lt;${esc(o.title)}&gt;` : curLabel;
      const link = o.link != null ? o.link : (curLink ? curLink.getAttribute("href") : "");
      art.dataset.title = label;
      titleEl.innerHTML = link
        ? `<a data-tip="${esc(link)} ↗" href="${esc(link)}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`
        : label;
    }

    if (has(o.caseLabel)) { const el = $(".w-case", art); if (el) el.textContent = o.caseLabel; }
    if (has(o.status)) {
      const el = $(".w-status", art);
      if (el) { el.textContent = o.status; el.classList.toggle("is-live", /live/i.test(o.status)); }
    }
    if (has(o.tags)) {
      const box = $(".w-tags", art);
      if (box) box.innerHTML = String(o.tags).split(",").map(t => t.trim()).filter(Boolean)
        .map(t => `<span>${esc(t)}</span>`).join("");
    }
    if (has(o.image)) { const img = $(".work-media img", art); if (img) img.src = o.image; }
    // description is i18n-driven: override the dict so setLang keeps it
    if (has(o.desc)) {
      const descEl = $(".work-desc", art), key = descEl && descEl.dataset.i18n;
      if (key && I18N[key]) I18N[key] = { en: o.desc, uk: o.desc };
      else if (descEl) descEl.textContent = o.desc;
    }
  });

  // --- edited built-in members: patch the photo (name/role/bio/skills/status
  //     already flow through renderBuiltinTeam → I18N, which survives setLang) -
  const teamOv = read("slv_team_overrides", {});
  Object.keys(teamOv).forEach(k => {
    const o = teamOv[k];
    if (!o || o.photo == null || o.photo === "") return;
    const panel = $$(".team-panel")[+k];
    const box = panel && $(".team-photo", panel);
    if (box) box.innerHTML = `<img src="${esc(o.photo)}" alt="slv_visual team member" />`;
  });

  // --- added partners: append a team tab + dossier panel for each ---------
  const partners = read("slv_partners", []);
  if (partners.length) {
    const tabsNav = $("#team-tabs"), panelsWrap = $("#team-panels");
    if (tabsNav && panelsWrap) {
      const base = $$(".team-tab", tabsNav).length; // existing member count
      partners.forEach((p, n) => {
        const idx = base + n;
        const key = "member" + idx, bioKey = "bio" + idx;
        const label = `&lt;${(p.name || "PARTNER").toUpperCase()}&gt;`;
        I18N[key] = { en: label, uk: label };
        // reuse the same member model so status + fields render identically
        const pm = {
          name: { en: p.name || "Partner", uk: p.name || "Partner" },
          id: "#SV-" + String(idx + 1).padStart(3, "0"),
          role: { en: p.role || "PARTNER", uk: p.role || "PARTNER" },
          location: { en: p.location || "—", uk: p.location || "—" },
          status: p.status || "online",
          bio: { en: p.bio || "", uk: p.bio || "" },
          skills: (p.skills || []).map(s => ({
            label: { en: String(s.name || s[0] || ""), uk: String(s.name || s[0] || "") },
            level: +(s.level ?? s[1]) || 0,
          })),
        };
        const dossier = memberDossier(pm, "en");
        I18N[bioKey] = { en: dossier, uk: memberDossier(pm, "uk") };

        const tab = document.createElement("button");
        tab.className = "team-tab";
        tab.dataset.member = idx;
        tab.dataset.i18n = key;
        tab.innerHTML = label;
        tabsNav.appendChild(tab);

        const panel = document.createElement("div");
        panel.className = "team-panel";
        const photo = p.photo
          ? `<img src="${p.photo}" alt="${(p.name || "Partner")} — slv_visual" />`
          : "[ PHOTO ]";
        panel.innerHTML =
          `<div class="team-photo halftone">${photo}</div>` +
          `<div class="team-dossier" data-i18n="${bioKey}"></div>`;
        panelsWrap.appendChild(panel);
      });
    }
  }

  // re-apply language so all new [data-i18n] nodes + overridden dict render
  if (typeof setLang === "function") setLang(lang);
}

/* ---------- 13. LOAD LIVE DATA FROM THE BACKEND ----------
   Fetch team + projects from the API and render them (source of truth). If the
   backend is unreachable (e.g. the plain static site with no server), fall back
   to the built-in defaults + any legacy localStorage admin data.              */
(function hydrateFromServer() {
  const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const up = s => String(s ?? "").toUpperCase();

  // server team member -> the structured model memberDossier() expects
  const toModel = sm => ({
    name: sm.name, id: sm.code, role: sm.role, location: sm.location,
    status: sm.status, bio: sm.bio,
    skills: (sm.skills || []).map(s => ({ label: { en: s.label_en, uk: s.label_uk }, level: s.level })),
    photo: sm.photo,
  });

  function renderTeam(members) {
    const tabsNav = $("#team-tabs"), panelsWrap = $("#team-panels");
    if (!tabsNav || !panelsWrap || !members.length) return;
    let tabs = $$(".team-tab", tabsNav), panels = $$(".team-panel", panelsWrap);
    // trim extras
    while (tabs.length > members.length) { tabs.pop().remove(); }
    while (panels.length > members.length) { panels.pop().remove(); }
    // add missing
    for (let i = tabs.length; i < members.length; i++) {
      const tab = document.createElement("button");
      tab.className = "team-tab"; tabsNav.appendChild(tab); tabs.push(tab);
      const panel = document.createElement("div");
      panel.className = "team-panel";
      panel.innerHTML = `<div class="team-photo halftone"></div><div class="team-dossier"></div>`;
      panelsWrap.appendChild(panel); panels.push(panel);
    }
    members.forEach((sm, i) => {
      const model = toModel(sm);
      I18N["member" + i] = { en: `&lt;${up(sm.name.en)}&gt;`, uk: `&lt;${up(sm.name.uk || sm.name.en)}&gt;` };
      I18N["bio" + i] = { en: memberDossier(model, "en"), uk: memberDossier(model, "uk") };
      tabs[i].dataset.member = i; tabs[i].dataset.i18n = "member" + i;
      panels[i].querySelector(".team-dossier").dataset.i18n = "bio" + i;
      const box = panels[i].querySelector(".team-photo");
      box.innerHTML = sm.photo ? `<img src="${esc(sm.photo)}" alt="${esc(sm.name.en)} — slv_visual" />` : "[ PHOTO ]";
    });
    if (!tabsNav.querySelector(".team-tab.is-active")) tabs[0].classList.add("is-active");
    if (!panelsWrap.querySelector(".team-panel.is-active")) panels[0].classList.add("is-active");
  }

  function renderProjects(projects) {
    // The home page has three slots; fill them by position, not by id — ids are
    // no longer 0,1,2 once projects are added or deleted in the admin panel.
    // Everything beyond the third lives on /projects.html.
    const slots = $$(".work-item");
    slots.forEach((art, i) => { if (!projects[i]) art.hidden = true; });
    projects.slice(0, slots.length).forEach((p, i) => {
      const art = slots[i];
      if (!art) return;
      art.hidden = false;
      const titleEl = $(".work-title", art);
      if (titleEl) {
        const label = `&lt;${esc(p.title)}&gt;`;
        art.dataset.title = label;
        titleEl.innerHTML = p.link
          ? `<a data-tip="${esc(p.link)} ↗" href="${esc(p.link)}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`
          : label;
      }
      const ce = $(".w-case", art); if (ce) ce.textContent = p.caseLabel;
      const se = $(".w-status", art); if (se) { se.textContent = p.status; se.classList.toggle("is-live", /live/i.test(p.status)); }
      const tb = $(".w-tags", art);
      if (tb) tb.innerHTML = String(p.tags).split(",").map(t => t.trim()).filter(Boolean).map(t => `<span>${esc(t)}</span>`).join("");
      const img = $(".work-media img", art); if (img && p.image) img.src = p.image;
      const de = $(".work-desc", art), key = de && de.dataset.i18n;
      if (key && I18N[key] && p.desc) I18N[key] = { en: p.desc.en, uk: p.desc.uk };
    });
  }

  Promise.all([
    fetch("/api/team").then(r => r.ok ? r.json() : Promise.reject()),
    fetch("/api/projects").then(r => r.ok ? r.json() : Promise.reject()),
  ]).then(([team, projects]) => {
    renderTeam(team);
    renderProjects(projects);
    setLang(lang); // re-render all [data-i18n] with the fresh server data
  }).catch(() => {
    applyLocalOverrides(); // backend unreachable -> defaults + legacy localStorage
  });
})();

/* ---------- 13. WHY-READOUT SCAN ----------
   One phosphor sweep down the diagnostic panel the first time it is seen.
   The content is fully visible without it — this only adds the moment, it
   never gates visibility (a class-gated reveal would ship blank in headless
   renderers and on hidden tabs). */
(function whyScan() {
  const el = document.getElementById("why-console");
  if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      // the sweep travels the panel's real height, so it always clears the end
      el.style.setProperty("--scan-h", el.offsetHeight + "px");
      el.classList.add("is-scanning");
      io.unobserve(el);
    }
  }, { threshold: 0.18 });
  io.observe(el);
})();

/* ---------- 14. PRICE CALCULATOR ----------
   Every label ships in both languages as [data-lang-block] spans, so switching
   EN/UK is pure CSS and never wipes what the visitor has already selected.
   `lang` is read only when building the payload we send to the admin panel.

   The running line items are visible from the first click, but the TOTAL stays
   masked until "calculate" is pressed — that press is what makes the estimate
   real, sends it to the admin panel, and is worth an actual moment. Changing
   anything afterwards re-masks it, so a stale number can never be on screen. */
(function priceCalculator() {
  const paper = document.getElementById("calc-paper");
  if (!paper) return;

  const bi = (uk, en) =>
    `<span data-lang-block="uk">${uk}</span><span data-lang-block="en">${en}</span>`;
  const money = (n) => "$" + n.toLocaleString("en-US");

  /* ------------------------------------------------------------ the price list
     One place to change a number. `only` restricts an option to one category. */
  const DEVS = [
    { id: "oleksandr", uk: "Олександр", en: "Oleksandr", years: 1, add: 0,
      noteUk: "Рік у розробці. Робить чисто й за методичкою — найвигідніший варіант для простого проєкту.",
      noteEn: "One year in. Clean, by-the-book work — the best value for a straightforward project." },
    { id: "roman", uk: "Роман", en: "Roman", years: 3, add: 100,
      noteUk: "Три роки в розробці. Складніша логіка, інтеграції, нестандартні задачі.",
      noteEn: "Three years in. Heavier logic, integrations, non-standard tasks." },
    { id: "yaroslav", uk: "Ярослав", en: "Yaroslav", years: 6, add: 300,
      noteUk: "Шість років у розробці. Авторський дизайн, анімації та максимальна конверсія.",
      noteEn: "Six years in. Original design, animation, and the highest conversion ceiling." },
  ];

  const CATS = [
    { id: "landing", base: 400, support: 100, days: 7,
      uk: "Лендінг / Корпоративний", en: "Landing / Corporate",
      descUk: "Односторінковий сайт, який продає одну послугу або один товар. Уся аргументація, ціни та форма заявки — на одному екрані прокрутки.",
      descEn: "A one-page site that sells a single service or product. The whole argument, the prices and the request form live on one scroll." },
    { id: "shop", base: 900, support: 200, days: 18,
      uk: "E-commerce / Інтернет-магазин", en: "E-commerce / Online store",
      descUk: "Каталог товарів, картки, кошик і оформлення замовлення. Клієнт купує сам, без вашої участі.",
      descEn: "A product catalogue, product pages, a cart and checkout. The customer buys on their own, without you in the loop." },
  ];

  // included in every build — shown so the base price reads as honest, not magic
  const INCLUDED = [
    ["Перший екран та оффер", "Hero screen & offer"],
    ["Блок «Про нас» / переваги", "About / benefits block"],
    ["Форма заявки та контакти", "Request form & contacts"],
    ["Адаптив під телефон і планшет", "Phone & tablet layouts"],
    ["Підключення домену і запуск", "Domain hookup & launch"],
  ];

  const BLOCKS = [
    { id: "services", price: 60, uk: "Послуги і тарифи", en: "Services & pricing" },
    { id: "catalog", price: 150, only: "shop", uk: "Каталог товарів", en: "Product catalogue" },
    { id: "product", price: 120, only: "shop", uk: "Сторінка товару", en: "Product page" },
    { id: "cart", price: 200, only: "shop", uk: "Кошик і оформлення замовлення", en: "Cart & checkout" },
    { id: "filters", price: 150, only: "shop", uk: "Фільтри й пошук по каталогу", en: "Catalogue filters & search" },
    { id: "portfolio", price: 90, uk: "Портфоліо / кейси", en: "Portfolio / case studies" },
    { id: "reviews", price: 50, uk: "Відгуки клієнтів", en: "Client reviews" },
    { id: "faq", price: 40, uk: "FAQ — відповіді на заперечення", en: "FAQ / objection handling" },
    { id: "team", price: 50, uk: "Команда", en: "The team" },
    { id: "gallery", price: 60, uk: "Галерея робіт", en: "Work gallery" },
    { id: "blog", price: 120, uk: "Блог / новини", en: "Blog / news" },
    { id: "map", price: 30, uk: "Карта проїзду і графік роботи", en: "Map & opening hours" },
    { id: "promo", price: 40, uk: "Акція з таймером зворотного відліку", en: "Promo block with countdown" },
    { id: "calc", price: 150, uk: "Калькулятор вартості (як цей)", en: "Price calculator (like this one)" },
    { id: "lang", price: 150, uk: "Друга мова сайту", en: "Second site language" },
    { id: "wow", price: 200, uk: "Преміум-анімації та ефекти", en: "Premium animation & effects" },
  ];

  /* mutually exclusive choices — two payment paths and two depths of SEO */
  const GROUPS = [
    { id: "pay", uk: "Оплата на сайті", en: "Payments on the site",
      opts: [
        { id: "none", price: 0, uk: "Не потрібна", en: "Not needed" },
        { id: "simple", price: 100,
          uk: "Проста: заявка падає в Telegram-бот", en: "Simple: the order lands in a Telegram bot",
          noteUk: "Менеджер бачить замовлення в боті, передзвонює і домовляється про оплату.",
          noteEn: "A manager sees the order in the bot, calls back and arranges payment." },
        { id: "full", price: 400,
          uk: "Повноцінна: картка, Google Pay, Apple Pay", en: "Full: card, Google Pay, Apple Pay",
          noteUk: "Клієнт платить одразу на сайті, гроші йдуть на ваш рахунок без вашої участі.",
          noteEn: "The customer pays on the spot and the money reaches your account with no manual step." },
      ] },
    { id: "seo", uk: "SEO", en: "SEO",
      opts: [
        { id: "base", price: 0, uk: "Базове — входить у ціну", en: "Basic — included in the price",
          noteUk: "Заголовки, описи, швидкість, карта сайту, коректна індексація в Google.",
          noteEn: "Titles, descriptions, speed, a sitemap, correct indexing in Google." },
        { id: "full", price: 300, uk: "Повне по всьому сайту", en: "Full, across the whole site",
          noteUk: "Збір ключових запитів, тексти під пошук, мікророзмітка, оптимізація кожної сторінки.",
          noteEn: "Keyword research, search-driven copy, structured data, every page optimised." },
      ] },
  ];

  const SERVICES = [
    { id: "np", price: 200, uk: "Нова Пошта: відділення та ТТН", en: "Nova Poshta: branches & waybills" },
    { id: "booking", price: 100, uk: "Онлайн-запис на послугу", en: "Online booking" },
    { id: "admin", price: 300, uk: "Адмін-панель для правок без нас", en: "Admin panel — edit it without us" },
    { id: "tgnotify", price: 50, uk: "Сповіщення про заявки в Telegram", en: "Telegram alerts for new requests" },
    { id: "analytics", price: 50, uk: "Аналітика: GA4 + Meta Pixel", en: "Analytics: GA4 + Meta Pixel" },
    { id: "chat", price: 50, uk: "Чат і месенджери на сайті", en: "On-site chat & messengers" },
    { id: "mail", price: 100, uk: "Email-розсилка й збір бази", en: "Email campaigns & list building" },
    { id: "crm", price: 150, uk: "Інтеграція з вашою CRM", en: "Integration with your CRM" },
    { id: "multi", price: 120, uk: "Особистий кабінет клієнта", en: "Customer account area" },
  ];

  const NICHES = [
    ["Барбершоп / перукарня", "Barbershop / hair salon"],
    ["Салон краси", "Beauty salon"],
    ["Нігтьова студія", "Nail studio"],
    ["Косметологія", "Cosmetology"],
    ["Стоматологія", "Dentistry"],
    ["Медична клініка", "Medical clinic"],
    ["Ветклініка / зоосалон", "Vet clinic / pet grooming"],
    ["Психолог / терапевт", "Psychologist / therapist"],
    ["Фітнес-клуб / зал", "Gym / fitness club"],
    ["Студія танцю або йоги", "Dance or yoga studio"],
    ["Кав'ярня / ресторан", "Cafe / restaurant"],
    ["Доставка їжі", "Food delivery"],
    ["Кондитерська / випічка", "Bakery / patisserie"],
    ["Автосервіс", "Car service"],
    ["Автомийка / детейлінг", "Car wash / detailing"],
    ["Автосалон / підбір авто", "Car dealership / car sourcing"],
    ["Шиномонтаж", "Tyre service"],
    ["Будівництво / ремонт", "Construction / renovation"],
    ["Меблі на замовлення", "Custom furniture"],
    ["Вікна, двері, стелі", "Windows, doors, ceilings"],
    ["Клінінг", "Cleaning services"],
    ["Логістика / вантажоперевезення", "Logistics / freight"],
    ["Юридичні послуги", "Legal services"],
    ["Бухгалтерія / фінанси", "Accounting / finance"],
    ["Нерухомість / агентство", "Real estate agency"],
    ["Освіта / курси", "Education / courses"],
    ["Школа іноземних мов", "Language school"],
    ["Дитячий центр / садок", "Kids centre / preschool"],
    ["Фотограф / відеограф", "Photographer / videographer"],
    ["Організація свят / event", "Events / party planning"],
    ["Весільні послуги", "Wedding services"],
    ["Туризм / тури", "Travel / tours"],
    ["Готель / хостел / оренда житла", "Hotel / hostel / short lets"],
    ["Оренда обладнання чи авто", "Equipment or car rental"],
    ["Магазин одягу", "Clothing store"],
    ["Магазин взуття", "Shoe store"],
    ["Ювелірні вироби / аксесуари", "Jewellery / accessories"],
    ["Косметика і парфуми", "Cosmetics & perfume"],
    ["Дитячі товари", "Kids products"],
    ["Зоотовари", "Pet supplies"],
    ["Квіти / флористика", "Flowers / florist"],
    ["Handmade / вироби ручної роботи", "Handmade goods"],
    ["3D-друк", "3D printing"],
    ["Електроніка і гаджети", "Electronics & gadgets"],
    ["Спортивні товари", "Sports goods"],
    ["Продукти / фермерство", "Groceries / farming"],
    ["Товари для дому", "Homeware"],
    ["Мерч / власний бренд одягу", "Merch / own clothing brand"],
    ["Digital-продукт / SaaS", "Digital product / SaaS"],
    ["Маркетингове агентство", "Marketing agency"],
    ["Блогер / особистий бренд", "Blogger / personal brand"],
    ["Інфобізнес / онлайн-курси", "Info-business / online courses"],
    ["Благодійний фонд", "Charity foundation"],
    ["Виробництво / B2B", "Manufacturing / B2B"],
    ["Інша сфера", "Something else"],
  ];

  /* ------------------------------------------------------------------- state */
  const state = {
    dev: "oleksandr",
    cat: "landing",
    niche: "",
    blocks: new Set(),
    groups: { pay: "none", seo: "base" },
    services: new Set(),
    support: false,
  };

  const dev = () => DEVS.find((d) => d.id === state.dev);
  const cat = () => CATS.find((c) => c.id === state.cat);
  const groupOpt = (g) => g.opts.find((o) => o.id === state.groups[g.id]);

  /* ------------------------------------------------------------------ markup */
  const el = (id) => document.getElementById(id);

  el("calc-devs").innerHTML = DEVS.map((d) => `
    <label class="calc-dev" data-add="${d.add}">
      <input type="radio" name="calc-dev" value="${d.id}" class="sr-only"${d.id === state.dev ? " checked" : ""}>
      <span class="cd-pick" aria-hidden="true"></span>
      <span class="cd-body">
        <span class="cd-name">${bi(d.uk, d.en)}</span>
        <span class="cd-exp">
          <i class="cd-bar" aria-hidden="true">${"█".repeat(d.years)}${"░".repeat(6 - d.years)}</i>
          ${bi(d.years + (d.years === 1 ? " рік у розробці" : " роки в розробці"),
               d.years + (d.years === 1 ? " year in development" : " years in development"))}
        </span>
        <span class="cd-note">${bi(d.noteUk, d.noteEn)}</span>
      </span>
      <span class="cd-add">${d.add ? "+" + money(d.add) : bi("без доплати", "no surcharge")}</span>
    </label>`).join("");

  el("calc-cats").innerHTML = CATS.map((c) => `
    <label class="calc-cat">
      <input type="radio" name="calc-cat" value="${c.id}" class="sr-only"${c.id === state.cat ? " checked" : ""}>
      <span class="cc-pick" aria-hidden="true"></span>
      <span class="cc-name">${bi(c.uk, c.en)}</span>
      <span class="cc-desc">${bi(c.descUk, c.descEn)}</span>
      <span class="cc-price">${bi("від ", "from ")}${money(c.base)}</span>
    </label>`).join("");

  /* <option> can't hold [data-lang-block] markup, so the niche list is the one
     place that really has to be re-rendered when the language changes */
  function renderNiches() {
    const sel = el("calc-niche");
    sel.innerHTML =
      `<option value="">${lang === "uk" ? "— оберіть сферу —" : "— pick your industry —"}</option>` +
      NICHES.map(([uk, en]) => `<option value="${uk}">${lang === "uk" ? uk : en}</option>`).join("");
    sel.value = state.niche; // the value is always the Ukrainian label
  }
  renderNiches();
  // runs after the existing .lang-btn handler, so `lang` is already the new one
  document.addEventListener("click", (e) => {
    if (e.target.closest(".lang-btn")) renderNiches();
  });

  el("calc-included").innerHTML =
    `<p class="ci-key">${bi("Уже входить у базову ціну", "Already in the base price")}</p>` +
    `<ul class="ci-list">${INCLUDED.map(([uk, en]) =>
      `<li>${bi(uk, en)}</li>`).join("")}</ul>`;

  const optRow = (kind, o) => `
    <label class="calc-opt" data-only="${o.only || ""}">
      <input type="checkbox" data-kind="${kind}" value="${o.id}" class="sr-only">
      <span class="co-pick" aria-hidden="true"></span>
      <span class="co-name">${bi(o.uk, o.en)}</span>
      <span class="co-dots" aria-hidden="true"></span>
      <span class="co-price">+${money(o.price)}</span>
    </label>`;

  el("calc-blocks").innerHTML = BLOCKS.map((b) => optRow("block", b)).join("");
  el("calc-services").innerHTML = SERVICES.map((sv) => optRow("service", sv)).join("");

  el("calc-groups").innerHTML = GROUPS.map((g) => `
    <div class="calc-group">
      <p class="cg-key">${bi(g.uk, g.en)}</p>
      ${g.opts.map((o) => `
        <label class="calc-opt is-radio">
          <input type="radio" name="calc-g-${g.id}" data-group="${g.id}" value="${o.id}" class="sr-only"${o.id === state.groups[g.id] ? " checked" : ""}>
          <span class="co-pick" aria-hidden="true"></span>
          <span class="co-name">${bi(o.uk, o.en)}${o.noteUk ? `<em class="co-note">${bi(o.noteUk, o.noteEn)}</em>` : ""}</span>
          <span class="co-dots" aria-hidden="true"></span>
          <span class="co-price">${o.price ? "+" + money(o.price) : bi("безкоштовно", "free")}</span>
        </label>`).join("")}
    </div>`).join("");

  function renderSupport() {
    const c = cat();
    el("calc-support").innerHTML = `
      <label class="calc-opt">
        <input type="checkbox" data-kind="support" value="support" class="sr-only"${state.support ? " checked" : ""}>
        <span class="co-pick" aria-hidden="true"></span>
        <span class="co-name">${bi("Щомісячна підтримка сайту", "Monthly site support")}</span>
        <span class="co-dots" aria-hidden="true"></span>
        <span class="co-price">${money(c.support)}${bi("/міс", "/mo")}</span>
      </label>`;
  }
  renderSupport();

  /* blocks that belong only to a shop appear only when a shop is selected */
  function syncOnly() {
    document.querySelectorAll("#calc-blocks .calc-opt[data-only]").forEach((label) => {
      const only = label.dataset.only;
      const hide = only && only !== state.cat;
      label.hidden = !!hide;
      if (hide) {
        const input = label.querySelector("input");
        if (input.checked) { input.checked = false; state.blocks.delete(input.value); }
      }
    });
  }
  syncOnly();

  /* --------------------------------------------------------------- the maths */
  function build() {
    const d = dev(), c = cat();
    const lines = [];
    let total = 0;

    const push = (uk, en, price, tag) => {
      total += price;
      lines.push({ uk, en, price, tag });
    };

    push(c.uk, c.en, c.base, "base");
    if (d.add) push("Виконавець: " + d.uk, "Developer: " + d.en, d.add, "dev");

    BLOCKS.forEach((b) => {
      if (!state.blocks.has(b.id)) return;
      if (b.only && b.only !== state.cat) return;
      push(b.uk, b.en, b.price, "block");
    });

    GROUPS.forEach((g) => {
      const o = groupOpt(g);
      if (!o || !o.price) return;
      push(g.uk + ": " + o.uk, g.en + ": " + o.en, o.price, "group");
    });

    SERVICES.forEach((sv) => {
      if (state.services.has(sv.id)) push(sv.uk, sv.en, sv.price, "service");
    });

    // support is recurring — it is quoted beside the total, never inside it
    const monthly = state.support ? c.support : 0;

    const count = lines.filter((l) => l.tag === "block" || l.tag === "service").length;
    let days = c.days + count * 2 - (d.years >= 6 ? 2 : 0);
    days = Math.max(c.days, days);

    return { lines, total, monthly, days, dayMax: days + Math.ceil(days * 0.35) };
  }

  /* --------------------------------------------------------------- rendering */
  const totalEl = el("calc-total");
  const subEl = el("calc-total-sub");
  const etaEl = el("calc-eta");
  const goBtn = el("calc-go");
  const afterEl = el("calc-after");
  const stateEl = el("calc-state");
  let quote = build();
  let locked = false; // true once "calculate" has been pressed

  function renderLines() {
    quote = build();
    el("calc-lines").innerHTML = quote.lines.map((l) => `
      <li class="calc-line">
        <span class="cl-name">${bi(l.uk, l.en)}</span>
        <span class="cl-dots" aria-hidden="true"></span>
        <span class="cl-price">${money(l.price)}</span>
      </li>`).join("") +
      (quote.monthly ? `
      <li class="calc-line is-monthly">
        <span class="cl-name">${bi("Підтримка", "Support")}</span>
        <span class="cl-dots" aria-hidden="true"></span>
        <span class="cl-price">${money(quote.monthly)}${bi("/міс", "/mo")}</span>
      </li>` : "");
    stateEl.textContent = locked ? "● READY" : "● DRAFT";
    stateEl.classList.toggle("is-ready", locked);
  }

  function unlock() {
    if (!locked) { renderLines(); return; }
    locked = false;
    countGen++; // any in-flight counter must not repaint over the mask
    totalEl.classList.add("is-masked");
    totalEl.textContent = "$•••";
    subEl.hidden = true;
    etaEl.hidden = true;
    afterEl.hidden = true;
    goBtn.hidden = false;
    paper.classList.remove("is-final");
    renderLines();
  }

  /* --------------------------------------------------------------- listeners */
  el("calc-config").addEventListener("change", (e) => {
    const t = e.target;
    if (t.name === "calc-dev") state.dev = t.value;
    else if (t.name === "calc-cat") { state.cat = t.value; syncOnly(); renderSupport(); }
    else if (t.id === "calc-niche") state.niche = t.value;
    else if (t.dataset.group) state.groups[t.dataset.group] = t.value;
    else if (t.dataset.kind === "block") t.checked ? state.blocks.add(t.value) : state.blocks.delete(t.value);
    else if (t.dataset.kind === "service") t.checked ? state.services.add(t.value) : state.services.delete(t.value);
    else if (t.dataset.kind === "support") state.support = t.checked;
    unlock();
  });

  /* the payload the admin panel receives: Ukrainian labels, so an estimate
     reads the same in the panel no matter which language the visitor used */
  function payload() {
    const d = dev(), c = cat();
    return {
      lang,
      developer: d.uk,
      category: c.uk,
      niche: state.niche,
      total: quote.total,
      monthly: quote.monthly,
      days: quote.days + "–" + quote.dayMax,
      items: quote.lines.map((l) => ({ label: l.uk, price: l.price })),
    };
  }

  /* The ticking counter is decoration; the figure it lands on is not. In a
     background or non-compositing tab requestAnimationFrame can fire once and
     then stop, which would strand a half-counted number — or a plain zero — on
     screen as if it were the price. So the real figure is written before the
     animation starts AND again on a timer that does not depend on frames, and
     a generation token stops a late write from painting over a rebuild. */
  let countGen = 0;
  function countUp(to) {
    const mine = ++countGen;
    totalEl.textContent = money(to);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const t0 = performance.now(), dur = 900;
    (function step(now) {
      if (mine !== countGen) return;              // superseded by a rebuild
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      totalEl.textContent = money(Math.round(to * eased));
      if (p < 1) requestAnimationFrame(step);
    })(performance.now());

    setTimeout(() => {
      if (mine === countGen) totalEl.textContent = money(to);
    }, dur + 80);
  }

  goBtn.addEventListener("click", async () => {
    quote = build();
    locked = true;
    renderLines();

    goBtn.hidden = true;
    totalEl.classList.remove("is-masked");
    paper.classList.add("is-final");
    countUp(quote.total);

    subEl.hidden = !quote.monthly;
    if (quote.monthly) {
      subEl.innerHTML = "+ " + money(quote.monthly) +
        bi("/міс за підтримку — окремо від разової суми", "/mo for support — separate from the one-off total");
    }
    etaEl.hidden = false;
    etaEl.innerHTML =
      bi("Орієнтовний строк: ", "Estimated timeline: ") +
      `<b>${quote.days}–${quote.dayMax}</b>` + bi(" днів", " days");
    afterEl.hidden = false;

    // the estimate reaches the admin panel even if the visitor never writes to
    // us — a silent failure here must never break the number on screen
    try {
      await fetch("/api/estimates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload()),
      });
    } catch (_) { /* offline — the visitor still has their price */ }
  });

  el("calc-reset").addEventListener("click", () => {
    unlock();
    document.getElementById("calc").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  /* hand the estimate to the contact form instead of making them retype it */
  el("calc-send").addEventListener("click", () => {
    const form = document.getElementById("contact-form");
    if (!form) return;
    const p = payload();
    const spec = quote.lines.map((l) => "· " + (lang === "uk" ? l.uk : l.en) + " — " + money(l.price)).join("\n");
    form.budget.value = "$" + quote.total;
    form.budget.dispatchEvent(new Event("input", { bubbles: true }));
    form.message.value = (lang === "uk"
      ? "Розрахунок з калькулятора:\n" + spec +
        "\n\nРазом: " + money(p.total) +
        (p.monthly ? "\nПідтримка: " + money(p.monthly) + "/міс" : "") +
        "\nСфера: " + (p.niche || "не вказано") +
        "\nВиконавець: " + p.developer
      : "Estimate from the calculator:\n" + spec +
        "\n\nTotal: " + money(p.total) +
        (p.monthly ? "\nSupport: " + money(p.monthly) + "/mo" : "") +
        "\nIndustry: " + (p.niche || "not specified") +
        "\nDeveloper: " + p.developer);
    form.message.dispatchEvent(new Event("input", { bubbles: true }));
  });

  renderLines();
})();
