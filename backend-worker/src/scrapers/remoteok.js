const SOURCE = 'remoteok';

export async function fetchRemoteOK() {
  const jobs = [];
  try {
    const res = await fetch('https://remoteok.com/api', {
      headers: { 'User-Agent': 'JobSniper/1.0 (contact: jobapp@example.com)' },
      signal:  AbortSignal.timeout(15000),
    });
    if (!res.ok) return jobs;
    const data = await res.json();

    for (const j of data) {
      if (!j.id || !j.position) continue;
      const postedAt = j.date ? new Date(j.date).getTime() : Date.now();
      jobs.push({
        id:              `${SOURCE}_${j.id}`,
        title:           j.position,
        company:         j.company || 'Unknown',
        description:     stripHtml(j.description || '').slice(0, 500),
        url:             j.url || `https://remoteok.com/remote-jobs/${j.id}`,
        source:          SOURCE,
        category:        (j.tags || []).join(', '),
        tags:            j.tags || [],
        budget_min:      j.salary_min || null,
        budget_max:      j.salary_max || null,
        budget_currency: 'USD',
        posted_at:       postedAt,
        fetched_at:      Date.now(),
        applicant_count: j.views || 0,
        is_remote:       true,
        location:        'Worldwide',
      });
    }
  } catch (err) {
    console.error('[RemoteOK] Error:', err.message);
  }
  return jobs;
}

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
