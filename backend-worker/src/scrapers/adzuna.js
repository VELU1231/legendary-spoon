/**
 * Adzuna — global job board aggregator (Indeed-style)
 * Free tier: 250 requests/day
 * Sign up: https://developer.adzuna.com/  (takes ~1 min)
 * Set secrets:
 *   wrangler secret put ADZUNA_APP_ID
 *   wrangler secret put ADZUNA_APP_KEY
 */
const SOURCE = 'adzuna';

const COUNTRIES = ['us', 'gb', 'au', 'ca'];
const SEARCH_TERMS = ['software engineer', 'developer', 'data engineer'];

export async function fetchAdzuna(env) {
  const appId  = env?.ADZUNA_APP_ID;
  const appKey = env?.ADZUNA_APP_KEY;

  if (!appId || !appKey) {
    console.warn('[Adzuna] ADZUNA_APP_ID / ADZUNA_APP_KEY not set — skipping');
    return [];
  }

  const jobs = [];

  for (const country of COUNTRIES) {
    for (const term of SEARCH_TERMS) {
      try {
        const url = new URL(
          `https://api.adzuna.com/v1/api/jobs/${country}/search/1`,
        );
        url.searchParams.set('app_id',        appId);
        url.searchParams.set('app_key',       appKey);
        url.searchParams.set('results_per_page', '20');
        url.searchParams.set('what',          term);
        url.searchParams.set('content-type',  'application/json');
        url.searchParams.set('sort_by',       'date');
        url.searchParams.set('max_days_old',  '1');

        const res = await fetch(url.toString(), {
          headers: { 'User-Agent': 'JobSniper/1.0' },
          signal:  AbortSignal.timeout(10000),
        });

        if (!res.ok) {
          console.error(`[Adzuna] HTTP ${res.status} for ${country}/${term}`);
          continue;
        }

        const data = await res.json();
        for (const j of (data.results || [])) {
          const postedAt = j.created ? new Date(j.created).getTime() : Date.now();
          jobs.push({
            id:              `${SOURCE}_${j.id}`,
            title:           j.title,
            company:         j.company?.display_name || 'Unknown',
            description:     (j.description || '').slice(0, 500),
            url:             j.redirect_url,
            source:          SOURCE,
            category:        j.category?.label || term,
            tags:            [],
            budget_min:      j.salary_min ?? null,
            budget_max:      j.salary_max ?? null,
            budget_currency: country === 'gb' ? 'GBP'
                           : country === 'au' ? 'AUD'
                           : country === 'ca' ? 'CAD'
                           : 'USD',
            posted_at:       postedAt,
            fetched_at:      Date.now(),
            applicant_count: 0,
            is_remote:       /remote/i.test(j.title + j.description),
            location:        j.location?.display_name || country.toUpperCase(),
          });
        }
      } catch (err) {
        console.error(`[Adzuna] Error for ${country}/${term}:`, err.message);
      }
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
