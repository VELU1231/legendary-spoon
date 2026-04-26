/**
 * The Muse — tech & startup jobs, no API key required
 * Docs: https://www.themuse.com/developers/api/v2
 */
const SOURCE = 'themuse';

const CATEGORIES = [
  'Software Engineer',
  'Data Science',
  'DevOps',
  'Product',
  'Design',
];

export async function fetchTheMuse() {
  const jobs = [];

  for (const category of CATEGORIES) {
    try {
      const url = new URL('https://www.themuse.com/api/public/jobs');
      url.searchParams.set('category', category);
      url.searchParams.set('page',     '0');
      url.searchParams.set('descending', 'true');

      const res = await fetch(url.toString(), {
        headers: { 'User-Agent': 'JobSniper/1.0' },
        signal:  AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        console.error(`[TheMuse] HTTP ${res.status} for category "${category}"`);
        continue;
      }

      const data = await res.json();
      for (const j of (data.results || [])) {
        const postedAt = j.publication_date
          ? new Date(j.publication_date).getTime()
          : Date.now();

        const location = j.locations?.[0]?.name || 'Remote';
        const isRemote = /remote|anywhere/i.test(location);

        jobs.push({
          id:              `${SOURCE}_${j.id}`,
          title:           j.name,
          company:         j.company?.name || 'Unknown',
          description:     stripHtml(j.contents || '').slice(0, 500),
          url:             j.refs?.landing_page || `https://www.themuse.com/jobs/${j.id}`,
          source:          SOURCE,
          category:        category,
          tags:            (j.levels || []).map(l => l.name),
          budget_min:      null,
          budget_max:      null,
          budget_currency: 'USD',
          posted_at:       postedAt,
          fetched_at:      Date.now(),
          applicant_count: 0,
          is_remote:       isRemote,
          location:        location,
        });
      }
    } catch (err) {
      console.error(`[TheMuse] Error for category "${category}":`, err.message);
    }
  }

  return jobs;
}

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
