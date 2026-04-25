const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../jobs.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      company TEXT,
      description TEXT,
      url TEXT NOT NULL,
      source TEXT NOT NULL,
      category TEXT,
      tags TEXT,
      budget_min REAL,
      budget_max REAL,
      budget_currency TEXT DEFAULT 'USD',
      posted_at INTEGER NOT NULL,
      fetched_at INTEGER NOT NULL,
      applicant_count INTEGER DEFAULT 0,
      score REAL DEFAULT 0,
      win_probability REAL DEFAULT 0,
      win_breakdown TEXT DEFAULT '{}',
      is_remote INTEGER DEFAULT 1,
      location TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_posted_at ON jobs(posted_at DESC);
    CREATE INDEX IF NOT EXISTS idx_jobs_source ON jobs(source);
    CREATE INDEX IF NOT EXISTS idx_jobs_category ON jobs(category);
    CREATE INDEX IF NOT EXISTS idx_jobs_win_probability ON jobs(win_probability DESC);

    CREATE TABLE IF NOT EXISTS seen_ids (
      id TEXT PRIMARY KEY,
      seen_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS applications (
      job_id      TEXT PRIMARY KEY,
      status      TEXT NOT NULL DEFAULT 'applied',
      applied_at  INTEGER NOT NULL,
      updated_at  INTEGER NOT NULL,
      notes       TEXT    NOT NULL DEFAULT '',
      job_title   TEXT,
      job_company TEXT,
      job_url     TEXT,
      job_source  TEXT,
      job_budget  TEXT,
      win_probability REAL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_applications_applied_at ON applications(applied_at DESC);
    CREATE INDEX IF NOT EXISTS idx_applications_status     ON applications(status);
  `);

  // Non-destructive migration: add new columns to databases created before this schema version
  const cols = db.prepare("PRAGMA table_info(jobs)").all().map(c => c.name);
  if (!cols.includes('win_probability')) {
    db.exec('ALTER TABLE jobs ADD COLUMN win_probability REAL DEFAULT 0');
    db.exec('CREATE INDEX IF NOT EXISTS idx_jobs_win_probability ON jobs(win_probability DESC)');
  }
  if (!cols.includes('win_breakdown')) {
    db.exec("ALTER TABLE jobs ADD COLUMN win_breakdown TEXT DEFAULT '{}'");
  }
}

function upsertJob(job) {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM jobs WHERE id = ?').get(job.id);
  if (existing) return false;

  db.prepare(`
    INSERT INTO jobs (id, title, company, description, url, source, category, tags,
      budget_min, budget_max, budget_currency, posted_at, fetched_at,
      applicant_count, score, win_probability, win_breakdown, is_remote, location)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    job.id,
    job.title,
    job.company || null,
    job.description || null,
    job.url,
    job.source,
    job.category || null,
    JSON.stringify(job.tags || []),
    job.budget_min || null,
    job.budget_max || null,
    job.budget_currency || 'USD',
    job.posted_at,
    job.fetched_at,
    job.applicant_count || 0,
    job.score || 0,
    job.win_probability || 0,
    JSON.stringify(job.win_breakdown || {}),
    job.is_remote !== false ? 1 : 0,
    job.location || null
  );
  return true;
}

