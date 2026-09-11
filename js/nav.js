/* The burger. Below 768px every page header folds its menu behind this
   button. Shared by every page (the home page, the content pages and
   /projects), which is why it is a file of its own and not part of main.js,
   legal.js or works.js. The header carries .menu-host; this toggles
   .is-menu-open on it and the stylesheet does the rest. */
(() => {
  const btn = document.querySelector(".menu-host .burger");
  if (!btn) return;
  const header = btn.closest(".menu-host");
  const nav = header.querySelector(".header-nav");
  if (!nav) return;

  const isOpen = () => header.classList.contains("is-menu-open");
  const set = (open) => {
    header.classList.toggle("is-menu-open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  };

  btn.addEventListener("click", () => set(!isOpen()));
  // picking a page, tapping anywhere else or pressing Escape closes it
  nav.addEventListener("click", (e) => { if (e.target.closest("a")) set(false); });
  document.addEventListener("click", (e) => {
    if (isOpen() && !header.contains(e.target)) set(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen()) { set(false); btn.focus(); }
  });
  // the home page slides its header away on scroll; the menu goes with it
  new MutationObserver(() => { if (header.classList.contains("is-hidden")) set(false); })
    .observe(header, { attributes: true, attributeFilter: ["class"] });
  // on a wide screen the menu is inline again, with nothing to close
  const mq = matchMedia("(max-width: 768px)");
  const reset = () => { if (!mq.matches) set(false); };
  if (mq.addEventListener) mq.addEventListener("change", reset);
  else mq.addListener(reset);
})();
