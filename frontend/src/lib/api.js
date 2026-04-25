const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const WS_URL  = process.env.NEXT_PUBLIC_WS_URL  || 'ws://localhost:3001/ws';

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export async function fetchJobs(params = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  });
  const res = await fetch(`${API_URL}/api/jobs?${qs.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch jobs');
  return res.json();
}

export async function fetchTopPicks(maxAgeMinutes = 120, limit = 20) {
  const res = await fetch(
    `${API_URL}/api/jobs/top-picks?maxAgeMinutes=${maxAgeMinutes}&limit=${limit}`
  );
  if (!res.ok) throw new Error('Failed to fetch top picks');
  return res.json();
}

export async function fetchStats() {
  const res = await fetch(`${API_URL}/api/stats`);
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

export async function fetchProposals(jobId, jobTitle = '') {
  const qs = jobTitle ? `?jobTitle=${encodeURIComponent(jobTitle)}` : '';
  const res = await fetch(
    `${API_URL}/api/proposals/${encodeURIComponent(jobId || 'generic')}${qs}`
  );
  if (!res.ok) throw new Error('Failed to fetch proposals');
  return res.json();
}

// ─── Application tracking ─────────────────────────────────────────────────────

/** Fetch all tracked applications, optionally filtered by status. */
export async function fetchApplications({ status, sortBy } = {}) {
  const qs = new URLSearchParams();
  if (status) qs.set('status', status);
  if (sortBy) qs.set('sortBy', sortBy);
  const res = await fetch(`${API_URL}/api/applications?${qs.toString()}`);
  if (!res.ok) throw new Error('Failed to fetch applications');
  return res.json();
}

/** Fetch aggregate stats (total, byStatus). */
export async function fetchApplicationStats() {
  const res = await fetch(`${API_URL}/api/applications/stats`);
  if (!res.ok) throw new Error('Failed to fetch application stats');
  return res.json();
}

/**
 * Mark a job as applied (creates or replaces the record).
 * @param {object} job   - full job object (id, title, url required)
 * @param {string} status
 * @param {string} appliedAt - ISO date string (optional, defaults to now)
 * @param {string} notes
 */
export async function markApplied(job, status = 'applied', appliedAt = null, notes = '') {
  const res = await fetch(`${API_URL}/api/applications`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ job, status, applied_at: appliedAt, notes }),
  });
  if (!res.ok) throw new Error('Failed to mark application');
  return res.json();
}

/**
 * Update status and/or notes for an existing application.
 * @param {string} jobId
 * @param {{ status?, notes?, applied_at? }} changes
 */
export async function updateApplication(jobId, changes) {
  const res = await fetch(`${API_URL}/api/applications/${encodeURIComponent(jobId)}`, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(changes),
  });
  if (!res.ok) throw new Error('Failed to update application');
  return res.json();
}

/** Remove an application from tracking. */
export async function removeApplication(jobId) {
  const res = await fetch(
    `${API_URL}/api/applications/${encodeURIComponent(jobId)}`,
    { method: 'DELETE' }
  );
  if (!res.ok) throw new Error('Failed to remove application');
  return res.json();
}

export { WS_URL };
