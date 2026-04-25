import { fetchReddit }      from './reddit.js';
import { fetchRemotive }    from './remotive.js';
import { fetchRemoteOK }    from './remoteok.js';
import { fetchWWR }         from './weworkremotely.js';
import { fetchArbeitnow }   from './arbeitnow.js';
import { fetchHackerNews }  from './hackernews.js';
import { fetchJobicy }      from './jobicy.js';

export const SCRAPERS = [
  { fetch: fetchReddit,     source: 'reddit' },
  { fetch: fetchRemotive,   source: 'remotive' },
  { fetch: fetchRemoteOK,   source: 'remoteok' },
  { fetch: fetchWWR,        source: 'weworkremotely' },
  { fetch: fetchArbeitnow,  source: 'arbeitnow' },
  { fetch: fetchHackerNews, source: 'hackernews' },
  { fetch: fetchJobicy,     source: 'jobicy' },
];

export async function fetchAllJobs() {
  const results = await Promise.allSettled(SCRAPERS.map(s => s.fetch()));
  const allJobs = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') {
      allJobs.push(...result.value);
    } else {
      console.error(`[Scraper:${SCRAPERS[i].source}] Failed:`, result.reason?.message);
    }
  }
  return allJobs;
}
