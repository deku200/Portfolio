/* The price calculator, on its own page (/calculator). Moved out of main.js
   together with the section it drives; it needs nothing from main.js. */
/* ---------- PRICE CALCULATOR ----------
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
  // the Worker serves a separate copy of the page per language (/calculator,
  // /en/calculator), so the language is fixed for the life of the page
  const lang = document.documentElement.getAttribute("data-lang") === "en" ? "en" : "uk";

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
    { id: "landing", base: 400, support: 100, days: 4,
      uk: "Лендінг / Корпоративний", en: "Landing / Corporate",
      descUk: "Односторінковий сайт, який продає одну послугу або один товар. Уся аргументація, ціни та форма заявки — на одному екрані прокрутки.",
      descEn: "A one-page site that sells a single service or product. The whole argument, the prices and the request form live on one scroll." },
    { id: "shop", base: 900, support: 200, days: 9,
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
    ["Перший місяць підтримки — безкоштовно", "First month of support — free"],
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
        { id: "intl", price: 600,
          uk: "Закордонна платіжна система", en: "Foreign payment provider",
          noteUk: "Для продажу за кордон: картки з усього світу, оплата у валюті, гроші на закордонний рахунок.",
          noteEn: "For selling abroad: cards from anywhere, payment in foreign currency, into a foreign account." },
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
    /* perProduct only bites on a shop: a landing page has one offer to write,
       a catalogue has one description per item. */
    { id: "copy", price: 100, perProduct: 2,
      uk: "Копірайтинг: тексти для сайту", en: "Copywriting: all site texts" },
    { id: "np", price: 200, uk: "Нова Пошта: відділення та ТТН", en: "Nova Poshta: branches & waybills" },
    { id: "booking", price: 100, uk: "Онлайн-запис на послугу", en: "Online booking" },
    { id: "admin", price: 300, uk: "Адмін-панель для правок без нас", en: "Admin panel — edit it without us" },
    { id: "tgnotify", price: 50, uk: "Сповіщення про заявки в Telegram", en: "Telegram alerts for new requests" },
    { id: "analytics", price: 50, uk: "Аналітика: GA4 + Meta Pixel", en: "Analytics: GA4 + Meta Pixel" },
    { id: "chat", price: 50, uk: "Чат і месенджери на сайті", en: "On-site chat & messengers" },
    { id: "assistant", price: 400,
      uk: "AI / живий асистент з питань бізнесу", en: "AI / human assistant for business questions" },
    { id: "mail", price: 100, uk: "Email-розсилка й збір бази", en: "Email campaigns & list building" },
    { id: "crm", price: 150, uk: "Інтеграція з вашою CRM", en: "Integration with your CRM" },
    { id: "multi", price: 120, uk: "Особистий кабінет клієнта", en: "Customer account area" },
  ];

  /* Fifty-five industries in one flat alphabetical run is a scroll, not a
     choice, so they are grouped by the kind of business rather than listed.
     Within a group the order is NOT fixed here: renderNiches sorts with
     localeCompare in the language on screen, so both lists come out
     alphabetical and neither has to be re-sorted by hand when one changes. */
  const NICHE_GROUPS = [
    { uk: "Краса та здоров'я", en: "Beauty & health", items: [
      ["Барбершоп / перукарня", "Barbershop / hair salon"],
      ["Салон краси", "Beauty salon"],
      ["Нігтьова студія", "Nail studio"],
      ["Косметологія", "Cosmetology"],
      ["Стоматологія", "Dentistry"],
      ["Медична клініка", "Medical clinic"],
      ["Ветклініка / зоосалон", "Vet clinic / pet grooming"],
      ["Психолог / терапевт", "Psychologist / therapist"],
    ] },
    { uk: "Спорт і активності", en: "Sport & activities", items: [
      ["Фітнес-клуб / зал", "Gym / fitness club"],
      ["Студія танцю або йоги", "Dance or yoga studio"],
    ] },
    { uk: "Їжа та напої", en: "Food & drink", items: [
      ["Кав'ярня / ресторан", "Cafe / restaurant"],
      ["Доставка їжі", "Food delivery"],
      ["Кондитерська / випічка", "Bakery / patisserie"],
    ] },
    { uk: "Авто", en: "Automotive", items: [
      ["Автосервіс", "Car service"],
      ["Автомийка / детейлінг", "Car wash / detailing"],
      ["Автосалон / підбір авто", "Car dealership / car sourcing"],
      ["Шиномонтаж", "Tyre service"],
    ] },
    { uk: "Дім і ремонт", en: "Home & renovation", items: [
      ["Будівництво / ремонт", "Construction / renovation"],
      ["Меблі на замовлення", "Custom furniture"],
      ["Вікна, двері, стелі", "Windows, doors, ceilings"],
      ["Клінінг", "Cleaning services"],
    ] },
    { uk: "Послуги для бізнесу", en: "Business services", items: [
      ["Юридичні послуги", "Legal services"],
      ["Бухгалтерія / фінанси", "Accounting / finance"],
      ["Логістика / вантажоперевезення", "Logistics / freight"],
      ["Нерухомість / агентство", "Real estate agency"],
      ["Маркетингове агентство", "Marketing agency"],
      ["Виробництво / B2B", "Manufacturing / B2B"],
    ] },
    { uk: "Освіта", en: "Education", items: [
      ["Освіта / курси", "Education / courses"],
      ["Школа іноземних мов", "Language school"],
      ["Дитячий центр / садок", "Kids centre / preschool"],
      ["Інфобізнес / онлайн-курси", "Info-business / online courses"],
    ] },
    { uk: "Події та подорожі", en: "Events & travel", items: [
      ["Фотограф / відеограф", "Photographer / videographer"],
      ["Організація свят / event", "Events / party planning"],
      ["Весільні послуги", "Wedding services"],
      ["Туризм / тури", "Travel / tours"],
      ["Готель / хостел / оренда житла", "Hotel / hostel / short lets"],
      ["Оренда обладнання чи авто", "Equipment or car rental"],
    ] },
    { uk: "Магазин", en: "Retail", items: [
      ["Магазин одягу", "Clothing store"],
      ["Магазин взуття", "Shoe store"],
      ["Мерч / власний бренд одягу", "Merch / own clothing brand"],
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
    ] },
    { uk: "Онлайн та медіа", en: "Online & media", items: [
      ["Digital-продукт / SaaS", "Digital product / SaaS"],
      ["Блогер / особистий бренд", "Blogger / personal brand"],
    ] },
    { uk: "Інше", en: "Other", items: [
      ["Благодійний фонд", "Charity foundation"],
      ["Інша сфера", "Something else"],
    ] },
  ];

  // flat lookup; the value stored in state is always the Ukrainian label
  const NICHES = NICHE_GROUPS.reduce((all, g) => all.concat(g.items), []);

  /* ------------------------------------------------------------------- state */
  const state = {
    dev: "oleksandr",
    cat: "landing",
    niche: "",
    blocks: new Set(),
    groups: { pay: "none", seo: "base" },
    services: new Set(),
    support: false,
    products: 20,   // only used when a shop orders copywriting
    melman: false,  // the Melman referral discount
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

  /* ------------------------------------------------ industry combobox ---- */
  /* A native <select> renders its popup in the operating system's own chrome,
     which no stylesheet can reach — a white sheet with a blue highlight, in the
     middle of a black terminal. This replaces it with a listbox we draw, and
     adds the search fifty-five options need.

     The keyboard contract of the thing it replaces is kept: arrows move,
     Home/End jump, Enter picks, Escape closes and hands focus back. State
     still stores the Ukrainian label, so nothing downstream changed. */
  function nicheCombo() {
    const root = el("calc-niche");
    const trigger = root.querySelector(".cb-trigger");
    const valueEl = root.querySelector(".cb-value");
    const panel = root.querySelector(".cb-panel");
    const search = root.querySelector(".cb-search");
    const list = root.querySelector(".cb-list");
    const emptyEl = root.querySelector(".cb-empty");
    const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    const PLACEHOLDER = lang === "uk" ? "— оберіть сферу —" : "— pick your industry —";
    search.placeholder = lang === "uk" ? "почніть вводити…" : "start typing…";
    search.setAttribute("aria-label", lang === "uk" ? "Пошук сфери" : "Search industries");
    emptyEl.textContent = lang === "uk"
      ? "// нічого не знайшлося — виберіть «Інша сфера»"
      : "// nothing matched — pick \"Something else\"";

    let rows = [];    // values of the options currently on screen, in view order
    let active = -1;

    // people type the apostrophe three different ways, and "кав'ярня" is
    // unfindable if the one they used is not the one in the data
    const norm = (t) => t.toLowerCase().replace(/['\u2019\u02BC`]/g, "'").trim();
    const nameOf = (v) => {
      const hit = NICHES.find((x) => x[0] === v);
      return hit ? (lang === "uk" ? hit[0] : hit[1]) : v;
    };

    function paint(query) {
      const needle = norm(query || "");
      rows = [];
      let html = "";

      const opt = (value, text, cls) => {
        const i = rows.length;
        rows.push(value);
        html += '<li class="cb-opt' + (cls ? " " + cls : "") + '" role="option"' +
          ' id="cb-o' + i + '" data-v="' + esc(value) + '"' +
          ' aria-selected="' + (state.niche === value) + '">' + esc(text) + "</li>";
      };

      // the way back to "not chosen", which the old <select> got for free;
      // hidden while filtering, where it would only be noise
      if (!needle) opt("", PLACEHOLDER, "cb-clear");

      for (const g of NICHE_GROUPS) {
        const hits = g.items
          .filter(([uk, en]) => !needle || norm(uk).includes(needle) || norm(en).includes(needle))
          .sort((a, b) => lang === "uk"
            ? a[0].localeCompare(b[0], "uk")
            : a[1].localeCompare(b[1], "en"));
        if (!hits.length) continue;
        html += '<li class="cb-group" role="presentation">' +
          esc(lang === "uk" ? g.uk : g.en) + "</li>";
        for (const [uk, en] of hits) opt(uk, lang === "uk" ? uk : en);
      }

      list.innerHTML = html;
      emptyEl.hidden = rows.length > 0;
      setActive(rows.length ? 0 : -1);
    }

    function setActive(i) {
      const opts = list.querySelectorAll(".cb-opt");
      opts.forEach((o) => o.classList.remove("is-active"));
      active = i;
      if (i < 0 || !opts[i]) { search.removeAttribute("aria-activedescendant"); return; }
      const o = opts[i];
      o.classList.add("is-active");
      search.setAttribute("aria-activedescendant", o.id);
      // scroll the list, never the page: scrollIntoView here would drag the
      // whole calculator out from under the open panel
      const lr = list.getBoundingClientRect(), orr = o.getBoundingClientRect();
      if (orr.top < lr.top) list.scrollTop -= lr.top - orr.top;
      else if (orr.bottom > lr.bottom) list.scrollTop += orr.bottom - lr.bottom;
    }

    function open() {
      if (!panel.hidden) return;
      search.value = "";
      paint("");
      panel.hidden = false;
      root.classList.add("is-open");
      trigger.setAttribute("aria-expanded", "true");
      search.focus();
      const i = rows.indexOf(state.niche);   // start on the current choice
      if (i >= 0) setActive(i);
    }

    function close(refocus) {
      if (panel.hidden) return;
      panel.hidden = true;
      root.classList.remove("is-open");
      trigger.setAttribute("aria-expanded", "false");
      if (refocus) trigger.focus();
    }

    function choose(v) {
      state.niche = v;
      show();
      close(true);
      unlock();
    }

    function show() {
      valueEl.textContent = state.niche ? nameOf(state.niche) : PLACEHOLDER;
      root.classList.toggle("is-set", !!state.niche);
    }

    trigger.addEventListener("click", () => (panel.hidden ? open() : close(true)));
    trigger.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); open(); }
    });

    search.addEventListener("input", () => paint(search.value));
    search.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setActive(Math.min(active + 1, rows.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActive(Math.max(active - 1, 0)); }
      else if (e.key === "Home") { e.preventDefault(); setActive(0); }
      else if (e.key === "End") { e.preventDefault(); setActive(rows.length - 1); }
      else if (e.key === "Enter") { e.preventDefault(); if (active >= 0) choose(rows[active]); }
      else if (e.key === "Escape") { e.preventDefault(); close(true); }
      else if (e.key === "Tab") close(false);
    });

    // mousedown, not click: the search input still holds focus, and letting it
    // blur first would close the panel out from under the pointer
    list.addEventListener("mousedown", (e) => {
      const o = e.target.closest(".cb-opt");
      if (!o) return;
      e.preventDefault();
      choose(o.dataset.v);
    });
    list.addEventListener("mousemove", (e) => {
      const o = e.target.closest(".cb-opt");
      if (o) setActive([].indexOf.call(list.querySelectorAll(".cb-opt"), o));
    });

    document.addEventListener("click", (e) => { if (!root.contains(e.target)) close(false); });

    show();
  }
  nicheCombo();

  el("calc-included").innerHTML =
    `<p class="ci-key">${bi("Уже входить у базову ціну", "Already in the base price")}</p>` +
    `<ul class="ci-list">${INCLUDED.map(([uk, en]) =>
      `<li>${bi(uk, en)}</li>`).join("")}</ul>`;

  const optRow = (kind, o) => `
    <label class="calc-opt" data-id="${o.id}" data-only="${o.only || ""}">
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
        <span class="co-name">${bi("Підтримка далі, з другого місяця", "Ongoing support, from month two")}<em class="co-note">${
          bi("Перший місяць уже входить у ціну — безкоштовно, на будь-який сайт.",
             "The first month is already in the price — free, on any site.")}</em></span>
        <span class="co-dots" aria-hidden="true"></span>
        <span class="co-price">${money(c.support)}${bi("/міс", "/mo")}</span>
      </label>`;
  }
  renderSupport();

  /* Copywriting is the one service whose price depends on something the
     visitor has to tell us, so its quantity field appears exactly when it
     matters — a shop, with copywriting actually ticked — and the row's own
     price label switches to show the per-item rate. */
  function syncCopy() {
    const wrap = el("calc-copy-qty");
    const row = document.querySelector('#calc-services .calc-opt[data-id="copy"]');
    const svc = SERVICES.find((x) => x.id === "copy");
    const isShop = state.cat === "shop";
    wrap.hidden = !(isShop && state.services.has("copy"));
    if (row) {
      row.querySelector(".co-price").innerHTML = isShop
        ? "+" + money(svc.price) + bi(" + $2/товар", " + $2/product")
        : "+" + money(svc.price);
    }
  }

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
  syncCopy();

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
      if (!state.services.has(sv.id)) return;
      if (sv.perProduct && state.cat === "shop") {
        const n = state.products;
        push(sv.uk + " · " + n + " тов.", sv.en + " · " + n + " products",
             sv.price + n * sv.perProduct, "service");
      } else {
        push(sv.uk, sv.en, sv.price, "service");
      }
    });

    /* The Melman referral comes off the one-off total only. Discounting a
       recurring fee would keep costing us every month for a one-time
       introduction, so support stays at its full rate. Tagged "discount" so it
       is not counted as another day of work below. */
    if (state.melman) {
      const cut = Math.round(total * 0.1);
      // the rate belongs in the price column, not doubled up in the label
      push("Знижка від Мелмана", "Melman referral", -cut, "discount");
    }

    // support is recurring — it is quoted beside the total, never inside it
    const monthly = state.support ? c.support : 0;

    /* The whole schedule was halved: a day per extra block or service rather
       than two, on top of a halved base. It is still a range, not a promise —
       the low end is the quoted figure and the high end adds a third. */
    const count = lines.filter((l) => l.tag === "block" || l.tag === "service").length;
    let days = c.days + count - (d.years >= 6 ? 1 : 0);
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
      <li class="calc-line${l.tag === "discount" ? " is-discount" : ""}">
        <span class="cl-name">${bi(l.uk, l.en)}</span>
        <span class="cl-dots" aria-hidden="true"></span>
        <span class="cl-price">${
          // before "calculate" the cut is named but not priced: a real figure
          // here would give away the total the button exists to reveal
          l.tag === "discount"
            ? (locked ? "−" + money(-l.price) : "−10%")
            : money(l.price)}</span>
      </li>`).join("") +
      (quote.monthly ? `
      <li class="calc-line is-monthly">
        <span class="cl-name">${bi("Підтримка (з 2-го місяця)", "Support (from month 2)")}</span>
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
    else if (t.name === "calc-cat") { state.cat = t.value; syncOnly(); renderSupport(); syncCopy(); }
    else if (t.dataset.group) state.groups[t.dataset.group] = t.value;
    else if (t.dataset.kind === "block") t.checked ? state.blocks.add(t.value) : state.blocks.delete(t.value);
    else if (t.dataset.kind === "service") {
      t.checked ? state.services.add(t.value) : state.services.delete(t.value);
      syncCopy();
    }
    else if (t.dataset.kind === "support") state.support = t.checked;
    unlock();
  });

  el("calc-products").addEventListener("input", (e) => {
    const n = parseInt(e.target.value, 10);
    state.products = Math.max(0, Math.min(5000, isNaN(n) ? 0 : n));
    unlock();
  });
  // reflect the clamp back on blur, so the field can never disagree with the
  // quantity the estimate was actually priced on — but never mid-keystroke
  el("calc-products").addEventListener("change", (e) => { e.target.value = state.products; });

  // the referral checkbox sits in the receipt panel, outside the config form
  el("calc-melman").addEventListener("change", (e) => {
    state.melman = e.target.checked;
    unlock();
  });

  /* ------------------------------------------------------- telegram handle */
  /* Deliberately not part of `state`: state is the configuration the price is
     computed from, and typing a contact detail must not unlock and re-mask an
     estimate the way changing a block does. */
  const tgWrap = document.querySelector(".calc-tg");
  const tgInput = el("calc-telegram");
  const tgErr = el("calc-tg-err");

  /* Accepts what people actually paste: "@name", "name", "t.me/name" and the
     full https URL all mean the same account. A phone number is let through
     too — the field asks for Telegram, but someone who leaves a number wants
     to be contacted just as much, and refusing it only loses the lead. */
  function readTelegram() {
    let v = tgInput.value.trim().replace(/\s+/g, "");
    v = v.replace(/^(https?:\/\/)?(www\.)?(t\.me|telegram\.me)\//i, "");
    v = v.replace(/^@+/, "");
    if (!v) return { ok: false, why: "empty" };
    if (/^\+?[\d\-()]{9,}$/.test(v)) return { ok: true, value: v };   // a phone
    if (!/^[A-Za-z0-9_]{3,32}$/.test(v)) return { ok: false, why: "shape" };
    return { ok: true, value: "@" + v };
  }

  function showTgError(why) {
    tgErr.innerHTML = why === "empty"
      ? bi("Вкажіть свій Телеграм — без нього ми не зможемо надіслати розрахунок.",
           "Enter your Telegram — without it we cannot send you the estimate.")
      : bi("Схоже на помилку. Введіть як @username або посилання t.me/username.",
           "That does not look right. Enter it as @username or a t.me/username link.");
    tgErr.hidden = false;
    tgWrap.classList.add("is-bad");
  }

  function clearTgError() {
    tgErr.hidden = true;
    tgWrap.classList.remove("is-bad");
  }

  tgInput.addEventListener("input", clearTgError);

  /* the payload the admin panel receives: Ukrainian labels, so an estimate
     reads the same in the panel no matter which language the visitor used */
  function payload() {
    const d = dev(), c = cat();
    return {
      lang,
      telegram: (readTelegram().value || ""),
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
    // the handle is the price of the price: check it before anything is
    // revealed, so a bad entry costs nothing but a corrected keystroke
    const tg = readTelegram();
    if (!tg.ok) {
      showTgError(tg.why);
      tgInput.focus();
      return;
    }
    clearTgError();

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
        bi("/міс за підтримку з другого місяця. Перший — безкоштовно, і рахується окремо від разової суми.",
           "/mo for support from the second month. The first one is free, and it is counted separately from the one-off total.");
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

  /* hand the estimate to the contact form instead of making them retype it.
     The form lives on the home page, so the estimate travels in sessionStorage
     and main.js fills the form in when the link lands on /#contact. */
  el("calc-send").addEventListener("click", () => {
    const p = payload();
    const spec = quote.lines.map((l) => "· " + (lang === "uk" ? l.uk : l.en) + " — " +
      (l.price < 0 ? "−" + money(-l.price) : money(l.price))).join("\n");
    const message = (lang === "uk"
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
    try {
      sessionStorage.setItem("slv_estimate", JSON.stringify({
        contact: p.telegram || "", budget: "$" + quote.total, message,
      }));
    } catch (_) { /* storage blocked — the form simply opens empty */ }
  });

  renderLines();
})();
