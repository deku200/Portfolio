# Changelog digest

> Written by `devbrain scan`. Newest digest first.

## 2026-08-07 — baseline (22 most recent commits)

22 commits between 2026-07-13 and 2026-08-01 by slv_visual (22).

Most touched: `js` ×17, `index.html` ×16, `server` ×16, `css` ×15, `img` ×11, `terms.html` ×4, `admin.html` ×3, `privacy.html` ×3.

### Features (6)
- Update promo: dates 20.07–27.07 + FREE first month of support bonus `277106b`
- Add limited-time hero promo ($250 landing) + lower form minimum to $250 `469b64a`
- Add branded favicon (<SV> mark) + icons for tabs, iOS, PWA `541933e`
- Add Telegram channel button to the hero `37168c8`
- Add branded OG/Twitter share card + social meta tags `f9e7ddd`
- Add Node/Express/SQLite backend + deploy config `dfe535a`

### Fixes (2)
- Restyle promo as slanted badge + fix stale-CSS cache for good `0e162b0`
- hide SEO h1 with inline style (cached CSS showed it full-size) `af1089d`

### Performance (1)
- Optimize hero for mobile: cap canvas DPR, throttle, pause off-screen `1157cb3`

### Other changes (13)
- Remove the limited-time promo offer `4e3e7cf`
- Hero CTA highlight: green instead of red `8afffd0`
- Rewrite hero line as conversion copy with a bold CTA `08a232b`
- dates 25.07–31.07 + conversion-focused contact heading `d88813b`
- Update pricing: projects from $400 (was $1,000) `967664f`
- Harden security + full SEO/GEO + trust pages `64707bf`
- decode upload images via createImageBitmap (CSP blocked blob:) `5cfe4e9`
- robust image optimizer + descriptive upload/save errors `4a7c68d`
- Point Telegram button at telegram.me (t.me DNS outage) `577ec94`
- Hide cursor-following hint chips on tablet/mobile/touch `7d845ea`
- Relabel header CTA: CONTACT -> Submit a request / Залишити заявку `fc16bbe`
- Set slv_visual title/meta, remove footer socials, sync UK labels `c28e78b`
- … and 1 more
