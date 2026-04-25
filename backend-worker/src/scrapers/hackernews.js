const SOURCE = 'hackernews';

export async function fetchHackerNews() {
  const jobs = [];
  try {
    // Find the latest "Ask HN: Who is hiring?" thread via Algolia API (free)
    const searchRes = await fetch(
      'https://hn.algolia.com/api/v1/search?query=Ask+HN+Who+is+hiring&tags=ask_hn&hitsPerPage=1',
      { signal: AbortSignal.timeout(10000) },
    );
    if (!searchRes.ok) return jobs;
    const searchData = await searchRes.json();
    const thread = searchData.hits?.[0];
    if (!thread) return jobs;

    const commentsRes = await fetch(
      `https://hn.algolia.com/api/v1/items/${thread.objectID}`,
      { signal: AbortSignal.timeout(15000) },
    );
    if (!commentsRes.ok) return jobs;
    const threadData = await commentsRes.json();

    for (const comment of (threadData.children || []).slice(0, 30)) {
      if (!comment.text || comment.dead || comment.deleted) continue;
      const text      = comment.text;
      const firstLine = stripHtml(text).split('\n')[0].slice(0, 120);
      if (!firstLine) continue;

      jobs.push({
        id:              `${SOURCE}_${comment.id}`,
        title:           firstLine,
        company:         extractCompany(firstLine),
        description:     stripHtml(text).slice(0, 500),
        url:             `https://news.ycombinator.com/item?id=${comment.id}`,
        source:          SOURCE,
        category:        detectCategory(text),
        tags:            extractTags(text),
        budget_min:      null,
        budget_max:      extractBudget(text),
        budget_currency: 'USD',
        posted_at:       comment.created_at ? new Date(comment.created_at).getTime() : Date.now(),
        fetched_at:      Date.now(),
        applicant_count: 0,
        is_remote:       /remote/i.test(text),
        location:        extractLocation(text),
      });
    }
  } catch (err) {
    console.error('[HackerNews] Error:', err.message);
  }
  return jobs;
}

function stripHtml(html) {
  if (!html) return '';
  return String(html)
    .replace(/<\/?(p|br|div|li|tr|td|th|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractCompany(text) {
  const match = text.match(/^([^|(\n]+)/);
  return match ? match[1].replace(/hiring/i, '').trim().slice(0, 60) : 'Unknown';
}

function detectCategory(text) {
  const t = text.toLowerCase();
  if (/python|django|flask|fastapi/.test(t))                 return 'python';
  if (/javascript|node|react|vue|next/.test(t))              return 'javascript';
  if (/data|ml|machine learning|ai|nlp/.test(t))             return 'data';
  if (/devops|kubernetes|docker|aws|cloud/.test(t))          return 'devops';
  if (/scraping|automation|selenium|playwright/.test(t))     return 'automation';
  if (/design|figma|ux|ui/.test(t))                         return 'design';
  return 'general';
}

function extractTags(text) {
  const tags   = [];
  const checks = [
    ['remote',     /remote/i],
    ['fulltime',   /full.?time/i],
    ['parttime',   /part.?time/i],
    ['freelance',  /freelance|contract/i],
    ['python',     /python/i],
    ['javascript', /javascript|js\b/i],
    ['react',      /react/i],
    ['node',       /node\.?js/i],
    ['golang',     /\bgo\b|golang/i],
    ['rust',       /\brust\b/i],
    ['data',       /data|ml|ai/i],
    ['devops',     /devops|aws|cloud/i],
    ['scraping',   /scraping|crawling/i],
    ['automation', /automation|selenium/i],
  ];
  for (const [tag, re] of checks) {
    if (re.test(text)) tags.push(tag);
  }
  return tags;
}

function extractBudget(text) {
  const match = text.match(/\$(\d[\d,]*)\s*[kK]?/);
  if (match) {
    let val = parseFloat(match[1].replace(/,/g, ''));
    if (/k/i.test(match[0])) val *= 1000;
    return val;
  }
  return null;
}

function extractLocation(text) {
  const match = text.match(/\b(remote|worldwide|USA|US|UK|Europe|Canada|Australia)\b/i);
  return match ? match[1] : 'Unspecified';
}
