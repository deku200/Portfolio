/* ==========================================================
   KVS-style portfolio — ascii hero, glitch,
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

// Any stored asset path, made safe to use from /en/ as well as from /
const assetUrl = (u) => {
  const s = String(u || "");
  return (!s || s.charAt(0) === "/" || /^(https?:|data:)/i.test(s)) ? s : "/" + s;
};

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
    photo: "/img/yaroslav.webp" },
  { name: { en: "OLEKSANDR", uk: "ОЛЕКСАНДР" }, id: "#SV-002",
    role: { en: "COLLABORATOR", uk: "ПАРТНЕР" },
    location: { en: "UKRAINE", uk: "УКРАЇНА" }, status: "online",
    bio: { en: "FULL-STACK DEVELOPER WITH A FOCUS ON AUTOMATION AND QUALITY.",
           uk: "FULL-STACK РОЗРОБНИК З ФОКУСОМ НА АВТОМАТИЗАЦІЮ ТА ЯКІСТЬ." },
    skills: [{ label: { en: "FRONTEND", uk: "FRONTEND" }, level: 7 }, { label: { en: "BACKEND", uk: "BACKEND" }, level: 8 },
             { label: { en: "DEVOPS", uk: "DEVOPS" }, level: 6 }, { label: { en: "DESIGN", uk: "ДИЗАЙН" }, level: 6 }],
    photo: "/img/oleksandr.webp" },
  { name: { en: "ROMAN", uk: "РОМАН" }, id: "#SV-003",
    role: { en: "PARTNER", uk: "ПАРТНЕР" },
    location: { en: "UKRAINE", uk: "УКРАЇНА" }, status: "online",
    bio: { en: "FRONT-END DEVELOPER BUILDING FAST, PIXEL-PERFECT INTERFACES.",
           uk: "FRONT-END РОЗРОБНИК, СТВОРЮЄ ШВИДКІ, ПІКСЕЛЬ-ПЕРФЕКТНІ ІНТЕРФЕЙСИ." },
    skills: [{ label: { en: "FRONTEND", uk: "FRONTEND" }, level: 10 }, { label: { en: "BACKEND", uk: "BACKEND" }, level: 8 },
             { label: { en: "DESIGN", uk: "ДИЗАЙН" }, level: 6 }, { label: { en: "DEVOPS", uk: "DEVOPS" }, level: 8 }],
    photo: "/img/roman.webp" },
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
  calcBtn:      { en: "CALCULATE THE PRICE", uk: "РОЗРАХУВАТИ ВАРТІСТЬ" },
  heroLine:     { en: "&lt;PRICE YOUR FUTURE WEBSITE IN 30 SECONDS.<br>PICK THE DEVELOPER, THE BLOCKS AND THE INTEGRATIONS —<br>AND <b>SEE AN HONEST FIGURE</b>, WITH NO CALLS AND NO WAITING.<br>WEBSITES FROM $400&gt;",
                  uk: "&lt;РОЗРАХУЙ ВАРТІСТЬ СВОГО МАЙБУТНЬОГО САЙТУ ЗА 30 СЕКУНД.<br>ОБЕРИ РОЗРОБНИКА, БЛОКИ ТА ІНТЕГРАЦІЇ —<br>І <b>ПОБАЧ ЧЕСНУ ЦІНУ</b>, БЕЗ ДЗВІНКІВ І ОЧІКУВАННЯ.<br>САЙТИ — ВІД $400&gt;" },
  // desktop-only headline, two lines; the CSS sizes it for lines of up to 24 characters
  heroHook:     { en: "STILL THINKING?<br>YOUR RIVALS <em>ARE SELLING.</em>",
                  uk: "ПОКИ ТИ ДУМАЄШ —<br>КОНКУРЕНТИ <em>ВЖЕ ПРОДАЮТЬ.</em>" },
  heroHookSub:  { en: "&lt;A LANDING PAGE IN 4 DAYS — AND YOU'RE SELLING TOO&gt;",
                  uk: "&lt;ЛЕНДІНГ ЗА 4 ДНІ — І ПРОДАЄШ УЖЕ ТИ&gt;" },
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
  clientsLabel: { en: "&lt;THOSE WHO CHOSE US&gt;", uk: "&lt;НАС ОБИРАЮТЬ&gt;" },
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

/* The URL decides the language, not localStorage. Ukrainian is served at /
   and English at /en/, and the Worker has already stamped the answer onto
   <html data-lang>. Letting a stale stored preference win would serve English
   from a URL Google indexed as Ukrainian, which is the one thing separate
   addresses exist to prevent. */
let lang = document.documentElement.getAttribute("data-lang") === "en" ? "en" : "uk";

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
  if (!btn) return;
  // the href already points at the other language's copy of this page, so the
  // browser handles the navigation; this only remembers the choice
  try { localStorage.setItem("lang", btn.dataset.lang); } catch (_) {}
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

