-- D1 schema for JobSniper API
-- Applied via: wrangler d1 migrations apply jobsniper [--local|--remote]

-- ─── Jobs ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jobs (
  id              TEXT    PRIMARY KEY,
  title           TEXT    NOT NULL,
  company         TEXT,
  description     TEXT,
  url             TEXT    NOT NULL,
  source          TEXT    NOT NULL,
  category        TEXT,
  tags            TEXT,
  budget_min      REAL,
  budget_max      REAL,
  budget_currency TEXT    DEFAULT 'USD',
  posted_at       INTEGER NOT NULL,
  fetched_at      INTEGER NOT NULL,
  applicant_count INTEGER DEFAULT 0,
  score           REAL    DEFAULT 0,
  win_probability REAL    DEFAULT 0,
  win_breakdown   TEXT    DEFAULT '{}',
  is_remote       INTEGER DEFAULT 1,
  location        TEXT
);

CREATE INDEX IF NOT EXISTS idx_jobs_posted_at       ON jobs(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_source          ON jobs(source);
CREATE INDEX IF NOT EXISTS idx_jobs_win_probability ON jobs(win_probability DESC);

-- ─── Seen IDs (deduplication across scraper runs) ────────────────────────────
CREATE TABLE IF NOT EXISTS seen_ids (
  id      TEXT    PRIMARY KEY,
  seen_at INTEGER NOT NULL
);

-- ─── Application tracking ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS applications (
  job_id          TEXT    PRIMARY KEY,
  status          TEXT    NOT NULL DEFAULT 'applied',
  applied_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL,
  notes           TEXT    NOT NULL DEFAULT '',
  job_title       TEXT,
  job_company     TEXT,
  job_url         TEXT,
  job_source      TEXT,
  job_budget      TEXT,
  win_probability REAL    DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_applications_applied_at ON applications(applied_at DESC);
CREATE INDEX IF NOT EXISTS idx_applications_status     ON applications(status);
