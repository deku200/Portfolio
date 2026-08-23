/* All-projects page: language toggle + the project grid pulled from the API.
   External file because the site's CSP is `script-src 'self'` — inline scripts
   are blocked. Shares the "lang" localStorage key with the rest of the site. */
(function () {
  var VALID = { en: 1, uk: 1 };
  var projects = [];

  var esc = function (s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  };
  // only http(s) links are rendered as anchors — never javascript:/data:
  var safeHref = function (u) { return /^https?:\/\//i.test(String(u || "")) ? String(u) : ""; };

  function currentLang() {
    return document.documentElement.getAttribute("data-lang") === "en" ? "en" : "uk";
  }

  function applyLang(l) {
    if (!VALID[l]) l = "uk";
    document.documentElement.setAttribute("data-lang", l);
    document.documentElement.setAttribute("lang", l);
    var btns = document.querySelectorAll(".works-lang [data-set-lang]");
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle("is-active", btns[i].getAttribute("data-set-lang") === l);
    }
    if (projects.length) renderProjects();
  }

  function cardHtml(p) {
    var lang = currentLang();
    var desc = p.desc ? (p.desc[lang] || p.desc.en || p.desc.uk || "") : "";
    var href = safeHref(p.link);
    var title = "&lt;" + esc(p.title) + "&gt;";
    var titleHtml = href
      ? '<a href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' + title + " ↗</a>"
      : title;
    var tags = String(p.tags || "").split(",").map(function (t) { return t.trim(); })
      .filter(Boolean).map(function (t) { return "<span>" + esc(t) + "</span>"; }).join("");
    var live = /live/i.test(p.status || "") ? " is-live" : "";
    var media = p.image
      ? '<div class="work-card-media"><img src="' + esc(p.image.charAt(0) === "/" || /^https?:/i.test(p.image) ? p.image : "/" + p.image) + '" alt="' + esc(p.title) + ' — slv_visual" loading="lazy" /></div>'
      : '<div class="work-card-media is-empty">[ NO IMAGE ]</div>';

    return '<article class="work-card">' + media +
      '<div class="work-card-body">' +
        '<div class="work-card-head"><span>' + esc(p.caseLabel) + '</span>' +
          '<span class="' + live.trim() + '">' + esc(p.status) + "</span></div>" +
        "<h2>" + titleHtml + "</h2>" +
        (desc ? '<p class="work-card-desc">' + esc(desc) + "</p>" : "") +
        (tags ? '<div class="work-card-tags">' + tags + "</div>" : "") +
      "</div></article>";
  }

  function renderProjects() {
    var grid = document.getElementById("works-grid");
    if (!grid) return;
    if (!projects.length) {
      grid.innerHTML = '<div class="works-loading">// no projects yet</div>';
      return;
    }
    grid.innerHTML = projects.map(cardHtml).join("");
  }

  // --- boot ---
  // the Worker already set data-lang from the URL (/projects vs /en/projects)
  var current = document.documentElement.getAttribute("data-lang") === "en" ? "en" : "uk";
  applyLang(current);

  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-set-lang]");
    if (!b) return;
    var l = b.getAttribute("data-set-lang");
    if (l === current) return;
    try { localStorage.setItem("lang", l); } catch (e2) {}
    // each language is its own URL, so switching means going there
    var p = location.pathname;
    var bare = p.indexOf("/en/") === 0 ? p.slice(3) : (p === "/en" ? "/" : p);
    location.href = (l === "en" ? "/en" + bare : bare) + location.hash;
  });

  fetch("/api/projects")
    .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error("bad response")); })
    .then(function (data) { projects = Array.isArray(data) ? data : []; renderProjects(); })
    .catch(function () {
      var grid = document.getElementById("works-grid");
      if (grid) grid.innerHTML = '<div class="works-loading">// could not load projects — please refresh</div>';
    });
})();
