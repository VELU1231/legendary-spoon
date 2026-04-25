'use client';
import { useState, useCallback } from 'react';
import ApplicationModal from './ApplicationModal';

const STATUS_META = {
  applied:      { label: '📤 Applied',      color: 'bg-blue-600',     text: 'text-blue-300',    border: 'border-blue-700/60' },
  interviewing: { label: '💬 Interviewing',  color: 'bg-yellow-600',   text: 'text-yellow-300',  border: 'border-yellow-700/60' },
  offer:        { label: '🎉 Offer',         color: 'bg-green-600',    text: 'text-green-300',   border: 'border-green-700/60' },
  accepted:     { label: '✅ Accepted',      color: 'bg-emerald-700',  text: 'text-emerald-300', border: 'border-emerald-700/60' },
  rejected:     { label: '❌ Rejected',      color: 'bg-red-700',      text: 'text-red-300',     border: 'border-red-800/60' },
  withdrawn:    { label: '🚫 Withdrawn',     color: 'bg-gray-600',     text: 'text-gray-400',    border: 'border-gray-700/60' },
};

const ALL_STATUSES = Object.keys(STATUS_META);

function timeAgo(ms) {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatDate(ms) {
  return new Date(ms).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function ApplicationTracker({ applications, stats, onUpdate, onRemove, loading }) {
  const [filterStatus, setFilterStatus] = useState('');
  const [sortBy,       setSortBy]       = useState('applied_at');
  const [keyword,      setKeyword]      = useState('');
  const [editTarget,   setEditTarget]   = useState(null); // { app, job }

  // ── Filter + sort ──────────────────────────────────────────────────────────
  const visible = applications
    .filter(a => !filterStatus || a.status === filterStatus)
    .filter(a => {
      if (!keyword.trim()) return true;
      const q = keyword.toLowerCase();
      return (a.job_title || '').toLowerCase().includes(q)
          || (a.job_company || '').toLowerCase().includes(q)
          || (a.notes || '').toLowerCase().includes(q);
    })
    .slice()
    .sort((a, b) => {
      if (sortBy === 'applied_at')  return b.applied_at - a.applied_at;
      if (sortBy === 'updated_at')  return b.updated_at - a.updated_at;
      if (sortBy === 'win_probability') return (b.win_probability || 0) - (a.win_probability || 0);
      if (sortBy === 'status') return a.status.localeCompare(b.status);
      return 0;
    });

  const handleSaveEdit = useCallback(async ({ status, notes, appliedAt }) => {
    if (!editTarget) return;
    await onUpdate(editTarget.app.job_id, {
      status,
      notes,
      applied_at: appliedAt ? new Date(appliedAt).toISOString() : undefined,
    });
    setEditTarget(null);
  }, [editTarget, onUpdate]);

  const handleRemove = useCallback(async (jobId) => {
    if (!window.confirm('Remove this application from tracking?')) return;
    await onRemove(jobId);
  }, [onRemove]);

  return (
    <div className="space-y-4">
      {/* Stats row */}
      {stats && (
        <div className="flex flex-wrap gap-3">
          <StatPill label="Total" value={stats.total} color="text-gray-200" />
          {ALL_STATUSES.map(s => {
            const count = stats.byStatus?.[s] || 0;
            if (!count) return null;
            const meta = STATUS_META[s];
            return (
              <button
                key={s}
                onClick={() => setFilterStatus(f => f === s ? '' : s)}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border cursor-pointer transition-all ${
                  filterStatus === s
                    ? `${meta.color} text-white border-transparent`
                    : `border-gray-700 ${meta.text} hover:border-gray-500`
                }`}
              >
                {meta.label.split(' ')[0]} <span className="font-bold">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Pipeline bar */}
      {stats?.total > 0 && (
        <div className="flex rounded-full overflow-hidden h-2">
          {ALL_STATUSES.map(s => {
            const count = stats.byStatus?.[s] || 0;
            if (!count) return null;
            const pct = Math.round((count / stats.total) * 100);
            return (
              <div
                key={s}
                title={`${STATUS_META[s].label}: ${count}`}
                className={`${STATUS_META[s].color} transition-all`}
                style={{ width: `${pct}%` }}
              />
            );
          })}
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-2 flex-wrap">
        <input
          type="text"
          placeholder="🔍 Search title, company, notes…"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          className="flex-1 min-w-[200px] bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
        />
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
        >
          <option value="applied_at">Sort: Date Applied</option>
          <option value="updated_at">Sort: Last Updated</option>
          <option value="win_probability">Sort: Win Score</option>
          <option value="status">Sort: Status</option>
        </select>
        {filterStatus && (
          <button
            onClick={() => setFilterStatus('')}
            className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-2 rounded-lg"
          >
            Clear filter
          </button>
        )}
        <span className="self-center text-xs text-gray-500">
          {visible.length} of {applications.length}
        </span>
      </div>

      {/* Empty state */}
      {!loading && applications.length === 0 && (
        <div className="text-center py-16 space-y-2">
          <p className="text-3xl">📋</p>
          <p className="text-gray-400 font-medium">No applications tracked yet</p>
          <p className="text-gray-500 text-sm">
            Click <span className="text-indigo-400 font-semibold">📤 Applied</span> on any job card to start tracking.
          </p>
        </div>
      )}

      {/* Application cards */}
      <div className="space-y-3">
        {visible.map(app => (
          <ApplicationCard
            key={app.job_id}
            app={app}
            onEdit={() => setEditTarget({ app, job: appToJob(app) })}
            onRemove={() => handleRemove(app.job_id)}
          />
        ))}
      </div>

      {/* Edit modal */}
      {editTarget && (
        <ApplicationModal
          job={editTarget.job}
          existing={editTarget.app}
          onSave={handleSaveEdit}
          onClose={() => setEditTarget(null)}
        />
      )}
    </div>
  );
}

// ─── Application Card ─────────────────────────────────────────────────────────

function ApplicationCard({ app, onEdit, onRemove }) {
  const [expanded, setExpanded] = useState(false);
  const meta = STATUS_META[app.status] || STATUS_META.applied;

  return (
    <article className={`bg-gray-900 border rounded-xl p-4 flex flex-col gap-2 ${meta.border}`}>
      {/* Top row */}
      <div className="flex items-start gap-3">
        {/* Status badge */}
        <span className={`flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${meta.color} text-white`}>
          {meta.label}
        </span>

        {/* Title + company */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-100 truncate">{app.job_title || 'Untitled Job'}</p>
          <p className="text-xs text-gray-400">
            {app.job_company && <span>{app.job_company} · </span>}
            {app.job_source && <span className="capitalize">{app.job_source}</span>}
          </p>
        </div>

        {/* Win prob */}
        {app.win_probability > 0 && (
          <span className="flex-shrink-0 text-xs font-bold text-green-400">
            🎯 {Math.round(app.win_probability)}%
          </span>
        )}
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
        <span>📤 Applied: {formatDate(app.applied_at)}</span>
        <span>🔄 Updated: {timeAgo(app.updated_at)}</span>
        {app.job_budget && <span>💰 {app.job_budget}</span>}
      </div>

      {/* Notes preview */}
      {app.notes && (
        <div className="bg-gray-800/60 rounded-lg px-3 py-2">
          <p className={`text-xs text-gray-300 leading-relaxed whitespace-pre-wrap ${expanded ? '' : 'line-clamp-2'}`}>
            {app.notes}
          </p>
          {app.notes.length > 120 && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-[10px] text-indigo-400 mt-1"
            >
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-1">
        <a
          href={app.job_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-200 px-3 py-1.5 rounded-lg transition-colors"
        >
          🔗 Open Job
        </a>
        <button
          onClick={onEdit}
          className="text-xs bg-indigo-900/60 hover:bg-indigo-900 text-indigo-300 px-3 py-1.5 rounded-lg transition-colors"
        >
          ✏️ Edit
        </button>
        <button
          onClick={onRemove}
          className="ml-auto text-xs bg-red-900/30 hover:bg-red-900/60 text-red-400 px-3 py-1.5 rounded-lg transition-colors"
        >
          🗑️ Remove
        </button>
      </div>
    </article>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatPill({ label, value, color }) {
  return (
    <div className="text-xs text-gray-400">
      <span className={`font-bold ${color}`}>{value}</span> {label}
    </div>
  );
}

/** Reconstruct a minimal job object from an application record for the modal */
function appToJob(app) {
  return {
    id:      app.job_id,
    title:   app.job_title   || '',
    company: app.job_company || '',
    url:     app.job_url     || '#',
    source:  app.job_source  || '',
    win_probability: app.win_probability || 0,
  };
}
