/**
 * Win Probability Scoring Engine
 *
 * Ranks jobs by "fastest win probability" — the likelihood of landing a job
 * quickly based on three orthogonal dimensions:
 *
 *   Competition Score (40%) — fewer rivals → higher chance
 *   Urgency Score     (35%) — client needs it fast → hires quickly
 *   Simplicity Score  (25%) — clear, small scope → easy to win
 *
 * winProbability = round(competition * 0.40 + urgency * 0.35 + simplicity * 0.25)
 *
 * Each dimension is 0–100.  The final score is also 0–100.
 */

// ─── Keyword banks ────────────────────────────────────────────────────────────

const URGENCY_KEYWORDS = [
  { word: 'urgent',      weight: 22 },
  { word: 'asap',        weight: 22 },
  { word: 'need now',    weight: 20 },
  { word: 'immediately', weight: 18 },
  { word: 'today',       weight: 15 },
  { word: 'right now',   weight: 18 },
  { word: 'rush',        weight: 15 },
  { word: 'deadline',    weight: 10 },
  { word: 'quick turnaround', weight: 12 },
  { word: 'fast',        weight: 8  },
  { word: 'hurry',       weight: 12 },
  { word: 'emergency',   weight: 18 },
];

const SIMPLICITY_KEYWORDS = [
  { word: 'data entry',   weight: 14 },
  { word: 'scraping',     weight: 12 },
  { word: 'web scraping', weight: 14 },
  { word: 'copy paste',   weight: 12 },
  { word: 'simple',       weight: 10 },
  { word: 'easy',         weight: 10 },
  { word: 'quick task',   weight: 14 },
  { word: 'micro task',   weight: 14 },
  { word: 'small job',    weight: 12 },
  { word: 'one-time',     weight: 10 },
  { word: 'short-term',   weight: 8  },
  { word: 'fixed price',  weight: 8  },
  { word: 'fixed budget', weight: 8  },
  { word: 'automation',   weight: 10 },
  { word: 'spreadsheet',  weight: 8  },
  { word: 'csv',          weight: 8  },
  { word: 'excel',        weight: 8  },
  { word: 'pdf',          weight: 6  },
  { word: 'beginner',     weight: 10 },
  { word: 'no experience', weight: 8 },
];

const DELIVERABLE_KEYWORDS = [
  'csv', 'spreadsheet', 'report', 'list', 'database', 'script', 'file',
  'document', 'form', 'template', 'json', 'xml', 'api',
];

// Sources where human competition tends to be lower
const LOW_COMPETITION_SOURCES = new Set(['hackernews', 'jobicy', 'arbeitnow']);

// ─── Dimension: Competition (0–100) ──────────────────────────────────────────

/**
 * Measures how few people have likely already applied.
 * Lower applicant count + fresher post = higher score.
 */
function competitionScore(job) {
  let score = 0;

  // Applicant-count component (0–55 pts)
  const n = job.applicant_count ?? 0;
  if (n === 0)       score += 55; // unknown → optimistically low competition
  else if (n <= 2)   score += 50;
  else if (n <= 5)   score += 42;
  else if (n <= 10)  score += 32;
  else if (n <= 20)  score += 20;
  else if (n <= 50)  score += 10;
  else               score += 2;

  // Recency component (0–30 pts) — older = more people have seen it
  const ageMin = (Date.now() - job.posted_at) / 60000;
  if      (ageMin < 2)    score += 30;
  else if (ageMin < 5)    score += 26;
  else if (ageMin < 10)   score += 22;
  else if (ageMin < 30)   score += 16;
  else if (ageMin < 60)   score += 10;
  else if (ageMin < 180)  score += 5;
  else if (ageMin < 720)  score += 2;

  // Source-based bonus (0–15 pts)
  if (LOW_COMPETITION_SOURCES.has(job.source)) score += 15;
  else score += 5;

  return clamp(score);
}

// ─── Dimension: Urgency (0–100) ──────────────────────────────────────────────

/**
 * Measures how quickly the client wants to hire.
 * Urgent keywords + recency + premium budget = faster hiring decision.
 */
