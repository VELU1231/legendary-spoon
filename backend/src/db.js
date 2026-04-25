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

function getJobs({ limit = 50, offset = 0, source, category, keyword, minBudget, maxBudget, maxAgeMinutes, sortBy = 'posted_at' } = {}) {
  const db = getDb();

  // Validate sortBy to prevent SQL injection — only allow known columns
  const ALLOWED_SORT = new Set(['posted_at', 'win_probability', 'score', 'fetched_at']);
  const orderCol = ALLOWED_SORT.has(sortBy) ? sortBy : 'posted_at';

  let query = 'SELECT * FROM jobs WHERE 1=1';
  const params = [];

  if (source) { query += ' AND source = ?'; params.push(source); }
  if (category) { query += ' AND category LIKE ?'; params.push(`%${category}%`); }
  if (keyword) { query += ' AND (title LIKE ? OR description LIKE ? OR tags LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`); }
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

module.exports = { getDb, upsertJob, getJobs, getStats, isNew, markSeen };