/* ---------- 1. STARTUP ---------- */
/* There was a loading screen here: a percentage counting itself to 100 over
   about two seconds, then an ASCII splash with a "click to enter" button. Both
   are gone, and nothing replaced them — the site is simply on screen.

   The percentage was measuring nothing; the page behind it had already
   rendered. And the gate cost us the visitors we spend the most effort on:
   someone arriving from a search result has a question, not an appetite for a
   title card, and a crawler runs this JavaScript but never clicks, so anything
   behind the button was effectively not on the page at all.

   What survives is the part that did work — starting the hero and the section
   observers, and honouring a deep link. Deferred by a tick because both live
   further down this file and touch bindings that are not initialised yet. */
setTimeout(() => {
  startHero();
  observeSections();
  applyIncomingHash();
}, 0);

/* A deep link such as /#contact still needs applying by hand. The browser
   looks for the target while the horizontal scroller has not worked out its
   panels yet, so the jump either lands in the wrong place or is dropped. */
function applyIncomingHash() {
  if (!location.hash || location.hash.length < 2) return;
  // the calculator moved to its own page; old /#calc links still get there
  if (location.hash === "#calc") {
    location.replace((document.documentElement.getAttribute("data-lang") === "en" ? "/en" : "") + "/calculator");
    return;
  }
  let target = null;
  try { target = document.querySelector(location.hash); } catch (_) { return; } // not a valid selector
  if (!target) return;

  const jump = () => {
    const hs = document.getElementById("hscroll");
    // blocks inside the horizontal scroller need its panel maths, not a scroll
    if (hs && hs.gotoPanel && hs.gotoPanel(target)) return;
    target.scrollIntoView({ block: "start", behavior: "instant" });
  };
  // deliberately not requestAnimationFrame: it does not fire in a background
  // or non-compositing tab, and a deep link that quietly does nothing is worse
  // than one that lands a beat late. The second pass catches the layout
  // settling as fonts and images finish loading.
  jump();
  setTimeout(jump, 220);
}
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

/* ---------- 2a2. PIN THE HEADER TO THE PAGE'S WIDTH ---------- */
/* The header is the only position:fixed element on the page, and on a phone it
   was the only thing overflowing to the right: every element in normal flow sat
   correctly inside the 5vw padding while the language switch hung off the edge
   of the screen.

   That difference is the whole diagnosis. A fixed element is sized against the
   browser's layout viewport, not against the document, and a mobile browser is
   free to make the layout viewport wider than the screen — which it does, for
   its own reasons, in in-app WebViews especially. Everything in flow is bounded
   by <body>; only the fixed header follows the wider box, so the menu drifts
   right by half the excess and the switch, pinned right, by all of it.

   No engine available here reproduces it, so rather than guess at which
   browser behaviour widens the viewport, the header is told to be exactly as
   wide as the element the rest of the page is laid out in. Then the two cannot
   disagree, whatever the viewport is doing. */
{
  const header = $(".site-header");
  if (header) {
    const pin = () => {
      const w = document.body.clientWidth;
      if (w > 0) header.style.width = w + "px";
    };
    pin();
    addEventListener("resize", pin);
    addEventListener("orientationchange", pin);
    // the toolbar collapsing on a phone resizes the body without firing resize
    if (typeof ResizeObserver === "function") new ResizeObserver(pin).observe(document.body);
    // fonts land after first paint and can change the body's scrollbar state
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(pin);
  }
}

/* ---------- 2b. CURSOR TRAIL (sparse dim symbols following the mouse) ---------- */
{
  const cv = document.createElement("canvas");
  /* width/height in the style, not just inset:0. A <canvas> is a replaced
     element: with width:auto its layout box comes from the bitmap attribute,
     and "left:0;right:0" is quietly dropped as over-constrained. So the box was
     as wide as innerWidth happened to be the last time fit() ran — and if that
     was ever wider than the screen (a WebView reporting the pre-toolbar width,
     a rotation, a resize the listener missed) the canvas widened the layout
     viewport with it. overflow-x:hidden on <html> hides that horizontally, but
     the fixed header is laid out against the widened viewport, which is how the
     language switch ended up past the right edge of a phone. */
  cv.style.cssText =
    "position:fixed;top:0;left:0;width:100%;height:100%;z-index:85;pointer-events:none;";
  document.body.appendChild(cv);
  const ctx = cv.getContext("2d");
  const TRAIL_CHARS = "·:;+*x%#?!<>[]{}=~^";
  const parts = [];
  let lastSpawn = 0;

  /* Size the bitmap from the element's own box, not from innerWidth. The trail
     is drawn in clientX/clientY, which only line up with canvas coordinates
     while the two are equal — and now that the box is width:100% rather than
     the bitmap's intrinsic size, innerWidth is no longer guaranteed to be it.
     A ResizeObserver rather than the resize event, because the box also changes
     when a mobile toolbar collapses, which fires no resize at all. */
  function fit() {
    const r = cv.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width));
    const h = Math.max(1, Math.round(r.height));
    if (cv.width !== w) cv.width = w;     // assigning clears the canvas, so
    if (cv.height !== h) cv.height = h;   // only do it when it really changed
  }
  fit();
  if (typeof ResizeObserver === "function") new ResizeObserver(fit).observe(cv);
  // and the window events too: two independent triggers, so a throttled or
  // missing observer callback cannot be the single thing this depends on
  addEventListener("resize", fit);
  addEventListener("orientationchange", fit);

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
      ctx.fillStyle = `rgba(232,60,50,${a})`;
      ctx.font = `${p.size | 0}px monospace`;
      ctx.fillText(p.c, p.x, p.y);
    }
    requestAnimationFrame(draw);
  })();
}

