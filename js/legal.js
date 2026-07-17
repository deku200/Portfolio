/* Bilingual toggle for the legal/info pages (privacy.html, terms.html).
   External file because the site's CSP is `script-src 'self'` — inline scripts
   are blocked. Shares the "lang" localStorage key with the main site so the
   visitor's language choice carries over in both directions. */
(function () {
  var VALID = { en: 1, uk: 1 };

  function apply(l) {
    if (!VALID[l]) l = "en";
    document.documentElement.setAttribute("data-lang", l);
    document.documentElement.setAttribute("lang", l);
    var btns = document.querySelectorAll(".legal-lang [data-set-lang]");
    for (var i = 0; i < btns.length; i++) {
      btns[i].classList.toggle("is-active", btns[i].getAttribute("data-set-lang") === l);
    }
  }

  var saved;
  try { saved = localStorage.getItem("lang"); } catch (e) {}
  apply(saved || "en");

  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-set-lang]");
    if (!b) return;
    var l = b.getAttribute("data-set-lang");
    try { localStorage.setItem("lang", l); } catch (e2) {}
    apply(l);
  });
})();
