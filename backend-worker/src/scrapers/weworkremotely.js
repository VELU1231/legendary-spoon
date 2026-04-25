import { XMLParser } from 'fast-xml-parser';

const SOURCE = 'weworkremotely';

const XML_PARSER = new XMLParser({
  ignoreAttributes: true,
  // Ensure <item> is always an array even when there's only one entry
  isArray: (name) => name === 'item',
});

const RSS_FEEDS = [
  { url: 'https://weworkremotely.com/categories/remote-programming-jobs.rss', category: 'programming' },
  { url: 'https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss', category: 'devops' },
  { url: 'https://weworkremotely.com/categories/remote-design-jobs.rss', category: 'design' },
  { url: 'https://weworkremotely.com/remote-jobs.rss', category: 'general' },
];

export async function fetchWWR() {
  const jobs = [];
  for (const feed of RSS_FEEDS) {
    try {
      const items = await fetchRSSItems(feed.url);
      for (const item of items) {
        const id = item.guid ?? item.link;
        if (!id) continue;
        const postedAt = item.pubDate ? new Date(item.pubDate).getTime() : Date.now();
        const title    = item.title || '';
        const company  = extractCompany(title);

        jobs.push({
          id:              `${SOURCE}_${safeBase64(id).slice(0, 16)}`,
          title:           cleanTitle(title),
          company,
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
      console.error(`[WWR] Error fetching ${feed.url}:`, err.message);
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
  const match = title.match(/^(.+?) at (.+?)$/i);
  return match ? match[2].trim() : 'Unknown';
}

function cleanTitle(title) {
  const match = title.match(/^(.+?) at (.+?)$/i);
  return match ? match[1].trim() : title;
}
