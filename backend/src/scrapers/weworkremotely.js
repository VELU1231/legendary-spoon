const RSSParser = require('rss-parser');
const parser = new RSSParser({ timeout: 10000 });

const SOURCE = 'weworkremotely';

const RSS_FEEDS = [
  { url: 'https://weworkremotely.com/categories/remote-programming-jobs.rss', category: 'programming' },
  { url: 'https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss', category: 'devops' },
  { url: 'https://weworkremotely.com/categories/remote-design-jobs.rss', category: 'design' },
  { url: 'https://weworkremotely.com/remote-jobs.rss', category: 'general' },
];

async function fetchWWR() {
  const jobs = [];
  for (const feed of RSS_FEEDS) {
    try {
      const data = await parser.parseURL(feed.url);
      for (const item of data.items || []) {
        const id = item.guid || item.link;
        if (!id) continue;
        const postedAt = item.pubDate ? new Date(item.pubDate).getTime() : Date.now();
        const title = item.title || '';
        const company = extractCompany(title);

        jobs.push({
          id: `${SOURCE}_${Buffer.from(id).toString('base64').slice(0, 16)}`,
          title: cleanTitle(title),
          company,
          description: (item.contentSnippet || item.content || '').slice(0, 500),
          url: item.link || '',
          source: SOURCE,
          category: feed.category,
          tags: [feed.category],
          budget_min: null,
          budget_max: null,
          budget_currency: 'USD',
          posted_at: postedAt,
          fetched_at: Date.now(),
          applicant_count: 0,
          is_remote: true,
          location: 'Worldwide',
        });
      }
    } catch (err) {
      console.error(`[WWR] Error fetching ${feed.url}:`, err.message);
    }
  }
  return jobs;
}

function extractCompany(title) {
  const match = title.match(/^(.+?) at (.+?)$/i);
  return match ? match[2].trim() : 'Unknown';
}

function cleanTitle(title) {
  const match = title.match(/^(.+?) at (.+?)$/i);
  return match ? match[1].trim() : title;
}

module.exports = { fetch: fetchWWR, source: SOURCE };
