const express = require('express');
const router  = express.Router();
const {
  upsertApplication, updateApplication, getApplication,
  getApplications, deleteApplication, getApplicationStats,
  VALID_STATUSES,
} = require('../db');

// ─── GET /api/applications ────────────────────────────────────────────────────
// Query: status, sortBy, limit, offset
router.get('/', (req, res) => {
  try {
    const { status, sortBy, limit = '200', offset = '0' } = req.query;
    const apps = getApplications({
      status:  status && VALID_STATUSES.has(status) ? status : undefined,
      sortBy,
      limit:   Math.min(parseInt(limit)  || 200, 500),
      offset:  parseInt(offset) || 0,
    });
    res.json({ applications: apps, total: apps.length });
  } catch (err) {
    console.error('[API] GET /applications error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/applications/stats ─────────────────────────────────────────────
router.get('/stats', (req, res) => {
  try {
    res.json(getApplicationStats());
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/applications/:jobId ────────────────────────────────────────────
router.get('/:jobId', (req, res) => {
  try {
    const app = getApplication(req.params.jobId);
    if (!app) return res.status(404).json({ error: 'Not found' });
    res.json(app);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/applications ───────────────────────────────────────────────────
// Body: { job, status?, applied_at?, notes? }
//   job must contain at least: { id, title, url }
router.post('/', (req, res) => {
  try {
    const { job, status, applied_at, notes } = req.body;

    if (!job?.id || !job?.title || !job?.url) {
      return res.status(400).json({
        error: 'job.id, job.title, and job.url are required',
      });
    }
    if (status && !VALID_STATUSES.has(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${[...VALID_STATUSES].join(', ')}`,
      });
    }

    const app = upsertApplication({ job, status, applied_at, notes });
    res.status(201).json(app);
  } catch (err) {
    console.error('[API] POST /applications error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── PATCH /api/applications/:jobId ──────────────────────────────────────────
// Body: { status?, notes?, applied_at? }
router.patch('/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;
    const { status, notes, applied_at } = req.body;

    if (status && !VALID_STATUSES.has(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${[...VALID_STATUSES].join(', ')}`,
      });
    }

    const updated = updateApplication(jobId, { status, notes, applied_at });
    if (!updated) return res.status(404).json({ error: 'Application not found' });
    res.json(updated);
  } catch (err) {
    console.error('[API] PATCH /applications error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── DELETE /api/applications/:jobId ─────────────────────────────────────────
router.delete('/:jobId', (req, res) => {
  try {
    const deleted = deleteApplication(req.params.jobId);
    if (!deleted) return res.status(404).json({ error: 'Application not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('[API] DELETE /applications error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