/* ---------- 2c. PROJECT SHOWCASE on the hero: laptop, or phone ---------- */
/* Our own sites, running in the hero: on a laptop that opens as the page
   loads, or — below 768px — on a phone showing each site's mobile version.
   One tab per project.

   The screens show captures, not live iframes, and not by choice: four of
   these five sites send X-Frame-Options or frame-ancestors headers that forbid
   being framed by anyone, which no page can override. Five live sites on the
   first screen would also cost exactly the load time the rest of this page is
   built to protect. So each tab is a full-length capture that scrolls itself
   like someone reading the site, and the screen opens the real thing.

   Captures live in /img/showcase/: <slug>.webp is the desktop page at
   1440x900, <slug>-m.webp the phone page at 390x844. A project added here
   needs both, taken the same way. */
const SHOWCASE = [
  { slug: "master-the-blade", name: "MASTER THE BLADE", short: "BLADE",   url: "https://ronin-forge.store/" },
  { slug: "melman",           name: "МЕЛМАН",           short: "МЕЛМАН",  url: "https://melman.shop/" },
  { slug: "jemonty",          name: "JeMonty",          short: "JEMONTY", url: "https://jemonty.shop/" },
  { slug: "orlevan",          name: "ORLEVAN SHOP",     short: "ORLEVAN", url: "https://www.orlevan.store/" },
  { slug: "moclame-home",     name: "MOCLAME HOME",     short: "MOCLAME", url: "https://moclame-home.shop/en/" },
];

/* One screen's worth of behaviour — the tabs, the address bar, the scrolling
   capture, autoplay — bound to whichever device shell it is handed. The laptop
   and the phone get one each, and only the one on screen ever runs, so a phone
   never downloads the desktop captures, nor the other way round. */
