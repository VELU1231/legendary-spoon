/**
 * Database layer — Cloudflare D1 (async SQLite)
 *
 * All functions accept `d1` (the D1 binding from env) as their first argument.
 * D1 API reference: https://developers.cloudflare.com/d1/worker-api/
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deserializeJob(row) {
  if (!row) return null;
  return {
    ...row,
    tags:          (() => { try { return JSON.parse(row.tags || '[]');         } catch { return []; } })(),
    win_breakdown: (() => { try { return JSON.parse(row.win_breakdown || '{}'); } catch { return {}; } })(),
    is_remote:     !!row.is_remote,
  };
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────

/**
 * Insert a job. Returns true if it was inserted (new), false if it already existed.
 * Uses INSERT OR IGNORE so it is a single round-trip to D1.
 */
export async function upsertJob(d1, job) {
  const result = await d1.prepare(`
    INSERT OR IGNORE INTO jobs
      (id, title, company, description, url, source, category, tags,
       budget_min, budget_max, budget_currency, posted_at, fetched_at,
       applicant_count, score, win_probability, win_breakdown, is_remote, location)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    job.id,
    job.title,
    job.company         || null,
    job.description     || null,
    job.url,
    job.source,
    job.category        || null,
    JSON.stringify(job.tags || []),
    job.budget_min      || null,
    job.budget_max      || null,
    job.budget_currency || 'USD',
    job.posted_at,
    job.fetched_at,
    job.applicant_count || 0,
    job.score           || 0,
    job.win_probability || 0,
    JSON.stringify(job.win_breakdown || {}),
    job.is_remote !== false ? 1 : 0,
    job.location        || null,
  ).run();

  return result.meta.changes > 0;
}

/**
 * Query jobs with optional filters. Validated sortBy prevents SQL injection.
 */
export async function getJobs(d1, {
  limit = 50, offset = 0,
  source, excludeSource,
  category, keyword, excludeKeyword,
  minBudget, maxBudget, maxAgeMinutes,
  sortBy = 'posted_at',
} = {}) {
  const ALLOWED_SORT = new Set(['posted_at', 'win_probability', 'score', 'fetched_at']);
  const orderCol = ALLOWED_SORT.has(sortBy) ? sortBy : 'posted_at';

  let query = 'SELECT * FROM jobs WHERE 1=1';
  const params = [];

  if (source)         { query += ' AND source = ?';        params.push(source); }
  if (excludeSource)  { query += ' AND source != ?';       params.push(excludeSource); }
  if (category)       { query += ' AND category LIKE ?';   params.push(`%${category}%`); }
  if (keyword)        {
    query += ' AND (title LIKE ? OR description LIKE ? OR tags LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
  }
  if (excludeKeyword) {
    query += ' AND title NOT LIKE ? AND (description NOT LIKE ? OR description IS NULL) AND (tags NOT LIKE ? OR tags IS NULL)';
    params.push(`%${excludeKeyword}%`, `%${excludeKeyword}%`, `%${excludeKeyword}%`);
  }
  if (minBudget)      { query += ' AND budget_max >= ?';           params.push(minBudget); }
  if (maxBudget)      { query += ' AND (budget_min <= ? OR budget_min IS NULL)'; params.push(maxBudget); }
  if (maxAgeMinutes)  {
    const cutoff = Date.now() - maxAgeMinutes * 60 * 1000;
    query += ' AND posted_at >= ?';
    params.push(cutoff);
  }

  query += ` ORDER BY ${orderCol} DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const { results } = await d1.prepare(query).bind(...params).all();
  return results.map(deserializeJob);
}

export async function getStats(d1) {
  const now = Date.now();
  const [totalRes, last24hRes, lastHourRes, sourcesRes] = await d1.batch([
    d1.prepare('SELECT COUNT(*) AS count FROM jobs'),
    d1.prepare('SELECT COUNT(*) AS count FROM jobs WHERE posted_at >= ?').bind(now - 86400000),
    d1.prepare('SELECT COUNT(*) AS count FROM jobs WHERE posted_at >= ?').bind(now - 3600000),
    d1.prepare('SELECT source, COUNT(*) AS count FROM jobs GROUP BY source'),
  ]);
  return {
    total:    totalRes.results[0]?.count    ?? 0,
    last24h:  last24hRes.results[0]?.count  ?? 0,
    lastHour: lastHourRes.results[0]?.count ?? 0,
    sources:  sourcesRes.results,
  };
}

// ─── Application tracking ─────────────────────────────────────────────────────

export const VALID_STATUSES = new Set([
  'applied', 'interviewing', 'offer', 'accepted', 'rejected', 'withdrawn',
]);

/**
 * Create or update an application record.
 * On conflict (same job_id), updates status, updated_at, and notes only —
 * preserving the original applied_at and job snapshot fields.
 */
export async function upsertApplication(d1, { job, status = 'applied', applied_at, notes = '' }) {
  if (!VALID_STATUSES.has(status)) throw new Error(`Invalid status: ${status}`);

  const now       = Date.now();
  const appliedTs = applied_at ? new Date(applied_at).getTime() : now;
  const budget    = job.budget_max
    ? `${job.budget_currency || 'USD'} ${Number(job.budget_max).toLocaleString()}`
    : null;

  await d1.prepare(`
    INSERT INTO applications
      (job_id, status, applied_at, updated_at, notes,
       job_title, job_company, job_url, job_source, job_budget, win_probability)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(job_id) DO UPDATE SET
      status     = excluded.status,
      updated_at = excluded.updated_at,
      notes      = excluded.notes
  `).bind(
    job.id,
    status,
    appliedTs,
    now,
    String(notes).slice(0, 2000),
    job.title           || null,
    job.company         || null,
    job.url             || null,
    job.source          || null,
    budget,
    job.win_probability || 0,
  ).run();

  return getApplication(d1, job.id);
}

/** Update status and/or notes for an existing application. */
export async function updateApplication(d1, jobId, { status, notes, applied_at }) {
  const existing = await d1.prepare('SELECT * FROM applications WHERE job_id = ?').bind(jobId).first();
  if (!existing) return null;

  const now          = Date.now();
  const newStatus    = status    && VALID_STATUSES.has(status) ? status    : existing.status;
  const newNotes     = notes    !== undefined ? String(notes).slice(0, 2000) : existing.notes;
  const newAppliedAt = applied_at ? new Date(applied_at).getTime()           : existing.applied_at;

  await d1.prepare(`
    UPDATE applications
    SET status = ?, notes = ?, applied_at = ?, updated_at = ?
    WHERE job_id = ?
  `).bind(newStatus, newNotes, newAppliedAt, now, jobId).run();

  return getApplication(d1, jobId);
}

/** Return a single application by job_id, or null. */
export async function getApplication(d1, jobId) {
  return d1.prepare('SELECT * FROM applications WHERE job_id = ?').bind(jobId).first();
}

/** Return all applications, optionally filtered by status, with sort + pagination. */
export async function getApplications(d1, { status, sortBy = 'applied_at', limit = 200, offset = 0 } = {}) {
  const ALLOWED = new Set(['applied_at', 'updated_at', 'status', 'win_probability']);
  const orderCol = ALLOWED.has(sortBy) ? sortBy : 'applied_at';

  let query = 'SELECT * FROM applications WHERE 1=1';
  const params = [];
  if (status && VALID_STATUSES.has(status)) {
    query += ' AND status = ?';
    params.push(status);
  }
  query += ` ORDER BY ${orderCol} DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const { results } = await d1.prepare(query).bind(...params).all();
  return results;
}

/** Delete an application. Returns true if a row was deleted. */
export async function deleteApplication(d1, jobId) {
  const result = await d1.prepare('DELETE FROM applications WHERE job_id = ?').bind(jobId).run();
  return result.meta.changes > 0;
}

/** Aggregate counts per status. */
export async function getApplicationStats(d1) {
  const [byStatusRes, totalRes] = await d1.batch([
    d1.prepare('SELECT status, COUNT(*) AS count FROM applications GROUP BY status'),
    d1.prepare('SELECT COUNT(*) AS count FROM applications'),
  ]);
  const byStatus = Object.fromEntries(byStatusRes.results.map(r => [r.status, r.count]));
  return {
    total:         totalRes.results[0]?.count ?? 0,
    byStatus,
    validStatuses: [...VALID_STATUSES],
  };
}
