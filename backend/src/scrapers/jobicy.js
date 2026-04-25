const RSSParser = require('rss-parser');
const parser = new RSSParser({ timeout: 10000 });

const SOURCE = 'jobicy';

const FEEDS = [
  { url: 'https://jobicy.com/?feed=job_feed', category: 'general' },
  { url: 'https://jobicy.com/?feed=job_feed&job_categories=dev&job_types=full-time', category: 'development' },
  { url: 'https://jobicy.com/?feed=job_feed&job_categories=design&job_types=full-time', category: 'design' },
];

async function fetchJobicy() {
  const jobs = [];
  for (const feed of FEEDS) {
    try {
      const data = await parser.parseURL(feed.url);
      for (const item of data.items || []) {
        const id = item.guid || item.link;
        if (!id) continue;
        const postedAt = item.pubDate ? new Date(item.pubDate).getTime() : Date.now();
        jobs.push({
          id: `${SOURCE}_${Buffer.from(id).toString('base64').slice(0, 20)}`,
          title: item.title || 'Untitled',
          company: item['jobicy:company'] || extractCompanyFromTitle(item.title || ''),
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
      console.error(`[Jobicy] Error fetching ${feed.url}:`, err.message);
    }
  }
  return jobs;
}

function extractCompanyFromTitle(title) {
  const match = title.match(/at ([^-]+)$/i) || title.match(/@ ([^-]+)$/i);
  return match ? match[1].trim() : 'Unknown';
}

module.exports = { fetch: fetchJobicy, source: SOURCE };
