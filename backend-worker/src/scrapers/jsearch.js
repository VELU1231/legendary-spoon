/**
 * JSearch — aggregates LinkedIn, Indeed, Glassdoor, ZipRecruiter
 * Free tier: 200 requests/month on RapidAPI
 * Sign up: https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch
 * Set secret: wrangler secret put JSEARCH_API_KEY
 */
const SOURCE = 'jsearch';

const QUERIES = [
  'software engineer remote',
  'frontend developer remote',
  'backend developer remote',
  'full stack developer remote',
  'data engineer remote',
  'devops engineer remote',
];

export async function fetchJSearch(env) {
  const apiKey = env?.JSEARCH_API_KEY;
  if (!apiKey) {
    console.warn('[JSearch] JSEARCH_API_KEY not set — skipping');
    return [];
  }

  const jobs = [];

  for (const query of QUERIES) {
    try {
      const url = new URL('https://jsearch.p.rapidapi.com/search');
      url.searchParams.set('query', query);
      url.searchParams.set('page', '1');
      url.searchParams.set('num_pages', '1');
      url.searchParams.set('date_posted', 'today');
      url.searchParams.set('remote_jobs_only', 'true');

      const res = await fetch(url.toString(), {
        headers: {
          'X-RapidAPI-Key':  apiKey,
          'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
          'User-Agent':      'JobSniper/1.0',
        },
        signal: AbortSignal.timeout(12000),
      });

      if (!res.ok) {
        console.error(`[JSearch] HTTP ${res.status} for query "${query}"`);
        continue;
      }

      const data = await res.json();
      for (const j of (data.data || [])) {
        const postedAt = j.job_posted_at_timestamp
          ? j.job_posted_at_timestamp * 1000
          : Date.now();

        jobs.push({
          id:              `${SOURCE}_${j.job_id}`,
          title:           j.job_title,
          company:         j.employer_name || 'Unknown',
          description:     (j.job_description || '').slice(0, 500),
          url:             j.job_apply_link || j.job_google_link,
          source:          j.job_publisher?.toLowerCase().includes('linkedin')
                             ? 'linkedin'
                             : j.job_publisher?.toLowerCase().includes('indeed')
                               ? 'indeed'
                               : SOURCE,
          category:        j.job_required_experience?.required_experience_in_months
                             ? 'experienced'
                             : 'any',
          tags:            j.job_required_skills || [],
          budget_min:      j.job_min_salary   ?? null,
          budget_max:      j.job_max_salary   ?? null,
          budget_currency: j.job_salary_currency ?? 'USD',
          posted_at:       postedAt,
          fetched_at:      Date.now(),
          applicant_count: 0,
          is_remote:       true,
          location:        j.job_city
                             ? `${j.job_city}, ${j.job_country}`
                             : 'Remote',
        });
      }
    } catch (err) {
      console.error(`[JSearch] Error for query "${query}":`, err.message);
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