function makeShowcase(o) {
  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const HOLD = 1.6;      // seconds held still at the top and at the bottom
  const wrap = (i) => (i + SHOWCASE.length) % SHOWCASE.length;

  let built = false, running = false;
  let current = -1;
  let ratio = 0;         // height / width of the current capture
  let dir = 1;           // 1 = reading down, -1 = back up
  let autoplay = !REDUCED && !o.follower;   // a follower never moves on by itself
  let want = 0;          // the project to open with: a follower is told which
  let visible = true;
  let timer = 0;
  let offset = 0;        // where the capture sits, in px: 0 is the top, negative is scrolled
  let travel = 0;        // how far it can go: capture height minus screen height
  let endAt = 0;         // where the running pass is headed
  let manual = false;    // true while the pointer is on the screen and scrolls it
  let firstRun = true;
  let tabs = [];

  function buildTabs() {
    o.tabsEl.setAttribute("aria-label", lang === "uk" ? "Наші проєкти" : "Our projects");
    if (o.openLabel) o.openEl.textContent = lang === "uk" ? "ВІДКРИТИ ↗" : "OPEN ↗";
    // the accessible name is always the full project name; the phone shows a
    // shorter one, which the full name still contains
    o.tabsEl.innerHTML = SHOWCASE.map((p, i) =>
      '<button type="button" role="tab" class="' + o.tabClass + '" id="' + o.id + "-tab-" + i + '"' +
      ' aria-controls="' + o.id + '-view" aria-selected="false" tabindex="-1" aria-label="' + p.name + '">' +
      '<span class="' + o.tabClass + '-dot" aria-hidden="true"></span>' +
      '<span class="' + o.tabClass + '-name" aria-hidden="true">' + o.label(p) + "</span></button>").join("");
    tabs = [].slice.call(o.tabsEl.children);

    o.tabsEl.addEventListener("click", (e) => {
      const t = e.target.closest("." + o.tabClass);
      if (t) show(tabs.indexOf(t), true);
    });
    o.tabsEl.addEventListener("keydown", (e) => {
      let i = null;
      if (e.key === "ArrowRight") i = current + 1;
      else if (e.key === "ArrowLeft") i = current - 1;
      else if (e.key === "Home") i = 0;
      else if (e.key === "End") i = SHOWCASE.length - 1;
      if (i === null) return;
      e.preventDefault();
      show(i, true);
      tabs[current].focus();
    });
  }

  function build() {
    built = true;
    // a follower has no tabs of its own: it shows whatever its leader shows
    if (o.tabsEl) buildTabs();

    /* Pointer on the screen: the capture stops where it is and the wheel
       scrolls it, the way a real page would. At either end the wheel is let
       through, so the page itself can still scroll past the laptop. When the
       pointer leaves, autoplay does not come back — they have started reading
       — but the capture carries on scrolling from where they left it. */
    o.view.addEventListener("mouseenter", () => {
      autoplay = false;
      if (!running) return;
      manual = true;
      clearTimeout(timer);
      offset = currentOffset();
      measure();
      o.shot.classList.remove("is-scrolling");
      o.shot.style.transform = "translateY(" + offset + "px)";
    });
    o.view.addEventListener("wheel", (e) => {
      if (!manual) return;
      // lines (Firefox) and pages come in other units than pixels
      const dy = e.deltaMode === 1 ? e.deltaY * 16
        : e.deltaMode === 2 ? e.deltaY * o.view.clientHeight : e.deltaY;
      const next = Math.max(-travel, Math.min(0, offset - dy));
      if (next === offset) return;                 // at an end: the page may have it
      e.preventDefault();
      offset = next;
      o.shot.style.transform = "translateY(" + offset + "px)";
    }, { passive: false });
    o.view.addEventListener("mouseleave", () => {
      if (!manual) return;
      manual = false;
      if (!running) return;
      dir = offset <= -travel + 1 ? -1 : 1;       // on, in whichever direction has room
      cycle();
    });

    if ("IntersectionObserver" in window) {
      new IntersectionObserver((es) => { visible = es[0].isIntersecting; }).observe(o.stage);
    }
    let resizeT = 0;
    addEventListener("resize", () => {
      clearTimeout(resizeT);
      resizeT = setTimeout(() => { if (running && ratio && !manual) cycle(); }, 250);
    });

    // lean toward the pointer — laptop, desktop pointer only
    if (o.tilt && !REDUCED && matchMedia("(hover: hover) and (pointer: fine)").matches) {
      addEventListener("pointermove", (e) => {
        if (!running) return;
        const rx = (e.clientY / innerHeight - 0.5) * -7;
        const ry = (e.clientX / innerWidth - 0.5) * 12;
        o.tilt.style.transform = "rotateX(" + rx.toFixed(1) + "deg) rotateY(" + ry.toFixed(1) + "deg)";
      });
    }
  }

  function preload(i) {
    const im = new Image();
    im.decoding = "async";
    im.src = o.src(SHOWCASE[wrap(i)]);
  }

  /* One scroll pass, down or back up, with a still moment at each end. The
     scrolling itself is a CSS animation; what happens after it is a timer,
     because an animation event is the kind of thing a background or
     non-compositing tab never delivers, and the tab switch is not decoration. */
  function measure() {
    travel = Math.max(0, o.view.clientWidth * ratio - o.view.clientHeight);
  }

  // where the capture is at this instant — mid-animation included
  function currentOffset() {
    const m = getComputedStyle(o.shot).transform;
    const v = m && m !== "none" && m.match(/matrix(?:3d)?\(([^)]+)\)/);
    if (!v) return offset;
    const a = v[1].split(",").map(Number);
    const y = a.length === 16 ? a[13] : a[5];
    return isFinite(y) ? y : offset;
  }

  /* One pass, from wherever the capture is to one end or the other, with a
     still moment at each end. The movement is a CSS animation; what happens
     after it is a timer, because an animation event is the kind of thing a
     background or non-compositing tab never delivers, and the tab switch is
     not decoration. */
  function cycle() {
    clearTimeout(timer);
    measure();
    offset = Math.max(-travel, Math.min(0, offset));
    const to = dir > 0 ? -travel : 0;
    const scroll = Math.abs(to - offset) / o.speed;
    const delay = HOLD + (firstRun ? o.boot : 0);
    firstRun = false;

    o.shot.style.transform = "";
    o.shot.style.setProperty("--from", offset + "px");
    o.shot.style.setProperty("--to", to + "px");
    o.shot.style.setProperty("--dur", scroll.toFixed(2) + "s");
    o.shot.style.setProperty("--delay", delay.toFixed(2) + "s");
    o.shot.classList.remove("is-scrolling");
    void o.shot.offsetWidth;                       // restart the animation
    if (!REDUCED) o.shot.classList.add("is-scrolling");
    endAt = to;
    arm((delay + scroll + HOLD) * 1000);
  }

  function arm(ms) {
    clearTimeout(timer);
    t0 = Date.now(); left = ms;
    timer = setTimeout(done, ms);
  }

  function done() {
    if (!running) return;
    // a hidden browser tab has nobody watching: hold here, advancing nothing and
    // fetching nothing, and pick up again once someone looks
    if (document.hidden) { arm(1000); return; }
    if (!REDUCED) offset = endAt;                  // the pass got where it was going
    if (autoplay && visible && dir > 0) show(current + 1);
    else { dir = -dir; cycle(); }                  // read it back up, then down
  }

  function show(i, byUser, force) {
    if (byUser) autoplay = false;                  // they are driving now
    i = wrap(i);
    if (i === current && !force) return;
    current = i;
    const p = SHOWCASE[i];
    if (o.onShow) o.onShow(i);
    manual = false;

    tabs.forEach((t, k) => {
      const on = k === i;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
    });
    // keep the active tab in sight when the strip overflows — by scrolling the
    // strip itself: scrollIntoView would also drag the page back up to the
    // hero every time autoplay moved on
    const t = tabs[i];
    if (t) o.tabsEl.scrollLeft = t.offsetLeft - (o.tabsEl.clientWidth - t.offsetWidth) / 2;

    const host = p.url.replace(/^https?:\/\//, "").replace(/\/$/, "");
    o.urlEl.innerHTML = "<span>https://</span><b>" + host + "</b>";
    o.link.href = p.url;
    if (o.openEl) o.openEl.href = p.url;
    o.link.setAttribute("aria-label", (lang === "uk" ? "Відкрити сайт " : "Open ") + p.name);
    if (t) o.view.setAttribute("aria-labelledby", t.id);
    o.shot.alt = (lang === "uk" ? "Сайт " : "Website ") + p.name;

    clearTimeout(timer);
    o.shot.classList.add("is-swapping");
    const next = new Image();
    next.decoding = "async";
    next.onload = () => {
      if (current !== i || !running) return;       // superseded, or put away
      ratio = next.naturalHeight / next.naturalWidth;
      o.shot.src = next.src;
      o.shot.classList.remove("is-swapping");
      dir = 1;
      offset = 0;                                  // a new site starts at its top
      cycle();
      preload(i + 1);
    };
    next.src = o.src(p);
  }

  return {
    start() {
      if (running) return;
      running = true;
      if (!built) build();
      // open (or wake) once the page has painted; reduced motion skips it
      if (REDUCED) o.device.classList.add("is-on", "is-open");
      else setTimeout(() => {
        o.device.classList.add("is-on");
        setTimeout(() => o.device.classList.add("is-open"), 250);
      }, 350);
      show(current < 0 ? want : current, false, true);
    },
    stop() {
      running = false;
      clearTimeout(timer);
    },
    // a follower: open the project its leader has just opened
    follow(i) {
      want = i;
      if (running) show(i);
    },
  };
}

