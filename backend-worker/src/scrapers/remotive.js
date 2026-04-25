const SOURCE = 'remotive';

export async function fetchRemotive() {
  const categories = ['software-dev', 'data', 'devops-sysadmin', 'qa', 'other'];
  const jobs = [];

  for (const cat of categories) {
    try {
      const res = await fetch(
        `https://remotive.com/api/remote-jobs?category=${cat}&limit=20`,
        { headers: { 'User-Agent': 'JobSniper/1.0' }, signal: AbortSignal.timeout(10000) },
      );
      if (!res.ok) continue;
      const data = await res.json();
      if (!data.jobs) continue;

      for (const j of data.jobs) {
        const postedAt = new Date(j.publication_date).getTime() || Date.now();
        jobs.push({
          id:              `${SOURCE}_${j.id}`,
          title:           j.title,
          company:         j.company_name,
          description:     stripHtml(j.description).slice(0, 500),
          url:             j.url,
          source:          SOURCE,
          category:        cat,
          tags:            j.tags || [],
          budget_min:      null,
          budget_max:      parseSalary(j.salary),
          budget_currency: 'USD',
          posted_at:       postedAt,
          fetched_at:      Date.now(),
          applicant_count: 0,
          is_remote:       true,
          location:        j.candidate_required_location || 'Worldwide',
        });
      }
    } catch (err) {
      console.error(`[Remotive] Error fetching category ${cat}:`, err.message);
    }
  }
  return jobs;
}

function parseSalary(salaryStr) {
  if (!salaryStr) return null;
  const match = salaryStr.match(/(\d[\d,]*)/);
  if (match) return parseFloat(match[1].replace(/,/g, ''));
  return null;
}

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
