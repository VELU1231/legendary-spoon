/**
 * Job Scoring System
 * Score is 0-100 based on: recency, budget, competition, keywords
 */

const HIGH_VALUE_KEYWORDS = [
  'python', 'javascript', 'react', 'node', 'automation', 'scraping', 'data',
  'api', 'machine learning', 'ai', 'urgent', 'asap', 'quick', 'micro', 'small task',
  'freelance', 'contract', 'short term',
];

const MICRO_TASK_KEYWORDS = [
  'scraping', 'automation', 'data entry', 'quick task', 'micro task', 'small job',
  'one-time', 'short-term', 'hourly', 'fixed price', 'simple', 'easy',
];

function scoreJob(job) {
  let score = 50; // base score

  // Recency bonus (0-30 points)
  const ageMinutes = (Date.now() - job.posted_at) / 60000;
  if (ageMinutes < 5) score += 30;
  else if (ageMinutes < 30) score += 25;
  else if (ageMinutes < 60) score += 20;
  else if (ageMinutes < 180) score += 15;
  else if (ageMinutes < 360) score += 10;
  else if (ageMinutes < 1440) score += 5;

  // Budget bonus (0-15 points)
  if (job.budget_max) {
    if (job.budget_max >= 5000) score += 15;
    else if (job.budget_max >= 2000) score += 10;
    else if (job.budget_max >= 500) score += 7;
    else if (job.budget_max >= 100) score += 4;
  }

  // Competition penalty (0-10 points)
  if (job.applicant_count === 0) score += 10; // unknown = potentially low competition
  else if (job.applicant_count < 5) score += 8;
  else if (job.applicant_count < 20) score += 4;
  else if (job.applicant_count > 50) score -= 5;

  // Keyword bonus (0-10 points)
  const text = `${job.title} ${job.description || ''} ${(job.tags || []).join(' ')}`.toLowerCase();
  const hvMatches = HIGH_VALUE_KEYWORDS.filter(k => text.includes(k));
  score += Math.min(hvMatches.length * 2, 10);

  // Micro-task bonus (extra 5 points)
  const microMatches = MICRO_TASK_KEYWORDS.filter(k => text.includes(k));
  if (microMatches.length > 0) score += 5;

  return Math.min(100, Math.max(0, Math.round(score)));
}

function getJobLabel(job) {
  const ageMinutes = (Date.now() - job.posted_at) / 60000;
  const labels = [];

  if (ageMinutes < 60) labels.push('HOT');
  if (job.applicant_count === 0 || job.applicant_count < 5) labels.push('LOW_COMPETITION');
  if (job.score >= 80) labels.push('TOP_PICK');

  const text = `${job.title} ${job.description || ''}`.toLowerCase();
  if (MICRO_TASK_KEYWORDS.some(k => text.includes(k))) labels.push('MICRO_TASK');

  return labels;
}

function enrichJob(job) {
  const score = scoreJob(job);
  const labels = getJobLabel({ ...job, score });
  return { ...job, score, labels };
}

module.exports = { scoreJob, getJobLabel, enrichJob };