function getJobs({ limit = 50, offset = 0, source, excludeSource, category, keyword, excludeKeyword, minBudget, maxBudget, maxAgeMinutes, sortBy = 'posted_at' } = {}) {
  const db = getDb();

  // Validate sortBy to prevent SQL injection — only allow known columns
  const ALLOWED_SORT = new Set(['posted_at', 'win_probability', 'score', 'fetched_at']);
  const orderCol = ALLOWED_SORT.has(sortBy) ? sortBy : 'posted_at';

  let query = 'SELECT * FROM jobs WHERE 1=1';
  const params = [];

  if (source) { query += ' AND source = ?'; params.push(source); }
  if (excludeSource) { query += ' AND source != ?'; params.push(excludeSource); }
  if (category) { query += ' AND category LIKE ?'; params.push(`%${category}%`); }
  if (keyword) { query += ' AND (title LIKE ? OR description LIKE ? OR tags LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`); }
  if (excludeKeyword) {
    query += ' AND title NOT LIKE ? AND (description NOT LIKE ? OR description IS NULL) AND (tags NOT LIKE ? OR tags IS NULL)';
    params.push(`%${excludeKeyword}%`, `%${excludeKeyword}%`, `%${excludeKeyword}%`);
  }
  if (minBudget) { query += ' AND budget_max >= ?'; params.push(minBudget); }
  if (maxBudget) { query += ' AND (budget_min <= ? OR budget_min IS NULL)'; params.push(maxBudget); }
  if (maxAgeMinutes) {
    const cutoff = Date.now() - maxAgeMinutes * 60 * 1000;
    query += ' AND posted_at >= ?';
    params.push(cutoff);
  }

  query += ` ORDER BY ${orderCol} DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  return db.prepare(query).all(...params).map(deserializeJob);
}

function getStats() {
  const db = getDb();
  const total = db.prepare('SELECT COUNT(*) as count FROM jobs').get().count;
  const last24h = db.prepare('SELECT COUNT(*) as count FROM jobs WHERE posted_at >= ?').get(Date.now() - 86400000).count;
  const lastHour = db.prepare('SELECT COUNT(*) as count FROM jobs WHERE posted_at >= ?').get(Date.now() - 3600000).count;
  const sources = db.prepare('SELECT source, COUNT(*) as count FROM jobs GROUP BY source').all();
  return { total, last24h, lastHour, sources };
}

function deserializeJob(row) {
  if (!row) return null;
  return {
    ...row,
    tags:         (() => { try { return JSON.parse(row.tags || '[]'); }         catch { return []; } })(),
    win_breakdown: (() => { try { return JSON.parse(row.win_breakdown || '{}'); } catch { return {}; } })(),
    is_remote:    !!row.is_remote,
  };
}

function isNew(id) {
  const db = getDb();
  return !db.prepare('SELECT id FROM seen_ids WHERE id = ?').get(id);
}

function markSeen(id) {
  const db = getDb();
  db.prepare('INSERT OR IGNORE INTO seen_ids (id, seen_at) VALUES (?, ?)').run(id, Date.now());
}

// ─── Application tracking ─────────────────────────────────────────────────────

const VALID_STATUSES = new Set([
  'applied', 'interviewing', 'offer', 'accepted', 'rejected', 'withdrawn',
]);

/**
 * Create or replace an application record.
 * `job` is the full job object (used to snapshot key fields).
 */
function upsertApplication({ job, status = 'applied', applied_at, notes = '' }) {
  const db = getDb();
  if (!VALID_STATUSES.has(status)) throw new Error(`Invalid status: ${status}`);

  const now = Date.now();
  const appliedTs = applied_at ? new Date(applied_at).getTime() : now;

  const budget = job.budget_max
    ? `${job.budget_currency || 'USD'} ${Number(job.budget_max).toLocaleString()}`
    : null;

  db.prepare(`
    INSERT INTO applications
      (job_id, status, applied_at, updated_at, notes,
       job_title, job_company, job_url, job_source, job_budget, win_probability)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(job_id) DO UPDATE SET
      status     = excluded.status,
      updated_at = excluded.updated_at,
      notes      = excluded.notes
  `).run(
    job.id,
    status,
    appliedTs,
    now,
    String(notes).slice(0, 2000),
    job.title    || null,
    job.company  || null,
    job.url      || null,
    job.source   || null,
    budget,
    job.win_probability || 0,
  );

  return getApplication(job.id);
}

/** Update status and/or notes for an existing application. */
function updateApplication(jobId, { status, notes, applied_at }) {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM applications WHERE job_id = ?').get(jobId);
  if (!existing) return null;

  const now = Date.now();
  const newStatus    = status     && VALID_STATUSES.has(status) ? status : existing.status;
  const newNotes     = notes     !== undefined ? String(notes).slice(0, 2000) : existing.notes;
  const newAppliedAt = applied_at ? new Date(applied_at).getTime() : existing.applied_at;

  db.prepare(`
    UPDATE applications
    SET status = ?, notes = ?, applied_at = ?, updated_at = ?
    WHERE job_id = ?
  `).run(newStatus, newNotes, newAppliedAt, now, jobId);

  return getApplication(jobId);
}

/** Return a single application by job_id, or null. */
function getApplication(jobId) {
  const db  = getDb();
  const row = db.prepare('SELECT * FROM applications WHERE job_id = ?').get(jobId);
  return row || null;
}

/**
 * Return all applications, optionally filtered by status.
 * Sorted newest-applied-first by default.
 */
function getApplications({ status, sortBy = 'applied_at', limit = 200, offset = 0 } = {}) {
  const db = getDb();
  const ALLOWED_APP_SORT = new Set(['applied_at', 'updated_at', 'status', 'win_probability']);
  const orderCol = ALLOWED_APP_SORT.has(sortBy) ? sortBy : 'applied_at';

  let query  = 'SELECT * FROM applications WHERE 1=1';
  const params = [];
  if (status && VALID_STATUSES.has(status)) {
    query += ' AND status = ?';
    params.push(status);
  }
  query += ` ORDER BY ${orderCol} DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  return db.prepare(query).all(...params);
}

/** Delete an application record by job_id. Returns true if deleted. */
function deleteApplication(jobId) {
  const db = getDb();
  const result = db.prepare('DELETE FROM applications WHERE job_id = ?').run(jobId);
  return result.changes > 0;
}

/** Return aggregate counts per status. */
function getApplicationStats() {
  const db = getDb();
  const rows    = db.prepare('SELECT status, COUNT(*) as count FROM applications GROUP BY status').all();
  const total   = db.prepare('SELECT COUNT(*) as count FROM applications').get().count;
  const byStatus = Object.fromEntries(rows.map(r => [r.status, r.count]));
  return { total, byStatus, validStatuses: [...VALID_STATUSES] };
}

/** Return the set of job_ids that have been applied to (for fast lookup). */
function getAppliedJobIds() {
  const db = getDb();
  return new Set(
    db.prepare('SELECT job_id FROM applications').all().map(r => r.job_id)
  );
}

module.exports = {
  getDb,
  upsertJob, getJobs, getStats,
  isNew, markSeen,
  deserializeJob,
  // Application tracking
  upsertApplication, updateApplication, getApplication,
  getApplications, deleteApplication, getApplicationStats, getAppliedJobIds,
  VALID_STATUSES,
};
