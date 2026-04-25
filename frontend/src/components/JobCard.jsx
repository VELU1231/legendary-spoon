'use client';
import { useState, useCallback } from 'react';
import WinScoreMeter from './WinScoreMeter';

const LABEL_CONFIG = {
  HOT:             { bg: 'bg-red-600',      text: 'text-white', icon: '🔥', tip: 'Posted < 2 minutes ago' },
  FRESH:           { bg: 'bg-orange-500',   text: 'text-white', icon: '⚡', tip: 'Posted < 10 minutes ago' },
  FAST_WIN:        { bg: 'bg-green-600',    text: 'text-white', icon: '🏆', tip: 'High win probability' },
  GOOD_CHANCE:     { bg: 'bg-emerald-700',  text: 'text-white', icon: '✅', tip: 'Above-average win chance' },
  LOW_COMPETITION: { bg: 'bg-blue-700',     text: 'text-white', icon: '🎯', tip: 'Few applicants detected' },
  MICRO_TASK:      { bg: 'bg-purple-700',   text: 'text-white', icon: '⚙️', tip: 'Quick/micro task' },
};

const STATUS_STYLE = {
  applied:      { label: '📤 Applied',      cls: 'bg-blue-600/20 text-blue-300 border-blue-600/40' },
  interviewing: { label: '💬 Interviewing',  cls: 'bg-yellow-600/20 text-yellow-300 border-yellow-600/40' },
  offer:        { label: '🎉 Offer',         cls: 'bg-green-600/20 text-green-300 border-green-600/40' },
  accepted:     { label: '✅ Accepted',      cls: 'bg-emerald-700/20 text-emerald-300 border-emerald-700/40' },
  rejected:     { label: '❌ Rejected',      cls: 'bg-red-700/20 text-red-300 border-red-700/40' },
  withdrawn:    { label: '🚫 Withdrawn',     cls: 'bg-gray-600/20 text-gray-400 border-gray-600/40' },
};

const SOURCE_COLORS = {
  remotive:       'bg-blue-900 text-blue-300',
  remoteok:       'bg-teal-900 text-teal-300',
  weworkremotely: 'bg-indigo-900 text-indigo-300',
  arbeitnow:      'bg-cyan-900 text-cyan-300',
  hackernews:     'bg-orange-900 text-orange-300',
  jobicy:         'bg-pink-900 text-pink-300',
  reddit:         'bg-red-900 text-red-300',
};

function timeAgo(ms) {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/**
 * @param {object} props
 * @param {object} props.job
 * @param {string|null} props.applicationStatus  – current status from tracker, or null
 * @param {Function} props.onProposal            – open proposal modal
 * @param {Function} props.onMarkApplied         – open application modal
 */
export default function JobCard({ job, applicationStatus = null, onProposal, onMarkApplied }) {
  const [copied, setCopied] = useState(false);

  const isHot    = (job.labels || []).includes('HOT');
  const isWin    = (job.labels || []).includes('FAST_WIN');
  const isTracked = applicationStatus !== null;

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(job.url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [job.url]);

  const budget = job.budget_max
    ? `${job.budget_currency || 'USD'} ${Number(job.budget_max).toLocaleString()}`
    : null;

  const srcClass = SOURCE_COLORS[job.source] || 'bg-gray-800 text-gray-300';

  return (
    <article
      className={`
        relative rounded-xl border p-4 flex flex-col gap-3 transition-all duration-300
        ${isHot
          ? 'border-red-500/60 bg-gradient-to-br from-gray-900 via-red-950/30 to-gray-900 shadow-red-900/40 shadow-lg'
          : isWin
          ? 'border-green-600/50 bg-gray-900 shadow-green-900/30 shadow-md'
          : 'border-gray-700/60 bg-gray-900 hover:border-gray-600/80'
        }
      `}
    >
      {/* Hot pulse dot */}
      {isHot && (
        <span className="absolute top-3 right-3 flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
        </span>
      )}

      {/* Header row */}
      <div className="flex flex-wrap items-start gap-2 pr-6">
        {/* Labels */}
        {(job.labels || []).map(label => {
          const cfg = LABEL_CONFIG[label];
          if (!cfg) return null;
          return (
            <span
              key={label}
              title={cfg.tip}
              className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.text}`}
            >
              {cfg.icon} {label.replace(/_/g, ' ')}
            </span>
          );
        })}
        {/* Application status badge */}
        {isTracked && STATUS_STYLE[applicationStatus] && (
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${STATUS_STYLE[applicationStatus].cls}`}
            title="Your application status"
          >
            {STATUS_STYLE[applicationStatus].label}
          </span>
        )}
        {/* Source badge */}
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${srcClass}`}>
          {job.source}
        </span>
      </div>

      {/* Title + company */}
      <div>
        <h3 className="font-semibold text-sm text-gray-100 leading-snug line-clamp-2">
          {job.title}
        </h3>
        {job.company && (
          <p className="text-xs text-gray-400 mt-0.5">{job.company}</p>
        )}
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-400">
        <span title="Posted">🕐 {timeAgo(job.posted_at)}</span>
        {budget && <span title="Budget">💰 {budget}</span>}
        {job.location && <span title="Location">📍 {job.location}</span>}
        {job.applicant_count > 0 && (
          <span title="Applicants">👥 {job.applicant_count} applicants</span>
        )}
      </div>

      {/* Description */}
      {job.description && (
        <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
          {job.description}
        </p>
      )}

      {/* Win score meter */}
      <WinScoreMeter score={job.win_probability ?? job.score ?? 0} breakdown={job.win_breakdown} />

      {/* Tags */}
      {(job.tags || []).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {(job.tags || []).slice(0, 6).map(tag => (
            <span key={tag} className="text-[10px] bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 mt-1 flex-wrap">
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`
            flex-1 text-center text-xs font-semibold py-2 px-3 rounded-lg transition-colors
            ${isWin
              ? 'bg-green-600 hover:bg-green-500 text-white'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white'
            }
          `}
        >
          🚀 Apply Now
        </a>

        {/* Mark Applied / status button */}
        {isTracked ? (
          <button
            onClick={() => onMarkApplied?.(job)}
            className={`text-xs font-semibold py-2 px-3 rounded-lg border transition-colors ${
              STATUS_STYLE[applicationStatus]?.cls ||
              'border-gray-600 text-gray-300 bg-gray-800 hover:bg-gray-700'
            }`}
            title="Click to update application status"
          >
            {STATUS_STYLE[applicationStatus]?.label || '📤 Applied'}
          </button>
        ) : (
          <button
            onClick={() => onMarkApplied?.(job)}
            className="text-xs font-semibold py-2 px-3 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-200 transition-colors"
            title="Track this application"
          >
            📤 Track
          </button>
        )}

        <button
          onClick={() => onProposal?.(job)}
          className="text-xs font-semibold py-2 px-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
        >
          📋
        </button>

        <button
          onClick={handleCopyLink}
          className="text-xs py-2 px-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
          title="Copy link"
        >
          {copied ? '✓' : '🔗'}
        </button>
      </div>
    </article>
  );
}