function urgencyScore(job) {
  const text = textOf(job);
  let score = 20; // base — all jobs have some urgency

  // Keyword signals (capped at 50 pts)
  let kwPts = 0;
  for (const { word, weight } of URGENCY_KEYWORDS) {
    if (text.includes(word)) kwPts += weight;
  }
  score += Math.min(kwPts, 50);

  // Recency component (0–25 pts) — freshly posted = client still deciding
  const ageMin = (Date.now() - job.posted_at) / 60000;
  if      (ageMin < 2)    score += 25;
  else if (ageMin < 5)    score += 20;
  else if (ageMin < 10)   score += 15;
  else if (ageMin < 30)   score += 10;
  else if (ageMin < 60)   score += 5;

  // Budget-above-norm signal (0–5 pts) — higher budgets often indicate urgency
  if (job.budget_max && job.budget_max >= 1000) score += 5;

  return clamp(score);
}

// ─── Dimension: Simplicity (0–100) ───────────────────────────────────────────

/**
 * Measures how easy it is to understand and complete the task.
 * Narrow scope, clear deliverable, and micro-task language = high simplicity.
 */
function simplicityScore(job) {
  const text = textOf(job);
  let score = 20; // base

  // Simplicity keyword signals (capped at 45 pts)
  let kwPts = 0;
  for (const { word, weight } of SIMPLICITY_KEYWORDS) {
    if (text.includes(word)) kwPts += weight;
  }
  score += Math.min(kwPts, 45);

  // Short description = clear brief (0–15 pts)
  const descLen = (job.description || '').length;
  if      (descLen === 0)    score += 5;  // no description, might be unclear
  else if (descLen < 150)    score += 15;
  else if (descLen < 350)    score += 10;
  else if (descLen < 600)    score += 5;

  // Defined deliverable (0–10 pts)
  if (DELIVERABLE_KEYWORDS.some(w => text.includes(w))) score += 10;

  // Tags signal (0–10 pts) — tagged micro/automation = well-scoped
  const tags = (job.tags || []).join(' ').toLowerCase();
  if (/micro|automation|scraping|entry|simple|small/.test(tags)) score += 10;

  return clamp(score);
}

// ─── Composite win probability ────────────────────────────────────────────────

/**
 * Returns a score 0–100 and a per-dimension breakdown object.
 */
function winProbability(job) {
  const competition = competitionScore(job);
  const urgency     = urgencyScore(job);
  const simplicity  = simplicityScore(job);
  const score = clamp(Math.round(competition * 0.40 + urgency * 0.35 + simplicity * 0.25));
  return {
    score,
    breakdown: { competition, urgency, simplicity },
  };
}

// ─── Labels ───────────────────────────────────────────────────────────────────

/**
 * Returns an array of string labels for a job.
 * Evaluated live (timestamps are relative to now).
 */
function getJobLabels(job) {
  const ageMin = (Date.now() - job.posted_at) / 60000;
  const text   = textOf(job);
  const labels = [];

  // Time-based freshness
  if      (ageMin < 2)   labels.push('HOT');
  else if (ageMin < 10)  labels.push('FRESH');

  // Competition signal
  const applicants = job.applicant_count ?? 0;
  if (applicants === 0 || applicants < 5) labels.push('LOW_COMPETITION');

  // Win probability tier
  const wp = job.win_probability ?? job.winProbability ?? 0;
  if (wp >= 80) labels.push('FAST_WIN');
  else if (wp >= 65) labels.push('GOOD_CHANCE');

  // Task type
  const simplWords = SIMPLICITY_KEYWORDS.map(k => k.word);
  if (simplWords.some(w => text.includes(w))) labels.push('MICRO_TASK');

  return labels;
}

// ─── Main enrichment entry point ──────────────────────────────────────────────

/**
 * Enriches a raw job object with:
 *   - win_probability   (0–100 composite)
 *   - win_breakdown     { competition, urgency, simplicity }
 *   - score             (legacy field, same as win_probability)
 *   - labels            string[]
 */
function enrichJob(job) {
  const { score: wp, breakdown } = winProbability(job);
  const labels = getJobLabels({ ...job, win_probability: wp });
  return {
    ...job,
    win_probability: wp,
    win_breakdown:   breakdown,
    score:           wp,   // backward-compat alias
    labels,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(n) { return Math.min(100, Math.max(0, Math.round(n))); }

function textOf(job) {
  return `${job.title} ${job.description || ''} ${(job.tags || []).join(' ')}`.toLowerCase();
}

export {
  enrichJob,
  winProbability,
  competitionScore,
  urgencyScore,
  simplicityScore,
  getJobLabels,
};