function startShowcase() {
  const lapRoot = $("#lap-stage"), phRoot = $("#ph-stage");
  if (!lapRoot || !phRoot) return;
  const q = (root, s) => root.querySelector(s);

  /* On a desktop a phone stands beside the laptop, showing the mobile version
     of whatever the laptop has open. It is a follower: no tabs of its own, no
     autoplay; the laptop tells it which project to show. */
  const lapPhone = q(lapRoot, ".lap-phone");
  const deskPhone = lapPhone ? makeShowcase({
    id: "lph", follower: true, stage: lapRoot, device: q(lapPhone, ".ph"), tilt: null,
    tabsEl: null, tabClass: "", urlEl: q(lapPhone, ".ph-url"), openEl: null, openLabel: false,
    view: q(lapPhone, ".ph-view"), link: q(lapPhone, ".ph-view-link"), shot: q(lapPhone, ".ph-shot"),
    src: (p) => "/img/showcase/" + p.slug + "-m.webp",
    label: (p) => p.short, speed: 130, boot: 2.6,
  }) : null;

  const laptop = makeShowcase({
    id: "lap", stage: lapRoot, device: q(lapRoot, ".lap"), tilt: q(lapRoot, ".lap-tilt"),
    tabsEl: q(lapRoot, ".lap-tabs"), tabClass: "lap-tab",
    urlEl: q(lapRoot, ".lap-url"), openEl: q(lapRoot, ".lap-open"), openLabel: true,
    view: q(lapRoot, ".lap-view"), link: q(lapRoot, ".lap-view-link"), shot: q(lapRoot, ".lap-shot"),
    src: (p) => "/img/showcase/" + p.slug + ".webp",
    label: (p) => p.name, speed: 170, boot: 1.9,
    // the phone beside it follows along
    onShow: (i) => { if (deskPhone) deskPhone.follow(i); },
  });
  const phone = makeShowcase({
    id: "ph", stage: phRoot, device: q(phRoot, ".ph"), tilt: null,
    tabsEl: q(phRoot, ".ph-tabs"), tabClass: "ph-tab",
    urlEl: q(phRoot, ".ph-url"), openEl: q(phRoot, ".ph-urlbar"), openLabel: false,
    view: q(phRoot, ".ph-view"), link: q(phRoot, ".ph-view-link"), shot: q(phRoot, ".ph-shot"),
    src: (p) => "/img/showcase/" + p.slug + "-m.webp",
    label: (p) => p.short, speed: 130, boot: 1.4,
  });

  // the same breakpoint the stylesheet uses to hide one and show the other
  const mq = matchMedia("(max-width: 768px)");

  /* The phone's size is the stylesheet's. It used to be measured into the
     room left above the copy; since the hero became one flowing column the
     phone sits under the "calculate" button and there is nothing to fit. */
  let active = null;
  const pick = () => {
    const next = mq.matches ? phone : laptop;
    if (next === active) return;
    if (active) active.stop();
    if (deskPhone && active === laptop) deskPhone.stop();
    active = next;
    active.start();
    if (deskPhone && active === laptop) deskPhone.start();
  };
  pick();
  if (mq.addEventListener) mq.addEventListener("change", pick);
  else mq.addListener(pick);
}

