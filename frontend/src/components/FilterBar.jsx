'use client';
import { useState, useCallback } from 'react';

const SORT_OPTIONS = [
  { value: 'posted_at',       label: '🕐 Newest First' },
  { value: 'win_probability', label: '🏆 Win Probability' },
];

const AGE_OPTIONS = [
  { value: '',    label: 'Any time' },
  { value: '2',   label: '⚡ Last 2 min' },
  { value: '10',  label: '🔥 Last 10 min' },
  { value: '60',  label: 'Last hour' },
  { value: '360', label: 'Last 6 hours' },
  { value: '1440',label: 'Last 24 hours' },
];

const SOURCE_OPTIONS = [
  { value: '',               label: 'All sources' },
  { value: 'reddit',         label: 'Reddit' },
  { value: 'hackernews',     label: 'Hacker News' },
  { value: 'remotive',       label: 'Remotive' },
  { value: 'remoteok',       label: 'RemoteOK' },
  { value: 'weworkremotely', label: 'We Work Remotely' },
  { value: 'arbeitnow',      label: 'Arbeitnow' },
  { value: 'jobicy',         label: 'Jobicy' },
];

export default function FilterBar({ filters, onChange, onApply, jobCount }) {
  const [keyword, setKeyword] = useState(filters.keyword || '');

  const set = useCallback((key, value) => {
    onChange({ ...filters, [key]: value });
  }, [filters, onChange]);

  const handleKeywordKey = useCallback((e) => {
    if (e.key === 'Enter') onApply({ ...filters, keyword });
  }, [filters, keyword, onApply]);

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-3">
      {/* Row 1: keyword + sort */}
      <div className="flex gap-2 flex-wrap">
        <input
          type="text"
          placeholder="🔍 Keywords (e.g. python, scraping, urgent)"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onKeyDown={handleKeywordKey}
          className="flex-1 min-w-[200px] bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
        />
        <select
          value={filters.sortBy || 'posted_at'}
          onChange={e => set('sortBy', e.target.value)}
          className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
        >
          {SORT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Row 2: source + age + budget */}
      <div className="flex gap-2 flex-wrap items-center">
        <select
          value={filters.source || ''}
          onChange={e => set('source', e.target.value)}
          className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
        >
          {SOURCE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          value={filters.maxAgeMinutes || ''}
          onChange={e => set('maxAgeMinutes', e.target.value)}
          className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-indigo-500 cursor-pointer"
        >
          {AGE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <input
          type="number"
          placeholder="Min budget $"
          value={filters.minBudget || ''}
          onChange={e => set('minBudget', e.target.value)}
          className="w-28 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
        />

        <button
          onClick={() => onApply({ ...filters, keyword })}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          Apply
        </button>

        <button
          onClick={() => {
            setKeyword('');
            onApply({ sortBy: 'posted_at' });
          }}
          className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm px-3 py-2 rounded-lg transition-colors"
        >
          Reset
        </button>

        {jobCount !== undefined && (
          <span className="text-xs text-gray-400 ml-auto">
            {jobCount} job{jobCount !== 1 ? 's' : ''} shown
          </span>
        )}
      </div>
    </div>
  );
}
