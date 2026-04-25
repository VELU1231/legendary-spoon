/**
 * JobSniper API — Cloudflare Worker
 *
 * HTTP routes (Hono):        GET /api/jobs, /api/jobs/top-picks, /api/stats,
 *                             /api/sources, /api/proposals/:jobId,
 *                             /api/applications (CRUD), /health
 *
 * Cron trigger (scheduled):  Runs every minute. Fetches all job sources,
 *                             enriches + persists new jobs in D1, and fires
 *                             Telegram alerts for FAST_WIN jobs.
 *
 * Cloudflare free-tier services used:
 *   • Workers  (100 k req/day)
 *   • D1       (5 M row reads / 100 k writes per day)
 *   • Cron     (free, 1-minute minimum interval)
 */

import { Hono }          from 'hono';
import { cors }          from 'hono/cors';
import { fetchAllJobs, SCRAPERS } from './scrapers/index.js';
import { enrichJob }     from './scorer.js';
import { sendBatch }     from './telegram.js';
import {
  upsertJob, getJobs, getStats,
  upsertApplication, updateApplication, getApplication,
  getApplications, deleteApplication, getApplicationStats,
  VALID_STATUSES,
} from './db.js';

const app = new Hono();

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Allow any origin so the static frontend can reach the API regardless of
// where it is deployed. No credentials are used.
app.use('*', cors({
  origin:         '*',
  allowMethods:   ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders:   ['Content-Type'],
  exposeHeaders:  [],
}));

// ─── Health ───────────────────────────────────────────────────────────────────
app.get('/health', (c) => c.json({ status: 'ok' }));

// ─── Jobs ─────────────────────────────────────────────────────────────────────

