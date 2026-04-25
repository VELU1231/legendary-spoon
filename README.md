# 🎯 JobSniper — Real-time Freelance Job Radar

Find and apply to newly posted freelance and micro-task jobs **within seconds of posting**. Beat the competition with AI-ranked win probability, instant alerts, and a built-in application tracker.

---

## ✨ Features

### 🔍 Real-time Job Discovery
- **7 free job sources** — no paid API keys required
- **30-second fetch interval** with WebSocket push (live updates in your browser)
- Deduplication — never see the same job twice
- Sources: Remotive, RemoteOK, We Work Remotely, Arbeitnow, Hacker News, Jobicy, Reddit

### 🏆 Auto Win-Probability Ranking
Every job is scored 0–100 across three dimensions:

| Dimension | Weight | Signal |
|-----------|--------|--------|
| **Competition** | 40% | Applicant count + time since posting |
| **Urgency** | 35% | Keywords (urgent/ASAP/need now) + recency + budget |
| **Simplicity** | 25% | Micro-task language + short description + clear deliverable |

Labels applied automatically:
- 🔥 **HOT** — posted < 2 minutes ago
- ⚡ **FRESH** — posted < 10 minutes ago
- 🏆 **FAST_WIN** — win probability ≥ 80%
- 🎯 **LOW_COMPETITION** — < 5 applicants
- ⚙️ **MICRO_TASK** — simple, well-scoped task

### 📤 Application Tracker
- Mark any job as **Applied / Interviewing / Offer / Accepted / Rejected / Withdrawn**
- Record date & time of application
- Add notes and status updates
- View your full pipeline with a color-coded progress bar
- Filter, search, and sort tracked applications

### 📋 Fast Apply System
- Direct apply link on every card
- 4 proposal templates (Fast, Technical, Micro-task, Value Pitch)
- Editable in-place before copying
- One-click job open

### 🚨 Instant Alerts
- Browser desktop notifications
- Sound alerts via Web Audio API (soft ping / urgent two-tone)
- Telegram bot alerts for FAST_WIN jobs

---

## 🚀 Quick Start

```bash
git clone https://github.com/VELU1231/legendary-spoon.git
cd legendary-spoon

# Backend
cd backend && npm install
node src/index.js          # → http://localhost:3001

# Frontend (new terminal)
cd ../frontend && npm install
npm run dev                # → http://localhost:3000
```

Open **http://localhost:3000** — jobs appear within 30 seconds.

---

## ⚙️ Configuration (`backend/.env`)

```env
PORT=3001
FRONTEND_URL=http://localhost:3000
FETCH_INTERVAL_MS=30000          # fetch every 30 seconds
DB_PATH=./jobs.db

# Telegram alerts (optional)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
TELEGRAM_MIN_WIN_SCORE=70
```

### 🤖 Telegram Bot Setup

1. Open Telegram → search **@BotFather** → `/newbot` → copy the token
2. Chat with your bot, visit `https://api.telegram.org/bot<TOKEN>/getUpdates` → copy your `chat_id`
3. Set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in `.env`

---

## 📡 API Reference

### Jobs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/jobs` | List jobs (keyword, source, maxAgeMinutes, sortBy, ...) |
| GET | `/api/jobs/top-picks` | Top 20 by win probability |
| GET | `/api/stats` | Counts per source |
| GET | `/api/proposals/:jobId` | 4 proposal templates |

**sortBy values:** `posted_at` (default) · `win_probability`

### Application Tracking
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/applications` | Mark job as applied |
| GET | `/api/applications` | List all tracked applications |
| GET | `/api/applications/stats` | Pipeline counts by status |
| PATCH | `/api/applications/:jobId` | Update status / notes / date |
| DELETE | `/api/applications/:jobId` | Remove from tracking |

**POST body:**
```json
{
  "job": { "id": "...", "title": "...", "url": "..." },
  "status": "applied",
  "applied_at": "2026-04-25T10:00:00Z",
  "notes": "Sent fast proposal template"
}
```

**Valid statuses:** `applied` → `interviewing` → `offer` → `accepted` | `rejected` | `withdrawn`

---

## 🌐 Job Sources (all free)

| Source | Type | Focus |
|--------|------|-------|
| Remotive | JSON API | Remote dev / data / devops |
| RemoteOK | JSON API | Remote all categories |
| We Work Remotely | RSS | Remote tech / design |
| Arbeitnow | JSON API | Europe / remote |
| Hacker News | Algolia API | Who's Hiring threads |
| Jobicy | RSS | Remote dev / design |
| Reddit | JSON API | r/forhire · r/slavelabour · r/freelance_forhire |

---

## 🏗️ Architecture

```
backend/src/
  index.js          ← Express + WebSocket + scheduler
  db.js             ← SQLite: jobs table + applications table
  scorer.js         ← Win probability engine
  scheduler.js      ← Fetch loop + WS broadcast + Telegram
  telegram.js       ← Telegram bot integration
  scrapers/         ← One file per source
  routes/
    jobs.js         ← /api/jobs, /api/jobs/top-picks, /api/proposals
    applications.js ← /api/applications CRUD

frontend/src/
  app/page.js       ← Dashboard (All Jobs / Fast Win / My Applications tabs)
  components/
    JobCard.jsx           ← Win meter + apply status badge + Track button
    WinScoreMeter.jsx     ← 3-bar breakdown visualization
    FilterBar.jsx         ← Keyword / source / age / sort filters
    StatsBar.jsx          ← Live connection status + counts
    ProposalModal.jsx     ← 4 editable proposal templates
    ApplicationModal.jsx  ← Mark applied + status + notes form
    ApplicationTracker.jsx← Full pipeline: search, filter, sort, edit, delete
    NotificationToast.jsx ← In-app toast notifications
  hooks/
    useWebSocket.js       ← Auto-reconnect WS
    useJobs.js            ← Deduplicated job list state
    useNotifications.js   ← Browser notify + Web Audio
    useApplications.js    ← Application CRUD state
  lib/api.js              ← All API fetch wrappers
```

**Stack:** Node.js + Express + ws + better-sqlite3 · Next.js 16 + React + Tailwind CSS · SQLite

---

## 🚢 Free Deployment

### Render.com
1. **Backend** → Web Service, root `backend/`, start `node src/index.js`
2. **Frontend** → Static Site, root `frontend/`, build `npm run build`, publish `.next`
3. Set `FRONTEND_URL` in backend env vars

### Railway
```bash
cd backend  && railway up
cd ../frontend && railway up
```

### Docker Compose
```yaml
services:
  backend:
    build: ./backend
    ports: ["3001:3001"]
    environment:
      FRONTEND_URL: http://frontend:3000
  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    environment:
      NEXT_PUBLIC_API_URL: http://backend:3001
      NEXT_PUBLIC_WS_URL: ws://backend:3001/ws
```
