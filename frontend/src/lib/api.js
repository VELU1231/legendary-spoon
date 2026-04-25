const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const WS_URL  = process.env.NEXT_PUBLIC_WS_URL  || 'ws://localhost:3001/ws';

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
  const res = await fetch(`${API_URL}/api/proposals/${encodeURIComponent(jobId || 'generic')}${qs}`);
  if (!res.ok) throw new Error('Failed to fetch proposals');
  return res.json();
}

export { WS_URL };