// GET /api/jobs
// Query: limit, offset, source, excludeSource, category, keyword, excludeKeyword,
//        minBudget, maxBudget, maxAgeMinutes, sortBy (posted_at | win_probability)
app.get('/api/jobs', async (c) => {
  try {
    const q = c.req.query();
    const {
      limit         = '50',
      offset        = '0',
      source,
      excludeSource,
      category,
      keyword,
      excludeKeyword,
      minBudget,
      maxBudget,
      maxAgeMinutes,
      sortBy        = 'posted_at',
    } = q;

    const dbSortBy = sortBy === 'win_probability' ? 'posted_at' : sortBy;

    const rawJobs = await getJobs(c.env.DB, {
      limit:         Math.min(parseInt(limit)  || 50, 200),
      offset:        parseInt(offset) || 0,
      source,
      excludeSource,
      category,
      keyword,
      excludeKeyword,
      minBudget:     minBudget     ? parseFloat(minBudget)   : undefined,
      maxBudget:     maxBudget     ? parseFloat(maxBudget)   : undefined,
      maxAgeMinutes: maxAgeMinutes ? parseInt(maxAgeMinutes) : undefined,
      sortBy:        dbSortBy,
    });

    const jobs = rawJobs.map(enrichJob);
    const sorted = sortBy === 'win_probability'
      ? [...jobs].sort((a, b) => b.win_probability - a.win_probability)
      : jobs;

    return c.json({ jobs: sorted, total: sorted.length });
  } catch (err) {
    console.error('[API] GET /jobs error:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/jobs/top-picks
// Returns the top-ranked jobs by win probability
app.get('/api/jobs/top-picks', async (c) => {
  try {
    const { maxAgeMinutes = '120', limit = '20' } = c.req.query();
    const rawJobs = await getJobs(c.env.DB, {
      limit:         200,
      offset:        0,
      maxAgeMinutes: parseInt(maxAgeMinutes) || 120,
    });

    const topPicks = rawJobs
      .map(enrichJob)
      .sort((a, b) => b.win_probability - a.win_probability)
      .slice(0, Math.min(parseInt(limit) || 20, 50));

    return c.json({ jobs: topPicks, total: topPicks.length });
  } catch (err) {
    console.error('[API] GET /jobs/top-picks error:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/stats
app.get('/api/stats', async (c) => {
  try {
    return c.json(await getStats(c.env.DB));
  } catch (err) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/sources
app.get('/api/sources', (c) => {
  return c.json({ sources: SCRAPERS.map(s => s.source) });
});

// GET /api/proposals/:jobId
// Returns tailored proposal templates for a job.
app.get('/api/proposals/:jobId', (c) => {
  const { jobTitle = 'this project' } = c.req.query();
  const safeTitle = String(jobTitle).slice(0, 120);

  const templates = [
    {
      id:    'fast',
      label: '⚡ Fast & Direct',
      text:
        `Hi,\n\nI saw "${safeTitle}" and I can start right now.\n\n` +
        `I have hands-on experience with exactly this type of work and can deliver ` +
        `clean, tested results quickly.\n\n` +
        `What's the best way to kick things off?\n\nBest,`,
    },
    {
      id:    'technical',
      label: '🛠 Technical Focus',
      text:
        `Hello,\n\nYour posting for "${safeTitle}" caught my attention immediately.\n\n` +
        `I specialise in this area and have completed multiple similar projects. ` +
        `I'll deliver:\n• High-quality, well-tested output\n• Clear progress updates\n• Fast turnaround\n\n` +
        `Happy to share relevant samples. When can we talk?\n\nBest,`,
    },
    {
      id:    'micro',
      label: '🎯 Micro-Task',
      text:
        `Hi,\n\nI can handle "${safeTitle}" quickly and efficiently — available to start immediately.\n\n` +
        `I'll deliver clean results and keep communication clear throughout.\n\n` +
        `Ready when you are!`,
    },
    {
      id:    'value',
      label: '💎 Value Pitch',
      text:
        `Hello,\n\nI noticed "${safeTitle}" and I believe I'm the right fit.\n\n` +
        `Why choose me?\n• I've done this before — no learning curve\n` +
        `• Fast delivery with quality guaranteed\n• Transparent pricing, no surprises\n\n` +
        `Let's make this happen. Looking forward to your reply!`,
    },
  ];

  return c.json({ templates, jobTitle: safeTitle });
});

// ─── Applications ─────────────────────────────────────────────────────────────

// GET /api/applications
app.get('/api/applications', async (c) => {
  try {
    const { status, sortBy, limit = '200', offset = '0' } = c.req.query();
    const apps = await getApplications(c.env.DB, {
      status:  status && VALID_STATUSES.has(status) ? status : undefined,
      sortBy,
      limit:   Math.min(parseInt(limit)  || 200, 500),
      offset:  parseInt(offset) || 0,
    });
    return c.json({ applications: apps, total: apps.length });
  } catch (err) {
    console.error('[API] GET /applications error:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/applications/stats
app.get('/api/applications/stats', async (c) => {
  try {
    return c.json(await getApplicationStats(c.env.DB));
  } catch (err) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /api/applications/:jobId
app.get('/api/applications/:jobId', async (c) => {
  try {
    const app = await getApplication(c.env.DB, c.req.param('jobId'));
    if (!app) return c.json({ error: 'Not found' }, 404);
    return c.json(app);
  } catch (err) {
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// POST /api/applications
// Body: { job: { id, title, url, ... }, status?, applied_at?, notes? }
app.post('/api/applications', async (c) => {
  try {
    const body = await c.req.json();
    const { job, status, applied_at, notes } = body;

    if (!job?.id || !job?.title || !job?.url) {
      return c.json({ error: 'job.id, job.title, and job.url are required' }, 400);
    }
    if (status && !VALID_STATUSES.has(status)) {
      return c.json({
        error: `Invalid status. Must be one of: ${[...VALID_STATUSES].join(', ')}`,
      }, 400);
    }

    const app = await upsertApplication(c.env.DB, { job, status, applied_at, notes });
    return c.json(app, 201);
  } catch (err) {
    console.error('[API] POST /applications error:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// PATCH /api/applications/:jobId
// Body: { status?, notes?, applied_at? }
app.patch('/api/applications/:jobId', async (c) => {
  try {
    const jobId = c.req.param('jobId');
    const { status, notes, applied_at } = await c.req.json();

    if (status && !VALID_STATUSES.has(status)) {
      return c.json({
        error: `Invalid status. Must be one of: ${[...VALID_STATUSES].join(', ')}`,
      }, 400);
    }

    const updated = await updateApplication(c.env.DB, jobId, { status, notes, applied_at });
    if (!updated) return c.json({ error: 'Application not found' }, 404);
    return c.json(updated);
  } catch (err) {
    console.error('[API] PATCH /applications error:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// DELETE /api/applications/:jobId
app.delete('/api/applications/:jobId', async (c) => {
  try {
    const deleted = await deleteApplication(c.env.DB, c.req.param('jobId'));
    if (!deleted) return c.json({ error: 'Application not found' }, 404);
    return c.json({ success: true });
  } catch (err) {
    console.error('[API] DELETE /applications error:', err);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ─── Cron: scheduled scraper cycle ───────────────────────────────────────────

async function runFetchCycle(env) {
  console.log(`[Scheduler] Starting fetch cycle at ${new Date().toISOString()}`);
  try {
    const rawJobs = await fetchAllJobs();
    console.log(`[Scheduler] Fetched ${rawJobs.length} total jobs`);

    const newJobs = [];
    for (const job of rawJobs) {
      const enriched = enrichJob(job);
      const isNew    = await upsertJob(env.DB, enriched);
      if (isNew) newJobs.push(enriched);
    }

    console.log(`[Scheduler] ${newJobs.length} new jobs inserted`);

    if (newJobs.length > 0) {
      const fastWinJobs = newJobs.filter(j => j.labels?.includes('FAST_WIN'));
      if (fastWinJobs.length > 0) {
        await sendBatch(env, fastWinJobs);
      }
    }
  } catch (err) {
    console.error('[Scheduler] Fetch cycle error:', err.message);
  }
}

// ─── Worker export ────────────────────────────────────────────────────────────

export default {
  // HTTP requests
  fetch: app.fetch.bind(app),

  // Cron trigger (wrangler.toml: crons = ["*/1 * * * *"])
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runFetchCycle(env));
  },
};
