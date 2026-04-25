const remotive = require('./remotive');
const remoteok = require('./remoteok');
const weworkremotely = require('./weworkremotely');
const arbeitnow = require('./arbeitnow');
const hackernews = require('./hackernews');
const jobicy = require('./jobicy');
const reddit = require('./reddit');

const SCRAPERS = [remotive, remoteok, weworkremotely, arbeitnow, hackernews, jobicy, reddit];

async function fetchAllJobs() {
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

module.exports = { fetchAllJobs, SCRAPERS };
