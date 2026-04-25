# JobSniper API — Cloudflare Worker

Fully serverless backend running on **Cloudflare's free tier**:

| Service | Usage | Free quota |
|---------|-------|------------|
| Workers | HTTP API | 100 k req/day |
| D1 | SQLite database | 5 M row reads / 100 k writes per day |
| Cron Triggers | Job scraping every 1 min | Free |

No paid Cloudflare services required.

---

## One-time setup

### 1 — Install dependencies
```bash
cd backend-worker
npm install
```

### 2 — Create the D1 database
```bash
npm run db:create
# → prints: database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

Copy the `database_id` and paste it into `wrangler.toml`:
```toml
[[d1_databases]]
binding       = "DB"
database_name = "jobsniper"
database_id   = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"   # ← paste here
```

### 3 — Apply the schema
```bash
npm run db:migrate:remote   # applies migrations/0001_schema.sql to the D1 database
```

### 4 — Set secrets (optional — for Telegram alerts)
```bash
wrangler secret put TELEGRAM_BOT_TOKEN   # paste the bot token when prompted
wrangler secret put TELEGRAM_CHAT_ID     # paste your chat ID when prompted
```

### 5 — Deploy
```bash
npm run deploy
# → Worker published at https://jobsniper-api.<your-subdomain>.workers.dev
```

### 6 — Point the frontend at the Worker
In `frontend/.env.local` (or Cloudflare Pages environment variables):
```
NEXT_PUBLIC_API_URL=https://jobsniper-api.<your-subdomain>.workers.dev
```

---

## Local development
```bash
npm run db:migrate:local   # creates a local SQLite file in .wrangler/
npm run dev                # starts the Worker locally at http://localhost:8787
```

---

## Environment variables reference

| Variable | Where to set | Default | Notes |
|----------|-------------|---------|-------|
| `FRONTEND_URL` | `wrangler.toml [vars]` | `https://jobsniper-frontend.pages.dev` | CORS origin |
| `TELEGRAM_BOT_TOKEN` | `wrangler secret put` | — | Optional |
| `TELEGRAM_CHAT_ID` | `wrangler secret put` | — | Optional |
| `TELEGRAM_MIN_WIN_SCORE` | `wrangler.toml [vars]` | `70` | Min win % for alerts |
