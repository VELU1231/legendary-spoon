const fetch = require('node-fetch');

const SOURCE = 'reddit';

// Subreddits with free-to-apply job posts
const SUBREDDITS = [
  { name: 'forhire',           tag: 'hiring' },
  { name: 'slavelabour',       tag: 'micro_task' },
  { name: 'freelance_forhire', tag: 'freelance' },
  { name: 'jobs4bitcoins',     tag: 'crypto' },
  { name: 'WorkOnline',        tag: 'remote' },
];

const HEADERS = {
  'User-Agent': 'JobSniper/1.0 (job aggregator; contact: jobsniper@example.com)',
  'Accept': 'application/json',
};

async function fetchReddit() {
  const jobs = [];

  for (const sub of SUBREDDITS) {
    try {
      const url = `https://www.reddit.com/r/${sub.name}/new.json?limit=25&t=day`;
      const res = await fetch(url, { headers: HEADERS, timeout: 12000 });
      if (!res.ok) {
        console.warn(`[Reddit] r/${sub.name} returned ${res.status}`);
        continue;
      }

      const data = await res.json();
      const posts = data?.data?.children || [];

      for (const { data: post } of posts) {
        // Only include [HIRING] or offer posts; skip [FOR HIRE] self-promo
        const title = post.title || '';
        if (!isHiringPost(title, sub.name)) continue;

        const postedAt = post.created_utc ? post.created_utc * 1000 : Date.now();
        const text = `${title} ${post.selftext || ''}`;

        jobs.push({
          id: `${SOURCE}_${post.id}`,
          title: cleanTitle(title),
          company: extractCompany(title),
          description: (post.selftext || '').slice(0, 500),
          url: `https://www.reddit.com${post.permalink}`,
          source: SOURCE,
          category: sub.tag,
          tags: buildTags(text, sub.tag),
          budget_min: extractBudgetMin(text),
          budget_max: extractBudgetMax(text),
          budget_currency: 'USD',
          posted_at: postedAt,
          fetched_at: Date.now(),
          applicant_count: post.num_comments || 0,
          is_remote: /remote|online|worldwide|anywhere/i.test(text),
          location: extractLocation(text),
        });
      }
    } catch (err) {
      console.error(`[Reddit] Error fetching r/${sub.name}:`, err.message);
    }
  }

  return jobs;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isHiringPost(title, subreddit) {
  // slavelabour posts are always tasks/gigs
  if (subreddit === 'slavelabour') return true;
  // For other subreddits, look for [HIRING] tag or absence of [FOR HIRE]
  const t = title.toLowerCase();
  if (t.includes('[for hire]') || t.includes('(for hire)')) return false;
  if (t.includes('[hiring]') || t.includes('(hiring)')) return true;
  if (t.includes('[task]') || t.includes('[job]') || t.includes('[gig]')) return true;
  // jobs4bitcoins: posts without [SELLING] are likely hiring
  if (subreddit === 'jobs4bitcoins' && !t.includes('[selling]')) return true;
  // WorkOnline: any post might be relevant
  if (subreddit === 'WorkOnline') return true;
  return false;
}

function cleanTitle(title) {
  return title
    .replace(/^\[(HIRING|TASK|JOB|GIG|PAYING)\]\s*/i, '')
    .replace(/\s*\[.+?\]/g, '')
    .replace(/\s*\(.+?\)/g, '')
    .trim()
    .slice(0, 120);
}

function extractCompany(title) {
  const match = title.match(/(?:at|@|for)\s+([A-Z][A-Za-z0-9 &]{2,30})/);
  return match ? match[1].trim() : 'Reddit User';
}

function buildTags(text, baseTag) {
  const tags = [baseTag, 'reddit'];
  const checks = [
    ['python', /python/i],
    ['javascript', /javascript|node\.?js/i],
    ['scraping', /scraping|crawling|selenium/i],
    ['data entry', /data entry|spreadsheet|excel|csv/i],
    ['automation', /automation|script/i],
    ['design', /design|figma|photoshop/i],
    ['writing', /writing|copywriting|article/i],
    ['urgent', /urgent|asap|quick|fast|need now|today/i],
    ['simple', /simple|easy|quick|small/i],
    ['remote', /remote|online/i],
  ];
  for (const [tag, re] of checks) {
    if (re.test(text) && !tags.includes(tag)) tags.push(tag);
  }
  return tags;
}

function extractBudgetMin(text) {
  const match = text.match(/\$\s*(\d[\d,.]*)\s*[-–]\s*\$?\s*(\d[\d,.]*)/);
  if (match) return parseAmount(match[1]);
  return null;
}

function extractBudgetMax(text) {
  const rangeMatch = text.match(/\$\s*(\d[\d,.]*)\s*[-–]\s*\$?\s*(\d[\d,.]*)/);
  if (rangeMatch) return parseAmount(rangeMatch[2]);
  const singleMatch = text.match(/\$\s*(\d[\d,.]+)/);
  if (singleMatch) return parseAmount(singleMatch[1]);
  return null;
}

function parseAmount(str) {
  if (!str) return null;
  const n = parseFloat(str.replace(/,/g, ''));
  return isNaN(n) ? null : n;
}

function extractLocation(text) {
  const match = text.match(/\b(remote|worldwide|anywhere|USA|US|UK|Europe|Canada|Australia|India)\b/i);
  return match ? match[1] : 'Unspecified';
}

module.exports = { fetch: fetchReddit, source: SOURCE };
