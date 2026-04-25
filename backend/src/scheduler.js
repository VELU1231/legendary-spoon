const { fetchAllJobs } = require('./scrapers');
const { upsertJob } = require('./db');
const { enrichJob } = require('./scorer');

let broadcastFn = null;
let intervalHandle = null;

function setBroadcast(fn) {
  broadcastFn = fn;
}

async function runFetchCycle() {
  console.log(`[Scheduler] Starting fetch cycle at ${new Date().toISOString()}`);
  try {
    const rawJobs = await fetchAllJobs();
    console.log(`[Scheduler] Fetched ${rawJobs.length} total jobs`);

    const newJobs = [];
    for (const job of rawJobs) {
      const enriched = enrichJob(job);
      const isNew = upsertJob(enriched);
      if (isNew) {
        newJobs.push(enriched);
      }
    }

    console.log(`[Scheduler] ${newJobs.length} new jobs found`);

    if (newJobs.length > 0 && broadcastFn) {
      broadcastFn({ type: 'new_jobs', jobs: newJobs, count: newJobs.length });
    }

    return newJobs;
  } catch (err) {
    console.error('[Scheduler] Fetch cycle error:', err.message);
    return [];
  }
}

function start(intervalMs = 60000) {
  console.log(`[Scheduler] Starting with ${intervalMs / 1000}s interval`);
  // Run immediately
  runFetchCycle();
  intervalHandle = setInterval(runFetchCycle, intervalMs);
}

function stop() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

module.exports = { start, stop, setBroadcast, runFetchCycle };