/* ---------- 3. ASCII PARTICLE FLOOR (hero) ---------- */
let broken = false;
function startHero() {
  startShowcase();
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
  /* ...and whenever the hero changes size without the window doing so. On a
     phone the hero is a flowing column, which grows as the web font and the
     scrambled lines settle, and a canvas sized once would keep its first size. */
  if (typeof ResizeObserver === "function") new ResizeObserver(resize).observe(canvas);
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
  if (el.dataset.original == null) el.dataset.original = el.textContent;

  /* Scrambled line by line, with the <br>s kept. It used to scramble
     el.textContent, which has no line breaks in it, so for the length of the
     effect a multi-line block became one long line — in the hero that line ran
     straight across the laptop and the phone. */
  const holder = document.createElement("div");
  const lines = html.split(/<br\s*\/?>/i).map((part) => {
    holder.innerHTML = part;
    return holder.textContent;
  });
  const length = lines.reduce((sum, line) => sum + line.length, 0);
  const esc = (c) => (c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c);

  // a newer run (hovering again mid-effect) takes over from this one
  const gen = (el._scrambleGen = (el._scrambleGen || 0) + 1);
  const finish = () => { if (el._scrambleGen === gen) el.innerHTML = html; };

  const FRAMES = 24;
  let frame = 0;
  const tick = () => {
    if (el._scrambleGen !== gen) return;
    frame++;
    const reveal = Math.floor((frame / FRAMES) * length);
    let k = 0;
    el.innerHTML = lines.map((line) => line.split("").map((c) => {
      const i = k++;
      if (/\s/.test(c)) return c;
      return esc(i <= reveal ? c : SCRAMBLE_CHARS[(Math.random() * SCRAMBLE_CHARS.length) | 0]);
    }).join("")).join("<br>");
    if (frame < FRAMES) requestAnimationFrame(tick);
    else finish();
  };
  tick();
  // rAF drives the effect, never the final text: in a background or
  // non-compositing tab it can stop after one frame and strand the scramble
  // half-done, which is exactly what the hero looked like in such a tab
  setTimeout(finish, FRAMES * 50 + 200);
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
    ".hero-corner, .ring-label, .ring-ui, .quote-label, .quote-author, " +
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

  /* Anything outside this section (an incoming /#contact deep link, say) can
     hand us an element and let the scroller work out which panel holds it,
     rather than duplicating the panel maths at the call site. */
  hs.gotoPanel = (el) => {
    const i = panels.findIndex((p) => p.contains(el));
    if (i === -1) return false;
    hs.scrollIntoView({ block: "start", behavior: "instant" });
    if (desktop.matches) { idx = i; apply(); }
    else el.scrollIntoView({ block: "start", behavior: "instant" });
    return true;
  };

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
    if (box) box.innerHTML = `<img src="${esc(assetUrl(o.photo))}" alt="slv_visual team member" />`;
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
          ? `<img src="${assetUrl(p.photo)}" alt="${(p.name || "Partner")} — slv_visual" loading="lazy" decoding="async" />`
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
      box.innerHTML = sm.photo
        ? `<img src="${esc(assetUrl(sm.photo))}" alt="${esc(sm.name.en)} — slv_visual" loading="lazy" decoding="async" />`
        : "[ PHOTO ]";
    });
    if (!tabsNav.querySelector(".team-tab.is-active")) tabs[0].classList.add("is-active");
    if (!panelsWrap.querySelector(".team-panel.is-active")) panels[0].classList.add("is-active");
  }

  function renderProjects(projects) {
    // every project goes on the ring (§15), in the admin panel's order
    const track = document.getElementById("ring-track");
    if (!track || !projects || !projects.length) return;
    const host = (u) => String(u).replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "");
    track.innerHTML = projects.map((p, i) => {
      const title = esc(p.title);
      const link = p.link ? esc(p.link) : "";
      const desc = p.desc || {};
      const uk = esc(desc.uk || desc.en || ""), en = esc(desc.en || desc.uk || "");
      const tags = String(p.tags || "").split(",").map((t) => t.trim()).filter(Boolean)
        .map((t) => `<span>${esc(t)}</span>`).join("");
      const front = link ? `a class="rc-face rc-front" href="${link}" target="_blank" rel="noopener noreferrer" tabindex="-1" draggable="false"`
        : `div class="rc-face rc-front"`;
      return `<article class="ring-card">
        <${front}>
          <span class="rc-bar" aria-hidden="true"><i></i><i></i><i></i><span class="rc-url">${link ? esc(host(p.link)) : "slv_visual"}</span></span>
          ${p.image ? `<img src="${esc(p.image)}" alt="${title}${lang === "uk" ? " — сайт, розроблений slv_visual" : " — website built by slv_visual"}" loading="lazy" decoding="async" draggable="false" />` : ""}
        </${link ? "a" : "div"}>
        <div class="rc-face rc-back" aria-hidden="true">
          <span class="rc-no">${String(i + 1).padStart(3, "0")}</span>
          <span class="rc-name">&lt;${title}&gt;</span>
        </div>
        <div class="rc-info">
          <div class="w-head"><span class="w-case">${esc(p.caseLabel || "")}</span><span class="w-status${/live/i.test(p.status) ? " is-live" : ""}">${esc(p.status || "")}</span></div>
          <h3 class="work-title">${link ? `<a href="${link}" target="_blank" rel="noopener noreferrer">&lt;${title}&gt; ↗</a>` : `&lt;${title}&gt;`}</h3>
          <p class="work-desc"><span data-lang-block="uk">${uk}</span><span data-lang-block="en">${en}</span></p>
          <div class="w-tags">${tags}</div>
        </div>
      </article>`;
    }).join("");
    Ring.refresh();
  }

  Promise.all([
    fetch("/api/team").then(r => r.ok ? r.json() : Promise.reject()),
    fetch("/api/projects").then(r => r.ok ? r.json() : Promise.reject()),
  ]).then(([team, projects]) => {
    /* Normalise every stored path once, here, rather than at each render site:
       the database holds a mix of "img/…" and "/uploads/…", and a relative one
       resolves against /en/ and 404s. Missing one render site is exactly how
       the team photos broke the first time. */
    (team || []).forEach((m) => { m.photo = assetUrl(m.photo); });
    (projects || []).forEach((p) => { p.image = assetUrl(p.image); });
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

/* ---------- 14. ESTIMATE FROM THE CALCULATOR PAGE ----------
   "Send a request with this estimate" on /calculator leaves the estimate in
   sessionStorage and comes here to /#contact. Fill the form once, then forget
   it, so a reload does not paste it in again. */
(function estimateHandoff() {
  const form = document.getElementById("contact-form");
  if (!form) return;
  let e = null;
  try {
    e = JSON.parse(sessionStorage.getItem("slv_estimate") || "null");
    sessionStorage.removeItem("slv_estimate");
  } catch (_) { return; }
  if (!e) return;
  // the contact is only filled in if the visitor has not typed one already;
  // the budget field starts as a bare "$", so it and the message are replaced
  const set = (name, v, keep) => {
    const f = form.elements[name];
    if (!v || !f || (keep && f.value.trim())) return;
    f.value = v;
    f.dispatchEvent(new Event("input", { bubbles: true }));
  };
  set("contact", e.contact, true);
  set("budget", e.budget);
  set("message", e.message);
})();

/* ---------- 15. WORK RING ----------
   The projects stand on a ring in 3D and turn in a loop. `pos` is where the
   ring is, in cards (fractional while it turns); `target` is where it is
   going. Arrows, the dots, a click on a side card, the keyboard, a swipe or
   drag and the autoplay all just move `target`; one rAF loop eases `pos`
   after it, so every way of turning the ring feels the same. Autoplay waits
   while the ring is off screen, hovered, being dragged, or the tab is hidden. */
const Ring = (function workRing() {
  const stage = document.getElementById("ring-stage");
  const track = document.getElementById("ring-track");
  if (!stage || !track) return { refresh() {} };
  const info = document.getElementById("ring-info");
  const countEl = document.getElementById("ring-count");
  const dotsEl = document.getElementById("ring-dots");
  const bar = document.getElementById("ring-bar");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const AUTO = 5200; // ms each project stays in front
  const mod = (x, m) => ((x % m) + m) % m;

  let cards = [], n = 0, step = 0, radius = 0;
  let pos = 0, target = 0, active = -1, raf = 0;
  let drag = null, hovered = false, visible = false, autoT0 = performance.now(), lastT = 0;

  function layout() {
    cards = [...track.children];
    n = cards.length;
    if (!n) return;
    step = 360 / n;
    const cw = track.offsetWidth;
    // the radius at which n cards of this width close into a ring, with air
    // on a phone the ring is tighter, so the neighbours still peek in at the edges
    const air = innerWidth < 700 ? 1.18 : 1.5;
    radius = n > 2 ? (cw / 2) / Math.tan(Math.PI / n) * air : cw * .9;
    cards.forEach((c, i) => { c.style.transform = `rotateY(${i * step}deg) translateZ(${radius}px)`; });
    render();
  }

  function render() {
    if (!n) return;
    track.style.transform = `translateZ(${-radius}px) rotateY(${-pos * step}deg)`;
    cards.forEach((c, i) => {
      const d = Math.abs(mod(i - pos + n / 2, n) - n / 2); // cards from the front
      c.style.setProperty("--d", d.toFixed(3));
      c.classList.toggle("is-front", d < .5);
    });
    const a = mod(Math.round(pos), n);
    if (a !== active) { active = a; showInfo(); }
  }

  function showInfo() {
    const src = cards[active] && cards[active].querySelector(".rc-info");
    if (info && src) {
      info.innerHTML = src.innerHTML;
      info.classList.remove("is-swap");
      void info.offsetWidth; // restart the entrance animation
      info.classList.add("is-swap");
    }
    if (countEl) countEl.textContent = String(active + 1).padStart(2, "0") + " / " + String(n).padStart(2, "0");
    if (dotsEl) [...dotsEl.children].forEach((b, i) => b.setAttribute("aria-current", String(i === active)));
  }

  function tick(now) {
    raf = 0;
    // easing per millisecond, not per frame, so a 120 Hz screen turns it no faster
    const dt = lastT ? Math.min(now - lastT, 100) : 16.7;
    lastT = now;
    if (!drag) {
      if (!reduce && visible && !hovered && !document.hidden && n > 1) {
        const p = (now - autoT0) / AUTO;
        if (bar) bar.style.transform = `scaleX(${Math.min(p, 1)})`;
        if (p >= 1) { target = Math.round(target) + 1; autoT0 = now; }
      }
      const diff = target - pos;
      pos = Math.abs(diff) < .0008 ? target : pos + diff * (reduce ? 1 : 1 - Math.pow(1 - .085, dt / 16.7));
    }
    render();
    if (visible || drag || pos !== target) raf = requestAnimationFrame(tick);
    else lastT = 0;
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };

  function go(delta) {
    target = Math.round(target) + delta;
    autoT0 = performance.now();
    if (bar) bar.style.transform = "scaleX(0)";
    kick();
  }
  function goTo(i) { // the short way round
    let d = i - mod(Math.round(target), n);
    if (d > n / 2) d -= n;
    if (d < -n / 2) d += n;
    if (d) go(d);
  }

  /* drag / swipe: the ring follows the pointer, then a flick carries it on */
  const per = () => track.offsetWidth * 1.1; // px of drag per card
  stage.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || n < 2) return;
    drag = { x: e.clientX, pos, moved: 0, lastX: e.clientX, lastT: e.timeStamp, v: 0 };
    stage.classList.add("is-dragging");
    kick();
  });
  window.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    drag.moved = Math.max(drag.moved, Math.abs(dx));
    pos = drag.pos - dx / per();
    const dt = e.timeStamp - drag.lastT;
    if (dt > 0) { drag.v = (e.clientX - drag.lastX) / dt; drag.lastX = e.clientX; drag.lastT = e.timeStamp; }
  });
  const endDrag = () => {
    if (!drag) return;
    target = Math.round(pos - (drag.v * 220) / per());
    stage.dataset.moved = drag.moved > 6 ? "1" : "";
    drag = null;
    stage.classList.remove("is-dragging");
    autoT0 = performance.now();
    kick();
  };
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);

  // a drag must not count as a click; a click on a side card brings it round,
  // and only the card already in front opens the site
  stage.addEventListener("click", (e) => {
    if (stage.dataset.moved) { e.preventDefault(); e.stopPropagation(); stage.dataset.moved = ""; return; }
    const card = e.target.closest(".ring-card");
    if (!card) return;
    const i = cards.indexOf(card);
    if (i !== active) { e.preventDefault(); goTo(i); }
  }, true);

  stage.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    else if (e.key === "Enter") {
      const a = cards[active] && cards[active].querySelector("a.rc-front");
      if (a) window.open(a.href, "_blank", "noopener");
    }
  });

  // sideways trackpad scroll turns it too, one card per gesture
  let wheelAcc = 0, wheelT = 0;
  stage.addEventListener("wheel", (e) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault();
    if (e.timeStamp - wheelT > 450) wheelAcc = 0;
    wheelAcc += e.deltaX;
    if (Math.abs(wheelAcc) > 60) { go(Math.sign(wheelAcc)); wheelAcc = 0; wheelT = e.timeStamp; }
  }, { passive: false });

  const prev = document.getElementById("ring-prev"), next = document.getElementById("ring-next");
  if (prev) prev.addEventListener("click", () => go(-1));
  if (next) next.addEventListener("click", () => go(1));

  const ring = document.getElementById("work-ring");
  [stage, info].forEach((el) => {
    if (!el) return;
    el.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") hovered = true; });
    el.addEventListener("pointerleave", () => { hovered = false; autoT0 = performance.now(); });
  });
  new IntersectionObserver((es) => {
    visible = es.some((x) => x.isIntersecting);
    autoT0 = performance.now();
    kick();
  }, { threshold: 0.25 }).observe(ring || stage);

  let resizeRaf = 0;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(layout);
  });

  function refresh() {
    cards = [...track.children];
    n = cards.length;
    pos = target = 0;
    active = -1;
    if (dotsEl) {
      dotsEl.innerHTML = cards.map((_, i) =>
        `<button type="button" aria-label="${i + 1}"></button>`).join("");
      [...dotsEl.children].forEach((b, i) => b.addEventListener("click", () => goTo(i)));
    }
    layout();
    kick();
  }
  refresh();
  return { refresh };
})();
