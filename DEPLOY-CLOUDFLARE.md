# Переїзд на Cloudflare (безкоштовно)

Railway закінчились кредити й сайт впав. Ця інструкція переносить бекенд на
безкоштовний тариф Cloudflare — там сайт не засинає і не потребує оплати при
такому трафіку.

**Що на що замінюється**

| Було (Railway)             | Стало (Cloudflare)                    |
| -------------------------- | ------------------------------------- |
| Express-сервер             | Worker (`worker/index.js`)            |
| SQLite на диску `/data`    | D1 (та сама схема)                    |
| Завантажені картинки       | R2 (сховище файлів)                   |
| Логін з паролем            | Cloudflare Access (код на пошту)      |
| `css/ js/ img/`            | Cloudflare Assets (роздає edge)       |

Ліміти безкоштовного тарифу: 100 000 запитів/добу, база 5 ГБ, сховище 10 ГБ.
Для портфоліо це з великим запасом.

---

## Крок 0 — спершу врятувати заявки ⚠️

**Зробіть це до всього іншого.** База з заявками клієнтів лежить на диску
Railway і зникне разом із проєктом.

1. Відновіть сервіс на Railway (додати спосіб оплати → **Redeploy**)
2. Скажіть мені, коли сайт знову відкриється — я вивантажу всі дані у
   `worker/import.sql` і покладу резервну копію в репозиторій
3. Railway можна вимикати аж після того, як Cloudflare запрацює

---

## Крок 1 — вхід у Cloudflare з термінала

```bash
npm install
npx wrangler login
```

Відкриється браузер — підтвердіть доступ.

## Крок 2 — створити базу і сховище

```bash
npx wrangler d1 create slv-visual
npx wrangler r2 bucket create slv-visual-uploads
```

Перша команда виведе `database_id`. **Скопіюйте його** у `wrangler.toml`
замість `PLACEHOLDER_SET_BY_WRANGLER`.

Далі створити таблиці:

```bash
npm run cf:schema
```

## Крок 3 — захистити адмінку через Cloudflare Access

У панелі Cloudflare: **Zero Trust → Access → Applications → Add an application
→ Self-hosted**

- **Application name:** `slv_visual admin`
- **Session duration:** 24 hours
- **Domain:** `www.slv-visual.online`, **Path:** `admin`
- Додайте ще один шлях тим же способом: **Path:** `api`
- **Policy:** назва `owner`, Action **Allow**, правило
  **Emails** → ваша пошта
- Метод входу: **One-time PIN** (код на пошту, нічого налаштовувати не треба)

Після створення відкрийте застосунок → **Overview** і скопіюйте
**Application Audience (AUD) Tag**. Внесіть у `wrangler.toml`:

```toml
[vars]
ACCESS_TEAM_DOMAIN = "ВАША-КОМАНДА.cloudflareaccess.com"
ACCESS_AUD = "довгий-рядок-aud-tag"
```

`ACCESS_TEAM_DOMAIN` видно у **Zero Trust → Settings → Custom Pages** або в
адресному рядку, коли ви в Zero Trust.

## Крок 4 — залити дані та розгорнути

```bash
npm run cf:import     # тільки якщо є врятована копія з Railway
npm run cf:deploy
```

## Крок 5 — перемкнути домен

У `wrangler.toml` додайте маршрут (або зробіть це в панелі:
**Workers & Pages → slv-visual → Settings → Domains & Routes → Add custom
domain**):

```toml
[[routes]]
pattern = "www.slv-visual.online/*"
zone_name = "slv-visual.online"
```

Далі `npm run cf:deploy` ще раз.

⚠️ Стара DNS-запис `www` (CNAME на Railway) має бути **видалена** — інакше
Cloudflare не знатиме, кому віддавати трафік.

## Крок 6 — перевірити й вимкнути Railway

```bash
curl -s https://www.slv-visual.online/api/health      # {"ok":true}
curl -s https://www.slv-visual.online/api/projects    # список проєктів
```

Відкрийте `/admin` — має попросити код на пошту. Коли все працює, видаляйте
проєкт на Railway.

---

## Корисне

```bash
npm run cf:tail    # живі логи Worker'а
npm run cf:dev     # локальний запуск
```

**Зверніть увагу:** `server/` лишається в репозиторії як робоча Express-версія
(на випадок відкату). Після успішного переїзду її можна видалити разом із
`Dockerfile` і `railway.json`.
