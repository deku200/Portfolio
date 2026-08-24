/* Plerdy — heatmaps and click tracking.
   https://plerdy.com

   Plerdy hands you this as an inline <script> to paste before </body>. It
   cannot go in the markup that way: the site's CSP is script-src 'self', with
   no 'unsafe-inline', so an inline block is dropped before it runs — the same
   way Cloudflare's own beacon was. The snippet is therefore kept verbatim in
   this file and loaded as a same-origin script, which the policy allows.

   The host it pulls main.js from is opened up in the CSP in worker/index.js.
   If tracking ever stops working, check the browser console for a CSP refusal
   first: Plerdy may have started calling a domain that is not on that list. */
(function (w, d) {
  if (w.__plerdyCode) return;
  w.__plerdyCode = 1;
  w._protocol = w.location.protocol == "https:" ? "https://" : "http://";
  w._site_hash_code = "4dd1fc99a4784be020a10cc66d5d5626";
  w._suid = 78746;
  var s = d.createElement("script");
  s.async = true;
  s.referrerPolicy = "strict-origin-when-cross-origin";
  s.src = "https://a.plerdy.com/public/js/click/main.js?v=" + Math.random();
  d.head.appendChild(s);
})(window, document);
