# Deploying slv_visual to Railway

The app (static site + API) runs as **one** Node service. It stores the SQLite
DB and uploaded images under `DATA_DIR`, which must be a **persistent volume**
so data survives redeploys. Node is pinned to 24 (via the Dockerfile).

## 1. Create a Railway account
Sign up at https://railway.app (GitHub or email login).

## 2. Deploy the code — pick ONE method

### Option A — Railway CLI (no GitHub needed)
```bash
npm i -g @railway/cli
railway login                 # opens the browser to authorize
cd /path/to/Portfolio
railway init                  # create a new project when prompted
railway up                    # builds the Dockerfile and deploys
```

### Option B — GitHub
1. Push this folder to a new GitHub repo.
2. In Railway: **New Project → Deploy from GitHub repo** → pick it.
   Railway auto-deploys on every push.

## 3. Add a persistent volume (REQUIRED)
In the service → **Variables/Settings → Volumes → New Volume**:
- **Mount path:** `/data`

(Without this, the database and uploads reset on every deploy.)

## 4. Set environment variables
Service → **Variables**:
| Name | Value |
|------|-------|
| `NODE_ENV` | `production` |
| `DATA_DIR` | `/data` |
| `JWT_SECRET` | *(a long random string — see the one I generated for you)* |

`PORT` is provided by Railway automatically — don't set it.

## 5. Create your admin login (one-time, against the live DB)
Run the setup script **on the deployed instance** so it writes to the volume:
```bash
railway run -- node server/setup-admin.js yourname yourpassword
```
(Or use Railway's web shell for the service.) Your password is bcrypt-hashed;
it's never stored or transmitted in plain text.

## 6. Custom domain (your GoDaddy domain)
1. Railway service → **Settings → Networking → Custom Domain** → enter your
   domain (e.g. `slv-visual.com` or `www.slv-visual.com`). Railway shows you a
   **CNAME target** (something like `xxxx.up.railway.app`).
2. In **GoDaddy → DNS**:
   - For a `www` subdomain: add a **CNAME** record — Host `www`, Value = the
     Railway target.
   - For the apex/root (`slv-visual.com`): use GoDaddy's **Forwarding** to
     `www`, or an `A`/`ALIAS` record if available. (Apex CNAMEs aren't allowed;
     easiest is to use `www` as the primary and forward the root to it.)
3. HTTPS is issued automatically once DNS propagates (minutes to a couple hours).

## Notes
- Health check: `GET /api/health` → `{ "ok": true }`.
- Local dev unchanged: `npm run dev` (nodemon) or `npm start`, data under `server/data`.
- The same Dockerfile deploys on Fly.io or any Docker host if you ever move.
