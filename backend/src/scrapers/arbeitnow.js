const fetch = require('node-fetch');

const SOURCE = 'arbeitnow';

async function fetchArbeitnow() {
  const jobs = [];
  try {
    const res = await fetch('https://www.arbeitnow.com/api/job-board-api', {
      headers: { 'User-Agent': 'JobAggregator/1.0' },
      timeout: 10000,
    });
    if (!res.ok) return jobs;
    const data = await res.json();

    for (const j of (data.data || [])) {
      const postedAt = j.created_at ? j.created_at * 1000 : Date.now();
      jobs.push({
        id: `${SOURCE}_${j.slug || j.title?.replace(/\s+/g, '-')}`,
        title: j.title,
        company: j.company_name || 'Unknown',
        description: (j.description || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500),
        url: j.url,
        source: SOURCE,
        category: (j.tags || []).join(', '),
        tags: j.tags || [],
        budget_min: null,
        budget_max: null,
        budget_currency: 'EUR',
        posted_at: postedAt,
        fetched_at: Date.now(),
        applicant_count: 0,
        is_remote: j.remote || false,
        location: j.location || 'Germany',
      });
    }
  } catch (err) {
    console.error('[Arbeitnow] Error:', err.message);
  }
  return jobs;
}

module.exports = { fetch: fetchArbeitnow, source: SOURCE };
