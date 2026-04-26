import { fetchReddit }      from './reddit.js';
import { fetchRemotive }    from './remotive.js';
import { fetchRemoteOK }    from './remoteok.js';
import { fetchWWR }         from './weworkremotely.js';
import { fetchArbeitnow }   from './arbeitnow.js';
import { fetchHackerNews }  from './hackernews.js';
import { fetchJobicy }      from './jobicy.js';
import { fetchTheMuse }     from './themuse.js';
import { fetchJSearch }     from './jsearch.js';
import { fetchAdzuna }      from './adzuna.js';
import { fetchFindwork }    from './findwork.js';

// Scrapers that need no API key — always active
const FREE_SCRAPERS = [
  { fetch: (env) => fetchReddit(),      source: 'reddit'        },
  { fetch: (env) => fetchRemotive(),    source: 'remotive'      },
  { fetch: (env) => fetchRemoteOK(),    source: 'remoteok'      },
  { fetch: (env) => fetchWWR(),         source: 'weworkremotely'},
  { fetch: (env) => fetchArbeitnow(),   source: 'arbeitnow'     },
  { fetch: (env) => fetchHackerNews(),  source: 'hackernews'    },
  { fetch: (env) => fetchJobicy(),      source: 'jobicy'        },
  { fetch: (env) => fetchTheMuse(),     source: 'themuse'       },
];

// Scrapers that need an optional API key — silently skipped if key absent
const KEY_SCRAPERS = [
  { fetch: (env) => fetchJSearch(env),  source: 'jsearch'       }, // LinkedIn/Indeed/Glassdoor
  { fetch: (env) => fetchAdzuna(env),   source: 'adzuna'        }, // global aggregator
  { fetch: (env) => fetchFindwork(env), source: 'findwork'      }, // dev-focused
];

export const SCRAPERS = [...FREE_SCRAPERS, ...KEY_SCRAPERS];

export async function fetchAllJobs(env = {}) {
  const results = await Promise.allSettled(SCRAPERS.map(s => s.fetch(env)));
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
