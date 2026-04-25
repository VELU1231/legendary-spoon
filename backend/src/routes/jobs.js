const express = require('express');
const router = express.Router();
const { getJobs, getStats } = require('../db');
const { enrichJob } = require('../scorer');

// GET /api/jobs
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
    } = req.query;

    const jobs = getJobs({
      limit: Math.min(parseInt(limit) || 50, 200),
      offset: parseInt(offset) || 0,
      source,
      category,
      keyword,
      minBudget: minBudget ? parseFloat(minBudget) : undefined,
      maxBudget: maxBudget ? parseFloat(maxBudget) : undefined,
      maxAgeMinutes: maxAgeMinutes ? parseInt(maxAgeMinutes) : undefined,
    });

    // Re-score jobs with live timestamps (scores change as jobs age)
    const enriched = jobs.map(j => {
      const scored = enrichJob(j);
      return scored;
    });

    res.json({ jobs: enriched, total: enriched.length });
  } catch (err) {
    console.error('[API] GET /jobs error:', err);
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

// GET /api/proposals/:jobId - Generate quick proposal template
router.get('/proposals/:jobId', (req, res) => {
  const { jobId } = req.params;
  const jobs = getJobs({ limit: 1 });
  // Return generic templates since we can't look up by ID easily in this route
  const templates = [
    {
      id: 'short',
      label: 'Short & Direct',
      text: `Hi,\n\nI noticed your job posting and I'm very interested. I have relevant experience and can start immediately.\n\nI'd love to discuss the details. When is a good time to connect?\n\nBest regards`,
    },
    {
      id: 'technical',
      label: 'Technical Focus',
      text: `Hello,\n\nI specialize in exactly this type of work. I've completed similar projects and can deliver high-quality results on time.\n\nKey highlights:\n• Relevant technical expertise\n• Fast turnaround\n• Clear communication\n\nLooking forward to working with you!`,
    },
    {
      id: 'micro',
      label: 'Quick Task',
      text: `Hi,\n\nI can handle this quickly and efficiently. I'm available to start right now and will deliver clean, tested results.\n\nLet me know if you'd like to proceed!`,
    },
  ];
  res.json({ templates });
});

module.exports = router;
