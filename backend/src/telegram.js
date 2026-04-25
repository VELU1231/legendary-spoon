/**
 * Telegram Bot Integration
 *
 * Setup guide (no paid plan required):
 *  1. Open Telegram and search for @BotFather
 *  2. Send /newbot and follow the prompts
 *  3. Copy the API token it gives you → set TELEGRAM_BOT_TOKEN env var
 *  4. Start a chat with your bot, then visit:
 *       https://api.telegram.org/bot<TOKEN>/getUpdates
 *     to find your chat_id → set TELEGRAM_CHAT_ID env var
 *
 * Optional – alert only high-scoring jobs:
 *   TELEGRAM_MIN_WIN_SCORE=75  (default: 70)
 */

const fetch = require('node-fetch');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;
const MIN_SCORE = parseInt(process.env.TELEGRAM_MIN_WIN_SCORE || '70', 10);

function isConfigured() {
  return !!(BOT_TOKEN && CHAT_ID);
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

  const wpBar = buildBar(job.win_probability ?? 0);
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
 * Per Telegram docs, ALL of the following must be escaped with a leading backslash:
 *   \ _ * [ ] ( ) ~ ` > # + - = | { } . !
 * The backslash itself must be escaped first to avoid double-escaping.
 */
function escapeMarkdown(text) {
  if (!text) return '';
  return String(text)
    .replace(/\\/g, '\\\\')   // backslash first — must precede all others
    .replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

async function sendAlert(job) {
  if (!isConfigured()) return;
  if ((job.win_probability ?? 0) < MIN_SCORE) return;

  const text = formatJobMessage(job);
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id:    CHAT_ID,
          text,
          parse_mode: 'MarkdownV2',
          disable_web_page_preview: false,
        }),
        timeout: 8000,
      }
    );
    if (!res.ok) {
      const err = await res.text();
      console.error('[Telegram] sendMessage failed:', err);
    }
  } catch (err) {
    console.error('[Telegram] Request error:', err.message);
  }
}

async function sendBatch(jobs) {
  if (!isConfigured() || !jobs.length) return;
  // Send one message per job (Telegram rate-limit: ~30 msg/s per bot; we space them out)
  for (const job of jobs) {
    await sendAlert(job);
    await new Promise(r => setTimeout(r, 350));
  }
}

module.exports = { sendAlert, sendBatch, isConfigured, MIN_SCORE };
