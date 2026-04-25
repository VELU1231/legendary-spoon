/**
 * Telegram Bot Integration — Cloudflare Worker edition
 *
 * Secrets set via: wrangler secret put TELEGRAM_BOT_TOKEN
 *                  wrangler secret put TELEGRAM_CHAT_ID
 * Optional env var (non-secret): TELEGRAM_MIN_WIN_SCORE (default: 70)
 *
 * Setup guide:
 *  1. Open Telegram → @BotFather → /newbot → copy the API token
 *  2. Start a chat with your bot, visit:
 *     https://api.telegram.org/bot<TOKEN>/getUpdates  → find your chat_id
 *  3. wrangler secret put TELEGRAM_BOT_TOKEN
 *  4. wrangler secret put TELEGRAM_CHAT_ID
 */

function isConfigured(env) {
  return !!(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID);
}

function labelEmoji(label) {
  const MAP = {
    HOT:             '🔥',
    FRESH:           '⚡',
    LOW_COMPETITION: '🎯',
    FAST_WIN:        '🏆',
    GOOD_CHANCE:     '✅',
    MICRO_TASK:      '⚙️',
  };
  return MAP[label] || '';
}

function formatJobMessage(job) {
  const labels = (job.labels || []).map(l => `${labelEmoji(l)} ${l.replace(/_/g, ' ')}`).join('  ');
  const ageMin  = Math.round((Date.now() - job.posted_at) / 60000);
  const ageStr  = ageMin < 1 ? 'just now' : ageMin === 1 ? '1 min ago' : `${ageMin} min ago`;

  const wpBar   = buildBar(job.win_probability ?? 0);
  const breakdown = job.win_breakdown
    ? `Competition: ${buildBar(job.win_breakdown.competition ?? 0)}\n` +
      `Urgency:     ${buildBar(job.win_breakdown.urgency ?? 0)}\n` +
      `Simplicity:  ${buildBar(job.win_breakdown.simplicity ?? 0)}`
    : '';

  const budget = job.budget_max
    ? `💰 Budget: ${job.budget_currency || 'USD'} ${job.budget_max.toLocaleString()}`
    : '';

  return [
    `🆕 *NEW JOB — ${(job.source || '').toUpperCase()}*`,
    `*${escapeMarkdown(job.title)}*`,
    job.company ? `🏢 ${escapeMarkdown(job.company)}` : '',
    `⏱ Posted: ${ageStr}`,
    budget,
    labels ? `\n${labels}` : '',
    `\n🎯 Win Probability: *${job.win_probability ?? 0}%*`,
    wpBar,
    breakdown ? `\n${breakdown}` : '',
    `\n🔗 [Apply Now](${job.url})`,
  ].filter(Boolean).join('\n');
}

function buildBar(score) {
  const filled = Math.round((score / 100) * 10);
  return `[${'█'.repeat(filled)}${'░'.repeat(10 - filled)}] ${score}%`;
}

/**
 * Escape text for Telegram MarkdownV2.
 * All of the following must be escaped: \ _ * [ ] ( ) ~ ` > # + - = | { } . !
 */
function escapeMarkdown(text) {
  if (!text) return '';
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

export async function sendAlert(env, job) {
  if (!isConfigured(env)) return;
  const minScore = parseInt(env.TELEGRAM_MIN_WIN_SCORE || '70', 10);
  if ((job.win_probability ?? 0) < minScore) return;

  const text = formatJobMessage(job);
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id:                  env.TELEGRAM_CHAT_ID,
          text,
          parse_mode:               'MarkdownV2',
          disable_web_page_preview: false,
        }),
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) {
      const err = await res.text();
      console.error('[Telegram] sendMessage failed:', err);
    }
  } catch (err) {
    console.error('[Telegram] Request error:', err.message);
  }
}

export async function sendBatch(env, jobs) {
  if (!isConfigured(env) || !jobs.length) return;
  for (const job of jobs) {
    await sendAlert(env, job);
    // Space out messages to respect Telegram rate limit (~30 msg/s)
    await new Promise(r => setTimeout(r, 350));
  }
}
