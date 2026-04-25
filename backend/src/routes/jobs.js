const express = require('express');
const router = express.Router();
const { getJobs, getStats } = require('../db');
const { enrichJob } = require('../scorer');

// Helper: load, re-score (win probability is time-sensitive), and return jobs
function loadEnriched(filters) {
  return getJobs(filters).map(enrichJob);
}

// GET /api/jobs
// Query params: limit, offset, source, category, keyword,
//               minBudget, maxBudget, maxAgeMinutes,
//               sortBy (posted_at | win_probability)
router.get('/jobs', (req, res) => {
  try {
    const {
      limit = '50',
      offset = '0',
      source,
      category,
      keyword,
      minBudget,
      maxBudget,
      maxAgeMinutes,
      sortBy = 'posted_at',
    } = req.query;

    const jobs = loadEnriched({
      limit: Math.min(parseInt(limit) || 50, 200),
      offset: parseInt(offset) || 0,
      source,
      category,
      keyword,
      minBudget:     minBudget     ? parseFloat(minBudget)     : undefined,
      maxBudget:     maxBudget     ? parseFloat(maxBudget)     : undefined,
      maxAgeMinutes: maxAgeMinutes ? parseInt(maxAgeMinutes)   : undefined,
      // win_probability sort is applied in-memory after re-scoring
      sortBy: sortBy === 'win_probability' ? 'posted_at' : sortBy,
    });

    // When the client requests win-probability ordering, sort after live re-score
    const sorted = sortBy === 'win_probability'
      ? [...jobs].sort((a, b) => b.win_probability - a.win_probability)
      : jobs;

    res.json({ jobs: sorted, total: sorted.length });
  } catch (err) {
    console.error('[API] GET /jobs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/jobs/top-picks
// Returns the top 20 jobs ranked by win probability (FAST_WIN candidates)
router.get('/jobs/top-picks', (req, res) => {
  try {
    const { maxAgeMinutes = '120', limit = '20' } = req.query;
    const jobs = loadEnriched({
      limit: 200, // over-fetch so we can properly rank
      offset: 0,
      maxAgeMinutes: parseInt(maxAgeMinutes) || 120,
    });

    const topPicks = jobs
      .sort((a, b) => b.win_probability - a.win_probability)
      .slice(0, Math.min(parseInt(limit) || 20, 50));

    res.json({ jobs: topPicks, total: topPicks.length });
  } catch (err) {
    console.error('[API] GET /jobs/top-picks error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/stats
router.get('/stats', (req, res) => {
  try {
    const stats = getStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/sources
router.get('/sources', (req, res) => {
  const { SCRAPERS } = require('../scrapers');
  res.json({ sources: SCRAPERS.map(s => s.source) });
});

// GET /api/proposals/:jobId
// Returns proposal templates, optionally customised with job title
router.get('/proposals/:jobId', (req, res) => {
  // jobId is accepted for future per-job customisation; templates are generic for now
  const { jobTitle = 'this project' } = req.query;
  const safeTitle = String(jobTitle).slice(0, 120);

  const templates = [
    {
      id: 'fast',
      label: '⚡ Fast & Direct',
      text:
        `Hi,\n\nI saw "${safeTitle}" and I can start right now.\n\n` +
        `I have hands-on experience with exactly this type of work and can deliver ` +
        `clean, tested results quickly.\n\n` +
        `What's the best way to kick things off?\n\nBest,`,
    },
    {
      id: 'technical',
      label: '🛠 Technical Focus',
      text:
        `Hello,\n\nYour posting for "${safeTitle}" caught my attention immediately.\n\n` +
        `I specialise in this area and have completed multiple similar projects. ` +
        `I'll deliver:\n• High-quality, well-tested output\n• Clear progress updates\n• Fast turnaround\n\n` +
        `Happy to share relevant samples. When can we talk?\n\nBest,`,
    },
    {
      id: 'micro',
      label: '🎯 Micro-Task',
      text:
        `Hi,\n\nI can handle "${safeTitle}" quickly and efficiently — available to start immediately.\n\n` +
        `I'll deliver clean results and keep communication clear throughout.\n\n` +
        `Ready when you are!`,
    },
    {
      id: 'value',
      label: '💎 Value Pitch',
      text:
        `Hello,\n\nI noticed "${safeTitle}" and I believe I'm the right fit.\n\n` +
        `Why choose me?\n• I've done this before — no learning curve\n` +
        `• Fast delivery with quality guaranteed\n• Transparent pricing, no surprises\n\n` +
        `Let's make this happen. Looking forward to your reply!`,
    },
  ];

  res.json({ templates, jobTitle: safeTitle });
});

module.exports = router;
