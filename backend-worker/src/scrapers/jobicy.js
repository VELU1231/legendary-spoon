import { XMLParser } from 'fast-xml-parser';

const SOURCE = 'jobicy';

const XML_PARSER = new XMLParser({
  ignoreAttributes: true,
  isArray: (name) => name === 'item',
});

const FEEDS = [
  { url: 'https://jobicy.com/?feed=job_feed',                                                      category: 'general' },
  { url: 'https://jobicy.com/?feed=job_feed&job_categories=dev&job_types=full-time',               category: 'development' },
  { url: 'https://jobicy.com/?feed=job_feed&job_categories=design&job_types=full-time',            category: 'design' },
];

export async function fetchJobicy() {
  const jobs = [];
  for (const feed of FEEDS) {
    try {
      const items = await fetchRSSItems(feed.url);
      for (const item of items) {
        const id = item.guid ?? item.link;
        if (!id) continue;
        const postedAt = item.pubDate ? new Date(item.pubDate).getTime() : Date.now();

        jobs.push({
          id:              `${SOURCE}_${safeBase64(id).slice(0, 20)}`,
          title:           item.title || 'Untitled',
          company:         extractCompany(item.title || ''),
          description:     String(item.description || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500),
          url:             item.link || '',
          source:          SOURCE,
          category:        feed.category,
          tags:            [feed.category],
          budget_min:      null,
          budget_max:      null,
          budget_currency: 'USD',
          posted_at:       postedAt,
          fetched_at:      Date.now(),
          applicant_count: 0,
          is_remote:       true,
          location:        'Worldwide',
        });
      }
    } catch (err) {
      console.error(`[Jobicy] Error fetching ${feed.url}:`, err.message);
    }
  }
  return jobs;
}

async function fetchRSSItems(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'JobSniper/1.0' },
    signal:  AbortSignal.timeout(10000),
  });
  if (!res.ok) return [];
  const xml  = await res.text();
  const data = XML_PARSER.parse(xml);
  return data?.rss?.channel?.item ?? [];
}

function safeBase64(str) {
  try {
    return btoa(unescape(encodeURIComponent(str)));
  } catch {
    return btoa(String(str).slice(0, 64));
  }
}

function extractCompany(title) {
  const match = title.match(/at ([^-]+)$/i) || title.match(/@ ([^-]+)$/i);
  return match ? match[1].trim() : 'Unknown';
}
