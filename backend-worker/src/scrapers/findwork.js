/**
 * findwork.dev — developer-focused job aggregator
 * Free API key: https://findwork.dev/api-token-auth/  (email + password, instant)
 * Set secret: wrangler secret put FINDWORK_API_KEY
 */
const SOURCE = 'findwork';

const KEYWORDS = ['react', 'node', 'python', 'typescript', 'devops', 'fullstack'];

export async function fetchFindwork(env) {
  const apiKey = env?.FINDWORK_API_KEY;
  if (!apiKey) {
    console.warn('[Findwork] FINDWORK_API_KEY not set — skipping');
    return [];
  }

  const jobs = [];

  for (const kw of KEYWORDS) {
    try {
      const url = new URL('https://findwork.dev/api/jobs/');
      url.searchParams.set('search',   kw);
      url.searchParams.set('sort_by',  'date');
      url.searchParams.set('remote',   'true');

      const res = await fetch(url.toString(), {
        headers: {
          'Authorization': `Token ${apiKey}`,
          'User-Agent':    'JobSniper/1.0',
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        console.error(`[Findwork] HTTP ${res.status} for keyword "${kw}"`);
        continue;
      }

      const data = await res.json();
      for (const j of (data.results || [])) {
        const postedAt = j.date_posted
          ? new Date(j.date_posted).getTime()
          : Date.now();

        jobs.push({
          id:              `${SOURCE}_${j.id}`,
          title:           j.role,
          company:         j.company_name,
          description:     (j.text || '').slice(0, 500),
          url:             j.url,
          source:          SOURCE,
          category:        kw,
          tags:            j.keywords || [],
          budget_min:      null,
          budget_max:      null,
          budget_currency: 'USD',
          posted_at:       postedAt,
          fetched_at:      Date.now(),
          applicant_count: 0,
          is_remote:       j.remote ?? true,
          location:        j.location || 'Remote',
        });
      }
    } catch (err) {
      console.error(`[Findwork] Error for keyword "${kw}":`, err.message);
    }
  }

  return dedup(jobs);
}

function dedup(jobs) {
  const seen = new Set();
  return jobs.filter(j => {
    if (seen.has(j.id)) return false;
    seen.add(j.id);
    return true;
  });
}
